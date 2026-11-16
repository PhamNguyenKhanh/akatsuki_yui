import { apiError } from "@/lib/api-response";
import { handlers } from "@/lib/auth";
import {
  RATE_LIMIT_SCOPES,
  checkRateLimit,
  consumeRateLimit,
  extractClientIpFromHeaders,
  normalizeRateLimitIdentifier,
  runWithRateLimitContext,
} from "@/lib/rate-limit";
import { MAX_JSON_BODY_BYTES, readBoundedUtf8Body } from "@/lib/request";

export const { GET } = handlers;

async function extractCredentialsEmailFromRequest(request: Request): Promise<string> {
  try {
    const cloned = request.clone();
    const contentType = cloned.headers.get("content-type")?.toLowerCase() ?? "";
    const text = await readBoundedUtf8Body(cloned, MAX_JSON_BODY_BYTES);

    if (contentType.includes("application/json")) {
      const parsed = JSON.parse(text) as { email?: unknown };
      return typeof parsed?.email === "string" ? parsed.email : "";
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(text);
      return params.get("email") ?? "";
    }

    return "";
  } catch (error) {
    if (error instanceof Error && error.name === "AppError") {
      throw error;
    }
    return "";
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/callback/credentials")) {
      const email = await extractCredentialsEmailFromRequest(request);
      const clientIp = extractClientIpFromHeaders(request.headers);
      const failIdentifier = `${clientIp}:${normalizeRateLimitIdentifier(email)}`;

      return await runWithRateLimitContext(async () => {
        await consumeRateLimit({
          scope: RATE_LIMIT_SCOPES.AUTH_LOGIN_IP,
          identifier: clientIp,
        });
        await checkRateLimit({
          scope: RATE_LIMIT_SCOPES.AUTH_LOGIN_FAIL,
          identifier: failIdentifier,
        });

        return handlers.POST(request as Parameters<typeof handlers.POST>[0]);
      });
    }

    return await handlers.POST(request as Parameters<typeof handlers.POST>[0]);
  } catch (error) {
    return apiError(error, { route: "POST /api/auth/[...nextauth]" });
  }
}
