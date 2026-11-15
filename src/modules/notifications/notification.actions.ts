"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, toActionError } from "@/lib/request";
import { requireActiveUser } from "@/modules/authorization/require-auth";
import { manualRetryNotificationDeliveryService } from "@/modules/notifications/notification-delivery.service";
import {
  markAllNotificationsReadService,
  markNotificationReadStateService,
} from "@/modules/notifications/notification.service";
import type {
  NotificationDeliveryDTO,
  NotificationDTO,
} from "@/modules/notifications/notification.types";

function revalidateNotificationPaths() {
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/admin/notifications/deliveries");
}

export async function markNotificationReadStateAction(
  notificationId: string,
  isRead: boolean
): Promise<ActionResult<NotificationDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await markNotificationReadStateService(actor, notificationId, { isRead });
    revalidateNotificationPaths();
    return {
      ok: true,
      data: updated,
    };
  } catch (error) {
    return toActionError(error, { action: "markNotificationReadStateAction" });
  }
}

export async function markAllNotificationsReadAction(): Promise<
  ActionResult<{ updatedCount: number }>
> {
  try {
    const actor = await requireActiveUser();
    const result = await markAllNotificationsReadService(actor);
    revalidateNotificationPaths();
    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return toActionError(error, { action: "markAllNotificationsReadAction" });
  }
}

export async function manualRetryNotificationDeliveryAction(
  deliveryId: string
): Promise<ActionResult<NotificationDeliveryDTO>> {
  try {
    const actor = await requireActiveUser();
    const updated = await manualRetryNotificationDeliveryService(actor, deliveryId);
    revalidateNotificationPaths();
    return {
      ok: true,
      data: updated,
    };
  } catch (error) {
    return toActionError(error, { action: "manualRetryNotificationDeliveryAction" });
  }
}
