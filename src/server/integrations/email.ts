import "server-only";
import { Resend } from "resend";

export const MAX_EMAIL_RETRIES = 3 as const;

export type EmailDeliveryStatus = "PENDING" | "SENT" | "FAILED";
export type EmailProvider = "RESEND";

export interface EmailSendPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
}

export interface EmailDispatchResult {
  status: EmailDeliveryStatus;
  provider: EmailProvider;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  isPermanentFailure?: boolean;
}

const PERMANENT_ERROR_NAMES = new Set([
  "validation_error",
  "missing_required_field",
  "invalid_parameter",
  "invalid_from_address",
  "invalid_to_address",
  "invalid_access",
  "not_found",
]);

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
}

export function buildDeliveryIdempotencyKey(deliveryId: string): string {
  return `notification-delivery:${deliveryId}`;
}

export function classifyEmailProviderError(
  errorCode?: string | null,
  statusCode?: number | null
): boolean {
  if (statusCode && (statusCode === 400 || statusCode === 404 || statusCode === 422)) {
    return true;
  }
  if (errorCode && PERMANENT_ERROR_NAMES.has(errorCode.toLowerCase())) {
    return true;
  }
  return false;
}

/**
 * Dispatches an email via the Resend SDK (DEC-045).
 * Supports Resend's native `idempotencyKey` header (`notification-delivery:${delivery.id}`).
 */
export async function sendEmailViaResend(payload: EmailSendPayload): Promise<EmailDispatchResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress = process.env.EMAIL_FROM?.trim() || "Akatsuki Yui <onboarding@resend.dev>";

  if (!apiKey) {
    return {
      status: "FAILED",
      provider: "RESEND",
      errorCode: "RESEND_API_KEY_MISSING",
      errorMessage: "RESEND_API_KEY chưa được cấu hình trên môi trường hiện tại.",
      isPermanentFailure: false,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const response = await resend.emails.send(
      {
        from: fromAddress,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        ...(payload.text ? { text: payload.text } : {}),
      },
      payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : undefined
    );

    if (response.error) {
      const errName = response.error.name || "RESEND_PROVIDER_ERROR";
      const statusCode = (response.error as { statusCode?: number | null }).statusCode ?? null;
      return {
        status: "FAILED",
        provider: "RESEND",
        errorCode: errName,
        errorMessage: response.error.message || "Resend API trả về lỗi khi gửi email.",
        isPermanentFailure: classifyEmailProviderError(errName, statusCode),
      };
    }

    return {
      status: "SENT",
      provider: "RESEND",
      providerMessageId: response.data?.id ?? undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi kết nối mạng khi gọi Resend API.";
    return {
      status: "FAILED",
      provider: "RESEND",
      errorCode: "NETWORK_OR_RUNTIME_ERROR",
      errorMessage: message,
      isPermanentFailure: false,
    };
  }
}
