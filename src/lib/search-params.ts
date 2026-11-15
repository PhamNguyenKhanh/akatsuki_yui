import type { ZodType } from "zod";

export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Normalizes a Next.js App Router searchParam value to a single trimmed non-empty string.
 */
export function pickSingleSearchParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return undefined;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Safely parses a 1-indexed page number from URL search params without throwing on invalid input.
 */
export function parsePositivePageParam(value: string | string[] | undefined, fallback = 1): number {
  const raw = pickSingleSearchParam(value);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, 10000);
}

/**
 * Safely parses an optional query parameter using a Zod schema, returning undefined on mismatch.
 */
export function parseSafeQueryEnum<T>(
  schema: ZodType<T>,
  value: string | string[] | undefined
): T | undefined {
  const raw = pickSingleSearchParam(value);
  if (raw === undefined) return undefined;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Builds a relative URL preserving only non-empty parameters.
 */
export function buildUpdatedQueryUrl(
  pathname: string,
  updates: Record<string, string | number | null | undefined>
): string {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(updates)) {
    if (rawValue === null || rawValue === undefined) continue;
    const strValue = String(rawValue).trim();
    if (!strValue) continue;
    params.set(key, strValue);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
