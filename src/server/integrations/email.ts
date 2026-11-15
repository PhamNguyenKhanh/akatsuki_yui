import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getSmtpConfigFromEnv, type SmtpRuntimeConfig } from "@/lib/env";

export const EMAIL_PROVIDER_NAME = "SMTP" as const;
export const SMTP_CONNECTION_TIMEOUT_MS = 4000;
export const SMTP_GREETING_TIMEOUT_MS = 4000;
export const SMTP_SOCKET_TIMEOUT_MS = 7000;
export const SMTP_DNS_TIMEOUT_MS = 3000;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  deliveryId: string;
}

export type SendEmailResult =
  | {
      status: "SENT";
      provider: typeof EMAIL_PROVIDER_NAME;
      providerMessageId: string;
    }
  | {
      status: "FAILED";
      provider: typeof EMAIL_PROVIDER_NAME;
      errorCode: string;
      errorMessage: string;
      isPermanentFailure: boolean;
    }
  | {
      status: "UNKNOWN";
      provider: typeof EMAIL_PROVIDER_NAME;
      errorCode: string;
      errorMessage: string;
    };

export function buildDeliveryIdempotencyKey(deliveryId: string): string {
  return `notification-delivery:${deliveryId}`;
}

export function extractDomainFromAddress(address: string): string {
  const match = /@([A-Za-z0-9.-]+)/.exec(address);
  return match?.[1]?.toLowerCase() || "akatsuki-yui.local";
}

export function buildDeterministicMessageId(deliveryId: string, fromAddress: string): string {
  const domain = extractDomainFromAddress(fromAddress);
  return `<notification-delivery-${deliveryId}@${domain}>`;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function sanitizeSmtpErrorMessage(raw: string): string {
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[REDACTED_URL]")
    .replace(/(password|pass|token|secret|authorization)=[^\s&;]+/gi, "$1=[REDACTED]")
    .slice(0, 500);
}

interface NodemailerLikeError {
  code?: unknown;
  command?: unknown;
  responseCode?: unknown;
  response?: unknown;
  message?: unknown;
}

export interface ClassifiedSmtpFailure {
  outcome: "FAILED" | "UNKNOWN";
  errorCode: string;
  errorMessage: string;
  isPermanentFailure: boolean;
}

/**
 * Classifies Nodemailer / SMTP errors into:
 * - UNKNOWN: ambiguous post-DATA outcomes (timeout / dropped socket during or after DATA) -> requires manual review
 * - FAILED (permanent): auth/config errors or 5xx recipient/envelope rejections
 * - FAILED (transient): pre-DATA network drops, DNS errors, 4xx throttling/temporary failures
 */
export function classifySmtpError(error: unknown): ClassifiedSmtpFailure {
  const errObj = (error && typeof error === "object" ? error : {}) as NodemailerLikeError;
  const rawCode = typeof errObj.code === "string" ? errObj.code.toUpperCase() : "";
  const command = typeof errObj.command === "string" ? errObj.command.toUpperCase() : "";
  const responseCode = typeof errObj.responseCode === "number" ? errObj.responseCode : null;
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof errObj.message === "string"
        ? errObj.message
        : String(error || "SMTP error");
  const lowerMessage = rawMessage.toLowerCase();
  const safeMessage = sanitizeSmtpErrorMessage(rawMessage);

  // 1. Ambiguous post-DATA outcome: mail MAY already have been accepted by remote MTA.
  const isDataPhase = command === "DATA";
  const isTimeout =
    rawCode === "ETIMEDOUT" ||
    rawCode === "ESOCKET" ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out");
  const isSocketDrop =
    rawCode === "ECONNRESET" ||
    rawCode === "EPIPE" ||
    lowerMessage.includes("unexpected end") ||
    lowerMessage.includes("connection closed") ||
    lowerMessage.includes("socket close");

  if (isDataPhase && (isTimeout || isSocketDrop)) {
    return {
      outcome: "UNKNOWN",
      errorCode: isTimeout ? "SMTP_DATA_TIMEOUT" : "SMTP_DATA_CONNECTION_LOST",
      errorMessage: `[REQUIRES_REVIEW] Kết nối SMTP bị gián đoạn ở pha DATA (${rawCode || "SOCKET"}). Không tự động gửi lại để tránh trùng email: ${safeMessage}`,
      isPermanentFailure: false,
    };
  }

  // Timeout without a clear pre-DATA phase when command is unknown or post-RCPT
  if (isTimeout && command !== "CONN" && command !== "EHLO" && command !== "HELO" && command !== "AUTH") {
    return {
      outcome: "UNKNOWN",
      errorCode: "SMTP_SEND_TIMEOUT",
      errorMessage: `[REQUIRES_REVIEW] Quá thời gian phản hồi SMTP sau khi truyền dữ liệu (${command || "SEND"}). Vui lòng kiểm tra trước khi gửi lại: ${safeMessage}`,
      isPermanentFailure: false,
    };
  }

  // 2. Permanent authentication / configuration errors (do not burn auto-retries)
  if (
    rawCode === "EAUTH" ||
    responseCode === 535 ||
    responseCode === 534 ||
    responseCode === 530 ||
    lowerMessage.includes("invalid login") ||
    lowerMessage.includes("oauth")
  ) {
    return {
      outcome: "FAILED",
      errorCode: responseCode ? `SMTP_AUTH_${responseCode}` : "SMTP_AUTH_FAILED",
      errorMessage: `Lỗi xác thực SMTP (kiểm tra SMTP_USER / SMTP_PASS hoặc OAuth2): ${safeMessage}`,
      isPermanentFailure: true,
    };
  }

  // 3. Permanent SMTP 5xx envelope / recipient rejections
  if (responseCode !== null && responseCode >= 500 && responseCode < 600) {
    return {
      outcome: "FAILED",
      errorCode: `SMTP_${responseCode}`,
      errorMessage: safeMessage,
      isPermanentFailure: true,
    };
  }

  // 4. Transient SMTP 4xx / pre-DATA network or DNS failures
  const resolvedCode = responseCode
    ? `SMTP_${responseCode}`
    : rawCode
      ? `SMTP_${rawCode}`
      : "SMTP_TRANSIENT_ERROR";

  return {
    outcome: "FAILED",
    errorCode: resolvedCode,
    errorMessage: safeMessage,
    isPermanentFailure: false,
  };
}

/**
 * Legacy helper alias retained cleanly for unit verification of permanent vs transient rules.
 */
export function classifyEmailProviderError(
  errorCode: string,
  httpStatus?: number
): boolean {
  const classified = classifySmtpError({
    code: errorCode,
    responseCode: httpStatus,
    message: errorCode,
  });
  return classified.outcome === "FAILED" && classified.isPermanentFailure;
}

export function createSmtpTransporter(config: SmtpRuntimeConfig): Transporter {
  const allowInsecureLoopbackStarttls =
    process.env.NODE_ENV !== "production" && config.host ? isLoopbackHost(config.host) : false;

  const authConfig =
    config.authMode === "oauth2"
      ? {
          type: "OAuth2" as const,
          user: config.user!,
          clientId: config.oauthClientId!,
          clientSecret: config.oauthClientSecret!,
          refreshToken: config.oauthRefreshToken!,
        }
      : {
          user: config.user!,
          pass: config.pass!,
        };

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure && !allowInsecureLoopbackStarttls,
    tls: {
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    dnsTimeout: SMTP_DNS_TIMEOUT_MS,
    auth: authConfig,
  });
}

function validateSingleRecipientAddress(rawTo: string): string | null {
  const trimmed = rawTo.trim();
  if (!trimmed || trimmed.includes(",") || trimmed.includes(";") || /[\r\n]/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export async function sendEmailViaSmtp(
  input: SendEmailInput,
  options?: { transporter?: Transporter; config?: SmtpRuntimeConfig }
): Promise<SendEmailResult> {
  const recipient = validateSingleRecipientAddress(input.to);
  if (!recipient) {
    return {
      status: "FAILED",
      provider: EMAIL_PROVIDER_NAME,
      errorCode: "INVALID_SINGLE_RECIPIENT",
      errorMessage: "Mỗi bản ghi gửi email chỉ được phép chứa đúng một địa chỉ người nhận hợp lệ.",
      isPermanentFailure: true,
    };
  }

  const config = options?.config ?? getSmtpConfigFromEnv();
  if (!config.configured) {
    return {
      status: "FAILED",
      provider: EMAIL_PROVIDER_NAME,
      errorCode: "SMTP_NOT_CONFIGURED",
      errorMessage: `Thiếu cấu hình SMTP (${config.missingFields.join(", ")}) nên không thể gửi email.`,
      isPermanentFailure: true,
    };
  }

  const messageId = buildDeterministicMessageId(input.deliveryId, config.from);
  const transporter = options?.transporter ?? createSmtpTransporter(config);

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: recipient,
      subject: input.subject,
      html: input.html,
      text: input.text,
      messageId,
      headers: {
        "X-Akatsuki-Delivery-Id": input.deliveryId,
      },
    });

    return {
      status: "SENT",
      provider: EMAIL_PROVIDER_NAME,
      providerMessageId: info.messageId || messageId,
    };
  } catch (error) {
    const classified = classifySmtpError(error);
    if (classified.outcome === "UNKNOWN") {
      return {
        status: "UNKNOWN",
        provider: EMAIL_PROVIDER_NAME,
        errorCode: classified.errorCode,
        errorMessage: classified.errorMessage,
      };
    }

    return {
      status: "FAILED",
      provider: EMAIL_PROVIDER_NAME,
      errorCode: classified.errorCode,
      errorMessage: classified.errorMessage,
      isPermanentFailure: classified.isPermanentFailure,
    };
  } finally {
    if (!options?.transporter && typeof transporter.close === "function") {
      transporter.close();
    }
  }
}
