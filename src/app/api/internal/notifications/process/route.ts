import { timingSafeEqual } from "node:crypto";
import { apiError, apiSuccess } from "@/lib/api-response";
import { unauthorizedError } from "@/lib/errors";
import { runDeadlineReminderBatch } from "@/modules/notifications/notification-deadline.service";
import { processDueEmailDeliveriesBatch } from "@/modules/notifications/notification-delivery.service";

export function verifyCronAuthorizationHeader(
  authHeader: string | null,
  configuredSecret: string | undefined = process.env.CRON_SECRET
): boolean {
  const secret = configuredSecret?.trim();
  if (!secret) {
    return false;
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const providedToken = authHeader.slice("Bearer ".length).trim();
  if (!providedToken) {
    return false;
  }

  const expectedBuf = Buffer.from(secret, "utf8");
  const providedBuf = Buffer.from(providedToken, "utf8");
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, providedBuf);
}

async function handleCronProcessRequest(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!verifyCronAuthorizationHeader(authHeader)) {
      throw unauthorizedError(
        "Xác thực CRON_SECRET không hợp lệ hoặc bị thiếu.",
        "CRON_UNAUTHORIZED"
      );
    }

    const deadlineReminders = await runDeadlineReminderBatch();
    const emailDeliveries = await processDueEmailDeliveriesBatch(50);

    return apiSuccess({
      processedAt: new Date().toISOString(),
      deadlineReminders: {
        dateKey: deadlineReminders.dateKey,
        evaluatedTasks: deadlineReminders.evaluatedTasks,
        createdReminders: deadlineReminders.createdReminders,
      },
      emailDeliveries,
    });
  } catch (error) {
    return apiError(error, { route: "/api/internal/notifications/process" });
  }
}

export async function GET(request: Request) {
  return handleCronProcessRequest(request);
}

export async function POST(request: Request) {
  return handleCronProcessRequest(request);
}
