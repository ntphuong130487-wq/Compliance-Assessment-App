# AgriS Compliance Assessment App

Ứng dụng phục vụ lập kế hoạch, thực hiện, rà soát và theo dõi khắc phục đối với hoạt động kiểm tra/đánh giá tuân thủ.

## Baseline kiến trúc

- **Domain Model v0.1** — 22 object lõi, phân loại Master / Transaction / Evidence / Governance.
- Nguyên tắc: Khung tuân thủ → Yêu cầu tuân thủ → Chương trình đánh giá → Bằng chứng → Kết quả → Phát hiện → Hành động → Xác minh → Đóng.
- AI chỉ **đề xuất** nhận định/finding; kết quả chính thức phải được con người xác nhận.
- Không có mô tả giới hạn phạm vi thì mặc định toàn bộ yêu cầu có thể đánh giá trong khung thuộc phạm vi.
- Bằng chứng được quản lý theo phiên bản; không ghi đè lịch sử.

Chi tiết: [docs/domain-model-v0.1.md](docs/domain-model-v0.1.md)
