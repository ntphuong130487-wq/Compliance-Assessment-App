# CR-02 v2 – Assessment-scoped Source Planning & Compliance Obligation Extraction

**Trạng thái:** IMPLEMENTATION CANDIDATE  
**Cập nhật:** 2026-10-01  
**Thay thế logic CR-02 v1 về trình tự tiếp nhận nguồn và bóc nghĩa vụ.**

## 1. Nguyên tắc thiết kế

Không bắt đầu từ “một file bất kỳ → AI bóc nghĩa vụ”.

Luồng chuẩn là:

**Phạm vi cuộc đánh giá → Kế hoạch nguồn → Phân loại nguồn → Xác nhận liên quan/hiệu lực → Trích xuất nghĩa vụ → Human review → Phê duyệt → Yêu cầu tuân thủ hiệu lực → Eligibility theo phạm vi → Kiểm tra/Bằng chứng.**

Yêu cầu tuân thủ là đối tượng được kiểm tra. File/văn bản là nguồn hình thành hoặc hỗ trợ kiểm tra, không phải đối tượng đánh giá cuối cùng.

## 2. Phân loại nguồn

Mỗi nguồn phải được gắn với một ComplianceAssessment thông qua assessment_sources.

| Vai trò nguồn | Ví dụ | Được AI bóc nghĩa vụ? | Mục đích |
| --- | --- | ---: | --- |
| basis_external | Luật, nghị định, thông tư, tiêu chuẩn, cam kết bên ngoài | Có | Căn cứ nghĩa vụ bên ngoài |
| basis_internal | Quy chế, chính sách, quy trình, hướng dẫn nội bộ | Có | Căn cứ nghĩa vụ nội bộ |
| context | JD, sơ đồ tổ chức, mô tả vai trò, tài liệu bối cảnh | Không mặc định | Hiểu bối cảnh/phân quyền |
| test_data | Danh sách nhân sự, giao dịch, log, dữ liệu vận hành | Không | Chọn mẫu/kiểm tra thực tế |
| evidence | Chứng từ, hình ảnh, hồ sơ, bằng chứng thực hiện | Không | Chứng minh kết quả kiểm tra |

Nguồn basis_external / basis_internal chỉ được đưa vào extraction khi:
1. đã xác nhận liên quan tới phạm vi;
2. đã xác nhận phiên bản/hiệu lực;
3. được gắn đúng cuộc đánh giá.

## 3. Phạm vi cuộc đánh giá

Phạm vi tối thiểu gồm: Đơn vị; Quy trình; Hoạt động; Địa điểm; Thời kỳ; Mục tiêu/phạm vi mô tả.

Khung tuân thủ có sẵn là tham chiếu tùy chọn, không phải điều kiện tiên quyết để tạo cuộc đánh giá.

## 4. Cấu trúc một Draft Obligation

Mỗi bản ghi phải đại diện cho một nghĩa vụ độc lập có thể kiểm tra.

Các trường chính: sourceId, originAssessmentId, sourceClause, originalText, obligation, actorText, actionText, objectText, conditionText, exceptionText, timingText, frequencyText, applicability, applicableOrgRefs, applicableProcessRefs, applicableActivityRefs, applicableRoleRefs, controlPoint, controlObjective, obligationType, mandatoryLevel, expectedEvidence, testProcedure, verificationMethod, confidence, reviewReasons, uncertainties, obligationKey, reviewStatus.

## 5. Quy tắc AI

AI chỉ tạo Draft Obligation.

AI phải:
- giữ trace tới nguồn và điều/khoản/mục;
- tách nhiều nghĩa vụ độc lập thành nhiều item;
- giữ nguyên điều kiện và ngoại lệ;
- không tự thêm nghĩa vụ, thời hạn, phạm vi, bằng chứng hoặc thủ tục kiểm tra nếu nguồn không hỗ trợ;
- trường chưa đủ căn cứ phải để trống và ghi reviewReasons / uncertainties;
- không dùng nguồn context, test_data hoặc evidence để sinh nghĩa vụ.

Rule fallback chỉ tạo ứng viên và không tự điền bằng chứng kỳ vọng/thủ tục kiểm tra.

## 6. Human review

Human review luôn bắt buộc.

Trước khi accepted, draft tối thiểu phải có: nghĩa vụ chuẩn hóa; điều/khoản/mục nguồn; chủ thể; hành động; bằng chứng kỳ vọng; phương pháp/thủ tục kiểm tra.

Reviewer có thể sửa, chấp nhận, loại và ghi lý do. Mọi quyết định được ghi vào decision_logs.

## 7. Publish và phê duyệt

Draft đã accepted mới được publish. Publish tạo ComplianceRequirement trạng thái pending_approval.

Khung đích là tùy chọn: nếu chọn khung thì requirement được gắn với framework; nếu không thì requirement vào sổ nghĩa vụ chung.

Requirement chỉ trở thành đối tượng kiểm tra sau khi được duyệt effective. obligationKey được dùng để chặn duplicate official requirement trước khi publish.

## 8. Eligibility cho một cuộc đánh giá

Hệ thống tính theo chuỗi: **Total → Approved → Unit Match → Process Match → Activity Match → Effective → Eligible**.

Một requirement eligible khi: trạng thái effective; khớp đơn vị hoặc không giới hạn đơn vị; khớp quy trình hoặc không giới hạn quy trình; khớp hoạt động hoặc không giới hạn hoạt động; nguồn còn hiệu lực trong thời kỳ đánh giá.

Khi requirement được đưa vào assessment, hệ thống lưu requirement snapshot, scope snapshot và eligibility snapshot.

## 9. Nguyên tắc dữ liệu và kiểm soát

- Không xóa/ghi đè requirement chính thức khi tái trích xuất nguồn.
- Re-extraction chỉ thay các draft chưa publish của cùng source + cùng assessment.
- Requirement chính thức được version hóa/trace bằng obligationKey, requirementVersion, supersedesRequirementId.
- Nguồn dữ liệu kiểm tra và bằng chứng không được nâng thành nguồn căn cứ chỉ vì có nội dung mang tính quy định.
- Không tự suy diễn hiệu lực văn bản: cần xác nhận bởi người dùng hoặc nguồn kiểm chứng tin cậy.

## 10. Acceptance Criteria v2

1. Tạo assessment không cần framework hoặc requirement có sẵn.
2. Nguồn bắt buộc gắn assessment và source role.
3. Chỉ basis source verified mới được extraction.
4. Context/test data/evidence bị chặn khỏi extraction.
5. Draft nghĩa vụ có cấu trúc actor/action/condition/exception/scope/control/evidence/test.
6. Rule fallback không tự tạo evidence/test procedure.
7. Accepted draft bắt buộc đủ trường tối thiểu.
8. Publish sinh pending-approval requirement và chống duplicate.
9. Effective requirement mới được eligibility.
10. Eligibility có funnel Total/Approved/Unit/Process/Activity/Effective/Eligible.
11. RequirementAssessment lưu snapshot tại thời điểm gắn.
12. Toàn bộ human-review/publish/refresh đều có audit.
