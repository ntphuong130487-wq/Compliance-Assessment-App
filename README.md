# AgriS Compliance Assessment App

Web app phục vụ lập kế hoạch, thực hiện, rà soát và theo dõi khắc phục đối với hoạt động kiểm tra/đánh giá tuân thủ.

## Luồng nghiệp vụ

Khung tuân thủ → Requirement → Assessment → Fieldwork/Evidence → Kết quả → Finding → Unit Response → Remediation Action → Verification → Close.

## Release Candidate v1.0

- 8 màn hình nghiệp vụ: Điều hành, Khung tuân thủ, Chương trình đánh giá, Kiểm tra hiện trường, Phát hiện, Khắc phục, Ngoại lệ, Báo cáo.
- Không giới hạn phạm vi requirement = toàn bộ requirement `assessable` trong framework.
- Evidence có metadata, revision và SHA-256.
- AI/proposal chỉ hỗ trợ; người kiểm tra xác nhận kết luận/finding.
- Assessment sign-off được khóa.
- Decision Log lưu lịch sử quyết định.
- Cloud sync qua Vercel API + Neon khi có `DATABASE_URL`.
- Nếu database chưa cấu hình hoặc mất kết nối, app giữ local fallback để tránh mất dữ liệu.
- Có optimistic version control để không ghi đè im lặng khi hai phiên cùng chỉnh sửa.
- Normalized PostgreSQL schema cho 22 domain object đã có tại `db/schema.sql`.

## Chạy QA

```bash
npm run qa
```

QA build frontend, kiểm logic domain, schema, cloud sync, conflict control và syntax serverless API.

## Tài liệu

- [Domain Model v0.1](docs/domain-model-v0.1.md)
- [Production v1](docs/PRODUCTION-v1.md)
- [QA Production v1](docs/QA-PRODUCTION-v1.md)

## Trạng thái kiểm soát

Đây là **Production Candidate**, chưa được gọi là production multi-user hoàn chỉnh cho đến khi hoàn tất:
authentication/SSO, file storage thực cho Evidence, database environment trên Vercel, AI multimodal thật và E2E production.
