# Compliance Assessment App — Production Candidate v1.0-rc2

## Người dùng nhìn thấy gì

Web app hiện hỗ trợ chuỗi nghiệp vụ:

1. Quản lý nguồn tuân thủ.
2. Tạo Framework và Requirement.
3. Tạo chương trình/Assessment.
4. Không khai báo giới hạn requirement → mặc định toàn bộ Requirement `assessable` thuộc phạm vi.
5. Fieldwork theo từng Requirement Assessment.
6. Upload file; ghi nhận metadata, revision và SHA-256.
7. Proposal hỗ trợ phân tích; con người quyết định kết quả/finding.
8. Finding theo cấu trúc Fact → Criteria → Gap → Root cause → Risk/Impact → Recommendation.
9. Unit Response.
10. Remediation Action → Owner → Due date → Verification → Close.
11. Compliance Exception có approver và expiry.
12. Dashboard, coverage, phân bố kết quả, repeat finding và Decision Log.
13. Sign-off khóa Assessment.
14. RBAC được mô phỏng theo role để kiểm thử UX.
15. Export/Import JSON để backup.
16. Cloud sync dùng chung khi backend nhận `DATABASE_URL`.

## Cơ chế lưu trữ

### Khi có database
Frontend gọi `/api/state` trên Vercel. API dùng Neon PostgreSQL và optimistic version:
- GET lấy phiên bản dữ liệu hiện hành.
- POST ghi khi version của client khớp version trên server.
- Nếu có xung đột, API trả `409 VERSION_CONFLICT`.
- App dừng ghi đè tự động; người dùng phải chọn nạp bản Cloud hoặc Admin chủ động ghi đè sau khi đối chiếu.

### Khi chưa có database hoặc mất kết nối
App giữ dữ liệu trong trình duyệt và vẫn cho Export/Import. Không tuyên bố dữ liệu local là multi-user production.

## Kiến trúc dữ liệu

- `db/schema.sql`: schema đích chuẩn hóa 22 domain object.
- `db/migrations/`: chia migration để triển khai PostgreSQL/Neon.
- `api/state.js`: persistence bridge JSONB giai đoạn chuyển tiếp.
- Mục tiêu tiếp theo là chuyển API từ shared JSONB state sang các bảng chuẩn hóa sau khi UX/workflow được khóa.

## Governance đã có

- Requirement master tách RequirementAssessment instance.
- Workflow status tách Compliance Result.
- Existing Control tách Remediation Action.
- Evidence versioned và có integrity hash.
- AI không tạo Finding chính thức.
- Sign-off lock.
- Decision Log append-only ở domain layer.
- Cloud conflict không silent overwrite.

## Gate còn lại trước Production Release

1. Provision Neon database và gắn `DATABASE_URL` vào Vercel production/preview.
2. Authentication/SSO; map user → Actor/Role/Org scope.
3. Object/file storage thực cho Evidence binary.
4. Server-side audit log bất biến và policy enforcement.
5. AI multimodal thật cho Evidence Intelligence; Human Confirmation Gate vẫn bắt buộc.
6. Browser E2E test trên production URL.
7. Security review: auth, secrets, upload validation, rate limit, backup/restore.

Không có số liệu tuân thủ thực tế nào được seed vào ứng dụng; dữ liệu demo được gắn nhãn riêng.
