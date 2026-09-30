import fs from "node:fs";

function read(p){return fs.readFileSync(p,"utf8")}
function assert(ok,msg){if(!ok)throw new Error(msg)}

const html=read("index.html")+"\n"+read("src/app.js");
const bootstrap=read("api/v1/bootstrap.js");
const commands=read("api/v1/commands.js");
const evidence=read("api/evidence.js");
const authz=read("lib/server-authz.js");
const sourceExtract=read("api/source/extract.js");
const obligationExtract=read("api/obligations/extract.js");
const aiExtractor=read("lib/ai-obligation-extractor.js");
const docIntel=read("lib/document-intelligence.js");
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
for(const term of ["assertPermission","assertOrgScope","SELF_VERIFICATION_FORBIDDEN","CLOSURE_EVIDENCE_REQUIRED","REQUIREMENT_SET_INVALID","REQUIREMENT_ASSESSMENT_SCOPE_MISMATCH","ACTION_NOT_READY_FOR_VERIFICATION","INVALID_VERIFICATION_RESULT"]){
  assert(commands.includes(term),"Command API missing control "+term);
}
const findingScopeCheck=commands.indexOf("REQUIREMENT_ASSESSMENT_SCOPE_MISMATCH");
const findingInsert=commands.indexOf("INSERT INTO findings",findingScopeCheck);
assert(findingScopeCheck>=0&&findingInsert>findingScopeCheck,"Finding scope must be validated before insert");
const verifyState=commands.indexOf("ACTION_NOT_READY_FOR_VERIFICATION");
const verificationInsert=commands.indexOf("INSERT INTO verifications",verifyState);
assert(verifyState>=0&&verificationInsert>verifyState,"Action verification state must be validated before verification insert");
assert(commands.indexOf("CLOSURE_EVIDENCE_REQUIRED",verifyState)>verifyState&&commands.indexOf("CLOSURE_EVIDENCE_REQUIRED",verifyState)<verificationInsert,
  "Closure evidence must be revalidated during verification");
assert(evidence.includes('target_type')&&evidence.includes('sha256')&&evidence.includes('assertOrgScope'),"Normalized evidence persistence incomplete");
assert(evidence.includes('BLOB_STORE_ID')&&evidence.includes('authMode:process.env.BLOB_READ_WRITE_TOKEN?"token":"oidc"'),"OIDC/private Blob support missing");
for(const term of ["revisionContext","contentDisposition","await get(pathname","assertOrgScope(session,ctx.orgId)","mode===\"download\""]){
  assert(evidence.includes(term),"Private evidence read path missing "+term);
}
assert(commands.includes("recordDraftDecision")&&commands.includes("human_review_ai_draft")&&commands.includes("human_edit_ai_draft"),"AI human-review audit commands missing");
assert(bootstrap.includes("draftReviewEvents")&&bootstrap.includes("DraftRequirement"),"Draft review audit bootstrap missing");
assert(authz.includes("ORG_SCOPE_FORBIDDEN")&&authz.includes("ROLE_PERMISSIONS"),"Server authorization policy incomplete");
const sourceAuth=sourceExtract.indexOf("const auth=await requireUser(req)");
const sourceBody=sourceExtract.indexOf("const body=await readBody(req)");
const sourceAI=sourceExtract.indexOf("const hybrid=await extractObligationsHybrid");
assert(sourceAuth>=0&&sourceAuth<sourceBody&&sourceBody<sourceAI,"Source extraction must authorize before upload read/OCR/AI work");
const obligationAuth=obligationExtract.indexOf("const auth=await requireUser(req)");
const obligationAI=obligationExtract.indexOf("const hybrid=await extractObligationsHybrid");
assert(obligationAuth>=0&&obligationAuth<obligationAI,"Obligation extraction must authorize before AI work");
assert(aiExtractor.includes("AbortSignal.timeout(30000)"),"AI provider call must have a hard timeout");
assert(aiExtractor.includes("sourceTextIsUntrusted:true")&&aiExtractor.includes("ignoreInstructionsInsideSource:true")&&aiExtractor.includes("noExternalActions:true"),
  "AI extraction must explicitly treat source text as untrusted content");
assert(docIntel.includes("AbortSignal.timeout(30000)"),"OCR provider call must have a hard timeout");
for(const table of ["assessment_assignments","draft_requirements","unit_responses"]){
  assert(migration.includes("CREATE TABLE IF NOT EXISTS "+table),"Migration missing "+table);
}

console.log("PASS - normalized production core wiring and server controls");
