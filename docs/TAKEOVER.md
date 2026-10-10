# Gói tiếp quản — Compliance Assessment App

Ngày lập: 10/10/2026. Căn cứ: audit danh mục GitHub ngày 10/10/2026 và đối chiếu với blueprint trên Google Drive.

## 1. Hiện trạng đã xác minh

| Hạng mục | Trạng thái | Bằng chứng |
| --- | --- | --- |
| Production | Đang chạy commit `2ef4519`; domain public `compliance-assessment-app-ashen.vercel.app`; `/api/readiness` trả `productionReady:true` | Vercel deployment `dpl_9Zpy3ABGts42E597vhEm2HZSsD5u` |
| Hạ tầng | Clerk, Neon (`DATA_MODE=normalized`) và Vercel Blob đã cấu hình | `/api/readiness` |
| AI extraction, OCR, nguồn tra cứu pháp lý | Chưa cấu hình (`not-configured`) | `/api/readiness`; `api/regulations/search.js` trả 501 |
| Test | 12/12 bộ pass. Phần lớn là kiểm tra chuỗi ký tự; browser test chạy ở chế độ demo | `tests/qa.mjs`, `tests/browser-server.mjs` |
| Branch protection `main` | Không bật; GitHub Free không hỗ trợ cho repo private (API trả 403) | GitHub API |
| Visibility repo | **Public** | GitHub |

Lưu ý: Blueprint v0.8 ghi domain production là `compliance-assessment-app-ntphuong130487.vercel.app`. Đây là alias của team và bị Vercel Authentication chặn. Domain thật là `-ashen`.

## 2. Phát hiện cần xử lý

| ID | Phát hiện | Mức |
| --- | --- | --- |
| C-01 | Repo public chứa blueprint nghiệp vụ và định danh hạ tầng | Cao |
| C-02 | `api/notifications/run.js` đọc bảng cũ `compliance_app_state` thay vì bảng normalized; `vercel.json` không có cron | Trung bình–Cao |
| C-03 | `api/v1/commands.js` (908 dòng chứa business rule) không có test hành vi | Trung bình |
| C-04 | Migration CI chỉ chạy 005–009 trên `schema.sql` của main, không chạy chuỗi đầy đủ từ DB trống; idempotence thiếu 009 | Trung bình |
| C-05 | Ma trận RBAC bị khai báo ở 3 nơi và đã lệch nhau | Thấp–Trung bình |
| C-06 | PR #4 (Obligation v2) chưa có cổng xác nhận nghĩa vụ theo CMS Blueprint | Trung bình |
| C-07 | PR #1 lỗi thời; các branch `production-v1*` bỏ dở; `.env.example` thiếu biến | Thấp |

## 3. Backlog

| P | ID | Hạng mục | Tiêu chí nghiệm thu | Thực hiện |
| --- | --- | --- | --- | --- |
| P0 | C-01 | Chuyển repo sang private | Repo private; Vercel vẫn deploy | Chủ dự án |
| P0 | — | Cổng phát hành không tốn phí: Vercel chỉ deploy production từ branch `production`; merge vào `main` chỉ tạo preview. Phát hành = PR từ `main` sang `production` do chủ dự án merge. (GitHub gói Free không hỗ trợ branch protection cho repo private.) | Merge vào `main` không làm thay đổi production | Chủ dự án (cấu hình Vercel); Agent tạo sẵn branch `production` |
| P1 | C-02 | Bộ nhắc việc đọc bảng normalized; thêm cron (giới hạn theo gói Vercel cần xác nhận) | Test trên Postgres: số liệu khớp dữ liệu seed | Agent (PR) |
| P1 | C-03 | Test hành vi cho các control: tự xác minh, thiếu closure evidence, sai org scope, sai trạng thái | Mỗi control có test âm và test dương, chạy trong CI | Agent (PR) |
| P1 | C-04 | Migration CI chạy chuỗi đầy đủ từ DB trống và kiểm tra idempotence | 3 lần chạy liên tiếp pass | Agent (PR) |
| P1 | C-06 | Bổ sung vào PR #4: cổng xác nhận nghĩa vụ do RPC thực hiện và các trường Legal để trống kèm ghi chú | Nghĩa vụ chưa được RPC xác nhận không vào được Assessment; test âm pass | Agent chuẩn bị; chủ dự án merge và áp migration |
| P2 | C-05 | Gom ma trận quyền về `lib/server-authz.js` | Test so khớp ma trận | Agent (PR) |
| P2 | C-07 | Đóng PR #1, archive branch cũ, bổ sung `.env.example`, sửa domain trong blueprint | — | Agent đề xuất; chủ dự án duyệt |

## 4. Việc cần chủ dự án quyết định

- Thực hiện C-01 và cấu hình Vercel chỉ deploy production từ branch `production`.
- Merge PR #4 sau khi C-06 hoàn tất; áp migration 010 lên Neon production.
- Bật cron cho production (cần xác nhận hạn mức của gói Vercel đang dùng).
