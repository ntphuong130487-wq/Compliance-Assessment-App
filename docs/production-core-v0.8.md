# Production Core v0.8

## Mục tiêu
Chuyển Compliance Assessment App khỏi mô hình shared JSON/local state sang nguồn dữ liệu PostgreSQL chuẩn hóa, có server-side authorization.

## Đã hoàn thành trong code
- Normalized bootstrap API có data scope theo OrgUnit.
- Server-side permission matrix và Org scope enforcement.
- Assessment create + RequirementAssessment update trên normalized DB.
- Draft Finding → Unit Response → Final Finding trên normalized DB.
- Action → closure evidence → independent verification trên normalized DB.
- Source intake + metadata + extraction draft persistence.
- Bulk review/publish nghĩa vụ và một cấp duyệt Requirement.
- Private evidence được ghi Evidence → Revision → Link + SHA-256.
- User directory cho phân công Action.
- Manual framework creation trên normalized DB.
- Production-core migration 004.
- db:migrate và db:check.

## Chế độ chuyển đổi
- DATA_MODE=shared-json: giữ backward-compatible MVP.
- DATA_MODE=normalized: frontend đọc /api/v1/bootstrap và ghi qua /api/v1/commands.
- /api/state không còn được dùng làm source of truth khi normalized mode hoạt động.

## Gate để kích hoạt thật
1. Tạo Clerk application và cấu hình keys.
2. Tạo Neon project và DATABASE_URL.
3. Chạy npm run db:migrate.
4. Chạy npm run db:check.
5. Cấu hình BLOB_READ_WRITE_TOKEN.
6. Đặt DATA_MODE=normalized.
7. Redeploy và chạy multi-user smoke test.

## Chưa tuyên bố hoàn tất
- Chưa có credential thật nên chưa chạy migration trên Neon production.
- Chưa có regression test trên database thật.
- Legal search và AI/OCR production vẫn là phase sau.
