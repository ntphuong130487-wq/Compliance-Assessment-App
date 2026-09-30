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
| Chương trình đánh giá | Compliance manager/Lead assessor | draft / fieldwork / review / closed | Owner, reviewer, kỳ, phạm vi, requirement set | Có nền; lifecycle assessment cần hoàn thiện tiếp |
| Phạm vi | Assessment owner | active theo assessment | Đơn vị + quy trình + hoạt động + địa điểm; org scope | Có |
| Điểm kiểm tra | Assessor | to_do → in_review → done | Result taxonomy được kiểm soát backend | Đã siết |
| Bằng chứng | Assessor/Action owner | active + revision | Auth, org scope, private storage, immutable history | Có và đã harden |
| Phát hiện | Assessor/Reviewer | pending_unit_response → pending_final_review → final/dismissed → closed | Không bỏ qua phản hồi/final review; chỉ final mới giao action | Đã siết |
| Phản hồi đơn vị | Unit owner | recorded | Chỉ phản hồi khi Finding đang chờ đơn vị | Đã siết |
| Hành động khắc phục | Action owner | open/reopened → submitted_for_verification → closed/reopened | Owner bắt buộc; closure evidence; không tự verify | Đã siết |
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

Gap:
- Chưa có workflow chuyển trạng thái assessment ở backend.
- Chưa có freeze/lock scope sau khi bắt đầu fieldwork.
- Chưa có RACI/assignment theo từng assessor hoặc requirement.
- Chưa có close gate của assessment.

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

Gap:
- Cần tách rõ `Khuyến nghị` và `Yêu cầu khắc phục bắt buộc`.
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

Gap:
- Chưa có request extension/change due date workflow.
- Chưa có action progress update có audit trail.
- Chưa có escalation owner/cấp quản lý theo rule.

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
1. Assessment lifecycle: draft → fieldwork → review → closed.
2. Scope freeze sau khi bắt đầu.
3. Assessment close gate.
4. Tách Recommendation và Mandatory Remediation.
5. Action progress / due-date change audit.
6. Reviewer sign-off.

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
