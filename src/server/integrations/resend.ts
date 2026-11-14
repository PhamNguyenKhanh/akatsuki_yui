import "server-only";

/**
 * Sprint 1 Email Integration Foundation (DEC-016: Resend, max 3 retries).
 * Actual Email Notification dispatch belongs to Sprint 5 (Notification & Email).
 * This module defines configuration readiness and contracts without faking email delivery.
 */

export const MAX_EMAIL_RETRIES = 3 as const;

export type EmailDeliveryStatus = "PENDING" | "SENT" | "FAILED";

export interface EmailSendPayload {
  to: string;
  subject: string;
  html: string;
}

export interface EmailDispatchResult {
  status: EmailDeliveryStatus;
  provider: "resend";
  externalId?: string;
  errorMessage?: string;
}

export function isEmailProviderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
}

export async function dispatchEmailWithResend(
  _payload: EmailSendPayload
): Promise<EmailDispatchResult> {
  return {
    status: "FAILED",
    provider: "resend",
    errorMessage:
      "Email notification dispatch is scheduled for Sprint 5 and is intentionally not active in Sprint 1.",
  };
}
