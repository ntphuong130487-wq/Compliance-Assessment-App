# Production Setup – Clerk Free + Neon v0.7

## 1. Mô hình đăng nhập

Ứng dụng sử dụng **Clerk** cho nhóm nội bộ:
- Admin mời người dùng bằng email.
- Clerk gửi lời mời.
- Người dùng xác thực/đăng nhập bằng email theo phương thức được bật trong Clerk Dashboard.
- Vai trò và phạm vi đơn vị được gắn vào invitation metadata.
- User không được provision qua invitation/admin metadata sẽ không được truy cập shared data.

### Biến môi trường bắt buộc
- AUTH_MODE=clerk
- CLERK_PUBLISHABLE_KEY
- CLERK_SECRET_KEY
- APP_URL

### Bootstrap Admin
Có thể dùng:
- AUTH_BOOTSTRAP_ADMIN_EMAILS

Email trong biến này được xem là Quản trị Tuân thủ toàn phạm vi để tạo lời mời đầu tiên. Sau khi hệ thống đã có admin chính thức, nên rà soát và thu hẹp/loại cấu hình bootstrap.

### Giới hạn domain email
- AUTH_ALLOWED_EMAIL_DOMAINS

Ví dụ logic: chỉ chấp nhận lời mời tới các domain được phê duyệt. Nếu để trống, hệ thống không áp hạn chế domain.

## 2. User & Access

Endpoint:
- /api/auth/config: publishable key an toàn cho frontend.
- /api/auth/me: user hiện tại.
- /api/admin/users GET: Admin xem user.
- /api/admin/users POST: Admin gửi invitation.
- /api/state: shared-state transition store, yêu cầu user đã provision.
- /api/evidence: private evidence upload, yêu cầu user đã provision.

**Lưu ý quản trị:** shared JSON state vẫn là lớp chuyển tiếp. Row-level authorization production theo OrgUnit chỉ được coi là hoàn chỉnh sau khi API chuyển sang normalized tables.

## 3. Neon Database

### Schema
- db/schema.sql
- db/migrations/002_p2_operational.sql
- db/migrations/003_clerk_neon_auth.sql

### Biến môi trường
- DATABASE_URL

### Kiểm tra
- npm run db:check
- /api/readiness

## 4. Clerk Dashboard cần cấu hình

1. Tạo Clerk application.
2. Bật đăng nhập email.
3. Chọn email verification link hoặc email code/OTP theo nhu cầu.
4. Ưu tiên invitation-only cho nhóm nội bộ.
5. Copy Publishable Key và Secret Key vào Vercel.
6. Tạo/đăng nhập user bootstrap admin.
7. Vào Cấu hình → Quản lý thành viên để mời nhóm còn lại.

## 5. Private Evidence
- BLOB_READ_WRITE_TOKEN

Upload file riêng tư chỉ được mở khi Clerk session hợp lệ.

## 6. Gate production

Chỉ coi là production hoàn chỉnh khi:
1. Clerk hoạt động.
2. Neon DATABASE_URL hoạt động.
3. Schema normalized đã migrate.
4. API dữ liệu chuyển khỏi shared JSON sang normalized repository.
5. Phân quyền server-side theo user + OrgUnit.
6. Private evidence storage hoạt động.
