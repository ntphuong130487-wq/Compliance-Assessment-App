import fs from "node:fs";

function assert(ok,msg){if(!ok)throw new Error(msg)}
const src=fs.readFileSync("api/evidence.js","utf8");

for(const term of [
  "revisionContext","assertOrgScope(session,ctx.orgId)","contentDisposition",
  "BLOB_NOT_CONFIGURED","AUTH_REQUIRED","USER_NOT_PROVISIONED",
  "EVIDENCE_SCOPE_UNRESOLVED","EVIDENCE_BLOB_NOT_FOUND",
  "NORMALIZED_TARGET_REQUIRED","TARGET_NOT_FOUND"
]) assert(src.includes(term),"Evidence security control missing: "+term);

const uploadStart=src.indexOf('if(req.method!=="POST")');
const authPos=src.indexOf("const session=await userContext(req)",uploadStart);
const scopePos=src.indexOf("assertOrgScope(session,ctx.orgId)",authPos);
const bodyPos=src.indexOf("const body=await readBody(req)",uploadStart);
const putPos=src.indexOf("await put(pathname,body",uploadStart);
assert(uploadStart>=0&&authPos>uploadStart,"Upload auth path missing");
assert(scopePos>authPos&&scopePos<bodyPos,"Org-scope authorization must occur before reading upload body");
assert(bodyPos<putPos,"Blob put must occur only after body-size enforcement");

const txPos=src.indexOf("await sql.transaction([",putPos);
const evidenceInsert=src.indexOf("INSERT INTO evidence(",txPos);
const revisionInsert=src.indexOf("INSERT INTO evidence_revisions",txPos);
const linkInsert=src.indexOf("INSERT INTO evidence_links",txPos);
assert(txPos>putPos&&evidenceInsert>txPos&&revisionInsert>evidenceInsert&&linkInsert>revisionInsert,
  "Evidence metadata/revision/link must be persisted atomically after Blob write");
assert(src.includes("await del(blob.url"),"Blob cleanup on DB transaction failure is required");

const readStart=src.indexOf('if(req.method==="GET")');
const readAuth=src.indexOf("const session=await userContext(req)",readStart);
const readScope=src.indexOf("assertOrgScope(session,ctx.orgId)",readAuth);
const getBlob=src.indexOf("await get(pathname",readScope);
assert(readAuth>readStart&&readScope>readAuth&&getBlob>readScope,
  "Evidence read must authenticate and enforce org scope before private Blob read");

console.log("PASS - evidence auth, org scope, atomicity and cleanup ordering");
