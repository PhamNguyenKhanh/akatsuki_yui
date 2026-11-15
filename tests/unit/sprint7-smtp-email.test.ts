import { describe, expect, it, vi } from "vitest";
import type { Transporter } from "nodemailer";

vi.mock("server-only", () => ({}));

import { getSmtpConfigFromEnv } from "@/lib/env";
import {
  SMTP_CONNECTION_TIMEOUT_MS,
  SMTP_SOCKET_TIMEOUT_MS,
  buildDeterministicMessageId,
  classifySmtpError,
  sendEmailViaSmtp,
} from "@/server/integrations/email";
import { runWithBoundedConcurrency } from "@/modules/notifications/notification-delivery.service";

describe("Sprint 7 SMTP Migration — Nodemailer Transport, Classification & Concurrency", () => {
  it("parses password and oauth2 SMTP configs cleanly without crashing when unconfigured", () => {
    const empty = getSmtpConfigFromEnv({});
    expect(empty.configured).toBe(false);
    expect(empty.dailySendLimit).toBe(50);
    expect(empty.missingFields).toEqual(expect.arrayContaining(["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]));

    const passwordCfg = getSmtpConfigFromEnv({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "465",
      SMTP_AUTH_MODE: "password",
      SMTP_USER: "bot@akatsuki.local",
      SMTP_PASS: "app-password-secret",
      SMTP_FROM: "Akatsuki Yui <bot@akatsuki.local>",
      SMTP_DAILY_SEND_LIMIT: "40",
    });
    expect(passwordCfg.configured).toBe(true);
    expect(passwordCfg.secure).toBe(true);
    expect(passwordCfg.dailySendLimit).toBe(40);

    const oauthCfg = getSmtpConfigFromEnv({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_AUTH_MODE: "oauth2",
      SMTP_USER: "bot@akatsuki.local",
      SMTP_OAUTH_CLIENT_ID: "cid",
      SMTP_OAUTH_CLIENT_SECRET: "csec",
      SMTP_OAUTH_REFRESH_TOKEN: "rtok",
      SMTP_FROM: "Akatsuki Yui <bot@akatsuki.local>",
    });
    expect(oauthCfg.configured).toBe(true);
    expect(oauthCfg.secure).toBe(false);
    expect(oauthCfg.authMode).toBe("oauth2");
  });

  it("uses deterministic Message-ID, strict single recipient, and bounded timeouts", async () => {
    expect(SMTP_CONNECTION_TIMEOUT_MS).toBeLessThanOrEqual(5000);
    expect(SMTP_SOCKET_TIMEOUT_MS).toBeLessThanOrEqual(10000);
    expect(
      buildDeterministicMessageId("deliv-123", "Akatsuki Yui <noreply@akatsuki.local>")
    ).toBe("<notification-delivery-deliv-123@akatsuki.local>");

    const sendMail = vi.fn().mockResolvedValue({
      messageId: "<notification-delivery-deliv-123@akatsuki.local>",
    });
    const fakeTransporter = { sendMail } as unknown as Transporter;

    const multiRecipientRes = await sendEmailViaSmtp(
      {
        to: "a@example.com, b@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
        deliveryId: "deliv-123",
      },
      { transporter: fakeTransporter, config: getSmtpConfigFromEnv({
        SMTP_HOST: "smtp.example.com",
        SMTP_USER: "u@example.com",
        SMTP_PASS: "p",
        SMTP_FROM: "Akatsuki Yui <noreply@akatsuki.local>",
      }) }
    );
    expect(multiRecipientRes).toMatchObject({
      status: "FAILED",
      errorCode: "INVALID_SINGLE_RECIPIENT",
      isPermanentFailure: true,
    });
    expect(sendMail).not.toHaveBeenCalled();

    const singleRes = await sendEmailViaSmtp(
      {
        to: "member@akatsuki.local",
        subject: "Task assigned",
        html: "<p>Task</p>",
        text: "Task",
        deliveryId: "deliv-123",
      },
      {
        transporter: fakeTransporter,
        config: getSmtpConfigFromEnv({
          SMTP_HOST: "smtp.example.com",
          SMTP_USER: "u@example.com",
          SMTP_PASS: "p",
          SMTP_FROM: "Akatsuki Yui <noreply@akatsuki.local>",
        }),
      }
    );

    expect(singleRes).toEqual({
      status: "SENT",
      provider: "SMTP",
      providerMessageId: "<notification-delivery-deliv-123@akatsuki.local>",
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "member@akatsuki.local",
        messageId: "<notification-delivery-deliv-123@akatsuki.local>",
      })
    );
  });

  it("separates ambiguous DATA timeouts (UNKNOWN) from permanent auth/5xx and transient 4xx/network failures", () => {
    const dataTimeout = classifySmtpError({
      code: "ETIMEDOUT",
      command: "DATA",
      message: "Socket timed out waiting for server confirmation after DATA",
    });
    expect(dataTimeout.outcome).toBe("UNKNOWN");
    expect(dataTimeout.errorCode).toBe("SMTP_DATA_TIMEOUT");
    expect(dataTimeout.errorMessage).toContain("[REQUIRES_REVIEW]");

    const authFail = classifySmtpError({
      code: "EAUTH",
      responseCode: 535,
      command: "AUTH",
      message: "535-5.7.8 Username and Password not accepted",
    });
    expect(authFail).toMatchObject({
      outcome: "FAILED",
      isPermanentFailure: true,
      errorCode: "SMTP_AUTH_535",
    });

    const recipientRejected = classifySmtpError({
      responseCode: 550,
      command: "RCPT TO",
      message: "550 5.1.1 The email account does not exist",
    });
    expect(recipientRejected).toMatchObject({
      outcome: "FAILED",
      isPermanentFailure: true,
      errorCode: "SMTP_550",
    });

    const preDataConnRefused = classifySmtpError({
      code: "ECONNREFUSED",
      command: "CONN",
      message: "connect ECONNREFUSED 127.0.0.1:587",
    });
    expect(preDataConnRefused).toMatchObject({
      outcome: "FAILED",
      isPermanentFailure: false,
      errorCode: "SMTP_ECONNREFUSED",
    });
  });

  it("enforces bounded SMTP concurrency <= 2 across workers", async () => {
    let active = 0;
    let peak = 0;
    const results = await runWithBoundedConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return n * 10;
    });

    expect(peak).toBeLessThanOrEqual(2);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });
});
