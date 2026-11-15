export interface EstimateHistoryEventLike {
  id: string;
  taskId: string;
  action: string;
  createdAt: Date;
  oldValue: unknown;
  newValue: unknown;
  metadata?: unknown;
}

export interface TaskEstimateSubject {
  id: string;
  estimateHours: unknown;
}

export type EstimateResolutionSource =
  | "SNAPSHOT_METADATA"
  | "RECONSTRUCTED_FROM_DIFFS"
  | "CURRENT_VALUE"
  | "INCOMPLETE_HISTORY"
  | "MISSING_ESTIMATE_DATA";

export interface ResolvedTaskEstimate {
  taskId: string;
  estimateHours: number | null;
  source: EstimateResolutionSource;
  isExact: boolean;
  hasPostTargetEstimateEdit: boolean;
  hasPostFreezeEstimateEdit: boolean;
}

export type EstimateSnapshotMode =
  "SNAPSHOT_METADATA" | "RECONSTRUCTED_FROM_HISTORY" | "INCOMPLETE_HISTORY";

export interface AggregatedSprintEstimateResolution {
  byTaskId: Map<string, ResolvedTaskEstimate>;
  totalEstimateHours: number;
  estimatedTaskCount: number;
  totalTaskCount: number;
  estimateCoveragePercent: number;
  snapshotMode: EstimateSnapshotMode;
  hasPostTargetEstimateEdits: boolean;
  hasPostFreezeEstimateEdits: boolean;
  incompleteTaskIds: string[];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalizes Prisma Decimal, numeric string, or number estimate values into finite numbers or null.
 */
export function normalizeEstimateHours(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    const parsed = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function estimateValuesEqual(a: number | null, b: number | null): boolean {
  if (a === null && b === null) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  return Math.abs(a - b) < 1e-6;
}

function readEstimateField(record: unknown): { present: boolean; value: number | null } {
  if (!isPlainRecord(record)) {
    return { present: false, value: null };
  }
  if (!Object.prototype.hasOwnProperty.call(record, "estimateHours")) {
    return { present: false, value: null };
  }
  return {
    present: true,
    value: normalizeEstimateHours(record.estimateHours),
  };
}

export function touchesEstimateField(event: EstimateHistoryEventLike): boolean {
  return readEstimateField(event.oldValue).present || readEstimateField(event.newValue).present;
}

/**
 * Groups TaskHistory estimate events by taskId and sorts each list descending by (createdAt DESC, id DESC).
 */
export function groupAndSortEstimateEvents(
  events: readonly EstimateHistoryEventLike[]
): Map<string, EstimateHistoryEventLike[]> {
  const byTaskId = new Map<string, EstimateHistoryEventLike[]>();

  for (const event of events) {
    let bucket = byTaskId.get(event.taskId);
    if (!bucket) {
      bucket = [];
      byTaskId.set(event.taskId, bucket);
    }
    bucket.push(event);
  }

  for (const bucket of byTaskId.values()) {
    bucket.sort((a, b) => {
      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
    });
  }

  return byTaskId;
}

/**
 * Reconstructs a task's historical `estimateHours` at `targetInstant` (P0-01).
 * Uses explicit snapshot metadata when available, otherwise walks TaskHistory(INFO_UPDATED)
 * backward from the current `task.estimateHours` while verifying chain continuity.
 */
export function resolveTaskEstimateAt(
  task: TaskEstimateSubject,
  estimateEventsDesc: readonly EstimateHistoryEventLike[],
  targetInstant: Date,
  explicitSnapshotEstimate?: unknown,
  freezeInstant?: Date | null
): ResolvedTaskEstimate {
  const targetMs = targetInstant.getTime();
  const freezeMs = freezeInstant ? freezeInstant.getTime() : null;

  let hasPostTargetEstimateEdit = false;
  let hasPostFreezeEstimateEdit = false;

  for (const event of estimateEventsDesc) {
    const evMs = event.createdAt.getTime();
    if (event.action === "INFO_UPDATED" && touchesEstimateField(event)) {
      if (evMs > targetMs) {
        hasPostTargetEstimateEdit = true;
      }
      if (freezeMs !== null && evMs > freezeMs) {
        hasPostFreezeEstimateEdit = true;
      }
    }
  }

  if (explicitSnapshotEstimate !== undefined) {
    return {
      taskId: task.id,
      estimateHours: normalizeEstimateHours(explicitSnapshotEstimate),
      source: "SNAPSHOT_METADATA",
      isExact: true,
      hasPostTargetEstimateEdit,
      hasPostFreezeEstimateEdit,
    };
  }

  // Defensive sort in case an unsorted slice was passed directly in unit tests.
  const sortedDesc = [...estimateEventsDesc].sort((a, b) => {
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
  });

  let cursorValue = normalizeEstimateHours(task.estimateHours);
  let isChainComplete = true;
  let rolledBackCount = 0;
  let resumeIndex = sortedDesc.length;

  for (let i = 0; i < sortedDesc.length; i += 1) {
    const event = sortedDesc[i];
    const evMs = event.createdAt.getTime();
    if (evMs <= targetMs) {
      resumeIndex = i;
      break;
    }

    if (event.action === "CREATED") {
      // Cross-check initial CREATED estimate against oldest post-creation cursor before zeroing out pre-creation.
      const createdField = readEstimateField(event.newValue);
      if (createdField.present && !estimateValuesEqual(cursorValue, createdField.value)) {
        isChainComplete = false;
      }
      // Task did not exist yet at targetInstant if creation occurred afterward.
      cursorValue = null;
      rolledBackCount += 1;
      resumeIndex = sortedDesc.length;
      break;
    }

    if (event.action !== "INFO_UPDATED") {
      continue;
    }

    const oldField = readEstimateField(event.oldValue);
    const newField = readEstimateField(event.newValue);
    if (!oldField.present && !newField.present) {
      continue;
    }

    if (!newField.present || !oldField.present) {
      isChainComplete = false;
      if (oldField.present) {
        cursorValue = oldField.value;
        rolledBackCount += 1;
      } else {
        break;
      }
      continue;
    }

    if (!estimateValuesEqual(cursorValue, newField.value)) {
      isChainComplete = false;
    }

    cursorValue = oldField.value;
    rolledBackCount += 1;
  }

  // Validate diff chain integrity from targetInstant back to CREATED without mutating cursorValue.
  if (isChainComplete && resumeIndex < sortedDesc.length) {
    let chainCursor = cursorValue;
    for (let j = resumeIndex; j < sortedDesc.length; j += 1) {
      const event = sortedDesc[j];
      if (event.action === "CREATED") {
        const createdField = readEstimateField(event.newValue);
        if (createdField.present && !estimateValuesEqual(chainCursor, createdField.value)) {
          isChainComplete = false;
        }
        break;
      }

      if (event.action !== "INFO_UPDATED") {
        continue;
      }

      const oldField = readEstimateField(event.oldValue);
      const newField = readEstimateField(event.newValue);
      if (!oldField.present && !newField.present) {
        continue;
      }

      if (!newField.present || !oldField.present) {
        isChainComplete = false;
        if (oldField.present) {
          chainCursor = oldField.value;
          continue;
        }
        break;
      }

      if (!estimateValuesEqual(chainCursor, newField.value)) {
        isChainComplete = false;
        break;
      }
      chainCursor = oldField.value;
    }
  }

  let source: EstimateResolutionSource;
  if (!isChainComplete) {
    source = "INCOMPLETE_HISTORY";
  } else if (cursorValue === null) {
    source = "MISSING_ESTIMATE_DATA";
  } else if (rolledBackCount > 0) {
    source = "RECONSTRUCTED_FROM_DIFFS";
  } else {
    source = "CURRENT_VALUE";
  }

  return {
    taskId: task.id,
    estimateHours: cursorValue,
    source,
    isExact: isChainComplete,
    hasPostTargetEstimateEdit,
    hasPostFreezeEstimateEdit,
  };
}

/**
 * Resolves historical `estimateHours` and coverage metrics across a set of tasks at `targetInstant`.
 */
export function resolveSprintTasksEstimatesAt(
  tasks: readonly TaskEstimateSubject[],
  eventsByTaskId: ReadonlyMap<string, readonly EstimateHistoryEventLike[]>,
  targetInstant: Date,
  snapshotByTaskId?: ReadonlyMap<string, number | null>,
  freezeInstant?: Date | null
): AggregatedSprintEstimateResolution {
  const byTaskId = new Map<string, ResolvedTaskEstimate>();
  const incompleteTaskIds: string[] = [];

  let totalEstimateHours = 0;
  let estimatedTaskCount = 0;
  let usedSnapshot = false;
  let hasIncomplete = false;
  let hasPostTargetEstimateEdits = false;
  let hasPostFreezeEstimateEdits = false;

  for (const task of tasks) {
    const events = eventsByTaskId.get(task.id) ?? [];
    const hasExplicit = snapshotByTaskId?.has(task.id) ?? false;
    const explicitVal = hasExplicit ? snapshotByTaskId?.get(task.id) : undefined;
    if (hasExplicit) {
      usedSnapshot = true;
    }

    const resolved = resolveTaskEstimateAt(task, events, targetInstant, explicitVal, freezeInstant);
    byTaskId.set(task.id, resolved);

    if (resolved.estimateHours !== null) {
      totalEstimateHours += resolved.estimateHours;
      estimatedTaskCount += 1;
    }
    if (!resolved.isExact) {
      hasIncomplete = true;
      incompleteTaskIds.push(task.id);
    }
    if (resolved.hasPostTargetEstimateEdit) {
      hasPostTargetEstimateEdits = true;
    }
    if (resolved.hasPostFreezeEstimateEdit) {
      hasPostFreezeEstimateEdits = true;
    }
  }

  const totalTaskCount = tasks.length;
  const estimateCoveragePercent =
    totalTaskCount === 0 ? 0 : Math.round((estimatedTaskCount / totalTaskCount) * 1000) / 10;

  let snapshotMode: EstimateSnapshotMode;
  if (hasIncomplete) {
    snapshotMode = "INCOMPLETE_HISTORY";
  } else if (usedSnapshot && incompleteTaskIds.length === 0) {
    snapshotMode = "SNAPSHOT_METADATA";
  } else {
    snapshotMode = "RECONSTRUCTED_FROM_HISTORY";
  }

  return {
    byTaskId,
    totalEstimateHours: Math.round(totalEstimateHours * 100) / 100,
    estimatedTaskCount,
    totalTaskCount,
    estimateCoveragePercent,
    snapshotMode,
    hasPostTargetEstimateEdits,
    hasPostFreezeEstimateEdits,
    incompleteTaskIds,
  };
}
