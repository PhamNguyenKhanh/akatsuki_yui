<div align="center">

# AKATSUKI YUI

**Internal Team & Project Management System**  
*Hệ thống Quản lý Nhóm và Dự án Nội bộ*

A centralized Modular Monolith workspace built with Next.js 16, React 19, TypeScript, PostgreSQL, and Prisma ORM to help a student project team organize projects, sprints, tasks, schedules, meetings, documents, notifications, and progress analytics.

*Nền tảng quản lý nhóm và dự án nội bộ theo kiến trúc Modular Monolith, được xây dựng trên Next.js 16, React 19, TypeScript, PostgreSQL và Prisma ORM giúp nhóm sinh viên tổ chức dự án, sprint, công việc, lịch biểu, cuộc họp, tài liệu, thông báo và báo cáo tiến độ tập trung.*

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19.3-2d3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?logo=postgresql)](https://www.postgresql.org/)
[![Auth.js](https://img.shields.io/badge/Auth.js-v5-purple)](https://authjs.dev/)

**Status / Trạng thái:** Active Development — Core Modules (Sprints 1–9 & v1.1) Implemented Locally | Pending Live Deployment Verification  
**Repository:** [https://github.com/PhamNguyenKhanh/akatsuki_yui.git](https://github.com/PhamNguyenKhanh/akatsuki_yui.git)

</div>

---

## Table of Contents / Mục lục

- [AKATSUKI YUI](#akatsuki-yui)
  - [Table of Contents / Mục lục](#table-of-contents--mục-lục)
  - [1. Project Overview / Tổng quan dự án](#1-project-overview--tổng-quan-dự-án)
    - [English](#english)
    - [Tiếng Việt](#tiếng-việt)
  - [2. Key Features / Tính năng chính](#2-key-features--tính-năng-chính)
  - [3. Screenshots / Hình ảnh ứng dụng](#3-screenshots--hình-ảnh-ứng-dụng)
  - [4. Technology Stack / Công nghệ sử dụng](#4-technology-stack--công-nghệ-sử-dụng)
  - [5. System Architecture / Kiến trúc hệ thống](#5-system-architecture--kiến-trúc-hệ-thống)
    - [English](#english-1)
    - [Tiếng Việt](#tiếng-việt-1)
  - [6. Project Structure / Cấu trúc thư mục](#6-project-structure--cấu-trúc-thư-mục)
  - [7. Prerequisites / Yêu cầu môi trường](#7-prerequisites--yêu-cầu-môi-trường)
    - [English](#english-2)
    - [Tiếng Việt](#tiếng-việt-2)
  - [8. Installation \& Local Development / Cài đặt và chạy cục bộ](#8-installation--local-development--cài-đặt-và-chạy-cục-bộ)
    - [English](#english-3)
    - [Tiếng Việt](#tiếng-việt-3)
  - [9. Environment Variables / Biến môi trường](#9-environment-variables--biến-môi-trường)
    - [Example `.env.example`](#example-envexample)
  - [10. Database Setup / Thiết lập cơ sở dữ liệu](#10-database-setup--thiết-lập-cơ-sở-dữ-liệu)
    - [English](#english-4)
    - [Tiếng Việt](#tiếng-việt-4)
  - [11. Authentication \& Authorization / Xác thực và phân quyền](#11-authentication--authorization--xác-thực-và-phân-quyền)
    - [English](#english-5)
    - [Tiếng Việt](#tiếng-việt-5)
  - [12. API \& Application Workflows / API và luồng nghiệp vụ](#12-api--application-workflows--api-và-luồng-nghiệp-vụ)
    - [English](#english-6)
    - [Tiếng Việt](#tiếng-việt-6)
  - [13. Testing \& Quality Assurance / Kiểm thử và đảm bảo chất lượng](#13-testing--quality-assurance--kiểm-thử-và-đảm-bảo-chất-lượng)
    - [English](#english-7)
    - [Tiếng Việt](#tiếng-việt-7)
  - [14. Production Build \& Deployment / Build production và triển khai](#14-production-build--deployment--build-production-và-triển-khai)
    - [English](#english-8)
    - [Tiếng Việt](#tiếng-việt-8)
  - [15. Security Considerations / Lưu ý bảo mật](#15-security-considerations--lưu-ý-bảo-mật)
    - [English](#english-9)
    - [Tiếng Việt](#tiếng-việt-9)
  - [16. Troubleshooting / Xử lý sự cố thường gặp](#16-troubleshooting--xử-lý-sự-cố-thường-gặp)
  - [17. Development Guidelines / Quy chuẩn phát triển](#17-development-guidelines--quy-chuẩn-phát-triển)
    - [English](#english-10)
    - [Tiếng Việt](#tiếng-việt-10)
  - [18. Contributors / Thành viên đóng góp](#18-contributors--thành-viên-đóng-góp)
  - [19. Acknowledgments / Lời cảm ơn](#19-acknowledgments--lời-cảm-ơn)
    - [English](#english-11)
    - [Tiếng Việt](#tiếng-việt-11)

---

## 1. Project Overview / Tổng quan dự án

### English

**Akatsuki Yui** is an internal Team & Project Management System built specifically for a single student project team (for coursework and capstone projects), rather than a public multi-tenant SaaS platform.

**Why it was developed & Problems solved:**
- Student teams often scatter tasks, deadlines, meeting links, busy schedules, and Google Drive documents across chat apps and spreadsheets, making progress hard to track.
- Akatsuki Yui centralizes project planning, sprint execution, task dependencies, peer/leader reviews, team availability, meeting coordination, and progress analytics in one authenticated workspace.

**Intended Users:**
- **Admin:** Manages account approvals, role/permission matrix, project templates, notification delivery retries, and archived project recovery.
- **Leader:** Creates and manages projects, project members, sprints, tasks, reviews, schedules, meetings, and documents.
- **Instructor:** Monitors assigned projects, tasks, sprints, documents, schedules, meetings, and analytical reports in a read-only capacity.
- **Member:** Works on assigned tasks, updates progress, manages subtasks, participates in task discussions, submits work for review, and maintains personal busy schedules.

### Tiếng Việt

**Akatsuki Yui** là hệ thống Quản lý Nhóm và Dự án Nội bộ được xây dựng dành riêng cho một nhóm sinh viên thực hiện đồ án môn học và đồ án tốt nghiệp, không phải nền tảng SaaS đa khách hàng công khai.

**Lý do phát triển & Vấn đề giải quyết:**
- Các nhóm sinh viên thường phân tán công việc, hạn chót, link họp, lịch bận cá nhân và tài liệu Google Drive trên nhiều ứng dụng chat và bảng tính rời rạc, gây khó khăn khi theo dõi tiến độ.
- Akatsuki Yui tập trung hóa việc lập kế hoạch dự án, vận hành Sprint, quản lý phụ thuộc công việc (DAG), quy trình duyệt bài (Review), lịch rảnh/bận của nhóm, điều phối cuộc họp và phân tích tiến độ trong một không gian làm việc thống nhất.

**Đối tượng sử dụng:**
- **Admin:** Quản trị tài khoản (phê duyệt/tạm khóa), ma trận Role × Permission, Project Template, theo dõi/gửi lại email thông báo lỗi và khôi phục dự án đã lưu trữ.
- **Leader:** Khởi tạo và điều phối dự án, quản lý thành viên, Sprint, Task, duyệt Review, lịch họp và tài liệu dự án.
- **Instructor (Giảng viên hướng dẫn):** Theo dõi tiến độ dự án, Task, Sprint, tài liệu, lịch họp và các báo cáo phân tích theo chế độ chỉ đọc.
- **Member (Thành viên):** Thực hiện Task được giao, cập nhật tiến độ, quản lý subtask, thảo luận trên Task, gửi Review và khai báo lịch bận cá nhân.

---

## 2. Key Features / Tính năng chính

| Module / Phân hệ | English Summary | Tóm tắt Tiếng Việt | Status / Trạng thái |
|---|---|---|---|
| **Authentication & Account Lifecycle** | Credentials login (`ACTIVE` only), registration (`PENDING`), forgot/reset password via HMAC-SHA256 signed email link, immediate JWT revocation via `tokenVersion`, and profile/password management. | Đăng nhập bằng email/mật khẩu (chỉ tài khoản `ACTIVE`), đăng ký chờ duyệt (`PENDING`), quên/đặt lại mật khẩu qua link ký HMAC-SHA256 gửi email, thu hồi phiên tức thì qua `tokenVersion` và quản lý hồ sơ cá nhân. | `Implemented` |
| **Dynamic RBAC & Admin Management** | 4 roles (`ADMIN`, `LEADER`, `INSTRUCTOR`, `MEMBER`) and 32 granular permissions stored in PostgreSQL, real-time Role × Permission matrix (`/admin/roles`), user approval/suspension (`/admin/users`), Last Admin Protection, and `AuditLog`. | 4 vai trò (`ADMIN`, `LEADER`, `INSTRUCTOR`, `MEMBER`) và 32 quyền lưu trên PostgreSQL, ma trận phân quyền thời gian thực (`/admin/roles`), phê duyệt/tạm khóa tài khoản (`/admin/users`), bảo vệ Admin cuối cùng và ghi `AuditLog`. | `Implemented` |
| **Project, Template & Member Management** | Workspace-wide Project Templates (`/admin/templates`), project lifecycle (`CREATED -> ACTIVE -> ARCHIVED`), single `ACTIVE` project enforcement via DB partial unique index, soft-leave member history (`leftAt`), and leader handoff. | Quản lý Project Template (`/admin/templates`), vòng đời dự án (`CREATED -> ACTIVE -> ARCHIVED`), giới hạn tối đa 01 dự án `ACTIVE` toàn workspace bằng Partial Unique Index, lịch sử thành viên (`leftAt`) và chuyển giao Leader. | `Implemented` |
| **Task Management & DAG Dependencies** | Multi-assignee tasks (`TaskAssignee`), non-cyclic DAG task dependencies (`TaskDependency`) with blocker badges, subtasks (`TaskSubtask`), `TODO -> IN_PROGRESS -> REVIEW -> DONE` workflow with mandatory review reasons (`TaskReview`), and `TaskHistory` diffs. | Quản lý Task nhiều người phụ trách (`TaskAssignee`), phụ thuộc DAG chống chu trình kèm huy hiệu chặn, subtasks (`TaskSubtask`), luồng `TODO -> IN_PROGRESS -> REVIEW -> DONE` kèm lý do duyệt/từ chối bắt buộc và lịch sử `TaskHistory`. | `Implemented` |
| **Realtime Task Comments** | Threaded comments on tasks (`TaskComment`) with `@mention` support and instant delivery over Pusher private channels (`private-task-<taskId>`). | Bình luận trên Task (`TaskComment`) hỗ trợ `@mention` và cập nhật thời gian thực qua kênh riêng tư của Pusher (`private-task-<taskId>`). | `Implemented` |
| **Sprint, Backlog & Kanban Board** | Multi-active sprint support (`PLANNED -> ACTIVE -> COMPLETED / CANCELLED`), Product Backlog, Kanban board with "My Tasks" filter & quick actions, safe sprint completion rollover, and Sprint Burndown chart. | Hỗ trợ nhiều Sprint `ACTIVE` cùng lúc, Product Backlog, bảng Kanban với bộ lọc "Task của tôi" & thao tác nhanh, kết thúc Sprint chuyển tiếp Task an toàn và biểu đồ Sprint Burndown. | `Implemented` |
| **Project Schedule (Availability Calendar)** | Weekly busy-time calendar per project (`ProjectScheduleEntry`) with recurring entries and per-date cancellation/override exceptions (`ProjectScheduleException`). | Lịch bận theo tuần trong dự án (`ProjectScheduleEntry`), hỗ trợ lặp lại hàng tuần và ngoại lệ hủy/ghi đè theo ngày (`ProjectScheduleException`). | `Implemented` |
| **Project Meetings & Google Meet Links** | Reusable Google Meet link directory (`ProjectMeetLink`), meeting scheduling (`ProjectMeeting`) with participant tracking, conflict/availability awareness, and Meeting-to-Task conversion. | Quản lý danh bạ link Google Meet (`ProjectMeetLink`), lên lịch họp (`ProjectMeeting`) kèm danh sách tham gia, đối chiếu lịch bận và chuyển đổi nội dung họp thành Task. | `Implemented` |
| **Document Library** | Curated external document links (e.g., Google Drive/Docs) categorized by `SPECIFICATION`, `DESIGN`, `REPORT`, `OTHER` with soft delete (`deletedAt`) and project/sprint integrity checks. | Thư viện liên kết tài liệu ngoài (Google Drive/Docs) phân loại theo `SPECIFICATION`, `DESIGN`, `REPORT`, `OTHER` hỗ trợ xóa mềm (`deletedAt`) và kiểm tra tính toàn vẹn Project/Sprint. | `Implemented` |
| **Notifications & Email Delivery** | In-app Notification Center (`/notifications`), realtime badge updates via Pusher (`private-user-<userId>`), Nodemailer SMTP dispatch with rolling-24h DB quota (`SmtpQuotaAttempt`), admin delivery monitor/retry (`/admin/notifications/deliveries`), and daily Vercel Cron deadline reminders. | Trung tâm thông báo (`/notifications`), cập nhật realtime qua Pusher (`private-user-<userId>`), gửi email qua Nodemailer SMTP có hạn mức 24h (`SmtpQuotaAttempt`), màn hình theo dõi/gửi lại email lỗi và Cron nhắc hạn hàng ngày. | `Implemented` |
| **Dashboard, Reports & Activity History** | Operational Dashboard (`/dashboard`), 6 Pure React SVG analytics chart groups (`/reports`), non-additive Member Contribution & Sprint Analytics reports, and unified Keyset-paginated Activity History (`/activity`). | Dashboard vận hành (`/dashboard`), 6 nhóm biểu đồ SVG thuần React (`/reports`), báo cáo đóng góp thành viên & phân tích Sprint, và lịch sử hoạt động hợp nhất phân trang Keyset (`/activity`). | `Implemented` |
| **Productivity & UX Utilities** | `Ctrl+K` Global Command Palette (`/api/v1/search`), one-click Zalo summary copy buttons (for tasks, meetings, sprints, dashboard), and Light/Dark/System theme switcher. | Bảng lệnh tìm kiếm nhanh `Ctrl+K` (`/api/v1/search`), nút sao chép tóm tắt định dạng Zalo (cho Task, Cuộc họp, Sprint, Dashboard) và chuyển đổi giao diện Sáng/Tối/Hệ thống. | `Implemented` |

> **Scope Note / Lưu ý phạm vi:** Based on repository inspection, Google OAuth login, AI Concierge/LLM integrations, and direct binary file upload/object storage are **not** implemented in this codebase (authentication uses Credentials; documents store external URLs).  
> *Theo kiểm tra mã nguồn thực tế, đăng nhập Google OAuth, tích hợp AI và tải lên/lưu trữ tệp nhị phân trực tiếp **chưa** được triển khai trong dự án này (xác thực dùng Credentials; tài liệu lưu liên kết URL ngoài).*

---

## 3. Screenshots / Hình ảnh ứng dụng

<div align="center">

![Akatsuki Yui Landing Page](./public/screenshots/landing_page.png)
Landing Page
![Akatsuki Yui Landing Page](./public/screenshots/dashboard.png)
Dashboard

</div>

---

## 4. Technology Stack / Công nghệ sử dụng

| Category / Nhóm | Technology / Công nghệ | Verified Version / Phiên bản | Purpose / Vai trò |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `^16.4.6` | Full-stack React framework, SSR, Server Actions, Route Handlers, Middleware |
| **UI Library** | React & React DOM | `^19.3.1` | Server & Client Components |
| **Language** | TypeScript (`strict: true`) | `^5.9.0` | End-to-end static type safety |
| **Styling & UI** | Tailwind CSS v4, Radix UI Primitives, Lucide Icons, Sonner | `^4.3.5` / `^1.73.0` / `^2.0.8` | Responsive UI, accessible primitives (shadcn/ui pattern), toast notifications, Pure React SVG charts |
| **Database** | PostgreSQL | `18` | Primary relational database |
| **ORM** | Prisma (`prisma`, `@prisma/client`) | `6.19.3` | Schema management, migrations, type-safe queries |
| **Authentication** | Auth.js v5 (`next-auth`) + `bcryptjs` | `5.0.0-beta.32` / `^3.0.3` | Credentials auth, JWT sessions (7-day maxAge), password hashing |
| **Validation & Forms** | Zod, React Hook Form, `@hookform/resolvers` | `^4.6.7` / `^7.92.0` / `^7.0.6` | Client & server schema validation |
| **Realtime** | Pusher (`pusher`, `pusher-js`) | `^5.3.4` / `^8.6.0` | Private channels for live task comments and user notifications (optional graceful fallback) |
| **Email Service** | Nodemailer (SMTP `password` / `oauth2`) | `^10.6.0` | Transactional notifications, deadline reminders, password reset emails |
| **Testing** | Vitest, Playwright (`@playwright/test`) | `^5.1.0` / `^1.65.1` | Unit tests, PostgreSQL integration tests, E2E browser tests with offline mock SMTP |
| **Code Quality** | ESLint (`eslint-config-next`), Prettier | `^9.39.0` / `^3.8.0` | Linting and code formatting |
| **Hosting & Cron** | Vercel + Vercel Cron | `vercel.json` (`sin1`) | Production hosting and daily scheduled notification job (`0 1 * * *`) |

---

## 5. System Architecture / Kiến trúc hệ thống

### English

Akatsuki Yui follows a **Modular Monolith** architecture inside a single Next.js 16 App Router application:

- **Presentation Layer (`src/app/**`, `src/components/**`):** Server Components load initial data directly through server-side service functions (avoiding self-HTTP calls). Client Components handle interactive workflows (Kanban board, calendars, forms, command palette, Pusher subscriptions).
- **Transport / Boundary Layer (`src/app/api/v1/**`, `src/modules/*/*.actions.ts`):** Route Handlers expose RESTful JSON endpoints; Server Actions handle form mutations. Both enforce authentication, RBAC permissions, and Zod input validation.
- **Business Logic Layer (`src/modules/*/*.service.ts`, `*.access.ts`):** Encapsulates all domain rules (project single-active invariant, DAG cycle detection, task review transitions, sprint completion rollover, non-additive reporting calculations, schedule/meeting conflict checks).
- **Data Access Layer (`src/modules/*/*.repository.ts`, `src/lib/prisma.ts`):** Isolates Prisma queries and transactions (with PostgreSQL advisory/row locks in `src/lib/db-locks.ts` where concurrency safety is required).
- **Cross-Cutting & Integration Layer (`src/lib/**`, `src/server/integrations/email.ts`):** Handles Auth.js configuration, DB-backed RBAC (`loadTrustedAuthContext`), PostgreSQL sliding-window rate limiting (`RateLimitEvent`), security headers & CSP nonces, Pusher server triggers, and Nodemailer SMTP transport.

### Tiếng Việt

Akatsuki Yui áp dụng kiến trúc **Modular Monolith** trong một ứng dụng Next.js 16 App Router duy nhất:

- **Tầng Giao diện (`src/app/**`, `src/components/**`):** Server Components gọi trực tiếp các hàm service phía server để tải dữ liệu ban đầu (không gọi HTTP vòng lại chính mình). Client Components đảm nhiệm tương tác (bảng Kanban, lịch biểu, biểu mẫu, bảng lệnh `Ctrl+K`, kết nối Pusher).
- **Tầng Tiếp nhận (`src/app/api/v1/**`, `src/modules/*/*.actions.ts`):** Route Handlers cung cấp REST API JSON; Server Actions xử lý mutation từ UI. Cả hai đều kiểm tra xác thực, phân quyền RBAC và validate đầu vào bằng Zod.
- **Tầng Nghiệp vụ (`src/modules/*/*.service.ts`, `*.access.ts`):** Đóng gói toàn bộ quy tắc nghiệp vụ (giới hạn 01 Project `ACTIVE`, kiểm tra chu trình DAG, quy trình duyệt Task, chuyển tiếp Task khi đóng Sprint, tính toán báo cáo phi cộng dồn, kiểm tra trùng lịch).
- **Tầng Truy cập Dữ liệu (`src/modules/*/*.repository.ts`, `src/lib/prisma.ts`):** Tách biệt truy vấn Prisma và transaction (kết hợp khóa đồng thời PostgreSQL trong `src/lib/db-locks.ts` ở các thao tác nhạy cảm).
- **Tầng Tích hợp & Dùng chung (`src/lib/**`, `src/server/integrations/email.ts`):** Quản lý Auth.js, RBAC đọc từ DB (`loadTrustedAuthContext`), giới hạn tần suất bằng PostgreSQL (`RateLimitEvent`), HTTP Security Headers & CSP nonce, phát sự kiện Pusher và gửi email qua Nodemailer SMTP.

```mermaid
flowchart TB
    Client["Browser / React Client Components<br/>(UI, Forms, Ctrl+K, Pusher Client)"]
    Middleware["Next.js Middleware<br/>(CSP Nonce, Security Headers, Route Guard)"]
    SSR["App Router Server Components<br/>(src/app/(dashboard)/**)"]
    API["API Route Handlers & Server Actions<br/>(src/app/api/v1/**, *.actions.ts)"]
    AuthZ["Auth.js v5 + Trusted DB Auth Context<br/>(tokenVersion, RBAC Policy)"]
    Services["Modular Domain Services & Access Guards<br/>(src/modules/*/*.service.ts)"]
    Repos["Repositories & Prisma Client<br/>(src/modules/*/*.repository.ts)"]
    DB[("PostgreSQL 18<br/>(Data, RateLimitEvent, SmtpQuotaAttempt)")]
    Pusher["Pusher Channels<br/>(Private Task & User Channels)"]
    SMTP["Nodemailer SMTP<br/>(Notifications & Password Reset)"]

    Client -->|HTTPS| Middleware
    Middleware --> SSR
    Middleware --> API
    SSR --> AuthZ
    API --> AuthZ
    AuthZ --> Services
    SSR --> Services
    Services --> Repos
    Repos --> DB
    Services -->|Realtime Events| Pusher
    Pusher -->|WebSocket| Client
    Services -->|Bounded Async Dispatch| SMTP
```

---

## 6. Project Structure / Cấu trúc thư mục

```text
akatsuki-yui/
├── prisma/
│   ├── schema.prisma              # PostgreSQL schema & models / Định nghĩa schema CSDL
│   ├── seed.ts                    # Safe idempotent CLI seed entrypoint / Script seed an toàn
│   ├── seed-helpers.ts            # Role/Permission & initial admin bootstrap / Logic đồng bộ quyền & Admin
│   └── migrations/                # 11 versioned Prisma SQL migrations / Các bản migration SQL
├── scripts/
│   └── run-prisma.mjs             # Prisma CLI wrapper loading .env safely / Script chạy Prisma CLI
├── src/
│   ├── middleware.ts              # Auth redirect guard & CSP nonce injection / Bảo vệ route & chèn CSP nonce
│   ├── app/
│   │   ├── (auth)/                # Login, Register, Forgot/Reset Password, Pending Approval
│   │   ├── (dashboard)/           # Protected workspace pages (Dashboard, Projects, Admin, Reports, etc.)
│   │   ├── access-denied/         # Access denied page / Trang từ chối truy cập
│   │   └── api/                   # Auth.js, Pusher auth, Healthchecks, Cron, & /api/v1/* REST APIs
│   ├── components/
│   │   ├── ui/                    # Reusable Radix/shadcn-style UI primitives / Thành phần UI nền tảng
│   │   ├── layout/                # App shell & Ctrl+K Global Command Palette
│   │   ├── shared/                # Status badges, Zalo copy button, URL pagination
│   │   └── ...                    # Feature-specific UI components (tasks, kanban, schedule, meetings, etc.)
│   ├── lib/                       # Shared infra: prisma, auth, env, rate-limit, pusher, security-headers, timezone
│   ├── modules/                   # Modular Monolith domain modules:
│   │   ├── activity/              # Unified Workspace + Task activity feed
│   │   ├── auth/                  # Registration, credentials auth, password reset
│   │   ├── authorization/         # 4 Roles, 32 Permissions, DB-backed policy evaluation
│   │   ├── dashboard/             # Operational dashboard queries & metrics
│   │   ├── documents/             # External document links & soft delete
│   │   ├── meetings/              # Meet links, project meetings & meeting-to-task
│   │   ├── notifications/         # In-app notifications, SMTP delivery queue & templates
│   │   ├── project-members/       # Membership, leader handoff, soft-leave guards
│   │   ├── project-templates/     # Workspace project templates
│   │   ├── projects/              # Project lifecycle & single-active invariant
│   │   ├── reports/               # Project analytics, member contribution & sprint analytics
│   │   ├── roles/                 # Role × Permission management
│   │   ├── schedule/              # Weekly busy-time schedule & exceptions
│   │   ├── sprints/               # Sprint lifecycle, backlog, Kanban & burndown
│   │   ├── tasks/                 # Tasks, assignees, DAG dependencies, subtasks, comments, reviews
│   │   └── users/                 # User approval, role assignment, profile management
│   ├── server/integrations/       # Nodemailer SMTP transport / Tích hợp gửi mail SMTP
│   └── types/                     # Shared TypeScript definitions / Kiểu dữ liệu dùng chung
├── tests/
│   ├── unit/                      # Vitest unit & route contract tests (no DB required)
│   ├── integration/               # Vitest PostgreSQL integration tests (isolated TEST_DATABASE_URL)
│   └── e2e/                       # Playwright E2E specs + offline mock SMTP server
├── .env.example                   # Environment variable template / Mẫu biến môi trường
├── next.config.ts                 # Next.js config & global security headers / Cấu hình Next.js & headers
├── package.json                   # Dependencies & npm scripts / Thư viện và các lệnh npm
├── playwright.config.ts           # Playwright E2E configuration / Cấu hình kiểm thử E2E
├── tsconfig.json                  # TypeScript strict configuration / Cấu hình TypeScript
├── vercel.json                    # Vercel region (sin1) & daily cron schedule / Cấu hình Vercel & Cron
└── vitest.config.mts              # Vitest test configuration / Cấu hình Vitest
```

---

## 7. Prerequisites / Yêu cầu môi trường

### English
- **Node.js:** v20+ (compatible with Next.js 16 and `@types/node` v24)
- **Package Manager:** `npm` (repository uses `package-lock.json`)
- **Database:** PostgreSQL 18 (local instance, Docker, or Neon Serverless PostgreSQL)
- **Git:** For cloning and version control
- **Optional External Services:**
  - **SMTP Server** (e.g., Gmail App Password, Brevo, or Mailpit for local testing) — required only if sending real notification/password-reset emails.
  - **Pusher Channels** — required only if enabling realtime task comments and live notification badges.

### Tiếng Việt
- **Node.js:** Phiên bản 20 trở lên (tương thích Next.js 16 và `@types/node` v24)
- **Trình quản lý gói:** `npm` (repository sử dụng `package-lock.json`)
- **Cơ sở dữ liệu:** PostgreSQL 18 (cài đặt cục bộ, Docker hoặc Neon Serverless PostgreSQL)
- **Git:** Để clone mã nguồn và quản lý phiên bản
- **Dịch vụ ngoài tùy chọn:**
  - **Máy chủ SMTP** (ví dụ: Gmail App Password, Brevo hoặc Mailpit khi test local) — chỉ cần khi muốn gửi email thông báo / đặt lại mật khẩu thật.
  - **Pusher Channels** — chỉ cần khi bật bình luận Task và thông báo thời gian thực.

---

## 8. Installation & Local Development / Cài đặt và chạy cục bộ

### English

1. **Clone the repository:**
   ```bash
   git clone https://github.com/PhamNguyenKhanh/akatsuki_yui.git
   cd akatsuki_yui
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   *(Note: `postinstall` automatically runs `prisma generate`.)*

3. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in at least `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, and `SEED_ADMIN_*` (see [Environment Variables](#9-environment-variables--biến-môi-trường)).
   ```bash
   cp .env.example .env
   ```

4. **Prepare the PostgreSQL database & run migrations:**
   Ensure your PostgreSQL database exists and is reachable, then generate the Prisma Client and apply migrations:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Seed initial roles, permissions, and admin account:**
   ```bash
   npm run prisma:seed
   ```

6. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Tiếng Việt

1. **Clone repository:**
   ```bash
   git clone https://github.com/PhamNguyenKhanh/akatsuki_yui.git
   cd akatsuki_yui
   ```

2. **Cài đặt thư viện phụ thuộc:**
   ```bash
   npm install
   ```
   *(Lưu ý: script `postinstall` sẽ tự động chạy `prisma generate`.)*

3. **Cấu hình biến môi trường:**
   Sao chép `.env.example` thành `.env` và điền tối thiểu `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL` và `SEED_ADMIN_*` (xem mục [Biến môi trường](#9-environment-variables--biến-môi-trường)).
   ```bash
   cp .env.example .env
   ```

4. **Chuẩn bị cơ sở dữ liệu PostgreSQL & chạy migration:**
   Đảm bảo PostgreSQL đã sẵn sàng kết nối, sau đó sinh Prisma Client và áp dụng các migration:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Khởi tạo dữ liệu Role, Permission và tài khoản Admin ban đầu:**
   ```bash
   npm run prisma:seed
   ```

6. **Khởi chạy máy chủ phát triển:**
   ```bash
   npm run dev
   ```
   Truy cập [http://localhost:3000](http://localhost:3000) trên trình duyệt.

---

## 9. Environment Variables / Biến môi trường

All environment variables below are verified directly against `src/lib/env.ts`, `src/lib/pusher-server.ts`, `src/lib/pusher-client.ts`, `src/lib/rate-limit.ts`, `src/app/api/internal/notifications/process/route.ts`, `prisma/seed-helpers.ts`, and `.env.example`.

*Tất cả biến môi trường dưới đây được đối chiếu trực tiếp từ mã nguồn thực tế.*

| Variable | Required | Scope | Description (EN / VI) |
|---|---|---|---|
| `DATABASE_URL` | Yes | Server-only (Secret) | PostgreSQL connection string for runtime queries (use Neon `-pooler` URL in Vercel). / *Chuỗi kết nối PostgreSQL cho runtime (dùng URL `-pooler` của Neon trên Vercel).* |
| `DIRECT_URL` | Migration only | Operator / CLI (Secret) | Direct unpooled PostgreSQL URL required by `prisma migrate`. Set equal to `DATABASE_URL` locally; omit in Vercel Runtime. / *URL kết nối trực tiếp cho `prisma migrate` (không dùng pooler).* |
| `AUTH_SECRET` | Yes | Server-only (Secret) | Auth.js v5 JWT signing & HMAC secret (min 16 chars dev, min 32 chars prod). / *Khóa bí mật ký JWT và token đặt lại mật khẩu (tối thiểu 32 ký tự ở production).* |
| `AUTH_URL` | Recommended | Server-only | Canonical server base URL (e.g., `http://localhost:3000` or production domain). / *URL gốc của ứng dụng phía server.* |
| `AUTH_TRUST_HOST` | Optional | Server-only | Set `true` behind reverse proxies / Vercel. / *Đặt `true` khi chạy sau reverse proxy hoặc Vercel.* |
| `NEXT_PUBLIC_APP_URL` | Recommended | Client-exposed | Public application URL used in email links and frontend references. / *URL công khai của ứng dụng dùng trong liên kết email.* |
| `CRON_SECRET` | Prod Required | Server-only (Secret) | Bearer token protecting `/api/internal/notifications/process`. / *Mã Bearer xác thực endpoint Cron xử lý thông báo.* |
| `SMTP_HOST` | Optional | Server-only | SMTP server hostname (e.g., `smtp.gmail.com`). / *Tên miền máy chủ SMTP.* |
| `SMTP_PORT` | Optional | Server-only | SMTP port (default `587`; `465` enables implicit TLS). / *Cổng SMTP (mặc định `587`).* |
| `SMTP_SECURE` | Optional | Server-only | `"true"` or `"1"` for implicit TLS. / *Bật TLS trực tiếp (`true`/`1`).* |
| `SMTP_AUTH_MODE` | Optional | Server-only | `"password"` (default) or `"oauth2"`. / *Chế độ xác thực SMTP (`password` hoặc `oauth2`).* |
| `SMTP_USER` | Optional | Server-only | SMTP username / email address. / *Tên đăng nhập / email tài khoản SMTP.* |
| `SMTP_PASS` | Optional | Server-only (Secret) | SMTP password or app password (when `SMTP_AUTH_MODE=password`). / *Mật khẩu hoặc App Password SMTP.* |
| `SMTP_OAUTH_CLIENT_ID` | Optional | Server-only (Secret) | Google/SMTP OAuth2 Client ID (when `SMTP_AUTH_MODE=oauth2`). / *OAuth2 Client ID cho SMTP.* |
| `SMTP_OAUTH_CLIENT_SECRET` | Optional | Server-only (Secret) | Google/SMTP OAuth2 Client Secret. / *OAuth2 Client Secret cho SMTP.* |
| `SMTP_OAUTH_REFRESH_TOKEN` | Optional | Server-only (Secret) | Google/SMTP OAuth2 Refresh Token. / *OAuth2 Refresh Token cho SMTP.* |
| `SMTP_FROM` | Optional | Server-only | Sender display name and email (e.g., `Akatsuki Yui <no-reply@example.com>`). / *Địa chỉ người gửi hiển thị trên email.* |
| `SMTP_DAILY_SEND_LIMIT` | Optional | Server-only | Rolling 24h email quota stored in DB (default `50`, max `5000`). / *Giới hạn gửi email trong 24h (mặc định `50`).* |
| `SMTP_PER_MINUTE_LIMIT` | Optional | Server-only | Per-minute email dispatch cap (default `10`, max `200`). / *Giới hạn gửi email mỗi phút (mặc định `10`).* |
| `PUSHER_APP_ID` | Optional | Server-only | Pusher application ID for triggering realtime events. / *App ID của Pusher phía server.* |
| `PUSHER_KEY` / `PUSHER_APP_KEY` | Optional | Server-only | Pusher key (alias `PUSHER_APP_KEY` supported). / *Khóa Pusher phía server.* |
| `PUSHER_SECRET` / `PUSHER_APP_SECRET` | Optional | Server-only (Secret) | Pusher secret for server triggers & private channel auth. / *Khóa bí mật Pusher phía server.* |
| `PUSHER_CLUSTER` / `PUSHER_APP_CLUSTER` | Optional | Server-only | Pusher cluster region (e.g., `ap1`). / *Khu vực cluster Pusher.* |
| `NEXT_PUBLIC_PUSHER_KEY` / `NEXT_PUBLIC_PUSHER_APP_KEY` | Optional | Client-exposed | Public Pusher key for browser WebSocket client. / *Khóa Pusher công khai cho trình duyệt.* |
| `NEXT_PUBLIC_PUSHER_CLUSTER` / `NEXT_PUBLIC_PUSHER_APP_CLUSTER` | Optional | Client-exposed | Public Pusher cluster for browser WebSocket client. / *Cluster Pusher công khai cho trình duyệt.* |
| `SEED_ADMIN_EMAIL` | Seed only | Operator / CLI | Email for one-time initial Admin bootstrap in `prisma db seed`. / *Email Admin khởi tạo khi chạy seed.* |
| `SEED_ADMIN_PASSWORD` | Seed only | Operator / CLI (Secret) | Strong password for initial Admin bootstrap. / *Mật khẩu mạnh cho Admin khởi tạo khi seed.* |
| `SEED_ADMIN_NAME` | Seed only | Operator / CLI | Display name for initial Admin bootstrap. / *Tên hiển thị của Admin khởi tạo.* |
| `TEST_DATABASE_URL` | Test only | Test Runner (Secret) | Isolated PostgreSQL database URL for integration & E2E tests (never falls back to `DATABASE_URL`). / *CSDL PostgreSQL riêng cho integration/E2E test.* |
| `LOG_LEVEL` | Optional | Server-only | Runtime logger verbosity. / *Mức độ ghi log runtime.* |
| `NODE_ENV` | Standard | Runtime | `development`, `test`, or `production`. / *Môi trường chạy ứng dụng.* |
| `E2E_ALLOW_PLAINTEXT_LOOPBACK_SMTP` | Test only | E2E Runner | Set `"1"` only in E2E offline mock SMTP tests to allow plaintext loopback SMTP. / *Chỉ dùng trong test E2E với mock SMTP nội bộ.* |

### Example `.env.example`

```dotenv
# Runtime Application Variables
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/akatsuki_yui
AUTH_SECRET=replace-with-a-random-string-at-least-32-chars
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
CRON_SECRET=replace-with-cron-secret

# Optional Nodemailer SMTP
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_AUTH_MODE=password
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Akatsuki Yui <no-reply@akatsuki-yui.local>"
SMTP_DAILY_SEND_LIMIT=50
SMTP_PER_MINUTE_LIMIT=10

# Optional Pusher Channels (Realtime Comments & Notifications)
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=

# Operator / Migration & Seed Only (Do not set in Vercel Runtime)
DIRECT_URL=postgresql://postgres:password@localhost:5432/akatsuki_yui
SEED_ADMIN_EMAIL=admin@akatsuki-yui.local
SEED_ADMIN_PASSWORD=ChangeMe@123456
SEED_ADMIN_NAME=Workspace Admin

# Isolated Test Database (Required for test:integration and test:e2e)
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/akatsuki_yui_test
```

---

## 10. Database Setup / Thiết lập cơ sở dữ liệu

### English
- **Engine & ORM:** PostgreSQL 18 managed with Prisma ORM `6.19.3` (`prisma/schema.prisma`).
- **Migrations:** 11 SQL migrations are tracked under `prisma/migrations/` covering Sprints 1–9 and v1.1 (`task_comments`, `task_subtasks`).
- **Prisma CLI Wrapper:** All `npm run prisma:*` scripts invoke `scripts/run-prisma.mjs`, which loads `.env` safely without overriding explicit test/shell environment variables.
- **Safe Idempotent Seeding:** `npm run prisma:seed` (`prisma/seed.ts`) synchronizes the 4 roles and 32 permissions without overwriting existing Admin status, password, or customized role permissions. If `SEED_ADMIN_EMAIL` and a strong `SEED_ADMIN_PASSWORD` are provided and no Admin exists yet, it bootstraps the initial `ACTIVE` Admin account.

### Tiếng Việt
- **Hệ quản trị & ORM:** PostgreSQL 18 kết hợp Prisma ORM `6.19.3` (`prisma/schema.prisma`).
- **Migrations:** Thư mục `prisma/migrations/` lưu trữ 11 bản migration SQL xuyên suốt Sprint 1–9 và bản v1.1 (`task_comments`, `task_subtasks`).
- **Prisma CLI Wrapper:** Các lệnh `npm run prisma:*` chạy qua `scripts/run-prisma.mjs` để nạp `.env` an toàn mà không ghi đè biến môi trường đang có.
- **Seed an toàn & lặp lại được:** Lệnh `npm run prisma:seed` (`prisma/seed.ts`) đồng bộ 4 Role và 32 Permission mà không ghi đè trạng thái, mật khẩu hay quyền đã tùy chỉnh của Admin. Nếu có `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD` đủ mạnh và chưa có Admin, script sẽ tạo tài khoản Admin `ACTIVE` ban đầu.

```mermaid
erDiagram
    User ||--o{ UserRole : has
    Role ||--o{ UserRole : assigned_to
    Role ||--o{ RolePermission : grants
    Permission ||--o{ RolePermission : granted_by

    ProjectTemplate ||--o{ Project : configures
    User ||--o{ Project : leads_or_instructs
    Project ||--o{ ProjectMember : includes
    User ||--o{ ProjectMember : joins

    Project ||--o{ Sprint : contains
    Project ||--o{ Task : contains
    Sprint ||--o{ Task : schedules
    Task ||--o{ TaskAssignee : assigned_to
    Task ||--o{ TaskDependency : depends_on
    Task ||--o{ TaskReview : reviewed_in
    Task ||--o{ TaskComment : discussed_in
    Task ||--o{ TaskSubtask : broken_into
    Task ||--o{ TaskHistory : logs

    Project ||--o{ Document : stores_links
    Project ||--o{ ProjectScheduleEntry : tracks_busy_time
    Project ||--o{ ProjectMeeting : schedules
    User ||--o{ Notification : receives
    Notification ||--o{ NotificationDelivery : dispatches
```

---

## 11. Authentication & Authorization / Xác thực và phân quyền

### English
- **Authentication:** Auth.js v5 (`next-auth@5.0.0-beta.32`) using the **Credentials** provider (`src/lib/auth.ts`) and `bcryptjs` password hashing. Sessions use signed JWTs with a 7-day `maxAge`.
- **Account Status Enforcement:** Newly registered users receive `PENDING` status and default `MEMBER` role. Only `ACTIVE` accounts can sign in or access protected routes (`PENDING`, `REJECTED`, and `SUSPENDED` are blocked).
- **Immediate Session Revocation:** Every `User` has a `tokenVersion` integer. Changing passwords, suspending an account, or modifying roles increments `tokenVersion`. Server-side `loadTrustedAuthContext` validates `tokenVersion` and current roles/permissions directly against PostgreSQL on every protected request.
- **Password Reset:** `/forgot-password` and `/reset-password` generate and verify stateless HMAC-SHA256 tokens signed with `AUTH_SECRET` (30-minute TTL, bound to `userId` and `tokenVersion`) and send reset links via SMTP.
- **Dynamic RBAC:** 4 system roles (`ADMIN`, `LEADER`, `INSTRUCTOR`, `MEMBER`) and 32 permissions (`src/modules/authorization/constants.ts`). `CORE_ADMIN_PERMISSION_CODES` cannot be revoked from `ADMIN`, and Last Admin Protection prevents demoting or suspending the final active `ADMIN`.
- **Route Protection:** `src/middleware.ts` protects `/dashboard`, `/profile`, `/admin`, `/projects`, `/documents`, `/notifications`, `/reports`, and `/activity`, redirecting unauthenticated requests to `/login` with validated `callbackUrl` (`src/lib/safe-redirect.ts`).

### Tiếng Việt
- **Xác thực:** Auth.js v5 (`next-auth@5.0.0-beta.32`) sử dụng provider **Credentials** (`src/lib/auth.ts`) và mã hóa mật khẩu bằng `bcryptjs`. Phiên làm việc dùng JWT có thời hạn tối đa 7 ngày (`maxAge`).
- **Kiểm soát trạng thái tài khoản:** Tài khoản mới đăng ký có trạng thái `PENDING` và vai trò mặc định `MEMBER`. Chỉ tài khoản `ACTIVE` mới được đăng nhập và sử dụng hệ thống (`PENDING`, `REJECTED`, `SUSPENDED` đều bị chặn).
- **Thu hồi phiên tức thì:** Mỗi `User` có trường `tokenVersion`. Khi đổi mật khẩu, tạm khóa tài khoản hoặc đổi Role, `tokenVersion` tăng lên; hàm `loadTrustedAuthContext` kiểm tra `tokenVersion` và quyền trực tiếp từ PostgreSQL trên mỗi request được bảo vệ.
- **Đặt lại mật khẩu:** Trang `/forgot-password` và `/reset-password` sử dụng token ký HMAC-SHA256 bằng `AUTH_SECRET` (hết hạn sau 30 phút, gắn với `userId` và `tokenVersion`) và gửi qua SMTP.
- **Phân quyền RBAC động:** Gồm 4 vai trò (`ADMIN`, `LEADER`, `INSTRUCTOR`, `MEMBER`) và 32 quyền (`src/modules/authorization/constants.ts`). Các quyền cốt lõi của `ADMIN` (`CORE_ADMIN_PERMISSION_CODES`) được khóa chống thu hồi và có cơ chế bảo vệ Admin cuối cùng.
- **Bảo vệ Route:** `src/middleware.ts` bảo vệ các nhánh `/dashboard`, `/profile`, `/admin`, `/projects`, `/documents`, `/notifications`, `/reports`, `/activity` và chuyển hướng về `/login` kèm kiểm tra an toàn `callbackUrl`.

---

## 12. API & Application Workflows / API và luồng nghiệp vụ

### English
Mutations and queries are served through a combination of **Next.js Server Actions** (`src/modules/*/*.actions.ts`) and **REST API Route Handlers** under `/api/v1/*` (plus `/api/health`, `/api/pusher/auth`, and `/api/internal/notifications/process`).

Representative verified endpoints:

| Endpoint | Methods | Access / Auth | Purpose |
|---|---|---|---|
| `/api/health`, `/api/v1/health` | `GET` | Public (`no-store`) | Database connectivity (`SELECT 1`) & runtime env check |
| `/api/v1/auth/register`, `login`, `logout`, `session` | `POST` / `GET` | Public / Session | Account registration, login, logout, and session inspection |
| `/api/v1/users/[userId]/status`, `.../role` | `PATCH` | `account.manage`, `account.approve`, `role.manage` | Approve/reject/suspend/activate users and assign roles |
| `/api/v1/roles/[roleId]/permissions` | `GET`, `PUT` | `role.manage` | View and update Role × Permission matrix |
| `/api/v1/projects`, `.../activate`, `.../archive`, `.../restore` | `GET`, `POST`, `PATCH` | `project.*` permissions | Project CRUD and `CREATED -> ACTIVE -> ARCHIVED` lifecycle |
| `/api/v1/projects/[projectId]/tasks`, `kanban`, `backlog`, `sprints` | `GET`, `POST` | `task.*`, `sprint.*` | Task management, Kanban board, Backlog, and Sprints |
| `/api/v1/tasks/[taskId]/submit-review`, `approve`, `reject` | `POST` | `task.submit_review`, `task.review` | Task review workflow with mandatory review reasons |
| `/api/v1/projects/[projectId]/schedule`, `meetings`, `meet-links` | `GET`, `POST`, `PATCH`, `DELETE` | `schedule.*`, `meeting.*` | Team busy schedule, Google Meet links, and project meetings |
| `/api/v1/reports/projects/[projectId]`, `members`, `sprints` | `GET` | `report.read` | Analytics, Member Contribution, and Sprint Analytics |
| `/api/v1/search` | `GET` | Active User | `Ctrl+K` global search across accessible projects, tasks, sprints, and documents |
| `/api/pusher/auth` | `POST` | Active User + Access Check | Authorizes `private-user-<userId>` and `private-task-<taskId>` channels |
| `/api/internal/notifications/process` | `GET`, `POST` | `Bearer <CRON_SECRET>` | Daily Cron job for deadline reminders & failed email retries |

### Tiếng Việt
Các thao tác truy vấn và cập nhật dữ liệu được phục vụ qua **Next.js Server Actions** (`src/modules/*/*.actions.ts`) và **REST API Route Handlers** tại `/api/v1/*` (cùng `/api/health`, `/api/pusher/auth` và `/api/internal/notifications/process`). Bảng trên liệt kê các endpoint đại diện đã được xác minh trực tiếp trong `src/app/api/`.

---

## 13. Testing & Quality Assurance / Kiểm thử và đảm bảo chất lượng

### English

The repository includes unit tests (`tests/unit/`), PostgreSQL integration tests (`tests/integration/`), and Playwright end-to-end tests (`tests/e2e/`).

| Command | Tool | Requirements | Purpose |
|---|---|---|---|
| `npm run format:check` | Prettier | None | Check formatting across `src/`, `tests/`, and `prisma/` |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) | None | Strict static type checking |
| `npm run lint` | ESLint | None | Static code & Next.js lint rules |
| `npm run test:unit` | Vitest | None | Run unit & API route contract tests (`tests/unit`) |
| `npm run test:integration` | Vitest | `TEST_DATABASE_URL` | Run PostgreSQL integration tests against an isolated test DB |
| `npm run test` | Vitest | `TEST_DATABASE_URL` | Run `test:unit` followed by `test:integration` |
| `npm run test:e2e` | Playwright | `TEST_DATABASE_URL` + build | Run E2E browser suites with offline mock SMTP server |
| `npm run prisma:validate` | Prisma CLI | `DATABASE_URL` | Validate `prisma/schema.prisma` |
| `npm run build` | Next.js | Env vars | Build production bundle |

### Tiếng Việt

Repository có sẵn 3 tầng kiểm thử: Unit test (`tests/unit/`), Integration test với PostgreSQL (`tests/integration/`) và E2E test bằng Playwright (`tests/e2e/`).

- **Kiểm tra nhanh không cần DB:** `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm run test:unit`.
- **Kiểm tra có DB cô lập:** `npm run test:integration` và `npm run test:e2e` yêu cầu cấu hình `TEST_DATABASE_URL` tách biệt hoàn toàn với database phát triển để tránh mất dữ liệu.

---

## 14. Production Build & Deployment / Build production và triển khai

### English

The project is configured for **Vercel** deployment (`vercel.json`):
- **Region:** `sin1` (Singapore).
- **Scheduled Cron:** `/api/internal/notifications/process` runs daily at `0 1 * * *` (01:00 UTC), authenticated via `CRON_SECRET`.

**Deployment Checklist:**
1. Set all required runtime variables in Vercel (`DATABASE_URL` using a pooled connection such as Neon `-pooler`, `AUTH_SECRET` ≥ 32 random chars, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, and optional SMTP / Pusher variables).
2. Do **not** set `DIRECT_URL` or `SEED_ADMIN_*` in Vercel Runtime containers (`DEC-067`).
3. Run database migrations from a CI/operator environment with `DIRECT_URL` configured:
   ```bash
   npm run prisma:deploy
   ```
4. Build and verify locally before deploying:
   ```bash
   npm run build
   npm run start
   ```
5. Verify `/api/health` returns HTTP `200` after deployment.

### Tiếng Việt

Dự án được cấu hình sẵn cho **Vercel** (`vercel.json`):
- **Region:** `sin1` (Singapore).
- **Vercel Cron:** Tự động gọi `/api/internal/notifications/process` hàng ngày lúc `0 1 * * *` (01:00 UTC), xác thực bằng `CRON_SECRET`.

**Quy trình triển khai:**
1. Cấu hình biến môi trường runtime trên Vercel (`DATABASE_URL` dùng chuỗi kết nối pooled như Neon `-pooler`, `AUTH_SECRET` ≥ 32 ký tự ngẫu nhiên, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, và các biến SMTP / Pusher nếu dùng).
2. **Không** đưa `DIRECT_URL` hay `SEED_ADMIN_*` vào Vercel Runtime.
3. Chạy `npm run prisma:deploy` từ môi trường operator/CI có `DIRECT_URL` để áp dụng migration lên database production.
4. Kiểm tra build production bằng `npm run build` và xác nhận `/api/health` trả về `200` sau khi deploy.

---

## 15. Security Considerations / Lưu ý bảo mật

### English
Implemented protections verified in source code:
- **Password Policy & Hashing:** Minimum 8 characters with uppercase, lowercase, digit, and special character; hashed with `bcryptjs`.
- **Session Revocation:** `User.tokenVersion` invalidates existing JWTs immediately on password change, suspension, or role change.
- **PostgreSQL Sliding-Window Rate Limiting (`src/lib/rate-limit.ts`):** Protects login, registration, password reset/change, admin retries, and mutations; fails closed (`503`) on sensitive auth endpoints if DB primitives are unavailable.
- **HTTP Security Headers (`src/lib/security-headers.ts` & `src/middleware.ts`):** Per-request cryptographic CSP nonce in production (no `'unsafe-eval'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and HSTS on Vercel production (`VERCEL_ENV === "production"`).
- **Request & Redirect Guards:** 64 KB JSON body size limit (`413`) and strict open-redirect validation (`src/lib/safe-redirect.ts`).
- **Private Realtime Channel Authorization:** `/api/pusher/auth` verifies active user status and task read access before signing Pusher channel tokens.
- **Document Safety:** Document Library stores curated URLs (`safe-url.ts`) rather than accepting arbitrary binary uploads.

### Tiếng Việt
Các cơ chế bảo mật đã triển khai và được xác minh trong mã nguồn:
- **Chính sách & Mã hóa mật khẩu:** Tối thiểu 8 ký tự gồm chữ hoa, chữ thường, số và ký tự đặc biệt; băm bằng `bcryptjs`.
- **Thu hồi phiên tức thì:** `User.tokenVersion` vô hiệu hóa JWT cũ ngay lập tức khi đổi mật khẩu, tạm khóa hoặc đổi Role.
- **Rate Limiting trên PostgreSQL (`src/lib/rate-limit.ts`):** Bảo vệ đăng nhập, đăng ký, đặt lại/đổi mật khẩu, gửi lại email và các API mutation; fail-closed (`503`) trên các route xác thực nhạy cảm.
- **HTTP Security Headers (`src/lib/security-headers.ts`):** CSP với cryptographic nonce mỗi request ở production (loại bỏ `'unsafe-eval'`), `X-Frame-Options: DENY`, `nosniff`, `Permissions-Policy` và HSTS trên Vercel production.
- **Chống Open-Redirect & Quá tải Payload:** Giới hạn JSON body 64 KB (`413`) và kiểm tra an toàn `callbackUrl` (`src/lib/safe-redirect.ts`).
- **Xác thực kênh Pusher riêng tư:** `/api/pusher/auth` kiểm tra tài khoản `ACTIVE` và quyền đọc Task trước khi cấp quyền subscribe.

---

## 16. Troubleshooting / Xử lý sự cố thường gặp

| Issue / Sự cố | Cause / Nguyên nhân | Resolution (EN / VI) |
|---|---|---|
| `prisma migrate` fails or hangs on Neon | `DIRECT_URL` is missing or points to a `-pooler` URL | Set `DIRECT_URL` in `.env` to the direct (non-pooler) PostgreSQL connection string. / *Đặt `DIRECT_URL` trong `.env` là URL kết nối trực tiếp (không có `-pooler`).* |
| `Invalid server environment configuration` on startup | Missing `DATABASE_URL` or `AUTH_SECRET` < 16 chars (32 in prod) | Check `.env` and ensure `AUTH_SECRET` is a strong random string (not a placeholder in production). / *Kiểm tra `.env` và đảm bảo `AUTH_SECRET` đủ độ dài, không dùng giá trị mẫu ở production.* |
| `test:integration` or `test:e2e` refuses to run | `TEST_DATABASE_URL` is unset or equals `DATABASE_URL` | Set a separate PostgreSQL database in `TEST_DATABASE_URL` (`tests/lib/test-db-isolation.ts`). / *Cấu hình một database riêng cho `TEST_DATABASE_URL`.* |
| Emails are not sent in local dev | `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` not configured | App degrades gracefully; configure SMTP credentials or use a local SMTP sink like Mailpit. / *Hệ thống vẫn chạy bình thường; cấu hình SMTP hoặc dùng Mailpit để test local.* |
| `/api/pusher/auth` returns `503` | `PUSHER_*` server env vars are missing | Configure `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` and `NEXT_PUBLIC_PUSHER_*`. / *Bổ sung đầy đủ cặp biến Pusher cho cả server và client.* |

---

## 17. Development Guidelines / Quy chuẩn phát triển

### English
- **Modular Boundaries:** Keep business rules inside `src/modules/<domain>/*.service.ts` and database access inside `*.repository.ts`. Never import Prisma or server-only modules into Client Components.
- **Validation & Errors:** Validate all inputs with Zod schemas and throw typed `AppError` helpers from `src/lib/errors.ts`.
- **Verification Before Commit:** Run `npm run format:check`, `npm run typecheck`, `npm run lint`, and `npm run test:unit` (plus `test:integration` / `build` when applicable).
- **Git Branching Convention:**
  - `feat/*`: Feature / sprint branches created from `dev`.
  - `dev`: Primary integration branch during development.
  - `main`: Release branch merged from `dev`.
  - Local internal planning/report folders (`docs/`, `markdown/`, `report/`) are ignored via `.gitignore`.

### Tiếng Việt
- **Ranh giới Module:** Đặt logic nghiệp vụ tại `src/modules/<domain>/*.service.ts` và truy vấn CSDL tại `*.repository.ts`. Không import Prisma hoặc module `server-only` vào Client Component.
- **Validation & Xử lý lỗi:** Validate mọi dữ liệu đầu vào bằng Zod và sử dụng `AppError` từ `src/lib/errors.ts`.
- **Kiểm tra trước khi commit:** Chạy `npm run format:check`, `npm run typecheck`, `npm run lint` và `npm run test:unit` (kèm `test:integration` / `build` khi cần).
- **Quy ước nhánh Git:** `feat/*` (tách từ `dev`) → `dev` (tích hợp) → `main` (phát hành). Các thư mục tài liệu nội bộ (`docs/`, `markdown/`, `report/`) được bỏ qua trong `.gitignore`.

---

## 18. Contributors / Thành viên đóng góp

- **Akatsuki Yui**
---

## 19. Acknowledgments / Lời cảm ơn

### English
Built with [Next.js](https://nextjs.org/), [React](https://react.dev/), [Prisma](https://www.prisma.io/), [Auth.js](https://authjs.dev/), [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Pusher](https://pusher.com/), [Nodemailer](https://nodemailer.com/), [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/), and [Vercel](https://vercel.com/).

### Tiếng Việt
Dự án sử dụng các công nghệ mã nguồn mở và dịch vụ: [Next.js](https://nextjs.org/), [React](https://react.dev/), [Prisma](https://www.prisma.io/), [Auth.js](https://authjs.dev/), [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Pusher](https://pusher.com/), [Nodemailer](https://nodemailer.com/), [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/) và [Vercel](https://vercel.com/).
