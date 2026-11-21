"use client";

import PusherClient from "pusher-js";

let cachedClient: PusherClient | null | undefined;

export function isPusherClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PUSHER_KEY?.trim() && process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim()
  );
}

export function getPusherClient(): PusherClient | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY?.trim();
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim();

  if (!key || !cluster) {
    cachedClient = null;
    return null;
  }

  cachedClient = new PusherClient(key, {
    cluster,
    forceTLS: true,
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  });

  return cachedClient;
}
