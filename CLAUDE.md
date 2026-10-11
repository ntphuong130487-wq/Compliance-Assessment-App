# CLAUDE.md — hướng dẫn Claude tiết kiệm ngữ cảnh

**Bắt buộc:** đọc `AGENTS.md` trước; file đó chứa đầy đủ quy tắc, baseline, human gates và ưu tiên nguồn. Không thay thế hay làm yếu quy tắc trong `AGENTS.md`.

@AGENTS.md

## Bắt đầu một phiên
1. Đọc [PROJECT_STATUS.md](PROJECT_STATUS.md) (snapshot ngắn), rồi [NEXT_ACTIONS.md](NEXT_ACTIONS.md) (backlog).
2. Chỉ mở [docs/TAKEOVER.md](docs/TAKEOVER.md) hoặc các blueprint liên quan khi cần xác minh chi tiết, xử lý mâu thuẫn hoặc thay đổi thuộc phạm vi bị khóa. Tài liệu status có ngày chốt, không thay thế kiểm tra code/CI/runtime mới.
3. Xác nhận **một nhiệm vụ**, nhánh, file/module chịu tác động và tiêu chí nghiệm thu. Chỉ tra cứu log, PR, file và code liên quan trực tiếp; không quét lại toàn repository mặc định.

## Trong phiên — tối ưu hạn mức Claude Pro
- Sonnet/effort thấp hoặc vừa cho tác vụ nhỏ; chỉ nâng effort/model khi có nguyên nhân cụ thể và công cụ cho phép.
- Không dùng nhiều subagent, web, connector hoặc điều tra chéo repo nếu không thật sự cần. Nếu cần mở rộng đáng kể, xin phép trước.
- Thực hiện thay đổi nhỏ có test phù hợp. Không hy sinh bảo mật, kiểm soát, traceability, QA gate hoặc nguyên tắc owner approval để tiết kiệm token.
- Không sửa blueprint LOCKED, tự merge, deploy production, phát sinh phí, xóa dữ liệu hay nâng scope khi chưa được chủ dự án duyệt.
- Phân biệt **code có tồn tại / test PASS / preview / production được xác minh**. Không tự đặt % hoàn thành hoặc owner.

## Kết thúc phiên
Báo ngắn: mục tiêu, file và commit/PR thay đổi, test PASS/FAIL/BLOCKED, bằng chứng, blocker và **một bước tiếp theo**.
Đề xuất cập nhật PROJECT_STATUS.md / NEXT_ACTIONS.md bằng PR nếu trạng thái thay đổi; không tự sửa trạng thái đã khóa hoặc tuyên bố production ready.
Chuyển sang nhiệm vụ khác: lưu handoff, mở phiên mới hoặc `/clear`; dùng `/compact` nếu tiếp tục cùng nhiệm vụ dài.
