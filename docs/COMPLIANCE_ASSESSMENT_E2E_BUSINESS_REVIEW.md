# Compliance Assessment — E2E Business Model Review v1.0

Branch: `feature/product-v1-ui-ai`  
Scope: Product v1 business process, owner, state, data, control and reporting review.

## 1. Business flow

`Nguồn/Khung tuân thủ → Nghĩa vụ/Điểm kiểm tra → Chương trình đánh giá → Phạm vi → Kiểm tra thực địa → Bằng chứng → Kết quả đánh giá → Phát hiện/Vi phạm → Phản hồi đơn vị → Chốt phát hiện → Hành động khắc phục → Bằng chứng hoàn thành → Xác minh độc lập → Đóng → Báo cáo`

Nguyên tắc:
- AI/OCR chỉ hỗ trợ bóc tách, phân tích và đề xuất; không tự xác nhận nghĩa vụ, kết quả tuân thủ, phát hiện hoặc đóng hành động.
- Mọi đối tượng nghiệp vụ phải có owner, trạng thái, điều kiện chuyển trạng thái, dữ liệu tối thiểu và audit trail.
- UI không phải control. Các control trọng yếu phải được kiểm tra ở backend.
- Bằng chứng không ghi đè lịch sử; quản lý theo revision.
- Phạm vi tổ chức được kiểm soát theo user + org scope.

## 2. Object / Owner / State / Control matrix

| Đối tượng | Owner chính | Trạng thái chính | Điều kiện/control trọng yếu | Hiện trạng Product v1 |
|---|---|---|---|---|
| Nguồn tuân thủ | Compliance framework owner | draft → extracted → pending approval → published/effective | Nguồn, metadata, version, hiệu lực; auth trước OCR/AI | Có |
| Nghĩa vụ dự thảo | Compliance reviewer | draft → accepted/rejected → published | Human review bắt buộc; AI metadata/audit | Có |
| Yêu cầu tuân thủ | Framework approver | pending approval → effective/rejected | Một cấp duyệt; chỉ effective được đánh giá | Có |
| Chương trình đánh giá | Compliance manager/Lead assessor/Reviewer | draft → fieldwork → review → closed | Bắt đầu fieldwork khóa phạm vi; chỉ gửi review khi các điểm kiểm tra hoàn tất và không còn Finding chờ xử lý; reviewer/manager đóng | Đã triển khai |
| Phạm vi | Assessment owner | active theo assessment | Đơn vị + quy trình + hoạt động + địa điểm; org scope | Có |
| Điểm kiểm tra | Assessor | to_do → in_review → done | Result taxonomy được kiểm soát backend | Đã siết |
| Bằng chứng | Assessor/Action owner | active + revision | Auth, org scope, private storage, immutable history | Có và đã harden |
| Phát hiện | Assessor/Reviewer | pending_unit_response → pending_final_review → final/dismissed → closed | Không bỏ qua phản hồi/final review; tách Khuyến nghị cải thiện khỏi Yêu cầu khắc phục bắt buộc | Đã triển khai |
| Phản hồi đơn vị | Unit owner | recorded | Chỉ phản hồi khi Finding đang chờ đơn vị | Đã siết |
| Hành động khắc phục | Action owner | open/reopened → submitted_for_verification → closed/reopened | Phân loại mandatory_remediation / improvement_action; owner bắt buộc; closure evidence; không tự verify | Đã triển khai |
| Xác minh | Independent verifier | effective/ineffective | Verify độc lập; action phải đúng state; recheck closure evidence | Đã siết |
| Báo cáo | Compliance/RPC management | snapshot/report | Scope-aware; coverage tách khỏi compliance result | Có nền; cần nâng reporting quản trị |

## 3. Screen-by-screen review

### 3.1 Source & Obligation Workspace
Đã có:
- 3 cách tiếp nhận nguồn.
- OCR/document intelligence.
- AI extraction + confidence + human review.
- Audit trail cho review.
- Phê duyệt yêu cầu trước khi effective.

Cần tiếp tục:
- Version/supersession logic rõ hơn giữa nguồn cũ và nguồn thay thế.
- Cảnh báo nguồn sắp hết hiệu lực/hết hiệu lực.
- Quy tắc không cho framework effective chứa requirement chưa quyết định.

### 3.2 Assessment Planning
Đã có:
- Tên, mục tiêu, khung, đơn vị, quy trình, hoạt động, địa điểm, kỳ đánh giá.
- Lead assessor, reviewer, unit representative.
- Tự xác định requirement theo phạm vi.

Đã triển khai:
- Backend lifecycle: Draft → Fieldwork → Review → Closed.
- Bắt đầu Fieldwork ghi `locked_at` và khóa phạm vi/requirement set theo baseline.
- Submit for Review chỉ khi toàn bộ Requirement Assessment đã hoàn tất và không còn Finding ở trạng thái chờ xử lý.
- Close Gate chỉ thực hiện từ Review bởi vai trò có quyền review; việc đóng Assessment không bắt buộc các remediation action đã đóng.
- Mọi chuyển trạng thái được ghi vào `decision_logs`.

Đã triển khai thêm:
- Phân công 01 người kiểm tra chính cho từng Requirement Assessment.
- Chỉ người được phân công hoặc Trưởng đoàn/Quản lý có quyền điều phối mới được cập nhật kết quả, tạo Finding hoặc tải bằng chứng cho Requirement đó.
- Tất cả Requirement phải có người kiểm tra chính trước khi bắt đầu Fieldwork.
- Cho phép thay đổi phân công ở trạng thái Draft/Fieldwork; thay đổi được lưu decision log với người cũ → người mới.
- Fieldwork hiển thị rõ người kiểm tra chính và ưu tiên mở “việc của tôi” cho người dùng hiện tại.

Gap còn lại:
- Chưa có workflow mở lại Assessment sau khi đã đóng (nếu phát sinh ngoại lệ).
- Chưa dùng support assessor trong giao diện; data model đã chừa cấu trúc cho vai trò này.

### 3.3 Fieldwork & Evidence
Đã có:
- Requirement checklist.
- Result taxonomy.
- Observation.
- Evidence workspace.
- AI proposal.

Đã harden:
- Backend validate result/workflow taxonomy.
- Evidence private + org scope + safe inline policy.

Gap:
- Chưa bắt buộc reason khi dùng `not_applicable` hoặc `insufficient_evidence`.
- Chưa có sampling/test-step execution detail.
- Chưa có reviewer sign-off ở cấp requirement.

### 3.4 Findings
Đã có:
- Fact / Criteria / Gap / Risk impact / Severity / Recommendation.
- Unit Response.
- Final Review.
- Final/Dismissed state.
- Timeline.

Đã harden:
- Chỉ phản hồi khi `pending_unit_response`.
- Chỉ final review khi `pending_final_review`.
- Chỉ Final Finding mới được giao remediation action.

Đã triển khai:
- Tách `Khuyến nghị cải thiện` khỏi `Yêu cầu khắc phục bắt buộc`.
- Khi Finding yêu cầu khắc phục bắt buộc, reviewer phải nhập rõ nội dung yêu cầu khắc phục.
- Assessment không được gửi rà soát/đóng nếu còn Finding bắt buộc nhưng chưa có ít nhất một `mandatory_remediation` action.
- Finding không bắt buộc khắc phục vẫn có thể tạo `improvement_action` tự nguyện.

Gap:
- Cần duplicate/repeat finding linkage.
- Cần root cause chuẩn hóa để phục vụ phân tích xu hướng.

### 3.5 Remediation & Verification
Đã có:
- Owner, due date, aging.
- Closure evidence.
- Submit for verification.
- Independent verification.
- Reopen khi ineffective.

Đã harden:
- Owner + action text bắt buộc.
- Chỉ open/reopened mới submit.
- Closure evidence recheck tại verify.
- Action owner không tự verify.

Đã triển khai:
- Action Owner/đơn vị được phân quyền có thể cập nhật tiến độ 0–100% kèm ghi chú bắt buộc; mỗi lần cập nhật được ghi vào decision log.
- Tiến độ 100% không tự đóng Action; vẫn phải nộp bằng chứng hoàn thành và qua xác minh độc lập.
- Thay đổi hạn xử lý đi qua workflow: Request → Pending Approval → Approved/Rejected.
- Người đề nghị không được tự phê duyệt thay đổi hạn.
- Chỉ khi được phê duyệt hệ thống mới cập nhật Due Date; lý do đề nghị, người đề nghị, người duyệt và ý kiến quyết định đều được lưu vết.

Gap:
- Chưa có escalation owner/cấp quản lý theo rule.
- Chưa có cơ chế hủy đề nghị đổi hạn đang chờ.
- Chưa có policy về số lần gia hạn/ngưỡng gia hạn; cần AgriS xác nhận trước khi cấu hình.

### 3.6 Reporting
Đã có:
- Coverage.
- Result distribution.
- Finding/action summary.
- Export CSV/JSON/PDF.
- Scope-aware data.

Gap ưu tiên:
- Repeat finding.
- Aging bucket theo đơn vị/owner.
- Finding severity × status.
- Action overdue × owner/unit.
- Source/framework coverage.
- Trend theo kỳ.
- Báo cáo executive tách “mức hoàn tất đánh giá” khỏi “mức tuân thủ”.

## 4. Priority backlog

### P0 — trước production
1. Backend lifecycle gates cho Requirement Assessment / Finding / Action.
2. Evidence authorization, private storage, safe content rendering.
3. AI/OCR authorization + timeout + untrusted-source policy.
4. Production readiness + Neon clone migration + Blob smoke test.

### P1 — ngay sau production baseline
1. Workflow reopen Assessment có kiểm soát.
2. Reviewer sign-off nâng cao ở cấp requirement nếu cần.
3. Escalation rule cho Action quá hạn / nhiều lần xin đổi hạn.
4. Support assessor nếu vận hành thực tế cần nhiều người cùng kiểm tra một Requirement.

### P2 — quản trị nâng cao
1. Repeat finding analytics.
2. Root-cause taxonomy.
3. Escalation engine.
4. Management reporting theo unit/owner/framework/time.
5. Trend và recurrence analysis.

## 5. Definition of Done cho một cuộc đánh giá

Một assessment chỉ được coi là hoàn tất nghiệp vụ khi:
- phạm vi và requirement set đã xác định;
- mọi requirement trong phạm vi đã có kết quả cuối;
- mọi draft finding đã được xử lý thành final hoặc dismissed;
- phản hồi đơn vị và quyết định cuối được lưu vết;
- final findings đã có remediation action nếu yêu cầu xử lý;
- báo cáo đánh giá được hình thành từ dữ liệu đã chốt.

Việc đóng assessment không đồng nghĩa mọi remediation action phải hoàn thành; action có thể tiếp tục được theo dõi sau khi báo cáo đánh giá đã phát hành.
