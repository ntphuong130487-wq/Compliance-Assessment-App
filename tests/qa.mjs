import fs from "node:fs";
const html=fs.readFileSync("index.html","utf8");
const checks=[
  ["7 màn hình",["Điều hành","Khung tuân thủ","Chương trình đánh giá","Kiểm tra hiện trường","Phát hiện","Khắc phục","Báo cáo"].every(x=>html.includes(x))],
  ["human-in-the-loop",html.includes("AI chỉ đề xuất")&&html.includes("Tạo Draft Finding")&&html.includes("Chốt Finding")],
  ["scope rule",html.includes("applicableRequirements")&&html.includes("Requirement không có applicability cụ thể được hiểu là áp dụng chung")],
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
  ["scoped reporting",html.includes("var scopedRA=visibleRA()")],
  ["reset demo removed",!html.includes(">Reset demo</button>")]
];
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length) throw new Error("Không tìm thấy script");
for(const s of scripts) new Function(s);
const failed=checks.filter(x=>!x[1]);
for(const [name,ok] of checks) console.log((ok?"PASS":"FAIL")+" - "+name);
if(failed.length) process.exit(1);
console.log("PASS - JavaScript syntax");
