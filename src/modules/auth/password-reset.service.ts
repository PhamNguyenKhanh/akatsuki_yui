import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { badRequestError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { RATE_LIMIT_SCOPES, consumeRateLimit, getRequestClientIp } from "@/lib/rate-limit";
import { sendEmailViaSmtp } from "@/server/integrations/email";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ.").toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(10, "Liên kết đặt lại mật khẩu không hợp lệ."),
    newPassword: z
      .string()
      .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự.")
      .max(128, "Mật khẩu mới không được vượt quá 128 ký tự."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu xác nhận không khớp.",
  });

interface ResetTokenPayload {
  uid: string;
  tv: number;
  exp: number;
}

function signPayload(encodedPayload: string): string {
  const { AUTH_SECRET } = getServerEnv();
  return createHmac("sha256", AUTH_SECRET).update(encodedPayload).digest("base64url");
}

export function createPasswordResetToken(userId: string, tokenVersion: number): string {
  const payload: ResetTokenPayload = {
    uid: userId,
    tv: tokenVersion,
    exp: Date.now() + RESET_TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyPasswordResetToken(token: string): ResetTokenPayload {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw badRequestError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã bị hỏng.");
  }

  const [encodedPayload, providedSig] = parts;
  const expectedSig = signPayload(encodedPayload);

  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    throw badRequestError("Liên kết đặt lại mật khẩu không hợp lệ.");
  }

  let payload: ResetTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as ResetTokenPayload;
  } catch {
    throw badRequestError("Liên kết đặt lại mật khẩu không hợp lệ.");
  }

  if (
    !payload ||
    typeof payload.uid !== "string" ||
    typeof payload.tv !== "number" ||
    typeof payload.exp !== "number"
  ) {
    throw badRequestError("Liên kết đặt lại mật khẩu không hợp lệ.");
  }

  if (Date.now() > payload.exp) {
    throw badRequestError("Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu lại.");
  }

  return payload;
}

export async function requestPasswordResetService(rawEmail: string): Promise<{ sent: boolean }> {
  const parsed = forgotPasswordSchema.safeParse({ email: rawEmail });
  if (!parsed.success) {
    throw badRequestError(parsed.error.issues[0]?.message ?? "Email không hợp lệ.");
  }

  const email = parsed.data.email;
  const ip = await getRequestClientIp();
  await consumeRateLimit({ scope: RATE_LIMIT_SCOPES.AUTH_PASSWORD_RESET_IP, identifier: ip });
  await consumeRateLimit({ scope: RATE_LIMIT_SCOPES.AUTH_PASSWORD_RESET_EMAIL, identifier: email });

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
      tokenVersion: true,
    },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    return { sent: true };
  }

  const token = createPasswordResetToken(user.id, user.tokenVersion);
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const sendResult = await sendEmailViaSmtp({
    deliveryId: randomUUID(),
    to: user.email,
    subject: "[Akatsuki Yui] Đặt lại mật khẩu tài khoản",
    text: [
      `Xin chào ${user.fullName},`,
      "",
      "Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản Akatsuki Yui.",
      `Vui lòng truy cập liên kết sau (có hiệu lực trong 30 phút): ${resetUrl}`,
      "",
      "Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.",
    ].join("\n"),
    html: `<div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
      <h2 style="margin-top: 0;">Đặt lại mật khẩu Akatsuki Yui</h2>
      <p>Xin chào <strong>${user.fullName}</strong>,</p>
      <p>Bạn vừa yêu cầu đặt lại mật khẩu. Liên kết bên dưới có hiệu lực trong <strong>30 phút</strong> và chỉ sử dụng được một lần:</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background-color: #0f172a; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Đặt lại mật khẩu
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
    </div>`,
  });

  if (sendResult.status !== "SENT") {
    logger.warn("auth.password_reset.smtp_failed", {
      userId: user.id,
      errorCode: sendResult.errorCode,
      errorMessage: sendResult.errorMessage,
    });
  }

  return { sent: true };
}

export async function resetPasswordWithTokenService(input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    throw badRequestError(parsed.error.issues[0]?.message ?? "Dữ liệu đặt lại mật khẩu không hợp lệ.");
  }

  const payload = verifyPasswordResetToken(parsed.data.token);

  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: {
      id: true,
      status: true,
      tokenVersion: true,
    },
  });

  if (!user || user.status !== UserStatus.ACTIVE || user.tokenVersion !== payload.tv) {
    throw badRequestError("Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng.");
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      tokenVersion: { increment: 1 },
    },
  });
}
