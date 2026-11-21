import "server-only";
import Pusher from "pusher";
import { logger } from "@/lib/logger";

let cachedPusherServer: Pusher | null | undefined;

export function getPusherServer(): Pusher | null {
  if (cachedPusherServer !== undefined) {
    return cachedPusherServer;
  }

  const appId = process.env.PUSHER_APP_ID?.trim();
  const key = process.env.PUSHER_KEY?.trim();
  const secret = process.env.PUSHER_SECRET?.trim();
  const cluster = process.env.PUSHER_CLUSTER?.trim();

  if (!appId || !key || !secret || !cluster) {
    cachedPusherServer = null;
    return null;
  }

  cachedPusherServer = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return cachedPusherServer;
}

export async function triggerPusherEvent(
  channel: string,
  event: string,
  data: unknown
): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) {
    return;
  }

  try {
    await pusher.trigger(channel, event, data);
  } catch (error) {
    logger.warn("pusher.trigger.failed", {
      channel,
      event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
