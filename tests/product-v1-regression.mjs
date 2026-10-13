import fs from "node:fs";

function read(p){return fs.readFileSync(p,"utf8")}
function assert(ok,msg){if(!ok)throw new Error(msg)}

const index=read("index.html");
const app=read("src/app.js");
const screens=["dashboard","frameworks","assessments","fieldwork","findings","actions","reports","settings"].map(x=>read("src/screens/"+x+".js")).join("\n");
const ui=read("src/ui/product-ui.js");
const css=read("src/styles/product-v1.css");
const commands=read("api/v1/commands.js");
const authz=read("lib/server-authz.js");
const users=read("lib/user-routes.js");
const actionGovernance=read("src/workflows/action-governance.js");
const assessmentAssignment=read("src/workflows/assessment-assignment.js");

for(const asset of ["/src/styles/product-v1.css","/src/ui/product-ui.js"]){
  assert(index.includes(asset),"Missing product asset "+asset);
}
assert(index.indexOf("/src/ui/product-ui.js")<index.indexOf("/src/app.js"),"Product UI must load before app.js");

for(const primitive of ["pageIntro","metricGrid","sectionHeader","empty","progress","screenClass"]){
  assert(ui.includes(primitive),"UI primitive missing "+primitive);
}
for(const screen of [
  "COMPLIANCE CONTROL TOWER",
  "ASSESSMENT-SCOPED SOURCE & OBLIGATION",
  "ASSESSMENT PLANNING",
  "FIELDWORK & EVIDENCE",
  "FINDING LIFECYCLE",
  "REMEDIATION & VERIFICATION",
  "MANAGEMENT REPORTING"
]){
  assert(screens.includes(screen),"Product screen composition missing "+screen);
}
for(const style of ["metric-grid","product-hero","screen-fieldwork","screen-frameworks","product-progress","evidence-grid","finding-timeline","aging-strip","confidence-bar"]){
  assert(css.includes(style),"Product CSS missing "+style);
}

for(const command of [
  "finding.create","finding.respond","finding.finalize",
  "action.create","action.submitForVerification","action.verify",
  "draftRequirement.publishBatch","assessment.create","assessment.eligibility","assessment.refreshRequirements","source.verifyForAssessment"
]){
  assert(commands.includes(command),"Workflow command missing "+command);
}
for(const control of ["SELF_VERIFICATION_FORBIDDEN","CLOSURE_EVIDENCE_REQUIRED","ORG_SCOPE_FORBIDDEN"]){
  assert(commands.includes(control)||authz.includes(control),"Control missing "+control);
}
for(const role of ["compliance_admin","compliance_manager","lead_assessor","assessor","reviewer","unit_owner","viewer"]){
  assert(authz.includes(role),"Role missing "+role);
}
assert(users.includes("self-signup-preprovisioned"),"Internal pre-provision access model missing");
assert(!users.includes("createInvitation({"),"Production flow must not require Clerk paid/custom-domain invitations");
assert(app.length<105000,"app.js should stay below temporary v2 modularization guardrail");
assert(screens.includes("Evidence workspace"),"Evidence workspace missing");
assert(screens.includes("finding-timeline"),"Finding timeline missing");
assert(screens.includes("aging-strip"),"Action aging missing");
assert(screens.includes("Human review bắt buộc"),"Human review UX missing");
assert(screens.includes("Dữ liệu kiểm tra")&&screens.includes("không bóc nghĩa vụ"),"Source-role separation UX missing");
assert(commands.includes("DRAFT_REVIEW_INCOMPLETE"),"Structured review completeness control missing");
assert(commands.includes("DUPLICATE_DRAFT_OBLIGATION")&&commands.includes("DUPLICATE_OFFICIAL_REQUIREMENT"),"Obligation duplicate controls missing");
assert(commands.includes("await sql.transaction(statements)"),"Obligation publish must be atomic");
assert(commands.includes("INELIGIBLE_REQUIREMENTS_HAVE_WORK")&&commands.includes("remove_ineligible_requirement")&&commands.includes("add_eligible_requirement"),"Eligibility refresh synchronization controls missing");

// End-to-end business lifecycle controls
for(const control of [
  "INVALID_COMPLIANCE_RESULT",
  "INVALID_REQUIREMENT_WORKFLOW",
  "FINDING_NOT_AWAITING_UNIT_RESPONSE",
  "FINDING_NOT_READY_FOR_FINAL_REVIEW",
  "INVALID_FINDING_DISPOSITION",
  "FINAL_FINDING_REQUIRED",
  "ACTION_OWNER_AND_TEXT_REQUIRED",
  "ACTION_NOT_SUBMITTABLE",
  "ASSESSMENT_NOT_DRAFT",
  "ASSESSMENT_REQUIREMENTS_REQUIRED",
  "ASSESSMENT_NOT_IN_FIELDWORK",
  "ASSESSMENT_REQUIREMENTS_INCOMPLETE",
  "ASSESSMENT_FINDINGS_PENDING",
  "ASSESSMENT_NOT_IN_REVIEW",
  "ASSESSMENT_FIELDWORK_NOT_ACTIVE",
  "REMEDIATION_REQUIREMENT_REQUIRED",
  "MANDATORY_REMEDIATION_ACTION_REQUIRED",
  "MANDATORY_ACTION_NOT_REQUIRED",
  "ACTION_PROGRESS_NOT_EDITABLE",
  "INVALID_ACTION_PROGRESS",
  "ACTION_PROGRESS_NOTE_REQUIRED",
  "ACTION_DUE_DATE_NOT_EDITABLE",
  "VALID_REQUESTED_DUE_DATE_REQUIRED",
  "DUE_DATE_CHANGE_REASON_REQUIRED",
  "DUE_DATE_UNCHANGED",
  "DUE_DATE_CHANGE_ALREADY_PENDING",
  "INVALID_DUE_DATE_DECISION",
  "DUE_DATE_DECISION_NOTE_REQUIRED",
  "ACTION_CHANGE_REQUEST_NOT_PENDING",
  "SELF_APPROVAL_FORBIDDEN",
  "ASSESSMENT_ASSIGNMENT_LOCKED",
  "NO_ASSIGNMENTS",
  "ASSIGNMENT_REQUIREMENT_SCOPE_MISMATCH",
  "ASSIGNEE_NOT_ACTIVE",
  "ASSIGNEE_CANNOT_CONDUCT_FIELDWORK",
  "ASSIGNEE_OUTSIDE_ORG_SCOPE",
  "ASSESSMENT_ASSIGNMENTS_INCOMPLETE",
  "REQUIREMENT_NOT_ASSIGNED_TO_USER"
]){
  assert(commands.includes(control),"Business lifecycle control missing "+control);
}


for(const command of ["assessment.startFieldwork","assessment.submitForReview","assessment.close"]){
  assert(commands.includes(command),"Assessment lifecycle command missing "+command);
}
assert(app.includes("startAssessment")&&app.includes("submitAssessmentReview")&&app.includes("closeAssessment"),
  "Assessment lifecycle UI wiring missing");
assert(screens.includes("Phạm vi đã khóa")&&screens.includes("Fieldwork không hoạt động"),
  "Assessment scope-freeze UX missing");
const workflowSurface=app+"\n"+actionGovernance;
assert(workflowSurface.includes("remediationRequired")&&workflowSurface.includes("remediationRequirement")&&workflowSurface.includes("mandatory_remediation")&&workflowSurface.includes("improvement_action"),
  "Recommendation/remediation distinction missing in workflow");
assert(screens.includes("Yêu cầu khắc phục bắt buộc")&&screens.includes("Khắc phục bắt buộc"),
  "Recommendation/remediation distinction missing in product screens");
for(const command of ["action.updateProgress","action.requestDueDateChange","action.decideDueDateChange"]){
  assert(commands.includes(command),"Action governance command missing "+command);
}
for(const fn of ["updateProgress","requestDueDateChange","decideDueDateChange"]){
  assert(actionGovernance.includes(fn),"Action governance workflow missing "+fn);
}
assert(screens.includes("Đổi hạn chờ duyệt")&&screens.includes("Cập nhật")&&screens.includes("Đề nghị đổi hạn"),
  "Action governance UX missing");
assert(index.includes("/src/workflows/action-governance.js"),"Action governance module not loaded");
assert(commands.includes("assessment.assignRequirements"),"Requirement assignment command missing");
assert(authz.includes("assign_assessment_work"),"Requirement assignment permission missing");
assert(assessmentAssignment.includes("Người kiểm tra chính")&&assessmentAssignment.includes("assessment.assignRequirements"),
  "Requirement assignment workflow missing");
assert(screens.includes("yêu cầu chưa phân công người kiểm tra")&&screens.includes("Người kiểm tra chính"),
  "Requirement assignment UX missing");
assert(index.includes("/src/workflows/assessment-assignment.js"),"Requirement assignment module not loaded");

console.log("PASS - Product v1 UI + business regression controls");
