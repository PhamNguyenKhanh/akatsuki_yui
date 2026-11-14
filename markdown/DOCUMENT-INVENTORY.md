# Document Inventory

**Project:** Akatsuki Yui  
**Total documents:** 13 chuyên môn (gồm 12 tài liệu theo nhóm + `DECISION-LOG.md`) + 2 tài liệu điều hướng (README và Inventory).
**Last updated:** 2026-11-15

## 00 — Decisions & Audit Baseline
- `DECISION-LOG.md`

## 01 — Project Foundation
- `01-Project-Foundation/Project-Overview.md`
- `01-Project-Foundation/Project-Scope-and-Roadmap.md`

## 02 — Requirements
- `02-Requirements/Business-Rules-and-Workflows.md`
- `02-Requirements/Software-Requirements-Specification.md`
- `02-Requirements/Use-Case-Specification.md`

## 03 — Architecture and Design
- `03-Architecture-and-Design/Authorization-Design.md`
- `03-Architecture-and-Design/Database-Design.md`
- `03-Architecture-and-Design/Software-Architecture-Document.md`
- `03-Architecture-and-Design/UI-UX-Design.md`

## 04 — Technical Specifications
- `04-Technical-Specifications/API-Specification.md`
- `04-Technical-Specifications/Development-Guidelines.md`

## 05 — Quality and Delivery
- `05-Quality-and-Delivery/Testing-Strategy.md`

## Source of Truth and Editing Policy

Trong gói Markdown này, các file `.md` là bản nguồn làm việc được cung cấp để rà soát và cập nhật. Nếu tồn tại bản DOCX tương ứng bên ngoài gói ZIP, cần đồng bộ thủ công hoặc bằng quy trình sinh tài liệu sau khi nội dung Markdown được duyệt. Không mặc định DOCX là nguồn chuẩn khi không có mặt trong gói làm việc này.

## Document Dependencies

- Business Rules là nguồn chuẩn cho mã và quy tắc BR.
- SRS là nguồn chuẩn cho Functional/Non-Functional Requirements.
- Use Case Specification mô tả tương tác theo Actor và luồng nghiệp vụ.
- Authorization Design là nguồn chuẩn cho Permission Matrix và enforcement.
- Database Design là nguồn chuẩn cho Entity, Relation và Constraint.
- Software Architecture mô tả cấu trúc và ranh giới Module.
- API Specification mô tả HTTP contract; không bắt buộc mọi thao tác nội bộ phải dùng HTTP.
- UI/UX Design mô tả Screen, Navigation và Interaction.
- Testing Strategy ánh xạ Requirement/Business Rule sang Test Case.
- Development Guidelines quy định convention triển khai.

## Update V2.1 — 2026-11-15

- DEC-011: Assignees are optional when creating a Task.
- Use Case Specification: UC-017 dependency gate, UC-034 Restore Archived Project, and UC-035 Complete Sprint.
- SRS: updated requirement traceability and sequential Open Issue IDs.
- UI/UX and Business Rules: aligned Task creation with optional Assignees.
- Testing Strategy: duplicate IDs corrected and missing test coverage added.
