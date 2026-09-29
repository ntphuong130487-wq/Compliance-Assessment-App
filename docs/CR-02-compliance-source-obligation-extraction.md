# CR-02 – Compliance Source Intake & Obligation Extraction

**Trạng thái:** APPROVED FOR IMPLEMENTATION  
**Ngày:** 2026-09-29

## Mục tiêu
Biến module Khung tuân thủ thành luồng: Nguồn quy định → Bóc tách nghĩa vụ → Review → Publish Framework.

## Nguồn đầu vào
1. Upload file.
2. Nhập/dán text.
3. Tìm quy định nhà nước.

## Quy tắc
- Kết quả bóc tách là **Draft Obligation**, không tự trở thành Requirement chính thức.
- Người dùng phải Chấp nhận / Loại / Sửa trước khi Publish.
- Requirement publish phải trace về Source và điều/khoản/nội dung nguồn nếu có.
- Search pháp lý chỉ được coi là hoàn tất khi có search provider/nguồn công khai thực sự; chưa cấu hình thì UI phải nói rõ.

## Draft Obligation Fields
- sourceId
- sourceClause
- originalText
- obligation
- applicability
- obligationType
- mandatoryLevel
- expectedEvidence
- testProcedure
- reviewStatus

## Acceptance Criteria
1. Có 3 entry mode: File / Text / Search.
2. Text và file đọc được có thể tạo Draft Obligations.
3. Draft được review trước khi publish.
4. Publish vào framework hiện có hoặc framework mới.
5. Requirement giữ trace về source.
6. Search mode không giả lập kết quả pháp lý.
