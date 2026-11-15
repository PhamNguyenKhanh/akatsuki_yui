import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

/**
 * Shared dynamic health probe handler for `/api/health` and `/api/v1/health`.
 * Runs a lightweight `SELECT 1` check without exposing DB URLs or internal error traces.
 */
export async function handleHealthCheck(): Promise<NextResponse> {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        db: "up",
        timestamp,
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    logger.error("Health check database probe failed", {
      error: error instanceof Error ? error.message.slice(0, 120) : "DB_UNAVAILABLE",
    });

    return NextResponse.json(
      {
        status: "error",
        db: "down",
        timestamp,
      },
      {
        status: 503,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
