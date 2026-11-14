# PROJECT SCOPE AND ROADMAP

**Project Name:** Akatsuki Yui  
**Document Version:** 1.0  
**Project Type:** Web-based Project & Team Management System  
**Project Phase:** MVP  
**Document Status:** Draft

---

# 1. Project Scope

## 1.1. Scope Overview

Akatsuki Yui được phát triển nhằm cung cấp một nền tảng quản lý tập trung cho nhóm sinh viên thực hiện đồ án môn học và đồ án tốt nghiệp.

Phạm vi dự án tập trung vào việc quản lý tài khoản, phân quyền, Project, thành viên, Task, Sprint, tài liệu, thông báo và báo cáo tiến độ.

Phiên bản MVP ưu tiên các chức năng thiết yếu để nhóm có thể sử dụng trong thực tế, đồng thời đảm bảo kiến trúc có khả năng mở rộng khi phát sinh nhu cầu mới.

Hệ thống được xây dựng theo mô hình Single Workspace, phục vụ một nhóm nội bộ duy nhất. Không hướng đến mô hình SaaS đa tổ chức hoặc cung cấp dịch vụ công khai cho nhiều nhóm độc lập.

## 1.2. Project Goals

Các mục tiêu chính trong phạm vi phát triển:

1. Xây dựng hệ thống quản lý tài khoản và quyền truy cập tập trung.
2. Hỗ trợ quản lý nhiều Project theo thời gian, với tối đa một Project Active tại một thời điểm.
3. Hỗ trợ quản lý thành viên, Leader và Instructor trong từng Project.
4. Cung cấp chức năng quản lý Task với nhiều Assignee, Deadline, Priority, Estimate và Dependency.
5. Kết hợp Sprint Planning, Backlog và Kanban Board trong cùng một Project.
6. Quản lý quy trình Review và xác nhận hoàn thành Task.
7. Quản lý tài liệu thông qua Google Drive URL.
8. Cung cấp thông báo trong hệ thống và qua Email.
9. Cung cấp Dashboard và báo cáo tiến độ dựa trên dữ liệu thực tế.
10. Đảm bảo hệ thống có thể triển khai và sử dụng với chi phí ưu tiên hoàn toàn miễn phí.

---

# 2. In-Scope

Các chức năng dưới đây thuộc phạm vi phát triển của phiên bản MVP.

## 2.1. Authentication and Account Management

**Description:**

Quản lý quá trình đăng ký, xác thực và trạng thái tài khoản người dùng.

**Functional Scope:**

- Đăng ký tài khoản bằng Email và Password.
- Đăng nhập và đăng xuất.
- Quản lý phiên đăng nhập.
- Đăng ký tài khoản mới ở trạng thái Pending.
- Admin phê duyệt hoặc từ chối yêu cầu đăng ký.
- Admin có thể thay đổi trạng thái tài khoản.
- Hỗ trợ trạng thái tài khoản Active, Pending, Rejected và Suspended.
- Quản lý thông tin cá nhân cơ bản.

**Expected Outcome:**

Người dùng có thể đăng ký và sử dụng hệ thống sau khi được Admin phê duyệt.

## 2.2. Authorization Management

**Description:**

Quản lý quyền truy cập dựa trên Role và Permission.

**Functional Scope:**

- Hỗ trợ bốn Role mặc định: Admin, Instructor, Leader và Member.
- Quản lý danh sách Permission.
- Xây dựng Permission Matrix.
- Cho phép Admin cấp hoặc thu hồi Permission cho Role.
- Phân biệt quyền cấp hệ thống và quyền trong phạm vi Project.
- Kiểm tra quyền truy cập phía Server.
- Ghi nhận lịch sử thay đổi Role và Permission.

**Expected Outcome:**

Đảm bảo người dùng chỉ có thể truy cập và thực hiện những chức năng được cấp quyền.

## 2.3. Project Management

**Description:**

Quản lý thông tin và vòng đời của Project.

**Functional Scope:**

- Tạo Project mới.
- Cập nhật thông tin Project.
- Quản lý tên, mô tả, mục tiêu và phạm vi.
- Quản lý ngày bắt đầu và kết thúc.
- Gán Project Leader bắt buộc và Instructor tùy chọn.
- Quản lý danh sách thành viên.
- Quản lý công nghệ sử dụng.
- Lưu Repository URL.
- Quản lý trạng thái Project.
- Lưu trữ Project đã hoàn thành.
- Hỗ trợ tạo Project từ Template; Template không bắt buộc.
- Cho phép Admin và Leader tạo Project.
- Nếu Leader tạo Project, tự động gán người tạo làm Project Leader.

**Business Constraints:**

- Chỉ cho phép một Project ở trạng thái Active tại cùng một thời điểm.
- Project đã Archived không được tiếp tục chỉnh sửa dữ liệu nghiệp vụ thông thường.
- Dữ liệu lịch sử của Project Archived phải được giữ lại.
- Việc tạo Project mới ở trạng thái Active phải tuân thủ quy tắc giới hạn Project đang hoạt động.

**Expected Outcome:**

Nhóm có thể quản lý thông tin Project xuyên suốt từ khi khởi tạo đến khi hoàn thành và lưu trữ.

## 2.4. Member Management

**Description:**

Quản lý thành viên tham gia từng Project.

**Functional Scope:**

- Xem danh sách thành viên.
- Thêm thành viên vào Project.
- Loại bỏ thành viên khỏi Project.
- Gán Project Leader.
- Gán Instructor.
- Xem thông tin và tình hình thực hiện công việc của thành viên.
- Quản lý vai trò của thành viên trong Project.

**Expected Outcome:**

Leader có thể quản lý thành viên và phân công trách nhiệm rõ ràng.

## 2.5. Task Management

**Description:**

Quản lý toàn bộ công việc cần thực hiện trong Project.

**Functional Scope:**

- Tạo Task.
- Chỉnh sửa Task.
- Xem chi tiết Task.
- Xóa hoặc lưu trữ Task theo quy tắc nghiệp vụ.
- Gán một hoặc nhiều Assignee.
- Thiết lập Start Date tùy chọn.
- Thiết lập Deadline bắt buộc.
- Quản lý Priority.
- Quản lý Time-based Estimate theo giờ.
- Quản lý mô tả và nội dung công việc.
- Gắn Google Drive URL hoặc đường dẫn tài liệu liên quan.
- Thiết lập Task Dependency; chặn hoàn thành Task phụ thuộc khi Task tiền nhiệm chưa DONE.
- Cập nhật trạng thái Task.
- Gửi Task sang Review.
- Leader xác nhận Task hoàn thành hoặc yêu cầu chỉnh sửa.
- Bắt buộc nhập lý do khi Leader xử lý Review.
- Lưu lịch sử thay đổi trạng thái và phân công.

**Task Status:**

- TODO.
- IN PROGRESS.
- REVIEW.
- DONE.

**Expected Outcome:**

Mỗi công việc có người phụ trách, thời hạn và trạng thái rõ ràng, giúp Leader theo dõi tiến độ và Member chủ động thực hiện nhiệm vụ.

## 2.6. Sprint Management

**Description:**

Quản lý kế hoạch công việc theo từng giai đoạn Sprint trong Project.

**Functional Scope:**

- Tạo Sprint.
- Chỉnh sửa thông tin Sprint.
- Quản lý Sprint Name.
- Quản lý Sprint Goal.
- Thiết lập Start Date và End Date.
- Quản lý Sprint Status.
- Xem danh sách Sprint.
- Quản lý Project Backlog.
- Đưa Task từ Backlog vào Sprint.
- Chuyển Task giữa các Sprint.
- Theo dõi tiến độ từng Sprint.
- Xem danh sách Task thuộc Sprint.
- Lưu lịch sử thay đổi Sprint của Task.

**Expected Outcome:**

Leader có thể lập kế hoạch và phân chia công việc theo từng giai đoạn, đồng thời theo dõi mức độ hoàn thành mục tiêu Sprint.

## 2.7. Kanban Board

**Description:**

Cung cấp giao diện trực quan để quản lý trạng thái Task.

**Functional Scope:**

- Hiển thị Task theo các cột trạng thái.
- Hỗ trợ thao tác thay đổi trạng thái Task.
- Hiển thị thông tin cơ bản của Task trên Card.
- Lọc Task theo Sprint.
- Lọc Task theo Assignee.
- Lọc Task theo Priority.
- Lọc Task theo Deadline.
- Xem Kanban ở phạm vi toàn Project hoặc từng Sprint.
- Hiển thị cảnh báo Task quá hạn.

**Expected Outcome:**

Các thành viên có thể nhanh chóng nhận biết công việc đang ở giai đoạn nào và tình hình thực hiện của toàn Project.

## 2.8. Document Library

**Description:**

Quản lý tập trung các tài liệu liên quan đến Project.

**Functional Scope:**

- Thêm tài liệu bằng Google Drive URL.
- Chỉnh sửa thông tin tài liệu.
- Xóa tài liệu theo quyền được cấp.
- Phân loại tài liệu.
- Tìm kiếm tài liệu.
- Lọc tài liệu theo Category.
- Gắn tài liệu với Project.
- Gắn tài liệu với Sprint khi cần.
- Mở tài liệu bằng đường dẫn trực tiếp trong trình duyệt.

**Default Categories:**

- Project Documents.
- Design.
- Development.
- Meeting & Reports.
- Other.

**Constraints:**

- Không upload file trực tiếp lên hệ thống.
- Hệ thống chỉ lưu thông tin và đường dẫn tài liệu.
- Quyền truy cập nội dung Google Drive phụ thuộc vào thiết lập chia sẻ của Google Drive.

**Expected Outcome:**

Thành viên có thể tìm kiếm và truy cập nhanh các tài liệu cần thiết mà không phải tìm kiếm thủ công trong nhiều nguồn khác nhau.

## 2.9. Notification Management

**Description:**

Cung cấp thông báo tự động khi xảy ra các sự kiện nghiệp vụ quan trọng.

**Functional Scope:**

- Notification Center.
- Hiển thị thông báo chưa đọc và đã đọc.
- Đánh dấu thông báo đã đọc.
- Gửi Email Notification; đây là yêu cầu bắt buộc trong MVP.
- Lưu lịch sử gửi thông báo.
- Thông báo khi người dùng được giao Task.
- Thông báo cho Leader khi Task được chuyển sang Review.
- Thông báo cho Assignee khi Leader xử lý Review.
- Thông báo về những sự kiện quan trọng liên quan đến Project và tài khoản.

**Expected Outcome:**

Người dùng được cập nhật kịp thời về những thay đổi có liên quan đến công việc của mình.

## 2.10. Dashboard and Reporting

**Description:**

Cung cấp thông tin tổng quan về tiến độ Project và tình hình thực hiện công việc.

**Functional Scope:**

- Hiển thị tổng số Task.
- Thống kê Task hoàn thành.
- Thống kê Task đang thực hiện.
- Thống kê Task chờ Review.
- Thống kê Task quá hạn.
- Theo dõi tiến độ từng thành viên.
- Hiển thị hoạt động gần đây.
- Hiển thị Sprint Progress.
- Hỗ trợ Burndown Chart.
- Cung cấp Contribution Report.
- Lọc dữ liệu báo cáo theo Project, Sprint và khoảng thời gian phù hợp.

**Reporting Principles:**

- Báo cáo dựa trên dữ liệu thực tế được lưu trong hệ thống.
- Không tự động đưa ra đánh giá chủ quan về năng lực thành viên.
- Các chỉ số phải có định nghĩa và cách tính rõ ràng.
- Không sử dụng số lượng Task đơn thuần để kết luận chất lượng hoặc năng suất của thành viên.

**Expected Outcome:**

Leader và Instructor có thể nắm bắt tình hình Project thông qua các chỉ số và biểu đồ trực quan.

## 2.11. Activity and Audit Log

**Description:**

Lưu lại các hoạt động quan trọng nhằm hỗ trợ truy vết và kiểm tra lịch sử.

**Functional Scope:**

- Ghi nhận hoạt động tạo và cập nhật Project.
- Ghi nhận hoạt động tạo và phân công Task.
- Ghi nhận thay đổi trạng thái Task.
- Ghi nhận thay đổi Assignee.
- Ghi nhận hoạt động Sprint.
- Ghi nhận thay đổi Role và Permission.
- Ghi nhận những thao tác quản trị quan trọng.
- Hiển thị hoạt động gần đây theo quyền truy cập.

**Expected Outcome:**

Đảm bảo các thay đổi quan trọng trong hệ thống có thể được kiểm tra và truy vết.

---

# 3. Out-of-Scope

Các chức năng dưới đây không được triển khai trong phiên bản MVP.

| No. | Feature | Reason for Exclusion |
|---|---|---|
| 1 | Multi-tenant Workspace | Hệ thống chỉ phục vụ một nhóm nội bộ. |
| 2 | Public SaaS Registration | Không cung cấp dịch vụ cho các nhóm bên ngoài. |
| 3 | GitHub API Integration | Chưa cần thiết trong giai đoạn đầu. |
| 4 | Internal Chat | Không thuộc nhu cầu cộng tác đã xác định. |
| 5 | Direct File Upload | Sử dụng Google Drive URL để giảm chi phí lưu trữ. |
| 6 | Native Mobile Application | Ưu tiên Web Application và Responsive UI. |
| 7 | AI Task Assignment | Chưa cần tự động hóa việc phân công. |
| 8 | AI Member Evaluation | Chỉ sử dụng báo cáo khách quan. |
| 9 | Online Meeting Integration | Không thuộc phạm vi MVP. |
| 10 | Payroll and Attendance | Không phải hệ thống quản lý nhân sự. |
| 11 | Payment Management | Không có nghiệp vụ thanh toán. |
| 12 | Microservices Architecture | Không cần thiết đối với quy mô hiện tại. |
| 13 | Advanced Real-time Collaboration | Không cần hệ thống cộng tác realtime phức tạp. |

Các chức năng này có thể được xem xét trong những phiên bản sau nếu phát sinh nhu cầu thực tế.

---

# 4. Non-Functional Scope

Ngoài các chức năng nghiệp vụ, MVP cần đáp ứng những yêu cầu chất lượng cơ bản sau:

## 4.1. Security

- Password phải được lưu dưới dạng hash an toàn.
- Sử dụng cơ chế Session-based Authentication phù hợp.
- Cookie phiên đăng nhập cần có các thuộc tính bảo mật thích hợp.
- Kiểm tra quyền truy cập ở phía Server.
- Bảo vệ dữ liệu giữa các Project.
- Kiểm tra và xác thực dữ liệu đầu vào.
- Ngăn chặn truy cập trái phép vào các API được bảo vệ.
- Ghi nhận các thay đổi quan trọng liên quan đến quyền và tài khoản.

## 4.2. Performance

- Giao diện cần phản hồi tốt với quy mô dữ liệu của một nhóm nhỏ.
- Truy vấn Database cần có cấu trúc hợp lý.
- Hạn chế truy vấn dữ liệu không cần thiết.
- Sử dụng phân trang khi danh sách dữ liệu có thể tăng lớn.
- Dashboard cần tối ưu các truy vấn thống kê.

## 4.3. Usability

- Giao diện đơn giản, chuyên nghiệp và dễ sử dụng.
- Ưu tiên trải nghiệm Desktop.
- Hỗ trợ Responsive trên Tablet và Mobile.
- Các chức năng chính phải dễ tìm kiếm và thao tác.
- Các trạng thái Task và Project phải được thể hiện trực quan.
- Các thông báo lỗi và xác nhận cần rõ ràng.

## 4.4. Maintainability

- Sử dụng Modular Monolith.
- Tổ chức mã nguồn theo module nghiệp vụ.
- Phân tách Presentation, Business Logic và Data Access.
- Sử dụng TypeScript.
- Có quy ước đặt tên và tổ chức mã nguồn thống nhất.
- Các Business Rules quan trọng cần được kiểm thử.

## 4.5. Reliability

- Các thao tác thay đổi dữ liệu quan trọng cần đảm bảo tính nhất quán.
- Sử dụng Database Transaction khi cần thiết.
- Hạn chế dữ liệu trùng lặp hoặc không hợp lệ.
- Có cơ chế xử lý lỗi phù hợp.
- Có phương án sao lưu và phục hồi Database phù hợp với khả năng của dịch vụ miễn phí.

## 4.6. Cost Constraints

- Ưu tiên sử dụng Free Tier.
- Không phụ thuộc vào các dịch vụ trả phí bắt buộc.
- Hạn chế sử dụng các dịch vụ bên ngoài không cần thiết.
- Không triển khai hạ tầng phức tạp vượt quá nhu cầu MVP.

---

# 5. Project Roadmap

## 5.1. Roadmap Overview

Quá trình phát triển Akatsuki Yui được chia thành tám Sprint chính.

| Sprint | Name | Main Deliverables |
|---|---|---|
| Sprint 0 | Foundation & Setup | Project Skeleton, Architecture, Database Foundation |
| Sprint 1 | Authentication & User Management | Authentication, Registration Approval, User Management |
| Sprint 2 | Authorization & Project Management | Permission Matrix, Project, Project Template |
| Sprint 3 | Task Management | Task, Assignment, Dependency, Review |
| Sprint 4 | Sprint & Kanban Management | Backlog, Sprint Planning, Kanban Board |
| Sprint 5 | Documents & Notifications | Document Library, Notification, Email |
| Sprint 6 | Dashboard & Reporting | Dashboard, Charts, Contribution Report, Activity Log |
| Sprint 7 | Testing & Deployment | Testing, Bug Fixing, Production Deployment |

## 5.2. Sprint 0 – Foundation & Setup

**Objective:**

Xây dựng nền tảng kỹ thuật và cấu trúc ban đầu cho toàn bộ hệ thống.

**Scope:**

- Khởi tạo Next.js Application.
- Cấu hình TypeScript.
- Cấu hình Tailwind CSS và shadcn/ui.
- Thiết lập cấu trúc thư mục.
- Thiết lập Modular Monolith Architecture.
- Cấu hình Prisma.
- Kết nối PostgreSQL.
- Thiết kế Database Foundation.
- Cấu hình Environment Variables.
- Thiết lập Git Repository.
- Xây dựng Layout và Navigation cơ bản.
- Thiết lập quy ước phát triển.

**Deliverables:**

- Next.js Project hoạt động.
- Database Connection.
- Prisma Configuration.
- Base UI Layout.
- Initial Database Schema.
- Development Guidelines.

## 5.3. Sprint 1 – Authentication & User Management

**Objective:**

Hoàn thiện cơ chế xác thực và quản lý tài khoản.

**Scope:**

- Registration.
- Login.
- Logout.
- Session Management.
- Account Approval.
- Account Rejection.
- User Management.
- Account Status Management.
- Profile Management.

**Deliverables:**

- Authentication Module.
- User Management Module.
- Registration Approval Workflow.
- Login and Registration UI.

## 5.4. Sprint 2 – Authorization & Project Management

**Objective:**

Xây dựng hệ thống phân quyền và quản lý Project.

**Scope:**

- Role Management.
- Permission Management.
- Permission Matrix UI.
- Grant and Revoke Permission.
- Authorization Policies.
- Project Creation.
- Project Update.
- Project Lifecycle.
- Project Member Management.
- Leader and Instructor Assignment.
- Project Template.

**Deliverables:**

- Authorization Module.
- Permission Matrix.
- Project Management Module.
- Project Template Module.
- Project Management UI.

## 5.5. Sprint 3 – Task Management

**Objective:**

Xây dựng các chức năng quản lý và theo dõi công việc.

**Scope:**

- Task CRUD.
- Multiple Assignees.
- Task Priority.
- Task Estimate.
- Task Deadline.
- Optional Start Date.
- Task Dependency.
- Task Status Management.
- Task Review Workflow.
- Review Reason.
- Task Status History.
- Task Assignment History.

**Deliverables:**

- Task Management Module.
- Task Assignment.
- Task Dependency.
- Task Review Workflow.
- Task Detail UI.
- Task History.

## 5.6. Sprint 4 – Sprint & Kanban Management

**Objective:**

Hoàn thiện khả năng lập kế hoạch và theo dõi tiến độ thông qua Sprint và Kanban.

**Scope:**

- Sprint CRUD.
- Sprint Goal.
- Sprint Lifecycle.
- Project Backlog.
- Sprint Planning.
- Add Task to Sprint.
- Move Task Between Sprints.
- Kanban Board.
- Task Filtering.
- Sprint Progress.
- Sprint Task List.

**Deliverables:**

- Sprint Management Module.
- Backlog Management.
- Kanban Board.
- Sprint Overview.
- Sprint Planning UI.

## 5.7. Sprint 5 – Documents & Notifications

**Objective:**

Xây dựng hệ thống quản lý tài liệu và thông báo.

**Scope:**

- Document CRUD.
- Google Drive URL Management.
- Document Categories.
- Document Search and Filtering.
- Notification Center.
- Notification Read Status.
- Email Notification.
- Task Assignment Notification.
- Review Notification.
- Project-related Notification.

**Deliverables:**

- Document Library Module.
- Notification Module.
- Email Notification Integration.
- Document Management UI.

## 5.8. Sprint 6 – Dashboard & Reporting

**Objective:**

Cung cấp khả năng theo dõi tổng quan và báo cáo tiến độ.

**Scope:**

- Project Dashboard.
- Task Statistics.
- Overdue Task Statistics.
- Member Progress.
- Sprint Progress.
- Burndown Chart.
- Contribution Report.
- Recent Activities.
- Activity Log.
- Audit Log.

**Deliverables:**

- Dashboard Module.
- Reporting Module.
- Activity Log.
- Audit Log.
- Charts and Statistics UI.

## 5.9. Sprint 7 – Testing & Deployment

**Objective:**

Kiểm thử toàn bộ hệ thống, sửa lỗi và triển khai MVP.

**Scope:**

- Unit Testing.
- Integration Testing.
- End-to-End Testing.
- Authentication Testing.
- Authorization Testing.
- Business Rules Testing.
- Task Workflow Testing.
- Sprint Workflow Testing.
- Database Validation.
- UI Responsive Testing.
- Bug Fixing.
- Performance Review.
- Deployment Configuration.
- Database Migration.
- Environment Configuration.
- Final Documentation.

**Deliverables:**

- Tested Application.
- Bug Fixes.
- Deployment Configuration.
- Deployed Web Application.
- Final MVP Documentation.

---

# 6. Milestones

Các Milestone được xác định dựa trên kết quả của từng nhóm Sprint.

| Milestone | Completion Criteria |
|---|---|
| M0 – Foundation Ready | Hoàn thành cấu trúc dự án và kết nối Database. |
| M1 – Account System Ready | Người dùng có thể đăng ký, đăng nhập và được Admin phê duyệt. |
| M2 – Project System Ready | Hoàn thiện quản lý quyền và Project. |
| M3 – Task System Ready | Hoàn thiện phân công, cập nhật và Review Task. |
| M4 – Workflow System Ready | Hoàn thiện Backlog, Sprint và Kanban. |
| M5 – Collaboration Support Ready | Hoàn thiện Document Library và Notification. |
| M6 – Reporting Ready | Hoàn thiện Dashboard và báo cáo. |
| M7 – MVP Released | Hoàn thành kiểm thử và triển khai hệ thống. |

---

# 7. Dependencies and Risks

## 7.1. Dependencies

| Dependency | Description |
|---|---|
| PostgreSQL Hosting | Cần dịch vụ Database để lưu trữ dữ liệu. |
| Vercel | Dùng để triển khai Next.js Application. |
| Email Provider | Cần dịch vụ hỗ trợ gửi Email Notification. |
| Google Drive | Nguồn lưu trữ tài liệu bên ngoài. |
| Authentication Solution | Cần cơ chế xác thực và quản lý Session. |
| GitHub | Quản lý mã nguồn và lịch sử phát triển. |

## 7.2. Project Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Free Tier Limitations | Có thể ảnh hưởng khả năng vận hành khi vượt giới hạn miễn phí. | Kiểm tra giới hạn và tối ưu sử dụng dịch vụ. |
| Email Delivery Failure | Người dùng có thể không nhận được thông báo Email. | Lưu trạng thái gửi và hỗ trợ thử gửi lại phù hợp. |
| Permission Misconfiguration | Người dùng có thể được cấp quyền không phù hợp. | Kiểm tra quyền phía Server và lưu Audit Log. |
| Data Inconsistency | Dữ liệu Project, Task hoặc Sprint có thể không đồng nhất. | Sử dụng Database Constraints và Transactions. |
| Scope Creep | Phạm vi dự án có thể mở rộng ngoài kế hoạch. | Tuân thủ MVP Scope và quản lý Change Request. |
| Database Migration Issues | Thay đổi Schema có thể ảnh hưởng dữ liệu. | Kiểm tra Migration trước khi triển khai. |
| Limited Development Time | Có thể không hoàn thành tất cả chức năng đúng kế hoạch. | Ưu tiên các luồng nghiệp vụ cốt lõi. |

---

# 8. Scope Change Management

Mọi yêu cầu bổ sung hoặc thay đổi phạm vi cần được xem xét trước khi đưa vào kế hoạch phát triển.

Quy trình quản lý thay đổi:

1. **Change Request:** Ghi nhận yêu cầu thay đổi.
2. **Impact Analysis:** Phân tích ảnh hưởng đến chức năng, Database, Architecture và tiến độ.
3. **Priority Assessment:** Xác định mức độ ưu tiên.
4. **Approval:** Quyết định chấp nhận, trì hoãn hoặc từ chối.
5. **Documentation Update:** Cập nhật các tài liệu liên quan.
6. **Implementation:** Triển khai thay đổi sau khi được chấp thuận.

Các yêu cầu mới không thuộc phạm vi MVP sẽ được đưa vào Future Development Backlog thay vì triển khai ngay.

---

# 9. MVP Completion Criteria

Akatsuki Yui được xem là hoàn thành MVP khi:

- Các chức năng thuộc phạm vi MVP đã được triển khai.
- Người dùng có thể đăng ký và được Admin phê duyệt.
- Hệ thống phân quyền hoạt động đúng theo Permission Matrix.
- Project có thể được tạo, quản lý và lưu trữ.
- Hệ thống đảm bảo giới hạn một Project Active tại một thời điểm.
- Task có thể được tạo, phân công và theo dõi.
- Task Dependency và Multiple Assignees hoạt động đúng.
- Task Review tuân thủ đúng Business Rules.
- Sprint và Kanban hoạt động thống nhất.
- Document Library có thể quản lý Google Drive URL.
- Notification Center và Email Notification hoạt động với các sự kiện quan trọng.
- Dashboard và Reports hiển thị dữ liệu chính xác.
- Các hoạt động quan trọng được ghi nhận lịch sử.
- Những chức năng quan trọng đã được kiểm thử.
- Ứng dụng có thể triển khai và sử dụng thực tế với chi phí nằm trong ngân sách dự kiến.

---

**End of Project Scope and Roadmap – Akatsuki Yui**


## Confirmed Business Decisions Update — 2026-11-14

- Project Template và Instructor đều là tùy chọn khi tạo Project.
- Task Priority gồm `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- Task Estimate trong MVP sử dụng giờ (Time-based Estimate).
- Task Dependency chặn chuyển Task sang DONE khi predecessor chưa DONE.
- Một Project có thể có nhiều Sprint ACTIVE.
- Leader quyết định cách xử lý từng Task chưa hoàn thành khi Sprint kết thúc.
- Admin có thể Restore Project Archived, nhưng phải tuân thủ giới hạn tối đa một Project ACTIVE.
- Leader phải phân công lại Task trước khi loại bỏ thành viên khỏi Project.
- Email Notification là chức năng bắt buộc của MVP.
