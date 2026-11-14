# PROJECT IMPLEMENTATION ROADMAP
# AKATSUKI YUI

**Project:** Akatsuki Yui  
**Document Type:** Project Implementation Roadmap  
**Version:** 1.0  
**Status:** Proposed  
**Architecture:** Modular Monolith  
**Backend:** Next.js Fullstack  
**Database:** PostgreSQL + Prisma ORM

---

# 1. INTRODUCTION

## 1.1. Purpose

Tài liệu này mô tả lộ trình triển khai dự án Akatsuki Yui từ giai đoạn chuẩn bị, xây dựng nền tảng, phát triển các module nghiệp vụ, kiểm thử cho đến triển khai và hoàn thành MVP.

Mục tiêu của tài liệu:

- Xác định thứ tự triển khai các module.
- Chia dự án thành các Sprint có mục tiêu rõ ràng.
- Xác định phạm vi công việc của từng Sprint.
- Xác định Deliverables và Acceptance Criteria.
- Theo dõi tiến độ phát triển tổng thể.
- Hạn chế việc triển khai sai thứ tự hoặc bỏ sót chức năng.
- Làm cơ sở để tạo Sprint Backlog và giao nhiệm vụ cho Coding Agent.

## 1.2. Development Approach

Dự án sử dụng mô hình Sprint chính thức.

Mỗi Sprint phải có:

- Sprint Goal.
- Sprint Scope.
- Sprint Backlog.
- Dependencies.
- Deliverables.
- Acceptance Criteria.
- Testing Requirements.
- Sprint Review.
- Sprint Retrospective.

Không chuyển sang Sprint tiếp theo chỉ vì Agent thông báo đã hoàn thành code. Phải kiểm tra Acceptance Criteria của Sprint hiện tại.

## 1.3. Project Technology Stack

| Category | Technology |
|---|---|
| Frontend | Next.js App Router |
| Backend | Next.js Fullstack |
| Language | TypeScript |
| UI Library | React |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | Auth.js v5 + JWT |
| Validation | Zod |
| Form Management | React Hook Form |
| Charts | Recharts |
| Email Provider | Resend |
| Architecture | Modular Monolith |

---

# 2. PROJECT DEVELOPMENT OVERVIEW

Dự án được chia thành một giai đoạn chuẩn bị và tám Sprint.

| Phase | Name | Main Objective |
|---|---|---|
| Preparation | Project Readiness | Hoàn thiện tài liệu và môi trường |
| Sprint 0 | Foundation | Xây dựng nền tảng kỹ thuật |
| Sprint 1 | Authentication & Account | Xác thực và quản lý tài khoản |
| Sprint 2 | Authorization & Project | Phân quyền và quản lý Project |
| Sprint 3 | Task Management | Quản lý công việc |
| Sprint 4 | Sprint Management | Backlog, Sprint Planning và Kanban |
| Sprint 5 | Documents & Notifications | Tài liệu và thông báo |
| Sprint 6 | Dashboard & Reports | Dashboard và báo cáo |
| Sprint 7 | Finalization & Deployment | Kiểm thử và triển khai |

---

# 3. PREPARATION – PROJECT READINESS

## 3.1. Objective

Chuẩn bị đầy đủ tài liệu, môi trường và công cụ cần thiết trước khi bắt đầu triển khai.

## 3.2. Tasks

| ID | Task | Description |
|---|---|---|
| PRE-001 | Documentation Review | Kiểm tra toàn bộ tài liệu dự án |
| PRE-002 | Documentation Audit | Thực hiện Documentation Audit |
| PRE-003 | Decision Confirmation | Xác nhận các quyết định trong DECISION-LOG |
| PRE-004 | Repository Setup | Tạo và cấu hình GitHub Repository |
| PRE-005 | Development Environment | Chuẩn bị môi trường phát triển |
| PRE-006 | Database Preparation | Chuẩn bị PostgreSQL |
| PRE-007 | Environment Configuration | Chuẩn bị Environment Variables |
| PRE-008 | Git Workflow | Xác định quy tắc Branch và Commit |
| PRE-009 | Sprint Backlog | Chuẩn bị Sprint Backlog |

## 3.3. Deliverables

- Documentation Package đã được kiểm tra.
- Documentation Audit Report.
- GitHub Repository.
- Development Environment.
- PostgreSQL Database.
- `.env.example`.
- Git Workflow Guidelines.
- Initial Sprint Backlog.

## 3.4. Acceptance Criteria

- [ ] Documentation Audit đã hoàn thành.
- [ ] Các quyết định ảnh hưởng đến Sprint 0 và Sprint 1 đã được xác nhận.
- [ ] Repository đã được tạo.
- [ ] Local Development Environment hoạt động.
- [ ] PostgreSQL có thể kết nối.
- [ ] Environment Variables được cấu hình.
- [ ] Sprint Backlog ban đầu đã được tạo.

---

# 4. SPRINT 0 – FOUNDATION

## 4.1. Sprint Goal

Xây dựng nền tảng kỹ thuật của ứng dụng, bao gồm cấu trúc dự án, kiến trúc Modular Monolith, Database Foundation và UI Foundation.

Sprint 0 tạo điều kiện để các module nghiệp vụ tiếp theo được triển khai độc lập và nhất quán.

## 4.2. Scope

### Module 1 – Project Initialization

- Khởi tạo Next.js App Router.
- Cấu hình TypeScript.
- Cấu hình Tailwind CSS.
- Cài đặt và cấu hình shadcn/ui.
- Cấu hình ESLint.
- Cấu hình Prettier nếu được sử dụng.
- Environment Configuration.

### Module 2 – Architecture Foundation

- Thiết lập cấu trúc Modular Monolith.
- Tạo Module Structure.
- Tạo Service Layer.
- Tạo Repository Layer.
- Tạo Shared Components.
- Tạo Shared Types.
- Tạo Shared Validation.
- Tạo Common Utilities.

### Module 3 – Database Foundation

- Cấu hình PostgreSQL.
- Cài đặt Prisma ORM.
- Thiết lập Prisma Schema.
- Tạo Initial Migration.
- Thiết lập Database Seed.
- Kiểm tra Database Connection.

### Module 4 – UI Foundation

- Global Layout.
- Typography.
- Color System.
- Button.
- Input.
- Dialog.
- Dropdown.
- Table.
- Sidebar.
- Header.
- Toast.
- Loading State.
- Empty State.
- Error State.

### Module 5 – Error Handling Foundation

- Error Handling.
- API Error Response.
- Logging Foundation.
- Error Boundary phù hợp.
- Not Found Page.

## 4.3. Deliverables

- Next.js Application Foundation.
- Modular Monolith Structure.
- PostgreSQL Connection.
- Prisma Configuration.
- Initial Database Migration.
- UI Component Foundation.
- Development README.

## 4.4. Acceptance Criteria

- [ ] Next.js Application chạy được.
- [ ] TypeScript Configuration hợp lệ.
- [ ] PostgreSQL Connection hoạt động.
- [ ] Prisma Validation thành công.
- [ ] Initial Migration thành công.
- [ ] Database Seed hoạt động.
- [ ] UI Foundation được thiết lập.
- [ ] Production Build thành công.

---

# 5. SPRINT 1 – AUTHENTICATION & ACCOUNT MANAGEMENT

## 5.1. Sprint Goal

Xây dựng hệ thống Authentication và Account Management cơ bản, cho phép người dùng đăng ký, đăng nhập và quản lý tài khoản theo trạng thái được Admin phê duyệt.

## 5.2. Scope

### Module 1 – Authentication

- User Registration.
- User Login.
- User Logout.
- Auth.js v5 Integration.
- JWT Session.
- Password Hashing.
- Authentication Validation.
- Session Handling.

### Module 2 – Account Management

- View User List.
- View User Details.
- View Pending Accounts.
- Approve Account.
- Reject Account.
- Suspend Account nếu thuộc phạm vi Sprint.
- Activate Account nếu thuộc phạm vi Sprint.
- Assign Role cơ bản.

### Module 3 – User Profile

- View Profile.
- Update `fullName`.
- Change Password.

### Module 4 – Authentication UI

- Login Page.
- Register Page.
- Pending Approval Page.
- Account Status Page.
- Admin Account Management UI.
- Profile Page.
- Change Password Form.

## 5.3. Business Rules

- Người dùng có thể tự đăng ký.
- Không yêu cầu Email Verification khi đăng ký.
- Tài khoản mới có trạng thái `PENDING`.
- Admin phải phê duyệt trước khi tài khoản được sử dụng.
- Tài khoản `REJECTED` và `SUSPENDED` không được đăng nhập thành công.
- Authentication sử dụng Auth.js v5 + JWT.
- Password phải có ít nhất 8 ký tự và đáp ứng đủ 4 loại ký tự theo DEC-013.
- Profile cho phép cập nhật `fullName` và đổi Password theo DEC-018.

## 5.4. Deliverables

- Authentication Module.
- Account Management Module.
- Profile Management.
- Authenticated Layout.
- Authentication API.
- Authentication Test Cases.

## 5.5. Acceptance Criteria

- [ ] Registration hoạt động.
- [ ] Login và Logout hoạt động.
- [ ] Password Policy được kiểm tra ở Server-side.
- [ ] Password được Hash trước khi lưu.
- [ ] Account mới có trạng thái `PENDING`.
- [ ] Admin có thể Approve/Reject Account.
- [ ] Account Status được kiểm tra khi đăng nhập.
- [ ] JWT Session hoạt động.
- [ ] Profile Update hoạt động.
- [ ] Change Password hoạt động.
- [ ] Server-side Authentication được bảo vệ.
- [ ] Các Authentication Test Cases đã được thực thi.

---

# 6. SPRINT 2 – AUTHORIZATION & PROJECT MANAGEMENT

## 6.1. Sprint Goal

Xây dựng hệ thống phân quyền và quản lý Project, tạo nền tảng để các thành viên tham gia thực hiện công việc trong Project.

## 6.2. Scope

### Module 1 – Authorization / RBAC

- Role Management.
- Permission Management.
- Role-Permission Mapping.
- Permission Assignment.
- Permission Revocation.
- System-level Permission.
- Project-level Permission.
- Server-side Authorization.
- Permission Audit History.

### Module 2 – Project Management

- Create Project.
- Update Project.
- View Project.
- View Project Details.
- Assign Project Leader.
- Assign Instructor.
- Manage Project Members.
- Project Technologies.
- Repository URL.
- Objectives and Scope.
- Archive Project.
- Restore Project.

### Module 3 – Project UI

- Project List.
- Project Overview.
- Create Project Form.
- Edit Project Form.
- Project Detail.
- Project Member Management.
- Archived Project List.
- Restore Project Dialog.

## 6.3. Business Rules

- Hệ thống có bốn Role: Admin, Instructor, Leader, Member.
- Project Template là Optional.
- Instructor là Optional.
- Leader tạo Project sẽ tự động trở thành Project Leader.
- Chỉ có một Project `ACTIVE` tại một thời điểm.
- Project đã Archive vẫn phải bảo toàn dữ liệu và lịch sử.
- Admin có thể Restore Archived Project.
- Leader phải reassignment các Task đang giao trước khi xóa Member khỏi Project.
- Assignment History phải được giữ lại.

## 6.4. Deliverables

- Authorization Module.
- Permission Matrix.
- Project Management Module.
- Project Member Management.
- Archive/Restore Workflow.
- Project UI.
- Project API.
- Authorization Tests.

## 6.5. Acceptance Criteria

- [ ] Role và Permission hoạt động đúng.
- [ ] Server-side Authorization hoạt động.
- [ ] Project CRUD hoạt động.
- [ ] Project Member Management hoạt động.
- [ ] Chỉ có một Active Project tại một thời điểm.
- [ ] Archive Project hoạt động.
- [ ] Restore Project hoạt động.
- [ ] Unauthorized Access bị chặn.
- [ ] Member Removal tuân thủ quy tắc Reassignment.

---

# 7. SPRINT 3 – TASK MANAGEMENT

## 7.1. Sprint Goal

Xây dựng hệ thống quản lý Task, phân công công việc, theo dõi tiến độ và xử lý quy trình Review.

## 7.2. Scope

### Module 1 – Task Management

- Create Task.
- Update Task.
- View Task.
- View Task Details.
- Delete/Cancel Task theo Business Rules.
- Task Priority.
- Task Estimate.
- Start Date.
- Deadline.
- Reference Links.
- Progress Notes.

### Module 2 – Task Assignment

- Assign Member.
- Multiple Assignees.
- Unassigned Task.
- Reassign Task.
- Assignment History.

### Module 3 – Task Dependency

- Create Dependency.
- Remove Dependency.
- View Predecessor.
- View Successor.
- Dependency Validation.
- Completion Dependency Check.

### Module 4 – Task Workflow

- TODO.
- IN PROGRESS.
- REVIEW.
- DONE.

Các chức năng:

- Start Task.
- Update Task Status.
- Submit for Review.
- Approve Review.
- Reject Review.
- Record Completion Reason.
- Record Rejection Reason.

### Module 5 – Task History

- Status History.
- Assignment History.
- Review History.
- Task Activity.

### Module 6 – Task UI

- Task List.
- Task Detail.
- Create Task Form.
- Edit Task Form.
- Assignment Selector.
- Task Dependency View.
- Review Dialog.
- Task History View.

## 7.3. Business Rules

- Task có thể có nhiều Assignees.
- Assignees không bắt buộc khi tạo Task.
- Task chưa có Assignee vẫn có thể tồn tại.
- Estimate sử dụng đơn vị giờ.
- Priority gồm LOW, MEDIUM, HIGH, CRITICAL.
- Deadline bắt buộc.
- Start Date tùy chọn.
- Task Dependency chặn hoàn thành Task khi Predecessor chưa DONE.
- Member được sửa Status, Reference Links và Progress Notes theo DEC-015.
- Leader phải nhập Reason khi Approve hoặc Reject Review.
- Review Decision phải được lưu trong Task History.

## 7.4. Deliverables

- Task Management Module.
- Assignment Module.
- Dependency Module.
- Review Workflow.
- Task History.
- Task UI.
- Task API.
- Task Tests.

## 7.5. Acceptance Criteria

- [ ] Task CRUD hoạt động.
- [ ] Multiple Assignees hoạt động.
- [ ] Unassigned Task hoạt động.
- [ ] Assignment History được lưu.
- [ ] Task Dependency hoạt động.
- [ ] Task Status Lifecycle hoạt động.
- [ ] Review Workflow hoạt động.
- [ ] Approval/Rejection Reason được lưu.
- [ ] Notification Events được phát sinh đúng theo nghiệp vụ.
- [ ] Authorization được kiểm tra cho từng thao tác.

---

# 8. SPRINT 4 – SPRINT MANAGEMENT, BACKLOG & KANBAN

## 8.1. Sprint Goal

Xây dựng hệ thống quản lý Sprint, lập kế hoạch công việc và theo dõi tiến độ thông qua Kanban Board.

## 8.2. Scope

### Module 1 – Sprint Management

- Create Sprint.
- Update Sprint.
- View Sprint.
- Sprint Goal.
- Start Date.
- End Date.
- Sprint Status.
- Complete Sprint.

### Module 2 – Backlog Management

- View Project Backlog.
- View Backlog Tasks.
- Add Task to Sprint.
- Remove Task from Sprint.
- Move Task between Sprints.
- Filter Backlog.

### Module 3 – Sprint Planning

- Select Tasks.
- Assign Tasks to Sprint.
- Set Sprint Goal.
- Validate Sprint Dates.
- Confirm Sprint Planning.

### Module 4 – Kanban Board

- TODO Column.
- IN PROGRESS Column.
- REVIEW Column.
- DONE Column.
- Task Filtering.
- Task Search.
- Task Detail.
- Drag and Drop nếu phù hợp với UI/UX Design.

### Module 5 – Sprint Completion

- View Unfinished Tasks.
- Select Disposition for Unfinished Tasks.
- Complete Sprint.
- Record Sprint Completion.

## 8.3. Business Rules

- Project có thể có nhiều Active Sprint.
- Task thuộc Backlog hoặc một Sprint.
- Một Task chỉ thuộc tối đa một Sprint tại một thời điểm.
- Sprint Planning chuyển Task từ Backlog vào Sprint.
- Khi Sprint kết thúc, Leader quyết định xử lý từng Task chưa hoàn thành.
- Không tự động chuyển Task chưa hoàn thành sang Sprint khác.

## 8.4. Deliverables

- Sprint Management Module.
- Backlog Management.
- Sprint Planning.
- Kanban Board.
- Sprint Overview.
- Complete Sprint Workflow.
- Sprint API.
- Sprint Tests.

## 8.5. Acceptance Criteria

- [ ] Sprint CRUD hoạt động.
- [ ] Multiple Active Sprints hoạt động.
- [ ] Backlog hoạt động.
- [ ] Sprint Planning hoạt động.
- [ ] Task chỉ thuộc tối đa một Sprint tại một thời điểm.
- [ ] Kanban Board hoạt động.
- [ ] Filtering hoạt động.
- [ ] Complete Sprint hoạt động.
- [ ] Unfinished Task Disposition được lưu.

---

# 9. SPRINT 5 – DOCUMENT LIBRARY & NOTIFICATIONS

## 9.1. Sprint Goal

Xây dựng Document Library và hệ thống Notification để hỗ trợ chia sẻ tài liệu và cập nhật hoạt động trong nhóm.

## 9.2. Scope

### Module 1 – Document Library

- Add Document.
- Update Document Record.
- Delete Document Record.
- View Documents.
- Google Drive URL.
- Document Category.
- Link Document to Project.
- Optional Sprint Association.
- Open Document in New Tab.

### Module 2 – In-app Notification

- Create Notification.
- Notification Center.
- Read Notification.
- Unread Notification.
- Mark as Read.
- Notification History.

### Module 3 – Email Notification

- Resend Integration.
- Email Configuration.
- Email Templates.
- Email Sending.
- Email Error Handling.

### Module 4 – Notification Delivery

- Notification Delivery History.
- Delivery Status.
- Retry Count.
- Retry Policy.
- Error Information.

## 9.3. Business Rules

Document Categories:

- Project Documents.
- Design.
- Development.
- Meeting & Reports.
- Other.

Document Library chỉ lưu Google Drive URLs, không triển khai File Upload trong MVP.

Email Notification là yêu cầu bắt buộc trong MVP.

Email Provider: Resend.

Retry tối đa 3 lần theo DEC-016.

Notification phải được gửi theo đúng các sự kiện nghiệp vụ đã xác định.

## 9.4. Deliverables

- Document Library Module.
- Notification Module.
- Notification Center.
- Resend Integration.
- Email Templates.
- Notification Delivery History.
- Document and Notification Tests.

## 9.5. Acceptance Criteria

- [ ] Document CRUD hoạt động.
- [ ] Google Drive URL được lưu và mở đúng.
- [ ] Document Category hoạt động.
- [ ] Project/Sprint Association hoạt động.
- [ ] In-app Notification hoạt động.
- [ ] Read/Unread hoạt động.
- [ ] Email Notification hoạt động.
- [ ] Delivery History được lưu.
- [ ] Retry không vượt quá 3 lần.
- [ ] Không gửi trùng Notification khi xử lý lại cùng một sự kiện.

---

# 10. SPRINT 6 – DASHBOARD, REPORTS & ACTIVITY LOG

## 10.1. Sprint Goal

Xây dựng Dashboard và các báo cáo nhằm giúp Leader, Instructor và Member theo dõi tình hình Project, Sprint và công việc.

## 10.2. Scope

### Module 1 – Project Dashboard

- Total Tasks.
- Completed Tasks.
- Overdue Tasks.
- Tasks Waiting for Review.
- Member Progress.
- Recent Activity.

### Module 2 – Progress Calculation

- Project Progress.
- Sprint Progress.
- Task Completion Statistics.
- Progress Aggregation.

### Module 3 – Sprint Reports

- Sprint Progress.
- Burndown Chart.
- Sprint Task Statistics.
- Remaining Work.

### Module 4 – Member Reports

- Assigned Tasks.
- Completed Tasks.
- Overdue Tasks.
- Review Results.
- Task History.
- Contribution Statistics.

### Module 5 – Activity Log

- Project Activities.
- Task Activities.
- Member Activities.
- Assignment Changes.
- Review Actions.
- Permission Changes.

## 10.3. Business Rules

Theo DEC-017:

- Project Progress và Sprint Progress dựa trên Task Count.
- Burndown Chart sử dụng Estimate Hours.
- Các công thức phải được áp dụng nhất quán.
- Contribution Reports phải dựa trên dữ liệu thực tế.
- Không đánh giá chất lượng thành viên chỉ dựa trên số lượng Task.

## 10.4. Deliverables

- Project Dashboard.
- Sprint Dashboard.
- Burndown Chart.
- Member Progress Report.
- Activity Log.
- Reporting API.
- Reporting Tests.

## 10.5. Acceptance Criteria

- [ ] Dashboard hiển thị đúng dữ liệu.
- [ ] Project Progress được tính đúng.
- [ ] Sprint Progress được tính đúng.
- [ ] Burndown Chart sử dụng Estimate Hours.
- [ ] Activity Log được lưu.
- [ ] Báo cáo tuân thủ Authorization.
- [ ] Không hiển thị dữ liệu ngoài quyền truy cập.

---

# 11. SPRINT 7 – FINALIZATION, TESTING & DEPLOYMENT

## 11.1. Sprint Goal

Hoàn thiện toàn bộ hệ thống, kiểm thử tích hợp, sửa lỗi, triển khai và chuẩn bị bàn giao cho nhóm sử dụng.

## 11.2. Scope

### Module 1 – Integration Testing

Kiểm thử các Workflow:

1. Register → Admin Approval → Login.
2. Admin → Role Assignment → Authorization.
3. Create Project → Add Members.
4. Create Task → Assign Members.
5. Task Dependency → Complete Task.
6. Task → Review → Approve/Reject.
7. Create Sprint → Sprint Planning → Kanban.
8. Complete Sprint → Handle Unfinished Tasks.
9. Add Google Drive Document → Open Document.
10. Trigger Notification → Email Delivery.
11. Dashboard → Progress and Reports.
12. Archive Project → Restore Project.

### Module 2 – Regression Testing

- Kiểm tra lại chức năng đã hoàn thành.
- Kiểm tra các Workflow bị ảnh hưởng khi sửa lỗi.
- Kiểm tra Permission Matrix.
- Kiểm tra Account Status.
- Kiểm tra Data Integrity.
- Kiểm tra các trường hợp lỗi.

### Module 3 – Security Review

- Authentication.
- Authorization.
- Password Hashing.
- Session Handling.
- Environment Secrets.
- Input Validation.
- API Access.
- Database Constraints.
- Unauthorized Access.
- Role Escalation.

### Module 4 – Performance & UX

- Kiểm tra Database Queries.
- Kiểm tra Pagination.
- Kiểm tra các trang có lượng dữ liệu lớn.
- Kiểm tra Responsive.
- Kiểm tra Loading/Error/Empty States.
- Tối ưu các truy vấn có vấn đề thực tế.

### Module 5 – Deployment

- Production Environment.
- PostgreSQL Production.
- Environment Variables.
- Production Database Migration.
- Production Build.
- Deployment.
- Smoke Testing.
- Email Provider Verification.
- Authentication Verification trên Domain thực tế.

### Module 6 – Documentation & Handover

- README.
- Installation Guide.
- Deployment Guide.
- Environment Configuration Guide.
- Database Migration Guide.
- User Guide.
- Admin Guide.
- Known Issues.
- Final Test Report.
- Project Completion Report.

## 11.3. Deliverables

- Integration Test Report.
- Regression Test Report.
- Security Review Report.
- Production Deployment.
- User Guide.
- Admin Guide.
- Final Project Documentation.
- Project Completion Report.

## 11.4. Acceptance Criteria

- [ ] Các Workflow quan trọng hoạt động.
- [ ] Không còn lỗi Critical/High chưa xử lý.
- [ ] Các Test Cases quan trọng đã chạy.
- [ ] Production Build thành công.
- [ ] Production Deployment thành công.
- [ ] Smoke Test thành công.
- [ ] Database Production hoạt động.
- [ ] Email Notification hoạt động.
- [ ] Authentication hoạt động trên môi trường triển khai.
- [ ] Tài liệu hướng dẫn đầy đủ.
- [ ] Nhóm có thể sử dụng hệ thống.

---

# 12. SPRINT EXECUTION WORKFLOW

Mỗi Sprint phải tuân theo quy trình sau:

## Step 1 – Sprint Planning

- Xác định Sprint Goal.
- Xác định Sprint Scope.
- Tạo Sprint Backlog.
- Xác định Dependencies.
- Xác định Acceptance Criteria.

## Step 2 – Documentation Review

- Đọc các tài liệu liên quan.
- Đối chiếu Business Rules.
- Kiểm tra các quyết định trong DECISION-LOG.
- Xác định các vấn đề chưa được quyết định.

## Step 3 – Implementation Planning

Tạo Implementation Plan bao gồm:

- Tasks.
- Expected Files.
- Database Changes.
- API Changes.
- UI Changes.
- Dependencies.
- Test Plan.

## Step 4 – Development

- Triển khai theo từng nhóm chức năng.
- Không sửa các module không liên quan.
- Không thay đổi Business Rules khi chưa được xác nhận.
- Kiểm tra code sau mỗi nhóm chức năng.

## Step 5 – Testing

- Unit Testing.
- Integration Testing.
- Validation Testing.
- Authorization Testing.
- Regression Testing khi cần thiết.

## Step 6 – Sprint Review

- Demo các chức năng.
- Đối chiếu Acceptance Criteria.
- Kiểm tra các Workflow.
- Ghi nhận chức năng chưa hoàn thành.

## Step 7 – Sprint Audit

Kiểm tra:

- Code Quality.
- Architecture.
- Database.
- API.
- Authorization.
- UI/UX.
- Business Rules.
- Testing Coverage.
- Documentation Consistency.

## Step 8 – Sprint Retrospective

- Những gì đã hoàn thành.
- Những vấn đề gặp phải.
- Những lỗi cần khắc phục.
- Technical Debt.
- Cải tiến cho Sprint tiếp theo.

## Step 9 – Sprint Closure

- Cập nhật Sprint Backlog.
- Cập nhật Documentation.
- Cập nhật Test Results.
- Tạo Sprint Report.
- Xác nhận Sprint Completion.

---

# 13. PROJECT MILESTONES

| Milestone ID | Milestone | Completion Point |
|---|---|---|
| M0 | Project Ready | Preparation Completed |
| M1 | Foundation Ready | Sprint 0 Completed |
| M2 | Account Ready | Sprint 1 Completed |
| M3 | Project Ready | Sprint 2 Completed |
| M4 | Task Ready | Sprint 3 Completed |
| M5 | Planning Ready | Sprint 4 Completed |
| M6 | Collaboration Ready | Sprint 5 Completed |
| M7 | Reporting Ready | Sprint 6 Completed |
| M8 | MVP Complete | Sprint 7 Completed |

---

# 14. ESTIMATED PROJECT TIMELINE

Thời gian dưới đây chỉ là ước lượng tham khảo, không phải Deadline chính thức.

| Phase | Estimated Duration |
|---|---|
| Preparation | 2–4 days |
| Sprint 0 | 4–7 days |
| Sprint 1 | 5–8 days |
| Sprint 2 | 5–8 days |
| Sprint 3 | 7–10 days |
| Sprint 4 | 5–8 days |
| Sprint 5 | 5–8 days |
| Sprint 6 | 4–7 days |
| Sprint 7 | 5–8 days |

**Estimated Total Duration: 42–68 working days.**

Thời gian thực tế phụ thuộc vào:
- Số lượng thành viên phát triển.
- Thời gian dành cho dự án mỗi ngày.
- Mức độ hoàn thiện của tài liệu.
- Khối lượng sửa lỗi.
- Các quyết định phát sinh.
- Khả năng tích hợp giữa các module.

---

# 15. MVP COMPLETION CRITERIA

Akatsuki Yui được xem là hoàn thành MVP khi đáp ứng đầy đủ các nhóm yêu cầu:

| Category | Completion Criteria |
|---|---|
| Authentication | Register, Login, Logout, Account Approval |
| Authorization | Role, Permission, Server-side Authorization |
| Project | Project CRUD, Members, Archive, Restore |
| Task | Task CRUD, Assignment, Dependency, Review, History |
| Sprint | Backlog, Sprint Planning, Kanban, Complete Sprint |
| Documents | Google Drive Document Library |
| Notifications | In-app Notification, Email Notification |
| Dashboard | Project Dashboard, Sprint Progress, Burndown |
| Testing | Integration Testing, Regression Testing |
| Deployment | Production Deployment |
| Documentation | Installation, Deployment, User and Admin Guides |

## 15.1. Final Completion Conditions

- Tất cả chức năng MVP đã triển khai.
- Các Business Rules quan trọng được áp dụng.
- Các quyền truy cập được kiểm tra ở Server-side.
- Các Workflow chính đã được kiểm thử.
- Không còn lỗi Critical/High chưa xử lý.
- Production Build thành công.
- Production Deployment thành công.
- Nhóm có thể sử dụng hệ thống.
- Tài liệu hướng dẫn đã hoàn thiện.

---

# 16. PROJECT GOVERNANCE

## 16.1. Scope Control

Mọi chức năng mới ngoài MVP phải được đánh giá trước khi bổ sung.

Không tự ý mở rộng Scope trong lúc triển khai Sprint nếu chưa đánh giá ảnh hưởng đến:

- Deadline.
- Sprint Goal.
- Database.
- API.
- Architecture.
- Testing.

## 16.2. Decision Management

Các quyết định nghiệp vụ và kỹ thuật quan trọng phải được ghi nhận trong DECISION-LOG.

Coding Agent không được tự ý thay đổi các quyết định đã xác nhận.

## 16.3. Documentation Maintenance

Sau mỗi Sprint:

- Cập nhật các tài liệu bị ảnh hưởng.
- Cập nhật DOCUMENT-INVENTORY nếu có tài liệu mới.
- Cập nhật DECISION-LOG nếu có quyết định được phê duyệt.
- Cập nhật Testing Strategy.
- Ghi nhận các vấn đề chưa giải quyết.

## 16.4. Sprint Completion Policy

Một Sprint chỉ được xem là hoàn thành khi:

- Các công việc trong Scope đã được xử lý.
- Acceptance Criteria được kiểm tra.
- Test Results được ghi nhận.
- Các lỗi còn tồn tại được phân loại.
- Sprint Report được tạo.
- Project Owner chấp nhận kết quả Sprint.

---

# 17. FINAL PROJECT ROADMAP

Lộ trình tổng thể:

```text
PREPARATION
    |
    v
SPRINT 0 – FOUNDATION
    |
    v
SPRINT 1 – AUTHENTICATION & ACCOUNT
    |
    v
SPRINT 2 – AUTHORIZATION & PROJECT
    |
    v
SPRINT 3 – TASK MANAGEMENT
    |
    v
SPRINT 4 – SPRINT MANAGEMENT
    |
    v
SPRINT 5 – DOCUMENTS & NOTIFICATIONS
    |
    v
SPRINT 6 – DASHBOARD & REPORTS
    |
    v
SPRINT 7 – FINALIZATION & DEPLOYMENT
    |
    v
MVP COMPLETE
```

**End of Project Implementation Roadmap.**