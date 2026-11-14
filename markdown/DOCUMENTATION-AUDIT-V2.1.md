# AKATSUKI YUI — DOCUMENTATION AUDIT V2.1

**Audit Date:** 2026-11-15  
**Scope:** Full Markdown Documentation Package (`d:/Akatsuki Yui/markdown/`)  
**Baseline:** `DECISION-LOG.md` (`DEC-001` through `DEC-011`, updated 2026-11-15)  
**Audit Mode:** Audit Only (no existing project documentation modified)

---

## 1. Executive Summary

Bộ tài liệu Markdown của dự án **Akatsuki Yui** gồm **15 tệp** (12 tài liệu chuyên môn thuộc 5 nhóm, 1 Decision Log, và 2 tài liệu điều hướng `README.md` / `DOCUMENT-INVENTORY.md`). Sau đợt cập nhật V2.1 ngày 2026-11-15, các lỗ hổng lớn từ các vòng trước đã được khắc phục đáng kể:

- **Tài liệu thiết kế cốt lõi đã đầy đủ:** `Authorization-Design.md` (RBAC + Resource Scope + 9 bước Server-Side Enforcement) và `API-Specification.md` (REST + Server Actions boundary, Error Schema, 12 Business Conflict Codes) đã hoàn thiện ở mức v1.0.
- **11 quyết định nghiệp vụ (`DEC-001` – `DEC-011`)** đã được đồng bộ rộng rãi vào Business Rules, SRS, Database Design, Architecture, API, UI/UX và Testing Strategy.
- **Hầu hết lỗi V2 đã được sửa:** `UC-017` đã có bước kiểm tra Predecessor `DONE`; `UC-035: Complete Sprint` đã được bổ sung; `Testing-Strategy.md` đã hết trùng lặp Test Case ID (0 trùng trên 167 Test Cases) và đã bổ sung các Test Case cho Profile (`TC-AUTH-013`), Burndown (`TC-DASH-008`), Document Update/Delete (`TC-DOC-010`, `TC-DOC-011`), Optional Assignees (`TC-TASK-027`, `TC-TASK-028`) và Complete Sprint (`TC-SPRINT-010`).

**Tổng số Findings:** **8 findings** (0 Critical, 2 High, 4 Medium, 2 Low).  
**Mức độ sẵn sàng triển khai:** **READY WITH BLOCKERS** — có thể bắt đầu Sprint 1 (khởi tạo repo, Prisma Schema, nền tảng hệ thống), nhưng cần chốt ngay **Auth Library + Password Policy + Email Verification** trước khi code module Authentication, và hoàn tất một số cập nhật nhỏ để loại bỏ hoàn toàn độ lệch tài liệu.

---

## 2. Audit Scope

### 2.1. Tài liệu đã kiểm tra (15 tệp trong `d:/Akatsuki Yui/markdown/`)

| Nhóm | Tài liệu | Trạng thái |
|---|---|---|
| Navigation & Decisions | `README.md` | Checked (updated 2026-11-15) |
| Navigation & Decisions | `DOCUMENT-INVENTORY.md` | Checked (updated 2026-11-15) |
| Navigation & Decisions | `DECISION-LOG.md` | Checked (updated 2026-11-15) |
| 01 – Project Foundation | `01-Project-Foundation/Project-Overview.md` | Checked |
| 01 – Project Foundation | `01-Project-Foundation/Project-Scope-and-Roadmap.md` | Checked |
| 02 – Requirements | `02-Requirements/Business-Rules-and-Workflows.md` | Checked (updated 2026-11-15) |
| 02 – Requirements | `02-Requirements/Software-Requirements-Specification.md` | Checked (updated 2026-11-15) |
| 02 – Requirements | `02-Requirements/Use-Case-Specification.md` | Checked (updated 2026-11-15) |
| 03 – Architecture and Design | `03-Architecture-and-Design/Authorization-Design.md` | Checked |
| 03 – Architecture and Design | `03-Architecture-and-Design/Database-Design.md` | Checked |
| 03 – Architecture and Design | `03-Architecture-and-Design/Software-Architecture-Document.md` | Checked |
| 03 – Architecture and Design | `03-Architecture-and-Design/UI-UX-Design.md` | Checked (updated 2026-11-15) |
| 04 – Technical Specifications | `04-Technical-Specifications/API-Specification.md` | Checked |
| 04 – Technical-Specifications | `04-Technical-Specifications/Development-Guidelines.md` | Checked |
| 05 – Quality and Delivery | `05-Quality-and-Delivery/Testing-Strategy.md` | Checked (updated 2026-11-15) |

### 2.2. Tài liệu không tìm thấy / Thay đổi cấu trúc
- `Deployment-and-Environment.md`: Không còn là tệp riêng trong gói Markdown hiện tại; nội dung Build & Deployment đã được gộp vào `04-Technical-Specifications/Development-Guidelines.md` (mục `11. Build and Deployment`).
- Các tệp `.docx` cũ trong `d:/Akatsuki Yui/docs/` (tạo ngày 2026-11-12) nằm ngoài phạm vi bộ Markdown nguồn theo chính sách tại `DOCUMENT-INVENTORY.md`.

### 2.3. Giới hạn của cuộc Audit
- Audit dựa trên phân tích tĩnh bộ tài liệu Markdown hiện hành; chưa có source code hoặc test thực thi để kiểm chứng runtime.
- Không tự ý chỉnh sửa tài liệu hay tự quyết định các Open Issues thay Project Owner.

---

## 3. Audit Scorecard

| Category | Rating | Ghi chú ngắn |
|---|---|---|
| 4.1. Document Completeness | **PASS WITH MINOR ISSUES** | Đủ 15 tệp; `DOCUMENT-INVENTORY.md` liệt kê thiếu `DECISION-LOG.md` trong danh sách mục. |
| 4.2. Cross-Document Consistency | **PASS WITH MINOR ISSUES** | Nhất quán cao trên `DEC-001`–`DEC-011`; còn vài điểm lệch cục bộ ở `Workflow 4.5`, `UC Index 2.1`, `UI-UX 6.3/6.7`. |
| 4.3. Business Rules | **PASS WITH MINOR ISSUES** | Đầy đủ `BR-*`; Workflow 4.5 và bảng `3.14` chưa cập nhật `DEC-011`. |
| 4.4. Use Case Specification | **PASS WITH MINOR ISSUES** | `UC-013`, `UC-015`, `UC-017`, `UC-034`, `UC-035` rõ ràng; mục `2.1` thiếu `UC-034`, `UC-035`. |
| 4.5. Database Design | **PASS** | Entity, FK, nullable, Enum, History và Transaction đầy đủ; cần lưu ý partial unique index cho Active Project khi code Prisma. |
| 4.6. Authorization Design | **PASS** | Đầy đủ RBAC, Resource Scope, 25 Permissions, Server-Side Enforcement; chỉ còn chờ chốt field-level cho Member. |
| 4.7. API Specification | **PASS WITH MINOR ISSUES** | Đủ endpoint và error codes; chưa chi tiết Request JSON Schema cho một số payload phức tạp (`/complete`, `POST /tasks`). |
| 4.8. UI/UX Design | **PASS WITH MINOR ISSUES** | Đã cập nhật Optional Assignees (`6.5.2`); màn hình `6.3` & `6.7.3` chưa mô tả chi tiết UI Restore Project & Complete Sprint. |
| 4.9. Testing Strategy | **PASS** | 167 Test Cases, 0 trùng lặp ID, bao phủ toàn bộ FR và 11 DEC. |
| 4.10. Technical Feasibility | **PASS** | Kiến trúc Next.js Modular Monolith + PostgreSQL + Prisma phù hợp hoàn toàn với MVP và quy mô nhóm sinh viên. |

---

## 4. Detailed Findings

### CRITICAL
*Không phát hiện finding mức CRITICAL.*

### HIGH

#### `F-01` — Use Case Index (`2.1`) thiếu `UC-034` và `UC-035` *(V2.1 REGRESSION)*
- **Severity:** HIGH
- **Category:** Document Completeness & V2.1 Regression
- **File:** `02-Requirements/Use-Case-Specification.md`
- **Section:** `# 2. USE CASE DIAGRAM OVERVIEW` → `## 2.1. Main Use Cases` (lines 62–96)
- **Evidence:** Bảng `2.1. Main Use Cases` chỉ liệt kê từ `UC-001` đến `UC-033`, trong khi phần thân tài liệu có `## UC-034: Restore Archived Project` (line 1625) và `## UC-035: Complete Sprint` (line 1658), và mục `13. USE CASE TESTING REFERENCE` (lines 1761–1762) đã liệt kê cả `UC-034` và `UC-035`.
- **Problem:** Danh mục Use Case chính (Index) không đồng bộ với nội dung đặc tả và bảng tham chiếu kiểm thử.
- **Impact:** Vi phạm mục #3 trong V2.1 Regression Checklist (`UC-034` phải có trong Use Case Index); dễ khiến lập trình viên hoặc QA bỏ sót `UC-034` / `UC-035` khi đọc tổng quan.
- **Recommended Action:** Bổ sung `UC-034 | Restore Archived Project | Admin | High` và `UC-035 | Complete Sprint | Leader | High` vào bảng `2.1. Main Use Cases`.

#### `F-02` — Các Open Decisions mang tính chặn triển khai (Blocking) chưa được chốt
- **Severity:** HIGH
- **Category:** Open Issues & Implementation Readiness
- **File:** `DECISION-LOG.md`, `02-Requirements/Business-Rules-and-Workflows.md`, `02-Requirements/Software-Requirements-Specification.md`, `03-Architecture-and-Design/Software-Architecture-Document.md`, `03-Architecture-and-Design/Authorization-Design.md`
- **Section:** `Remaining Decisions` (`DECISION-LOG.md` lines 19–32), `SAD §18`, `SRS §14`, `Authorization-Design §12`
- **Evidence:** Các quyết định chưa chốt gồm: Auth Library (`SAD-001`, `DB-011`), Password Policy (`TBD-001`), Email Verification (`TBD-002`, `OI-002`, `DB-010`), Member-editable Task fields (`OI-005`, `TBD-006`), Email Provider & Retry Limits (`SAD-003`, `SAD-004`, `OI-014`, `TBD-027`), và công thức Progress/Burndown (`OI-011`, `OI-012`, `TBD-021`, `TBD-028`).
- **Problem:** Nếu Coding Agent bắt đầu code các module liên quan khi chưa có quyết định, Agent sẽ buộc phải tự suy diễn nghiệp vụ hoặc cấu trúc bảo mật.
- **Impact:** Chặn triển khai trực tiếp Sprint 1 (Auth), Sprint 3 (Member Task Update), Sprint 5 (Email Service) và Sprint 6 (Dashboard/Burndown).
- **Recommended Action:** Project Owner xem xét và chốt theo lộ trình từng Sprint ở Phần 10.

---

### MEDIUM

#### `F-03` — `Task Creation Workflow` và bảng `3.14` trong Business Rules chưa đồng bộ `DEC-011`
- **Severity:** MEDIUM
- **Category:** Cross-Document Consistency & Business Rules
- **File:** `02-Requirements/Business-Rules-and-Workflows.md`
- **Section:** `## 4.5. Task Creation Workflow` (lines 721–755) và `## 3.14. Confirmed Business Decisions (2026-11-14)` (lines 1071–1088)
- **Evidence:**
  - Mục `3.5` (`BR-TASK-013`, lines 290, 294) đã ghi rõ: *"Assignees không bắt buộc khi tạo Task... Không gửi thông báo giao Task nếu chưa có Assignee."*
  - Tuy nhiên `4.5. Task Creation Workflow` vẫn ghi: `6. Chọn Assignee.`, `14. Hệ thống ghi nhận Assignee.`, `15. Hệ thống gửi Notification cho Assignee.` và sơ đồ Mermaid `B --> C[Select Assignees]`, `K --> L[Notify Assignees]` mà không có điều kiện `(nếu có)`.
  - Bảng `3.14. Confirmed Business Decisions` mới liệt kê 10 quyết định (`DEC-001`–`DEC-010`), chưa có dòng `DEC-011`.
- **Problem:** Mâu thuẫn nội tại giữa Section 3 (`BR-TASK-013`) và Section 4 (`4.5`) trong cùng một tài liệu nguồn chuẩn.
- **Impact:** Có thể gây hiểu nhầm khi đọc nhanh phần Workflow diagram.
- **Recommended Action:** Cập nhật bước 6, 14, 15 và sơ đồ Mermaid trong mục `4.5` thành tùy chọn `(nếu có)`, và bổ sung `Optional Assignees at Creation` vào bảng `3.14`.

#### `F-04` — UI/UX thiếu đặc tả thành phần giao diện tại màn hình chính cho `UC-034` và `UC-035`
- **Severity:** MEDIUM
- **Category:** UI/UX Completeness
- **File:** `03-Architecture-and-Design/UI-UX-Design.md`
- **Section:** `## 6.3.1. Project List` / `## 6.3.3. Project Detail` (lines 326–402) và `## 6.7.3. Sprint Detail` (lines 634–653)
- **Evidence:** Quy tắc UI cho Restore Project và Complete Sprint mới chỉ được ghi tóm tắt ở cuối tài liệu (`Decision Alignment` & `Confirmed UI Decisions`, lines 1383–1407), chưa được đưa vào danh sách UI Components / Behavior của các màn hình `6.3.1`/`6.3.3` (nút Restore + cảnh báo Project Active cho Admin) và `6.7.3` (nút Complete Sprint + modal chọn xử lý từng Task chưa `DONE`).
- **Problem:** Thiếu chi tiết UI Components ngay tại screen specification tương ứng.
- **Impact:** Dev Frontend phải tự đối chiếu phần phụ lục cuối file để thiết kế modal/button cho 2 luồng này.
- **Recommended Action:** Bổ sung UI Components và Behavior cho Restore Project vào `6.3.1`/`6.3.3` và Complete Sprint vào `6.7.3`.

#### `F-05` — API Specification chưa định nghĩa chi tiết Request Body Schema cho một số endpoint phức tạp
- **Severity:** MEDIUM
- **Category:** API Specification
- **File:** `04-Technical-Specifications/API-Specification.md`
- **Section:** `## 4. Project Endpoints`, `## 5. Task Endpoints`, `## 6. Sprint Endpoints`
- **Evidence:** Các bảng endpoint mới liệt kê Method, URL, Purpose và Access (ví dụ `POST /sprints/:sprintId/complete`, `POST /projects/:projectId/tasks`, `POST /projects/:projectId/restore`), chưa có JSON Request Payload mẫu cho `taskDispositions[]` của `/complete` hay `targetStatus` của `/restore`.
- **Problem:** Hợp đồng dữ liệu (DTO/Zod schema) ở mức field-level chưa được khóa cứng trong `API-Specification.md`.
- **Impact:** Frontend và Backend cần thống nhất thêm khi viết Zod validation schema trong quá trình code.
- **Recommended Action:** Bổ sung Request/Response DTO tóm tắt cho các endpoint mutation chính (`POST /tasks`, `POST /sprints/:sprintId/complete`, `POST /projects/:projectId/restore`, `DELETE /projects/:projectId/members/:userId`).

#### `F-06` — Ràng buộc Single Active Project cần Partial Unique Index ở PostgreSQL
- **Severity:** MEDIUM
- **Category:** Database Design
- **File:** `03-Architecture-and-Design/Database-Design.md`
- **Section:** `## 5.1. Project` & `## 21. Document Change History` (`Confirmed Data Design Decisions`, line 1077)
- **Evidence:** Tài liệu yêu cầu *"bảo vệ unique active Project constraint"* khi Activate hoặc Restore về `ACTIVE`, nhưng chưa nêu rõ kỹ thuật tạo **Partial Unique Index** trên PostgreSQL (`CREATE UNIQUE INDEX ... ON "Project"(status) WHERE status = 'ACTIVE'`) thay vì `UNIQUE(status)` thông thường.
- **Problem:** Prisma `@@unique([status])` thông thường sẽ cấm có nhiều hơn 1 Project `ARCHIVED` hoặc `CREATED`, gây lỗi nghiệp vụ nghiêm trọng.
- **Impact:** Rủi ro sai sót khi chuyển `Database-Design.md` sang `prisma/schema.prisma` và migration SQL.
- **Recommended Action:** Ghi chú rõ yêu cầu sử dụng **PostgreSQL Partial Unique Index** (`WHERE status = 'ACTIVE'`) trong `Database-Design.md` kết hợp kiểm tra trong Transaction.

---

### LOW

#### `F-07` — `DOCUMENT-INVENTORY.md` đếm thiếu `DECISION-LOG.md` trong danh sách nhóm
- **Severity:** LOW
- **Category:** Document Completeness
- **File:** `DOCUMENT-INVENTORY.md`
- **Section:** Header & Danh sách tài liệu (lines 4–28)
- **Evidence:** Dòng 4 ghi `Total documents: 13 chuyên môn + 2 tài liệu điều hướng`, nhưng các mục bên dưới (`01` đến `05`) chỉ liệt kê `2 + 3 + 4 + 2 + 1 = 12` tệp; `DECISION-LOG.md` chưa xuất hiện trong danh sách liệt kê.
- **Problem:** Số đếm và danh sách liệt kê chưa khớp 100%.
- **Impact:** Không ảnh hưởng đến code; chỉ gây nhầm lẫn nhỏ về cấu trúc thư mục.
- **Recommended Action:** Thêm mục liệt kê `DECISION-LOG.md` vào `DOCUMENT-INVENTORY.md`.

#### `F-08` — Dòng phân cách `---` bị lặp cuối `Use-Case-Specification.md`
- **Severity:** LOW
- **Category:** Formatting
- **File:** `02-Requirements/Use-Case-Specification.md`
- **Section:** Sau `## UC-035: Complete Sprint` (lines 1702–1704)
- **Evidence:** Có hai dòng `---` liên tiếp ở lines 1702 và 1704.
- **Problem:** Lỗi trình bày Markdown nhỏ.
- **Impact:** Không ảnh hưởng nghiệp vụ.
- **Recommended Action:** Xóa một dòng `---` thừa khi chỉnh sửa file.

---

## 5. Cross-Document Consistency Matrix

| Source | Compare With | Result | Notes |
|---|---|---|---|
| `Project-Overview.md` | `Project-Scope-and-Roadmap.md`, `SRS` | **PASS** | Phạm vi MVP, 4 Roles, Priority, Hours Estimate, Email Must Have đồng nhất. |
| `Project-Scope-and-Roadmap.md` | `SRS` | **PASS** | Roadmap 6 Sprint khớp với các nhóm `FR-*` trong SRS. |
| `Business-Rules-and-Workflows.md` | `SRS`, `Use-Case-Specification.md` | **MINOR ISSUE** | `BR-TASK-013` khớp `SRS`/`UC-013`, nhưng `Workflow 4.5` & bảng `3.14` chưa cập nhật `DEC-011`. |
| `SRS` | `Use-Case-Specification.md`, `Testing-Strategy.md` | **MINOR ISSUE** | `SRS §13` đã đủ `UC-034`, `UC-035`; nhưng `UC §2.1` thiếu `UC-034`, `UC-035`. `Testing-Strategy.md` phủ đủ 100% FR. |
| `Use-Case-Specification.md` | `Business-Rules`, `UI-UX`, `API` | **MINOR ISSUE** | `UC-013`, `UC-015`, `UC-017`, `UC-034`, `UC-035` khớp API/BR; `UI-UX` thiếu chi tiết modal Restore/Complete Sprint tại màn hình `6.3`/`6.7`. |
| `Authorization-Design.md` | `Business-Rules`, `Use-Cases`, `API` | **PASS** | 25 permissions, scope và server-side checks khớp 100% với `BR-*` và `API-Specification.md`. |
| `Database-Design.md` | `SRS`, `Use-Cases`, `API` | **PASS** | `templateId`/`instructorId` nullable, `TaskPriority`, `HOURS`, `TaskDependency`, `Sprint`, `NotificationDelivery` khớp hoàn toàn. |
| `SAD` | `Development-Guidelines.md`, `API` | **PASS** | Stack Next.js Fullstack, Modular Monolith, PostgreSQL, Prisma, Tailwind/shadcn, Zod, Recharts đồng nhất. |
| `UI-UX-Design.md` | `Use-Cases`, `SRS` | **MINOR ISSUE** | `6.5.2` đã sửa `Assignees` thành `Required: No`; còn thiếu UI detail cho `UC-034`/`UC-035` tại `6.3`/`6.7`. |
| `API-Specification.md` | `Use-Cases`, `Database`, `Authorization` | **PASS** | Đủ endpoint cho mọi UC chính và bảo vệ đúng RBAC/Transaction. |
| `Testing-Strategy.md` | `SRS`, `Business-Rules`, `Use-Cases` | **PASS** | Đã sửa hết trùng ID và bổ sung đủ TC cho mọi FR và DEC. |
| `DECISION-LOG.md` | Tất cả 14 tài liệu còn lại | **MINOR ISSUE** | 11/11 DEC đã phản ánh vào nội dung chính; chỉ còn `Workflow 4.5` & `3.14` trong Business Rules chưa cập nhật `DEC-011`. |

---

## 6. Business Rules Coverage Matrix

| Domain | Nghiệp vụ trọng tâm | Trạng thái | Tài liệu tham chiếu |
|---|---|---|---|
| **Account & Auth** | Self-registration, Admin approval, Statuses, Roles, Login/Logout, Profile | **Specified** *(Chờ Password Policy & Email Verification)* | `BR-ACC-001..008`, `UC-001..006`, `UC-033`, `FR-AUTH-001..007` |
| **Workspace & Project** | Single Workspace, Leader required, Optional Template/Instructor, Lifecycle, Single Active Project, Archive & Admin Restore | **Specified** | `BR-PROJ-001..012`, `UC-007..012`, `UC-034`, `FR-PROJ-001..007` |
| **Task Management** | Optional & Multiple Assignees, Assignment History, Priority (`LOW..CRITICAL`), Hours Estimate, Mandatory Deadline, Optional Start Date, Dependency DONE gate, Review Approve/Reject with Reason, Task History | **Specified** *(Chờ Member-editable fields)* | `BR-TASK-001..013`, `UC-013..019`, `FR-TASK-001..009` |
| **Sprint Management** | Backlog (`sprintId = NULL`), Single Sprint per Task, Multiple Active Sprints, Complete Sprint (Leader decides unfinished Tasks) | **Specified** *(Chờ Progress/Burndown formula)* | `BR-SPR-001..011`, `UC-020..023`, `UC-035`, `FR-SPRINT-001..005` |
| **Document Library** | Google Drive URL, No upload, Category, Project/Optional Sprint link, Update/Delete Record | **Specified** | `BR-DOC-001..007`, `UC-026..027`, `FR-DOC-001..005` |
| **Notification** | In-app + Email Must Have, Read/Unread, `NotificationDelivery` (`PENDING/SENT/FAILED`), No rollback on Email fail | **Specified** *(Chờ Email Provider & Retry limit)* | `BR-NOTIF-*`, `UC-028..029`, `FR-NOTI-001..005` |
| **Dashboard & Reporting** | Task Stats, Overdue, Pending Review, Sprint/Project Progress, Burndown Chart, Recent Activity | **Specified** *(Chờ Progress & Burndown formula)* | `Business-Rules §3.11`, `UC-030..032`, `FR-DASH-001..005`, `FR-ACT-001..004` |

---

## 7. Requirements Traceability Matrix

| Requirement Group | Related Use Cases | Primary API / Server Boundary | Primary DB Entities | Test Cases | Coverage Status |
|---|---|---|---|---|---|
| `FR-AUTH-001..007` | `UC-001..006`, `UC-033` | `/auth/*`, `/users/*` | `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `AuditLog` | `TC-AUTH-001..013`, `TC-USER-001..008`, `TC-RBAC-001..009` | **Defined** (Not Executed) |
| `FR-PROJ-001..007` | `UC-007..012`, `UC-034` | `/projects/*`, `/projects/:id/restore`, `/projects/:id/members/*` | `Project`, `ProjectTemplate`, `ProjectMember` | `TC-PROJ-001..016`, `TC-MEMBER-001..008` | **Defined** (Not Executed) |
| `FR-TASK-001..009` | `UC-013..019` | `/projects/:id/tasks`, `/tasks/:id/*` | `Task`, `TaskAssignee`, `TaskAssignmentHistory`, `TaskDependency`, `TaskStatusHistory`, `TaskReview` | `TC-TASK-001..028` | **Defined** (Not Executed) |
| `FR-SPRINT-001..005` | `UC-020..023`, `UC-035` | `/projects/:id/sprints`, `/sprints/:id/*` | `Sprint`, `Task` (`sprintId`), `SprintAssignmentHistory` | `TC-SPRINT-001..010`, `TC-SPR-001..002` | **Defined** (Not Executed) |
| `FR-KANBAN-001..004` | `UC-024..025` | `GET /projects/:id/tasks`, `PATCH /tasks/:id` | `Task`, `Sprint` | `TC-KANBAN-001..008` | **Defined** (Not Executed) |
| `FR-DOC-001..005` | `UC-026..027` | `/projects/:id/documents`, `/documents/:id` | `Document` | `TC-DOC-001..011` | **Defined** (Not Executed) |
| `FR-NOTI-001..005` | `UC-028..029` | `/notifications/*`, Email Dispatcher | `Notification`, `NotificationDelivery` | `TC-NOTI-001..009` | **Defined** (Not Executed) |
| `FR-DASH-001..005` | `UC-030..031` | `/dashboard`, `/reports/project/:id` | `Task`, `Sprint`, `TaskStatusHistory`, `ActivityLog` | `TC-DASH-001..008`, `TC-REPORT-001..004` | **Defined** (Not Executed) |
| `FR-ACT-001..004` | `UC-032` | `/activity` | `ActivityLog`, `AuditLog` | `TC-ACT-001..006` | **Defined** (Not Executed) |

*(Ghi chú: Toàn bộ cột Test Cases thể hiện mức **Test Case Defined**, chưa phải **Test Executed / Test Passed** vì chưa triển khai code.)*

---

## 8. Authorization Audit Matrix

| Role | Resource | Key Permissions | Scope & Constraints | Evidence |
|---|---|---|---|---|
| **ADMIN** | Accounts, Roles, Projects, Tasks, Sprints, Docs, Reports | Full Workspace Permissions + `project.restore` | System scope; bị chặn xóa/hạ quyền Admin cuối cùng; không vượt qua invariant nghiệp vụ (Dependency DONE, Single Active Project, Member Task Reassign). | `Authorization-Design.md` §3–§9, `BR-AUTHZ-003`, `BR-AUTHZ-008` |
| **INSTRUCTOR** | Assigned/Permitted Projects, Tasks, Sprints, Docs, Reports | `project.read`, `task.read`, `task.history.read`, `sprint.read`, `document.read`, `report.read`, `activity.read` | Read-only mặc định; chỉ xem Project được phân công hoặc cấp quyền. Không có quyền mutation. | `Authorization-Design.md` §3–§6, `BR-AUTHZ-004` |
| **LEADER** | Managed Projects, Members, Tasks, Sprints, Reviews, Docs | `project.create/read/update/activate/archive`, `project.member.manage`, `task.*`, `sprint.manage/read`, `document.manage/read`, `report.read` | Project scope (chỉ Project được gán làm Leader hoặc quản lý); **không có `project.restore`**; phải reassign Task trước khi remove Member. | `Authorization-Design.md` §4–§9, `BR-AUTHZ-005`, `BR-PROJ-012`, `BR-MEM-005` |
| **MEMBER** | Joined Projects, Assigned Tasks, Docs, Own Notifications | `project.read`, `task.read`, `task.update` (giới hạn), `task.submit_review`, `sprint.read`, `document.read`, `notification.read` | Joined-project & Assigned-task scope; không được tự Approve/Reject, không sửa Assignee/Dependency/Project, không xem Notification người khác. | `Authorization-Design.md` §4–§9, `BR-AUTHZ-006` |

- **Server-side Enforcement:** Được đặc tả bắt buộc 9 bước trong `Authorization-Design.md` §8 (Session → Active User check → Load Permissions → Resource Scope → Ownership/Assignment → Zod Validation → Transaction → Audit Log → Safe Response), áp dụng thống nhất cho cả Server Actions và Route Handlers.

---

## 9. V2.1 Regression Results

| # | Special Checklist Item | Result | Evidence |
|---|---|---|---|
| 1 | `UC-017` phải kiểm tra tất cả Predecessor Tasks ở trạng thái `DONE` trước khi hoàn tất Task | **PASS** | `Use-Case-Specification.md` lines 942–943, 953, 958 (`UC-017` Main Flow bước 12–13, Alternative Flows & Postconditions). |
| 2 | Có Use Case riêng cho Complete Sprint | **PASS** | `Use-Case-Specification.md` lines 1658–1701 (`UC-035: Complete Sprint`). |
| 3 | `UC-034 Restore Archived Project` phải được đưa vào Use Case Index và SRS Traceability | **PARTIAL / REGRESSION** | Đã có trong `SRS §13` (line 1323), nhưng **vẫn thiếu trong Use Case Index `§2.1`** của `Use-Case-Specification.md` (lines 62–96). |
| 4 | Assignees phải là Optional khi tạo Task | **PASS** *(minor discrepancy in BR 4.5)* | `DECISION-LOG.md` (`DEC-011`), `BR-TASK-013`, `SRS` (`FR-TASK-001`), `UC-013`, `UI-UX 6.5.2` (`Required: No`). Còn mục `4.5` & `3.14` của Business Rules chưa cập nhật. |
| 5 | Không được gửi Assignment Notification khi Task được tạo mà chưa có Assignee | **PASS** | `BR-TASK-013` (line 294), `UC-013` (line 757), `SRS` (line 428), `UI-UX 6.5.2` (line 505), `TC-TASK-027`. |
| 6 | Khi Leader phân công Task, các Assignees mới phải được thông báo | **PASS** | `BR-TASK-013` (line 294), `UC-015` (line 849), `TC-TASK-028`. |
| 7 | Test Case IDs không được trùng lặp | **PASS** | Kiểm tra toàn bộ 167 TCs trong `Testing-Strategy.md`: **0 ID trùng lặp**. |
| 8 | Có Test Case cho `FR-AUTH-006` / Profile Management | **PASS** | `Testing-Strategy.md` line 298 (`TC-AUTH-013: Manage User Profile`). |
| 9 | Có Test Case cho `FR-DASH-003` / Burndown Chart | **PASS** | `Testing-Strategy.md` line 454 (`TC-DASH-008: View Sprint Burndown Chart`). |
| 10 | Có Test Case cho `FR-DOC-002` / Update Document Record | **PASS** | `Testing-Strategy.md` line 429 (`TC-DOC-010: Update Document Record`). |
| 11 | Có Test Case cho `FR-DOC-003` / Delete Document Record | **PASS** | `Testing-Strategy.md` line 430 (`TC-DOC-011: Delete Document Record`). |
| 12 | `OI` IDs phải được quản lý nhất quán | **PASS** | `SRS §14` (lines 1340–1356) đã đánh số liên tục `OI-001` đến `OI-014`, không còn dòng trống. |
| 13 | `DEC-001` đến `DEC-011` phản ánh nhất quán trong các tài liệu liên quan | **PASS WITH MINOR ISSUE** | Đã phản ánh đồng bộ trên các tài liệu; chỉ còn `Business-Rules §4.5` và `§3.14` chưa cập nhật `DEC-011`. |
| 14 | `README` và `DOCUMENT-INVENTORY` phản ánh đúng phiên bản tài liệu | **PASS WITH MINOR ISSUE** | Cả hai đã ghi nhận `Update V2.1 — 2026-11-15`; `DOCUMENT-INVENTORY.md` còn thiếu tên `DECISION-LOG.md` trong danh sách nhóm. |

---

## 10. Open Issues and Blocking Decisions

| Issue ID | Description | Affected Documents | Affected Modules | Priority | Blocks Development? | Required Before Sprint | Suggested Options | Recommendation | Decision Owner |
|---|---|---|---|---|---|---|---|---|---|
| `OI-AUTH-01` (`SAD-001`, `DB-011`) | Chọn Authentication Library & Session storage | `SAD`, `Database-Design`, `Development-Guidelines` | Auth & Session | **Critical** | **Blocking** | Sprint 1 | Auth.js (NextAuth v5) với DB/JWT Session hoặc Custom HTTP-only Signed Session | Chọn Auth.js v5 (Credentials) hoặc JWT/DB Session đơn giản phù hợp Next.js App Router | Project Owner |
| `OI-AUTH-02` (`TBD-001`) | Password Policy (độ dài tối thiểu, độ phức tạp) | `Business-Rules`, `SRS`, `UI-UX` | Auth & User | **High** | **Blocking** | Sprint 1 | Tối thiểu 8 ký tự (chữ + số) hoặc 8 ký tự + ký tự đặc biệt | Tối thiểu 8 ký tự gồm chữ và số (đủ an toàn cho MVP nội bộ) | Project Owner |
| `OI-AUTH-03` (`OI-002`, `TBD-002`, `DB-010`) | Có yêu cầu Email Verification khi đăng ký trước khi Admin duyệt? | `SRS`, `Business-Rules`, `Database-Design`, `Use-Cases` | Auth & Registration | **High** | **Blocking** | Sprint 1 | (A) Không cần, Admin duyệt trực tiếp; (B) Cần verify email token trước khi Pending → Admin duyệt | Phương án (A) để giảm phức tạp cho MVP nội bộ | Project Owner |
| `OI-TASK-01` (`OI-005`, `TBD-006`) | Danh sách chính xác các trường Member được sửa trên Task được giao | `Authorization-Design`, `SRS`, `Use-Cases`, `UI-UX` | Task Management | **High** | **Blocking** | Sprint 3 | (A) Chỉ đổi Status (`TODO -> IN_PROGRESS -> REVIEW`) & progress note; (B) Thêm sửa Description/Reference Links | Phương án (A) theo mặc định an toàn của `Authorization-Design.md` §7 | Project Owner |
| `OI-NOTI-01` (`OI-014`, `SAD-003`, `TBD-027`) | Chọn Email Provider & giới hạn Retry cho `NotificationDelivery` | `SAD`, `API-Spec`, `SRS`, `Development-Guidelines` | Notification & Email | **High** | **Blocking** | Sprint 5 | Resend Free Tier hoặc Nodemailer (Gmail SMTP); Retry tối đa 3 lần | Resend Free Tier (dễ tích hợp Vercel) + tối đa 3 lần retry | Project Owner |
| `OI-DASH-01` (`OI-011`, `OI-012`, `TBD-021`, `TBD-028`) | Công thức tính Project/Sprint Progress & Remaining Work (Burndown) | `Business-Rules`, `SRS`, `Testing-Strategy` | Dashboard & Reporting | **High** | **Blocking** | Sprint 6 | (A) Theo số lượng Task `DONE / Total`; (B) Theo Estimate Hours (fallback Task Count nếu thiếu Estimate) | Phương án (A) cho Progress chính; (B) hoặc Task Count cho Burndown MVP | Project Owner |
| `OI-PROF-01` (`OI-003`) | Các trường Profile User tự chỉnh sửa (`UC-033`) | `SRS`, `Use-Cases`, `UI-UX` | User Profile | **Medium** | **Non-blocking** | Sprint 1–2 | Cho phép sửa `fullName`, `avatarUrl` (nếu có), đổi mật khẩu; khóa `email`, `role`, `status` | Chỉ cho sửa `fullName` và đổi mật khẩu | Project Owner |
| `OI-DOC-01` (`OI-009`, `TBD-023`) | Member có quyền tạo/xóa Document Record hay chỉ Admin/Leader? | `SRS`, `Authorization-Design`, `Business-Rules` | Document Library | **Medium** | **Non-blocking** | Sprint 5 | Giữ Admin/Leader quản lý theo `Authorization-Design.md` §5 hoặc mở rộng cho Member | Giữ Admin/Leader quản lý trong MVP | Project Owner |
| `OI-MISC-01` (`OI-004`, `OI-007`, `OI-008`, `OI-010`) | Instructor Comment, Task/Sprint Cancellation, Deadline Reminder, Template chi tiết | `Business-Rules`, `SRS`, `Database-Design` | Cross-module | **Low** | **Deferred** | Post-MVP | Giữ nguyên hiện trạng: Instructor Read-only, chưa triển khai Task Cancel & Deadline Reminder | Giữ **Deferred** ngoài phạm vi MVP cốt lõi | Project Owner |

---

## 11. Recommended Fix Plan

### Phase 1 — Critical Fixes
*Không có finding mức Critical.*

### Phase 2 — High Priority Fixes
1. **`02-Requirements/Use-Case-Specification.md`**: Bổ sung `UC-034` và `UC-035` vào bảng `2.1. Main Use Cases` để xử lý Regression Checklist #3 (`F-01`).
2. **`DECISION-LOG.md` & Open Issues**: Project Owner chốt 3 quyết định chặn Sprint 1 (`Auth Library`, `Password Policy`, `Email Verification`) trước khi khởi tạo code Auth (`F-02`).

### Phase 3 — Medium/Low Priority Fixes
1. **`02-Requirements/Business-Rules-and-Workflows.md`**: Cập nhật `4.5. Task Creation Workflow` (bước 6, 14, 15 và Mermaid diagram) và bảng `3.14` để đồng bộ `DEC-011` (`F-03`).
2. **`03-Architecture-and-Design/UI-UX-Design.md`**: Bổ sung UI Components/Behavior cho Restore Project tại `6.3.1`/`6.3.3` và Complete Sprint tại `6.7.3` (`F-04`).
3. **`04-Technical-Specifications/API-Specification.md`**: Bổ sung DTO/Request schema tóm tắt cho `POST /tasks`, `POST /sprints/:sprintId/complete`, `POST /projects/:projectId/restore` (`F-05`).
4. **`03-Architecture-and-Design/Database-Design.md`**: Ghi chú rõ yêu cầu **Partial Unique Index** (`WHERE status = 'ACTIVE'`) cho bảng `Project` (`F-06`).
5. **`DOCUMENT-INVENTORY.md`**: Bổ sung `DECISION-LOG.md` vào danh sách liệt kê tài liệu (`F-07`).
6. **`02-Requirements/Use-Case-Specification.md`**: Xóa dòng `---` thừa sau `UC-035` (`F-08`).

### Phase 4 — Optional Improvements (Trước Sprint 3–6)
1. Project Owner chốt `Member-editable Task fields` trước Sprint 3, `Email Provider` trước Sprint 5, và `Progress/Burndown Formula` trước Sprint 6.
2. Đồng bộ lại các tệp `.docx` trong `d:/Akatsuki Yui/docs/` sau khi bộ Markdown được chốt hoàn toàn.

---

## 12. Final Readiness Assessment

**Trạng thái kết luận:** **READY WITH BLOCKERS**

**Lý do:**
- Về mặt **kiến trúc, cơ sở dữ liệu, phân quyền, API boundary, Use Case và chiến lược kiểm thử**, bộ tài liệu đã đạt độ nhất quán và chi tiết rất cao, đủ để Coding Agent thiết lập dự án Next.js + PostgreSQL + Prisma và tránh được hầu hết các điểm tự suy diễn nghiệp vụ (`DEC-001` – `DEC-011`).
- Tuy nhiên, chưa thể đánh dấu `READY FOR MVP DEVELOPMENT` hoàn toàn vì vẫn còn **4 nhóm quyết định chặn theo từng Sprint** (đặc biệt là Auth Library, Password Policy và Email Verification cho Sprint 1; Member Task fields cho Sprint 3; Email Provider cho Sprint 5; và Progress/Burndown formula cho Sprint 6) cùng một lỗi Regression nhỏ ở `Use-Case-Specification.md` §2.1 (`UC-034`/`UC-035`).
- Sau khi Project Owner chốt 3 quyết định Auth và sửa nhanh danh mục `2.1` trong `Use-Case-Specification.md`, dự án đủ điều kiện bước vào **READY FOR SPRINT 1** ngay lập tức.
