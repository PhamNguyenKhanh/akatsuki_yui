# DECISION LOG — AKATSUKI YUI

**Last updated:** 2026-11-15

| ID | Decision | Confirmed Choice | Status |
|---|---|---|---|
| DEC-001 | Project Template required? | Optional; Project may be created without Template. | Confirmed |
| DEC-002 | Instructor required? | Optional; Project may have no Instructor. | Confirmed |
| DEC-003 | Task Priority enum | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. | Confirmed |
| DEC-004 | Task Estimate | Time-based Estimate in hours for MVP. | Confirmed |
| DEC-005 | Dependency blocks completion? | Yes. A dependent Task cannot transition to `DONE` until every predecessor is `DONE`. It is not yet specified to block starting work. | Confirmed |
| DEC-006 | Multiple Active Sprints | Allowed within one Project. | Confirmed |
| DEC-007 | Unfinished Tasks at Sprint end | Leader decides disposition for each Task; no automatic movement. | Confirmed |
| DEC-008 | Restore Archived Project | Allowed; Admin only. Single Active Project invariant still applies when restoring to Active. | Confirmed |
| DEC-009 | Remove Project Member with assigned Tasks | Leader must reassign all assigned Tasks before removal; otherwise block removal. Preserve assignment history. | Confirmed |
| DEC-010 | Email Notification in MVP | Mandatory. Provider selection remains an implementation decision. | Confirmed |
| DEC-011 | Assignees required when creating Task? | Optional. Leader may create a Task without Assignees and assign Members later. | Confirmed |
| DEC-012 | Auth Library & Session | Auth.js (NextAuth v5) with Credentials Provider + JWT HTTP-only cookie (no DB Session table required). | Confirmed |
| DEC-013 | Password Policy | Minimum 8 characters, requiring uppercase, lowercase, number, and special character. | Confirmed |
| DEC-014 | Email Verification at registration | Not required; new registrations go directly to `PENDING` for Admin approval (no verification token table required). | Confirmed |
| DEC-015 | Member-editable Task fields | Assigned Member may only update Status (`TODO -> IN_PROGRESS -> REVIEW`) and Reference Links / progress notes; Title, Description, Priority, Deadline, Estimate, Assignees, Dependencies, and Sprint are locked. | Confirmed |
| DEC-016 | Email Provider & Retry Policy | Resend (Free Tier API) with a maximum of 3 retries per failed `NotificationDelivery`. | Confirmed |
| DEC-017 | Progress & Burndown calculation | Project and Sprint Progress use Task Count (`DONE / Total`); Burndown Chart uses Estimate Hours (shows insufficient-data notice if no Tasks in the Sprint have Estimate). | Confirmed |
| DEC-018 | User Profile editable fields | User may edit `fullName` and change Password (requiring Current Password); `email`, `role`, and `status` are locked. | Confirmed |

## Remaining Decisions (not answered by this decision set)

Assignee requirement at Task creation (`DEC-011`), Auth/Password/Email Verification (`DEC-012`–`DEC-014`), Member Task fields (`DEC-015`), Email Provider/Retry (`DEC-016`), Progress/Burndown (`DEC-017`), and Profile fields (`DEC-018`) are resolved and are no longer open decisions.

- Whether Actual Time is tracked.
- Whether dependencies can cross Sprints and whether only Finish-to-Start is supported.
- Sprint overlap/date editing/cancellation details.
- Exact Project Archive preconditions and restore target-state selection.
- Instructor comment permission (currently Read-only by default).
- Member Contribution Report metric definitions.
- Deadline reminder rules.
