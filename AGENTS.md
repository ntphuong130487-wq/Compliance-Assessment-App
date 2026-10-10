# AGENTS.md — AgriS Compliance Assessment App

Tệp này là chỉ dẫn bắt buộc cho mọi AI agent làm việc trên repo. Hiện trạng chi tiết và backlog nằm trong [`docs/TAKEOVER.md`](docs/TAKEOVER.md).

## Định vị sản phẩm

Đây là lớp thực thi số của một phần CMS AgriS, theo chuỗi: Nguồn → Nghĩa vụ → Phạm vi áp dụng → Đánh giá → Bằng chứng → Phát hiện → Phản hồi → Khắc phục → Xác minh → Báo cáo.

App **không** phải hệ thống tuân thủ độc lập. Các module KCI, Speak-up, Investigation, XĐLI và Training chỉ được tích hợp khi chủ dự án yêu cầu.

## Blueprint chi phối

| Tài liệu | Trạng thái | Vai trò |
| --- | --- | --- |
| [AgriS RPC Core Management System Blueprint v0.3](https://docs.google.com/document/d/1fNozm9l5XzIm6eJahxxMYm6B_RlimTFwV9kEaTEJQXk/edit) | APPROVED — LOCKED | Nguyên tắc chung ERM–PMS–CMS |
| [AgriS CMS System Blueprint v0.1](https://docs.google.com/document/d/1xrSF3i0zvKGnxJD8VSeNSXOfXf8CFw1ANWa2dj8__rc/edit) | APPROVED — LOCKED | Hệ thống cha |
| [Compliance Assessment App Blueprint v0.8](https://docs.google.com/document/d/1anmxCvm_13eeXHmnqOtV0sD8aYsfnAa6o_OTU6jfvIs/edit) (bản sao: `docs/MASTER-BLUEPRINT-v0.8.md`) | WORKING BASELINE | Baseline sản phẩm |

## Quyết định nghiệp vụ đã chốt (không tự thay đổi)

- Finding: Draft → Unit Response → Final Review → Final / Dismissed.
- Assessment Scope mô hình C (Org + Process + Activity + Location), cho phép override có kiểm soát.
- Requirement/Framework một cấp phê duyệt.
- Verification độc lập với Action Owner; bắt buộc Closure Evidence trước khi xác minh.
- Workflow status tách khỏi Compliance Result. Assessment bị khóa sau sign-off.
- Evidence quản lý theo revision. Decision Log append-only.
- Không đưa ERM/risk acceptance vào app này.
- **Cổng xác nhận nghĩa vụ (quyết định ngày 10/10/2026):** giai đoạn đầu do **RPC xác nhận** nghĩa vụ có hiệu lực và áp dụng. Trường Legal (Legal Source, Effective Date, Legal Reviewer, Impacted Entity, Impacted Process, Required Action, CMS Update Status) được thiết kế sẵn, để trống kèm ghi chú cho đến khi Legal tham gia. Căn cứ: CMS Blueprint mục 5 và 19.
- AI chỉ đề xuất. AI không xác nhận nghĩa vụ pháp lý, không kết luận vi phạm, không quyết định CAPA.

## Quy tắc kỹ thuật riêng của repo

- Phân quyền bắt buộc ở server (`lib/server-authz.js`). Không dựa vào việc ẩn nút trên UI. Mọi truy cập kiểm tra Role + Org Scope.
- `lib/server-authz.js` là nguồn duy nhất của ma trận quyền. Không khai báo thêm ở nơi khác.
- Migration chạy thử trên Neon branch clone trước. Agent không tự áp lên production.
- Chạy test: `npm test` và các bộ trong `.github/workflows/qa.yml`. Test mới cho `api/v1/commands.js` phải chạy trên PostgreSQL thật (service trong CI).

## Quy tắc bắt buộc cho mọi agent (Claude, Codex, Gemini)

### 1. Nguồn chuẩn và xử lý mâu thuẫn

Thứ tự ưu tiên khi các nguồn khác nhau:

1. Blueprint có trạng thái APPROVED/LOCKED trên Google Drive (link ở phần đầu tệp này).
2. Release record đã được phê duyệt.
3. `docs/TAKEOVER.md` của repo này.
4. Code hiện tại.
5. Tài liệu working/dự thảo.
6. Nội dung hội thoại chưa được lưu thành tài liệu.

Khi blueprint và code mâu thuẫn:

- Mặc định làm theo blueprint.
- Nếu agent cho rằng cách làm trong code tối ưu hơn: **dừng lại**, mô tả hai phương án và hệ quả, rồi hỏi chủ dự án. Không tự chọn.
- Không sửa nội dung của bản đã LOCKED. Thay đổi nghiệp vụ phải được đề xuất thành version mới, kèm ghi chú cho Decision Log.

### 2. Chín quy tắc kỹ thuật kế thừa từ blueprint

1. **Human-in-command.** Mọi trạng thái chốt, phê duyệt, phát hành, chấp nhận rủi ro hay đóng hành động phải gắn danh tính người thật và được xác thực ở server. Không endpoint tự động nào được đặt các trạng thái này.
2. **Không tự tạo dữ liệu.** Không hard-code ngưỡng, KRI target, SLA, owner hay số liệu. Trường chưa có dữ liệu ghi `unknown` hoặc `pending`.
3. **Evidence-based.** Mọi kết luận và trạng thái đóng phải trỏ tới bằng chứng truy xuất được (ID, hash, thời điểm).
4. **Tách dữ kiện, nhận định và hành động** trong mô hình dữ liệu. AI chỉ được ghi vào trường đề xuất.
5. **Line 1 sở hữu; RPC là tuyến 2.** Người thực hiện không tự xác minh. RPC không đóng thay hành động của Line 1.
6. **Controlled source và version.** Production chỉ chạy bản có release record. GitHub là nguồn kỹ thuật; Google Drive là nguồn nghiệp vụ; hai bên phải cùng version.
7. **Data-first.** Ưu tiên schema, master data và audit trail trước tính năng AI hay dashboard.
8. **Phát triển theo mức.** Thủ công → batch/scheduled → tích hợp → điều phối. Không xây tầng điều phối khi tầng dưới chưa vận hành.
9. **Kiểm soát tương xứng rủi ro.** Đầu ra cho HĐQT, CEO, pháp lý hay tài chính phải có QA độc lập và phê duyệt.

### 3. Những việc agent không được tự làm

- Merge PR; deploy, promote hoặc rollback production.
- Tạo, sửa, xóa biến môi trường hoặc secret; đọc giá trị secret.
- Chạy migration trên database production.
- Xóa dữ liệu, branch, release hoặc tệp của người dùng.
- Bật dịch vụ trả phí hoặc thay đổi gói dịch vụ.
- Thay đổi branch protection, visibility của repo hoặc quyền truy cập.

### 4. Quy trình làm việc

- Một hạng mục backlog tương ứng một branch và một PR nhỏ. Tên branch dạng `<loại>/<mô-tả-ngắn>`, ví dụ `fix/notification-normalized`.
- Mô tả PR gồm: Mục tiêu; Fact đã kiểm chứng; Thay đổi; Test đã chạy; Rủi ro; Cách rollback; Việc cần chủ dự án phê duyệt.
- Mọi control phải có **test hành vi**, gồm cả test âm (bị chặn) và test dương (được phép). Test chỉ kiểm tra sự tồn tại của chuỗi ký tự trong mã không được tính là bằng chứng control hoạt động.
- CI phải xanh trước khi yêu cầu review.
- Khi báo cáo trạng thái, dùng: Verified / Implemented, not verified / Planned / Unknown. Không quy đổi thành phần trăm hoàn thành.

### 5. Definition of Done

- Đúng phạm vi hạng mục; không kèm thay đổi ngoài phạm vi.
- Test hành vi mới hoặc cập nhật; toàn bộ test và CI pass.
- `docs/TAKEOVER.md` được cập nhật (hiện trạng, backlog).
- Nếu thay đổi nghiệp vụ: nêu mục blueprint bị ảnh hưởng và đề xuất nội dung cập nhật cho bản trên Drive.
- PR ghi rõ cách rollback.

### 6. Khi nào phải hỏi chủ dự án

Quyền truy cập, chi phí, secrets, quyết định kiến trúc, mọi thay đổi production, mâu thuẫn với blueprint, và dữ liệu thật hoặc nhạy cảm.

### 7. Ngôn ngữ

Tài liệu và PR viết bằng tiếng Việt; thuật ngữ chuyên ngành ghi song ngữ Anh–Việt. Commit message có thể viết bằng tiếng Anh.
