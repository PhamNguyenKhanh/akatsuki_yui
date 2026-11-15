import { badRequestError } from "@/lib/errors";

export function extractSearchParams(request: Request): Record<string, string> {
  const maybeNextRequest = request as Request & {
    nextUrl?: { searchParams?: URLSearchParams };
  };
  const searchParams = maybeNextRequest.nextUrl?.searchParams ?? new URL(request.url).searchParams;
  const rawQuery: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      rawQuery[key] = trimmed;
    }
  }

  return rawQuery;
}

export function normalizePageSearchParams(
  resolvedSearchParams: Record<string, string | string[] | undefined>
): Record<string, string> {
  const rawQuery: Record<string, string> = {};
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (typeof single === "string" && single.trim().length > 0) {
      rawQuery[key] = single.trim();
    }
  }
  return rawQuery;
}

export async function parseOptionalJsonBody(request: Request): Promise<unknown> {
  const rawText = await request.text();
  if (!rawText || rawText.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw badRequestError("Payload JSON không hợp lệ.");
  }
}
