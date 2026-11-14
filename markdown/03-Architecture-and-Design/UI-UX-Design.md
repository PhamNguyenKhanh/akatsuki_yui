# UI/UX DESIGN SPECIFICATION
## Akatsuki Yui – Team & Project Management System

**Document Version:** 1.0  
**Document Status:** Draft  
**Project Name:** Akatsuki Yui  
**Document Type:** UI/UX Design Specification

---

# 1. Introduction

## 1.1. Purpose

Tài liệu này mô tả các yêu cầu về giao diện người dùng (UI) và trải nghiệm người dùng (UX) của hệ thống Akatsuki Yui.

Mục tiêu là xác định cấu trúc giao diện, hệ thống điều hướng, danh sách màn hình, thành phần giao diện, hành vi tương tác và nguyên tắc thiết kế nhằm đảm bảo hệ thống dễ sử dụng, nhất quán và phù hợp với nhu cầu quản lý dự án nhóm.

## 1.2. Scope

Tài liệu bao gồm:

- Nguyên tắc thiết kế UI/UX.
- Cấu trúc Layout và Navigation.
- Sitemap và danh sách màn hình.
- Đặc tả giao diện theo từng module.
- Các thành phần UI dùng chung.
- Quy tắc tương tác và phản hồi.
- Responsive Design.
- Accessibility.
- UI/UX Acceptance Criteria.

## 1.3. Design Goals

Giao diện cần đáp ứng các mục tiêu:

1. Dễ học và dễ sử dụng đối với thành viên trong nhóm.
2. Giúp người dùng nhanh chóng nắm được tình trạng dự án.
3. Giảm số thao tác cần thiết để thực hiện các công việc thường xuyên.
4. Hiển thị thông tin rõ ràng, có thứ tự ưu tiên.
5. Đảm bảo trải nghiệm nhất quán giữa các module.
6. Hỗ trợ Desktop, Tablet và Mobile.
7. Phù hợp với quy mô một nhóm làm đồ án, tránh thiết kế quá phức tạp.

---

# 2. UI/UX Design Principles

## 2.1. Simplicity

- Ưu tiên giao diện đơn giản, dễ hiểu.
- Hạn chế hiệu ứng chuyển động không cần thiết.
- Không sử dụng quá nhiều màu sắc hoặc thành phần trang trí.
- Không hiển thị quá nhiều thông tin trên cùng một màn hình.
- Các chức năng chính cần dễ tìm và dễ truy cập.

## 2.2. Consistency

- Các trang phải sử dụng chung hệ thống màu sắc, typography, spacing và component.
- Các nút có cùng mục đích phải có cách hiển thị và hành vi nhất quán.
- Các biểu mẫu phải tuân theo cùng một quy tắc.
- Các trạng thái Task, Sprint, Project phải sử dụng cách biểu diễn thống nhất.

## 2.3. Usability

- Các thao tác thường xuyên phải dễ thực hiện.
- Thông tin quan trọng như Deadline, Priority và Status cần dễ nhận biết.
- Form phải có Label và hướng dẫn rõ ràng.
- Các thao tác có ảnh hưởng lớn đến dữ liệu cần có bước xác nhận phù hợp.
- Người dùng phải nhận được phản hồi sau khi thực hiện thao tác.

## 2.4. Information Hierarchy

Thông tin cần được sắp xếp theo mức độ quan trọng:

1. Thông tin chính của trang.
2. Trạng thái và thông tin cần chú ý.
3. Nội dung và dữ liệu chính.
4. Các thao tác phụ và thông tin bổ sung.

## 2.5. Responsive Design

- Desktop là nền tảng giao diện ưu tiên.
- Tablet và Mobile phải có bố cục phù hợp với kích thước màn hình.
- Không để nội dung quan trọng bị cắt hoặc khó thao tác.
- Các bảng dữ liệu lớn cần có phương án hiển thị phù hợp trên màn hình nhỏ.

---

# 3. User Roles and Navigation

## 3.1. User Roles

Hệ thống có bốn vai trò:

| Role | UI Access |
|---|---|
| Admin | Quản lý tài khoản, quyền hạn và toàn bộ chức năng quản trị |
| Instructor | Theo dõi Project, Task, Sprint và Reports |
| Leader | Quản lý Project, Members, Tasks, Sprints và Reviews |
| Member | Theo dõi và cập nhật công việc được giao |

Việc hiển thị chức năng trên giao diện phải tuân theo Permission Matrix.

Ẩn một nút hoặc một trang trên giao diện không thay thế cho việc kiểm tra quyền ở Backend.

## 3.2. Main Navigation

Các nhóm điều hướng chính:

| Navigation | Description |
|---|---|
| Dashboard | Tổng quan tình hình Project |
| Projects | Danh sách và thông tin Project |
| Tasks | Danh sách Task |
| Kanban Board | Theo dõi Task theo trạng thái |
| Sprints | Quản lý Sprint và Backlog |
| Documents | Thư viện tài liệu |
| Notifications | Trung tâm thông báo |
| Reports | Báo cáo tiến độ |
| Profile | Thông tin tài khoản |

Các mục chỉ dành cho Admin:

| Navigation | Description |
|---|---|
| User Management | Quản lý tài khoản |
| Role & Permission Management | Quản lý Role và Permission |
| Activity Logs | Theo dõi hoạt động hệ thống |

## 3.3. Navigation Behavior

- Sidebar hiển thị các mục điều hướng phù hợp với quyền của người dùng.
- Mục đang được truy cập phải có trạng thái Active.
- Header hiển thị thông tin tài khoản và truy cập nhanh đến Notifications.
- Người dùng có thể quay lại trang trước hoặc sử dụng Breadcrumb khi phù hợp.
- Nếu người dùng không có quyền truy cập một trang, hệ thống phải hiển thị thông báo phù hợp hoặc trang Access Denied.

---

# 4. Application Layout

## 4.1. Main Layout

Ứng dụng sử dụng Dashboard Layout gồm ba khu vực:

1. Sidebar: Điều hướng chính.
2. Header: Thông tin tài khoản, Notifications và các thao tác chung.
3. Main Content: Nội dung của trang hiện tại.

## 4.2. Sidebar

Yêu cầu:

- Hiển thị Logo hoặc tên hệ thống.
- Hiển thị các mục Navigation.
- Có thể phân nhóm các chức năng.
- Phân biệt rõ mục đang được chọn.
- Các mục không có quyền truy cập không được hiển thị.
- Hỗ trợ thu gọn trên Desktop hoặc chuyển thành dạng điều hướng phù hợp trên màn hình nhỏ.

Chi tiết hành vi thu gọn Sidebar: [CHƯA XÁC ĐỊNH].

## 4.3. Header

Header cần có:

- Page Title hoặc Breadcrumb.
- Notification Icon.
- User Avatar hoặc User Menu.
- Profile Shortcut.
- Logout Action.

Không cần hiển thị quá nhiều thao tác không liên quan đến trang hiện tại.

## 4.4. Main Content

Khu vực nội dung chính bao gồm:

- Page Header.
- Page Description nếu cần.
- Primary Action.
- Filter hoặc Search nếu có.
- Main Content.
- Pagination nếu cần.

Các trang cần giữ bố cục nhất quán để người dùng dễ làm quen.

---

# 5. Sitemap

## 5.1. Public Pages

| Page | Description |
|---|---|
| Login | Đăng nhập |
| Register | Đăng ký tài khoản |
| Pending Approval | Thông báo chờ Admin phê duyệt |
| Account Rejected | Thông báo tài khoản bị từ chối |
| Access Denied | Không đủ quyền truy cập |
| Not Found | Không tìm thấy trang |

## 5.2. Authenticated Pages

| Module | Pages |
|---|---|
| Dashboard | Dashboard Overview |
| Project | Project List, Project Detail, Create Project, Edit Project |
| Member | Member List, Member Detail, Manage Members |
| Task | Task List, Task Detail, Create Task, Edit Task |
| Kanban | Kanban Board |
| Sprint | Sprint List, Sprint Detail, Create Sprint, Edit Sprint, Backlog |
| Document | Document Library, Create Document, Edit Document |
| Notification | Notification Center |
| Report | Project Report, Sprint Report, Member Contribution Report |
| Profile | My Profile, Edit Profile |

## 5.3. Admin Pages

| Module | Pages |
|---|---|
| User Management | User List, User Detail, Approve Account |
| Role Management | Role List, Permission Management |
| Activity Logs | Activity Log List, Activity Detail |

---

# 6. Screen Specifications

# 6.1. Authentication

## 6.1.1. Login Page

**Purpose:** Cho phép người dùng đăng nhập vào hệ thống.

### UI Components

- Application Logo hoặc Name.
- Email Input.
- Password Input.
- Show/Hide Password.
- Login Button.
- Register Link.

### Behavior

- Email và Password là trường bắt buộc.
- Hiển thị lỗi khi thông tin đăng nhập không hợp lệ.
- Hiển thị trạng thái Loading khi đang xử lý.
- Không cho phép gửi Form liên tục khi yêu cầu trước chưa hoàn tất.
- Nếu đăng nhập thành công, chuyển đến Dashboard.
- Nếu tài khoản chưa được phê duyệt, hiển thị Pending Approval.
- Nếu tài khoản bị từ chối hoặc tạm khóa, hiển thị thông báo phù hợp.

## 6.1.2. Register Page

**Purpose:** Cho phép người dùng tạo tài khoản mới.

### UI Components

- Full Name.
- Email.
- Password.
- Confirm Password.
- Register Button.
- Login Link.

### Behavior

- Kiểm tra các trường bắt buộc.
- Kiểm tra định dạng Email.
- Kiểm tra Password theo chính sách bảo mật.
- Confirm Password phải khớp Password.
- Sau khi đăng ký thành công, tài khoản ở trạng thái Pending.
- Hiển thị thông báo chờ Admin phê duyệt.

---

# 6.2. Dashboard

## 6.2.1. Dashboard Overview

**Purpose:** Cung cấp cái nhìn tổng quan về tình hình Project.

### UI Components

**Summary Cards:**

- Total Tasks.
- Completed Tasks.
- Overdue Tasks.
- Tasks Waiting for Review.
- Active Sprint.

**Progress Section:**

- Project Progress.
- Sprint Progress.
- Task Status Distribution.

**Activity Section:**

- Recent Activities.
- Recently Updated Tasks.
- Upcoming Deadlines.

**Chart Section:**

- Sprint Progress Chart.
- Burndown Chart khi có đủ dữ liệu.

### Behavior

- Dashboard hiển thị dữ liệu theo Project đang Active.
- Các chỉ số phải được tính từ dữ liệu thực tế.
- Các thành phần biểu đồ phải có nhãn và chú thích rõ ràng.
- Người dùng có thể nhấn vào Summary Card để chuyển đến danh sách dữ liệu tương ứng.
- Instructor có thể xem dữ liệu tổng quan để theo dõi tiến độ.
- Member chỉ xem những dữ liệu được phép truy cập.

---

# 6.3. Project Management

## 6.3.1. Project List

**Purpose:** Hiển thị danh sách Project.

### UI Components

- Project Name.
- Description.
- Project Status.
- Project Leader.
- Instructor.
- Start Date.
- End Date.
- Progress.
- Create Project Button (nếu có quyền).

### Behavior

- Hiển thị Project theo trạng thái.
- Hỗ trợ Search theo tên Project.
- Hỗ trợ Filter theo Status.
- Cho phép mở Project Detail.
- Project Archived phải được phân biệt với Project Active.
- Với Project đang `ARCHIVED`, chỉ **Admin** mới thấy nút **Restore Project** (`UC-034`); khi chọn khôi phục về `ACTIVE`, hiển thị cảnh báo nếu Workspace đã có Project `ACTIVE` khác.

## 6.3.2. Create Project

**Purpose:** Tạo Project mới.

### Form Fields

| Field | Type | Required |
|---|---|---|
| Project Name | Text | Yes |
| Description | Textarea | No |
| Project Template | Select | No |
| Start Date | Date | Yes |
| End Date | Date | Yes |
| Project Leader | Select | Yes |
| Instructor | Select | No |
| Members | Multi-select | No |
| Technologies | Tags/Input | No |
| Repository URL | URL Input | No |
| Objectives | Textarea | No |
| Scope | Textarea | No |

### Behavior

- Validate các trường bắt buộc.
- End Date phải lớn hơn hoặc bằng Start Date.
- Nếu Leader tạo Project, người tạo tự động được chọn làm Project Leader.
- Sau khi tạo thành công, chuyển đến Project Detail.

## 6.3.3. Project Detail

**Purpose:** Hiển thị thông tin chi tiết Project.

### UI Components

- Project Information.
- Project Status.
- Project Leader.
- Instructor.
- Members.
- Technologies.
- Repository Link.
- Objectives and Scope.
- Project Progress.
- Task Summary.
- Sprint Summary.
- Recent Activities.

### Behavior

- Chỉ người có quyền mới được chỉnh sửa Project.
- Chỉ **Admin** thấy thao tác **Restore Project** khi Project ở trạng thái `ARCHIVED` (`UC-034`), kèm chọn trạng thái khôi phục (`CREATED` hoặc `ACTIVE`) và cảnh báo nếu đã có Project `ACTIVE`.
- Repository URL mở liên kết bên ngoài.
- Các khu vực Task và Sprint có thể điều hướng đến module tương ứng.

---

# 6.4. Member Management

## 6.4.1. Member List

### UI Components

- Avatar.
- Full Name.
- Email.
- Role.
- Account Status.
- Assigned Task Count.
- Completed Task Count.
- View Detail Action.

### Behavior

- Hỗ trợ Search theo tên hoặc Email.
- Hỗ trợ Filter theo Role và Account Status.
- Leader có thể quản lý thành viên trong Project theo quyền được cấp.
- Instructor chỉ xem thông tin được phép.

## 6.4.2. Manage Project Members

### UI Components

- Current Members.
- Available Members.
- Add Member Action.
- Remove Member Action.
- Member Role Information.

### Behavior

- Chỉ cho phép thêm tài khoản đang Active.
- Xác nhận trước khi xóa thành viên khỏi Project.
- Không tự động xóa lịch sử Task của thành viên.
- Nếu thành viên đang có Task được giao, hệ thống phải xử lý theo Business Rule đã được xác định.

---

# 6.5. Task Management

## 6.5.1. Task List

**Purpose:** Hiển thị danh sách Task của Project.

### UI Components

- Task Code.
- Task Title.
- Status.
- Priority.
- Assignees.
- Sprint.
- Start Date.
- Deadline.
- Estimate.
- Actions.

### Filters

- Status.
- Priority.
- Assignee.
- Sprint.
- Deadline.
- Search by Task Title.

### Behavior

- Hỗ trợ sắp xếp theo Deadline, Priority và các trường phù hợp.
- Hiển thị rõ Task quá hạn.
- Người dùng chỉ được thực hiện thao tác phù hợp với Permission.
- Nhấn vào Task để mở Task Detail.

## 6.5.2. Create / Edit Task

### Form Fields

| Field | Type | Required |
|---|---|---|
| Task Title | Text | Yes |
| Description | Textarea | No |
| Priority | Select | Yes |
| Assignees | Multi-select | No |
| Start Date | Date | No |
| Deadline | Date | Yes |
| Estimate (Hours) | Number/Input | No |
| Dependencies | Task Multi-select | No |
| Sprint | Select | No |
| Reference Links | URL List | No |

### Behavior

- Deadline là trường bắt buộc.
- Start Date không bắt buộc.
- Nếu có Start Date, giá trị này không được lớn hơn Deadline.
- Assignees là tùy chọn khi tạo Task; nếu được chọn, Assignees phải thuộc Project và có trạng thái tài khoản phù hợp.
- Có thể tạo Task chưa có Assignee và phân công sau bằng chức năng Manage Assignees.
- Khi chưa có Assignee, không hiển thị trạng thái hoặc thông báo giao Task đã gửi.
- Task chỉ thuộc tối đa một Sprint tại cùng thời điểm.
- Estimate nhập theo giờ, không bắt buộc và chỉ nhận giá trị hợp lệ lớn hơn 0 nếu được cung cấp.
- Khi chuyển Task sang DONE, hiển thị lỗi và không cho hoàn thành nếu còn Task tiền nhiệm chưa DONE.
- Hiển thị lỗi ngay tại trường dữ liệu tương ứng.

## 6.5.3. Task Detail

### UI Components

**Task Information:**

- Task Title.
- Description.
- Status.
- Priority.
- Assignees.
- Start Date.
- Deadline.
- Estimate.
- Sprint.
- Dependencies.

**Task Actions:**

- Edit Task.
- Change Status.
- Submit for Review.
- Approve Review.
- Reject Review.

**Additional Sections:**

- Task History.
- Review History.
- Reference Links.
- Comments nếu được bổ sung trong phạm vi tương lai.

### Behavior

- Member có thể cập nhật Task theo quyền được cấp.
- Member có thể chuyển Task sang Review khi đáp ứng điều kiện.
- Leader có thể Approve hoặc Reject Task đang chờ Review.
- Leader bắt buộc nhập lý do khi Approve hoặc Reject.
- Lý do được lưu vào Task History.
- Assignees nhận Notification khi Leader xử lý Review.

---

# 6.6. Kanban Board

## 6.6.1. Kanban Overview

**Purpose:** Theo dõi Task theo trạng thái.

### Board Columns

1. TODO.
2. IN PROGRESS.
3. REVIEW.
4. DONE.

### Task Card Information

- Task Title.
- Task Code.
- Priority.
- Assignees.
- Deadline.
- Sprint.
- Overdue Indicator.

### Filters

- Sprint.
- Assignee.
- Priority.
- Deadline.

### Behavior

- Người dùng có thể chuyển đổi giữa Project Board và Sprint Board.
- Chỉ người có quyền mới được thay đổi trạng thái Task.
- Nếu hỗ trợ Drag and Drop, hệ thống phải kiểm tra quyền và Business Rules trước khi lưu trạng thái mới.
- Khi thao tác thất bại, giao diện phải khôi phục trạng thái hiển thị phù hợp.
- Task đang chờ Review cần được nhận biết rõ ràng.
- Không cho phép chuyển trạng thái tùy ý nếu không phù hợp với Workflow.

---

# 6.7. Sprint Management

## 6.7.1. Sprint List

### UI Components

- Sprint Name.
- Sprint Goal.
- Start Date.
- End Date.
- Sprint Status.
- Task Count.
- Completed Task Count.
- Progress.

### Behavior

- Hiển thị Sprint theo Project.
- Phân biệt Sprint Planned, Active, Completed hoặc các trạng thái được định nghĩa trong Business Rules.
- Cho phép mở Sprint Detail.
- Chỉ người có quyền mới được tạo hoặc chỉnh sửa Sprint.

## 6.7.2. Create / Edit Sprint

### Form Fields

| Field | Type | Required |
|---|---|---|
| Sprint Name | Text | Yes |
| Sprint Goal | Textarea | No |
| Start Date | Date | Yes |
| End Date | Date | Yes |

### Behavior

- End Date phải lớn hơn Start Date.
- Kiểm tra điều kiện tạo Sprint theo quy tắc Project.
- Hiển thị lỗi nếu Sprint không hợp lệ.

## 6.7.3. Sprint Detail

### UI Components

- Sprint Information.
- Sprint Goal.
- Sprint Status.
- Sprint Progress.
- Task Summary.
- Sprint Task Board.
- Burndown Chart.
- Sprint Activities.
- Nút **Complete Sprint** (hiển thị với Leader khi Sprint đang `ACTIVE`).

### Behavior

- Hiển thị Task thuộc Sprint.
- Cho phép chuyển Task từ Backlog vào Sprint trong Sprint Planning.
- Khi nhấn **Complete Sprint** (`UC-035`), mở modal hiển thị danh sách các Task chưa `DONE` để Leader chọn hướng xử lý từng Task (giữ lại Sprint, chuyển về Backlog hoặc chuyển sang Sprint khác); không tự động chuyển Task và chặn xác nhận nếu còn Task chưa chọn phương án.
- Hiển thị tiến độ dựa trên dữ liệu Task thực tế (Task Count theo `DEC-017`; Burndown Chart dùng Estimate Hours và hiển thị thông báo thiếu dữ liệu nếu chưa có Task nhập Estimate).
- Không tự động thay đổi lịch sử Sprint khi Task được chuyển đi hoặc chuyển đến.

## 6.7.4. Product Backlog

### UI Components

- Backlog Task List.
- Task Priority.
- Assignees.
- Deadline.
- Estimate.
- Add Task.
- Add to Sprint Action.

### Behavior

- Hiển thị các Task chưa thuộc Sprint.
- Leader có thể chọn nhiều Task để đưa vào Sprint.
- Kiểm tra điều kiện trước khi thêm Task.
- Không cho phép một Task thuộc nhiều Sprint cùng lúc.

---

# 6.8. Document Library

## 6.8.1. Document List

**Purpose:** Quản lý các liên kết tài liệu Google Drive.

### UI Components

- Document Name.
- Category.
- Project.
- Sprint.
- Description.
- Created By.
- Updated At.
- Open Document Action.

### Categories

- Project Documents.
- Design.
- Development.
- Meeting & Reports.
- Other.

### Filters

- Category.
- Project.
- Sprint.

### Behavior

- Hỗ trợ Search theo tên tài liệu.
- Hỗ trợ Filter theo Category.
- Không lưu trữ File trực tiếp.
- Chỉ lưu thông tin và Google Drive URL.
- Chỉ người có quyền mới được thêm, sửa hoặc xóa Document Record.

## 6.8.2. Create / Edit Document

### Form Fields

| Field | Type | Required |
|---|---|---|
| Document Name | Text | Yes |
| Google Drive URL | URL | Yes |
| Category | Select | Yes |
| Description | Textarea | No |
| Project | Select | Yes |
| Sprint | Select | No |

### Behavior

- Kiểm tra URL hợp lệ.
- Sprint được chọn phải thuộc Project tương ứng.
- Khi nhấn Open Document, mở URL trong tab mới.
- Việc mở tài liệu còn phụ thuộc vào quyền truy cập được thiết lập trên Google Drive.

---

# 6.9. Notification Center

## 6.9.1. Notification List

### UI Components

- Notification Title.
- Notification Description.
- Notification Type.
- Created At.
- Read / Unread Status.
- Related Entity Link.

### Notification Types

- Task Assigned.
- Task Submitted for Review.
- Task Review Approved.
- Task Review Rejected.
- Project Events.
- Account Events.

### Behavior

- Hiển thị Notification mới nhất trước.
- Phân biệt Notification đã đọc và chưa đọc.
- Cho phép Mark as Read.
- Cho phép Mark as Unread nếu được hỗ trợ.
- Có thể điều hướng đến Task hoặc Project liên quan.
- Hiển thị Unread Count trên Header.

---

# 6.10. Reports

## 6.10.1. Project Report

### UI Components

- Project Progress.
- Task Status Distribution.
- Completed Tasks.
- Overdue Tasks.
- Sprint Progress.
- Upcoming Deadlines.

## 6.10.2. Sprint Report

### UI Components

- Sprint Goal.
- Planned Tasks.
- Completed Tasks.
- Remaining Tasks.
- Sprint Progress.
- Burndown Chart.

## 6.10.3. Member Contribution Report

### UI Components

- Member Name.
- Assigned Tasks.
- Completed Tasks.
- Overdue Tasks.
- Tasks Waiting for Review.
- Task History Summary.

### Design Rules

- Số liệu phải dựa trên dữ liệu thực tế.
- Không sử dụng bảng xếp hạng mang tính đánh giá chủ quan.
- Không kết luận năng suất hoặc chất lượng chỉ dựa trên số lượng Task.
- Cần giải thích rõ cách tính các chỉ số.
- Hạn chế sử dụng biểu đồ nếu dữ liệu chưa đủ hoặc không mang lại giá trị phân tích.

---

# 6.11. User Profile

## 6.11.1. My Profile

### UI Components

- Avatar.
- Full Name.
- Email.
- Role.
- Account Status.
- Created At.
- Edit Profile Action.

### Behavior

- Chỉ cho phép chỉnh sửa các trường được quy định.
- Email có thể cần quy trình xác minh nếu được áp dụng.
- Không hiển thị thông tin nhạy cảm như Password.
- Cho phép người dùng đăng xuất khỏi hệ thống.

---

# 6.12. Admin Management

## 6.12.1. User Management

### UI Components

- User List.
- Full Name.
- Email.
- Role.
- Account Status.
- Created At.
- Approve Action.
- Reject Action.
- Suspend Action.
- Activate Action.

### Filters

- Role.
- Account Status.
- Registration Date.

### Behavior

- Admin có thể phê duyệt hoặc từ chối tài khoản Pending.
- Admin có thể thay đổi Role theo quyền được cấp.
- Các thao tác thay đổi quyền và trạng thái tài khoản cần được ghi lại.
- Không cho phép xóa quyền quản trị của Admin cuối cùng.

## 6.12.2. Role and Permission Management

### UI Components

- Role List.
- Permission List.
- Permission Matrix.
- Grant Permission Action.
- Revoke Permission Action.

### Behavior

- Hiển thị Permission theo từng Role.
- Các thay đổi Permission phải được xác nhận.
- Ghi nhận người thực hiện và thời gian thay đổi.
- Không cho phép người dùng tự cấp quyền cho chính mình nếu không được phép.

## 6.12.3. Activity Logs

### UI Components

- Actor.
- Action.
- Entity Type.
- Entity ID.
- Timestamp.
- Activity Detail.

### Filters

- Actor.
- Action Type.
- Entity Type.
- Date Range.

### Behavior

- Hiển thị hoạt động theo thời gian giảm dần.
- Không cho phép chỉnh sửa lịch sử Audit Log thông qua giao diện thông thường.
- Chỉ Admin hoặc người có quyền phù hợp được truy cập.

---

# 7. Reusable UI Components

Các component dưới đây cần được thiết kế để tái sử dụng giữa nhiều trang.

## 7.1. Buttons

Các loại Button:

| Type | Usage |
|---|---|
| Primary | Thao tác chính |
| Secondary | Thao tác phụ |
| Outline | Thao tác ít ưu tiên |
| Ghost | Thao tác nhẹ |
| Destructive | Xóa, từ chối hoặc thao tác nguy hiểm |

Yêu cầu:

- Có trạng thái Default, Hover, Focus, Disabled và Loading.
- Có Label dễ hiểu.
- Không sử dụng màu sắc làm tín hiệu duy nhất.

## 7.2. Form Components

Các component:

- Text Input.
- Password Input.
- Textarea.
- Select.
- Multi-select.
- Date Picker.
- Number Input.
- Checkbox.
- Radio Group.
- URL Input.

Yêu cầu:

- Có Label.
- Có Required Indicator nếu bắt buộc.
- Hiển thị Validation Message.
- Hiển thị trạng thái Disabled và Loading khi cần.
- Giữ lại dữ liệu người dùng đã nhập khi có lỗi có thể sửa được.

## 7.3. Data Table

Sử dụng cho:

- User Management.
- Project List.
- Member List.
- Task List.
- Sprint List.
- Document List.
- Activity Logs.

Yêu cầu:

- Header rõ ràng.
- Hỗ trợ Sorting khi cần.
- Hỗ trợ Pagination khi dữ liệu lớn.
- Hỗ trợ Empty State.
- Hỗ trợ Loading State.
- Các Action phải phù hợp với Permission.

## 7.4. Status Badge

Dùng để biểu diễn trạng thái.

Ví dụ:

- Pending.
- Active.
- Rejected.
- Suspended.
- TODO.
- IN PROGRESS.
- REVIEW.
- DONE.
- Archived.

Yêu cầu:

- Mỗi trạng thái có cách biểu diễn nhất quán.
- Màu sắc phải dễ phân biệt.
- Không dùng màu sắc làm phương tiện duy nhất để truyền đạt trạng thái.
- Có thể kết hợp Text hoặc Icon.

## 7.5. Priority Indicator

Dùng để biểu diễn Priority của Task.

Các mức Priority:

- LOW.
- MEDIUM.
- HIGH.
- CRITICAL.

## 7.6. Dialog and Confirmation Modal

Sử dụng cho các thao tác:

- Delete.
- Reject Account.
- Suspend Account.
- Archive Project.
- Remove Member.
- Approve Task Review.
- Reject Task Review.

Yêu cầu:

- Hiển thị rõ hành động đang được xác nhận.
- Mô tả hậu quả của thao tác khi cần.
- Có Cancel và Confirm.
- Với thao tác Review, phải có trường nhập lý do.
- Không sử dụng Dialog cho mọi thao tác nhỏ không cần thiết.

## 7.7. Toast / Feedback

Sử dụng để thông báo kết quả:

- Success.
- Error.
- Warning.
- Information.

Toast không thay thế Validation Message đối với lỗi của từng trường Form.

---

# 8. Interaction and Feedback

## 8.1. Loading State

Khi hệ thống đang xử lý:

- Hiển thị Loading Indicator hoặc Skeleton.
- Disable thao tác có thể gây gửi yêu cầu trùng lặp.
- Không làm người dùng hiểu nhầm rằng dữ liệu đã được lưu.

## 8.2. Empty State

Khi chưa có dữ liệu:

- Hiển thị thông báo phù hợp.
- Giải thích ngắn gọn lý do danh sách trống nếu xác định được.
- Hiển thị Call-to-Action nếu người dùng có quyền tạo dữ liệu.

Ví dụ:

- No Projects Found.
- No Tasks Assigned.
- No Active Sprint.
- No Documents Available.
- No Notifications.

## 8.3. Error State

Khi xảy ra lỗi:

- Hiển thị thông báo dễ hiểu.
- Không hiển thị Stack Trace hoặc thông tin kỹ thuật nhạy cảm.
- Giữ lại dữ liệu Form nếu có thể.
- Cung cấp Retry Action khi phù hợp.

## 8.4. Success Feedback

Sau khi thao tác thành công:

- Hiển thị thông báo xác nhận.
- Cập nhật dữ liệu trên giao diện.
- Điều hướng đến trang tiếp theo nếu phù hợp.

## 8.5. Confirmation

Các thao tác có ảnh hưởng đáng kể đến dữ liệu cần có xác nhận phù hợp.

Không cần yêu cầu xác nhận đối với mọi thao tác thông thường như mở trang hoặc chuyển bộ lọc.

---

# 9. Responsive Design

## 9.1. Desktop

Desktop là giao diện ưu tiên.

Yêu cầu:

- Sidebar hiển thị đầy đủ.
- Data Table sử dụng bố cục đầy đủ.
- Kanban hiển thị các cột trạng thái cạnh nhau.
- Dashboard có thể sử dụng Grid Layout.
- Các Form có thể sử dụng bố cục nhiều cột khi phù hợp.

## 9.2. Tablet

Yêu cầu:

- Sidebar có thể thu gọn.
- Dashboard tự động điều chỉnh số cột.
- Form chuyển sang bố cục ít cột hơn.
- Data Table có thể hỗ trợ cuộn ngang.
- Kanban cần hỗ trợ cuộn ngang.

## 9.3. Mobile

Yêu cầu:

- Navigation chuyển sang dạng phù hợp với màn hình nhỏ.
- Các Card hiển thị theo một cột.
- Form sử dụng một cột.
- Các Button chính phải dễ thao tác.
- Data Table có thể chuyển sang Card List hoặc hỗ trợ cuộn ngang.
- Kanban hỗ trợ xem từng cột hoặc cuộn ngang.
- Không yêu cầu người dùng thao tác Drag and Drop nếu trải nghiệm Mobile không phù hợp.

## 9.4. Responsive Breakpoints

Các Breakpoint cụ thể: [CHƯA XÁC ĐỊNH].

Có thể sử dụng Breakpoint mặc định của Tailwind CSS làm điểm khởi đầu và điều chỉnh dựa trên giao diện thực tế.

---

# 10. Accessibility

Giao diện cần đáp ứng các nguyên tắc Accessibility cơ bản:

1. Có thể điều hướng các thành phần chính bằng bàn phím.
2. Input phải có Label rõ ràng.
3. Button và Icon Button phải có tên hoặc Accessible Label.
4. Đảm bảo độ tương phản văn bản phù hợp.
5. Không sử dụng màu sắc làm tín hiệu duy nhất.
6. Hình ảnh có ý nghĩa cần có Alternative Text.
7. Dialog phải hỗ trợ thao tác bàn phím phù hợp.
8. Focus State phải dễ nhận biết.
9. Form Validation phải thông báo rõ ràng.
10. Các biểu đồ cần có nhãn hoặc phần mô tả dữ liệu tương ứng.

---

# 11. Design System

## 11.1. Color System

Bảng màu chính thức: [CHƯA XÁC ĐỊNH].

Hệ thống cần có các nhóm màu:

- Primary Color.
- Secondary Color.
- Background.
- Surface.
- Text Primary.
- Text Secondary.
- Border.
- Success.
- Warning.
- Error.
- Information.

Màu sắc cần được sử dụng nhất quán trên toàn hệ thống.

## 11.2. Typography

Font Family: [CHƯA XÁC ĐỊNH].

Typography cần có các cấp:

- Display.
- Heading 1.
- Heading 2.
- Heading 3.
- Body.
- Small Text.
- Caption.
- Button Text.

Ưu tiên font dễ đọc, hỗ trợ đầy đủ tiếng Việt.

## 11.3. Spacing

Sử dụng hệ thống Spacing thống nhất.

Không tự ý sử dụng nhiều giá trị khoảng cách khác nhau nếu không cần thiết.

## 11.4. Border Radius and Shadow

- Border Radius cần thống nhất giữa Card, Input, Button và Dialog.
- Shadow chỉ sử dụng khi cần tạo phân cấp thị giác.
- Tránh sử dụng quá nhiều hiệu ứng nổi hoặc đổ bóng.

## 11.5. Iconography

- Sử dụng một bộ Icon thống nhất.
- Icon cần phù hợp với chức năng.
- Không sử dụng Icon khó hiểu nếu không có Label hỗ trợ.
- Các Icon Button cần có Tooltip hoặc Accessible Label khi cần.

---

# 12. Main User Flows

## 12.1. Account Registration Flow

1. Người dùng mở Register Page.
2. Nhập thông tin tài khoản.
3. Submit Registration Form.
4. Hệ thống Validate dữ liệu.
5. Tạo tài khoản ở trạng thái Pending.
6. Hiển thị Pending Approval Page.
7. Admin nhận thông báo hoặc kiểm tra danh sách tài khoản Pending.
8. Admin Approve hoặc Reject.
9. Người dùng nhận kết quả xử lý.

## 12.2. Project Creation Flow

1. Admin hoặc Leader mở Project List.
2. Chọn Create Project.
3. Nhập thông tin Project.
4. Chọn Project Template.
5. Chọn Project Leader, Instructor và Members.
6. Submit Form.
7. Hệ thống Validate dữ liệu.
8. Tạo Project.
9. Điều hướng đến Project Detail.

## 12.3. Task Creation and Review Flow

1. Leader mở Task Management.
2. Chọn Create Task.
3. Nhập thông tin Task.
4. Chọn Assignees và Deadline.
5. Lưu Task.
6. Assignees nhận Notification.
7. Member thực hiện Task.
8. Member chuyển Task sang REVIEW.
9. Leader nhận Notification.
10. Leader Approve hoặc Reject.
11. Member nhận kết quả Review.

## 12.4. Sprint Planning Flow

1. Leader mở Sprint Management.
2. Chọn hoặc tạo Sprint.
3. Mở Product Backlog.
4. Chọn các Task cần đưa vào Sprint.
5. Xác nhận Sprint Planning.
6. Hệ thống cập nhật Sprint Assignment.
7. Sprint Board hiển thị các Task được chọn.

## 12.5. Document Management Flow

1. Người dùng có quyền mở Document Library.
2. Chọn Add Document.
3. Nhập tên tài liệu và Google Drive URL.
4. Chọn Category và Project.
5. Có thể liên kết với Sprint.
6. Lưu Document Record.
7. Người dùng mở tài liệu bằng Open Document.

---

# 13. UI/UX Acceptance Criteria

Giao diện được xem là đáp ứng yêu cầu khi:

1. Các trang chính sử dụng chung Layout.
2. Navigation hiển thị đúng theo Role và Permission.
3. Người dùng có thể truy cập các chức năng được cấp quyền.
4. Các Form có Label và Validation Message.
5. Các thao tác quan trọng có phản hồi rõ ràng.
6. Loading, Empty, Error và Success State được xử lý phù hợp.
7. Task Status và Priority được biểu diễn nhất quán.
8. Kanban hiển thị đúng các trạng thái Task.
9. Dashboard hiển thị dữ liệu thực tế.
10. Data Table có khả năng xử lý danh sách dữ liệu lớn ở mức phù hợp với quy mô dự án.
11. Giao diện hoạt động trên Desktop, Tablet và Mobile.
12. Không có thành phần giao diện bị tràn hoặc chồng lấn nghiêm trọng.
13. Các thao tác chính có thể thực hiện bằng bàn phím.
14. Không hiển thị thông tin hoặc chức năng ngoài quyền của người dùng.
15. Không sử dụng hiệu ứng hoặc thành phần trang trí gây ảnh hưởng đến khả năng sử dụng.

---

# 14. Open Issues

Các vấn đề chưa được chốt:

| ID | Issue | Status |
|---|---|---|
| UI-001 | Logo và Brand Identity | Open |
| UI-002 | Primary Color và Color Palette | Open |
| UI-003 | Font Family | Open |
| UI-004 | Sidebar Collapsed Behavior | Open |
| UI-005 | Mobile Navigation Style | Open |
| UI-006 | Dashboard Layout cụ thể | Open |
| UI-007 | Dark Mode có nằm trong MVP hay không | Open |
| UI-008 | Có sử dụng Drag and Drop trên Kanban hay không | Open |
| UI-009 | Data Table chuyển thành Card List trên Mobile hay không | Open |
| UI-010 | Có cần Avatar Upload hay chỉ sử dụng Avatar mặc định | Open |
| UI-011 | Breakpoint cụ thể | Open |
| UI-012 | Có hỗ trợ ngôn ngữ khác ngoài tiếng Việt hay không | Open |

Các quyết định thiết kế cần được cập nhật trong tài liệu này trước khi triển khai giao diện chính thức.

---

# 15. Technical UI Implementation Guidelines

## 15.1. Recommended UI Stack

Các công nghệ đề xuất:

| Technology | Purpose |
|---|---|
| Next.js App Router | Application Routing |
| React | UI Components |
| TypeScript | Type Safety |
| Tailwind CSS | Styling |
| shadcn/ui | Reusable UI Components |
| React Hook Form | Form Management |
| Zod | Schema Validation |
| Recharts | Data Visualization |

Đây là Stack đề xuất, cần được đối chiếu với Architecture và Technology Stack chính thức của Project.

## 15.2. Component Architecture

Ưu tiên chia Component theo chức năng:

- Layout Components.
- Navigation Components.
- Form Components.
- Data Display Components.
- Feedback Components.
- Dashboard Components.
- Task Components.
- Sprint Components.

Các Component dùng chung nên được đặt tại khu vực Shared Components.

Component chỉ phục vụ một Module nên được tổ chức trong Module tương ứng.

## 15.3. UI and Business Logic Separation

- Component không nên chứa quá nhiều Business Logic.
- Form Validation cần có Schema riêng khi phù hợp.
- API Request và Data Fetching phải tuân theo Architecture.
- Không truy cập Database trực tiếp từ Client Component.
- Không dựa vào việc ẩn Button để đảm bảo Authorization.
- Các thao tác quan trọng phải được kiểm tra quyền ở Server.

## 15.4. State Management

- Ưu tiên Server State cho dữ liệu lấy từ Backend.
- Local State dùng cho trạng thái giao diện.
- Không lưu trữ dữ liệu nhạy cảm trong Client State không an toàn.
- Sau các thao tác thay đổi dữ liệu, cần cập nhật hoặc làm mới dữ liệu phù hợp.

---

# 16. Document Change History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-11-14 | Initial UI/UX Design Specification |

**End of Document**


## Decision Alignment — 2026-11-14

- Project Template và Instructor đều là trường tùy chọn trên Create Project.
- Task Priority chỉ gồm `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`; không sử dụng `URGENT`.
- Task Estimate được nhập theo giờ (Hours), không dùng Story Points trong MVP.
- UI cần hỗ trợ nhiều Sprint ở trạng thái Active trong cùng Project.
- Khi kết thúc Sprint, Leader chọn cách xử lý riêng cho từng Task chưa hoàn thành; UI không tự động chuyển Task.
- Admin có thao tác Restore Project Archived.
- Khi xóa thành viên, UI phải hiển thị các Task còn được giao và yêu cầu Leader phân công lại trước khi xác nhận.
- Email Notification là kênh bắt buộc trong MVP; cần có cấu hình/hiển thị trạng thái gửi phù hợp với quyền người dùng.


## Confirmed UI Decisions — 2026-11-14

- Project Template: Select tùy chọn, không đánh dấu required.
- Instructor: Select tùy chọn, không đánh dấu required.
- Task Priority: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`; label hiển thị nhất quán.
- Task Estimate: nhập số giờ, không cung cấp lựa chọn Story Points trong MVP.
- Task Dependency: UI cần hiển thị các predecessor chưa hoàn thành và giải thích lý do không thể hoàn tất Task.
- Member Removal: nếu còn Task được giao, hiển thị danh sách Task cần phân công lại; không cho xác nhận Remove cho đến khi xử lý xong.
- Project Restore: chỉ Admin thấy thao tác Restore; cảnh báo khi Workspace đã có Project ACTIVE.
- Email Notification: trong Notification Preferences/Settings (nếu có), không cho phép tắt toàn bộ Email bắt buộc của các sự kiện MVP; giao diện cần thể hiện trạng thái gửi Email nếu phù hợp.
- Sprint: hỗ trợ nhiều Sprint ACTIVE trong cùng Project; không thiết kế UI giả định chỉ có một Sprint Active.
