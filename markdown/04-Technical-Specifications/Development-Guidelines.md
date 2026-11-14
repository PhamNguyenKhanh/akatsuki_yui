# DEVELOPMENT AND DEPLOYMENT GUIDE
## Akatsuki Yui – Team & Project Management System

**Document Version:** 1.0  
**Document Status:** Draft  
**Project Name:** Akatsuki Yui  
**Document Type:** Development and Deployment Guide

---

# 1. Introduction

## 1.1. Purpose

Tài liệu này hướng dẫn quá trình thiết lập môi trường phát triển, cài đặt các công nghệ cần thiết, cấu hình Database, chạy ứng dụng và triển khai hệ thống Akatsuki Yui.

Mục tiêu:

- Chuẩn hóa môi trường phát triển.
- Giúp các thành viên có thể thiết lập Project dễ dàng.
- Đảm bảo quy trình chạy ứng dụng nhất quán.
- Hướng dẫn quản lý Database và Prisma Migration.
- Hướng dẫn cấu hình Environment Variables.
- Hướng dẫn Build, Testing và Deployment.

## 1.2. Scope

Tài liệu bao gồm:

1. Development Environment.
2. Technology Stack.
3. Project Setup.
4. Folder Structure.
5. Environment Configuration.
6. Database Setup.
7. Prisma Setup.
8. Running the Application.
9. Testing.
10. Build and Deployment.
11. Git Workflow.
12. Troubleshooting.

## 1.3. Target Audience

- Project Leader.
- Developers.
- Testers.
- System Maintainers.

---

# 2. Technology Stack

## 2.1. Core Technologies

| Technology | Purpose |
|---|---|
| Next.js | Fullstack Web Framework |
| React | User Interface |
| TypeScript | Programming Language |
| Node.js | Runtime Environment |
| PostgreSQL | Relational Database |
| Prisma ORM | Database Access and Schema Management |
| Tailwind CSS | UI Styling |
| shadcn/ui | Reusable UI Components |
| Zod | Data Validation |
| React Hook Form | Form Management |
| Recharts | Data Visualization |

Đây là Technology Stack đề xuất. Các phiên bản chính thức sẽ được xác định tại thời điểm khởi tạo Project.

## 2.2. Development Tools

| Tool | Purpose |
|---|---|
| Visual Studio Code | Code Editor |
| Git | Version Control |
| GitHub | Source Code Repository |
| Node.js | Runtime |
| npm | Package Manager |
| Prisma CLI | Database Management |
| Postman | API Testing |
| Playwright | Browser Testing |
| Vitest | Unit Testing |

## 2.3. Recommended Services

| Service | Purpose | Selection |
|---|---|---|
| Vercel | Application Hosting | Proposed |
| Neon hoặc Supabase | PostgreSQL Hosting | TBD |
| GitHub | Source Control | Proposed |
| Email Provider | Email Notification bắt buộc trong MVP | TBD — chỉ nhà cung cấp chưa được chọn |

Các dịch vụ phải được kiểm tra Free Tier, giới hạn sử dụng và điều kiện triển khai trước khi lựa chọn chính thức.

---

# 3. System Requirements

## 3.1. Hardware Requirements

Máy tính phát triển cần đáp ứng:

- Có thể chạy Node.js và Next.js.
- Có đủ bộ nhớ để chạy Code Editor, Browser và Database.
- Có kết nối Internet để cài đặt Dependencies và triển khai ứng dụng.

Cấu hình phần cứng tối thiểu chính thức: [CHƯA XÁC ĐỊNH].

## 3.2. Software Requirements

| Software | Requirement |
|---|---|
| Operating System | Windows / Linux / macOS |
| Node.js | LTS Version phù hợp với Next.js |
| npm | Đi kèm Node.js hoặc phiên bản tương thích |
| Git | Installed |
| PostgreSQL | Local hoặc Cloud Database |
| Code Editor | Visual Studio Code hoặc tương đương |
| Browser | Chrome, Firefox hoặc Edge |

Phiên bản cụ thể cần được khóa trong Project sau khi khởi tạo.

## 3.3. Required Accounts

Các tài khoản dịch vụ có thể cần:

- GitHub Account.
- Hosting Provider Account.
- PostgreSQL Provider Account.
- Email Provider Account là bắt buộc để triển khai Email Notification trong MVP.

Không đưa mật khẩu, API Key hoặc Secret vào Source Code.

---

# 4. Project Initialization

## 4.1. Create Next.js Project

Khởi tạo Project bằng Next.js:

```bash
npx create-next-app@latest akatsuki-yui
```

Các lựa chọn đề xuất:

| Option | Selection |
|---|---|
| TypeScript | Yes |
| ESLint | Yes |
| Tailwind CSS | Yes |
| App Router | Yes |
| src/ Directory | Yes |
| Import Alias | @/* |

Các lựa chọn có thể được điều chỉnh theo phiên bản Next.js tại thời điểm khởi tạo.

## 4.2. Navigate to Project

```bash
cd akatsuki-yui
```

## 4.3. Install Dependencies

Các thư viện dự kiến:

```bash
npm install prisma @prisma/client
npm install zod react-hook-form @hookform/resolvers
npm install recharts
```

Các thư viện giao diện có thể được cài đặt thông qua shadcn/ui CLI.

Authentication Library sẽ được lựa chọn và cài đặt sau khi xác định Authentication Strategy.

## 4.4. Initialize Git

```bash
git init
git add .
git commit -m "chore: initialize project"
```

Kết nối GitHub Repository sau khi tạo Repository trên GitHub.

---

# 5. Recommended Project Structure

Cấu trúc thư mục đề xuất:

```text
akatsuki-yui/
│
├── public/
│   ├── images/
│   ├── icons/
│   └── logo/
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── projects/
│   │   │   ├── tasks/
│   │   │   ├── kanban/
│   │   │   ├── sprints/
│   │   │   ├── documents/
│   │   │   ├── notifications/
│   │   │   ├── reports/
│   │   │   ├── profile/
│   │   │   └── admin/
│   │   │
│   │   ├── api/
│   │   │   └── [route-handlers]
│   │   │
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── forms/
│   │   ├── tables/
│   │   └── shared/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── permissions/
│   │   ├── projects/
│   │   ├── members/
│   │   ├── tasks/
│   │   ├── sprints/
│   │   ├── kanban/
│   │   ├── documents/
│   │   ├── notifications/
│   │   ├── dashboard/
│   │   └── reports/
│   │
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── validations/
│   │   ├── utils/
│   │   └── constants/
│   │
│   ├── server/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── policies/
│   │   └── actions/
│   │
│   ├── hooks/
│   ├── types/
│   └── middleware.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

Lưu ý:

- Đây là cấu trúc khởi đầu, có thể điều chỉnh theo Architecture chính thức.
- Không bắt buộc tạo trước tất cả thư mục nếu Module chưa được triển khai.
- Business Logic cần được tổ chức theo Module và trách nhiệm.
- Database Access chỉ được thực hiện từ Server.
- Không đưa Prisma Client hoặc Secret vào Client Components.
- Các Module cần có ranh giới trách nhiệm rõ ràng.
- Không tạo các lớp Repository hoặc Service chỉ để tăng số lượng file nếu không mang lại giá trị.

---

# 6. Environment Configuration

## 6.1. Environment Files

Các môi trường:

| Environment | Purpose |
|---|---|
| Development | Phát triển trên máy cá nhân |
| Test | Kiểm thử |
| Production | Hệ thống đang hoạt động |

## 6.2. Environment Variables

File `.env.example`:

```env
# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=
DIRECT_URL=

# Authentication
AUTH_SECRET=

# Email Provider (Resend - DEC-016)
RESEND_API_KEY=
EMAIL_FROM=
```

Các biến trên là danh sách đề xuất. Tên và số lượng biến cần được điều chỉnh theo thư viện Authentication, Database Provider và Email Provider được lựa chọn.

## 6.3. Environment Variable Rules

1. Không Commit file `.env` chứa Secret lên GitHub.
2. Chỉ Commit `.env.example` với giá trị mẫu hoặc để trống.
3. Không đặt Secret trong biến có tiền tố `NEXT_PUBLIC_`.
4. Không sử dụng chung Secret giữa Development và Production.
5. Phải cấu hình đầy đủ Environment Variables trước khi Build.
6. Không ghi Secret vào Log hoặc Error Message.

---

# 7. Database Setup

## 7.1. Database Selection

Database chính:

**PostgreSQL**

Database Provider: [CHƯA XÁC ĐỊNH].

Các lựa chọn có thể cân nhắc:

- Neon.
- Supabase.
- PostgreSQL Local.

Việc lựa chọn cần dựa trên:

- Free Tier.
- Database Storage.
- Connection Limits.
- Connection Pooling.
- Backup Policy.
- Deployment Compatibility.

## 7.2. Local Database Setup

Nếu sử dụng PostgreSQL Local:

1. Cài đặt PostgreSQL.
2. Khởi động PostgreSQL Service.
3. Tạo Database cho Project.
4. Cấu hình Connection String.
5. Kiểm tra kết nối từ ứng dụng.

Tên Database đề xuất:

```text
akatsuki_yui
```

## 7.3. Database Connection

Ví dụ Connection String:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/akatsuki_yui"
```

Giá trị thực tế phụ thuộc vào Database Provider.

Không sử dụng Connection String mẫu này làm thông tin Production.

---

# 8. Prisma Setup

## 8.1. Initialize Prisma

```bash
npx prisma init
```

Kiểm tra file:

```text
prisma/
├── schema.prisma
└── migrations/
```

## 8.2. Define Database Schema

Database Schema phải được xây dựng dựa trên:

`DATABASE-DESIGN-DOCUMENT.md`

Các Entity chính dự kiến:

- User.
- Role.
- Permission.
- Project.
- ProjectMember.
- Task.
- TaskAssignee.
- TaskDependency.
- TaskHistory.
- Sprint.
- Document.
- Notification.
- ActivityLog.

Danh sách trên chỉ là các Entity định hướng; tên và cấu trúc chính thức phải tuân theo DDD.

## 8.3. Create Migration

Sau khi hoàn thiện Prisma Schema:

```bash
npx prisma migrate dev --name init
```

Migration phải được kiểm tra trước khi sử dụng.

Không chỉnh sửa lịch sử Migration đã áp dụng trên môi trường dùng chung một cách tùy tiện.

## 8.4. Generate Prisma Client

```bash
npx prisma generate
```

## 8.5. Open Prisma Studio

```bash
npx prisma studio
```

Prisma Studio được sử dụng để kiểm tra dữ liệu trong môi trường phát triển.

Không công khai Prisma Studio trên Production.

## 8.6. Database Seeding

Seed Data phục vụ:

- Kiểm tra giao diện.
- Kiểm tra chức năng.
- Kiểm thử Permission.
- Kiểm thử Task Workflow.
- Kiểm thử Dashboard và Reports.

Seed Data cần có tính nhất quán và có thể tái tạo.

Không sử dụng tài khoản mẫu với mật khẩu yếu trên Production.

---

# 9. Running the Application

## 9.1. Install Dependencies

Sau khi Clone Repository:

```bash
npm install
```

Nếu Project có `package-lock.json`, sử dụng:

```bash
npm ci
```

## 9.2. Configure Environment

1. Copy `.env.example`.
2. Tạo file `.env.local` hoặc file môi trường phù hợp.
3. Điền các giá trị cần thiết.
4. Kiểm tra Database Connection.

Không Commit file môi trường chứa Secret.

## 9.3. Run Development Server

```bash
npm run dev
```

Mặc định:

```text
http://localhost:3000
```

## 9.4. Build Application

```bash
npm run build
```

## 9.5. Run Production Build Locally

```bash
npm run start
```

Chỉ thực hiện sau khi Build thành công.

---

# 10. Testing Setup

## 10.1. Unit Testing

Sử dụng Vitest hoặc Jest.

Kiểm tra:

- Validation Functions.
- Business Rules.
- Permission Policies.
- Task Workflow.
- Progress Calculation.
- Utility Functions.

## 10.2. Integration Testing

Kiểm tra:

- Service và Database.
- Authentication và Authorization.
- Project và Member.
- Task và Assignee.
- Task và Notification.
- Sprint và Task.
- Dashboard và Reports.

## 10.3. End-to-End Testing

Sử dụng Playwright để kiểm tra các User Flow:

1. Register và Login.
2. Admin Approve Account.
3. Create Project.
4. Add Project Members.
5. Create và Assign Task.
6. Submit Task for Review.
7. Approve hoặc Reject Task.
8. Create Sprint và Sprint Planning.
9. Open Document.
10. View Dashboard và Reports.

## 10.4. Run Tests

Các lệnh thực tế phụ thuộc vào cấu hình `package.json`.

Ví dụ:

```bash
npm run test
npm run test:integration
npm run test:e2e
```

Không thêm Script nếu chưa cấu hình công cụ tương ứng.

---

# 11. Build and Deployment

## 11.1. Deployment Architecture

Mô hình triển khai đề xuất:

```text
User Browser
     |
     v
Vercel
(Next.js Application)
     |
     v
PostgreSQL Provider
     |
     v
Database
```

Email Provider phải được kết nối từ Server trong MVP; không expose API key ra Client.

## 11.2. Deployment Provider

### Application Hosting

Đề xuất: Vercel.

Cần kiểm tra:

- Next.js Compatibility.
- Free Tier Limits.
- Build Limits.
- Function Execution Limits.
- Environment Variables.
- Domain Configuration.

### Database Hosting

Provider: [CHƯA XÁC ĐỊNH].

Cần kiểm tra:

- PostgreSQL Compatibility.
- Connection Limits.
- Storage Limits.
- Connection Pooling.
- Backup.
- Free Tier Conditions.

Không mặc định rằng các dịch vụ Free Tier sẽ miễn phí hoặc không có giới hạn trong toàn bộ thời gian sử dụng.

## 11.3. Deployment Preparation

Trước khi Deploy:

1. Kiểm tra Source Code.
2. Kiểm tra Environment Variables.
3. Chạy Linter.
4. Chạy Type Check.
5. Chạy Tests.
6. Build Project.
7. Kiểm tra Prisma Migration.
8. Kiểm tra Database Connection.
9. Kiểm tra Authentication.
10. Kiểm tra Authorization.

## 11.4. Production Database Migration

Migration trên Production cần được thực hiện có kiểm soát.

Lệnh tham khảo:

```bash
npx prisma migrate deploy
```

Không sử dụng `prisma migrate dev` trên Production.

Trước khi chạy Migration:

- Xác nhận đúng Database.
- Kiểm tra Migration Files.
- Đánh giá ảnh hưởng đến dữ liệu hiện có.
- Có phương án Backup hoặc Recovery phù hợp.

## 11.5. Deployment Workflow

Quy trình đề xuất:

```text
Developer
    |
    v
Git Commit
    |
    v
Push to GitHub
    |
    v
Build and Checks
    |
    v
Review and Merge
    |
    v
Deploy to Production
    |
    v
Smoke Testing
```

## 11.6. Post-Deployment Verification

Sau khi Deploy:

- Truy cập Homepage.
- Kiểm tra Login.
- Kiểm tra Database Connection.
- Kiểm tra Dashboard.
- Kiểm tra Project.
- Kiểm tra Task.
- Kiểm tra Notification.
- Kiểm tra các chức năng quan trọng.
- Kiểm tra Error Logs.

---

# 12. Git Workflow

## 12.1. Branch Strategy

Đề xuất:

| Branch | Purpose |
|---|---|
| main | Source Code ổn định |
| develop | Tích hợp tính năng |
| feature/* | Phát triển chức năng |
| fix/* | Sửa lỗi |
| docs/* | Cập nhật tài liệu |

## 12.2. Branch Naming

Ví dụ:

```text
feature/authentication
feature/project-management
feature/task-management
feature/sprint-management

fix/task-review-validation
fix/project-permission

docs/update-database-design
```

## 12.3. Commit Convention

Sử dụng Conventional Commits:

| Prefix | Usage |
|---|---|
| feat | Thêm chức năng |
| fix | Sửa lỗi |
| docs | Cập nhật tài liệu |
| refactor | Refactor Code |
| test | Thêm hoặc cập nhật Test |
| chore | Cấu hình hoặc công việc bảo trì |

Ví dụ:

```bash
git commit -m "feat: add project management"
git commit -m "fix: validate task deadline"
git commit -m "test: add task workflow tests"
git commit -m "docs: update deployment guide"
```

## 12.4. Pull Request Rules

Trước khi Merge:

- Kiểm tra thay đổi.
- Đảm bảo không có Secret.
- Kiểm tra Build.
- Kiểm tra Tests.
- Xem xét ảnh hưởng đến Database.
- Xem xét ảnh hưởng đến Module khác.
- Cập nhật Documentation nếu cần.

---

# 13. Development Guidelines

## 13.1. Coding Standards

- Sử dụng TypeScript.
- Ưu tiên Type Safety.
- Tránh sử dụng `any` nếu không cần thiết.
- Tách Business Logic khỏi UI.
- Tổ chức Code theo Module.
- Đặt tên Function và Variable rõ ràng.
- Không tạo Component quá lớn.
- Không lặp lại Logic không cần thiết.

## 13.2. Server and Client Separation

- Prisma chỉ được sử dụng phía Server.
- Không truy cập Database trực tiếp từ Client Component.
- Không đưa Secret vào Client Bundle.
- Server Components nên gọi Server-side Services trực tiếp.
- Không gọi HTTP đến chính ứng dụng chỉ để thực hiện một thao tác Server-side nội bộ.
- Route Handlers được sử dụng khi cần cung cấp HTTP Interface.

## 13.3. Business Logic

Business Logic cần được đặt tại khu vực Server-side Services hoặc Module phù hợp.

Ví dụ:

- ProjectService.
- TaskService.
- SprintService.
- NotificationService.
- PermissionService.

Các Service cần có trách nhiệm rõ ràng.

## 13.4. Validation

Validation phải được thực hiện ở Server.

Client-side Validation chỉ hỗ trợ trải nghiệm người dùng, không thay thế Server-side Validation.

## 13.5. Authorization

Mọi thao tác bảo vệ dữ liệu cần kiểm tra Permission ở Server.

Không dựa vào việc ẩn Button hoặc Navigation để bảo vệ chức năng.

## 13.6. Error Handling

- Sử dụng Error Handling nhất quán.
- Không trả về Stack Trace cho người dùng.
- Ghi Log các lỗi cần thiết.
- Không ghi Secret hoặc Password vào Log.
- Có thông báo phù hợp cho lỗi nghiệp vụ.

---

# 14. Backup and Recovery

## 14.1. Backup Strategy

Database Backup Strategy: [CHƯA XÁC ĐỊNH].

Cần xác định:

- Backup Frequency.
- Backup Retention.
- Backup Storage.
- Recovery Procedure.

## 14.2. Recovery

Khi xảy ra sự cố dữ liệu:

1. Xác định nguyên nhân.
2. Kiểm tra trạng thái Database.
3. Xác định thời điểm Backup phù hợp.
4. Thực hiện Recovery theo quy trình.
5. Kiểm tra tính toàn vẹn dữ liệu.
6. Kiểm tra các chức năng quan trọng sau Recovery.

Không thực hiện thao tác phục hồi trực tiếp trên Production nếu chưa có phương án và xác nhận phù hợp.

---

# 15. Troubleshooting

| Problem | Possible Cause | Solution |
|---|---|---|
| Cannot install dependencies | Node.js hoặc npm không tương thích | Kiểm tra phiên bản Node.js và package-lock |
| Development Server fails | Port đã được sử dụng | Kiểm tra tiến trình đang sử dụng Port |
| Database Connection Failed | Connection String sai | Kiểm tra DATABASE_URL |
| Prisma Client Error | Client chưa được Generate | Chạy `npx prisma generate` |
| Migration Failed | Schema hoặc Database không hợp lệ | Kiểm tra Migration và Database Logs |
| Build Failed | Type Error hoặc Configuration Error | Kiểm tra Build Logs |
| Authentication Failed | Secret hoặc Session Configuration sai | Kiểm tra Authentication Configuration |
| Email Not Sent | Email Provider chưa cấu hình | Kiểm tra API Key và Provider |
| Deployment Failed | Environment Variables hoặc Build Error | Kiểm tra Deployment Logs |

---

# 16. Open Issues

| ID | Issue | Status |
|---|---|---|
| DEV-001 | Next.js Version | Open |
| DEV-002 | Node.js Version | Open |
| DEV-003 | PostgreSQL Provider | Open |
| DEV-004 | Authentication Library | Đã chốt (`DEC-012`): Auth.js (NextAuth v5) + JWT HTTP-only cookie |
| DEV-005 | Email Provider | Đã chốt (`DEC-016`): Resend (Free Tier API) + tối đa 3 lần retry |
| DEV-006 | Application Hosting Provider | Open |
| DEV-007 | Testing Framework | Open |
| DEV-008 | Production Environment Variables | Open |
| DEV-009 | Database Backup Strategy | Open |
| DEV-010 | CI/CD Configuration | Open |
| DEV-011 | Domain Name | Open |
| DEV-012 | Logging and Monitoring Strategy | Open |

---

# 17. Development and Deployment Checklist

## Development Setup

- [ ] Install Node.js.
- [ ] Install Git.
- [ ] Create Next.js Project.
- [ ] Configure TypeScript.
- [ ] Configure Tailwind CSS.
- [ ] Configure shadcn/ui.
- [ ] Configure Prisma.
- [ ] Connect PostgreSQL.
- [ ] Configure Environment Variables.
- [ ] Initialize Git Repository.

## Database Setup

- [ ] Complete Prisma Schema.
- [ ] Create Initial Migration.
- [ ] Generate Prisma Client.
- [ ] Create Seed Data.
- [ ] Verify Database Connection.

## Application Development

- [ ] Implement Authentication.
- [ ] Implement Authorization.
- [ ] Implement Project Management.
- [ ] Implement Member Management.
- [ ] Implement Task Management.
- [ ] Implement Sprint Management.
- [ ] Implement Kanban.
- [ ] Implement Document Library.
- [ ] Implement Notifications.
- [ ] Implement Dashboard.
- [ ] Implement Reports.

## Testing and Deployment

- [ ] Configure Unit Testing.
- [ ] Configure Integration Testing.
- [ ] Configure E2E Testing.
- [ ] Run Type Check.
- [ ] Run Linter.
- [ ] Run Test Suite.
- [ ] Build Application.
- [ ] Configure Production Database.
- [ ] Configure Production Environment Variables.
- [ ] Deploy Application.
- [ ] Run Smoke Tests.
- [ ] Verify Production Database.

---

# 18. Document Change History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-11-14 | Initial Development and Deployment Guide |

**End of Document**


## Decision Alignment — 2026-11-14

- Project Template optional; `templateId` phải nullable.
- Instructor optional; `instructorId` phải nullable.
- Priority enum thống nhất: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- Estimate dùng số giờ trong MVP.
- Dependency enforcement phải nằm ở Server-side business logic/transaction; không chỉ disable nút trên UI.
- Multiple Active Sprints per Project được phép.
- Sprint completion phải có thao tác Leader quyết định xử lý từng Task chưa hoàn thành; không tự động chuyển Task.
- Project Restore chỉ dành cho Admin; kiểm tra invariant một Project Active.
- Remove Member chỉ thành công sau khi tất cả Task đang giao được reassigned.
- Email Notification là bắt buộc trong MVP; cấu hình Provider qua Environment Variables.


## Confirmed Implementation Rules — 2026-11-14

- `Project.templateId` và `Project.instructorId` nullable. Không validate bắt buộc hai trường này.
- Task Priority Enum chỉ gồm `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- Task Estimate là số giờ; không triển khai Story Points trong MVP.
- Khi đổi Task sang `DONE`, kiểm tra tất cả predecessor đều `DONE`; kiểm tra ở Server/Application Service, không chỉ ở UI.
- Cho phép nhiều Sprint `ACTIVE` trong cùng Project.
- Khi kết thúc Sprint, Leader xử lý từng Task chưa hoàn thành; cập nhật Sprint Assignment History.
- Restore Project chỉ cho Admin và phải kiểm tra single Active Project bằng transaction/constraint phù hợp.
- Trước khi Remove Project Member, phải đảm bảo không còn Task được giao cho thành viên đó; yêu cầu Leader reassign trước.
- Email Notification phải hoạt động trong MVP. Lưu trạng thái Delivery, lỗi gửi và thời điểm gửi; retry phải có tính idempotent.
