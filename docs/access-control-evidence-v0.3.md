# Access Control & Evidence Storage Foundation – v0.3

## Mục tiêu
Đưa MVP tiến thêm một bước về quản trị mà không giả định đã có hệ thống đăng nhập thật.

## 1. Authorization policy
Bộ vai trò chuẩn bị sẵn:
- Quản trị Compliance
- Quản lý Tuân thủ
- Trưởng đoàn đánh giá
- Người kiểm tra
- Người rà soát
- Đơn vị được đánh giá
- Chỉ xem

Quyền được tách theo capability: quản lý khung, tạo assessment, fieldwork, review AI, xác nhận finding, giao action, verification, báo cáo, quản trị quyền.

## 2. Scope
Quyền có thể bị giới hạn tiếp theo OrgUnit/Assessment. Bản v0.3 dùng scope theo orgId để mô phỏng và kiểm thử UX.

## 3. Authentication
**Chưa có identity provider thật.**
Role switcher trên UI được ghi rõ là “Mô phỏng quyền”, chỉ phục vụ kiểm thử trải nghiệm và policy. Nó không được coi là login.

Backend shared-state/evidence không được phép mở dữ liệu production chỉ vì UI có role. Khi DATABASE_URL/BLOB được cấu hình nhưng AUTH_MODE chưa có, API sẽ từ chối dữ liệu nhạy cảm/ghi cloud.

## 4. Evidence storage
API `/api/evidence` đã sẵn sàng cho Vercel Blob:
- private blob
- giới hạn file 8 MB ở giai đoạn foundation
- sanitize file name
- không upload cloud nếu Auth chưa được cấu hình
- frontend vẫn có local metadata fallback để workflow không bị chặn

## 5. Gate trước khi gọi Production
Cần cấu hình identity provider thật, sau đó server phải xác minh identity và quyền ở **mọi write/read nhạy cảm**. UI permission chỉ là lớp trải nghiệm, không phải security boundary.
