# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

**Project:** Akatsuki Yui  
**Document Version:** 1.0  
**Status:** Draft  
**Last Updated:** 14/11/2026

---

# 1. Introduction

## 1.1. Purpose

Tài liệu Software Requirements Specification (SRS) mô tả các yêu cầu phần mềm của hệ thống Akatsuki Yui.

Tài liệu được sử dụng làm cơ sở cho:

- Phân tích và thiết kế hệ thống.
- Phát triển các chức năng.
- Thiết kế Database.
- Xây dựng Test Cases.
- Kiểm tra mức độ hoàn thành sản phẩm.
- Đánh giá hệ thống so với mục tiêu ban đầu.

## 1.2. Product Scope

Akatsuki Yui là hệ thống Web Application hỗ trợ quản lý công việc và dự án dành cho một nhóm sinh viên.

Hệ thống cho phép các thành viên:

- Quản lý tài khoản và quyền truy cập.
- Quản lý Project và thành viên.
- Tạo và phân công Task.
- Quản lý Sprint theo mô hình Scrum.
- Theo dõi công việc bằng Kanban Board.
- Quản lý tài liệu thông qua Google Drive.
- Nhận thông báo.
- Theo dõi tiến độ và báo cáo hoạt động.

Hệ thống hướng đến việc tập trung hóa thông tin, cải thiện khả năng phối hợp và giúp nhóm theo dõi tiến độ dự án.

## 1.3. Definitions and Abbreviations

| Term | Definition |
|---|---|
| Admin | Người quản trị hệ thống |
| Instructor | Người hướng dẫn hoặc giảng viên |
| Leader | Người quản lý Project |
| Member | Thành viên tham gia Project |
| Project | Dự án được quản lý trong hệ thống |
| Task | Công việc cần thực hiện |
| Assignee | Người được giao Task |
| Sprint | Chu kỳ làm việc có thời gian bắt đầu và kết thúc |
| Backlog | Danh sách Task chưa được đưa vào Sprint |
| Kanban Board | Bảng hiển thị Task theo trạng thái |
| Review | Quy trình kiểm tra Task trước khi hoàn thành |
| RBAC | Role-Based Access Control |
| CRUD | Create, Read, Update, Delete |
| ERD | Entity Relationship Diagram |
| SRS | Software Requirements Specification |
| SAD | Software Architecture Document |
| DDD | Database Design Document |

## 1.4. References

Các tài liệu liên quan:

- Project-Overview.md
- Project-Scope-and-Roadmap.md
- Use-Case-Specification.md
- Software-Architecture-Document.md
- Database-Design-Document.md

---

# 2. Product Overview

## 2.1. Product Perspective

Akatsuki Yui là một hệ thống Web Application độc lập, được xây dựng để phục vụ hoạt động quản lý nội bộ của một nhóm.

Hệ thống sử dụng mô hình một Workspace chung, trong đó Admin quản lý tài khoản và các thành viên sử dụng hệ thống để tham gia Project.

Hệ thống không hướng đến mô hình SaaS đa tổ chức.

## 2.2. Product Functions

Các chức năng chính:

1. Authentication & Account Management.
2. Authorization & Permission Management.
3. Project Management.
4. Member Management.
5. Task Management.
6. Sprint Management.
7. Kanban Board.
8. Document Library.
9. Notification Management.
10. Dashboard & Reporting.
11. Activity & Audit Log.

## 2.3. User Classes and Characteristics

| User Class | Description | Main Responsibilities |
|---|---|---|
| Admin | Quản trị viên | Quản lý tài khoản, Role, Permission và Project |
| Instructor | Người hướng dẫn | Theo dõi tình hình và tiến độ Project |
| Leader | Người quản lý Project | Quản lý thành viên, Task, Sprint và Review |
| Member | Thành viên | Thực hiện Task và cập nhật tiến độ |

## 2.4. Operating Environment

| Component | Requirement |
|---|---|
| Application Type | Web Application |
| Frontend | Next.js / React |
| Backend | Next.js Fullstack |
| Language | TypeScript |
| Database | PostgreSQL (Proposed) |
| ORM | Prisma (Proposed) |
| Browser | Chrome, Edge, Firefox và các trình duyệt hiện đại |
| Platform | Desktop, Tablet, Mobile |
| Deployment | Cloud Hosting |

---

# 3. Product Scope

## 3.1. In-Scope

| Module | Included Features |
|---|---|
| Authentication | Register, Login, Logout, Session |
| Account Management | Account Approval, Account Status, Profile |
| Authorization | Role, Permission, Access Control |
| Project Management | Create, Update, Activate, Archive Project |
| Member Management | Add, Remove, Manage Project Members |
| Task Management | Create, Assign, Update, Review, History |
| Sprint Management | Create Sprint, Backlog, Sprint Planning |
| Kanban | Board, Status Columns, Filters |
| Document Library | Document Records, Google Drive Links |
| Notification | In-app Notification, Email |
| Dashboard | Project Overview, Task Statistics |
| Reporting | Sprint Progress, Burndown, Member Contribution |
| Activity | Activity History, Audit Log |

## 3.2. Out-of-Scope

Các chức năng không thuộc phạm vi MVP:

- Multi-tenant SaaS.
- Quản lý nhiều Workspace độc lập.
- Public Project Marketplace.
- Chat nội bộ.
- Video Meeting.
- Upload và lưu trữ file trực tiếp.
- GitHub API Integration.
- AI Task Assignment.
- AI Performance Evaluation.
- Native Android/iOS Application.
- Payment System.
- HR và Payroll.
- Microservices Architecture.
- Advanced Real-time Collaboration.

---

# 4. Functional Requirements

Các yêu cầu chức năng được định danh theo Module để thuận tiện cho việc phát triển và kiểm thử.

Mức độ ưu tiên:

- **Must Have:** Bắt buộc trong MVP.
- **Should Have:** Nên có trong MVP nếu nguồn lực cho phép.
- **Could Have:** Có thể triển khai sau.

## 4.1. Authentication & Account Management

### FR-AUTH-001: Register Account

**Priority:** Must Have

Hệ thống phải cho phép người dùng đăng ký tài khoản.

Requirements:

- Người dùng phải cung cấp Email và Password.
- Người dùng phải cung cấp thông tin họ tên.
- Email phải đúng định dạng.
- Email không được trùng với tài khoản đã tồn tại.
- Password phải đáp ứng chính sách bảo mật (tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt theo `DEC-013`).
- Không yêu cầu xác minh Email khi đăng ký (`DEC-014`); tài khoản mới vào thẳng trạng thái `PENDING` chờ Admin duyệt.
- Tài khoản PENDING chưa được phép sử dụng các chức năng nội bộ.

### FR-AUTH-002: Login

**Priority:** Must Have

Hệ thống phải cho phép người dùng đăng nhập.

Requirements:

- Người dùng nhập Email và Password.
- Hệ thống xác thực thông tin đăng nhập.
- Hệ thống kiểm tra trạng thái tài khoản.
- Chỉ tài khoản ACTIVE mới được truy cập hệ thống.
- Thông tin đăng nhập không hợp lệ phải được thông báo phù hợp.

### FR-AUTH-003: Logout

**Priority:** Must Have

Hệ thống phải cho phép người dùng đăng xuất.

Requirements:

- Hủy hoặc vô hiệu hóa Session hiện tại.
- Không cho phép sử dụng Session đã hết hiệu lực.
- Chuyển người dùng về trang đăng nhập.

### FR-AUTH-004: Manage User Accounts

**Priority:** Must Have

Admin phải có khả năng quản lý tài khoản.

Requirements:

- Xem danh sách tài khoản.
- Tìm kiếm tài khoản.
- Lọc tài khoản theo trạng thái.
- Xem thông tin chi tiết.
- Cập nhật trạng thái tài khoản.
- Suspend tài khoản khi cần.

### FR-AUTH-005: Approve or Reject Account

**Priority:** Must Have

Admin phải có khả năng phê duyệt hoặc từ chối tài khoản PENDING.

Requirements:

- Admin có thể xem danh sách tài khoản chờ phê duyệt.
- Admin có thể Approve hoặc Reject.
- Hệ thống phải lưu người thực hiện và thời điểm xử lý.
- Tài khoản được Approve chuyển sang ACTIVE.
- Tài khoản bị Reject chuyển sang REJECTED.
- Người dùng phải nhận được thông báo về kết quả xử lý.

### FR-AUTH-006: Manage User Profile

**Priority:** Should Have

Người dùng có thể xem và cập nhật thông tin hồ sơ cá nhân trong phạm vi được cho phép.

Các trường được phép chỉnh sửa (`DEC-018`): `Full Name` và đổi `Password` (yêu cầu nhập `Current Password` và tuân thủ Password Policy); `Email`, `Role` và `Account Status` bị khóa.

### FR-AUTH-007: Manage Roles and Permissions

**Priority:** Must Have

Admin phải có khả năng quản lý Role và Permission.

Requirements:

- Xem danh sách Role.
- Xem Permission của từng Role.
- Gán hoặc thu hồi Permission theo quyền được cấp.
- Ghi nhận lịch sử thay đổi.
- Không cho phép xóa hoặc vô hiệu hóa quyền quản trị của Admin cuối cùng.

---

## 4.2. Project Management

### FR-PROJ-001: Create Project

**Priority:** Must Have

Admin và Leader có quyền tạo Project.

Thông tin Project gồm:

- Project Name.
- Description.
- Start Date.
- End Date.
- Project Leader.
- Instructor (tùy chọn).
- Members.
- Technologies.
- Repository URL.
- Objectives.
- Scope.
- Project Template (tùy chọn).

Requirements:

- Project Name là bắt buộc.
- Start Date và End Date là bắt buộc.
- End Date không được trước Start Date.
- Project có thể sử dụng Template; Template không bắt buộc.
- Người tạo phải có quyền tạo Project.
- Nếu Leader tạo Project, người đó mặc định là Project Leader.

### FR-PROJ-002: View Project

**Priority:** Must Have

Người dùng có quyền phải xem được thông tin Project.

Thông tin hiển thị:

- Project Overview.
- Project Members.
- Project Status.
- Project Timeline.
- Task Summary.
- Sprint Summary.
- Repository URL.
- Technologies.

### FR-PROJ-003: Update Project

**Priority:** Must Have

Người có quyền phải có khả năng cập nhật thông tin Project.

Requirements:

- Kiểm tra quyền trước khi cập nhật.
- Kiểm tra tính hợp lệ của dữ liệu.
- Lưu thời điểm cập nhật.
- Ghi nhận các thay đổi quan trọng.

### FR-PROJ-004: Activate Project

**Priority:** Must Have

Người có quyền phải có khả năng kích hoạt Project.

Requirements:

- Project phải đáp ứng điều kiện kích hoạt.
- Hệ thống chỉ cho phép một Project ACTIVE tại một thời điểm.
- Không được kích hoạt Project thứ hai khi đã có Project ACTIVE.
- Thao tác phải đảm bảo tính nhất quán dữ liệu.

### FR-PROJ-005: Archive Project

**Priority:** Must Have

Người có quyền phải có khả năng Archive Project.

Requirements:

- Project chuyển sang ARCHIVED.
- Dữ liệu và lịch sử phải được giữ lại.
- Project Archived không được sử dụng như Project đang hoạt động.
- Các thao tác chỉnh sửa nghiệp vụ thông thường phải bị hạn chế.

Admin được phép khôi phục Project Archived. Khi khôi phục sang ACTIVE, hệ thống phải kiểm tra ràng buộc tối đa một Project ACTIVE.

**Quy tắc bổ sung:** Instructor không bắt buộc. Project có thể không có Instructor được gán. Project Template cũng không bắt buộc khi tạo Project.

### FR-PROJ-007: Restore Archived Project

**Priority:** Must Have

Admin phải có khả năng khôi phục Project Archived.

Requirements:
- Chỉ Admin được thực hiện Restore.
- Hệ thống phải kiểm tra Project tồn tại và đang ở trạng thái ARCHIVED.
- Nếu khôi phục sang ACTIVE, phải kiểm tra chưa có Project ACTIVE khác.
- Dữ liệu và lịch sử trước khi Archive phải được bảo toàn.
- Ghi nhận Activity Log cho thao tác Restore.

### FR-PROJ-006: Manage Project Members

**Priority:** Must Have

Leader hoặc người có quyền phải quản lý thành viên Project.

Requirements:

- Thêm thành viên.
- Xem danh sách thành viên.
- Cập nhật vai trò trong Project.
- Gỡ thành viên khỏi Project.
- Kiểm tra tài khoản thành viên phải hợp lệ.
- Lưu lịch sử tham gia và rời Project.

Cách xử lý Task đang giao khi một thành viên bị gỡ khỏi Project: **[CHƯA XÁC ĐỊNH]**.

---

## 4.3. Task Management

### FR-TASK-001: Create Task

**Priority:** Must Have

Người có quyền phải tạo được Task.

Thông tin Task:

- Title.
- Description.
- Priority.
- Start Date.
- Deadline.
- Estimate (tùy chọn, số giờ).
- Assignees (tùy chọn; có thể phân công sau).
- Task Dependencies.

Requirements:

- Title là bắt buộc.
- Deadline là bắt buộc.
- Start Date là tùy chọn.
- Nếu Start Date tồn tại, Start Date không được sau Deadline.
- Task phải thuộc một Project.
- Task mới mặc định có trạng thái TODO.
- Task có thể nằm trong Backlog.
- Assignees không bắt buộc khi tạo Task; nếu chưa có Assignee, Task vẫn được tạo bình thường và không phát sinh Notification giao Task. Leader có thể phân công sau.

### FR-TASK-002: Update Task

**Priority:** Must Have

Người có quyền phải cập nhật được Task.

Requirements:

- Cập nhật Title.
- Cập nhật Description.
- Cập nhật Priority.
- Cập nhật Start Date và Deadline.
- Cập nhật Estimate theo giờ nếu có quyền.
- Kiểm tra quyền trước khi cập nhật.
- Với Member được giao Task (`DEC-015`), chỉ được cập nhật `Status` (`TODO -> IN_PROGRESS -> REVIEW`) và `Reference Links / ghi chú tiến độ`; các trường `Title`, `Description`, `Priority`, `Deadline`, `Estimate`, `Assignees`, `Dependencies` và `Sprint` bị khóa.
- Ghi nhận lịch sử thay đổi quan trọng.

### FR-TASK-003: Assign Task

**Priority:** Must Have

Người có quyền phải có khả năng giao Task cho một hoặc nhiều thành viên.

Requirements:

- Một Task có thể có nhiều Assignees.
- Assignee phải thuộc Project tương ứng.
- Không tạo phân công trùng lặp.
- Lưu người phân công và thời điểm phân công.
- Gửi Notification cho Assignee khi được giao Task.

### FR-TASK-004: Manage Task Status

**Priority:** Must Have

Hệ thống phải hỗ trợ Workflow:

`TODO → IN PROGRESS → REVIEW → DONE`

Requirements:

- Task phải tuân thủ Workflow.
- Chỉ người có quyền mới được thực hiện chuyển trạng thái tương ứng.
- Task có một trạng thái chung.
- Không cho phép chuyển sang trạng thái không hợp lệ.
- Lưu lịch sử thay đổi trạng thái.

### FR-TASK-005: Submit Task for Review

**Priority:** Must Have

Assignee có quyền phải có khả năng gửi Task sang REVIEW.

Requirements:

- Task phải đang ở trạng thái IN_PROGRESS.
- Người thực hiện phải có quyền gửi Review.
- Task chuyển sang REVIEW.
- Hệ thống lưu lịch sử trạng thái.
- Leader nhận được Notification.

### FR-TASK-006: Approve Task Review

**Priority:** Must Have

Leader có quyền phải có khả năng Approve Task.

Requirements:

- Task phải đang ở trạng thái REVIEW.
- Người xử lý phải có quyền Review.
- Lý do phê duyệt là bắt buộc.
- Task chuyển sang DONE.
- Hệ thống lưu TaskReview.
- Hệ thống lưu TaskStatusHistory.
- Assignees nhận được Notification.

### FR-TASK-007: Reject Task Review

**Priority:** Must Have

Leader có quyền phải có khả năng Reject Task.

Requirements:

- Task phải đang ở trạng thái REVIEW.
- Người xử lý phải có quyền Review.
- Lý do từ chối là bắt buộc.
- Task chuyển về IN_PROGRESS.
- Hệ thống lưu TaskReview.
- Hệ thống lưu TaskStatusHistory.
- Assignees nhận được Notification.

### FR-TASK-008: View Task History

**Priority:** Must Have

Người có quyền phải xem được lịch sử Task.

Thông tin lịch sử gồm:

- Người thực hiện.
- Thời điểm.
- Trạng thái cũ.
- Trạng thái mới.
- Lý do Review.
- Thay đổi phân công quan trọng.

### FR-TASK-009: Manage Task Dependencies

**Priority:** Must Have

Người có quyền có thể thiết lập quan hệ phụ thuộc giữa các Task.

Requirements:

- Một Task có thể phụ thuộc nhiều Task khác.
- Không cho phép phụ thuộc chính nó.
- Không cho phép tạo vòng lặp Dependency.
- Các Task liên quan phải thuộc cùng Project.

Task phụ thuộc không được chuyển sang DONE khi còn Task tiền nhiệm chưa DONE. Hệ thống phải kiểm tra tại Server trước khi cập nhật trạng thái.

---

## 4.4. Sprint Management

### FR-SPRINT-001: Create Sprint

**Priority:** Must Have

Leader có quyền phải tạo được Sprint.

Thông tin Sprint:

- Sprint Name.
- Sprint Goal.
- Start Date.
- End Date.
- Status.

Requirements:

- Sprint thuộc một Project.
- Start Date và End Date là bắt buộc.
- End Date không được trước Start Date.
- Sprint mới có trạng thái PLANNED.

### FR-SPRINT-002: Manage Backlog

**Priority:** Must Have

Người có quyền phải quản lý được Backlog.

Requirements:

- Hiển thị Task chưa thuộc Sprint.
- Xem thông tin Task trong Backlog.
- Cập nhật Task.
- Đưa Task vào Sprint khi thực hiện Planning.

### FR-SPRINT-003: Sprint Planning

**Priority:** Must Have

Leader có quyền phải có khả năng đưa Task từ Backlog vào Sprint.

Requirements:

- Chọn các Task phù hợp.
- Kiểm tra Task thuộc cùng Project.
- Một Task chỉ được thuộc tối đa một Sprint.
- Cập nhật Sprint ID của Task.
- Đảm bảo dữ liệu không bị trùng lặp hoặc sai lệch.

### FR-SPRINT-004: View Sprint Overview

**Priority:** Must Have

Hệ thống phải hiển thị tổng quan Sprint.

Thông tin gồm:

- Sprint Goal.
- Start Date.
- End Date.
- Sprint Status.
- Total Tasks.
- Completed Tasks.
- Incomplete Tasks.
- Sprint Progress.

### FR-SPRINT-005: Manage Sprint Lifecycle

**Priority:** Should Have

Người có quyền có thể quản lý trạng thái Sprint.

Các trạng thái dự kiến:

`PLANNED → ACTIVE → COMPLETED`

Có thể có trạng thái CANCELLED.

Điều kiện chuyển trạng thái và xử lý Task chưa hoàn thành khi Sprint kết thúc: **[CHƯA XÁC ĐỊNH]**.

---

## 4.5. Kanban Board

### FR-KANBAN-001: View Kanban Board

**Priority:** Must Have

Hệ thống phải cung cấp Kanban Board để hiển thị Task theo trạng thái.

Các cột:

- TODO.
- IN PROGRESS.
- REVIEW.
- DONE.

### FR-KANBAN-002: Filter Tasks

**Priority:** Must Have

Người dùng phải có khả năng lọc Task theo:

- Sprint.
- Assignee.
- Priority.
- Deadline.
- Status.

### FR-KANBAN-003: View Project or Sprint Board

**Priority:** Must Have

Hệ thống phải hỗ trợ:

- Xem Kanban Board của toàn Project.
- Xem Kanban Board của một Sprint cụ thể.
- Xem Task thuộc Backlog khi cần.

### FR-KANBAN-004: Update Task from Board

**Priority:** Should Have

Người dùng có quyền có thể thực hiện các thao tác phù hợp trực tiếp trên Kanban Board.

Mọi thao tác cập nhật phải tuân thủ Task Workflow và Authorization Rules.

Việc sử dụng Drag and Drop: **[CHƯA XÁC ĐỊNH]**.

---

## 4.6. Document Library

### FR-DOC-001: Create Document Record

**Priority:** Must Have

Người có quyền phải thêm được tài liệu vào Document Library.

Thông tin gồm:

- Document Name.
- Description.
- Google Drive URL.
- Category.
- Project.
- Sprint (Optional).

### FR-DOC-002: Update Document Record

**Priority:** Must Have

Người có quyền phải cập nhật được thông tin tài liệu.

### FR-DOC-003: Delete Document Record

**Priority:** Should Have

Người có quyền phải xóa được Document Record theo chính sách hệ thống.

Việc xóa Record không được xóa file gốc trên Google Drive.

### FR-DOC-004: View Document Library

**Priority:** Must Have

Hệ thống phải hiển thị danh sách tài liệu theo Project.

Hỗ trợ:

- Tìm kiếm.
- Lọc theo Category.
- Lọc theo Sprint.
- Xem thông tin tài liệu.

### FR-DOC-005: Open Document

**Priority:** Must Have

Người dùng có quyền phải mở được tài liệu thông qua Google Drive URL.

Yêu cầu:

- Mở trong tab mới.
- Không yêu cầu hệ thống tải file về.
- URL phải được kiểm tra hợp lệ trước khi lưu.

---

## 4.7. Notification Management

### FR-NOTI-001: Create In-app Notification

**Priority:** Must Have

Hệ thống phải tạo thông báo khi xảy ra các sự kiện nghiệp vụ được xác định.

### FR-NOTI-002: View Notifications

**Priority:** Must Have

Người dùng phải xem được thông báo của chính mình.

Requirements:

- Hiển thị danh sách Notification.
- Hiển thị thời điểm tạo.
- Phân biệt Read và Unread.
- Không cho phép xem Notification của User khác.

### FR-NOTI-003: Manage Notification Read Status

**Priority:** Must Have

Người dùng có thể:

- Đánh dấu một Notification đã đọc.
- Đánh dấu tất cả Notification đã đọc.

### FR-NOTI-004: Send Email Notification

**Priority:** Must Have

Hệ thống gửi Email cho các sự kiện được cấu hình.

Requirements:

- Email Notification là yêu cầu Must Have trong MVP, song song với In-app Notification.
- Sử dụng Email Provider là **Resend (Free Tier API)** được cấu hình trong môi trường triển khai (`DEC-016`).
- Mỗi lần gửi phải có Delivery Status: PENDING, SENT hoặc FAILED.
- Ghi nhận lịch sử gửi, thời điểm gửi và lỗi phù hợp.
- Hỗ trợ retry có kiểm soát tối đa **3 lần** (`DEC-016`) và tránh gửi trùng ngoài ý muốn.
- Không làm mất dữ liệu hoặc rollback nghiệp vụ Database đã thành công khi Email gửi thất bại.

### FR-NOTI-005: View Notification Delivery History

**Priority:** Should Have

Người có quyền quản lý phải xem được trạng thái gửi Notification qua Email.

---

## 4.8. Dashboard & Reporting

### FR-DASH-001: View Dashboard

**Priority:** Must Have

Hệ thống phải cung cấp Dashboard tổng quan.

Các thông tin dự kiến:

- Total Tasks.
- Completed Tasks.
- Overdue Tasks.
- Tasks Waiting for Review.
- Member Progress.
- Recent Activities.
- Active Sprint.

### FR-DASH-002: View Sprint Progress

**Priority:** Must Have

Hệ thống phải hiển thị tiến độ Project/Sprint dựa trên **số lượng Task (`DONE / Total Tasks`)** (`DEC-017`).

### FR-DASH-003: View Burndown Chart

**Priority:** Should Have

Hệ thống hỗ trợ Burndown Chart để theo dõi khối lượng công việc còn lại trong Sprint theo thời gian, vẽ theo **Estimate Hours** (`DEC-017`). Nếu Sprint chưa có Task nào nhập Estimate, hệ thống hiển thị thông báo thiếu dữ liệu Estimate.

### FR-DASH-004: View Member Contribution

**Priority:** Should Have

Hệ thống phải cung cấp thông tin đóng góp của thành viên dựa trên dữ liệu thực tế.

Các dữ liệu có thể sử dụng:

- Task được giao.
- Task hoàn thành.
- Task đang thực hiện.
- Task bị từ chối Review.
- Lịch sử tham gia công việc.
- Khối lượng Estimate nếu đã được xác định.

Báo cáo không được mặc định xem số lượng Task là thước đo duy nhất của năng suất hoặc chất lượng.

### FR-DASH-005: View Project Reports

**Priority:** Should Have

Hệ thống hỗ trợ báo cáo tổng quan Project.

Thông tin gồm:

- Tổng số Task.
- Tiến độ hoàn thành.
- Task quá hạn.
- Task đang chờ Review.
- Tiến độ Sprint.
- Hoạt động của thành viên.

---

## 4.9. Activity & Audit Log

### FR-ACT-001: Record Activity

**Priority:** Must Have

Hệ thống phải ghi nhận các hoạt động quan trọng.

### FR-ACT-002: View Activity History

**Priority:** Must Have

Người có quyền phải xem được lịch sử hoạt động phù hợp với phạm vi truy cập.

### FR-ACT-003: Record Audit Events

**Priority:** Must Have

Hệ thống phải ghi nhận các thay đổi quan trọng về:

- Account Status.
- Role.
- Permission.
- Project Status.
- Các thao tác quản trị quan trọng.

### FR-ACT-004: Protect Audit Data

**Priority:** Must Have

Người dùng thông thường không được phép chỉnh sửa hoặc xóa Audit Log.

---

# 5. Non-Functional Requirements

## 5.1. Security

### NFR-SEC-001: Authentication Security

Hệ thống phải xác thực người dùng trước khi cho phép truy cập các chức năng được bảo vệ.

### NFR-SEC-002: Password Protection

Password phải được hash bằng thuật toán phù hợp. Không lưu Password dạng văn bản thuần.

### NFR-SEC-003: Authorization

Mọi thao tác cần bảo vệ phải được kiểm tra quyền ở phía Server.

### NFR-SEC-004: Session Security

Session phải được quản lý an toàn, sử dụng Cookie với các thuộc tính bảo mật phù hợp.

### NFR-SEC-005: Input Validation

Dữ liệu đầu vào phải được kiểm tra trước khi xử lý hoặc lưu vào Database.

### NFR-SEC-006: Data Isolation

Người dùng không được truy cập dữ liệu ngoài phạm vi quyền của mình.

### NFR-SEC-007: Secret Management

Database Credentials, Authentication Secret và Email Credentials không được lưu trực tiếp trong Source Code hoặc Public Repository.

## 5.2. Performance

### NFR-PER-001: Page Loading

Các trang thông thường cần được tối ưu để hiển thị nhanh trong điều kiện mạng và Hosting phù hợp.

Mục tiêu thời gian cụ thể: **[CHƯA XÁC ĐỊNH]**.

### NFR-PER-002: Database Query

Các truy vấn phải tránh tải dữ liệu không cần thiết và hạn chế N+1 Query.

### NFR-PER-003: Pagination

Các danh sách có thể tăng trưởng cần hỗ trợ Pagination hoặc cơ chế tải dữ liệu theo từng phần.

### NFR-PER-004: Dashboard

Dashboard phải sử dụng các truy vấn phù hợp, tránh tải toàn bộ dữ liệu lịch sử khi không cần thiết.

## 5.3. Usability

### NFR-USA-001: User Interface

Giao diện phải đơn giản, rõ ràng và dễ sử dụng.

### NFR-USA-002: Consistency

Các thành phần giao diện như Button, Form, Table, Dialog và Notification phải có cách trình bày nhất quán.

### NFR-USA-003: Responsive Design

Hệ thống phải hỗ trợ Desktop, Tablet và Mobile.

### NFR-USA-004: Feedback

Hệ thống phải thông báo rõ kết quả của các thao tác thành công hoặc thất bại.

### NFR-USA-005: Navigation

Người dùng phải có thể điều hướng giữa các module một cách thuận tiện.

## 5.4. Reliability

### NFR-REL-001: Data Integrity

Hệ thống phải đảm bảo dữ liệu không bị sai lệch khi thực hiện các nghiệp vụ liên quan.

### NFR-REL-002: Transaction

Các nghiệp vụ cập nhật nhiều bản ghi liên quan phải sử dụng Transaction phù hợp.

### NFR-REL-003: Error Handling

Lỗi phải được xử lý và hiển thị phù hợp, không làm lộ thông tin nội bộ.

### NFR-REL-004: Data Backup

Database phải có phương án Backup và Restore phù hợp với khả năng của nền tảng Hosting.

## 5.5. Maintainability

### NFR-MAI-001: Modular Architecture

Source Code phải được tổ chức theo các module nghiệp vụ.

### NFR-MAI-002: Code Quality

Code phải có cấu trúc rõ ràng, dễ đọc và dễ bảo trì.

### NFR-MAI-003: Type Safety

Sử dụng TypeScript để kiểm soát kiểu dữ liệu trong ứng dụng.

### NFR-MAI-004: Documentation

Các module và nghiệp vụ quan trọng phải có tài liệu mô tả phù hợp.

## 5.6. Compatibility

### NFR-COM-001: Browser Compatibility

Hỗ trợ các trình duyệt hiện đại phổ biến.

### NFR-COM-002: Device Compatibility

Giao diện phải thích ứng với các kích thước màn hình khác nhau.

## 5.7. Cost Constraints

### NFR-COST-001: Free-tier Preference

Hệ thống ưu tiên sử dụng các dịch vụ có Free Tier.

### NFR-COST-002: Cost Awareness

Thiết kế cần chú ý giới hạn Database Storage, Bandwidth, Email Sending và Hosting Usage.

### NFR-COST-003: No Unnecessary Infrastructure

Không triển khai các thành phần hạ tầng phức tạp khi chưa có nhu cầu thực tế.

---

# 6. Business Rules

Các Business Rules chi tiết và mã BR chuẩn được quản lý tập trung tại `Business-Rules-and-Workflows.md`, Section 3. Tài liệu này không duy trì bản sao bảng mã BR nhằm tránh trùng lặp và sai lệch Traceability.

Các quy tắc trọng yếu áp dụng cho SRS:

- Project Template và Instructor đều là tùy chọn.
- Task Priority: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- Task Estimate: Time-based, đơn vị giờ, tùy chọn.
- Task Dependency: không cho phép Task chuyển sang `DONE` khi có predecessor chưa `DONE`.
- Một Project có thể có nhiều Sprint `ACTIVE`.
- Leader quyết định cách xử lý từng Task chưa hoàn thành khi Sprint kết thúc; lịch sử phải được lưu.
- Admin có quyền Restore Project Archived; nếu khôi phục sang `ACTIVE`, phải kiểm tra không tồn tại Project `ACTIVE` khác.
- Leader phải reassign tất cả Task đang giao cho Member trước khi Remove Member.
- Email Notification là yêu cầu `Must Have` trong MVP.

# 7. Use Case Overview

Các Use Case chi tiết được mô tả trong `Use-Case-Specification.md`.

| Use Case ID | Use Case Name | Primary Actor |
|---|---|---|
| UC-001 | Register Account | Guest |
| UC-002 | Login | User |
| UC-003 | Logout | User |
| UC-004 | Manage User Accounts | Admin |
| UC-005 | Approve or Reject Account | Admin |
| UC-006 | Manage Roles and Permissions | Admin |
| UC-007 | Create Project | Admin / Leader |
| UC-008 | View Project | Authorized User |
| UC-009 | Update Project | Admin / Leader |
| UC-010 | Activate Project | Admin / Leader |
| UC-011 | Archive Project | Admin / Leader |
| UC-012 | Manage Project Members | Admin / Leader |
| UC-013 | Create Task | Authorized User |
| UC-014 | Update Task | Authorized User |
| UC-015 | Assign Task | Leader |
| UC-016 | Submit Task for Review | Member |
| UC-017 | Approve Task Review | Leader |
| UC-018 | Reject Task Review | Leader |
| UC-019 | View Task History | Authorized User |
| UC-020 | Create Sprint | Leader |
| UC-021 | Manage Backlog | Leader |
| UC-022 | Plan Sprint | Leader |
| UC-023 | View Sprint Overview | Authorized User |
| UC-024 | View Kanban Board | Authorized User |
| UC-025 | Filter Tasks | Authorized User |
| UC-026 | Manage Documents | Authorized User |
| UC-027 | Open Document | Authorized User |
| UC-028 | View Notifications | User |
| UC-029 | Manage Notification Read Status | User |
| UC-030 | View Dashboard | Authorized User |
| UC-031 | View Reports | Authorized User |
| UC-032 | View Activity History | Authorized User |
| UC-033 | Manage User Profile | User |

---

# 8. External Interface Requirements

## 8.1. User Interface

Hệ thống cần có các khu vực giao diện chính:

- Authentication Pages.
- Dashboard.
- Project Management.
- Member Management.
- Task Management.
- Kanban Board.
- Sprint Management.
- Document Library.
- Notification Center.
- Reports.
- User Profile.
- Administration.

Giao diện phải sử dụng các thành phần nhất quán và có phản hồi phù hợp với thao tác của người dùng.

## 8.2. Database Interface

Ứng dụng giao tiếp với PostgreSQL thông qua Prisma ORM (đề xuất).

Các yêu cầu:

- Database chỉ được truy cập ở Server.
- Các truy vấn phải tuân thủ quyền truy cập.
- Sử dụng Transaction cho nghiệp vụ cần thiết.
- Không để lộ thông tin kết nối Database.

## 8.3. Google Drive Interface

Hệ thống lưu Google Drive URL và mở liên kết thông qua trình duyệt.

Không yêu cầu tích hợp Google Drive API trong MVP.

## 8.4. Email Interface

Hệ thống sử dụng Email Provider để gửi thông báo.

Nhà cung cấp và phương thức tích hợp: **[CHƯA XÁC ĐỊNH]**.

---

# 9. Data Requirements

## 9.1. Data Entities

Các Entity chính:

- User.
- Role.
- Permission.
- UserRole.
- RolePermission.
- Project.
- ProjectTemplate.
- ProjectMember.
- Task.
- TaskAssignee.
- TaskDependency.
- TaskStatusHistory.
- TaskReview.
- Sprint.
- Document.
- Notification.
- NotificationDelivery.
- ActivityLog.
- AuditLog.

## 9.2. Data Integrity

Hệ thống phải đảm bảo:

- Primary Key duy nhất.
- Foreign Key hợp lệ.
- Không tạo dữ liệu quan hệ sai.
- Kiểm tra các trường bắt buộc.
- Kiểm tra các giá trị có giới hạn.
- Kiểm tra các ràng buộc nghiệp vụ.
- Lưu lịch sử cần thiết.

## 9.3. Data Retention

Các dữ liệu lịch sử quan trọng cần được giữ lại:

- Task Status History.
- Task Review History.
- Task Assignment History.
- Activity Log.
- Audit Log.

Thời gian lưu trữ cụ thể: **[CHƯA XÁC ĐỊNH]**.

---

# 10. System Constraints

## 10.1. Technical Constraints

- Sử dụng Next.js Fullstack.
- Không triển khai Backend riêng.
- Ưu tiên Modular Monolith.
- Không truy cập Database trực tiếp từ Client.
- Không triển khai Microservices trong MVP.
- Không yêu cầu Docker hoặc Kubernetes.
- Ưu tiên PostgreSQL và Prisma, chờ xác nhận công nghệ cuối cùng.

## 10.2. Business Constraints

- Hệ thống phục vụ một nhóm nội bộ.
- Chỉ có một Workspace.
- Có thể quản lý nhiều Project theo thời gian.
- Chỉ có một Project ACTIVE tại một thời điểm.
- Có bốn Role chính: Admin, Instructor, Leader, Member.
- Task hỗ trợ nhiều Assignees.
- Sprint được quản lý theo mô hình Formal Sprint.

## 10.3. Budget Constraints

- Ưu tiên dịch vụ miễn phí.
- Không phụ thuộc vào dịch vụ trả phí bắt buộc.
- Cần kiểm tra giới hạn Free Tier trước khi triển khai.

---

# 11. Assumptions and Dependencies

## 11.1. Assumptions

- Người dùng có kết nối Internet để truy cập hệ thống.
- Người dùng có trình duyệt hiện đại.
- Thành viên có tài khoản được Admin phê duyệt.
- Các thành viên sử dụng Google Drive để lưu trữ tài liệu.
- Nhóm có Repository GitHub để quản lý Source Code nếu cần.
- Hệ thống được sử dụng trong phạm vi một nhóm.

## 11.2. Dependencies

- Next.js Framework.
- PostgreSQL Database.
- Prisma ORM.
- Authentication Solution.
- Email Provider.
- Google Drive.
- GitHub.
- Hosting Provider.

Một số Dependency vẫn là lựa chọn đề xuất và cần xác nhận trong giai đoạn triển khai.

---

# 12. Acceptance Criteria

Hệ thống được xem là đáp ứng phạm vi MVP khi thỏa mãn các tiêu chí sau:

## 12.1. Authentication & Authorization

- Người dùng đăng ký được tài khoản.
- Tài khoản mới ở trạng thái PENDING.
- Admin có thể Approve hoặc Reject.
- Người dùng ACTIVE đăng nhập được.
- Tài khoản không hợp lệ không được truy cập chức năng được bảo vệ.
- Role và Permission được kiểm tra ở Server.

## 12.2. Project Management

- Admin hoặc Leader tạo được Project.
- Project có thể sử dụng Template; Template không bắt buộc.
- Có thể quản lý Project Members.
- Chỉ có một Project ACTIVE tại một thời điểm.
- Project có thể Archive mà không mất lịch sử.

## 12.3. Task Management

- Người có quyền tạo và cập nhật Task.
- Task hỗ trợ nhiều Assignees.
- Task có Deadline bắt buộc.
- Task hỗ trợ Task Dependency.
- Task tuân thủ Workflow.
- Leader có thể Approve hoặc Reject Review.
- Lý do Review được lưu.
- Task History được ghi nhận.

## 12.4. Sprint & Kanban

- Leader tạo được Sprint.
- Có thể quản lý Backlog.
- Có thể đưa Task vào Sprint.
- Task không thuộc nhiều Sprint cùng lúc.
- Kanban hiển thị Task theo trạng thái.
- Có thể lọc Task theo các tiêu chí được hỗ trợ.
- Sprint Overview hiển thị tiến độ.

## 12.5. Document & Notification

- Có thể thêm Document Record.
- Có thể mở Google Drive URL.
- Notification được tạo theo các sự kiện đã xác định.
- Người dùng xem được Notification của mình.
- Trạng thái Read/Unread hoạt động chính xác.
- Email Notification được gửi cho các sự kiện đã quy định và có Delivery History.

## 12.6. Dashboard & Reporting

- Dashboard hiển thị số liệu Task.
- Hiển thị Task quá hạn.
- Hiển thị Task chờ Review.
- Hiển thị Sprint Progress.
- Báo cáo sử dụng dữ liệu thực tế.
- Activity History có thể truy xuất.

## 12.7. General Quality

- Các chức năng chính hoạt động đúng.
- Không có lỗi nghiêm trọng trong các luồng nghiệp vụ chính.
- Dữ liệu không bị sai lệch trong các thao tác quan trọng.
- Giao diện hỗ trợ Desktop và Mobile.
- Các chức năng được bảo vệ bằng Authorization.
- Có tài liệu hướng dẫn sử dụng và triển khai cơ bản.

---

# 13. Requirement Traceability

Bảng này liên kết yêu cầu với Use Case và Module tương ứng.

| Requirement Group | Related Use Cases | Module |
|---|---|---|
| FR-AUTH | UC-001 to UC-006, UC-033 | Authentication & Account |
| FR-PROJ | UC-007 to UC-012, UC-034 | Project Management |
| FR-TASK | UC-013 to UC-019 | Task Management |
| FR-SPRINT | UC-020 to UC-023, UC-035 | Sprint Management |
| FR-KANBAN | UC-024 to UC-025 | Kanban |
| FR-DOC | UC-026 to UC-027 | Document Library |
| FR-NOTI | UC-028 to UC-029 | Notification |
| FR-DASH | UC-030 to UC-031 | Dashboard & Reporting |
| FR-ACT | UC-032 | Activity & Audit |

Bảng Traceability chi tiết hơn có thể được bổ sung khi chuyển yêu cầu thành User Stories và Test Cases.

---

# 14. Open Issues

Các quyết định nghiệp vụ cần xác nhận trước hoặc trong quá trình triển khai:

| ID | Open Issue | Status |
|---|---|---|
| OI-001 | Admin có được tạo tài khoản trực tiếp không? | Chưa xác định |
| OI-002 | Có yêu cầu Email Verification khi đăng ký không? | Đã chốt (`DEC-014`): Không yêu cầu |
| OI-003 | Người dùng được chỉnh sửa những trường Profile nào? | Đã chốt (`DEC-018`): Full Name và đổi Password |
| OI-004 | Instructor có được bình luận vào Task không? | Chưa xác định |
| OI-005 | Member được phép chỉnh sửa những trường Task nào? | Đã chốt (`DEC-015`): Status và Reference Links / ghi chú tiến độ |
| OI-006 | Điều kiện Archive Project là gì? | Chưa xác định |
| OI-007 | Có cho phép hủy Sprint không? | Chưa xác định |
| OI-008 | Có cho phép hủy Task không? | Chưa xác định |
| OI-009 | Ai có quyền xóa Document Record? | Chưa xác định |
| OI-010 | Có gửi Notification trước Deadline không? | Chưa xác định |
| OI-011 | Công thức tính Project Progress là gì? | Đã chốt (`DEC-017`): Task Count (`DONE / Total`) |
| OI-012 | Công thức tính Sprint Progress là gì? | Đã chốt (`DEC-017`): Task Count (`DONE / Total`) |
| OI-013 | Chỉ số nào được sử dụng trong Contribution Report? | Chưa xác định |
| OI-014 | Email Provider nào được sử dụng? | Đã chốt (`DEC-016`): Resend (Free Tier API) + tối đa 3 lần retry |

Các nội dung chưa xác định không được tự ý biến thành yêu cầu bắt buộc khi triển khai. Cần có quyết định chính thức hoặc cập nhật tài liệu trước khi thực hiện.

---

# 15. Document Change History

| Version | Date | Description |
|---|---|---|
| 1.0 | 14/11/2026 | Initial Software Requirements Specification |
| 1.1 | 14/11/2026 | Đồng bộ các quyết định nghiệp vụ đã xác nhận; Email Notification là Must Have |
| 1.2 | 15/11/2026 | Bổ sung UC-034/UC-035 vào Traceability, chuẩn hóa Open Issue IDs và đồng bộ quy tắc Assignees tùy chọn |


## Confirmed Decisions Update — 2026-11-14

- Project Template: tùy chọn.
- Instructor: tùy chọn.
- Task Priority: LOW / MEDIUM / HIGH / CRITICAL.
- Task Estimate: Time-based, đơn vị giờ.
- Task Dependency: chặn chuyển sang DONE khi predecessor chưa DONE.
- Một Project có thể có nhiều Sprint ACTIVE.
- Leader quyết định xử lý từng Task chưa hoàn thành khi Sprint kết thúc.
- Admin được Restore Project Archived, tuân thủ giới hạn một Project ACTIVE.
- Leader phải phân công lại Task trước khi Remove Member.
- Email Notification bắt buộc trong MVP.
- Assignees không bắt buộc khi tạo Task; Leader có thể phân công sau.
