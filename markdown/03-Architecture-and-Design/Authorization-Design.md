# Authorization Design

**Project:** Akatsuki Yui  
**Version:** 1.0  
**Status:** Draft for implementation  
**Updated:** 2026-11-14

## 1. Purpose

Tài liệu mô tả mô hình Authentication/Authorization, Permission Matrix, phạm vi tài nguyên và các quy tắc kiểm tra quyền ở Server. Đây là thiết kế cho MVP nội bộ, không phải hệ thống IAM Enterprise.

## 2. Authorization Model

Sử dụng Role-Based Access Control (RBAC) kết hợp kiểm tra phạm vi tài nguyên (resource scope):

- **System scope:** quyền quản trị toàn Workspace, chủ yếu dành cho Admin.
- **Project scope:** quyền thao tác trong Project mà User là thành viên hoặc được gán vai trò phù hợp.
- **Ownership/Assignment check:** một số thao tác Member chỉ được thực hiện trên Task mà User được phân công.

Không tin tưởng Role, Permission, Project ID hoặc User ID do Client tự gửi. Server phải lấy User ID từ Session đã xác thực và truy vấn quyền từ dữ liệu đáng tin cậy.

## 3. Roles

| Role | Scope | Responsibility |
|---|---|---|
| ADMIN | System | Quản lý tài khoản, Role/Permission, Project lifecycle và cấu hình hệ thống |
| INSTRUCTOR | Project/read scope | Theo dõi Project, Task, Sprint, Dashboard và Reports; mặc định Read-only |
| LEADER | Project scope | Quản lý Project, thành viên, Task, Sprint, Review và Documents theo quyền |
| MEMBER | Project/assigned-task scope | Xem Project được tham gia, thao tác Task được giao và gửi Review |

Role hệ thống của User là một trong bốn Role trên. Project membership không tự động nâng Member thành Leader. Project Leader phải được xác định rõ trong Project.

## 4. Permission Catalog

| Permission | Description | Default Role |
|---|---|---|
| account.read | Xem tài khoản | ADMIN |
| account.approve | Duyệt/từ chối đăng ký | ADMIN |
| account.manage | Quản lý trạng thái tài khoản | ADMIN |
| role.manage | Quản lý Role/Permission | ADMIN |
| project.create | Tạo Project | ADMIN, LEADER |
| project.read | Xem Project được phép | ADMIN, INSTRUCTOR, LEADER, MEMBER |
| project.update | Cập nhật Project | ADMIN, LEADER (Project của Leader) |
| project.activate | Kích hoạt Project | ADMIN, LEADER theo quyền quản lý |
| project.archive | Archive Project | ADMIN, LEADER theo quyền quản lý |
| project.restore | Restore Project | ADMIN only |
| project.member.manage | Thêm/gỡ thành viên | ADMIN, LEADER theo quyền quản lý |
| task.create | Tạo Task | ADMIN, LEADER |
| task.read | Xem Task trong Project được phép | ADMIN, INSTRUCTOR, LEADER, MEMBER |
| task.update | Cập nhật Task | ADMIN, LEADER; MEMBER theo giới hạn được giao |
| task.assign | Phân công Assignee | ADMIN, LEADER |
| task.submit_review | Gửi Task sang REVIEW | Assignee |
| task.review | Approve/Reject Review | ADMIN, LEADER được quản lý Project |
| task.history.read | Xem lịch sử Task | ADMIN, INSTRUCTOR, LEADER; MEMBER trong phạm vi được phép |
| sprint.manage | Tạo/cập nhật Sprint và Planning | ADMIN, LEADER |
| sprint.read | Xem Sprint | ADMIN, INSTRUCTOR, LEADER, MEMBER |
| document.manage | Thêm/sửa/xóa Document Record | ADMIN, LEADER |
| document.read | Xem Document Record | Thành viên Project được phép |
| notification.read | Xem Notification của chính mình | Authenticated User |
| report.read | Xem Dashboard/Reports theo phạm vi | ADMIN, INSTRUCTOR, LEADER; MEMBER theo phạm vi được cấp |
| activity.read | Xem Activity Log theo phạm vi | ADMIN, INSTRUCTOR, LEADER; MEMBER giới hạn |

Permission Catalog có thể được lưu trong Database. Tuy nhiên, MVP phải có Default Permission an toàn trong Seed. Không cho phép Client tự cấp Permission.

## 5. Default Permission Matrix

| Capability | Admin | Instructor | Leader | Member |
|---|---:|---:|---:|---:|
| Manage accounts and roles | Yes | No | No | No |
| Create Project | Yes | No | Yes | No |
| Read Project | Yes | Yes | Yes | Yes, joined Project |
| Update Project | Yes | No | Yes, managed Project | No |
| Activate/Archive Project | Yes | No | Yes, managed Project | No |
| Restore Archived Project | Yes | No | No | No |
| Manage Project Members | Yes | No | Yes, managed Project | No |
| Create/Assign Task | Yes | No | Yes | No |
| Update Task | Yes | No | Yes | Assigned Task, allowed fields only |
| Submit Task for Review | No special restriction | No | If also Assignee | Assigned Task |
| Approve/Reject Review | Yes, if authorized | No | Yes, managed Project | No |
| Manage Sprint | Yes | No | Yes | No |
| View Sprint | Yes | Yes | Yes | Joined Project |
| Manage Document Records | Yes | No | Yes | No (unless explicitly granted later) |
| View Documents | Yes | Yes | Yes | Joined Project |
| View own Notifications | Yes | Yes | Yes | Yes |
| View Reports | Yes | Yes | Yes | Limited/own scope |

Admin full access does not bypass data-integrity constraints such as Task Dependency, Project active uniqueness, or required reassignment before member removal unless an explicit audited administrative override is designed. MVP does not define such an override.

## 6. Resource Scope Rules

1. User phải có tài khoản `ACTIVE` mới được truy cập chức năng nội bộ.
2. `PENDING`, `REJECTED`, `SUSPENDED` không được truy cập dữ liệu nội bộ.
3. Leader chỉ quản lý Project mà họ được xác định là Leader hoặc được cấp quyền quản lý rõ ràng.
4. Member chỉ thao tác Task trong Project mà họ là thành viên và chỉ với Task được phân công, trừ quyền đọc chung đã được cấp.
5. Instructor chỉ đọc dữ liệu Project mà họ được gán làm Instructor hoặc được cấp quyền xem. Instructor là tùy chọn trên Project.
6. Admin có phạm vi Workspace.
7. Notification chỉ được đọc/cập nhật bởi đúng User nhận Notification.
8. Document Record phải được kiểm tra Project membership/permission trước khi đọc hoặc sửa. Quyền mở file gốc còn phụ thuộc chia sẻ của Google Drive.

## 7. Task Field-Level Rules

- Leader/Admin: tạo Task, chỉnh sửa thông tin Task, phân công, quản lý Dependency, quản lý Sprint Assignment.
- Member là Assignee: được cập nhật các trường tiến độ được cho phép và gửi Task sang REVIEW.
- Member không được tự Approve/Reject Review, thay đổi Assignee, thay đổi Project, xóa Dependency hoặc bỏ qua Workflow.
- Mọi thay đổi quan trọng phải ghi Task History/Activity Log.
- Chuyển sang `DONE` yêu cầu Review được Leader/Admin có quyền phê duyệt và tất cả predecessor đã `DONE`.

Các trường Member được phép sửa (chốt theo `DEC-015`): chỉ được cập nhật **Status** (`TODO -> IN_PROGRESS -> REVIEW`) và **Reference Links / ghi chú tiến độ** trên Task được giao. Các trường `Title`, `Description`, `Priority`, `Deadline`, `Estimate`, `Assignees`, `Dependencies` và `Sprint` bị khóa đối với Member.

## 8. Server-Side Enforcement

Mỗi Server Action, Route Handler và Application Service có side effect phải thực hiện theo thứ tự:

1. Đọc Session phía Server.
2. Xác nhận User tồn tại và trạng thái `ACTIVE`.
3. Nạp Role/Permission từ nguồn tin cậy.
4. Nạp tài nguyên và xác định Project scope.
5. Kiểm tra Permission và ownership/assignment.
6. Validate input bằng schema (ví dụ Zod).
7. Thực hiện nghiệp vụ trong Transaction khi cần.
8. Ghi Activity/Audit History.
9. Trả response không chứa dữ liệu nhạy cảm.

Ẩn nút trên UI chỉ là UX, không thay thế kiểm tra quyền ở Server. Server Components có thể gọi Application Service trực tiếp; Route Handler và Server Action đều phải dùng cùng Policy/Authorization Service.

## 9. Special Security Rules

- **Last Admin Protection:** không được hạ Role, Suspend hoặc xóa Admin cuối cùng nếu khiến Workspace không còn Admin hoạt động.
- **Project Restore:** chỉ Admin; nếu restore sang ACTIVE, phải kiểm tra Workspace chưa có Project ACTIVE khác trong transaction.
- **Member Removal:** Leader phải reassign tất cả Task đang được giao trước khi xóa Project Membership.
- **Task Dependency:** không thể chuyển Task sang DONE nếu predecessor chưa DONE, kể cả request trực tiếp đến API.
- **Archived Project:** thao tác nghiệp vụ chỉnh sửa bị khóa; Restore là quyền Admin.
- **Email/Notification:** User chỉ xem Notification của chính mình; không cho phép giả mạo recipientId.

## 10. Audit Requirements

Ghi Activity/Audit Log cho: duyệt tài khoản, thay đổi trạng thái tài khoản, thay đổi Role/Permission, Project Activate/Archive/Restore, thêm/gỡ thành viên, Assign/Reassign Task, Review Decision và các thay đổi cấu hình quan trọng. Log tối thiểu gồm Actor, Action, Entity Type/ID, Timestamp và metadata cần thiết; không ghi Password, Session Token hoặc Secret.

## 11. Authorization Test Requirements

- Kiểm tra cả UI và request trực tiếp đến Server.
- Thử truy cập chéo Project bằng cách thay ID.
- Thử Member sửa Task không được giao.
- Thử Instructor gọi mutation.
- Thử Leader quản lý Project không thuộc phạm vi.
- Thử non-Admin Restore Project.
- Thử xóa/hạ quyền Admin cuối cùng.
- Thử truy cập Notification của User khác.
- Thử chuyển Task sang DONE khi Dependency chưa hoàn thành.

## 12. Open Decisions

- Có cho phép một User mang nhiều Role hệ thống hay không? MVP hiện giả định mỗi User có một Role chính.
- Có cho phép Admin override quy tắc Reassign khi Remove Member hay không? MVP hiện không có override.
- Instructor có được Comment/Review Task hay vẫn Read-only? Hiện giữ Read-only theo Business Rules.
- *(Đã chốt theo `DEC-015`: Member chỉ được sửa Status và Reference Links / ghi chú tiến độ trên Task được giao.)*
