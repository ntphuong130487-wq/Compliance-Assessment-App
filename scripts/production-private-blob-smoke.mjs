import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { put, get, del } from "@vercel/blob";

if(process.env.VERCEL_ENV!=="production"){
  console.log("PRODUCTION_PRIVATE_BLOB_SMOKE_SKIPPED",process.env.VERCEL_ENV||"unknown");
  process.exit(0);
}
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL_MISSING");
if(!process.env.BLOB_STORE_ID&&!process.env.BLOB_READ_WRITE_TOKEN)throw new Error("BLOB_NOT_CONFIGURED");

const sql=neon(process.env.DATABASE_URL);
const suffix=Date.now().toString();
const ids={
  org:crypto.randomUUID(),framework:crypto.randomUUID(),requirement:crypto.randomUUID(),
  assessment:crypto.randomUUID(),scope:crypto.randomUUID(),ra:crypto.randomUUID(),
  evidence:crypto.randomUUID(),revision:crypto.randomUUID(),link:crypto.randomUUID(),audit:crypto.randomUUID()
};
const content=Buffer.from("AgriS Compliance Assessment build-time private blob smoke "+suffix+"\n","utf8");
const expectedHash=crypto.createHash("sha256").update(content).digest("hex");
let blob=null;
const checks={};

function blobPath(url){
  const u=new URL(url);
  return decodeURIComponent(u.pathname.replace(/^\/+/, ""));
}

async function cleanup(){
  const errors=[];
  const ops=[
    ()=>sql`DELETE FROM decision_logs WHERE id=${ids.audit}::uuid`,
    ()=>sql`DELETE FROM evidence_links WHERE id=${ids.link}::uuid`,
    ()=>sql`DELETE FROM evidence_revisions WHERE id=${ids.revision}::uuid`,
    ()=>sql`DELETE FROM evidence WHERE id=${ids.evidence}::uuid`,
    ()=>sql`DELETE FROM requirement_assessments WHERE id=${ids.ra}::uuid`,
    ()=>sql`DELETE FROM assessment_scopes WHERE id=${ids.scope}::uuid`,
    ()=>sql`DELETE FROM compliance_assessments WHERE id=${ids.assessment}::uuid`,
    ()=>sql`DELETE FROM compliance_requirements WHERE id=${ids.requirement}::uuid`,
    ()=>sql`DELETE FROM compliance_frameworks WHERE id=${ids.framework}::uuid`,
    ()=>sql`DELETE FROM org_units WHERE id=${ids.org}::uuid`
  ];
  for(const op of ops){try{await op();}catch(e){errors.push(String(e?.message||e));}}
  if(blob?.url){try{await del(blobPath(blob.url));}catch(e){errors.push("blob:"+String(e?.message||e));}}
  return errors;
}

try{
  const adminRows=await sql`
    SELECT id,email,role_code,status,public_metadata,last_sign_in_at
    FROM app_users
    WHERE lower(email)='phuong130487@gmail.com'
      AND role_code='compliance_admin'
      AND status='active'
    LIMIT 1
  `;
  const admin=adminRows[0];
  checks.clerkAdminLinked=Boolean(admin?.id?.startsWith("user_"));
  checks.clerkLoginObserved=Boolean(admin?.last_sign_in_at);
  checks.adminOrgWildcard=Array.isArray(admin?.public_metadata?.orgIds)&&admin.public_metadata.orgIds.includes("*");
  if(!checks.clerkAdminLinked||!checks.clerkLoginObserved||!checks.adminOrgWildcard){
    throw new Error("CLERK_ADMIN_PROVISIONING_NOT_VERIFIED");
  }

  await sql`INSERT INTO org_units(id,code,name,unit_type,status) VALUES(${ids.org}::uuid,${"SMOKE-"+suffix},'Smoke Org','test','active')`;
  await sql`INSERT INTO compliance_frameworks(id,code,name,version,status,owner) VALUES(${ids.framework}::uuid,${"SMOKE-FW-"+suffix},'Smoke Framework','1','active',${admin.id})`;
  await sql`INSERT INTO compliance_requirements(id,code,title,assessable,status) VALUES(${ids.requirement}::uuid,${"SMOKE-REQ-"+suffix},'Private Blob Smoke Requirement',true,'active')`;
  await sql`INSERT INTO compliance_assessments(id,framework_id,name,status,lead_assessor) VALUES(${ids.assessment}::uuid,${ids.framework}::uuid,'Private Blob Smoke Assessment','in_progress',${admin.id})`;
  await sql`INSERT INTO assessment_scopes(id,assessment_id,org_unit_id,scope_note,include_all_requirements) VALUES(${ids.scope}::uuid,${ids.assessment}::uuid,${ids.org}::uuid,'isolated smoke fixture',true)`;
  await sql`INSERT INTO requirement_assessments(id,assessment_id,requirement_id,workflow_status,compliance_result,assessed_by) VALUES(${ids.ra}::uuid,${ids.assessment}::uuid,${ids.requirement}::uuid,'in_progress','not_assessed',${admin.id})`;

  checks.positiveOrgScope=admin.public_metadata.orgIds.includes("*");
  checks.negativeOrgScope=!([].includes(ids.org));

  blob=await put("compliance-evidence/build-smoke-"+suffix+".txt",content,{access:"private",contentType:"text/plain"});
  checks.privateUpload=Boolean(blob?.url);

  const read=await get(blobPath(blob.url),{access:"private",useCache:false});
  if(!read?.stream)throw new Error("PRIVATE_BLOB_GET_NO_STREAM");
  const chunks=[];
  for await(const chunk of read.stream)chunks.push(Buffer.from(chunk));
  const readBody=Buffer.concat(chunks);
  checks.privateRead=readBody.equals(content);
  checks.sha256=crypto.createHash("sha256").update(readBody).digest("hex")===expectedHash;

  const unauth=await fetch(blob.url,{redirect:"manual"});
  checks.unauthenticatedDenied=unauth.status!==200;

  await sql`INSERT INTO evidence(id,name,evidence_type,source_system,confidentiality,status,owner_user_id,org_unit_id)
    VALUES(${ids.evidence}::uuid,'build-smoke-private-blob.txt','text/plain','Vercel Blob','internal','active',${admin.id},${ids.org}::uuid)`;
  await sql`INSERT INTO evidence_revisions(id,evidence_id,version,file_uri,original_filename,mime_type,sha256,captured_at,file_size,storage_provider)
    VALUES(${ids.revision}::uuid,${ids.evidence}::uuid,1,${blob.url},'build-smoke-private-blob.txt','text/plain',${expectedHash},now(),${content.length},'vercel_blob')`;
  await sql`INSERT INTO evidence_links(id,evidence_revision_id,target_type,target_id,purpose,linked_by)
    VALUES(${ids.link}::uuid,${ids.revision}::uuid,'RequirementAssessment',${ids.ra}::uuid,'build_smoke_test',${admin.id})`;
  await sql`INSERT INTO decision_logs(id,object_type,object_id,decision_type,from_state,to_state,reason,decided_by,approval_ref)
    VALUES(${ids.audit}::uuid,'EvidenceRevision',${ids.revision}::uuid,'private_blob_smoke',NULL,'verified','Production build private Blob smoke test',${admin.id},'BUILD-SMOKE')`;

  const verify=await sql`
    SELECT
      EXISTS(SELECT 1 FROM evidence WHERE id=${ids.evidence}::uuid AND owner_user_id=${admin.id} AND org_unit_id=${ids.org}::uuid) AS evidence_ok,
      EXISTS(SELECT 1 FROM evidence_revisions WHERE id=${ids.revision}::uuid AND sha256=${expectedHash} AND storage_provider='vercel_blob') AS revision_ok,
      EXISTS(SELECT 1 FROM evidence_links WHERE id=${ids.link}::uuid AND target_type='RequirementAssessment' AND target_id=${ids.ra}::uuid) AS link_ok,
      EXISTS(SELECT 1 FROM decision_logs WHERE id=${ids.audit}::uuid AND decision_type='private_blob_smoke' AND decided_by=${admin.id}) AS audit_ok
  `;
  Object.assign(checks,verify[0]||{});

  const required=["clerkAdminLinked","clerkLoginObserved","adminOrgWildcard","positiveOrgScope","negativeOrgScope","privateUpload","privateRead","sha256","unauthenticatedDenied","evidence_ok","revision_ok","link_ok","audit_ok"];
  const pass=required.every(k=>checks[k]===true);
  if(!pass)throw new Error("SMOKE_CHECK_FAILED "+JSON.stringify(checks));

  const cleanupErrors=await cleanup();
  if(cleanupErrors.length)throw new Error("SMOKE_CLEANUP_FAILED "+JSON.stringify(cleanupErrors));

  console.log("PRODUCTION_PRIVATE_BLOB_SMOKE_PASS",JSON.stringify(checks));
}catch(error){
  const cleanupErrors=await cleanup();
  console.error("PRODUCTION_PRIVATE_BLOB_SMOKE_FAIL",error?.stack||error,cleanupErrors);
  process.exit(1);
}
