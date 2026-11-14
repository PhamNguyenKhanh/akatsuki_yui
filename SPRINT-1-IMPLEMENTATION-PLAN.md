# SPRINT 1 IMPLEMENTATION PLAN — AKATSUKI YUI

**Sprint:** Sprint 1 — Foundation & Authentication  
**Architecture:** Modular Monolith (Next.js App Router + TypeScript + PostgreSQL + Prisma + Auth.js v5 JWT + Tailwind CSS + shadcn/ui + Zod + React Hook Form)  
**Baseline:** `markdown/DECISION-LOG.md` (`DEC-001` – `DEC-018`)

---

## 1. Phase 0 — Repository Inspection

- **Trạng thái Repository ban đầu:** Greenfield (`d:/Akatsuki Yui/` mới chỉ chứa `docs/`, `markdown/`, `scripts/`). Chưa có `package.json`, `src/`, `prisma/`, `.git`, `.env`.
- **Môi trường hệ thống:** Node.js `v24.22.1`, npm `11.19.1`, Git `2.51.1`, PostgreSQL Server 18 (`postgresql-x64-18`) đang chạy trên `localhost:5432`.

---

## 2. Scope

### In Scope (Sprint 1)
1. **Project Foundation:** Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui, ESLint, Prettier, Environment Validation (`Zod`), Error Handling & Redacted Logging, Shared Types/Validations, Modular Monolith structure, Git init.
2. **Database Foundation:** Prisma ORM + PostgreSQL (`akatsuki_yui`), Schema Sprint 1 (`User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `ActivityLog`, `AuditLog`), Migration, Idempotent Seed (4 Roles, 25 Permissions, RolePermission Matrix, Admin Dev Seed đọc từ `.env`).
3. **Authentication (`Auth.js v5 + JWT`):**
   - `UC-001` Register Account (`PENDING`, không yêu cầu Email Verification `DEC-014`, Password Policy `DEC-013`, Hash `bcryptjs`).
   - `UC-002` Login (kiểm tra Status `ACTIVE`; từ chối `PENDING`, `REJECTED`, `SUSPENDED`).
   - `UC-003` Logout.
   - JWT Session re-validation phía Server để vô hiệu hóa tức thì nếu User bị Suspend hoặc đổi Role.
4. **Account Management & Authorization Foundation:**
   - `UC-004` Manage User Accounts (List, Search, Filter, Detail, Suspend `ACTIVE -> SUSPENDED`, Activate `SUSPENDED -> ACTIVE`).
   - `UC-005` Approve/Reject Pending Account (`PENDING -> ACTIVE`, `PENDING -> REJECTED`, ghi `approvedAt`/`approvedById`, `AuditLog`, `ActivityLog`).
   - Basic Role Assignment (`PATCH /api/v1/users/:userId/role`) kèm Last Admin Protection (`BR-AUTHZ-008`).
   - 9-step Server-Side Authorization Policy (`Authorization-Design.md` §8).
5. **User Profile (`UC-033`, `DEC-018`):** Xem Profile, cập nhật `fullName`, đổi Password (xác thực `currentPassword` + áp dụng `DEC-013`).
6. **Email / Notification Foundation (Phase 6):** Khai báo `RESEND_API_KEY`, `EMAIL_FROM` và interface wrapper (`MAX_EMAIL_RETRIES = 3`, chưa gửi email thật trong Sprint 1).

### Out of Scope (Deferred to Sprint 2–6)
- `UC-006` Permission Matrix Grant/Revoke UI (Sprint 2).
- Project, Template, ProjectMember Management (Sprint 2).
- Task, Dependency, Review, Sprint, Kanban (Sprint 3–4).
- Document Library, Notification Center & Resend live dispatch (Sprint 5).
- Full Dashboard Metrics, Burndown Chart & Reports (Sprint 6).

---

## 3. Tasks & Dependencies

1. **Task 1 (Foundation):** Khởi tạo `package.json`, `tsconfig.json`, `next.config.ts`, `eslint`, `prettier`, `vitest`, `.gitignore`, `.env.example`, `.env`, `git init`, `src/lib/*`, `src/types/*`. *(Không phụ thuộc)*
2. **Task 2 (Database):** Khởi tạo DB `akatsuki_yui`, viết `prisma/schema.prisma`, chạy `prisma migrate dev`, viết & chạy `prisma/seed.ts`. *(Phụ thuộc Task 1)*
3. **Task 3 (Authorization & Auth Core):** Triển khai `src/modules/authorization/*`, `src/lib/auth.ts`, `src/lib/auth.config.ts`, `src/middleware.ts`, `src/modules/auth/*`, `/api/auth/[...nextauth]`, `/api/v1/auth/*`. *(Phụ thuộc Task 2)*
4. **Task 4 (Users & Profile Backend):** Triển khai `src/modules/users/*` (repository, schema, service, actions) và `/api/v1/users/*`, `/api/v1/profile/*`. *(Phụ thuộc Task 3)*
5. **Task 5 (Email Foundation):** Cấu hình `src/server/integrations/resend.ts` và biến môi trường Resend. *(Phụ thuộc Task 1)*
6. **Task 6 (UI/UX):** Cài đặt shadcn/ui components, AppShell layout (`Sidebar`, `Header`), các trang `(auth)` (`/login`, `/register`, `/pending-approval`, `/access-denied`) và `(dashboard)` (`/dashboard`, `/admin/users`, `/admin/users/[userId]`, `/profile`). *(Phụ thuộc Task 3 & Task 4)*
7. **Task 7 (Testing & Verification):** Viết và chạy Unit/Integration tests (Vitest), TypeScript check, ESLint, Prisma validate, Production build (`npm run build`), cập nhật `Testing-Strategy.md` nếu cần và xuất `SPRINT-1-IMPLEMENTATION-REPORT.md`. *(Phụ thuộc Task 2–6)*

---

## 4. Files Expected to Create / Change

- Root config: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.prettierrc`, `vitest.config.mts`, `components.json`, `.gitignore`, `.env.example`, `.env` (gitignored), `SPRINT-1-IMPLEMENTATION-PLAN.md`, `SPRINT-1-IMPLEMENTATION-REPORT.md`
- Database: `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.ts`
- Core Libs & Types: `src/lib/{env,prisma,logger,errors,api-response,password,auth,auth.config,utils}.ts`, `src/lib/validations/common.ts`, `src/types/{api,auth}.ts`, `src/middleware.ts`
- Modules: `src/modules/authorization/{constants,policy.service}.ts`, `src/modules/auth/{auth.schema,auth.service,auth.actions}.ts`, `src/modules/users/{user.schema,user.repository,user.service,user.actions}.ts`, `src/server/integrations/resend.ts`
- API Routes: `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/v1/auth/{register,login,logout,session}/route.ts`, `src/app/api/v1/users/route.ts`, `src/app/api/v1/users/[userId]/{route.ts,status/route.ts,role/route.ts}`, `src/app/api/v1/profile/{route.ts,change-password/route.ts}`
- UI Components & Pages: `src/app/{layout.tsx,globals.css,page.tsx,access-denied/page.tsx}`, `src/app/(auth)/{layout.tsx,login/page.tsx,register/page.tsx,pending-approval/page.tsx}`, `src/app/(dashboard)/{layout.tsx,dashboard/page.tsx,admin/users/page.tsx,admin/users/[userId]/page.tsx,profile/page.tsx}`, `src/components/ui/*`, `src/components/layout/*`, `src/components/auth/*`, `src/components/users/*`
- Tests: `tests/unit/{auth-validation,password,authorization-policy,user-service}.test.ts`, `tests/integration/sprint1-db.test.ts`

---

## 5. Database Changes

- Enum `UserStatus` (`PENDING`, `ACTIVE`, `REJECTED`, `SUSPENDED`).
- Models: `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `ActivityLog`, `AuditLog`.
- Ràng buộc: Unique `User.email`, `Role.name`, `Permission.code`, `UserRole(userId, roleId)`, `RolePermission(roleId, permissionId)`; Indexes trên `User.email`, `User.status`, `User.createdAt`, `ActivityLog(entityType, entityId)`, `ActivityLog.createdAt`, `AuditLog(entityType, entityId)`, `AuditLog.createdAt`.

---

## 6. API Changes

- Auth.js: `GET/POST /api/auth/[...nextauth]`
- REST `/api/v1`:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/session`
  - `GET /api/v1/users` (`account.read`)
  - `GET /api/v1/users/:userId` (`account.read` hoặc self)
  - `PATCH /api/v1/users/:userId/status` (`account.approve` cho Approve/Reject; `account.manage` cho Suspend/Activate)
  - `PATCH /api/v1/users/:userId/role` (`role.manage`)
  - `GET /api/v1/profile`, `PATCH /api/v1/profile`, `POST /api/v1/profile/change-password`

---

## 7. UI Changes

- Public Auth Pages: `/login`, `/register`, `/pending-approval`, `/access-denied`.
- Protected App Shell: Sidebar phân quyền, Header (User Menu, Profile link, Logout), `/dashboard` (Sprint 1 Workspace Status), `/admin/users` (List, Filter, Search, Approve/Reject/Suspend/Activate với `AlertDialog` xác nhận, liên kết Detail), `/admin/users/[userId]` (Chi tiết + gán Role + Last Admin feedback), `/profile` (xem thông tin + Form cập nhật `fullName` + Form Change Password).

---

## 8. Test Plan

- Unit tests cho Zod schemas (Password Policy `DEC-013`, strict Profile schema `DEC-018`), Password hashing (`bcryptjs`), Auth/Registration rules (`DEC-014`), Account State Transitions (`PENDING -> ACTIVE/REJECTED`, `ACTIVE <-> SUSPENDED`), Last Admin Protection (`BR-AUTHZ-008`), và 9-step Server-side Authorization.
- Integration tests kiểm chứng kết nối PostgreSQL thực tế, Prisma schema constraints (`@unique`, FK), Seed idempotency, và không lộ `passwordHash`.

---

## 9. Acceptance Criteria

Tuân thủ đầy đủ 24 tiêu chí trong Section 11 của yêu cầu Sprint 1 (Dev server, PostgreSQL, Prisma validate/migrate/seed, Registration + DEC-013/DEC-014, Login/Logout/JWT, Admin Account Management + Role Assignment + Last Admin Protection, Profile + Change Password, Server-side Authorization, UI states, Tests run, `tsc`, `eslint`, `next build` pass).
