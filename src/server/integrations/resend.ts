import "server-only";

export {
  MAX_EMAIL_RETRIES,
  buildDeliveryIdempotencyKey,
  classifyEmailProviderError,
  isResendConfigured as isEmailProviderConfigured,
  sendEmailViaResend as dispatchEmailWithResend,
  type EmailDeliveryStatus,
  type EmailDispatchResult,
  type EmailProvider,
  type EmailSendPayload,
} from "@/server/integrations/email";
