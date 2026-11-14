# TEST PLAN AND TEST CASES
## Akatsuki Yui – Team & Project Management System

**Document Version:** 1.0  
**Document Status:** Draft  
**Project Name:** Akatsuki Yui  
**Document Type:** Test Plan and Test Cases

---

# 1. Introduction

## 1.1. Purpose

Tài liệu này xác định chiến lược, phạm vi, phương pháp và các trường hợp kiểm thử cho hệ thống Akatsuki Yui.

Mục tiêu là đảm bảo hệ thống hoạt động đúng theo Software Requirements Specification (SRS), Business Rules và Use Case Specification.

Tài liệu được sử dụng làm cơ sở để:

- Kiểm tra tính chính xác của chức năng.
- Phát hiện lỗi trong quá trình phát triển.
- Kiểm tra Business Rules.
- Kiểm tra Authentication và Authorization.
- Đảm bảo dữ liệu được xử lý chính xác.
- Xác nhận các chức năng đáp ứng yêu cầu trước khi triển khai.

## 1.2. Testing Objectives

Các mục tiêu kiểm thử:

- Đảm bảo các chức năng hoạt động đúng theo yêu cầu.
- Đảm bảo dữ liệu đầu vào được Validate chính xác.
- Đảm bảo các Business Rules được thực thi nhất quán.
- Đảm bảo người dùng chỉ truy cập được chức năng phù hợp với Permission.
- Đảm bảo các luồng nghiệp vụ không tạo ra dữ liệu không hợp lệ.
- Đảm bảo các thao tác quan trọng được ghi nhận trong Activity History.
- Đảm bảo giao diện hiển thị dữ liệu và trạng thái chính xác.
- Đảm bảo hệ thống xử lý lỗi phù hợp.

## 1.3. Testing Scope

### In Scope

- Authentication.
- Account Management.
- Role and Permission Management.
- Project Management.
- Member Management.
- Task Management.
- Task Workflow.
- Sprint Management.
- Backlog Management.
- Kanban Board.
- Document Library.
- Notification Center.
- Dashboard.
- Reports.
- Activity Logs.
- Form Validation.
- Authorization.
- Database Integrity.
- Responsive UI ở mức cơ bản.

### Out of Scope

- Kiểm thử GitHub API Integration vì không thuộc MVP.
- Kiểm thử Native Mobile Application.
- Kiểm thử hệ thống Chat Realtime.
- Kiểm thử Payment Gateway.
- Kiểm thử AI Features.
- Kiểm thử tải quy mô lớn như hệ thống SaaS công cộng.
- Kiểm thử các chức năng chưa nằm trong phạm vi MVP.

---

# 2. Testing Strategy

## 2.1. Testing Levels

| Testing Level | Description |
| --- | --- |
| Unit Testing | Kiểm tra từng Function, Service và Business Logic độc lập |
| Integration Testing | Kiểm tra sự phối hợp giữa các Module và Database |
| Functional Testing | Kiểm tra chức năng theo SRS và Use Case |
| Authorization Testing | Kiểm tra quyền truy cập theo Role và Permission |
| UI Testing | Kiểm tra giao diện và hành vi tương tác |
| Acceptance Testing | Xác nhận hệ thống đáp ứng yêu cầu sử dụng |

## 2.2. Testing Types

### Functional Testing

Kiểm tra chức năng có hoạt động đúng với yêu cầu hay không.

Ví dụ:

- Đăng ký tài khoản.
- Đăng nhập.
- Tạo Project.
- Tạo Task.
- Phân công Task.
- Tạo Sprint.
- Chuyển Task sang Review.
- Approve hoặc Reject Task.

### Validation Testing

Kiểm tra dữ liệu đầu vào.

Ví dụ:

- Email không hợp lệ.
- Password không đáp ứng chính sách.
- Deadline nhỏ hơn Start Date.
- Project Name bị bỏ trống.
- Google Drive URL không hợp lệ.
- Sprint Date không hợp lệ.

### Authorization Testing

Kiểm tra quyền của từng Role.

Ví dụ:

- Member không được tạo hoặc chỉnh sửa Project nếu không có Permission.
- Instructor chỉ được thực hiện các thao tác được cấp.
- Leader có thể quản lý Task trong Project theo quyền.
- Người không thuộc Project không được truy cập dữ liệu nội bộ của Project.

### Integration Testing

Kiểm tra các Module phối hợp.

Ví dụ:

- Tạo Task và gửi Notification cho Assignees.
- Member Submit Task for Review và Leader nhận Notification.
- Leader xử lý Review và Assignees nhận kết quả.
- Thay đổi Task Status và cập nhật Dashboard.
- Tạo Sprint và cập nhật Task Assignment.

### Regression Testing

Kiểm tra lại các chức năng đã hoạt động sau khi có thay đổi code.

Ví dụ:

- Thay đổi Task Workflow không làm lỗi Kanban.
- Thay đổi Database Schema không làm lỗi Dashboard.
- Thay đổi Permission không làm ảnh hưởng chức năng của Role khác.

---

# 3. Test Environment

## 3.1. Hardware Environment

Môi trường kiểm thử sử dụng máy tính cá nhân đáp ứng yêu cầu chạy Next.js và Database.

Cấu hình phần cứng cụ thể: **[CHƯA XÁC ĐỊNH]**.

## 3.2. Software Environment

| Component | Technology |
| --- | --- |
| Operating System | Windows / Linux / macOS |
| Runtime | Node.js |
| Framework | Next.js |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Browser | Chrome, Firefox, Edge |
| Testing Framework | Vitest hoặc Jest |
| UI Testing | Playwright |
| API Testing | Postman hoặc công cụ tương đương |

Các công nghệ kiểm thử trên là đề xuất và cần được xác nhận trong quá trình thiết lập dự án.

## 3.3. Test Database

- Sử dụng Database riêng cho Testing.
- Không chạy Test có khả năng thay đổi dữ liệu trên Production Database.
- Có thể sử dụng Seed Data để tạo dữ liệu kiểm thử.
- Dữ liệu cần có đủ Role, Project, Member, Task và Sprint.
- Các Test Case cần có khả năng thiết lập dữ liệu đầu vào độc lập khi cần.

---

# 4. Test Data

## 4.1. Account Test Data

| Account | Role | Status | Purpose |
| --- | --- | --- | --- |
| `admin@test.com` | Admin | Active | Kiểm tra quyền Admin |
| `instructor@test.com` | Instructor | Active | Kiểm tra quyền Instructor |
| `leader@test.com` | Leader | Active | Kiểm tra quyền Leader |
| `member@test.com` | Member | Active | Kiểm tra quyền Member |
| `pending@test.com` | Member | Pending | Kiểm tra tài khoản chờ duyệt |
| `rejected@test.com` | Member | Rejected | Kiểm tra tài khoản bị từ chối |
| `suspended@test.com` | Member | Suspended | Kiểm tra tài khoản bị khóa |

Các tài khoản trên chỉ là dữ liệu giả lập dành cho môi trường Testing.

## 4.2. Project Test Data

Tạo dữ liệu Project mẫu:

- Project Active.
- Project Archived.
- Project có nhiều Members.
- Project có nhiều Tasks.
- Project có nhiều Sprints.

## 4.3. Task Test Data

Chuẩn bị các Task:

- Task chưa được giao.
- Task có một Assignee.
- Task có nhiều Assignees.
- Task có Deadline trong tương lai.
- Task đã quá hạn.
- Task đang chờ Review.
- Task đã hoàn thành.
- Task có Dependency.
- Task thuộc Backlog.
- Task thuộc Sprint.

## 4.4. Sprint Test Data

Chuẩn bị:

- Sprint Planned.
- Sprint Active.
- Sprint Completed.
- Sprint có Task.
- Sprint chưa có Task.
- Sprint có Task chưa hoàn thành.

---

# 5. Test Case Format

Mỗi Test Case sử dụng cấu trúc:

| Field | Description |
| --- | --- |
| Test Case ID | Mã định danh |
| Test Case Name | Tên Test Case |
| Module | Module được kiểm thử |
| Preconditions | Điều kiện trước khi kiểm thử |
| Test Steps | Các bước thực hiện |
| Test Data | Dữ liệu sử dụng |
| Expected Result | Kết quả mong đợi |
| Actual Result | Kết quả thực tế |
| Status | Pass / Fail / Blocked / Not Run |
| Notes | Ghi chú |

Quy ước Test Case ID:

- `TC-AUTH`: Authentication.
- `TC-USER`: User Management.
- `TC-RBAC`: Role and Permission.
- `TC-PROJ`: Project Management.
- `TC-MEMBER`: Member Management.
- `TC-TASK`: Task Management.
- `TC-SPRINT`: Sprint Management.
- `TC-KANBAN`: Kanban Board.
- `TC-DOC`: Document Library.
- `TC-NOTI`: Notification.
- `TC-DASH`: Dashboard.
- `TC-REPORT`: Reports.
- `TC-ACT`: Activity Logs.
- `TC-UI`: User Interface.

---

# 6. Functional Test Cases

## 6.1. Authentication

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-AUTH-001 | Register with valid information | Chưa có tài khoản sử dụng Email | Mở Register, nhập dữ liệu hợp lệ và Submit | Tạo tài khoản thành công với Status Pending |
| TC-AUTH-002 | Register with existing Email | Email đã tồn tại | Đăng ký bằng Email đã tồn tại | Hiển thị lỗi Email đã được sử dụng |
| TC-AUTH-003 | Register with invalid Email | Không yêu cầu | Nhập Email sai định dạng | Hiển thị Validation Error |
| TC-AUTH-004 | Register with empty fields | Không yêu cầu | Để trống trường bắt buộc và Submit | Không tạo tài khoản |
| TC-AUTH-005 | Password confirmation mismatch | Không yêu cầu | Nhập Password và Confirm Password khác nhau | Hiển thị lỗi không khớp |
| TC-AUTH-006 | Login with valid credentials | Tài khoản Active | Nhập Email và Password hợp lệ | Đăng nhập thành công |
| TC-AUTH-007 | Login with incorrect password | Tài khoản Active | Nhập đúng Email, sai Password | Đăng nhập thất bại |
| TC-AUTH-008 | Login with Pending account | Tài khoản Pending | Thực hiện Login | Không cho truy cập hệ thống chính |
| TC-AUTH-009 | Login with Rejected account | Tài khoản Rejected | Thực hiện Login | Không cho truy cập hệ thống chính |
| TC-AUTH-010 | Login with Suspended account | Tài khoản Suspended | Thực hiện Login | Không cho truy cập hệ thống chính |
| TC-AUTH-011 | Logout | Người dùng đang đăng nhập | Chọn Logout | Session kết thúc |
| TC-AUTH-012 | Access protected page without login | Chưa đăng nhập | Truy cập trực tiếp URL được bảo vệ | Chuyển đến Login hoặc từ chối truy cập |
| TC-AUTH-013 | Manage User Profile | Người dùng đã đăng nhập | Mở Profile, cập nhật các trường được phép và lưu | Thông tin hợp lệ được cập nhật; trường không được phép thay đổi bị từ chối |
| TC-AUTH-014 | Register password complexity policy (DEC-013) | Chưa đăng ký | Nhập Password thiếu chữ hoa, chữ thường, số, ký tự đặc biệt hoặc < 8 ký tự | Server từ chối với Validation Error 400 |
| TC-AUTH-015 | Change Password with current password check (DEC-018) | Người dùng ACTIVE đã đăng nhập | Nhập sai Current Password hoặc New Password trùng Current Password | Từ chối đổi mật khẩu; nhập đúng thì hash mới được lưu và ghi AuditLog |
| TC-AUTH-016 | Server-side status re-validation for suspended session | Người dùng đang có JWT hợp lệ nhưng bị Admin Suspend | Gọi protected Route/API với session JWT cũ | Server kiểm tra DB trả về 403 ACCOUNT_NOT_ACTIVE hoặc chuyển hướng `/access-denied?reason=inactive` |

## 6.2. User Management

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-USER-001 | View user list | Đăng nhập bằng Admin | Mở User Management | Hiển thị danh sách tài khoản |
| TC-USER-002 | Approve Pending account | Có tài khoản Pending | Admin chọn Approve | Tài khoản chuyển sang Active |
| TC-USER-003 | Reject Pending account | Có tài khoản Pending | Admin chọn Reject | Tài khoản chuyển sang Rejected |
| TC-USER-004 | Suspend Active account | Có tài khoản Active | Admin chọn Suspend | Tài khoản chuyển sang Suspended |
| TC-USER-005 | Activate Suspended account | Có tài khoản Suspended | Admin chọn Activate | Tài khoản chuyển sang Active |
| TC-USER-006 | Change User Role | Có tài khoản Active | Admin thay đổi Role | Role được cập nhật |
| TC-USER-007 | Access User Management as Member | Đăng nhập bằng Member | Truy cập User Management | Bị từ chối truy cập |
| TC-USER-008 | Approve account as unauthorized user | Đăng nhập bằng Member hoặc Instructor | Gửi yêu cầu Approve | Hệ thống từ chối thao tác |
| TC-USER-009 | Protect Last Active Admin from Suspend | Chỉ còn 1 tài khoản ADMIN đang ACTIVE | Admin thử Suspend hoặc đổi Role Admin cuối cùng | Hệ thống từ chối với HTTP 409 LAST_ADMIN_PROTECTION |

## 6.3. Role and Permission

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-RBAC-001 | Admin access management functions | Đăng nhập bằng Admin | Truy cập chức năng quản trị | Được phép nếu có Permission |
| TC-RBAC-002 | Instructor view Project | Đăng nhập bằng Instructor | Mở Project Detail | Hiển thị dữ liệu được phép xem |
| TC-RBAC-003 | Instructor modify restricted data | Instructor không có Permission chỉnh sửa | Thử chỉnh sửa Project | Hệ thống từ chối |
| TC-RBAC-004 | Leader manage Task | Leader thuộc Project | Tạo hoặc cập nhật Task | Được phép theo Permission |
| TC-RBAC-005 | Member update assigned Task | Member được giao Task | Cập nhật Task được phép | Thao tác thành công |
| TC-RBAC-006 | Member modify unauthorized Project | Member không có Permission | Thử chỉnh sửa Project | Hệ thống từ chối |
| TC-RBAC-007 | Access another Project data | Người dùng không thuộc Project | Truy cập trực tiếp dữ liệu Project khác | Hệ thống từ chối nếu không có Permission |
| TC-RBAC-008 | Revoke Permission | Admin có quyền quản lý Permission | Admin thu hồi Permission | Permission được cập nhật |
| TC-RBAC-009 | Last Admin protection | Chỉ còn một Admin có quyền quản trị | Thử thu hồi quyền quản trị cuối cùng | Hệ thống từ chối thao tác |

## 6.4. Project Management

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-PROJ-001 | Create Project with valid data | Admin hoặc Leader có quyền | Nhập dữ liệu hợp lệ và Submit | Project được tạo |
| TC-PROJ-002 | Create Project without name | Có quyền tạo Project | Bỏ trống Project Name | Hiển thị Validation Error |
| TC-PROJ-003 | Create Project with invalid date | Có quyền tạo Project | End Date nhỏ hơn Start Date | Không cho tạo Project |
| TC-PROJ-004 | Leader creates Project | Leader có quyền tạo Project | Tạo Project | Người tạo tự động là Project Leader |
| TC-PROJ-005 | View Project Detail | Có quyền xem Project | Mở Project Detail | Hiển thị thông tin Project |
| TC-PROJ-006 | Update Project | Có quyền chỉnh sửa | Cập nhật thông tin | Dữ liệu được cập nhật |
| TC-PROJ-007 | Unauthorized Project Update | Không có Permission | Gửi yêu cầu cập nhật Project | Hệ thống từ chối |
| TC-PROJ-008 | Activate Project | Có quyền quản lý Project | Activate Project hợp lệ | Project chuyển sang Active |
| TC-PROJ-009 | Archive Project | Có quyền quản lý Project | Archive Project hợp lệ | Project chuyển sang Archived |
| TC-PROJ-010 | Multiple Active Projects | Đã có một Project Active | Thử Activate Project khác | Không cho phép có nhiều Project Active cùng lúc |
| TC-PROJ-011 | Access Archived Project | Project đã Archived | Mở Project | Hiển thị dữ liệu theo quyền truy cập; hạn chế thao tác chỉnh sửa thông thường |

## 6.5. Member Management

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-MEMBER-001 | View Project Members | Có quyền xem Project | Mở Member List | Hiển thị danh sách thành viên |
| TC-MEMBER-002 | Add Active Member | Có quyền quản lý Member | Chọn tài khoản Active và Add | Thành viên được thêm vào Project |
| TC-MEMBER-003 | Add Pending Member | Tài khoản Pending | Thử thêm vào Project | Hệ thống từ chối |
| TC-MEMBER-004 | Add duplicate Member | Member đã thuộc Project | Thêm lại cùng Member | Không tạo bản ghi trùng |
| TC-MEMBER-005 | Remove Member | Có quyền quản lý Member | Chọn Remove | Hệ thống xử lý theo quy tắc loại bỏ thành viên |
| TC-MEMBER-006 | Unauthorized Member Management | Không có Permission | Thử thêm hoặc xóa Member | Hệ thống từ chối |

## 6.6. Task Management

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-TASK-001 | Create Task with valid data | Có quyền tạo Task | Nhập dữ liệu hợp lệ | Task được tạo |
| TC-TASK-002 | Create Task without Title | Có quyền tạo Task | Bỏ trống Title | Hiển thị Validation Error |
| TC-TASK-003 | Create Task without Deadline | Có quyền tạo Task | Bỏ trống Deadline | Không cho tạo Task |
| TC-TASK-004 | Invalid Task Date | Có quyền tạo Task | Start Date lớn hơn Deadline | Hiển thị Validation Error |
| TC-TASK-005 | Assign one Member | Member thuộc Project | Chọn một Assignee | Assignment được lưu |
| TC-TASK-006 | Assign multiple Members | Có nhiều Member hợp lệ | Chọn nhiều Assignees | Tất cả Assignees được lưu |
| TC-TASK-007 | Assign Member outside Project | Member không thuộc Project | Thử Assign Member | Hệ thống từ chối |
| TC-TASK-027 | Create Task without Assignees | Có quyền tạo Task | Tạo Task hợp lệ và để trống Assignees | Task được tạo thành công; không tạo Notification giao Task |
| TC-TASK-028 | Assign Assignees after Task creation | Task chưa có Assignee; Leader có quyền Assign | Thêm một hoặc nhiều Assignees hợp lệ | Assignment được lưu, Assignment History được ghi và Assignees mới nhận Notification |
| TC-TASK-008 | Update Task | Có Permission | Thay đổi thông tin Task | Dữ liệu được cập nhật |
| TC-TASK-009 | View Task Detail | Có Permission | Mở Task Detail | Hiển thị thông tin và History |
| TC-TASK-010 | View Task History | Task có lịch sử | Mở Task History | Hiển thị lịch sử theo thứ tự thời gian |
| TC-TASK-011 | Task Dependency Validation | Task có Dependency | Thực hiện thao tác liên quan Dependency | Hệ thống xử lý theo Business Rules đã chốt |
| TC-TASK-012 | Unauthorized Task Update | Không có Permission | Gửi yêu cầu cập nhật Task | Hệ thống từ chối |

## 6.7. Task Workflow and Review

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-TASK-013 | Submit Task for Review | Task đang IN PROGRESS | Member chọn Submit for Review | Task chuyển sang REVIEW |
| TC-TASK-014 | Notify Leader after Review submission | Task có Leader quản lý | Member Submit for Review | Leader nhận Notification |
| TC-TASK-015 | Approve Review with reason | Task đang REVIEW | Leader nhập lý do và Approve | Task chuyển sang DONE |
| TC-TASK-016 | Approve Review without reason | Task đang REVIEW | Leader để trống lý do và Approve | Hệ thống từ chối |
| TC-TASK-017 | Reject Review with reason | Task đang REVIEW | Leader nhập lý do và Reject | Task chuyển về IN PROGRESS |
| TC-TASK-018 | Reject Review without reason | Task đang REVIEW | Leader để trống lý do và Reject | Hệ thống từ chối |
| TC-TASK-019 | Notify Assignees after approval | Task có Assignees | Leader Approve | Assignees nhận Notification |
| TC-TASK-020 | Notify Assignees after rejection | Task có Assignees | Leader Reject | Assignees nhận Notification |
| TC-TASK-021 | Unauthorized Review Approval | Member không có Permission Review | Member thử Approve | Hệ thống từ chối |
| TC-TASK-022 | Review Task not in REVIEW | Task đang TODO hoặc IN PROGRESS | Leader thử Approve | Hệ thống từ chối |

## 6.8. Sprint Management

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-SPRINT-001 | Create Sprint | Có quyền quản lý Sprint | Nhập thông tin hợp lệ | Sprint được tạo |
| TC-SPRINT-002 | Create Sprint without Name | Có quyền quản lý Sprint | Bỏ trống Sprint Name | Validation Error |
| TC-SPRINT-003 | Create Sprint with invalid date | Có quyền quản lý Sprint | End Date không hợp lệ | Không cho tạo Sprint |
| TC-SPRINT-004 | View Sprint List | Có quyền xem Sprint | Mở Sprint List | Hiển thị danh sách Sprint |
| TC-SPRINT-005 | View Sprint Detail | Sprint tồn tại | Mở Sprint Detail | Hiển thị thông tin Sprint |
| TC-SPRINT-006 | Add Task to Sprint | Task đang ở Backlog | Chọn Task và Add to Sprint | Task thuộc Sprint |
| TC-SPRINT-007 | Add Task already assigned to another Sprint | Task đã thuộc Sprint khác | Thêm Task vào Sprint mới | Hệ thống từ chối hoặc xử lý theo quy tắc đã chốt |
| TC-SPRINT-008 | View Sprint Progress | Sprint có Task | Mở Sprint Overview | Hiển thị tiến độ dựa trên dữ liệu thực tế |
| TC-SPRINT-009 | Unauthorized Sprint Management | Không có Permission | Thử tạo hoặc chỉnh sửa Sprint | Hệ thống từ chối |
| TC-SPRINT-010 | Complete Sprint after deciding unfinished Task disposition | Sprint ACTIVE có Task chưa DONE | Leader xử lý từng Task chưa hoàn thành rồi Complete Sprint | Sprint chuyển COMPLETED; quyết định và lịch sử Assignment được lưu; không tự động chuyển Task |

## 6.9. Kanban Board

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-KANBAN-001 | View Project Kanban | Có quyền xem Project | Mở Kanban Board | Hiển thị Task theo Status |
| TC-KANBAN-002 | View Sprint Kanban | Sprint tồn tại | Chọn Sprint | Hiển thị Task thuộc Sprint |
| TC-KANBAN-003 | Filter by Assignee | Có Task được Assign | Chọn Assignee Filter | Chỉ hiển thị Task phù hợp |
| TC-KANBAN-004 | Filter by Priority | Có nhiều Priority | Chọn Priority Filter | Hiển thị đúng Task |
| TC-KANBAN-005 | Filter by Deadline | Có Task với nhiều Deadline | Chọn Deadline Filter | Hiển thị đúng kết quả |
| TC-KANBAN-006 | Unauthorized Status Change | Không có Permission | Thử thay đổi Status | Hệ thống từ chối |
| TC-KANBAN-007 | Invalid Status Transition | Task không đủ điều kiện chuyển trạng thái | Thử thay đổi Status | Hệ thống từ chối |
| TC-KANBAN-008 | Refresh Board after Status Update | Task Status vừa thay đổi | Tải lại Kanban | Hiển thị Status mới nhất |

## 6.10. Document Library

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-DOC-001 | Create Document Record | Có quyền quản lý Document | Nhập thông tin hợp lệ | Document Record được tạo |
| TC-DOC-002 | Create without Document Name | Có quyền quản lý Document | Bỏ trống Name | Validation Error |
| TC-DOC-003 | Create with invalid URL | Có quyền quản lý Document | Nhập URL sai định dạng | Validation Error |
| TC-DOC-004 | Link Document to Sprint | Sprint thuộc Project | Chọn Sprint hợp lệ | Liên kết được lưu |
| TC-DOC-005 | Link Document to unrelated Sprint | Sprint thuộc Project khác | Chọn Sprint không phù hợp | Hệ thống từ chối |
| TC-DOC-006 | Open Document | Document tồn tại | Chọn Open Document | Mở Google Drive URL |
| TC-DOC-007 | Search Document | Có nhiều Document | Nhập từ khóa tìm kiếm | Hiển thị kết quả phù hợp |
| TC-DOC-008 | Filter by Category | Có nhiều Category | Chọn Category | Hiển thị đúng kết quả |
| TC-DOC-009 | Unauthorized Document Management | Không có Permission | Thử thêm hoặc sửa Document | Hệ thống từ chối |
| TC-DOC-010 | Update Document Record | Có quyền cập nhật Document | Sửa Name, Description, URL hoặc Category hợp lệ và lưu | Document Record được cập nhật; URL được kiểm tra hợp lệ |
| TC-DOC-011 | Delete Document Record | Có quyền xóa Document | Xác nhận xóa Document Record | Record bị xóa/ẩn theo chính sách; file gốc trên Google Drive không bị xóa |

## 6.11. Notification Center

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-NOTI-001 | View Notifications | Người dùng đã đăng nhập | Mở Notification Center | Hiển thị Notification của người dùng |
| TC-NOTI-002 | Mark as Read | Có Notification chưa đọc | Chọn Mark as Read | Notification chuyển sang Read |
| TC-NOTI-003 | Mark as Unread | Có Notification đã đọc | Chọn Mark as Unread nếu được hỗ trợ | Notification chuyển sang Unread |
| TC-NOTI-004 | Unread Count | Có Notification chưa đọc | Kiểm tra Header | Hiển thị số lượng phù hợp |
| TC-NOTI-005 | Notification Navigation | Notification có liên kết Task | Chọn Notification | Điều hướng đến Task tương ứng |
| TC-NOTI-006 | Access Another User Notifications | Người dùng khác có Notification | Thử truy cập dữ liệu Notification của người khác | Hệ thống từ chối |

## 6.12. Dashboard and Reports

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-DASH-001 | View Dashboard | Người dùng có quyền | Mở Dashboard | Hiển thị dữ liệu phù hợp |
| TC-DASH-002 | Total Task Count | Project có Task | Kiềm tra Total Tasks | Số lượng chính xác |
| TC-DASH-003 | Completed Task Count | Có Task DONE | Kiểm tra Completed Tasks | Số lượng chính xác |
| TC-DASH-004 | Overdue Task Count | Có Task quá hạn | Kiểm tra Overdue Tasks | Số lượng chính xác theo quy tắc |
| TC-DASH-005 | Waiting Review Count | Có Task REVIEW | Kiểm tra Waiting Review | Số lượng chính xác |
| TC-DASH-006 | Sprint Progress | Sprint có Task | Kiểm tra Progress | Tính toán theo công thức đã xác định |
| TC-DASH-007 | Empty Project Dashboard | Project chưa có Task | Mở Dashboard | Hiển thị Empty State phù hợp |
| TC-DASH-008 | View Sprint Burndown Chart | Sprint có dữ liệu Task và lịch sử theo ngày | Mở Burndown Chart và đối chiếu dữ liệu nguồn | Biểu đồ hiển thị Remaining Work theo ngày; không hiển thị dữ liệu giả khi thiếu lịch sử |
| TC-REPORT-001 | View Project Report | Có quyền xem Report | Mở Project Report | Hiển thị dữ liệu chính xác |
| TC-REPORT-002 | View Sprint Report | Sprint có dữ liệu | Mở Sprint Report | Hiển thị số liệu phù hợp |
| TC-REPORT-003 | View Member Contribution | Có dữ liệu Assignment và History | Mở Contribution Report | Hiển thị số liệu khách quan |
| TC-REPORT-004 | Report Data Consistency | Có dữ liệu Task và Sprint | Đối chiếu Report với Database | Không có sai lệch dữ liệu |

## 6.13. Activity Logs

| ID | Test Case | Preconditions | Test Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-ACT-001 | Record Project Creation | Có quyền tạo Project | Tạo Project | Activity được ghi nhận |
| TC-ACT-002 | Record Task Status Change | Task tồn tại | Thay đổi Status | Activity được ghi nhận |
| TC-ACT-003 | Record Review Decision | Task đang REVIEW | Approve hoặc Reject | Lưu Review Decision |
| TC-ACT-004 | Record Permission Change | Admin có quyền | Thay đổi Permission | Activity được ghi nhận |
| TC-ACT-005 | Unauthorized Activity Log Access | Không có Permission | Truy cập Activity Logs | Hệ thống từ chối |
| TC-ACT-006 | Prevent Activity Log Modification | Activity đã được ghi nhận | Thử sửa Log thông qua giao diện thông thường | Không cho phép |

---

# 7. Non-Functional Test Cases

## 7.1. Security Testing

| ID | Test Case | Expected Result |
| --- | --- | --- |
| TC-SEC-001 | Password Storage | Password không được lưu dưới dạng Plain Text |
| TC-SEC-002 | Session Protection | Session được bảo vệ theo Authentication Strategy |
| TC-SEC-003 | Unauthorized Server Action | Server từ chối thao tác không có quyền |
| TC-SEC-004 | Cross-Project Access | Người dùng không thể truy cập dữ liệu Project trái phép |
| TC-SEC-005 | Input Validation | Dữ liệu không hợp lệ bị từ chối ở Server |
| TC-SEC-006 | Sensitive Information Exposure | Không trả về Password Hash hoặc thông tin nhạy cảm không cần thiết |
| TC-SEC-007 | XSS Prevention | Nội dung không đáng tin cậy không được thực thi như Script |
| TC-SEC-008 | CSRF Protection | Các thao tác thay đổi dữ liệu được bảo vệ phù hợp với Authentication Strategy |

## 7.2. Performance Testing

| ID | Test Case | Expected Result |
| --- | --- | --- |
| TC-PERF-001 | Load Dashboard | Dashboard tải trong thời gian chấp nhận được |
| TC-PERF-002 | Load Task List | Task List hiển thị ổn định |
| TC-PERF-003 | Load Large Data List | Không tải toàn bộ dữ liệu không cần thiết |
| TC-PERF-004 | Repeated Form Submission | Không tạo dữ liệu trùng ngoài ý muốn |
| TC-PERF-005 | Concurrent Task Updates | Không làm mất hoặc ghi đè dữ liệu không hợp lệ |

Các ngưỡng Performance cụ thể cần được xác định sau khi chọn môi trường triển khai và quy mô dữ liệu mục tiêu.

## 7.3. Reliability Testing

| ID | Test Case | Expected Result |
| --- | --- | --- |
| TC-REL-001 | Database Connection Failure | Hiển thị lỗi phù hợp, không làm lộ thông tin nhạy cảm |
| TC-REL-002 | Failed Data Update | Không lưu dữ liệu một phần nếu thao tác yêu cầu Transaction |
| TC-REL-003 | Failed Notification Creation | Xử lý lỗi theo cơ chế phù hợp, không làm sai lệch nghiệp vụ chính |
| TC-REL-004 | Refresh after Successful Update | Dữ liệu sau khi tải lại vẫn chính xác |

## 7.4. Usability Testing

| ID | Test Case | Expected Result |
| --- | --- | --- |
| TC-UI-001 | Form Label Visibility | Các trường có Label rõ ràng |
| TC-UI-002 | Validation Message | Lỗi hiển thị đúng vị trí |
| TC-UI-003 | Loading State | Có phản hồi trong khi xử lý |
| TC-UI-004 | Empty State | Danh sách trống có thông báo phù hợp |
| TC-UI-005 | Error State | Lỗi được trình bày dễ hiểu |
| TC-UI-006 | Navigation Consistency | Navigation nhất quán giữa các trang |
| TC-UI-007 | Responsive Desktop | Hiển thị phù hợp trên Desktop |
| TC-UI-008 | Responsive Tablet | Không có lỗi bố cục nghiêm trọng |
| TC-UI-009 | Responsive Mobile | Nội dung và thao tác chính vẫn sử dụng được |
| TC-UI-010 | Keyboard Navigation | Có thể thao tác các thành phần chính bằng bàn phím |

---

# 8. Integration Test Scenarios

Các kịch bản dưới đây kiểm tra sự phối hợp giữa nhiều Module.

## 8.1. Account Registration and Approval

**Scenario:** Người dùng đăng ký và được Admin phê duyệt.

**Steps:**

1. Người dùng đăng ký tài khoản.
2. Hệ thống tạo tài khoản Pending.
3. Admin mở User Management.
4. Admin Approve tài khoản.
5. Tài khoản chuyển sang Active.
6. Người dùng đăng nhập thành công.

**Expected Result:**

- Account Status được cập nhật chính xác.
- Role được gán đúng.
- Activity Log được ghi nhận.
- Người dùng chỉ được truy cập hệ thống sau khi đủ điều kiện.

## 8.2. Project Creation and Member Assignment

**Scenario:** Leader tạo Project và thêm Members.

**Steps:**

1. Leader tạo Project.
2. Có thể chọn Project Template hoặc để trống.
3. Chọn Members.
4. Submit Project.
5. Mở Project Detail.
6. Kiểm tra danh sách Members.

**Expected Result:**

- Project được tạo.
- Leader được gán đúng.
- Members được liên kết với Project.
- Permission được áp dụng chính xác.

## 8.3. Task Assignment and Notification

**Scenario:** Leader giao Task cho Member.

**Steps:**

1. Leader tạo Task.
2. Có thể chọn Assignees hoặc để trống.
3. Lưu Task.
4. Nếu có Assignees, hệ thống tạo Notification; nếu để trống thì không gửi Notification giao Task.
5. Nếu Task chưa có Assignee, Leader có thể phân công sau bằng Manage Assignees.
5. Member mở Notification Center.
6. Member mở Task Detail.

**Expected Result:**

- Task có đúng Assignees.
- Notification được tạo cho đúng người.
- Member chỉ truy cập được dữ liệu theo Permission.

## 8.4. Task Review Workflow

**Scenario:** Member gửi Task để Leader Review.

**Steps:**

1. Member mở Task được giao.
2. Member cập nhật Task.
3. Member Submit for Review.
4. Task chuyển sang REVIEW.
5. Leader nhận Notification.
6. Leader mở Task.
7. Leader nhập lý do và Approve hoặc Reject.
8. Assignees nhận Notification.
9. Task History được cập nhật.

**Expected Result:**

- Status thay đổi đúng Workflow.
- Review Decision được lưu.
- Reason được lưu.
- Notification gửi đúng đối tượng.
- Task History phản ánh đầy đủ quá trình xử lý.

## 8.5. Sprint Planning and Kanban

**Scenario:** Leader tạo Sprint và đưa Task vào Sprint.

**Steps:**

1. Leader tạo Sprint.
2. Mở Product Backlog.
3. Chọn Task.
4. Thêm Task vào Sprint.
5. Mở Sprint Detail.
6. Mở Sprint Kanban.
7. Thay đổi trạng thái Task theo Workflow.

**Expected Result:**

- Task được liên kết với đúng Sprint.
- Không có Task thuộc nhiều Sprint cùng lúc.
- Kanban hiển thị đúng Task.
- Sprint Progress được cập nhật phù hợp.

## 8.6. Dashboard and Reporting

**Scenario:** Kiểm tra dữ liệu Dashboard sau khi hoàn thành Task.

**Steps:**

1. Tạo Project.
2. Tạo các Task.
3. Phân công Assignees.
4. Thực hiện Task Workflow.
5. Mở Dashboard.
6. Mở Project Report.
7. Đối chiếu với dữ liệu Task.

**Expected Result:**

- Summary Cards hiển thị đúng số lượng.
- Project Progress được tính chính xác.
- Sprint Progress phản ánh dữ liệu thực tế.
- Reports không bị sai lệch so với Database.

---

# 9. Regression Testing

Sau mỗi lần thay đổi quan trọng, cần chạy lại các Test Case liên quan.

| Changed Module | Modules to Retest |
| --- | --- |
| Authentication | Account, Authorization, Protected Pages |
| Authorization | Project, Member, Task, Sprint, Documents, Reports |
| Project | Member, Task, Sprint, Dashboard |
| Task | Kanban, Sprint, Notification, Dashboard, Reports |
| Sprint | Backlog, Kanban, Dashboard, Reports |
| Notification | Task Workflow, User Notification Center |
| Database Schema | Các Module sử dụng Entity bị thay đổi |
| UI Components | Các trang sử dụng Component được cập nhật |

Không cần chạy toàn bộ Test Suite sau mọi thay đổi nhỏ. Phạm vi Regression Testing cần dựa trên mức độ ảnh hưởng của thay đổi.

---

# 10. Bug Management

## 10.1. Bug Severity

| Severity | Description |
| --- | --- |
| Critical | Lỗi nghiêm trọng làm hệ thống không thể sử dụng hoặc gây rủi ro dữ liệu/bảo mật |
| High | Lỗi ảnh hưởng chức năng nghiệp vụ quan trọng |
| Medium | Lỗi ảnh hưởng một phần chức năng nhưng có cách xử lý thay thế |
| Low | Lỗi giao diện hoặc vấn đề nhỏ không ảnh hưởng đáng kể |

## 10.2. Bug Priority

| Priority | Description |
| --- | --- |
| P0 | Cần xử lý ngay |
| P1 | Cần xử lý trước khi hoàn thành Module |
| P2 | Có thể xử lý trong giai đoạn tiếp theo |
| P3 | Có thể đưa vào Future Improvement |

## 10.3. Bug Report Template

Mỗi Bug Report cần có:

- Bug ID.
- Bug Title.
- Module.
- Severity.
- Priority.
- Environment.
- Preconditions.
- Steps to Reproduce.
- Expected Result.
- Actual Result.
- Screenshot hoặc Log nếu cần.
- Status.
- Assigned To.

## 10.4. Bug Lifecycle

Proposed Bug Lifecycle:

`New → Assigned → In Progress → Fixed → Retest → Closed`

Nếu kiểm thử lại vẫn thất bại:

`Retest → Reopened`

---

# 11. Test Execution and Reporting

## 11.1. Test Execution Status

| Status | Description |
| --- | --- |
| Not Run | Chưa thực hiện |
| Pass | Kết quả đúng Expected Result |
| Fail | Kết quả khác Expected Result |
| Blocked | Không thể kiểm thử do phụ thuộc hoặc lỗi khác |

## 11.2. Test Execution Report

Mỗi đợt kiểm thử cần ghi nhận:

- Total Test Cases.
- Executed Test Cases.
- Passed Test Cases.
- Failed Test Cases.
- Blocked Test Cases.
- Not Run Test Cases.
- Open Bugs.
- Critical Bugs.
- Testing Conclusion.

## 11.3. Test Metrics

Có thể sử dụng các chỉ số:

**Test Execution Rate:**

$$\frac{\text{Executed Test Cases}}{\text{Total Test Cases}} \times 100\%$$

**Test Pass Rate:**

$$\frac{\text{Passed Test Cases}}{\text{Executed Test Cases}} \times 100\%$$

Các chỉ số này giúp theo dõi tình trạng kiểm thử nhưng không thay thế việc đánh giá chất lượng thực tế.

---

# 12. Entry and Exit Criteria

## 12.1. Entry Criteria

Điều kiện bắt đầu kiểm thử:

- Module đã được triển khai ở mức có thể kiểm thử.
- Database và Test Environment đã sẵn sàng.
- Test Data đã được chuẩn bị.
- Test Cases đã được xác định.
- Các Dependency cần thiết đã hoạt động.
- Có thể truy cập chức năng cần kiểm thử.

## 12.2. Exit Criteria

Điều kiện hoàn thành một đợt kiểm thử:

- Các Test Case quan trọng đã được thực hiện.
- Các lỗi Critical và High đã được xử lý hoặc có quyết định chấp nhận rủi ro rõ ràng.
- Các Business Rules quan trọng đã được xác nhận.
- Authorization Testing đạt yêu cầu.
- Các chức năng chính hoạt động đúng.
- Regression Testing cho khu vực bị ảnh hưởng đã hoàn thành.
- Kết quả kiểm thử được ghi nhận.

Không yêu cầu tất cả Test Case phải Pass tuyệt đối mới được chuyển giai đoạn, nhưng mọi lỗi còn tồn tại phải được đánh giá và chấp thuận rõ ràng.

---

# 13. Testing Schedule

Testing được thực hiện xuyên suốt quá trình phát triển thay vì chỉ thực hiện ở cuối Project.

| Phase | Testing Activities |
| --- | --- |
| Sprint 0 – Foundation | Kiểm tra cấu hình, Database Connection và Project Setup |
| Sprint 1 – Authentication | Unit, Functional và Security Testing |
| Sprint 2 – Authorization & Project | RBAC, Project và Member Testing |
| Sprint 3 – Task Management | Task Workflow, Validation và Integration Testing |
| Sprint 4 – Sprint & Kanban | Sprint Planning, Board và Progress Testing |
| Sprint 5 – Documents & Notifications | Document và Notification Integration Testing |
| Sprint 6 – Dashboard & Reports | Data Accuracy và Reporting Testing |
| Sprint 7 – Testing & Deployment | Regression, Acceptance và Deployment Verification |

---

# 14. Test Deliverables

Các sản phẩm đầu ra của hoạt động Testing:

| Deliverable | Description |
| --- | --- |
| Test Plan | Kế hoạch kiểm thử |
| Test Cases | Danh sách trường hợp kiểm thử |
| Test Data | Dữ liệu kiểm thử |
| Test Execution Report | Báo cáo thực hiện kiểm thử |
| Bug Reports | Báo cáo lỗi |
| Regression Test Results | Kết quả kiểm thử hồi quy |
| Acceptance Test Results | Kết quả kiểm thử nghiệm thu |

---

# 15. Open Issues

Các vấn đề cần được xác định rõ trước khi hoàn thiện Test Cases:

| ID | Issue | Impact |
| --- | --- | --- |



| TEST-004 | Xử lý Task chưa hoàn thành khi Sprint kết thúc | Sprint Testing |
| TEST-005 | Điều kiện Archive Project | Project Testing |


| TEST-008 | Công thức tính Project Progress | Dashboard và Reports |
| TEST-009 | Công thức tính Sprint Progress | Sprint và Reports |
| TEST-010 | Notification cho Deadline | Notification Testing |
| TEST-011 | Email Verification có được áp dụng không | Authentication Testing |
| TEST-012 | Email Provider selection and delivery cụ thể | Email Notification Testing; yêu cầu Email đã được chốt, chỉ Provider còn mở |
| TEST-013 | Member được phép chỉnh sửa những trường Task nào | Authorization Testing |
| TEST-014 | Instructor có được Comment hoặc Review Task không | Authorization và Task Testing |
| TEST-015 | Có hỗ trợ Task Cancellation không | Task Workflow Testing |

Các Test Case phụ thuộc vào quyết định chưa chốt cần được cập nhật trước khi thực thi chính thức.

---

# 16. Document Change History

| Version | Date | Description |
| --- | --- | --- |
| 1.0 | 2026-11-14 | Initial Test Plan and Test Cases |

**End of Document**


## Confirmed Decision Test Cases — 2026-11-14

| Test ID | Scenario | Expected Result |
|---|---|---|
| TC-PROJ-012 | Create Project without Template | Project được tạo thành công, `templateId` NULL |
| TC-PROJ-013 | Create Project without Instructor | Project được tạo thành công, `instructorId` NULL |
| TC-PROJ-014 | Restore Archived Project as Admin when no other Project is ACTIVE | Project được khôi phục theo trạng thái đã chọn; dữ liệu và lịch sử còn nguyên |
| TC-PROJ-015 | Restore Project as non-Admin | Server từ chối thao tác |
| TC-PROJ-016 | Restore Project to ACTIVE while another Project is ACTIVE | Server từ chối và thông báo xung đột |
| TC-TASK-025 | Validate Priority Enum | Chỉ chấp nhận LOW, MEDIUM, HIGH, CRITICAL |
| TC-TASK-026 | Estimate in hours | Estimate được lưu và đọc theo giờ; không chấp nhận Story Points trong MVP |
| TC-TASK-023 | Complete Task while predecessor is not DONE | Server từ chối chuyển sang DONE |
| TC-TASK-024 | Complete Task after all predecessors are DONE | Khi Task đang REVIEW và mọi predecessor đã DONE, Leader có thể Approve theo quyền; Task chuyển DONE |
| TC-SPR-001 | Create two ACTIVE Sprints in same Project | Cả hai Sprint có thể ở trạng thái ACTIVE |
| TC-SPR-002 | End Sprint with unfinished Tasks | Leader có thể quyết định từng Task; mọi thay đổi Sprint Assignment được lưu lịch sử |
| TC-MEMBER-008 | Remove Member who still has assigned Tasks | Từ chối Remove và hiển thị Task cần reassign |
| TC-MEMBER-007 | Remove Member after all Tasks reassigned | Cho phép Remove và giữ lịch sử Assignment |
| TC-NOTI-007 | Required Email Notification succeeds | Delivery chuyển SENT và lưu sentAt |
| TC-NOTI-008 | Email Provider temporarily fails | Delivery chuyển FAILED hoặc được retry theo chính sách; nghiệp vụ chính không rollback |
| TC-NOTI-009 | Retry Email Delivery | Không tạo gửi trùng ngoài ý muốn; Delivery History được cập nhật |

### Updated Open Decisions

Các quyết định sau đã được chốt và không còn là Open Issue: Template optional, Instructor optional, Priority enum, Estimate unit, Dependency completion gate, multiple ACTIVE Sprints, unfinished Sprint Task handling by Leader, Admin Project Restore, Member removal reassignment, Email Notification required. Email Provider cụ thể vẫn là quyết định kỹ thuật cần chọn trước khi tích hợp Email.
