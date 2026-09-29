# QA – MVP v0.1

## Kết quả kiểm tra
- [x] Luồng: Khung tuân thủ → Assessment → Requirement Assessment.
- [x] Rule phạm vi: để trống = toàn bộ requirement assessable.
- [x] Upload evidence tạo Evidence/Revision/Link.
- [x] AI proposal không tự tạo finding chính thức.
- [x] Finding phải do người kiểm tra xác nhận.
- [x] Finding → Remediation Action → Verification → Close.
- [x] Coverage tách khỏi Compliance Result.
- [x] QA Check trong app kiểm tra liên kết dữ liệu lõi.
- [x] Responsive desktop/mobile.
- [x] Demo data có cảnh báo, không trình bày như dữ liệu thực tế.

## Giới hạn MVP
- Persistence đang dùng localStorage trên trình duyệt; chưa phải database dùng chung.
- AI hiện là rule-based screening để kiểm thử human-in-the-loop; chưa kết nối LLM/API.
- Chưa có SSO/RBAC thực, backend file storage và audit log bất biến phía server.

Các giới hạn trên là backlog cho Production v1, không bị che giấu trong giao diện.
