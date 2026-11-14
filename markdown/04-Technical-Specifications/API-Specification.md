# API Specification

**Project:** Akatsuki Yui  
**Version:** 1.0  
**Status:** Draft for implementation  
**Updated:** 2026-11-14

## 1. Purpose and Conventions

Tài liệu định nghĩa ranh giới giao tiếp phía Server cho Next.js Fullstack Modular Monolith. Không phải mọi thao tác nội bộ đều cần HTTP API: Server Components và Application Services nên gọi trực tiếp Service Layer. Route Handlers được dùng cho REST endpoint, tích hợp ngoài hoặc nhu cầu client cần HTTP; Server Actions dùng cho form/mutation nội bộ phù hợp.

- Base path REST: `/api/v1`.
- Content-Type: `application/json`, trừ upload (không có trong MVP).
- Authentication: Session Cookie do Server quản lý.
- Authorization: kiểm tra phía Server theo `Authorization-Design.md`.
- Validation: schema validation ở Server (khuyến nghị Zod).
- Date: ISO 8601; ngày nghiệp vụ dùng `YYYY-MM-DD`.
- ID: UUID.
- Không trả Password Hash, Session Token, Secret hoặc stack trace.

## 2. Response Convention

### Success

```json
{
  "data": {},
  "meta": {}
}
```

`meta` có thể bỏ qua nếu không cần pagination hoặc metadata.

### Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ.",
    "details": []
  }
}
```

HTTP status sử dụng nhất quán: `400` invalid request, `401` unauthenticated, `403` forbidden, `404` not found, `409` business conflict, `422` validation/business-rule failure nếu cần phân biệt, `429` rate limited, `500` unexpected server error.

## 3. Authentication and Account Endpoints

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/auth/register` | Đăng ký tài khoản Pending | Public |
| POST | `/auth/login` | Đăng nhập | Public |
| POST | `/auth/logout` | Đăng xuất | Authenticated |
| GET | `/auth/session` | Lấy thông tin Session hiện tại | Authenticated |
| GET | `/users` | Tìm kiếm/danh sách tài khoản | Admin |
| GET | `/users/:userId` | Xem tài khoản | Admin / permitted |
| PATCH | `/users/:userId/status` | Approve/Reject/Suspend/Activate theo policy | Admin |
| PATCH | `/users/:userId/role` | Gán Role | Admin |

Registration tạo trạng thái `PENDING`; không tự động cấp quyền truy cập nội bộ.

## 4. Project Endpoints

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/projects` | Danh sách Project theo quyền | Authenticated |
| POST | `/projects` | Tạo Project | Admin, Leader |
| GET | `/projects/:projectId` | Chi tiết Project | Project-scoped |
| PATCH | `/projects/:projectId` | Cập nhật Project | Admin/Leader permitted |
| POST | `/projects/:projectId/activate` | Activate Project | Admin/Leader permitted |
| POST | `/projects/:projectId/archive` | Archive Project | Admin/Leader permitted |
| POST | `/projects/:projectId/restore` | Restore Project | Admin only |
| GET | `/projects/:projectId/members` | Danh sách thành viên | Project-scoped |
| POST | `/projects/:projectId/members` | Thêm thành viên | Admin/Leader permitted |
| DELETE | `/projects/:projectId/members/:userId` | Gỡ thành viên sau khi reassign Task | Admin/Leader permitted |

Project create payload cho phép `templateId` và `instructorId` bỏ trống/null. Nếu Leader tạo Project, Server mặc định creator làm Project Leader theo Business Rules.

Restore phải kiểm tra quyền Admin, trạng thái ARCHIVED và ràng buộc tối đa một Project ACTIVE. Payload mẫu cho `POST /projects/:projectId/restore`: `{ "targetStatus": "CREATED" | "ACTIVE" }`.

## 5. Task Endpoints

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/projects/:projectId/tasks` | Danh sách Task và filter | Project-scoped |
| POST | `/projects/:projectId/tasks` | Tạo Task | Admin/Leader |
| GET | `/tasks/:taskId` | Chi tiết Task | Project-scoped |
| PATCH | `/tasks/:taskId` | Cập nhật trường được phép | Admin/Leader/assigned Member by policy |
| PUT | `/tasks/:taskId/assignees` | Thay đổi Assignees | Admin/Leader |
| POST | `/tasks/:taskId/submit-review` | Gửi Review | Assignee |
| POST | `/tasks/:taskId/approve` | Approve Review | Admin/Leader permitted |
| POST | `/tasks/:taskId/reject` | Reject Review | Admin/Leader permitted |
| GET | `/tasks/:taskId/history` | Lịch sử Task | Project-scoped |
| PUT | `/tasks/:taskId/dependencies` | Thiết lập Dependencies | Admin/Leader |

Task Priority chỉ chấp nhận `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. Estimate là số giờ và tùy chọn. Deadline bắt buộc; Start Date tùy chọn. `POST /projects/:projectId/tasks` nhận `assigneeIds?: string[]` (tùy chọn; có thể để trống hoặc bỏ qua để phân công sau). Với `PATCH /tasks/:taskId`, Member được giao chỉ được cập nhật `status` (`TODO -> IN_PROGRESS -> REVIEW`), `referenceLinks` và ghi chú tiến độ (`progressNote`).

Khi chuyển Task sang DONE, Server phải kiểm tra tất cả predecessor đều DONE. Không được chỉ dựa vào trạng thái nút trên UI.

Approve/Reject payload phải có `reason` không rỗng. Mọi quyết định lưu Review History và Task Status History.

## 6. Sprint Endpoints

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/projects/:projectId/sprints` | Danh sách Sprint | Project-scoped |
| POST | `/projects/:projectId/sprints` | Tạo Sprint | Admin/Leader |
| GET | `/sprints/:sprintId` | Chi tiết Sprint | Project-scoped |
| PATCH | `/sprints/:sprintId` | Cập nhật Sprint | Admin/Leader |
| POST | `/sprints/:sprintId/activate` | Activate Sprint | Admin/Leader |
| POST | `/sprints/:sprintId/complete` | Complete Sprint | Admin/Leader |
| POST | `/sprints/:sprintId/cancel` | Cancel Sprint | Admin/Leader |
| PUT | `/sprints/:sprintId/tasks` | Plan/assign Tasks | Admin/Leader |
| POST | `/sprints/:sprintId/tasks/:taskId/move` | Chuyển Task giữa Sprint/Backlog | Admin/Leader |

Một Project được phép có nhiều Sprint ACTIVE. Khi kết thúc Sprint, Leader quyết định cách xử lý từng Task chưa DONE; mỗi thay đổi assignment phải được lưu lịch sử. Payload mẫu cho `POST /sprints/:sprintId/complete`: `{ "taskDispositions": [{ "taskId": "uuid", "action": "KEEP_IN_SPRINT" | "MOVE_TO_BACKLOG" | "MOVE_TO_SPRINT", "targetSprintId"?: "uuid" }] }`.

## 7. Documents, Notifications and Reporting

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/projects/:projectId/documents` | Danh sách Document Record | Project-scoped |
| POST | `/projects/:projectId/documents` | Tạo Document Record | Admin/Leader |
| PATCH | `/documents/:documentId` | Sửa Document Record | Admin/Leader |
| DELETE | `/documents/:documentId` | Xóa Document Record | Admin/Leader |
| GET | `/notifications` | Notification của chính User | Authenticated |
| PATCH | `/notifications/:notificationId/read` | Đánh dấu đã đọc | Owner only |
| PATCH | `/notifications/:notificationId/unread` | Đánh dấu chưa đọc | Owner only |
| GET | `/dashboard` | Dashboard theo quyền | Authenticated |
| GET | `/reports/project/:projectId` | Project Report | Project-scoped |
| GET | `/activity` | Activity Log theo quyền | Authenticated |

Document chỉ lưu Google Drive URL; không có endpoint upload file trong MVP.

Email Delivery không cho Client tự gửi arbitrary email. Email được tạo từ Domain/Application Event và xử lý bởi Email Service.

## 8. Email Delivery Internal Contract

Các sự kiện đủ điều kiện gửi Email được định nghĩa trong Business Rules. Application Layer tạo Notification và Delivery record ở trạng thái `PENDING`. Email worker/dispatcher gửi qua Provider, sau đó cập nhật `SENT` hoặc `FAILED`, `sentAt`, `errorMessage` và số lần thử nếu được triển khai.

- Email Notification bắt buộc trong MVP; sử dụng **Resend (Free Tier API)** (`DEC-016`).
- Không rollback nghiệp vụ đã commit chỉ vì Provider lỗi.
- Retry phải idempotent, tối đa **3 lần** (`retryCount <= 3`) cho mỗi `NotificationDelivery` lỗi và tránh gửi trùng.

## 9. Validation and Business Conflict Codes

| Code | Meaning |
|---|---|
| AUTH_REQUIRED | Chưa đăng nhập |
| ACCOUNT_NOT_ACTIVE | Tài khoản không Active |
| FORBIDDEN | Không đủ quyền |
| PROJECT_ALREADY_ACTIVE | Đã tồn tại Project ACTIVE |
| PROJECT_NOT_ARCHIVED | Project không ở trạng thái ARCHIVED |
| TASK_DEPENDENCY_NOT_COMPLETED | Có predecessor chưa DONE |
| TASK_ASSIGNEE_REASSIGN_REQUIRED | Cần reassign Task trước khi Remove Member |
| INVALID_TASK_PRIORITY | Priority không hợp lệ |
| INVALID_ESTIMATE | Estimate phải là số giờ hợp lệ |
| INVALID_STATUS_TRANSITION | Chuyển trạng thái không hợp lệ |
| REVIEW_REASON_REQUIRED | Thiếu lý do Approve/Reject |
| SPRINT_TASK_ALREADY_ASSIGNED | Task đã thuộc Sprint khác |

## 10. Pagination, Filtering and Sorting

Danh sách lớn nên hỗ trợ `page`, `pageSize`, `sortBy`, `sortOrder` và filter phù hợp. Server phải giới hạn `pageSize` tối đa. Filter cần kiểm tra whitelist field, không nối trực tiếp chuỗi input vào truy vấn.

## 11. Idempotency and Transactions

Các thao tác cần transaction: Activate/Restore Project, Remove Member sau khi kiểm tra Task, cập nhật Assignees, Submit/Approve/Reject Review, cập nhật Dependency và Sprint Planning. Các endpoint có thể bị gửi lặp (ví dụ callback hoặc retry gửi Email nếu sau này tích hợp) cần idempotency key hoặc cơ chế deduplication phù hợp.

## 12. Open Technical Decisions

- Cấu hình domain/sender trên Resend (`DEC-016` đã chốt Email Provider là Resend với tối đa 3 lần retry).
- REST Route Handler hay Server Action cho từng thao tác UI; chọn theo nhu cầu, không bắt buộc mọi use case có REST endpoint.
- Chuẩn pagination thống nhất toàn ứng dụng.
- Rate limit cho Register/Login.
- Có cần API versioning beyond `/api/v1` trong MVP hay không.
