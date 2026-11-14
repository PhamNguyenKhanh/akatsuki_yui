# USE CASE SPECIFICATION
# AKATSUKI YUI

**Version:** 1.0  
**Status:** Draft  
**Document Type:** Use Case Specification  
**Project:** Akatsuki Yui  
**Last Updated:** November 2026

---

# 1. INTRODUCTION

## 1.1. Purpose

Tài liệu Use Case Specification mô tả chi tiết cách các Actor tương tác với hệ thống Akatsuki Yui để thực hiện các nghiệp vụ.

Tài liệu được sử dụng để:

- Xác định các chức năng mà từng Actor có thể thực hiện.
- Mô tả luồng xử lý chính và các luồng thay thế.
- Xác định điều kiện trước và sau khi thực hiện Use Case.
- Làm cơ sở thiết kế UI/UX.
- Làm cơ sở triển khai Backend và Business Logic.
- Xây dựng Test Cases.

## 1.2. Scope

Tài liệu bao gồm các Use Case thuộc những Module chính:

1. Authentication and Account Management.
2. Authorization.
3. Project Management.
4. Member Management.
5. Task Management.
6. Sprint Management.
7. Kanban Board.
8. Document Library.
9. Notification.
10. Dashboard and Reporting.
11. Activity and Audit Log.

## 1.3. Actors

| Actor | Description |
|---|---|
| Guest | Người chưa đăng nhập |
| User | Người dùng đã đăng nhập |
| Admin | Người quản trị Workspace |
| Instructor | Giảng viên hướng dẫn |
| Leader | Người quản lý Project |
| Member | Thành viên thực hiện Task |
| Email Service | Dịch vụ gửi Email |
| Google Drive | Dịch vụ lưu trữ tài liệu bên ngoài |

---

# 2. USE CASE DIAGRAM OVERVIEW

## 2.1. Main Use Cases

| Use Case ID | Use Case Name | Primary Actor | Priority |
|---|---|---|---|
| UC-001 | Register Account | Guest | High |
| UC-002 | Login | User | High |
| UC-003 | Logout | User | High |
| UC-004 | Manage User Accounts | Admin | High |
| UC-005 | Approve or Reject Account | Admin | High |
| UC-006 | Manage Roles and Permissions | Admin | High |
| UC-007 | Create Project | Admin / Leader | High |
| UC-008 | View Project | Authorized User | High |
| UC-009 | Update Project | Admin / Leader | High |
| UC-010 | Activate Project | Admin / Leader | High |
| UC-011 | Archive Project | Admin / Leader | High |
| UC-012 | Manage Project Members | Leader | High |
| UC-013 | Create Task | Leader | High |
| UC-014 | Update Task | Authorized User | High |
| UC-015 | Assign Task | Leader | High |
| UC-016 | Submit Task for Review | Member | High |
| UC-017 | Approve Task Review | Leader | High |
| UC-018 | Reject Task Review | Leader | High |
| UC-019 | View Task History | Authorized User | Medium |
| UC-020 | Create Sprint | Leader | High |
| UC-021 | Manage Backlog | Leader | High |
| UC-022 | Plan Sprint | Leader | High |
| UC-023 | View Sprint Overview | Authorized User | Medium |
| UC-024 | View Kanban Board | Authorized User | High |
| UC-025 | Filter Tasks | Authorized User | High |
| UC-026 | Manage Documents | Authorized User | High |
| UC-027 | Open Document | Authorized User | High |
| UC-028 | View Notifications | User | High |
| UC-029 | Manage Notification Read Status | User | High |
| UC-030 | View Dashboard | Authorized User | High |
| UC-031 | View Reports | Authorized User | Medium |
| UC-032 | View Activity History | Authorized User | Medium |
| UC-033 | Manage User Profile | User | Medium |
| UC-034 | Restore Archived Project | Admin | High |
| UC-035 | Complete Sprint | Leader | High |

## 2.2. Use Case Relationships

Một số Use Case có quan hệ phụ thuộc:

- UC-001 Register Account tạo tài khoản để UC-005 Approve or Reject Account xử lý.
- UC-002 Login là điều kiện để thực hiện các Use Case yêu cầu xác thực.
- UC-007 Create Project là cơ sở cho các nghiệp vụ quản lý Project.
- UC-013 Create Task tạo dữ liệu cho UC-015 Assign Task và UC-022 Plan Sprint.
- UC-016 Submit Task for Review tạo điều kiện cho UC-017 Approve Task Review hoặc UC-018 Reject Task Review.
- UC-020 Create Sprint là cơ sở cho UC-022 Plan Sprint.
- UC-024 View Kanban Board sử dụng dữ liệu Task.
- UC-030 View Dashboard và UC-031 View Reports sử dụng dữ liệu nghiệp vụ đã được ghi nhận.

---

# 3. AUTHENTICATION AND ACCOUNT MANAGEMENT

## UC-001: Register Account

**Primary Actor:** Guest  
**Priority:** High

### Description

Cho phép Guest đăng ký tài khoản mới để tham gia Workspace.

### Preconditions

- Guest chưa đăng nhập.
- Guest có quyền truy cập trang đăng ký.

### Trigger

Guest chọn chức năng Register.

### Main Flow

1. Guest mở trang Register.
2. Hệ thống hiển thị biểu mẫu đăng ký.
3. Guest nhập Full Name.
4. Guest nhập Email.
5. Guest nhập Password.
6. Guest nhập Confirm Password.
7. Guest chọn Register.
8. Hệ thống kiểm tra dữ liệu đầu vào.
9. Hệ thống kiểm tra Email đã tồn tại hay chưa.
10. Hệ thống kiểm tra Password và Confirm Password.
11. Hệ thống tạo tài khoản mới với trạng thái Pending.
12. Hệ thống lưu thông tin tài khoản.
13. Hệ thống ghi nhận hoạt động đăng ký.
14. Hệ thống hiển thị thông báo đăng ký thành công.

### Alternative Flows

**A1. Invalid Input**

- Tại bước 8, nếu dữ liệu không hợp lệ, hệ thống hiển thị lỗi.
- Guest chỉnh sửa thông tin và gửi lại.

**A2. Email Already Exists**

- Tại bước 9, nếu Email đã tồn tại, hệ thống từ chối đăng ký.
- Hệ thống hiển thị thông báo phù hợp.

**A3. Password Mismatch**

- Tại bước 10, nếu Password và Confirm Password không khớp, hệ thống hiển thị lỗi.

### Postconditions

- Tài khoản được tạo ở trạng thái Pending nếu đăng ký thành công.
- Tài khoản chưa có quyền truy cập các chức năng nội bộ.

### Business Rules

- BR-ACC-001.
- BR-ACC-002.
- BR-ACC-003.

---

## UC-002: Login

**Primary Actor:** User  
**Priority:** High

### Description

Cho phép người dùng đăng nhập vào hệ thống.

### Preconditions

- Người dùng đã có tài khoản.
- Tài khoản ở trạng thái Active.

### Trigger

Người dùng chọn Login.

### Main Flow

1. Người dùng mở trang Login.
2. Hệ thống hiển thị biểu mẫu đăng nhập.
3. Người dùng nhập Email.
4. Người dùng nhập Password.
5. Người dùng chọn Login.
6. Hệ thống kiểm tra thông tin xác thực.
7. Hệ thống kiểm tra trạng thái tài khoản.
8. Hệ thống tạo phiên đăng nhập an toàn.
9. Hệ thống điều hướng người dùng đến giao diện phù hợp.

### Alternative Flows

**A1. Incorrect Credentials**

- Hệ thống từ chối đăng nhập.
- Hệ thống hiển thị thông báo lỗi phù hợp.

**A2. Pending Account**

- Hệ thống từ chối đăng nhập.
- Hiển thị thông báo tài khoản đang chờ phê duyệt.

**A3. Rejected Account**

- Hệ thống từ chối đăng nhập.

**A4. Suspended Account**

- Hệ thống từ chối đăng nhập.

### Postconditions

- Người dùng có phiên đăng nhập hợp lệ nếu đăng nhập thành công.

### Business Rules

- BR-ACC-004.
- BR-ACC-005.
- BR-ACC-006.

---

## UC-003: Logout

**Primary Actor:** User  
**Priority:** High

### Description

Cho phép người dùng kết thúc phiên đăng nhập.

### Preconditions

- Người dùng đang đăng nhập.

### Trigger

Người dùng chọn Logout.

### Main Flow

1. Người dùng chọn Logout.
2. Hệ thống kết thúc phiên đăng nhập.
3. Hệ thống xóa hoặc vô hiệu hóa thông tin phiên.
4. Hệ thống điều hướng về trang Login.

### Postconditions

- Phiên đăng nhập hiện tại không còn hợp lệ.

---

## UC-004: Manage User Accounts

**Primary Actor:** Admin  
**Priority:** High

### Description

Cho phép Admin xem và quản lý tài khoản trong Workspace.

### Preconditions

- Admin đã đăng nhập.
- Admin có quyền quản lý tài khoản.

### Trigger

Admin mở User Management.

### Main Flow

1. Admin mở User Management.
2. Hệ thống hiển thị danh sách tài khoản.
3. Admin có thể tìm kiếm hoặc lọc tài khoản.
4. Admin chọn một tài khoản.
5. Hệ thống hiển thị thông tin chi tiết.
6. Admin lựa chọn thao tác phù hợp.
7. Hệ thống kiểm tra quyền và dữ liệu.
8. Hệ thống thực hiện thao tác.
9. Hệ thống ghi nhận lịch sử thay đổi.

### Alternative Flows

- Nếu không có quyền, hệ thống từ chối truy cập.
- Nếu không tìm thấy tài khoản, hệ thống hiển thị trạng thái Empty.
- Nếu dữ liệu không hợp lệ, hệ thống hiển thị lỗi.

### Postconditions

- Thông tin tài khoản được cập nhật nếu thao tác thành công.

---

## UC-005: Approve or Reject Account

**Primary Actor:** Admin  
**Priority:** High

### Description

Cho phép Admin phê duyệt hoặc từ chối tài khoản đang Pending.

### Preconditions

- Admin đã đăng nhập.
- Admin có quyền quản lý tài khoản.
- Tài khoản cần xử lý đang ở trạng thái Pending.

### Trigger

Admin chọn một tài khoản trong danh sách Pending.

### Main Flow

1. Admin mở danh sách tài khoản Pending.
2. Admin chọn tài khoản cần xử lý.
3. Hệ thống hiển thị thông tin tài khoản.
4. Admin chọn Approve hoặc Reject.
5. Hệ thống xác nhận thao tác.
6. Hệ thống cập nhật trạng thái tài khoản.
7. Hệ thống ghi nhận Admin thực hiện và thời điểm.
8. Hệ thống gửi thông báo đến người dùng.
9. Hệ thống cập nhật danh sách tài khoản.

### Alternative Flows

**A1. Account Already Processed**

- Nếu tài khoản không còn Pending, hệ thống từ chối xử lý theo trạng thái cũ.
- Hệ thống yêu cầu tải lại thông tin.

**A2. Unauthorized Admin**

- Hệ thống từ chối thao tác.

### Postconditions

- Approve: tài khoản chuyển sang Active.
- Reject: tài khoản chuyển sang Rejected.

### Business Rules

- BR-ACC-002.
- BR-ACC-007.
- BR-ACC-008.

---

## UC-006: Manage Roles and Permissions

**Primary Actor:** Admin  
**Priority:** High

### Description

Cho phép Admin quản lý Role và Permission của hệ thống.

### Preconditions

- Admin đã đăng nhập.
- Admin có quyền quản lý Permission.

### Trigger

Admin mở Authorization Management.

### Main Flow

1. Admin mở Authorization Management.
2. Hệ thống hiển thị danh sách Role.
3. Admin chọn Role cần quản lý.
4. Hệ thống hiển thị Permission hiện tại.
5. Admin thay đổi Permission được phép cấu hình.
6. Hệ thống kiểm tra tính hợp lệ.
7. Hệ thống kiểm tra điều kiện bảo vệ quyền Admin cuối cùng.
8. Admin xác nhận thay đổi.
9. Hệ thống lưu Permission mới.
10. Hệ thống ghi nhận lịch sử thay đổi.

### Alternative Flows

- Nếu Permission không hợp lệ, hệ thống từ chối cập nhật.
- Nếu thao tác làm mất quyền quản trị cuối cùng, hệ thống từ chối.
- Nếu Admin không có quyền, hệ thống từ chối truy cập.

### Postconditions

- Permission được cập nhật nếu thao tác thành công.

---

# 4. PROJECT MANAGEMENT

## UC-007: Create Project

**Primary Actor:** Admin / Leader  
**Priority:** High

### Description

Cho phép Admin hoặc Leader tạo Project mới.

### Preconditions

- Người dùng đã đăng nhập.
- Người dùng có quyền Create Project.
- Project mới đáp ứng điều kiện nghiệp vụ.

### Trigger

Người dùng chọn Create Project.

### Main Flow

1. Người dùng mở Project Management.
2. Người dùng chọn Create Project.
3. Hệ thống hiển thị biểu mẫu.
4. Người dùng có thể chọn Project Template nếu muốn; đây không phải trường bắt buộc.
5. Người dùng nhập Project Name.
6. Người dùng nhập Description.
7. Người dùng nhập Start Date và End Date.
8. Người dùng xác định Project Leader.
9. Người dùng có thể chọn Instructor; đây không phải trường bắt buộc.
10. Người dùng chọn Members.
11. Người dùng nhập Technologies.
12. Người dùng nhập Repository URL nếu có.
13. Người dùng nhập Objectives và Scope.
14. Người dùng gửi biểu mẫu.
15. Hệ thống kiểm tra dữ liệu.
16. Hệ thống kiểm tra quyền.
17. Hệ thống xác định Project Leader.
18. Hệ thống tạo Project ở trạng thái Created.
19. Hệ thống lưu thông tin Project.
20. Hệ thống ghi nhận Activity Log.
21. Hệ thống thông báo tạo Project thành công.

### Alternative Flows

**A1. Leader Creates Project**

- Nếu Actor là Leader, hệ thống tự động gán người tạo làm Project Leader.

**A2. Invalid Date Range**

- Nếu Start Date sau End Date, hệ thống từ chối tạo Project.

**A3. Missing Project Leader**

- Nếu Project không có Leader, hệ thống từ chối tạo Project.

**A4. Invalid Member**

- Nếu tài khoản được chọn không hợp lệ hoặc không Active, hệ thống từ chối hoặc yêu cầu chọn lại.

### Postconditions

- Project được tạo với trạng thái Created.
- Project có một Leader.

### Business Rules

- BR-PROJ-001.
- BR-PROJ-002.
- BR-PROJ-003.
- BR-PROJ-005.

---

## UC-008: View Project

**Primary Actor:** Authorized User  
**Priority:** High

### Description

Cho phép người dùng có quyền xem thông tin Project.

### Preconditions

- Người dùng đã đăng nhập.
- Người dùng có quyền xem Project.

### Trigger

Người dùng chọn Project.

### Main Flow

1. Người dùng mở Project List.
2. Hệ thống hiển thị Project trong phạm vi được phép.
3. Người dùng chọn Project.
4. Hệ thống kiểm tra quyền truy cập.
5. Hệ thống tải thông tin Project.
6. Hệ thống hiển thị:
   - Project Information.
   - Project Leader.
   - Instructor.
   - Members.
   - Task Overview.
   - Sprint Overview.
   - Project Progress.

### Alternative Flows

- Nếu không có quyền, hệ thống từ chối truy cập.
- Nếu Project không tồn tại, hệ thống hiển thị thông báo phù hợp.

### Postconditions

- Không làm thay đổi dữ liệu Project.

---

## UC-009: Update Project

**Primary Actor:** Admin / Leader  
**Priority:** High

### Description

Cho phép người có quyền cập nhật thông tin Project.

### Preconditions

- Người dùng đã đăng nhập.
- Project tồn tại.
- Project chưa bị Archived.
- Người dùng có quyền cập nhật Project.

### Trigger

Người dùng chọn Edit Project.

### Main Flow

1. Người dùng mở Project Details.
2. Người dùng chọn Edit.
3. Hệ thống hiển thị thông tin hiện tại.
4. Người dùng thay đổi thông tin.
5. Người dùng lưu thay đổi.
6. Hệ thống kiểm tra quyền.
7. Hệ thống kiểm tra dữ liệu.
8. Hệ thống cập nhật Project.
9. Hệ thống ghi nhận giá trị trước và sau.
10. Hệ thống thông báo cập nhật thành công.

### Alternative Flows

- Dữ liệu không hợp lệ: từ chối cập nhật.
- Project đã Archived: từ chối thao tác thông thường.
- Người dùng không có quyền: từ chối thao tác.

---

## UC-010: Activate Project

**Primary Actor:** Admin / Leader  
**Priority:** High

### Description

Cho phép kích hoạt Project từ trạng thái Created sang Active.

### Preconditions

- Project tồn tại.
- Project đang ở trạng thái Created.
- Actor có quyền Activate Project.

### Trigger

Actor chọn Activate Project.

### Main Flow

1. Actor mở Project Details.
2. Actor chọn Activate.
3. Hệ thống kiểm tra quyền.
4. Hệ thống kiểm tra trạng thái Project.
5. Hệ thống kiểm tra Project Active hiện tại.
6. Nếu không tồn tại Project Active khác, hệ thống cập nhật Project sang Active.
7. Hệ thống ghi nhận Activity Log.
8. Hệ thống hiển thị kết quả.

### Alternative Flows

**A1. Another Active Project Exists**

- Hệ thống từ chối kích hoạt.
- Hệ thống thông báo Workspace đã có Project Active.

**A2. Project Not Eligible**

- Nếu Project không ở trạng thái Created, hệ thống từ chối thao tác.

### Postconditions

- Project chuyển sang Active nếu thành công.

---

## UC-011: Archive Project

**Primary Actor:** Admin / Leader  
**Priority:** High

### Description

Cho phép lưu trữ Project đã kết thúc hoặc không còn được triển khai.

### Preconditions

- Project tồn tại.
- Actor có quyền Archive Project.

### Trigger

Actor chọn Archive Project.

### Main Flow

1. Actor mở Project Details.
2. Actor chọn Archive.
3. Hệ thống hiển thị xác nhận.
4. Actor xác nhận.
5. Hệ thống kiểm tra quyền.
6. Hệ thống kiểm tra điều kiện Archive.
7. Hệ thống cập nhật Project sang Archived.
8. Hệ thống hạn chế các thao tác nghiệp vụ thông thường.
9. Hệ thống giữ lại dữ liệu và lịch sử.
10. Hệ thống ghi nhận Activity Log.

### Alternative Flows

- Actor không có quyền: từ chối thao tác.
- Project không đáp ứng điều kiện Archive: hiển thị lý do.

### Postconditions

- Project chuyển sang Archived.
- Dữ liệu và lịch sử vẫn được giữ lại.

**[CHƯA XÁC ĐỊNH]** Điều kiện bắt buộc trước khi Archive Project.

---

## UC-012: Manage Project Members

**Primary Actor:** Leader  
**Priority:** High

### Description

Cho phép Leader thêm hoặc loại bỏ thành viên trong Project.

### Preconditions

- Leader đã đăng nhập.
- Project tồn tại và chưa Archived.
- Leader có quyền quản lý thành viên.

### Trigger

Leader mở Project Members.

### Main Flow

1. Leader mở Project Members.
2. Hệ thống hiển thị danh sách thành viên.
3. Leader chọn Add Member hoặc Remove Member.
4. Nếu Add Member:
   - Hệ thống hiển thị tài khoản hợp lệ.
   - Leader chọn thành viên.
   - Hệ thống kiểm tra tài khoản.
   - Hệ thống thêm thành viên vào Project.
5. Nếu Remove Member:
   - Leader chọn thành viên.
   - Hệ thống hiển thị xác nhận.
   - Leader xác nhận.
   - Hệ thống kiểm tra các Task đang được giao.
   - Nếu còn Task đang được giao cho thành viên, Leader phải phân công lại tất cả Task đó trước; nếu còn Task chưa được reassign, hệ thống từ chối Remove.
   - Chỉ sau khi không còn Task đang được giao, hệ thống mới cho phép Remove Member.
6. Hệ thống ghi nhận lịch sử thay đổi.
7. Hệ thống cập nhật danh sách thành viên.

### Alternative Flows

- Tài khoản không Active: không cho phép thêm.
- Thành viên đã thuộc Project: không thêm trùng.
- Thành viên không thuộc Project: không thực hiện Remove.

Task đang được giao phải được Leader phân công lại trước khi loại bỏ thành viên.

---

# 5. TASK MANAGEMENT

## UC-013: Create Task

**Primary Actor:** Leader  
**Priority:** High

### Description

Cho phép Leader tạo Task mới trong Project.

### Preconditions

- Leader đã đăng nhập.
- Project tồn tại và chưa Archived.
- Leader có quyền Create Task.

### Trigger

Leader chọn Create Task.

### Main Flow

1. Leader mở Task Management.
2. Leader chọn Create Task.
3. Hệ thống hiển thị biểu mẫu.
4. Leader nhập Task Title.
5. Leader nhập Description.
6. Leader chọn Priority.
7. Leader chọn Assignees nếu muốn; có thể để trống để phân công sau.
8. Leader nhập Start Date nếu cần.
9. Leader nhập Deadline.
10. Leader nhập Estimate theo giờ nếu cần (Time-based Estimate).
11. Leader thiết lập Dependencies nếu cần.
12. Leader chọn Sprint hoặc để Task trong Backlog.
13. Leader gửi biểu mẫu.
14. Hệ thống kiểm tra dữ liệu.
15. Nếu có Assignees, hệ thống kiểm tra các Assignees thuộc Project và có trạng thái tài khoản phù hợp.
16. Hệ thống kiểm tra Dependency.
17. Hệ thống kiểm tra Sprint Assignment.
18. Hệ thống tạo Task với trạng thái TODO.
19. Hệ thống lưu lịch sử tạo Task.
20. Nếu Task có Assignees, hệ thống gửi Notification đến các Assignees; nếu chưa có Assignee thì bỏ qua bước gửi Notification giao Task.

### Alternative Flows

- Thiếu Title: từ chối tạo Task.
- Thiếu Deadline: từ chối tạo Task.
- Start Date sau Deadline: từ chối tạo Task.
- Assignee không hợp lệ: từ chối hoặc yêu cầu chọn lại.
- Không chọn Assignee: vẫn cho phép tạo Task; Leader có thể phân công sau bằng UC-015.
- Sprint thuộc Project khác: từ chối gán Sprint.
- Dependency không hợp lệ: từ chối thiết lập Dependency.

### Postconditions

- Task được tạo thành công.
- Task thuộc đúng Project.
- Task có trạng thái TODO.
- Assignee nhận thông báo nếu có.

---

## UC-014: Update Task

**Primary Actor:** Authorized User  
**Priority:** High

### Description

Cho phép người dùng có quyền cập nhật thông tin hoặc trạng thái Task.

### Preconditions

- Người dùng đã đăng nhập.
- Task tồn tại.
- Người dùng có quyền cập nhật trường thông tin tương ứng.
- Project chưa Archived.

### Trigger

Người dùng chọn Edit Task.

### Main Flow

1. Người dùng mở Task Details.
2. Hệ thống kiểm tra quyền.
3. Hệ thống hiển thị thông tin Task.
4. Người dùng chỉnh sửa thông tin được phép.
5. Người dùng lưu thay đổi.
6. Hệ thống kiểm tra dữ liệu.
7. Hệ thống cập nhật Task.
8. Hệ thống ghi nhận Task History.
9. Hệ thống hiển thị kết quả.

### Alternative Flows

- Người dùng không có quyền: từ chối thao tác.
- Dữ liệu không hợp lệ: hiển thị lỗi.
- Task đã bị thay đổi bởi người khác: yêu cầu tải lại hoặc xử lý xung đột.

**Quy tắc đã chốt (`DEC-015`):** Member được giao Task chỉ được cập nhật `Status` (`TODO -> IN_PROGRESS -> REVIEW`) và `Reference Links / ghi chú tiến độ`; các trường `Title`, `Description`, `Priority`, `Deadline`, `Estimate`, `Assignees`, `Dependencies` và `Sprint` bị khóa đối với Member.

---

## UC-015: Assign Task

**Primary Actor:** Leader  
**Priority:** High

### Description

Cho phép Leader gán hoặc thay đổi Assignee của Task.

### Preconditions

- Task tồn tại.
- Leader có quyền Assign Task.
- Các tài khoản được chọn hợp lệ và thuộc Project.

### Trigger

Leader chọn Manage Assignees.

### Main Flow

1. Leader mở Task Details.
2. Leader chọn Manage Assignees.
3. Hệ thống hiển thị Assignees hiện tại.
4. Leader thêm hoặc loại bỏ Assignee.
5. Leader xác nhận thay đổi.
6. Hệ thống kiểm tra tính hợp lệ.
7. Hệ thống cập nhật Task Assignees.
8. Hệ thống ghi nhận Assignment History.
9. Hệ thống gửi thông báo đến các Assignee mới được thêm.

### Alternative Flows

- Assignee không thuộc Project: từ chối thêm.
- Assignee không Active: từ chối thêm.
- Assignee đã tồn tại: không thêm trùng.

### Postconditions

- Danh sách Assignee được cập nhật.

---

## UC-016: Submit Task for Review

**Primary Actor:** Member  
**Priority:** High

### Description

Cho phép Member gửi Task đang thực hiện đến Leader để kiểm tra.

### Preconditions

- Member đã đăng nhập.
- Member là Assignee của Task.
- Task đang ở trạng thái IN PROGRESS.
- Member có quyền Submit for Review.

### Trigger

Member chọn Submit for Review.

### Main Flow

1. Member mở Task Details.
2. Member kiểm tra thông tin Task.
3. Member chọn Submit for Review.
4. Hệ thống kiểm tra quyền.
5. Hệ thống kiểm tra trạng thái hiện tại.
6. Hệ thống yêu cầu xác nhận.
7. Member xác nhận.
8. Hệ thống cập nhật Task sang REVIEW.
9. Hệ thống lưu Task History.
10. Hệ thống tạo Notification cho Leader.
11. Hệ thống hiển thị kết quả.

### Alternative Flows

- Task không ở IN PROGRESS: từ chối.
- Member không phải Assignee: từ chối.
- Member không có quyền: từ chối.

### Postconditions

- Task chuyển sang REVIEW.
- Leader nhận thông báo.

---

## UC-017: Approve Task Review

**Primary Actor:** Leader  
**Priority:** High

### Description

Cho phép Leader phê duyệt Task đã được Member gửi Review.

### Preconditions

- Leader đã đăng nhập.
- Task đang ở REVIEW.
- Leader có quyền Review Task.

### Trigger

Leader chọn Approve.

### Main Flow

1. Leader mở danh sách Task chờ Review.
2. Leader chọn Task.
3. Hệ thống hiển thị Task Details.
4. Leader kiểm tra kết quả.
5. Leader chọn Approve.
6. Hệ thống yêu cầu nhập Reason.
7. Leader nhập lý do.
8. Leader xác nhận.
9. Hệ thống kiểm tra quyền.
10. Hệ thống kiểm tra Task vẫn ở REVIEW.
11. Hệ thống kiểm tra Reason hợp lệ.
12. Hệ thống kiểm tra tất cả predecessor Task (nếu có) đã ở trạng thái DONE.
13. Nếu mọi predecessor đều DONE hoặc Task không có Dependency, hệ thống chuyển Task sang DONE.
14. Hệ thống lưu Review Decision.
15. Hệ thống lưu Task History.
16. Hệ thống gửi Notification đến tất cả Assignees hiện tại (nếu có).
17. Hệ thống hiển thị kết quả.

### Alternative Flows

- Reason rỗng: yêu cầu nhập lại.
- Task không còn REVIEW: từ chối xử lý.
- Có ít nhất một predecessor chưa DONE: từ chối Approve; Task giữ nguyên trạng thái REVIEW và hiển thị các predecessor chưa hoàn thành.
- Leader không có quyền: từ chối thao tác.

### Postconditions

- Task chuyển sang DONE chỉ khi không có predecessor chưa DONE.
- Lý do Approve được lưu.
- Assignees hiện tại nhận thông báo nếu có.

---

## UC-018: Reject Task Review

**Primary Actor:** Leader  
**Priority:** High

### Description

Cho phép Leader từ chối Task đang chờ Review.

### Preconditions

- Leader đã đăng nhập.
- Task đang ở REVIEW.
- Leader có quyền Review Task.

### Trigger

Leader chọn Reject.

### Main Flow

1. Leader mở danh sách Task chờ Review.
2. Leader chọn Task.
3. Hệ thống hiển thị Task Details.
4. Leader kiểm tra kết quả.
5. Leader chọn Reject.
6. Hệ thống yêu cầu nhập Reason.
7. Leader nhập lý do.
8. Leader xác nhận.
9. Hệ thống kiểm tra quyền.
10. Hệ thống kiểm tra Task vẫn ở REVIEW.
11. Hệ thống kiểm tra Reason hợp lệ.
12. Hệ thống chuyển Task về IN PROGRESS.
13. Hệ thống lưu Review Decision.
14. Hệ thống lưu Task History.
15. Hệ thống gửi Notification đến tất cả Assignees.
16. Hệ thống hiển thị kết quả.

### Alternative Flows

- Reason rỗng: yêu cầu nhập lại.
- Task không còn REVIEW: từ chối xử lý.
- Có ít nhất một predecessor chưa DONE: từ chối Approve; Task giữ nguyên trạng thái REVIEW và hiển thị các predecessor chưa hoàn thành.
- Leader không có quyền: từ chối thao tác.

### Postconditions

- Task chuyển về IN PROGRESS.
- Lý do Reject được lưu.
- Assignees nhận thông báo.

---

## UC-019: View Task History

**Primary Actor:** Authorized User  
**Priority:** Medium

### Description

Cho phép người dùng có quyền xem lịch sử thay đổi của Task.

### Preconditions

- Task tồn tại.
- Người dùng có quyền xem Task.

### Trigger

Người dùng chọn History trong Task Details.

### Main Flow

1. Người dùng mở Task Details.
2. Người dùng chọn History.
3. Hệ thống tải lịch sử Task.
4. Hệ thống sắp xếp lịch sử theo thời gian.
5. Hệ thống hiển thị người thực hiện, loại thay đổi, thời điểm và nội dung liên quan.

### Postconditions

- Không làm thay đổi dữ liệu Task.

---

# 6. SPRINT MANAGEMENT

## UC-020: Create Sprint

**Primary Actor:** Leader  
**Priority:** High

### Description

Cho phép Leader tạo Sprint mới trong Project.

### Preconditions

- Leader có quyền Manage Sprint.
- Project tồn tại và chưa Archived.

### Trigger

Leader chọn Create Sprint.

### Main Flow

1. Leader mở Sprint Management.
2. Leader chọn Create Sprint.
3. Hệ thống hiển thị biểu mẫu.
4. Leader nhập Sprint Name.
5. Leader nhập Sprint Goal.
6. Leader nhập Start Date.
7. Leader nhập End Date.
8. Leader gửi biểu mẫu.
9. Hệ thống kiểm tra dữ liệu.
10. Hệ thống tạo Sprint với trạng thái PLANNED.
11. Hệ thống ghi nhận Activity Log.

### Alternative Flows

- Thiếu Sprint Name: từ chối.
- Thiếu ngày bắt đầu hoặc kết thúc: từ chối.
- Start Date sau End Date: từ chối.
- Leader không có quyền: từ chối.

### Postconditions

- Sprint được tạo trong Project.
- Sprint có trạng thái PLANNED.

---

## UC-021: Manage Backlog

**Primary Actor:** Leader  
**Priority:** High

### Description

Cho phép Leader quản lý các Task chưa được đưa vào Sprint.

### Preconditions

- Leader có quyền quản lý Task.
- Project tồn tại.

### Trigger

Leader mở Backlog.

### Main Flow

1. Leader mở Project.
2. Leader chọn Backlog.
3. Hệ thống hiển thị các Task chưa thuộc Sprint.
4. Leader có thể xem Task.
5. Leader có thể tạo Task mới.
6. Leader có thể chỉnh sửa Task theo quyền.
7. Leader có thể chọn Task để đưa vào Sprint Planning.

### Postconditions

- Backlog phản ánh các Task chưa được gán Sprint.

---

## UC-022: Plan Sprint

**Primary Actor:** Leader  
**Priority:** High

### Description

Cho phép Leader lựa chọn Task từ Backlog và đưa vào Sprint.

### Preconditions

- Sprint tồn tại.
- Sprint thuộc Project hiện tại.
- Leader có quyền Sprint Planning.
- Task được chọn thuộc cùng Project.

### Trigger

Leader mở Sprint Planning.

### Main Flow

1. Leader chọn Sprint.
2. Hệ thống hiển thị thông tin Sprint.
3. Hệ thống hiển thị Backlog.
4. Leader chọn một hoặc nhiều Task.
5. Leader xác nhận lựa chọn.
6. Hệ thống kiểm tra Project của Task.
7. Hệ thống kiểm tra Sprint Assignment hiện tại.
8. Hệ thống thêm Task vào Sprint.
9. Hệ thống lưu Sprint Assignment History.
10. Hệ thống cập nhật Sprint Overview.

### Alternative Flows

- Task thuộc Project khác: từ chối.
- Task đã thuộc Sprint khác: từ chối hoặc yêu cầu xử lý việc chuyển Sprint.
- Sprint không tồn tại: từ chối thao tác.

### Postconditions

- Task được gán vào Sprint nếu hợp lệ.

---

## UC-023: View Sprint Overview

**Primary Actor:** Authorized User  
**Priority:** Medium

### Description

Cho phép người dùng xem tình hình Sprint.

### Preconditions

- Sprint tồn tại.
- Người dùng có quyền xem Project.

### Trigger

Người dùng chọn Sprint.

### Main Flow

1. Người dùng mở Sprint Management.
2. Người dùng chọn Sprint.
3. Hệ thống tải dữ liệu Sprint.
4. Hệ thống hiển thị:
   - Sprint Name.
   - Sprint Goal.
   - Start Date.
   - End Date.
   - Sprint Status.
   - Total Tasks.
   - Completed Tasks.
   - In Progress Tasks.
   - Review Tasks.
   - Sprint Progress.

### Postconditions

- Không làm thay đổi dữ liệu Sprint.

---

# 7. KANBAN BOARD

## UC-024: View Kanban Board

**Primary Actor:** Authorized User  
**Priority:** High

### Description

Cho phép người dùng xem Task dưới dạng Kanban Board.

### Preconditions

- Người dùng đã đăng nhập.
- Người dùng có quyền xem Project.

### Trigger

Người dùng mở Kanban Board.

### Main Flow

1. Người dùng mở Project.
2. Người dùng chọn Kanban Board.
3. Hệ thống xác định phạm vi hiển thị.
4. Hệ thống tải danh sách Task.
5. Hệ thống phân loại Task theo Status.
6. Hệ thống hiển thị bốn cột:
   - TODO.
   - IN PROGRESS.
   - REVIEW.
   - DONE.
7. Người dùng có thể chọn Task để xem chi tiết.

### Alternative Flows

- Không có Task: hiển thị Empty State.
- Không có quyền: từ chối truy cập.

---

## UC-025: Filter Tasks

**Primary Actor:** Authorized User  
**Priority:** High

### Description

Cho phép người dùng lọc Task theo các tiêu chí.

### Preconditions

- Người dùng đang xem Task List hoặc Kanban Board.

### Trigger

Người dùng chọn Filter.

### Main Flow

1. Người dùng mở bộ lọc.
2. Người dùng chọn Sprint.
3. Người dùng chọn Assignee.
4. Người dùng chọn Priority.
5. Người dùng chọn Deadline.
6. Người dùng chọn Status nếu có.
7. Hệ thống áp dụng điều kiện lọc.
8. Hệ thống hiển thị danh sách Task phù hợp.

### Alternative Flows

- Không có kết quả: hiển thị Empty State.
- Người dùng xóa Filter: hiển thị danh sách theo phạm vi ban đầu.

---

# 8. DOCUMENT LIBRARY

## UC-026: Manage Documents

**Primary Actor:** Authorized User  
**Priority:** High

### Description

Cho phép người có quyền tạo, xem, cập nhật và xóa Document Record.

### Preconditions

- Người dùng đã đăng nhập.
- Người dùng có quyền quản lý tài liệu.

### Trigger

Người dùng mở Document Library.

### Main Flow

1. Người dùng mở Document Library.
2. Hệ thống hiển thị danh sách tài liệu.
3. Người dùng chọn Add Document.
4. Hệ thống hiển thị biểu mẫu.
5. Người dùng nhập Document Name.
6. Người dùng nhập Description.
7. Người dùng nhập Google Drive URL.
8. Người dùng chọn Category.
9. Người dùng chọn Project liên quan.
10. Người dùng chọn Sprint nếu cần.
11. Người dùng lưu thông tin.
12. Hệ thống kiểm tra dữ liệu.
13. Hệ thống lưu Document Record.
14. Hệ thống cập nhật danh sách.

### Alternative Flows

- URL không hợp lệ: từ chối lưu.
- Category không hợp lệ: yêu cầu chọn lại.
- Project hoặc Sprint không hợp lệ: từ chối lưu.
- Người dùng không có quyền: từ chối thao tác.

### Postconditions

- Document Record được tạo hoặc cập nhật thành công.

**Lưu ý:** Xóa Document Record không xóa file gốc trên Google Drive.

---

## UC-027: Open Document

**Primary Actor:** Authorized User  
**Priority:** High

### Description

Cho phép người dùng mở tài liệu được liên kết.

### Preconditions

- Document Record tồn tại.
- Người dùng có quyền xem tài liệu.
- Google Drive URL được lưu trong hệ thống.

### Trigger

Người dùng chọn Open Document.

### Main Flow

1. Người dùng mở Document Library.
2. Người dùng chọn tài liệu.
3. Người dùng chọn Open.
4. Hệ thống lấy Google Drive URL.
5. Hệ thống mở URL trong tab mới.

### Alternative Flows

- URL không hợp lệ: hiển thị thông báo.
- Người dùng không có quyền truy cập file trên Google Drive: Google Drive hiển thị yêu cầu quyền truy cập.
- Tài liệu đã bị xóa hoặc di chuyển: người dùng nhận thông báo từ dịch vụ bên ngoài.

### Postconditions

- Tài liệu được mở nếu URL và quyền truy cập hợp lệ.

---

# 9. NOTIFICATION MANAGEMENT

## UC-028: View Notifications

**Primary Actor:** User  
**Priority:** High

### Description

Cho phép người dùng xem các thông báo của mình.

### Preconditions

- Người dùng đã đăng nhập.

### Trigger

Người dùng mở Notification Center.

### Main Flow

1. Người dùng chọn Notification Center.
2. Hệ thống tải danh sách thông báo thuộc người dùng.
3. Hệ thống hiển thị thông báo theo thời gian.
4. Hệ thống phân biệt trạng thái READ và UNREAD.
5. Người dùng chọn một thông báo.
6. Hệ thống có thể điều hướng đến đối tượng liên quan nếu có.

### Postconditions

- Danh sách thông báo được hiển thị.

---

## UC-029: Manage Notification Read Status

**Primary Actor:** User  
**Priority:** High

### Description

Cho phép người dùng cập nhật trạng thái đọc của thông báo.

### Preconditions

- Người dùng đã đăng nhập.
- Thông báo thuộc về người dùng.

### Trigger

Người dùng chọn Mark as Read hoặc Mark All as Read.

### Main Flow

1. Người dùng mở Notification Center.
2. Người dùng chọn thông báo hoặc Mark All as Read.
3. Hệ thống xác định phạm vi thông báo.
4. Hệ thống kiểm tra quyền sở hữu.
5. Hệ thống cập nhật trạng thái READ.
6. Hệ thống cập nhật số lượng thông báo chưa đọc.

### Alternative Flows

- Thông báo không thuộc người dùng: từ chối thao tác.
- Thông báo không tồn tại: hiển thị thông báo phù hợp.

### Postconditions

- Trạng thái đọc được cập nhật.

---

# 10. DASHBOARD AND REPORTING

## UC-030: View Dashboard

**Primary Actor:** Authorized User  
**Priority:** High

### Description

Cho phép người dùng xem Dashboard tổng quan.

### Preconditions

- Người dùng đã đăng nhập.
- Người dùng có quyền xem Dashboard.
- Có dữ liệu Project phù hợp với phạm vi truy cập.

### Trigger

Người dùng mở Dashboard.

### Main Flow

1. Người dùng mở Dashboard.
2. Hệ thống xác định Project và phạm vi dữ liệu được phép xem.
3. Hệ thống tổng hợp các chỉ số.
4. Hệ thống hiển thị:
   - Total Tasks.
   - Completed Tasks.
   - Overdue Tasks.
   - Tasks Waiting for Review.
   - In Progress Tasks.
   - Project Progress.
   - Member Progress.
   - Recent Activities.
5. Hệ thống cập nhật dữ liệu theo thời điểm truy vấn.

### Alternative Flows

- Không có Project: hiển thị trạng thái Empty.
- Không có dữ liệu: hiển thị giá trị phù hợp.
- Người dùng không có quyền: từ chối truy cập.

---

## UC-031: View Reports

**Primary Actor:** Authorized User  
**Priority:** Medium

### Description

Cho phép người dùng xem báo cáo tiến độ và hoạt động.

### Preconditions

- Người dùng có quyền xem Reports.
- Dữ liệu báo cáo tồn tại.

### Trigger

Người dùng mở Reporting.

### Main Flow

1. Người dùng mở Reporting.
2. Hệ thống hiển thị các loại báo cáo được phép.
3. Người dùng chọn báo cáo.
4. Người dùng chọn phạm vi thời gian hoặc Sprint nếu được hỗ trợ.
5. Hệ thống tổng hợp dữ liệu.
6. Hệ thống hiển thị kết quả.

### Report Types

- Task Report.
- Member Contribution Report.
- Sprint Progress.
- Sprint Burndown Chart.

### Alternative Flows

- Không đủ dữ liệu Estimate: không thể tính Burndown chính xác.
- Không có dữ liệu: hiển thị Empty State.
- Không có quyền: từ chối truy cập.

### Postconditions

- Báo cáo được hiển thị dựa trên dữ liệu thực tế.

---

## UC-032: View Activity History

**Primary Actor:** Authorized User  
**Priority:** Medium

### Description

Cho phép người dùng có quyền xem lịch sử hoạt động.

### Preconditions

- Người dùng đã đăng nhập.
- Người dùng có quyền xem Activity History.

### Trigger

Người dùng mở Activity History.

### Main Flow

1. Người dùng mở Activity History.
2. Hệ thống kiểm tra quyền.
3. Hệ thống tải các hoạt động trong phạm vi được phép.
4. Hệ thống sắp xếp theo thời gian.
5. Hệ thống hiển thị:
   - Actor.
   - Activity Type.
   - Related Object.
   - Timestamp.
   - Description.

### Alternative Flows

- Không có hoạt động: hiển thị Empty State.
- Không có quyền: từ chối truy cập.

---

# 11. USER PROFILE

## UC-033: Manage User Profile

**Primary Actor:** User  
**Priority:** Medium

### Description

Cho phép người dùng xem và cập nhật thông tin hồ sơ cá nhân.

### Preconditions

- Người dùng đã đăng nhập.

### Trigger

Người dùng mở Profile.

### Main Flow

1. Người dùng mở Profile.
2. Hệ thống tải thông tin tài khoản.
3. Hệ thống hiển thị thông tin cá nhân.
4. Người dùng chọn Edit Profile.
5. Người dùng cập nhật thông tin được phép.
6. Người dùng lưu thay đổi.
7. Hệ thống kiểm tra dữ liệu.
8. Hệ thống lưu thông tin mới.
9. Hệ thống hiển thị kết quả.

### Alternative Flows

- Dữ liệu không hợp lệ: hiển thị lỗi.
- Người dùng cố thay đổi trường không được phép: từ chối cập nhật.

**Quy tắc đã chốt (`DEC-018`):** User chỉ được cập nhật `Full Name` và đổi `Password` (yêu cầu nhập `Current Password` và tuân thủ Password Policy: tối thiểu 8 ký tự gồm chữ hoa, chữ thường, số và ký tự đặc biệt); `Email`, `Role` và `Account Status` bị khóa.

---

## UC-034: Restore Archived Project

**Primary Actor:** Admin  
**Priority:** High

### Description
Cho phép Admin khôi phục Project đã Archived.

### Preconditions
- Admin đã đăng nhập và có quyền Restore Project.
- Project tồn tại và đang ở trạng thái ARCHIVED.

### Main Flow
1. Admin mở danh sách Project Archived.
2. Admin chọn Project cần khôi phục.
3. Admin chọn Restore.
4. Hệ thống xác nhận quyền Admin.
5. Hệ thống kiểm tra trạng thái Project.
6. Nếu khôi phục về ACTIVE, hệ thống kiểm tra Workspace chưa có Project ACTIVE khác.
7. Hệ thống cập nhật trạng thái Project theo lựa chọn hợp lệ.
8. Hệ thống ghi Activity Log và thông báo kết quả.

### Alternative Flows
- Actor không phải Admin: từ chối thao tác.
- Project không ở trạng thái ARCHIVED: từ chối thao tác.
- Đã có Project ACTIVE khác: không cho phép khôi phục Project này sang ACTIVE cho đến khi xử lý xung đột.

### Postconditions
Project được khôi phục và toàn bộ dữ liệu, lịch sử được giữ nguyên.


---

## UC-035: Complete Sprint

**Primary Actor:** Leader  
**Priority:** High

### Description

Cho phép Leader kết thúc Sprint sau khi xem xét và quyết định cách xử lý từng Task chưa hoàn thành.

### Preconditions

- Leader đã đăng nhập và có quyền Manage Sprint.
- Sprint tồn tại và thuộc Project mà Leader được phép quản lý.
- Sprint đang ở trạng thái ACTIVE.

### Trigger

Leader chọn Complete Sprint.

### Main Flow

1. Leader mở Sprint Overview.
2. Leader chọn Complete Sprint.
3. Hệ thống hiển thị danh sách Task thuộc Sprint, bao gồm các Task chưa DONE.
4. Leader xem xét từng Task chưa hoàn thành và chọn cách xử lý phù hợp cho từng Task.
5. Hệ thống kiểm tra các lựa chọn xử lý hợp lệ theo quy tắc Sprint Assignment và quyền hiện tại.
6. Leader xác nhận hoàn tất Sprint.
7. Hệ thống cập nhật các Sprint Assignment theo quyết định của Leader và lưu lịch sử thay đổi.
8. Hệ thống chuyển Sprint sang COMPLETED.
9. Hệ thống ghi Activity Log và hiển thị kết quả.

### Alternative Flows

- Sprint không ở trạng thái ACTIVE: từ chối hoàn tất.
- Leader chưa đưa ra quyết định cho một hoặc nhiều Task chưa DONE: yêu cầu xử lý các Task còn thiếu quyết định; không tự động chuyển Task.
- Lựa chọn xử lý vi phạm quy tắc Project/Sprint hoặc quyền truy cập: từ chối lựa chọn không hợp lệ.

### Postconditions

- Sprint chuyển sang COMPLETED.
- Quyết định xử lý từng Task chưa hoàn thành được lưu.
- Các thay đổi Sprint Assignment có lịch sử truy vết.
- Không có Task nào bị tự động chuyển Backlog hoặc sang Sprint khác.

---

# 12. USE CASE SECURITY REQUIREMENTS

Mọi Use Case yêu cầu xác thực phải tuân thủ các nguyên tắc:

1. Kiểm tra phiên đăng nhập.
2. Kiểm tra trạng thái tài khoản.
3. Kiểm tra Role và Permission.
4. Kiểm tra phạm vi truy cập Project.
5. Kiểm tra quyền sở hữu hoặc quan hệ với dữ liệu.
6. Kiểm tra dữ liệu đầu vào.
7. Ghi nhận lịch sử đối với các thao tác quan trọng.

Không được chỉ kiểm soát quyền ở giao diện Client.

---

# 13. USE CASE TESTING REFERENCE

Các Use Case phải được liên kết với Test Cases tương ứng.

| Use Case ID | Main Test Scenarios |
|---|---|
| UC-001 | Valid Registration, Duplicate Email, Invalid Input |
| UC-002 | Valid Login, Invalid Password, Pending Account, Suspended Account |
| UC-003 | Successful Logout, Invalidated Session |
| UC-004 | View Users, Search Users, Unauthorized Access |
| UC-005 | Approve Account, Reject Account, Processed Account |
| UC-006 | Update Permission, Invalid Permission, Last Admin Protection |
| UC-007 | Valid Project, Missing Leader, Invalid Dates |
| UC-008 | Authorized View, Unauthorized View |
| UC-009 | Valid Update, Invalid Update, Archived Project |
| UC-010 | Successful Activation, Existing Active Project |
| UC-011 | Successful Archive, Unauthorized Archive |
| UC-012 | Add Member, Duplicate Member, Remove Member |
| UC-013 | Valid Task, Missing Deadline, Invalid Assignee, Create without Assignees |
| UC-014 | Valid Update, Invalid Update, Permission Denied |
| UC-015 | Add Assignee, Remove Assignee, Invalid Assignee |
| UC-016 | Valid Review Submission, Invalid Status, Unauthorized Submission |
| UC-017 | Approve Review, Missing Reason, Invalid Task Status, Predecessor not DONE |
| UC-018 | Reject Review, Missing Reason, Invalid Task Status |
| UC-019 | View History, Unauthorized History Access |
| UC-020 | Create Sprint, Invalid Date Range |
| UC-021 | View Backlog, Create Backlog Task |
| UC-022 | Valid Sprint Planning, Wrong Project, Duplicate Sprint Assignment |
| UC-023 | View Sprint Overview, Empty Sprint |
| UC-024 | View Kanban, Empty Board, Unauthorized Access |
| UC-025 | Filter by Sprint, Assignee, Priority, Deadline |
| UC-026 | Create Document, Invalid URL, Invalid Category |
| UC-027 | Open Valid URL, Invalid URL, Inaccessible File |
| UC-028 | View Notifications, Empty Notification List |
| UC-029 | Mark One Read, Mark All Read, Unauthorized Notification |
| UC-030 | View Dashboard, Empty Project |
| UC-031 | View Reports, Insufficient Estimate Data |
| UC-032 | View Activity History, Unauthorized Access |
| UC-033 | Update Profile, Invalid Input, Restricted Field |
| UC-034 | Restore Archived Project, Unauthorized Restore, Active Project Conflict |
| UC-035 | Complete Sprint, Unresolved Unfinished Task Disposition, Assignment History |

---

# 14. UNRESOLVED USE CASE DECISIONS

Các nội dung sau cần được xác nhận trước khi hoàn thiện đặc tả chi tiết:

| ID | Topic | Missing Information |
|---|---|---|
| TBD-UC-001 | Account Creation | Admin có được tạo tài khoản trực tiếp không? |
| TBD-UC-002 | Email Verification | Có yêu cầu xác minh Email không? |
| TBD-UC-003 | Profile | Người dùng được sửa những trường nào? |
| TBD-UC-004 | Instructor | Instructor có được nhận xét Task không? |
| TBD-UC-005 | Member Task Editing | Member được sửa những trường nào? |
| TBD-UC-006 | Project Archive | Điều kiện Archive Project cụ thể? |
| TBD-UC-013 | Sprint Cancellation | Task được xử lý thế nào khi Sprint bị hủy? |
| TBD-UC-014 | Task Cancellation | Có hỗ trợ hủy Task không? |
| TBD-UC-015 | Document Permission | Member có được thêm Document Record không? |
| TBD-UC-016 | Notification | Có thông báo Deadline sắp đến không? |
| TBD-UC-017 | Reporting | Công thức tính Project và Sprint Progress? |
| TBD-UC-018 | Contribution Report | Các chỉ số đóng góp cụ thể? |

---

# 15. DOCUMENT CHANGE HISTORY

| Version | Date | Description |
|---|---|---|
| 1.0 | November 2026 | Initial Use Case Specification Draft |
| 1.1 | 15 November 2026 | Bổ sung kiểm tra Dependency tại UC-017, thêm UC-035 Complete Sprint và đồng bộ Assignees tùy chọn |

---

**END OF USE CASE SPECIFICATION**
