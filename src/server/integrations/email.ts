import "server-only";

/**
 * Sprint 1 Email Integration Foundation (SMTP primary, max 3 retries).
 * Actual Email Notification dispatch belongs to Sprint 5 (Notification & Email).
 * This module defines configuration readiness and contracts without faking email delivery.
 */

export const MAX_EMAIL_RETRIES = 3 as const;

export type EmailDeliveryStatus = "PENDING" | "SENT" | "FAILED";
export type EmailProvider = "smtp" | "resend";

export interface EmailSendPayload {
  to: string;
  subject: string;
  html: string;
}

export interface EmailDispatchResult {
  status: EmailDeliveryStatus;
  provider: EmailProvider;
  externalId?: string;
  errorMessage?: string;
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_PORT?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim() &&
    process.env.SMTP_FROM?.trim()
  );
}

export async function dispatchEmail(_payload: EmailSendPayload): Promise<EmailDispatchResult> {
  return {
    status: "FAILED",
    provider: "smtp",
    errorMessage:
      "Email notification dispatch is scheduled for Sprint 5 and is intentionally not active in Sprint 1.",
  };
}
