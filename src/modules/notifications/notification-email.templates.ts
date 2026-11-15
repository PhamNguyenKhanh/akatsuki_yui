import "server-only";
import { NotificationType } from "@prisma/client";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TYPE_BADGE_LABELS: Record<NotificationType, string> = {
  ACCOUNT_REGISTERED: "Đăng ký Tài khoản mới",
  ACCOUNT_APPROVED: "Tài khoản đã được phê duyệt",
  ACCOUNT_REJECTED: "Thông báo trạng thái tài khoản",
  PROJECT_MEMBER_ADDED: "Tham gia Project",
  PROJECT_MEMBER_REMOVED: "Cập nhật thành viên Project",
  PROJECT_LEADER_CHANGED: "Thay đổi Leader Project",
  TASK_ASSIGNED: "Phân công Task mới",
  TASK_SUBMITTED_FOR_REVIEW: "Task chờ phê duyệt (Review)",
  TASK_REVIEW_APPROVED: "Task đã được phê duyệt",
  TASK_REVIEW_REJECTED: "Task cần chỉnh sửa lại",
  TASK_DEADLINE_REMINDER: "Nhắc hạn Deadline Task",
  SYSTEM: "Thông báo Hệ thống",
};

export interface BuildNotificationEmailInput {
  type: NotificationType;
  recipientName: string;
  title: string;
  message: string;
  targetUrl?: string | null;
}

export interface RenderedNotificationEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildNotificationEmailContent(
  input: BuildNotificationEmailInput
): RenderedNotificationEmail {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");

  const fullActionUrl =
    input.targetUrl && input.targetUrl.trim().length > 0
      ? input.targetUrl.startsWith("http")
        ? input.targetUrl
        : `${baseUrl}${input.targetUrl.startsWith("/") ? "" : "/"}${input.targetUrl}`
      : null;

  const badgeLabel = TYPE_BADGE_LABELS[input.type] ?? "Thông báo";
  const subject = `[Akatsuki Yui] ${input.title}`;

  const safeRecipient = escapeHtml(input.recipientName || "Thành viên");
  const safeBadge = escapeHtml(badgeLabel);
  const safeTitle = escapeHtml(input.title);
  const safeMessage = escapeHtml(input.message);

  const actionButtonHtml = fullActionUrl
    ? `<div style="margin-top: 24px;">
        <a href="${escapeHtml(fullActionUrl)}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-size: 14px; font-weight: 600;">
          Xem chi tiết trên Akatsuki Yui
        </a>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 28px;">
      <div style="font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">
        Akatsuki Yui · ${safeBadge}
      </div>
      <h1 style="margin: 12px 0 16px; font-size: 18px; line-height: 1.4; color: #0f172a;">
        ${safeTitle}
      </h1>
      <p style="margin: 0 0 12px; font-size: 14px; color: #334155;">
        Xin chào <strong>${safeRecipient}</strong>,
      </p>
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-line;">
        ${safeMessage}
      </p>
      ${actionButtonHtml}
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0 16px;" />
      <p style="margin: 0; font-size: 12px; color: #64748b;">
        Email này được gửi tự động từ hệ thống quản lý dự án nội bộ Akatsuki Yui.
      </p>
    </div>
  </body>
</html>`;

  const textLines = [
    `[Akatsuki Yui - ${badgeLabel}]`,
    input.title,
    "",
    `Xin chào ${input.recipientName || "Thành viên"},`,
    input.message,
  ];
  if (fullActionUrl) {
    textLines.push("", `Xem chi tiết: ${fullActionUrl}`);
  }

  return {
    subject,
    html,
    text: textLines.join("\n"),
  };
}
