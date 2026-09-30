# AgriS Compliance Assessment App — Product & Technical Blueprint

**Phiên bản:** v0.8  
**Trạng thái:** WORKING BASELINE — NOT LOCKED  
**Ngày cập nhật:** 30/09/2026  
**Hệ thống cha:** AgriS CMS System Blueprint v0.1 — APPROVED & LOCKED  
**System Owner nghiệp vụ:** RPC Compliance

> Mục đích: hợp nhất kiến trúc nghiệp vụ, mô hình dữ liệu, workflow, kiến trúc công nghệ, cơ chế kiểm soát và lộ trình phát triển của Compliance Assessment App.

## 1. Định vị sản phẩm

Compliance Assessment App là ứng dụng số hóa một phần trọng yếu của CMS AgriS, tập trung vào chuỗi:

**Nguồn nghĩa vụ → Nghĩa vụ tuân thủ → Khung tuân thủ → Chương trình/Cuộc đánh giá → Yêu cầu đánh giá → Bằng chứng → Phát hiện → Phản hồi đơn vị → Hành động khắc phục → Xác minh hiệu lực → Báo cáo quản trị.**

Ứng dụng không thay thế toàn bộ CMS. Ứng dụng hiện thực trước các cấu phần của CMS Blueprint gồm Compliance Obligation Universe, Monitoring & Testing, Evidence Management, Issue/CAPA/Escalation và Data/Dashboard. Các cấu phần KCI, Speak-up, Investigation, COI, Training/Culture vẫn thuộc CMS tổng thể và chỉ tích hợp khi có nhu cầu.

Nguyên tắc kế thừa từ CMS Blueprint:
- Line 1 sở hữu nghĩa vụ, kiểm soát, bằng chứng và hành động khắc phục.
- RPC Compliance là tuyến 2, thiết kế phương pháp, kiểm tra, challenge, kết luận theo thẩm quyền và giám sát khắc phục.
- Quản lý dựa trên nghĩa vụ và bằng chứng, không chỉ checklist.
- AI hỗ trợ phân tích/gợi ý; con người xác nhận nghĩa vụ pháp lý, kết luận vi phạm và quyết định xử lý.

## 2. Mục tiêu sản phẩm

Ứng dụng phải giúp AgriS trả lời được:
- Nguồn quy định nào đang áp dụng và vòng đời của nguồn đó.
- Nghĩa vụ tuân thủ nào áp dụng cho đơn vị/quy trình/hoạt động/địa điểm.
- Cuộc đánh giá nào đang được thực hiện, bởi ai, trong kỳ nào và tiến độ ra sao.
- Mỗi yêu cầu đã được kiểm tra chưa, kết quả gì, dựa trên bằng chứng nào.
- Phát hiện nào đang dự thảo, chờ phản hồi, đã chốt hoặc đã đóng.
- Hành động khắc phục nào đang mở, quá hạn, đã nộp bằng chứng và chờ xác minh.
- Vấn đề nào cần báo cáo/chuyển cấp theo đơn vị, mức độ, kỳ và xu hướng.
- Dữ liệu nào có thể dùng cho dashboard quản trị và báo cáo định kỳ.

## 3. Phạm vi chức năng V1

### 3.1. Điều hành
- KPI quản trị: cuộc đánh giá đang mở, coverage, phát hiện mở, phát hiện mức cao/nghiêm trọng, hành động quá hạn, chờ xác minh.
- Điểm cần xử lý.
- Tình hình theo đơn vị.
- Tiến độ đánh giá.
- Thông báo/chuyển cấp.
- Tìm kiếm toàn hệ thống.

### 3.2. Nguồn & Khung tuân thủ
- Tiếp nhận nguồn bằng file hoặc văn bản.
- Metadata vòng đời nguồn: mã nguồn, loại nguồn, cơ quan ban hành, ngày ban hành, ngày hiệu lực, ngày hết hiệu lực, version, nguồn thay thế/thay thế nguồn nào, owner.
- Bóc tách nghĩa vụ dự thảo.
- Bulk review nghĩa vụ.
- Một cấp duyệt để đưa yêu cầu vào trạng thái hiệu lực.
- Liên kết Requirement với Source/Clause.
- Khung tuân thủ và version.

### 3.3. Chương trình đánh giá
- Tạo Assessment theo khung, đơn vị, quy trình, hoạt động, địa điểm, kỳ.
- Người phụ trách, reviewer, đại diện đơn vị.
- Tự xác định Requirement theo phạm vi áp dụng.
- Theo dõi trạng thái và tiến độ.

### 3.4. Kiểm tra hiện trường
- Requirement Assessment theo từng yêu cầu.
- Kết quả chuẩn: Tuân thủ / Tuân thủ một phần / Không tuân thủ / Không áp dụng / Chưa đủ bằng chứng.
- Ghi nhận observation.
- Upload bằng chứng.
- AI proposal chỉ là gợi ý, không phải kết luận chính thức.

### 3.5. Phát hiện
Workflow được chốt:

**Draft Finding → Unit Response → Final Review → Final Finding / Dismissed.**

Finding gồm tối thiểu: tiêu chí, dữ kiện, gap, tác động/rủi ro, severity, recommendation, phản hồi đơn vị, disposition và người chốt.

### 3.6. Khắc phục
- Một Finding có thể có nhiều Action.
- Action có Owner, due date, trạng thái, tiến độ.
- Bắt buộc có Closure Evidence trước khi submit verification.
- Người chịu trách nhiệm Action không được tự xác minh.
- Verification: Effective → Closed; Ineffective → Reopened.
- Finding chỉ đóng khi các Action liên quan đã được xử lý theo điều kiện đóng.

### 3.7. Báo cáo
- Báo cáo theo đơn vị, kỳ, severity, trạng thái, tiến độ khắc phục.
- CSV/JSON/PDF/print.
- Dữ liệu báo cáo phải tuân thủ Org Scope của người dùng.
- Giai đoạn tiếp theo bổ sung trend, aging, repeat finding và comparison.

### 3.8. Quản trị hệ thống
- Người dùng, role, phạm vi đơn vị.
- Notification/escalation setting.
- Production readiness.
- Data mode.
- Các cấu hình kỹ thuật chỉ hiển thị ở khu vực quản trị, không đưa vào màn nghiệp vụ phổ thông.

## 4. Các quyết định nghiệp vụ đã chốt

- Finding: Draft → Unit Response → Final.
- Assessment Scope: mô hình C — Org + Process + Activity + Location tự xác định Requirement; cho phép override có kiểm soát.
- Requirement/Framework: một cấp phê duyệt.
- Verification: độc lập với Action Owner.
- ExistingControl tách biệt với RemediationAction.
- Workflow status tách biệt với Compliance Result.
- Assessment sau sign-off phải được khóa.
- Evidence quản lý theo revision và không sửa ngược lịch sử.
- Decision Log theo nguyên tắc append-only.
- Không nhân bản ERM/risk acceptance vào app đánh giá tuân thủ.

## 5. Mô hình dữ liệu cốt lõi

### Master Data
1. OrgUnit
2. Actor/User
3. ComplianceSource
4. ComplianceFramework
5. ComplianceRequirement
6. ControlReference
7. ExistingControl

### Transaction Data
8. AssessmentProgram
9. ComplianceAssessment
10. AssessmentScope
11. AssessmentAssignment
12. RequirementAssessment
13. Finding
14. UnitResponse
15. RemediationAction
16. Verification
17. ComplianceException

### Evidence Data
18. Evidence
19. EvidenceRevision
20. EvidenceLink

### Governance Data
21. AIAnalysisProposal
22. DecisionLog

Quan hệ cốt lõi:
- Source → Requirement
- Framework ↔ Requirement
- Assessment → Scope → RequirementAssessment
- RequirementAssessment → Finding
- Finding → UnitResponse
- Finding → RemediationAction
- RemediationAction → Verification
- Evidence → EvidenceRevision → EvidenceLink → đối tượng nghiệp vụ
- AIAnalysisProposal → đối tượng cần review
- Major Object → DecisionLog

## 6. Kiến trúc ứng dụng

### 6.1. Kiến trúc logic
Browser UI  
→ API layer  
→ Authentication & Authorization  
→ Normalized PostgreSQL  
→ Private Evidence Storage  
→ Notification/Reporting  
→ AI/OCR/Legal Search adapters theo lộ trình.

### 6.2. Technology Stack hiện hành
- Frontend: modular web application, hiện tách index shell + `src/app.js` + `src/styles/app.css`.
- Hosting/API: Vercel.
- Authentication: Clerk.
- Database: Neon PostgreSQL.
- Evidence Storage: Vercel Blob Private, OIDC.
- Source control/CI: GitHub + GitHub Actions.
- Data mode production: normalized.
- AI extraction hiện tại: rule-based foundation; LLM/OCR production chưa bật.
- Legal search: chưa kết nối provider chính thức.

### 6.3. Nguyên tắc kỹ thuật
- Server-side authorization bắt buộc; không dựa vào việc ẩn nút trên UI.
- Mọi truy cập phải kiểm tra Role + Org Scope.
- Evidence private; metadata và liên kết được lưu trong DB.
- Closure evidence bắt buộc trước verification.
- Không cho self-verification.
- Không lưu secret trong GitHub hoặc Google Drive.
- Environment secrets chỉ lưu trong nền tảng triển khai/secret store.

## 7. Authentication & Access Model

Role hiện hành:
- `compliance_admin`
- `compliance_manager`
- `lead_assessor`
- `assessor`
- `reviewer`
- `unit_owner`
- `viewer`

Access model production:
- Clerk Production dùng email authentication.
- Do Clerk Free không hỗ trợ Invite-only production theo cấu hình hiện tại nếu không có custom domain và Allowlist là tính năng trả phí, app sử dụng Clerk Open sign-up kết hợp server-side pre-provisioning.
- Admin cấp trước quyền theo email + role + org scope trong `app_users`.
- Người dùng tự đăng ký/đăng nhập Clerk bằng đúng email.
- Backend chỉ cấp quyền khi email là bootstrap admin hoặc đã được pre-provision.
- Tài khoản Clerk không được provision bị chặn ở `USER_NOT_PROVISIONED`.
- Bootstrap admin chỉ dùng để khởi tạo hệ thống; sau khi vận hành ổn định nên chuyển hoàn toàn sang quản trị user/role trong hệ thống.

## 8. Hạ tầng Production

### Vercel Project
- `compliance-assessment-app`
- Production domain chính: https://compliance-assessment-app-ntphuong130487.vercel.app
- Function region: `sin1`

### Neon
- PostgreSQL production tại Singapore.
- Canonical schema đã migrate.
- `DATA_MODE=normalized`.

### Vercel Blob
- Private Blob Store đã kết nối.
- Evidence storage dùng OIDC.
- Không yêu cầu `BLOB_READ_WRITE_TOKEN` tĩnh trong kiến trúc mới.

### Clerk
- Production instance đã tạo.
- Production keys đã cập nhật trong Vercel.
- Access mode: Open sign-up + backend pre-provision authorization.

**Lưu ý trạng thái tại ngày 30/09/2026:**
- Vercel Hobby đã chạm giới hạn deployment trong ngày.
- Các thay đổi production mới nhất đang chờ deployment sau khi quota reset.
- Không được coi multi-user production regression là hoàn tất cho đến khi deployment mới được phát hành và smoke test đạt.

## 9. QA & Control Gates

Các gate bắt buộc:
- GitHub CI syntax + business QA.
- Domain/workflow regression.
- Server-side role permission.
- Org Scope.
- Source/Requirement traceability.
- Finding draft-response-final.
- Closure evidence gate.
- Independent verification.
- Reporting scope.
- Auth readiness.
- Database readiness.
- Blob readiness.
- Multi-user regression trước khi xác nhận production-ready.

## 10. Trạng thái phát triển

### Đã hoàn thành nền
- Domain Model 22 objects.
- Core business workflow.
- P0/P1 Business QA chính.
- Dashboard/search/filter/report export foundation.
- Notification/escalation foundation.
- Neon normalized schema và production database.
- Clerk production foundation.
- Vercel Blob private foundation.
- Server-side authorization.
- CI/QA gates.

### Đang hoàn thiện
- Deployment production mới nhất.
- Bootstrap admin login với Clerk Production.
- Multi-user regression thực tế.
- UI productization theo 6 màn mockup.

### Chưa triển khai production
- OCR thật cho PDF scan/ảnh.
- LLM-based obligation extraction.
- Multimodal evidence analysis.
- Regulatory/legal search provider.
- Advanced analytics: aging, repeat finding, trend/comparison.
- Notification runner server-side hoàn chỉnh.

## 11. UI Target V1

Sáu nhóm màn hình mục tiêu:
1. Điều hành.
2. Nguồn & Khung tuân thủ.
3. Chương trình đánh giá.
4. Kiểm tra hiện trường.
5. Phát hiện & Khắc phục.
6. Báo cáo.

Phong cách:
- Bám thiết kế hiện tại của app.
- Sidebar xanh đậm.
- Nền sáng trung tính.
- Card trắng bo nhẹ.
- Màu nhận diện AgriS xanh lá + xanh dương.
- Tiếng Việt là ngôn ngữ mặc định.
- Thuật ngữ kỹ thuật chỉ hiển thị trong khu vực quản trị khi cần.

## 12. Lộ trình tiếp theo

### Gate A — Production activation
1. Redeploy sau reset quota.
2. Kiểm tra `/api/readiness`.
3. Đăng ký bootstrap admin.
4. Xác nhận `compliance_admin`.
5. Chạy multi-user regression theo các role.
6. Kiểm tra Blob upload/download private.
7. Xử lý lỗi và chốt Production Core.

### Gate B — UI Productization
1. Dashboard quản trị.
2. Source/Framework workspace.
3. Assessment planning.
4. Fieldwork/evidence workspace.
5. Finding/Action workspace.
6. Reporting hub.
7. Admin console.

### Gate C — Compliance Intelligence
1. OCR production.
2. LLM obligation extraction.
3. Multimodal evidence review.
4. Requirement mapping.
5. AI drafting Finding/Recommendation.
6. Regulatory change impact.
7. Legal search integration.

## 13. Quy tắc Source of Truth & nơi lưu

### Google Drive = nguồn quản trị/nghiệp vụ
- Blueprint được người dùng đọc, review, phê duyệt.
- Quyết định nghiệp vụ, quy trình vận hành, hướng dẫn sử dụng, tài liệu quản trị.
- Không lưu secret/API key/password.

### GitHub = nguồn kỹ thuật
- Source code.
- Schema/migration.
- API.
- Tests/CI.
- Technical docs.
- Change history.
- Không commit secret.

### Vercel/Clerk/Neon/Blob = nguồn cấu hình runtime
- Vercel: deployment/env.
- Clerk: identity/authentication.
- Neon: normalized operational data.
- Blob: evidence file.
- Không sao chép secret vào Drive/GitHub.

## 14. Vị trí lưu chuẩn

### Google Drive
`P01_AgriS_RPC_Core_Systems → 03_CMS → 01_BLUEPRINT → AgriS_Compliance_Assessment_App_Blueprint_v0.8_WORKING_BASELINE`

### GitHub
Repository: `ntphuong130487-wq/Compliance-Assessment-App`  
Path: `docs/MASTER-BLUEPRINT-v0.8.md`

Tài liệu cha tham chiếu: `AgriS_CMS_System_Blueprint_v0.1_APPROVED_LOCKED`.

## 15. Nguyên tắc Version Control

- v0.x: Working baseline, có thể điều chỉnh theo QA/pilot.
- Chỉ gắn APPROVED khi người có thẩm quyền xác nhận.
- Chỉ gắn LOCKED khi baseline đã được chốt và thay đổi phải qua change control.
- Thay đổi nghiệp vụ trọng yếu phải ghi Decision Log.
- Google Drive và GitHub phải cùng version blueprint.
- Không tự nâng version hoặc trạng thái APPROVED/LOCKED nếu chưa có xác nhận.

## 16. Kết luận

Compliance Assessment App là lớp thực thi số của một phần CMS, không phải một hệ thống tuân thủ độc lập tách khỏi CMS AgriS.

Kiến trúc mục tiêu:

**Nguồn → Nghĩa vụ → Phạm vi áp dụng → Đánh giá → Bằng chứng → Phát hiện → Phản hồi → Khắc phục → Xác minh → Dashboard/Báo cáo.**

Điểm kiểm soát xuyên suốt: **human confirmation, evidence-first, server-side authorization, org scope, audit trail, version control và independent verification.**

Blueprint này là **WORKING BASELINE** để tiếp tục phát triển sản phẩm; không thay thế CMS Blueprint v0.1 APPROVED & LOCKED.
