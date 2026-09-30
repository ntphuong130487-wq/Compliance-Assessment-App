import fs from "node:fs";

function read(p){return fs.readFileSync(p,"utf8")}
function assert(ok,msg){if(!ok)throw new Error(msg)}

const html=read("index.html")+"\n"+read("src/app.js");
const bootstrap=read("api/v1/bootstrap.js");
const commands=read("api/v1/commands.js");
const evidence=read("api/evidence.js");
const authz=read("lib/server-authz.js");
const migration=read("db/migrations/004_production_core.sql");

assert(html.includes('/api/v1/bootstrap'),"Client must use normalized bootstrap");
assert(html.includes('apiCommand("assessment.create"'),"Normalized assessment create not wired");
assert(html.includes('apiCommand("finding.create"'),"Normalized finding create not wired");
assert(html.includes('apiCommand("finding.respond"'),"Normalized finding response not wired");
assert(html.includes('apiCommand("finding.finalize"'),"Normalized finding finalization not wired");
assert(html.includes('apiCommand("action.create"'),"Normalized action create not wired");
assert(html.includes('apiCommand("action.verify"'),"Normalized verification not wired");
assert(html.includes('draftRequirement.publishBatch'),"Normalized obligation publish not wired");
assert(html.includes('source.create'),"Normalized source create not wired");

for(const term of ["requireUser","visibleOrgIds","assessment_scopes","unit_responses","draft_requirements"]){
  assert(bootstrap.includes(term),"Bootstrap missing "+term);
}
for(const term of ["assertPermission","assertOrgScope","SELF_VERIFICATION_FORBIDDEN","CLOSURE_EVIDENCE_REQUIRED","REQUIREMENT_SET_INVALID"]){
  assert(commands.includes(term),"Command API missing control "+term);
}
assert(evidence.includes('target_type')&&evidence.includes('sha256')&&evidence.includes('assertOrgScope'),"Normalized evidence persistence incomplete");
assert(evidence.includes('BLOB_STORE_ID')&&evidence.includes('authMode:process.env.BLOB_READ_WRITE_TOKEN?"token":"oidc"'),"OIDC/private Blob support missing");
for(const term of ["revisionContext","contentDisposition","await get(pathname","assertOrgScope(session,ctx.orgId)","mode===\"download\""]){
  assert(evidence.includes(term),"Private evidence read path missing "+term);
}
assert(commands.includes("recordDraftDecision")&&commands.includes("human_review_ai_draft")&&commands.includes("human_edit_ai_draft"),"AI human-review audit commands missing");
assert(bootstrap.includes("draftReviewEvents")&&bootstrap.includes("DraftRequirement"),"Draft review audit bootstrap missing");
assert(authz.includes("ORG_SCOPE_FORBIDDEN")&&authz.includes("ROLE_PERMISSIONS"),"Server authorization policy incomplete");
for(const table of ["assessment_assignments","draft_requirements","unit_responses"]){
  assert(migration.includes("CREATE TABLE IF NOT EXISTS "+table),"Migration missing "+table);
}

console.log("PASS - normalized production core wiring and server controls");
