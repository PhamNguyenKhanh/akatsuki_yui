# SPRINT 1 IMPLEMENTATION REPORT — AKATSUKI YUI

**Project:** Akatsuki Yui — Team & Project Management System  
**Sprint:** Sprint 1 — Foundation & Authentication  
**Overall Status:** COMPLETED  
**Architecture:** Modular Monolith (Next.js 16 App Router + TypeScript + PostgreSQL 18 + Prisma 6.19.3 + Auth.js v5 JWT + Tailwind CSS v4 + shadcn/ui + Zod + React Hook Form)  
**Baseline:** `markdown/DECISION-LOG.md` (`DEC-001` – `DEC-018`)

---

## 1. Sprint Overview

Sprint 1 triển khai hoàn chỉnh nền tảng hệ thống (**Project Foundation**), cơ sở dữ liệu (**PostgreSQL + Prisma Schema + Migration + Seed**), cơ chế xác thực (**Auth.js v5 + JWT + Credentials**), phân quyền phía Server (**9-step Server-Side Authorization + Last Admin Protection**), quản lý tài khoản & phê duyệt đăng ký (**Admin User Management**), hồ sơ cá nhân (**Profile & Change Password**), và contract nền tảng cho Email Notification (**Resend**).

---

## 2. Environment & Infrastructure Summary

| Component | Verified State |
| --- | --- |
| Node.js | `v24.22.1` |
| npm | `11.19.1` |
| Git | `2.51.1` (initialized in `d:\Akatsuki Yui\.git`) |
| Database Engine | PostgreSQL 18 (`akatsuki_yui` on `localhost:5432`, schema `public`) |
| ORM | `prisma` & `@prisma/client` `6.19.3` |
| Framework | `next@^16.4.6`, `react@^19.3.1`, `next-auth@5.0.0-beta.32` |
| Test Runner | `vitest@^5.1.0` |

> [!NOTE]
> Biến môi trường nhạy cảm (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `SEED_ADMIN_*`) được lưu trong `.env` (đã loại trừ trong `.gitignore` và xác minh không xuất hiện trong `git status --short`). Mẫu biến không chứa bí mật được lưu tại `.env.example`.

---

## 3. Database Schema, Migration & Seed

### Schema (`prisma/schema.prisma`)
- **Enum:** `UserStatus` (`PENDING`, `ACTIVE`, `REJECTED`, `SUSPENDED`)
- **Models:**
  - `User` (kèm self-relation `approvedBy`, `@unique` trên `email`, indexes trên `status`, `createdAt`)
  - `Role` (`@unique` trên `name`)
  - `Permission` (`@unique` trên `code`)
  - `UserRole` (`@@unique([userId, roleId])`)
  - `RolePermission` (`@@unique([roleId, permissionId])`)
  - `ActivityLog` (indexes trên `[entityType, entityId]`, `createdAt`)
  - `AuditLog` (indexes trên `[entityType, entityId]`, `createdAt`)

### Migration & Idempotent Seed
- Migration đã áp dụng thành công: `prisma/migrations/20261114181931_init_sprint1/migration.sql`
- `prisma/seed.ts` đã thực thi và kiểm chứng tính idempotent (chạy lặp lại không trùng dữ liệu):
  - **4 Roles:** `ADMIN`, `INSTRUCTOR`, `LEADER`, `MEMBER`
  - **25 Permissions:** đầy đủ mã quyền từ `account.read` đến `activity.read`
  - **RolePermission Matrix:** phân bổ đầy đủ theo `Authorization-Design.md` (Admin `25`, Instructor `8`, Leader `20`, Member `10`)
  - **Seed Active Admin:** `pnk1590@gmail.com` (`Akatsuki Yui`, trạng thái `ACTIVE`, Role `ADMIN`, mật khẩu đọc từ `.env`)

---

## 4. Architecture & Modular Monolith Deliverables

- **Core Libs:** `src/lib/{env,prisma,logger,errors,api-response,password,request,utils,auth,auth.config}.ts`, `src/lib/validations/common.ts`
- **Types:** `src/types/{api,auth,next-auth.d}.ts`
- **Edge Routing Middleware:** `src/middleware.ts`
- **Authorization Module:**
  - `src/modules/authorization/constants.ts`
  - `src/modules/authorization/policy.service.ts` (`loadTrustedAuthContext`, `hasPermission`, `hasAnyPermission`, `assertPermission`, `assertAnyPermission`)
  - `src/modules/authorization/require-auth.ts` (`requireActiveUser`, `requirePermission`, `requireAnyPermission`, `getOptionalAuthContext`, `requireActiveUserOrRedirect`, `requirePermissionOrRedirect`)
- **Auth Module:**
  - `src/modules/auth/auth.schema.ts` (`registerSchema`, `loginSchema`)
  - `src/modules/auth/auth.service.ts` (`registerAccount`, `authenticateCredentials`, `recordLogoutActivity`)
  - `src/modules/auth/sign-in-helper.ts` (`performCredentialsLogin`)
  - `src/modules/auth/auth.actions.ts` (`registerAction`, `loginAction`, `logoutAction`)
- **Users Module:**
  - `src/modules/users/user.schema.ts`
  - `src/modules/users/user.repository.ts`
  - `src/modules/users/user.service.ts`
  - `src/modules/users/user.actions.ts`
- **Integration Stub:** `src/server/integrations/resend.ts`

---

## 5. Authentication Features (`UC-001`, `UC-002`, `UC-003`)

- **Registration (`DEC-014` & `DEC-013`):**
  - Tạo tài khoản trực tiếp ở trạng thái `PENDING` kèm Role mặc định `MEMBER`, không yêu cầu xác thực email khi đăng ký.
  - Password Policy bắt buộc: tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt; hash bằng `bcryptjs`.
  - Ghi nhận `ActivityLog` (`USER_REGISTERED`).
- **Login & Status Guard (`DEC-012`):**
  - Xác thực `email` + `passwordHash` trước khi kiểm tra trạng thái để tránh lộ trạng thái tài khoản khi sai mật khẩu (`401 INVALID_CREDENTIALS`).
  - Khi mật khẩu đúng: chặn `PENDING` (`ACCOUNT_PENDING`), `REJECTED` (`ACCOUNT_REJECTED`), `SUSPENDED` (`ACCOUNT_SUSPENDED`); chỉ cho phép `ACTIVE` tạo JWT session và ghi `ActivityLog` (`USER_LOGIN`).
- **Logout:**
  - Kết thúc session cookie thông qua `signOut({ redirect: false })` và ghi `ActivityLog` (`USER_LOGOUT`).

---

## 6. Authorization & Server-Side Enforcement

- Mọi Server Component bảo vệ, Server Action và REST API đều gọi `requireActiveUser()` / `requirePermission()` -> `loadTrustedAuthContext(userId)` để:
  1. Kiểm tra lại trạng thái `ACTIVE` trong PostgreSQL (phiên của tài khoản vừa bị `SUSPEND` bị vô hiệu hóa ngay ở request kế tiếp: API trả `403 ACCOUNT_NOT_ACTIVE`, UI chuyển hướng `/access-denied?reason=inactive` tránh vòng lặp redirect).
  2. Nạp lại `roles` và `permissions` trực tiếp từ DB thay vì tin tưởng claim tĩnh từ client hoặc token cũ.
- **Last Admin Protection (`BR-AUTHZ-008`):** Chặn `SUSPEND` hoặc gỡ Role `ADMIN` khỏi Admin hoạt động cuối cùng với mã lỗi `409 LAST_ADMIN_PROTECTION`.

---

## 7. Account Management & Profile (`UC-004`, `UC-005`, `UC-033`)

- **Quản lý danh sách & chi tiết tài khoản:** Tìm kiếm (`search` theo `fullName` / `email`), lọc (`status`, `role`), phân trang, xem chi tiết + 10 `AuditLog` gần nhất.
- **Chuyển trạng thái tài khoản:** `APPROVE` (`PENDING -> ACTIVE`), `REJECT` (`PENDING -> REJECTED`), `SUSPEND` (`ACTIVE -> SUSPENDED`), `ACTIVATE` (`SUSPENDED -> ACTIVE`) kèm `approvedAt` / `approvedById` và ghi đồng thời `AuditLog` + `ActivityLog` trong Prisma transaction.
- **Gán vai trò cơ bản:** `PATCH /api/v1/users/:userId/role` (`role.manage`) kèm Last Admin Protection.
- **Profile cá nhân (`DEC-018`):** Xem thông tin tài khoản, chỉ cho phép sửa `fullName` (strict schema từ chối `email`/`role`/`status`), và đổi mật khẩu (kiểm tra `currentPassword`, áp dụng `DEC-013`, ghi `AuditLog` `PASSWORD_CHANGED`).

---

## 8. API Endpoints Implemented

| Method | Path | Protection | Purpose |
| --- | --- | --- | --- |
| `GET/POST` | `/api/auth/[...nextauth]` | Auth.js handler | Auth.js v5 endpoints |
| `POST` | `/api/v1/auth/register` | Public | Đăng ký tài khoản `PENDING` |
| `POST` | `/api/v1/auth/login` | Public | Đăng nhập Credentials + JWT cookie |
| `POST` | `/api/v1/auth/logout` | Optional session | Đăng xuất + `ActivityLog` |
| `GET` | `/api/v1/auth/session` | Active Session | Kiểm tra session & quyền DB hiện tại |
| `GET` | `/api/v1/users` | `account.read` | Danh sách phân trang, lọc, tìm kiếm |
| `GET` | `/api/v1/users/[userId]` | `account.read` hoặc Self | Chi tiết tài khoản (UUID validated) |
| `PATCH` | `/api/v1/users/[userId]/status` | `account.approve` / `account.manage` | Approve, Reject, Suspend, Activate |
| `PATCH` | `/api/v1/users/[userId]/role` | `role.manage` | Gán Role (`ADMIN`, `INSTRUCTOR`, `LEADER`, `MEMBER`) |
| `GET/PATCH` | `/api/v1/profile` | Active Session | Xem và sửa `fullName` cá nhân |
| `POST` | `/api/v1/profile/change-password` | Active Session | Đổi mật khẩu cá nhân |

---

## 9. UI Pages & Components Implemented

- **Public & Auth Routes:** `/`, `/login`, `/register`, `/pending-approval`, `/access-denied`
- **Authenticated App Shell Routes:**
  - `/dashboard`: Tổng quan phiên làm việc, danh sách Permission đang cấp, và thống kê số lượng tài khoản theo trạng thái cho tài khoản có `account.read`
  - `/admin/users`: Bảng quản lý tài khoản, tìm kiếm, lọc trạng thái/vai trò, phân trang, nút thao tác nhanh có `AlertDialog` xác nhận
  - `/admin/users/[userId]`: Chi tiết tài khoản, nút quản lý trạng thái, select gán Role và bảng lịch sử `AuditLog`
  - `/profile`: Form chỉnh sửa họ tên và form đổi mật khẩu
- **UI Components:** `src/components/ui/{button,input,label,card,badge,alert,table,select,alert-dialog}.tsx`, `src/components/layout/app-shell.tsx`, `src/components/shared/status-badge.tsx`, `src/components/auth/{login-form,register-form}.tsx`, `src/components/users/{account-status-actions,users-table,user-detail-actions,profile-forms}.tsx`

---

## 10. Email / Notification Foundation

- Khai báo `RESEND_API_KEY` và `EMAIL_FROM` trong `src/lib/env.ts`, `.env.example`, `.env`.
- Cung cấp module contract `src/server/integrations/resend.ts` (`MAX_EMAIL_RETRIES = 3`, `isEmailProviderConfigured()`, `dispatchEmailWithResend()`) ở trạng thái standby cho Sprint 5 (không gửi email thật trong Sprint 1).

---

## 11. Verification & Test Results

Tất cả các kiểm tra dưới đây được chạy sau lần chỉnh sửa code cuối cùng và đều đạt kết quả PASS (`exit code 0`):

| Check | Command | Observed Result |
| --- | --- | --- |
| Code Formatting | `npm run format:check` | Passed (`All matched files use Prettier code style!`) |
| Prisma Schema Validation | `npx prisma validate` | Passed (`The schema at prisma\schema.prisma is valid`) |
| TypeScript Check | `npm run typecheck` (`tsc --noEmit`) | Passed (0 errors) |
| ESLint Check | `npm run lint` (`eslint .`) | Passed (0 errors, 0 warnings) |
| Automated Test Suite | `npm run test` (`vitest run`) | **Passed: 7/7 test files, 30/30 tests passed, 0 failed, 0 skipped** (`4.83s`) |
| Production Build | `npm run build` (`next build`) | **Passed:** Turbopack compiled cleanly, TS finished, 20 app/API routes built (`13/13` static worker passes) |
| Seed Idempotency | `npx prisma db seed` | Passed (re-ran cleanly on populated DB without duplicate errors) |

### Test Coverage Breakdown (`tests/`)
- `tests/unit/auth-validation.test.ts` (`8` tests): `DEC-013` password rules, `registerSchema`, `loginSchema`, `DEC-018` strict profile update, `changePasswordSchema`, `userListQuerySchema`.
- `tests/unit/password.test.ts` (`1` test): `bcryptjs` salting & password verification.
- `tests/unit/authorization-policy.test.ts` (`4` tests): 4 Roles & 25 Permissions catalog, permission assertions, DB-backed `loadTrustedAuthContext`, blocking missing/`PENDING`/`REJECTED`/`SUSPENDED` contexts.
- `tests/unit/user-service.test.ts` (`6` tests): Registration (`PENDING`/`MEMBER`), duplicate email `409`, password-before-status login guard, unauthorized approval `403`, Last Admin Protection (`409 LAST_ADMIN_PROTECTION`), change-password mismatch `400`.
- `tests/unit/api-routes.test.ts` (`6` tests): `/api/v1/auth/register` (`201` & malformed JSON `400`), `/api/v1/auth/session` (`401 AUTH_REQUIRED`), `/api/v1/users` pagination/filter envelope, `/api/v1/users/[userId]`, `/api/v1/profile` strict field rejection (`400`).
- `tests/unit/button-slot.test.ts` (`2` tests): SSR `renderToStaticMarkup` regression test cho `<Button asChild>` với `@radix-ui/react-slot` và `<Button isLoading>`.
- `tests/integration/sprint1-db.test.ts` (`3` tests against PostgreSQL `akatsuki_yui`): verifies seeded Roles/Permissions/Admin, full end-to-end DB lifecycle (`Register -> PENDING block -> Approve -> Active Login -> Profile Update -> Password Change -> Suspend immediate revocation -> Activate -> Role reassignment`), and `LAST_ADMIN_PROTECTION` + `REJECT` transaction/AuditLog persistence (auto-cleans test records in `afterAll`).

---

## 12. Documentation Updates

- `SPRINT-1-IMPLEMENTATION-PLAN.md`: Lập kế hoạch triển khai Sprint 1 trong repository và đồng bộ tên file `vitest.config.mts`.
- `markdown/05-Quality-and-Delivery/Testing-Strategy.md`: Bổ sung các test case chi tiết Sprint 1 (`TC-AUTH-014`..`TC-AUTH-016`, `TC-USER-009`) mà không xóa hay làm sai lệch các TC hiện có.
- `SPRINT-1-IMPLEMENTATION-REPORT.md`: Tài liệu báo cáo tổng kết triển khai Sprint 1.

---

## 13. Scope Compliance & Deferred Backlog

- Giữ đúng ranh giới Sprint 1: chưa triển khai UI Permission Matrix Grant/Revoke (`UC-006`, Sprint 2), Project/Member Management (Sprint 2), Task/Kanban/Sprint (Sprint 3–4), Document/Notification Center/Live Resend Dispatch (Sprint 5), hay Report Charts (Sprint 6).
- Không có mục giả lập hay menu chết trên giao diện.

---

## 14. Known Warnings & Operational Notes

1. **Next.js 16 Middleware Convention Warning:** `next build` hiển thị cảnh báo deprecation cho quy ước tên file `src/middleware.ts` (`Please use "proxy" instead`). Hiện vẫn hoạt động bình thường trên Next.js `16.4.6` (`ƒ Proxy (Middleware)`) và phù hợp tài liệu kiến trúc hiện tại; có thể cân nhắc chuyển sang `src/proxy.ts` ở Sprint 2 nếu muốn loại bỏ cảnh báo build.
2. **Prisma `package.json#prisma` Notice:** Prisma 6.19.3 thông báo cấu hình seed trong `package.json#prisma` sẽ bỏ từ Prisma 7 (`prisma.config.ts`). Không ảnh hưởng đến Prisma 6.19.3 hiện tại.
3. **Resend Live Delivery:** `RESEND_API_KEY` trong `.env` đang để trống theo thiết kế Sprint 1; tính năng gửi email thật sẽ kích hoạt ở Sprint 5.

---

## 15. Next Steps

1. Khởi chạy ứng dụng cục bộ bằng `npm run dev` (hoặc `npm run start` sau `npm run build`) tại `http://localhost:3000`.
2. Đăng nhập kiểm thử giao diện với tài khoản Seed Admin đã cấu hình trong `.env` (`pnk1590@gmail.com`).
3. Sẵn sàng bắt đầu **Sprint 2**: `UC-006` Permission Matrix UI và phân hệ `Project` / `ProjectTemplate` / `ProjectMember`.
