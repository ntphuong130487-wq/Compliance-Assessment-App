# Compliance Assessment App — Production Candidate v1.0-rc1

## Người dùng nhìn thấy gì

Luồng nghiệp vụ đã có trong web app:

1. Quản lý nguồn tuân thủ.
2. Tạo Framework và Requirement.
3. Tạo chương trình/Assessment.
4. Mặc định toàn bộ Requirement assessable thuộc phạm vi nếu không khai báo giới hạn.
5. Fieldwork theo từng Requirement Assessment.
6. Upload file và ghi nhận SHA-256/metadata Evidence.
7. Proposal hỗ trợ phân tích; con người quyết định kết quả/finding.
8. Finding theo cấu trúc Fact → Criteria → Gap → Root cause → Risk/Impact → Recommendation.
9. Unit Response.
10. Remediation Action → Owner → Due date → Verification → Close.
11. Compliance Exception có approver + expiry.
12. Dashboard, coverage, result distribution, repeat finding và Decision Log.
13. Sign-off sẽ khóa Assessment.
14. RBAC được mô phỏng theo role để QA UX.
15. Export/Import JSON để sao lưu trong giai đoạn chưa nối database dùng chung.

## Phần đang hoàn tất về kỹ thuật

- Schema PostgreSQL/Neon đã được thiết kế cho 22 domain object.
- Vercel serverless health endpoint đã có.
- GitHub Actions QA chạy tự động.
- Frontend hiện dùng browser persistence; không tuyên bố đây là multi-user production database.

## Gate trước Production Release

1. Provision Neon database và apply `db/schema.sql`.
2. Gắn `DATABASE_URL` vào Vercel.
3. Xây persistence API trên schema chuẩn.
4. Bật authentication/SSO và map user → Actor/Role.
5. File storage thực cho Evidence binary; SHA-256 giữ nguyên để kiểm soát integrity.
6. Thay rule-based proposal bằng AI service thật; vẫn giữ Human Confirmation Gate.
7. E2E test trên production deployment.
