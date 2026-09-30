import fs from "node:fs";

function read(p){return fs.readFileSync(p,"utf8")}
function assert(ok,msg){if(!ok)throw new Error(msg)}

const index=read("index.html");
const app=read("src/app.js");
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
  assert(app.includes(screen),"Product screen composition missing "+screen);
}
for(const style of ["metric-grid","product-hero","screen-fieldwork","screen-frameworks","product-progress"]){
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

console.log("PASS - Product v1 UI + business regression controls");
