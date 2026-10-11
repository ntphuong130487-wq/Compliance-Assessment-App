# NEXT_ACTIONS — Compliance Assessment App
| Ưu tiên | Hành động | Owner / Gate | Tiêu chí nghiệm thu |
|---|---|---|---|
| P0 | Chuyển repo public → private, kiểm tra Vercel tiếp tục deploy | Chủ dự án thay đổi quyền | Repo không public; deployment vẫn có kiểm chứng |
| P0 | Tách release branch production khỏi main | Chủ dự án cấu hình Vercel | Main không tự deploy production |
| P1 | Sửa notifications dùng normalized schema và xem cron feasibility | Agent PR; owner duyệt scheduling | PostgreSQL integration tests, no old state table |
| P1 | Test hành vi commands, RBAC/org scope/closure rules | Agent PR | Negative/positive tests trong CI |
| P1 | Full migration CI từ DB trống, thử idempotence | Agent PR | Chuỗi migration và 3 lần chạy liên tiếp PASS |
| P1 | Review PR #4 Obligation v2, RPC legal applicability gate | Agent; RPC duyệt; owner merge | Obligation chưa được RPC xác nhận không vào Assessment; chưa apply prod migration |
| P2 | Hợp nhất RBAC ở `lib/server-authz.js` | Agent PR | Test đối chiếu roles/org scope |
| P2 | PR #1 cũ, branch cũ, env example, blueprint domain | Owner quyết định dọn dẹp | Không xóa trước khi được phê duyệt |
Xem [docs/TAKEOVER.md](docs/TAKEOVER.md), tuân thủ human review và evidence revisions.
