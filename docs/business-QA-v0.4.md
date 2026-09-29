# Business QA – Compliance Assessment App v0.4

**Ngày review:** 2026-09-29  
**Phạm vi:** UI/UX và logic nghiệp vụ nhìn từ người dùng Compliance/RPC.  
**Không bao gồm:** kiểm thử bảo mật hạ tầng, hiệu năng, penetration test, độ chính xác pháp lý của AI.  
**Ghi chú:** Branding tổng thể đã được người dùng chấp nhận; logo ghi nhận chưa đúng và để điều chỉnh sau. Cách tiếp nhận nguồn đã được người dùng chấp nhận.

## 1. Kết luận nhanh

- UI tổng thể: **Đạt để tiếp tục phát triển**.
- Luồng Source → Draft Obligation → Review → Publish: **Đạt về hướng nghiệp vụ**.
- Chưa đạt để gọi là production business workflow do còn các khoảng trống P0/P1 ở Assessment Scope, Finding workflow, dữ liệu theo vai trò và các nút dành cho môi trường thử nghiệm.

## 2. Finding theo mức độ

### P0 – Cần xử lý trước khi cho người dùng nghiệp vụ thật

#### BQA-01 – Phạm vi Assessment hiện chưa thực sự lọc Requirement
**Quan sát:** form Assessment có ô “Phạm vi requirement”. Khi có nội dung, hệ thống đánh dấu includeAll=false nhưng vẫn tạo RequirementAssessment cho toàn bộ requirement của framework.  
**Rủi ro:** người dùng hiểu rằng đã giới hạn phạm vi nhưng thực tế checklist vẫn là toàn bộ; báo cáo coverage và finding có thể sai phạm vi.  
**Yêu cầu:** Scope phải có cơ chế chọn requirement/applicability rõ ràng hoặc chỉ dùng mô tả scope và vẫn ghi rõ “toàn bộ requirement”. Không dùng một ô text để giả định lọc requirement.

#### BQA-02 – Reset demo xuất hiện trên giao diện chính
**Quan sát:** nút “Reset demo” xuất hiện cho mọi màn hình.  
**Rủi ro:** khi cloud persistence được bật, có nguy cơ đưa dữ liệu demo hoặc reset state dùng chung nếu không chặn phía server.  
**Yêu cầu:** chỉ hiển thị trong môi trường demo/dev; production phải bỏ hoàn toàn hoặc chỉ Admin có quyền đặc biệt và có xác nhận nhiều bước.

#### BQA-03 – Báo cáo phân bố kết quả chưa áp dụng scope dữ liệu theo vai trò
**Quan sát:** KPI dashboard đã dùng visibleRA(), nhưng phần “Phân bố kết quả” trong Báo cáo đang tính trực tiếp trên toàn bộ S.ra.  
**Rủi ro:** sai báo cáo và có khả năng hiển thị số liệu ngoài phạm vi người dùng được phép xem.  
**Yêu cầu:** mọi dashboard/report phải dùng cùng data-scope service như màn nghiệp vụ.

#### BQA-04 – Finding được “xác nhận” trước khi đơn vị được đánh giá phản hồi
**Quan sát:** tại Fieldwork, người có quyền có thể bấm “Xác nhận Finding”; sau đó Unit Owner mới có nút phản hồi.  
**Rủi ro:** thuật ngữ “xác nhận” dễ được hiểu là finding chính thức/final trước khi auditee có cơ hội giải trình.  
**Yêu cầu đề xuất:** Draft Finding → gửi đơn vị phản hồi → Assessor disposition → Final Finding/Sign-off. Nếu AgriS muốn finding chính thức ngay, cần đổi thuật ngữ và xác định rõ phản hồi là post-finding.

### P1 – Nên xử lý trong vòng điều chỉnh tiếp theo

#### BQA-05 – Assessment thiếu thông tin quản trị bắt buộc
Hiện chưa có rõ:
- kỳ/thời gian kiểm tra;
- Assessment Owner/Lead Assessor;
- Reviewer;
- đơn vị/đại diện đơn vị được đánh giá;
- ngày bắt đầu/kết thúc;
- trạng thái phê duyệt kế hoạch.
**Tác động:** khó vận hành một chương trình kiểm tra thật và khó audit trách nhiệm.

#### BQA-06 – Không có thao tác kết luận đầy đủ cho Requirement
UI hiện chủ yếu cho:
- đánh dấu Tuân thủ;
- xác nhận Finding dẫn tới Không tuân thủ;
- AI proposal.
Chưa có thao tác trực tiếp cho:
- Tuân thủ một phần;
- Không áp dụng;
- Chưa đủ bằng chứng;
- Observation/khuyến nghị không phải vi phạm.
**Tác động:** taxonomy đã có trong data model nhưng người dùng không thao tác được đầy đủ trên UI.

#### BQA-07 – Module Nguồn thiếu metadata pháp lý/quản trị nguồn
Nên bổ sung:
- mã/số hiệu văn bản;
- cơ quan/đơn vị ban hành;
- ngày ban hành;
- ngày hiệu lực;
- ngày hết hiệu lực;
- phiên bản;
- văn bản thay thế/bị thay thế;
- owner nguồn nội bộ.
**Tác động:** requirement traceability hiện mới truy được “tên nguồn”, chưa đủ cho quản lý vòng đời tuân thủ.

#### BQA-08 – Publish Requirement chưa có gate phê duyệt/version
Hiện draft accepted có thể publish thẳng vào framework.  
**Yêu cầu:** tối thiểu tách “Accepted for publish” và “Published/Effective”; framework cần version và trạng thái hiệu lực.

#### BQA-09 – Tạo khung thủ công có thể bỏ qua Source traceability
Nút “Tạo khung thủ công” cho phép nhập requirement không có nguồn.  
**Yêu cầu:** hoặc bắt buộc chọn Source, hoặc tạo Source loại “Manual/Internal interpretation”, không để Requirement chính thức mất provenance.

#### BQA-10 – File scan/ảnh chưa có trải nghiệm rõ ràng
Upload source hiện hỗ trợ file text/PDF/DOCX; file scan có thể cần OCR.  
**Yêu cầu:** UI phải hiển thị rõ trạng thái “Không đọc được text – cần OCR/AI”, nút xử lý tiếp và không coi “0 nghĩa vụ” là hoàn tất.

#### BQA-11 – Draft Obligation chưa có bulk review/filter
Khi một văn bản có nhiều nghĩa vụ, review từng card sẽ chậm.  
**Nên có:** filter theo Source/Status/Type, search, multi-select, Accept/Reject hàng loạt, sort theo điều khoản.

#### BQA-12 – Mã Requirement tự sinh chưa phải business coding rule
Hiện publish dùng mã AUTO-...  
**Yêu cầu:** chốt coding convention hoặc cho framework tự sinh theo cấu trúc có kiểm soát.

### P2 – Cải thiện trải nghiệm/quản trị

#### BQA-13 – QA Check và trạng thái Local/Cloud là thông tin kỹ thuật
Phù hợp giai đoạn test nhưng không nên chiếm top bar của user nghiệp vụ production.  
**Đề xuất:** đưa vào Admin/Diagnostics.

#### BQA-14 – Banner cảnh báo demo xuất hiện trên mọi màn hình
Phù hợp QA hiện tại; production nên thay bằng environment badge nhỏ hoặc ẩn hoàn toàn.

#### BQA-15 – Thuật ngữ còn trộn Việt/Anh
Ví dụ: Assessment, Finding, Action, Verification, Source, Requirement.  
**Đề xuất:** chốt glossary UX; có thể giữ thuật ngữ chuyên ngành trong ngoặc nhưng tên menu/nút nên thống nhất tiếng Việt.

#### BQA-16 – Dashboard mới dừng ở tiến độ
Nên bổ sung sau khi có dữ liệu thật:
- finding theo severity;
- finding quá hạn;
- repeat finding;
- finding theo đơn vị/quy trình/nguồn nghĩa vụ;
- aging action;
- top obligation có vấn đề.

#### BQA-17 – Action chưa yêu cầu evidence closure
Owner hiện nhập action + deadline; verification chưa bắt buộc bằng chứng đóng.  
**Yêu cầu:** Action submit for verification phải có closure evidence hoặc lý do ngoại lệ.

#### BQA-18 – Verification chưa kiểm soát độc lập
Role matrix có reviewer/manager nhưng chưa gắn verification với identity/action owner thật.  
**Yêu cầu:** khi Auth thật hoạt động, rule phải kiểm tra người xác minh độc lập theo policy.

## 3. QA theo từng màn hình

| Màn hình | Trạng thái | Nhận định business |
|---|---|---|
| Điều hành | Đạt có điều kiện | Dễ hiểu; cần thêm management insight sau khi có dữ liệu thật |
| Nguồn & Khung tuân thủ | Đạt hướng nghiệp vụ | Luồng 4 bước tốt; cần metadata nguồn, approval/version, bulk review |
| Chương trình đánh giá | Chưa đạt production | Scope hiện chưa lọc requirement; thiếu owner/period/reviewer |
| Kiểm tra hiện trường | Đạt MVP | Cần đầy đủ result taxonomy và observation/non-finding result |
| Phát hiện | Chưa đạt final workflow | Cần chốt Draft vs Final Finding và phản hồi đơn vị |
| Khắc phục | Đạt MVP | Cần closure evidence, escalation, owner chuẩn hóa |
| Báo cáo | Chưa đạt scope control | Có lỗi business data-scope ở phân bố kết quả |
| Phân quyền mô phỏng | Đạt để QA | Không phải security boundary; production cần identity thật |

## 4. Đề xuất thứ tự xử lý

### Gate 1 – Business correctness
1. Sửa Assessment Scope.
2. Sửa data scope ở Reports.
3. Bỏ/khóa Reset demo.
4. Chốt workflow Draft Finding → Response → Final Finding.
5. Bổ sung đầy đủ Result cho RequirementAssessment.

### Gate 2 – Governance
6. Metadata + lifecycle của Compliance Source.
7. Framework approval/version.
8. Requirement provenance bắt buộc.
9. Assessment Owner/Lead/Reviewer/Period.
10. Closure evidence + verification independence.

### Gate 3 – UX scale
11. Bulk review nghĩa vụ.
12. Search/filter.
13. Dashboard/analytics nâng cao.
14. Ẩn diagnostics khỏi user nghiệp vụ.

## 5. Decision cần người dùng xác nhận

1. Finding có phải qua bước **Draft → Unit Response → Final** hay Finding được coi là chính thức ngay khi assessor xác nhận?
2. Scope Assessment sẽ chọn theo:
   - Requirement cụ thể,
   - nhóm Requirement/applicability,
   - hay chỉ chọn phạm vi tổ chức/quy trình và hệ thống tự xác định Requirement?
3. Framework/Requirement publish cần một cấp duyệt hay hai cấp?
4. Verification có bắt buộc người độc lập với Action Owner không?

