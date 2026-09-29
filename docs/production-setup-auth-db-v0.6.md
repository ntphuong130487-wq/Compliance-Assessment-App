# Production Setup – Auth & Database v0.6

## 1. Microsoft Entra ID SSO

Ứng dụng đã có OAuth/OIDC flow thật ở các endpoint:
- /api/auth/login
- /api/auth/callback
- /api/auth/me
- /api/auth/logout

### Biến môi trường bắt buộc
- AUTH_MODE=entra
- ENTRA_TENANT_ID
- ENTRA_CLIENT_ID
- ENTRA_CLIENT_SECRET
- SESSION_SECRET: tối thiểu 32 ký tự
- APP_URL: production URL của ứng dụng

### Mapping vai trò
Có thể cấu hình:
- AUTH_ADMIN_EMAILS
- AUTH_MANAGER_EMAILS
- AUTH_REVIEWER_EMAILS
- AUTH_DEFAULT_ROLE

Danh sách email dùng dấu phẩy.

**Lưu ý:** đăng nhập thật đã được chuẩn bị, nhưng phân quyền dữ liệu theo user/org ở database chỉ được coi là production hoàn chỉnh sau khi migrate sang normalized repository; shared JSON state hiện vẫn là lớp chuyển tiếp.

## 2. Database

### Hiện trạng
- Local fallback: hoạt động nếu chưa có DATABASE_URL.
- Shared state store: hoạt động khi DATABASE_URL + SSO đã cấu hình.
- Normalized schema: db/schema.sql.
- P2 migration: db/migrations/002_p2_operational.sql.
- Kiểm tra readiness: npm run db:check.

### Gate production
1. Tạo Neon/PostgreSQL project.
2. Cấu hình DATABASE_URL trên Vercel.
3. Chạy schema/migration có kiểm soát.
4. Chạy npm run db:check.
5. Xác nhận /api/readiness trả normalizedReady=true.
6. Migrate API khỏi compliance_app_state JSONB sang các bảng normalized.
7. Áp row-level authorization theo app_users + user_org_scopes.

## 3. Evidence storage
Cấu hình BLOB_READ_WRITE_TOKEN. Upload riêng tư yêu cầu session Entra hợp lệ.

## 4. Chưa được coi là hoàn tất
- Chưa có DATABASE_URL trong môi trường mà connector hiện nhìn thấy.
- Chưa migrate dữ liệu local/shared JSON vào normalized tables.
- Chưa có row-level authorization server-side theo OrgUnit.
