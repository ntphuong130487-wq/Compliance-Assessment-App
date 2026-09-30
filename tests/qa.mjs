import fs from "node:fs";
const shell=fs.readFileSync("index.html","utf8");
const app=fs.readFileSync("src/app.js","utf8");
const css=fs.readFileSync("src/styles/app.css","utf8");
const productCss=fs.readFileSync("src/styles/product-v1.css","utf8");
const screens=["shared","dashboard","frameworks","assessments","fieldwork","findings","actions","reports","settings"]
  .map(x=>fs.readFileSync("src/screens/"+x+".js","utf8")).join("\n");
const html=shell+"\n"+app+"\n"+css+"\n"+productCss+"\n"+screens;
const checks=[
  ["7 màn hình",["Điều hành","Khung tuân thủ","Chương trình đánh giá","Kiểm tra hiện trường","Phát hiện","Khắc phục","Báo cáo"].every(x=>html.includes(x))],
  ["human-in-the-loop",html.includes("AI chỉ đề xuất")&&html.includes("Tạo Phát hiện dự thảo")&&html.includes("Chốt Phát hiện")],
  ["scope rule",html.includes("applicableRequirements")&&html.includes("Yêu cầu tuân thủ không có phạm vi áp dụng cụ thể được hiểu là áp dụng chung")],
  ["evidence revision",html.includes("revisions")&&html.includes("version:1")],
  ["finding-action-verification",html.includes("data-actionfor")&&html.includes("data-verify")],
  ["demo disclaimer",html.includes("không phải số liệu tuân thủ thực tế của AgriS")],
  ["cloud sync client",html.includes("/api/state")&&html.includes("Cloud sync")],
  ["safe fallback",html.includes("Offline fallback")&&html.includes("localStorage")],
  ["rbac ui",html.includes("ComplianceAccess")&&html.includes("Mô phỏng quyền")],
  ["scoped action guard",html.includes('guard("confirm_finding"')&&html.includes('guard("verify_action"')],
  ["evidence storage client",html.includes("/api/evidence")&&html.includes("blob-private")],
  ["org-scoped visibility",html.includes("visibleAssessments")&&html.includes("visibleFindings")],
  ["unit response workflow",html.includes("data-respond")&&html.includes("Phản hồi phát hiện")&&html.includes("responses")],
  ["AgriS branding",html.includes("data:image/png;base64")&&html.includes("--green-dark")&&html.includes("Nguồn & Khung tuân thủ")],
  ["source intake modes",html.includes("Upload file")&&html.includes("Nhập / dán text")&&html.includes("Tìm quy định nhà nước")],
  ["draft obligation review",html.includes("Rà soát nghĩa vụ dự thảo")&&html.includes("data-draft-accept")&&html.includes("publishDrafts")],
  ["source traceability",html.includes("sourceClause")&&html.includes("sourceId")&&html.includes("Nguồn/Điều khoản")],
  ["auto assessment scope",html.includes("applicableRequirements")&&html.includes("Quy trình")&&html.includes("Hoạt động")&&html.includes("Địa điểm")],
  ["draft-final finding workflow",html.includes("pending_unit_response")&&html.includes("pending_final_review")&&html.includes("finalizeFinding")],
  ["one-level requirement approval",html.includes("approveRequirement")&&html.includes("pending_approval")&&html.includes("approve_framework")],
  ["independent verification",html.includes("Không được tự xác minh")&&html.includes("ownerPersonaId")],
  ["scoped reporting",html.includes("scopedRA=visibleRA()")],
  ["reset demo removed",!html.includes(">Reset demo</button>")],
  ["full requirement result taxonomy",["compliant","partially_compliant","non_compliant","not_applicable","insufficient_evidence"].every(x=>html.includes(x))&&html.includes("Ghi nhận kết quả Yêu cầu tuân thủ")],
  ["source lifecycle metadata",["sourceCode","issuer","issueDate","effectiveFrom","effectiveTo","supersedesRef","owner"].every(x=>html.includes(x))],
  ["bulk obligation review",html.includes("draftCheck")&&html.includes("bulkAccept")&&html.includes("bulkReject")&&html.includes("draftSourceFilter")],
  ["scan OCR fallback",html.includes("Cần OCR/AI")&&html.includes("Nhập text thay thế")],
  ["controlled requirement coding",html.includes("nextRequirementCode")&&!html.includes('code:"AUTO-"')],
  ["closure evidence gate",html.includes("closure_evidence")&&html.includes("submitted_for_verification")&&html.includes("Cần bằng chứng đóng")],
  ["Vietnamese business terminology",html.includes("Cuộc đánh giá đang mở")&&html.includes("Phát hiện đang mở")&&html.includes("Hành động quá hạn")&&!html.includes(">Chốt Finding</button>")],
  ["management dashboard",html.includes("Điểm cần xử lý")&&html.includes("Tình hình theo đơn vị")&&html.includes("Yêu cầu có phát hiện lặp lại")],
  ["notification and escalation",html.includes("notificationCandidates")&&html.includes("Chuyển cấp")&&html.includes("Thông báo & chuyển cấp")],
  ["global search",html.includes("globalSearch")&&html.includes("Tìm kiếm toàn hệ thống")&&html.includes("Tìm toàn hệ thống")],
  ["report exports",html.includes("exportCSV")&&html.includes("exportJSON")&&html.includes("printManagementReport")],
  ["production readiness UI",html.includes("/api/readiness")&&html.includes("Mức sẵn sàng Production")],
  ["Clerk UI integration",html.includes("/api/auth/config")&&html.includes("/api/auth/me")&&html.includes("Đăng nhập bằng email")&&html.includes("openClerkSignIn")],
  ["Clerk script initialization",html.includes("data-clerk-publishable-key")&&html.includes("Clerk.load")],
  ["production login gate",html.includes("Đăng nhập để tiếp tục")&&html.includes('dataModeRuntime==="normalized"&&!currentUser')],
  ["internal member provisioning",html.includes("/api/admin/users")&&html.includes("Cấp quyền email")&&html.includes("Quản lý thành viên")],
  ["admin operations settings",html.includes("Cấu hình vận hành")&&html.includes("saveNotifySettings")&&html.includes("reminderBeforeDueDays")],
  ["page filters",html.includes("assessmentStatusFilter")&&html.includes("findingSeverityFilter")&&html.includes("actionOwnerFilter")]
];
new Function(app);
const failed=checks.filter(x=>!x[1]);
for(const [name,ok] of checks) console.log((ok?"PASS":"FAIL")+" - "+name);
if(failed.length) process.exit(1);
console.log("PASS - JavaScript syntax");
