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
- **Email & Scheduling:** Resend SDK (`DEC-045`) + Cron endpoint (`CRON_SECRET`)
- **Testing & Quality:** Vitest + ESLint + Prettier

---

## Tiến độ triển khai theo Sprint

### Sprint 1 — Foundation & Authentication (Đã hoàn tất)

- Khởi tạo dự án Next.js 16 + Prisma + PostgreSQL, thiết kế 4 Roles (`ADMIN`, `LEADER`, `INSTRUCTOR`, `MEMBER`) và Permission Catalog (được mở rộng đến 29 Permissions ở Sprint 6).
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
- **Notifications & Email (`/notifications`, `/admin/notifications/deliveries`):** In-app Notification Center, Resend email dispatch + retry (`DEC-045`), và nhắc hạn deadline tự động (`/api/internal/notifications/process` bảo vệ bằng `CRON_SECRET`).

### Sprint 6 — Dashboard, Member Contribution Report, Advanced Analytics & Unified Activity History (Đã hoàn tất)

- **Operational Dashboard (`/dashboard`):** Active-first Project Switcher, widget phân quyền động không cần `dashboard.read` (`DEC-051`), tách biệt **Task Work Progress (`DONE / Total`)** và **Project Timeline Progress (`startDate -> endDate`)**, chế độ Read-only khi kiểm tra Project `ARCHIVED` (`DEC-053`).
- **Reports & Advanced Analytics (`/reports`, `/projects/[projectId]/reports`):**
  - 6 nhóm phân tích bằng Pure React + Accessible SVG + Tailwind (`DEC-056`), cửa sổ thời gian preset/custom tối đa 365 ngày và tự động gộp tuần ISO khi > 90 ngày theo `Asia/Ho_Chi_Minh` (`DEC-057`), không xuất CSV/PDF/Excel (`DEC-054`).
  - **Member Contribution Report:** Phi cộng dồn (`DEC-047`), tách Sole vs Co-assigned + đối chiếu Project Totals, tách Current vs Historical distinct (`DEC-049`, `P0-02`, `P1-03`), bao gồm cựu thành viên (`DEC-050`), Planned Estimate Hours (`DEC-048`), và giới hạn `SELF_ONLY` cho `MEMBER` (`DEC-052`).
  - **Sprint Analytics & `P0-01` Burndown Fix:** Báo cáo 6 chỉ số Sprint Commitment/Rollover không dùng snapshot table (`DEC-058`) kèm tái dựng `estimateHours` lịch sử miễn nhiễm với sửa đổi sau khi đóng Sprint (`P0-01`).
- **Unified Activity History (`/activity`):** Hợp nhất `ActivityLog` (`WORKSPACE`) và `TaskHistory` (`TASK`) với Keyset Cursor (`createdAt DESC, source DESC, id DESC`) (`DEC-055`, `P1-01`) và cô lập dữ liệu nghiêm ngặt cho `MEMBER` (`DEC-052`).

---

## Cài đặt & Chạy Local Development

### 1. Yêu cầu môi trường

- Node.js 20+ & npm
- PostgreSQL 18 (local hoặc Docker/cloud)

### 2. Cấu hình biến môi trường

Sao chép file mẫu `.env.example` thành `.env` và điền thông tin kết nối PostgreSQL, Auth secret và thông tin tài khoản Admin seed ban đầu:

```bash
cp .env.example .env
```

Các biến chính trong `.env.example`:

- `DATABASE_URL`, `DIRECT_URL`: Chuỗi kết nối PostgreSQL
- `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`: Cấu hình Auth.js v5
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`: Tài khoản Admin khởi tạo khi seed
- `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`: Cấu hình gửi email qua Resend (`DEC-045`) và bảo mật cron endpoint nhắc hạn deadline

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
npm run format:check   # Kiểm tra Prettier
npm run typecheck      # Kiểm tra TypeScript (tsc --noEmit)
npm run lint           # Kiểm tra ESLint
npm run test           # Chạy toàn bộ Unit, API Contract & PostgreSQL Integration Tests
npm run build          # Build production (next build)
npm run prisma:validate
```

---

## Quy ước Git Branching

- `feat/*`: Nhánh phát triển cho từng tính năng / sprint (tách từ `dev`).
- `dev`: Nhánh tích hợp chính trong quá trình phát triển các Sprint.
- `main`: Chỉ merge từ `dev` vào ở giai đoạn phát hành cuối cùng khi toàn bộ dự án hoàn thành.
- Thư mục tài liệu nội bộ (`docs/`, `markdown/`, `report/`) được cấu hình bỏ qua trong `.gitignore` và chỉ lưu cục bộ trên máy phát triển.
