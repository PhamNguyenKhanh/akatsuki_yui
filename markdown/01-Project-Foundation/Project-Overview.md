# PROJECT OVERVIEW

- **Project Name:** Akatsuki Yui
- **Document Version:** 1.0
- **Project Type:** Web-based Project & Team Management System
- **Project Status:** Planned
- **Target:** MVP – Personal Project & Portfolio

---

## 1. Project Introduction

### 1.1. Project Background

Trong quá trình thực hiện đồ án môn học và đồ án tốt nghiệp, các nhóm sinh viên thường phải quản lý nhiều công việc khác nhau như phân chia nhiệm vụ, theo dõi tiến độ, quản lý thời hạn, trao đổi tài liệu và báo cáo kết quả thực hiện.

Việc sử dụng nhiều công cụ riêng lẻ để quản lý các hoạt động này có thể khiến thông tin bị phân tán, khó theo dõi tiến độ tổng thể và thiếu tính minh bạch trong việc đánh giá mức độ hoàn thành công việc của từng thành viên.

Bên cạnh đó, giảng viên hướng dẫn cần có khả năng theo dõi tình hình thực hiện đồ án, biết được từng thành viên đang phụ trách công việc gì, tiến độ hiện tại ra sao và những nhiệm vụ nào đang gặp vấn đề hoặc có nguy cơ trễ hạn.

Xuất phát từ những vấn đề trên, Akatsuki Yui được đề xuất như một hệ thống quản lý tập trung, hỗ trợ nhóm sinh viên tổ chức và theo dõi toàn bộ quá trình thực hiện đồ án.

### 1.2. Project Description

Akatsuki Yui là một ứng dụng Web hỗ trợ quản lý nhóm và quy trình thực hiện đồ án môn học, đồ án tốt nghiệp.

Hệ thống cung cấp các chức năng quản lý Project, thành viên, Task, Sprint, tài liệu, thông báo và báo cáo tiến độ. Người dùng có thể theo dõi công việc thông qua giao diện Kanban kết hợp với mô hình quản lý Sprint, giúp việc lập kế hoạch và kiểm soát tiến độ trở nên trực quan hơn.

Akatsuki Yui hướng đến mô hình sử dụng nội bộ cho một nhóm sinh viên duy nhất. Hệ thống có cơ chế quản lý tài khoản, phê duyệt đăng ký và phân quyền linh hoạt nhằm đảm bảo mỗi người dùng chỉ được thực hiện những chức năng phù hợp với trách nhiệm của mình.

Ngoài việc hỗ trợ các thành viên phối hợp thực hiện công việc, hệ thống còn cung cấp cho Leader và Instructor cái nhìn tổng quan về tình hình dự án thông qua Dashboard, biểu đồ tiến độ và các báo cáo thống kê dựa trên dữ liệu hoạt động thực tế.

### 1.3. Project Objectives

Các mục tiêu chính của Akatsuki Yui bao gồm:

1. **Centralized Project Management:** Xây dựng một nền tảng tập trung để quản lý thông tin và toàn bộ hoạt động liên quan đến đồ án.
2. **Task Management:** Hỗ trợ tạo, phân công, theo dõi và kiểm duyệt Task, bao gồm nhiều người phụ trách, Deadline, Priority, Estimate và Task Dependency.
3. **Sprint Planning:** Hỗ trợ lập kế hoạch công việc theo Sprint, quản lý Backlog và theo dõi tiến độ thực hiện.
4. **Visual Progress Tracking:** Kết hợp Kanban Board và Sprint Overview để giúp các thành viên dễ dàng theo dõi trạng thái công việc.
5. **Role-based Authorization:** Xây dựng hệ thống phân quyền linh hoạt dựa trên Role và Permission Matrix.
6. **Instructor Monitoring:** Cung cấp công cụ để giảng viên hướng dẫn theo dõi tiến độ, công việc và hoạt động của nhóm.
7. **Document Management:** Quản lý tập trung các tài liệu đồ án thông qua đường dẫn Google Drive.
8. **Automated Notifications:** Tự động gửi thông báo qua Email và giao diện Web khi xảy ra những sự kiện quan trọng.
9. **Objective Progress Reporting:** Cung cấp số liệu và biểu đồ trực quan về tiến độ Project, Sprint và tình hình thực hiện công việc của từng thành viên.
10. **Practical Learning and Portfolio:** Xây dựng một sản phẩm có thể sử dụng trong thực tế, đồng thời giúp nâng cao kiến thức và kỹ năng phát triển phần mềm.

---

## 2. Product Vision

### 2.1. Vision Statement

Akatsuki Yui hướng đến việc trở thành một nền tảng quản lý đồ án tập trung, giúp sinh viên tổ chức công việc hiệu quả, Leader điều phối nhóm minh bạch và Instructor dễ dàng theo dõi tiến độ thực hiện.

Hệ thống tập trung giải quyết các vấn đề trong quá trình thực hiện đồ án thông qua việc kết hợp quản lý Project, Task, Sprint, tài liệu và báo cáo trên cùng một nền tảng.

### 2.2. Target Users

Akatsuki Yui hướng đến bốn nhóm người dùng chính:

| User Role | Description |
| --- | --- |
| Admin | Người quản trị hệ thống, chịu trách nhiệm quản lý tài khoản, phê duyệt đăng ký, quản lý phân quyền và giám sát toàn bộ hoạt động. |
| Instructor | Giảng viên hướng dẫn, có quyền theo dõi tình hình thực hiện Project, tiến độ công việc, Deadline và hoạt động của các thành viên. |
| Leader | Nhóm trưởng, chịu trách nhiệm lập kế hoạch, tạo Project, quản lý thành viên, phân công Task, quản lý Sprint và kiểm duyệt kết quả công việc. |
| Member | Thành viên tham gia Project, chịu trách nhiệm thực hiện Task được giao, cập nhật trạng thái và gửi công việc để Leader Review. |

### 2.3. Target Environment

- **Application Type:** Web Application.
- **Primary Users:** Nhóm sinh viên thực hiện đồ án và giảng viên hướng dẫn.
- **Primary Device:** Desktop / Laptop.
- **Secondary Device:** Tablet và Mobile thông qua giao diện Responsive.
- **Deployment Environment:** Cloud Hosting.
- **Access Method:** Web Browser.
- **Language:** Tiếng Việt là ngôn ngữ giao diện ưu tiên; cấu trúc hệ thống có thể hỗ trợ mở rộng đa ngôn ngữ trong tương lai.

---

## 3. Product Scope

### 3.1. In Scope

Phiên bản MVP của Akatsuki Yui tập trung vào các nhóm chức năng sau:

1. **Authentication & Account Management**
   - Đăng ký tài khoản bằng Email và Password.
   - Đăng nhập và đăng xuất.
   - Quản lý phiên đăng nhập.
   - Phê duyệt hoặc từ chối yêu cầu đăng ký.
   - Quản lý trạng thái tài khoản.
   - Admin có thể cấp và thay đổi Role cho người dùng.

2. **Authorization Management**
   - Quản lý bốn Role mặc định: Admin, Instructor, Leader và Member.
   - Quản lý Permission theo mô hình RBAC.
   - Cung cấp giao diện Permission Matrix.
   - Cho phép Admin cấp hoặc thu hồi quyền.
   - Kiểm tra quyền truy cập ở phía Server.

3. **Project Management**
   - Tạo và quản lý Project.
   - Cập nhật thông tin Project.
   - Quản lý Project Leader, Instructor và thành viên.
   - Quản lý mục tiêu, phạm vi và công nghệ sử dụng.
   - Lưu Repository URL.
   - Quản lý thời gian bắt đầu và kết thúc.
   - Quản lý trạng thái Project.
   - Lưu trữ Project đã hoàn thành.
   - Hỗ trợ tạo Project từ Template; sử dụng Template là tùy chọn.

4. **Member Management**
   - Quản lý danh sách thành viên.
   - Thêm hoặc loại bỏ thành viên khỏi Project.
   - Phân công Project Leader bắt buộc và Instructor tùy chọn.
   - Theo dõi tình hình thực hiện công việc của từng thành viên.

5. **Task Management**
   - Tạo, chỉnh sửa và quản lý Task.
   - Phân công một hoặc nhiều người phụ trách.
   - Thiết lập Start Date tùy chọn và Deadline bắt buộc.
   - Quản lý Priority (LOW, MEDIUM, HIGH, CRITICAL) và Time-based Estimate tính theo giờ.
   - Quản lý Task Dependency; Task tiền nhiệm phải hoàn thành trước khi Task phụ thuộc được chuyển sang DONE.
   - Cập nhật trạng thái Task.
   - Gửi Task để Review.
   - Leader xác nhận hoàn thành hoặc yêu cầu chỉnh sửa.
   - Lưu lịch sử thay đổi trạng thái và lý do Review.
   - Hỗ trợ gắn đường dẫn tài liệu liên quan.

6. **Sprint Management**
   - Tạo và quản lý Sprint.
   - Thiết lập Sprint Goal.
   - Thiết lập ngày bắt đầu và kết thúc.
   - Quản lý Product Backlog ở phạm vi Project.
   - Đưa Task vào Sprint thông qua Sprint Planning.
   - Theo dõi tiến độ Sprint.
   - Quản lý trạng thái Sprint.
   - Hỗ trợ xem danh sách Task theo từng Sprint.

7. **Kanban Board**
   - Hiển thị Task theo trạng thái.
   - Hỗ trợ giao diện Kanban trực quan.
   - Cập nhật trạng thái Task thông qua thao tác phù hợp.
   - Lọc Task theo Sprint, Assignee, Priority và Deadline.
   - Hỗ trợ theo dõi công việc ở phạm vi toàn Project hoặc từng Sprint.

8. **Document Library**
   - Quản lý tài liệu theo Project.
   - Phân loại tài liệu theo Category.
   - Lưu Google Drive URL.
   - Tìm kiếm và lọc tài liệu.
   - Hỗ trợ mở nhanh tài liệu trong trình duyệt.
   - Các Category mặc định:
     - Project Documents.
     - Design.
     - Development.
     - Meeting & Reports.
     - Other.

9. **Notification Management**
   - Thông báo khi người dùng được giao Task.
   - Thông báo cho Leader khi Member chuyển Task sang Review.
   - Thông báo cho Assignee khi Leader xử lý Review.
   - Thông báo về những sự kiện quan trọng liên quan đến Project.
   - Hiển thị thông báo trong Web Application.
   - Gửi Email Notification.
   - Quản lý trạng thái đã đọc và chưa đọc.

10. **Dashboard & Reporting**
    - Dashboard tổng quan Project.
    - Thống kê tổng số Task.
    - Thống kê Task hoàn thành, đang thực hiện, chờ Review và quá hạn.
    - Theo dõi tiến độ từng thành viên.
    - Hiển thị hoạt động gần đây.
    - Theo dõi Sprint Progress.
    - Hỗ trợ Burndown Chart.
    - Cung cấp Contribution Report dựa trên dữ liệu hoạt động thực tế.

11. **Activity & Audit Log**
    - Ghi nhận các hoạt động quan trọng trong hệ thống.
    - Theo dõi lịch sử thay đổi Task.
    - Theo dõi lịch sử phân công công việc.
    - Ghi nhận thay đổi Permission và Role.
    - Hỗ trợ truy vết các thao tác quản trị quan trọng.

### 3.2. Out of Scope

Các chức năng sau không thuộc phạm vi MVP:

- Hỗ trợ nhiều tổ chức hoặc nhiều Workspace độc lập.
- Cho phép người dùng bên ngoài tự tạo và quản lý tổ chức.
- Tích hợp GitHub API hoặc tự động đồng bộ Issue, Pull Request và Commit.
- Chat trực tuyến hoặc hệ thống nhắn tin nội bộ.
- Upload và lưu trữ file trực tiếp trên hệ thống.
- Ứng dụng Mobile Native dành cho Android hoặc iOS.
- Tích hợp AI để tự động phân công hoặc đánh giá thành viên.
- Hệ thống chấm công, tính lương hoặc quản lý nhân sự.
- Tích hợp các công cụ họp trực tuyến.
- Hệ thống thanh toán hoặc quản lý tài chính.
- Kiến trúc Microservices và hệ thống triển khai phân tán.

---

## 4. System Overview

### 4.1. Organizational Model

Akatsuki Yui được thiết kế theo mô hình một nhóm nội bộ duy nhất (Single Workspace).

Workspace đóng vai trò là không gian quản lý tập trung, chứa các tài khoản thành viên và các Project được thực hiện theo thời gian.

Các quy tắc tổ chức:
- Một Workspace có thể quản lý nhiều Project.
- Tại một thời điểm chỉ có một Project ở trạng thái Active.
- Project đã hoàn thành được chuyển sang Archived.
- Project Archived vẫn có thể được xem và tra cứu dữ liệu lịch sử. Admin có quyền khôi phục Project Archived.
- Người dùng có thể tham gia các Project theo phạm vi và quyền được Admin hoặc Leader cấp.
- Hệ thống không hỗ trợ tạo Workspace mới từ phía người dùng.

### 4.2. Project Lifecycle

Một Project trải qua các giai đoạn chính:
1. **Created:** Project được khởi tạo và cấu hình thông tin ban đầu.
2. **Active:** Project đang trong quá trình thực hiện.
3. **Archived:** Project đã kết thúc và được lưu trữ.

Hệ thống chỉ cho phép một Project Active tại cùng một thời điểm nhằm đảm bảo nhóm tập trung vào một mục tiêu chính.

### 4.3. Task Workflow

Task được quản lý theo quy trình trạng thái:
1. **TODO:** Task đã được tạo và chờ thực hiện.
2. **IN PROGRESS:** Task đang được Assignee thực hiện.
3. **REVIEW:** Task đã được gửi đến Leader để kiểm tra.
4. **DONE:** Task đã được Leader xác nhận hoàn thành.

Nếu Task không đạt yêu cầu Review, Leader có thể chuyển Task về **IN PROGRESS** và phải ghi rõ lý do.

Khi xác nhận **DONE**, Leader cũng phải nhập lý do xác nhận. Các lý do này được lưu trong lịch sử Task.

### 4.4. Sprint and Kanban Workflow

Hệ thống sử dụng mô hình Sprint chính thức kết hợp với Kanban Board.

Mỗi Project có thể chứa nhiều Sprint. Mỗi Sprint được xác định bởi tên, mục tiêu, ngày bắt đầu, ngày kết thúc và danh sách Task.

Task chưa được đưa vào Sprint sẽ nằm trong Backlog.

Trong quá trình thực hiện:
- Leader tạo Sprint và xác định mục tiêu.
- Leader lựa chọn Task từ Backlog để đưa vào Sprint.
- Member thực hiện Task được phân công.
- Task được cập nhật trạng thái trên Kanban Board.
- Leader theo dõi tiến độ và kiểm duyệt Task.
- Hệ thống tổng hợp dữ liệu để hiển thị Sprint Progress và các báo cáo liên quan.

Một Task chỉ thuộc tối đa một Sprint tại cùng một thời điểm.

### 4.5. Notification Workflow

Hệ thống sử dụng hai kênh thông báo:
- Notification Center trên giao diện Web.
- Email Notification.

Các thông báo được kích hoạt bởi những sự kiện nghiệp vụ như phân công Task, gửi Review và kết quả Review.

Hệ thống không cung cấp chức năng chat hoặc trao đổi tin nhắn trực tuyến.

---

## 5. Business Value

Akatsuki Yui hướng đến việc tạo ra giá trị cho từng nhóm người dùng.

| User Role | Expected Value |
| --- | --- |
| Admin | Quản lý tập trung tài khoản, phân quyền và hoạt động của hệ thống. |
| Instructor | Dễ dàng theo dõi tiến độ đồ án, tình hình thực hiện và các vấn đề cần quan tâm. |
| Leader | Quản lý công việc, phân công thành viên, lập kế hoạch Sprint và kiểm soát Deadline. |
| Member | Biết rõ nhiệm vụ được giao, thời hạn hoàn thành và trạng thái công việc. |

Các giá trị tổng thể:
- Giảm tình trạng phân tán thông tin giữa nhiều công cụ.
- Tăng tính minh bạch trong quá trình thực hiện đồ án.
- Hỗ trợ kiểm soát tiến độ và Deadline.
- Giúp Leader điều phối công việc hiệu quả hơn.
- Giúp Instructor theo dõi tình hình thực hiện mà không cần liên tục yêu cầu báo cáo thủ công.
- Lưu trữ lịch sử làm việc để phục vụ tổng kết và báo cáo.
- Tạo ra dữ liệu khách quan để theo dõi mức độ hoàn thành công việc.

---

## 6. Technology Overview

Akatsuki Yui dự kiến sử dụng kiến trúc Modular Monolith với Next.js Fullstack.

| Layer / Component | Technology |
| --- | --- |
| Frontend Framework | Next.js |
| UI Library | React |
| Programming Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Backend | Next.js Route Handlers |
| Architecture | Modular Monolith |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation | Zod |
| Form Management | React Hook Form |
| Authentication | Auth.js hoặc giải pháp Session-based Authentication phù hợp |
| Chart Library | Recharts |
| Deployment | Vercel |
| Database Hosting | Neon hoặc Supabase |
| Version Control | Git & GitHub |

Các nguyên tắc kỹ thuật:
- Frontend và Backend được phát triển trong cùng một Next.js Application.
- Business Logic được tổ chức theo từng module.
- Database chỉ được truy cập từ Server.
- Prisma được sử dụng làm ORM.
- Các chức năng được bảo vệ phải thực hiện kiểm tra quyền phía Server.
- Ưu tiên sử dụng các dịch vụ có Free Tier để giảm chi phí triển khai.

---

## 7. Project Constraints and Assumptions

### 7.1. Constraints

- Hệ thống chỉ phục vụ một nhóm nội bộ.
- Chỉ có một Project Active tại một thời điểm.
- Ngân sách triển khai ưu tiên hoàn toàn miễn phí.
- Hệ thống được tối ưu cho Desktop và Laptop.
- Các tài liệu bên ngoài chỉ được quản lý bằng URL Google Drive.
- Không triển khai chức năng chat nội bộ.
- Không tích hợp GitHub trong MVP.
- Hệ thống phụ thuộc vào kết nối Internet để sử dụng các dịch vụ Cloud và gửi Email.

### 7.2. Assumptions

- Người dùng có địa chỉ Email hợp lệ để đăng ký và nhận thông báo.
- Admin là người chịu trách nhiệm phê duyệt tài khoản và cấp quyền ban đầu.
- Các thành viên có kiến thức cơ bản về cách sử dụng trình duyệt Web.
- Leader chịu trách nhiệm tổ chức Sprint và quản lý Task.
- Instructor được cấp quyền theo dõi Project.
- Nhóm sử dụng Google Drive làm nơi lưu trữ tài liệu bên ngoài.
- Các báo cáo được tính toán dựa trên dữ liệu hoạt động được ghi nhận trong hệ thống.
- Các dịch vụ triển khai bên ngoài có thể thay đổi giới hạn sử dụng theo chính sách của nhà cung cấp.

---

## 8. Project Success Criteria

MVP được xem là đạt mục tiêu khi đáp ứng các tiêu chí sau:

1. Người dùng có thể đăng ký tài khoản và được Admin phê duyệt trước khi truy cập hệ thống.
2. Admin có thể quản lý Role và Permission thông qua Permission Matrix.
3. Admin và Leader có thể tạo và quản lý Project theo đúng quy tắc nghiệp vụ.
4. Hệ thống đảm bảo chỉ có một Project Active tại một thời điểm.
5. Leader có thể tạo Task, phân công nhiều Assignee và quản lý Deadline.
6. Hệ thống hỗ trợ Task Dependency và Estimate.
7. Member có thể cập nhật Task và gửi Review.
8. Leader có thể xác nhận hoặc từ chối Review với lý do bắt buộc.
9. Leader có thể tạo Sprint và quản lý Task thông qua Backlog và Kanban Board.
10. Thành viên có thể theo dõi công việc và Deadline của mình.
11. Hệ thống có thể quản lý tài liệu bằng Google Drive URL.
12. Các sự kiện nghiệp vụ quan trọng phải hỗ trợ thông báo qua Web và Email; Email Notification là phạm vi bắt buộc của MVP.
13. Dashboard hiển thị được tình hình thực hiện Project và Sprint.
14. Hệ thống cung cấp báo cáo khách quan dựa trên lịch sử hoạt động.
15. Các chức năng quan trọng được kiểm thử và hoạt động ổn định trong môi trường triển khai.
16. Ứng dụng có thể được triển khai và sử dụng thực tế với chi phí nằm trong ngân sách dự kiến.

---

## 9. Future Development Considerations

Sau khi MVP hoàn thành và được sử dụng thực tế, Akatsuki Yui có thể được mở rộng theo nhu cầu:

- Tích hợp GitHub để theo dõi Issue, Pull Request và Commit.
- Bổ sung các báo cáo Sprint và Contribution nâng cao.
- Hỗ trợ xuất báo cáo Project dưới dạng PDF hoặc Excel.
- Bổ sung tích hợp Google Calendar.
- Cải thiện hệ thống thông báo và nhắc nhở Deadline.
- Hỗ trợ PWA để cải thiện trải nghiệm trên thiết bị di động.
- Bổ sung các công cụ hỗ trợ lập kế hoạch và quản lý Project.

Các chức năng mở rộng chỉ được xem xét khi có nhu cầu thực tế và không ảnh hưởng đến tính ổn định của hệ thống MVP.

---

*End of Project Overview – Akatsuki Yui*


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
