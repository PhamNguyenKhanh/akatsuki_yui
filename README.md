# Akatsuki Yui

Hệ thống quản lý nhóm và dự án nội bộ (**Internal Team & Project Management System**) dành cho nhóm sinh viên thực hiện đồ án môn học và đồ án tốt nghiệp.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript (Strict)
- **Architecture:** Modular Monolith (`src/modules/*`, `src/app/api/v1/*`, `src/app/(dashboard)/*`)
- **Database & ORM:** PostgreSQL 18 + Prisma ORM `6.19.3`
- **Authentication & Authorization:** Auth.js v5 (JWT session) + DB-backed RBAC Policy (`loadTrustedAuthContext`)
- **UI & Styling:** Tailwind CSS v4 + shadcn/ui (Radix Primitives) + Lucide Icons + Pure React Accessible SVG Charts (`DEC-056`) + Sonner
- **Validation & Forms:** Zod 4 + React Hook Form
- **Email & Scheduling:** Nodemailer SMTP (`DEC-070`, `password` / `oauth2`) + Daily Vercel Cron (`0 1 * * *`, `CRON_SECRET`)
- **Testing & Quality:** Vitest (`test:unit` / `test:integration`) + Playwright (`test:e2e`) + ESLint + Prettier

---

## Tiến độ triển khai theo Sprint

### Sprint 1 — Foundation & Authentication (Đã hoàn tất)

- Khởi tạo dự án Next.js 16 + Prisma + PostgreSQL, thiết kế 4 Roles (`ADMIN`, `LEADER`, `INSTRUCTOR`, `MEMBER`) và Permission Catalog (được mở rộng đến 28 Permissions ở Sprint 7).
- Đăng ký tài khoản (`PENDING`), đăng nhập (`ACTIVE` only), đăng xuất, kiểm soát phiên server-side.
- Quản lý tài khoản (`/admin/users`, `/admin/users/[userId]`): phê duyệt (`APPROVE`), từ chối (`REJECT`), tạm khóa (`SUSPEND`), kích hoạt lại (`ACTIVATE`), gán Role kèm **Last Admin Protection** (`BR-AUTHZ-008`).
- Hồ sơ cá nhân (`/profile`): cập nhật họ tên, đổi mật khẩu theo chính sách mật khẩu mạnh (`DEC-013`).

### Sprint 2 — Authorization & Project Management (Đã hoàn tất)

- **Role & Permission Matrix (`/admin/roles`):** Xem ma trận Role × Permission, cấp/thu hồi quyền theo thời gian thực (đọc trực tiếp PostgreSQL trên mỗi request), bảo vệ các quyền quản trị cốt lõi của `ADMIN` (`CORE_ADMIN_PERMISSION_LOCKED`), lưu `AuditLog` + `ActivityLog`.
- **Project Templates (`/admin/templates`):** Quản lý mẫu Project dùng chung toàn Workspace (`configuration Json?`, bật/tắt `isActive`, chặn xóa cứng khi đang được Project sử dụng `TEMPLATE_IN_USE`).
- **Project Management (`/projects`, `/projects/new`, `/projects/[projectId]`, `/projects/[projectId]/edit`):**
  - Tạo/Xem/Cập nhật Project với `templateId` và `instructorId` tùy chọn (`DEC-001`, `DEC-002`).
  - Tự động gán người tạo có role `LEADER` làm Project Leader (`BR-PROJ-003`).
  - Thực thi ràng buộc **tối đa 01 Project `ACTIVE` toàn Workspace** (`BR-PROJ-004`) ở cả tầng Service và PostgreSQL Partial Unique Index (`Project_single_active_idx`).
  - Vòng đời `CREATED -> ACTIVE -> ARCHIVED`; chặn chỉnh sửa Project `ARCHIVED` (`BR-PROJ-008`); khôi phục (`Restore`) chỉ dành cho `ADMIN` (`DEC-008`).
- **Project Member Management:** Thêm tài khoản `ACTIVE`, đổi Project Leader đồng bộ `Project.leaderId`, gỡ thành viên bằng soft-leave (`leftAt`) để bảo toàn lịch sử (`BR-MEM-003`) kèm guard hook (`taskAssignmentGuard`).

### Sprint 3 — Task Management & DAG Dependencies (Đã hoàn tất)

- Quản lý Task (`/projects/[projectId]/tasks`), Multi-Assignee (`TaskAssignee`), DAG Dependencies chống chu trình, Workflow `TODO -> IN_PROGRESS -> REVIEW -> DONE` kèm Review Approval/Rejection có lý do bắt buộc, `TaskHistory` lưu diff thay đổi và quyền `MEMBER` theo `DEC-015`.

### Sprint 4 — Sprint Management, Product Backlog & Kanban Board (Đã hoàn tất)

- Vòng đời Sprint (`PLANNED -> ACTIVE -> COMPLETED / CANCELLED`), cho phép nhiều Sprint `ACTIVE` trong một Project (`DEC-006`), Product Backlog, Kanban Board, Complete Sprint rollover/backlog disposition không mất dữ liệu, và Sprint Burndown Chart.

### Sprint 5 — Document Library & Notifications (Đã hoàn tất)

- **Document Library (`/documents`, `/projects/[projectId]/documents`):** Quản lý liên kết Google Drive / Google Docs kèm Soft Delete (`deletedAt`) và trigger `trg_document_sprint_same_project`.
- **Notifications & Email (`/notifications`, `/admin/notifications/deliveries`):** In-app Notification Center (zero client polling), Nodemailer SMTP dispatch + retry (`DEC-070`), trạng thái `UNKNOWN` yêu cầu review thủ công, và nhắc hạn deadline tự động (`/api/internal/notifications/process` bảo vệ bằng `CRON_SECRET`).

### Sprint 6 — Dashboard, Member Contribution Report, Advanced Analytics & Unified Activity History (Đã hoàn tất)

- **Operational Dashboard (`/dashboard`):** Active-first Project Switcher, widget phân quyền động không cần `dashboard.read` (`DEC-051`), tách biệt **Task Work Progress (`DONE / Total`)** và **Project Timeline Progress (`startDate -> endDate`)**, chế độ Read-only khi kiểm tra Project `ARCHIVED` (`DEC-053`).
- **Reports & Advanced Analytics (`/reports`, `/projects/[projectId]/reports`):**
  - 6 nhóm phân tích bằng Pure React + Accessible SVG + Tailwind (`DEC-056`), cửa sổ thời gian preset/custom tối đa 365 ngày và tự động gộp tuần ISO khi > 90 ngày theo `Asia/Ho_Chi_Minh` (`DEC-057`), không xuất CSV/PDF/Excel (`DEC-054`).
  - **Member Contribution Report:** Phi cộng dồn (`DEC-047`), tách Sole vs Co-assigned + đối chiếu Project Totals, tách Current vs Historical distinct (`DEC-049`, `P0-02`, `P1-03`), bao gồm cựu thành viên (`DEC-050`), Planned Estimate Hours (`DEC-048`), và giới hạn `SELF_ONLY` cho `MEMBER` (`DEC-052`).
  - **Sprint Analytics & `P0-01` Burndown Fix:** Báo cáo 6 chỉ số Sprint Commitment/Rollover không dùng snapshot table (`DEC-058`) kèm tái dựng `estimateHours` lịch sử miễn nhiễm với sửa đổi sau khi đóng Sprint (`P0-01`).
- **Unified Activity History (`/activity`):** Hợp nhất `ActivityLog` (`WORKSPACE`) và `TaskHistory` (`TASK`) với Keyset Cursor (`createdAt DESC, source DESC, id DESC`) (`DEC-055`, `P1-01`) và cô lập dữ liệu nghiêm ngặt cho `MEMBER` (`DEC-052`).

### Sprint 7 — Finalization, Security Hardening, SMTP Migration & Deployment Readiness (Đã hoàn tất code & kiểm thử tự động offline; chờ deploy live)

- **Session Revocation (`User.tokenVersion`, `DEC-063`):** Thu hồi JWT ngay lập tức khi đổi mật khẩu, `SUSPEND` hoặc đổi Role.
- **RBAC `project.template.manage` (`DEC-064`):** Quyền độc lập cho `/admin/templates` (Permission #28, chỉ `ADMIN` mặc định).
- **PostgreSQL Sliding-Window Rate Limiting (`RateLimitEvent`, `DEC-065`):** Bảo vệ login, register, password change, admin retry và mutation API, fail-closed `503` trên auth nhạy cảm.
- **HTTP Security Headers & Body Guard:** CSP chặt chẽ (không `unsafe-eval` ở production), `X-Frame-Options: DENY`, `nosniff`, giới hạn JSON body 64 KB (`413`), open-redirect hardening (`callbackUrl`).
- **SMTP Migration & Free-Tier Zero-Polling (`DEC-070`):** Chuyển hoàn toàn từ Resend sang **Nodemailer SMTP** (TLS strict, awaited bounded post-commit dispatch tối đa 5/request & 10/Cron, rolling-24h atomic DB quota `SmtpQuotaAttempt`, loại bỏ hoàn toàn client polling ở `NotificationBell`).
- **Healthchecks & Safe Seed (`DEC-067`):** `/api/health` + `/api/v1/health` (`SELECT 1`, `Cache-Control: no-store`), runtime env validation, `prisma/seed.ts` an toàn không ghi đè quyền/trạng thái Admin.
- **Playwright E2E & Integration Isolation (`DEC-066`):** Tách `test:unit`, `test:integration` (`TEST_DATABASE_URL` bắt buộc), và 4 bộ Playwright E2E kèm Offline Mock SMTP server.

---

## Cài đặt & Chạy Local Development

### 1. Yêu cầu môi trường

- Node.js 20+ & npm
- PostgreSQL 18 (local hoặc Docker/Neon)

### 2. Cấu hình biến môi trường

Sao chép file mẫu `.env.example` thành `.env` và điền thông tin kết nối PostgreSQL, Auth secret, SMTP và thông tin tài khoản Admin seed ban đầu (không dùng `DIRECT_URL` hay `SEED_ADMIN_*` trên Vercel Runtime):

```bash
cp .env.example .env
```

Các nhóm biến chính trong `.env.example`:

- `DATABASE_URL` (pooled `-pooler`), `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`: Biến runtime ứng dụng & Cron (`0 1 * * *`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_AUTH_MODE`, `SMTP_USER`, `SMTP_PASS` (hoặc `SMTP_OAUTH_*`), `SMTP_FROM`, `SMTP_DAILY_SEND_LIMIT`, `SMTP_PER_MINUTE_LIMIT`: Cấu hình gửi email qua Nodemailer SMTP (`DEC-070`)
- `DIRECT_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`: Biến dành riêng cho Operator/Migration & one-time seed (`DEC-067`)
- `TEST_DATABASE_URL`: Database PostgreSQL riêng biệt cho integration/E2E tests (bắt buộc tách khỏi `DATABASE_URL`, `DEC-066`)

### 3. Cài dependencies, migrate DB & seed dữ liệu

```bash
npm install
npx prisma migrate dev
npx prisma generate
npm run prisma:seed
```

### 4. Chạy ứng dụng

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

---

## Kiểm tra chất lượng & Testing

```bash
npm run format:check     # Kiểm tra Prettier (file mới/Sprint 7)
npm run typecheck        # Kiểm tra TypeScript (tsc --noEmit)
npm run lint             # Kiểm tra ESLint
npm run test:unit        # Chạy toàn bộ Unit & API Route Contract Tests (không cần DB)
npm run test:integration # Chạy PostgreSQL Integration Tests (yêu cầu TEST_DATABASE_URL riêng)
npm run test:e2e         # Chạy Playwright E2E + Mock SMTP Offline (yêu cầu TEST_DATABASE_URL + đã build)
npm run build            # Build production (next build)
npm run prisma:validate  # Kiểm tra schema Prisma
```

---

## Quy ước Git Branching

- `feat/*`: Nhánh phát triển cho từng tính năng / sprint (tách từ `dev`).
- `dev`: Nhánh tích hợp chính trong quá trình phát triển các Sprint.
- `main`: Chỉ merge từ `dev` vào ở giai đoạn phát hành cuối cùng khi toàn bộ dự án hoàn thành.
- Thư mục tài liệu nội bộ (`docs/`, `markdown/`, `report/`) được cấu hình bỏ qua trong `.gitignore` và chỉ lưu cục bộ trên máy phát triển.
