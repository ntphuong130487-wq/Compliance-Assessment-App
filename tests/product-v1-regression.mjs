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

for(const asset of ["/src/styles/product-v1.css","/src/ui/product-ui.js"]){
  assert(index.includes(asset),"Missing product asset "+asset);
}
assert(index.indexOf("/src/ui/product-ui.js")<index.indexOf("/src/app.js"),"Product UI must load before app.js");

for(const primitive of ["pageIntro","metricGrid","sectionHeader","empty","progress","screenClass"]){
  assert(ui.includes(primitive),"UI primitive missing "+primitive);
}
for(const screen of [
  "COMPLIANCE CONTROL TOWER",
  "SOURCE & OBLIGATION WORKSPACE",
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
  "draftRequirement.publishBatch","assessment.create"
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
assert(app.length<90000,"app.js should stay below modularization guardrail");
assert(screens.includes("Evidence workspace"),"Evidence workspace missing");
assert(screens.includes("finding-timeline"),"Finding timeline missing");
assert(screens.includes("aging-strip"),"Action aging missing");
assert(screens.includes("Human review bắt buộc"),"Human review UX missing");

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
  "MANDATORY_ACTION_NOT_REQUIRED"
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
assert(app.includes("remediationRequired")&&app.includes("remediationRequirement")&&app.includes("mandatory_remediation")&&app.includes("improvement_action"),
  "Recommendation/remediation distinction missing in workflow");
assert(screens.includes("Yêu cầu khắc phục bắt buộc")&&screens.includes("Khắc phục bắt buộc"),
  "Recommendation/remediation distinction missing in product screens");

console.log("PASS - Product v1 UI + business regression controls");
