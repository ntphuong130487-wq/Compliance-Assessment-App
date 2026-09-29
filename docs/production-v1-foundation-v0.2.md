# Production v1 Foundation – v0.2

## Sau vòng này người dùng có gì?

Ứng dụng giữ nguyên 7 màn hình và luồng nghiệp vụ MVP, nhưng có thêm một lớp backend có thể lưu **dữ liệu dùng chung** trên PostgreSQL khi cấu hình `DATABASE_URL`.

### Cơ chế an toàn
- Nếu database chưa được cấu hình: app vẫn chạy bằng localStorage như MVP.
- Nếu database đã cấu hình: app tự phát hiện và chuyển sang **Cloud sync**.
- Ghi dữ liệu dùng optimistic version để tránh một tab ghi đè im lặng lên phiên bản mới hơn.
- API giới hạn payload 4 MB ở giai đoạn nền; file thật chưa đưa vào JSON state.
- `/api/health` cho biết backend và database đã được cấu hình chưa.

### Lộ trình dữ liệu
V0.2 dùng JSONB state store để đưa app từ single-browser sang shared persistence nhanh và ít rủi ro.
File `db/schema.sql` là schema chuẩn hóa mục tiêu theo Domain Model v0.1. Việc migrate từ JSONB sang các bảng chuẩn hóa sẽ được thực hiện sau khi workflow UX được xác nhận ổn định, tránh khóa schema vật lý quá sớm.

### Chưa coi là Production hoàn chỉnh
Các hạng mục còn lại:
1. Authentication + RBAC theo OrgUnit/Assessment role.
2. Object storage cho file Evidence.
3. Migrate API sang normalized tables.
4. AI multimodal thật cho Evidence Intelligence.
5. Server-side immutable DecisionLog / audit trail.
6. E2E browser tests và production observability.
