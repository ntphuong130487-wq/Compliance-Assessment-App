import crypto from "node:crypto";
import { put, get, del } from "@vercel/blob";
import { requireAdmin } from "../lib/clerk-auth.js";
import { sqlClient } from "../lib/db.js";
import { assertOrgScope } from "../lib/server-authz.js";

export const config={api:{bodyParser:false}};

function html(res,status,body){
  res.status(status).setHeader("Content-Type","text/html; charset=utf-8");
  return res.end(`<!doctype html><meta charset="utf-8"><title>Private Blob Smoke Test</title>
  <style>body{font-family:system-ui;margin:40px;max-width:900px}button{padding:12px 18px;font-weight:700}pre{background:#111;color:#eee;padding:16px;overflow:auto;border-radius:8px}.ok{color:#087a2b}.bad{color:#b42318}</style>${body}`);
}

function pathnameFromUrl(url){
  const u=new URL(url);
  return decodeURIComponent(u.pathname.replace(/^\//,""));
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const admin=await requireAdmin(req);
  if(!admin)return res.status(403).json({ok:false,error:"ADMIN_REQUIRED"});

  if(req.method==="GET"){
    return html(res,200,`<h1>Authenticated Private Blob Smoke Test</h1>
      <p>Signed in as <b>${admin.email}</b> (${admin.role}).</p>
      <p>This test creates an isolated fixture, writes a <b>private</b> Blob, reads it back, checks unauthenticated denial, validates org-scope enforcement, verifies normalized DB records and an audit record, then cleans everything up.</p>
      <form method="post"><button type="submit">Run smoke test</button></form>`);
  }

  if(req.method!=="POST")return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});

  const sql=sqlClient();
  const suffix=Date.now().toString();
  const ids={
    org:crypto.randomUUID(),framework:crypto.randomUUID(),requirement:crypto.randomUUID(),
    assessment:crypto.randomUUID(),scope:crypto.randomUUID(),ra:crypto.randomUUID(),
    evidence:crypto.randomUUID(),revision:crypto.randomUUID(),link:crypto.randomUUID(),audit:crypto.randomUUID()
  };
  const content=Buffer.from("AgriS Compliance Assessment private blob smoke "+suffix+"\n","utf8");
  const expectedHash=crypto.createHash("sha256").update(content).digest("hex");
  let blob=null;
  const checks={};

  try{
    await sql`INSERT INTO org_units(id,code,name,unit_type,status) VALUES(${ids.org}::uuid,${"SMOKE-"+suffix},'Smoke Org','test','active')`;
    await sql`INSERT INTO compliance_frameworks(id,code,name,version,status,owner) VALUES(${ids.framework}::uuid,${"SMOKE-FW-"+suffix},'Smoke Framework','1','active',${admin.id})`;
    await sql`INSERT INTO compliance_requirements(id,code,title,assessable,status) VALUES(${ids.requirement}::uuid,${"SMOKE-REQ-"+suffix},'Private Blob Smoke Requirement',true,'active')`;
    await sql`INSERT INTO compliance_assessments(id,framework_id,name,status,lead_assessor) VALUES(${ids.assessment}::uuid,${ids.framework}::uuid,'Private Blob Smoke Assessment','in_progress',${admin.id})`;
    await sql`INSERT INTO assessment_scopes(id,assessment_id,org_unit_id,scope_note,include_all_requirements) VALUES(${ids.scope}::uuid,${ids.assessment}::uuid,${ids.org}::uuid,'isolated smoke fixture',true)`;
    await sql`INSERT INTO requirement_assessments(id,assessment_id,requirement_id,workflow_status,compliance_result,assessed_by) VALUES(${ids.ra}::uuid,${ids.assessment}::uuid,${ids.requirement}::uuid,'in_progress','not_assessed',${admin.id})`;

    assertOrgScope(admin,ids.org);
    checks.authenticatedAdmin=true;
    checks.positiveOrgScope=true;

    try{
      assertOrgScope({id:"synthetic-restricted-user",orgIds:[],role:"assessor"},ids.org);
      checks.negativeOrgScope=false;
      throw new Error("ORG_SCOPE_NEGATIVE_TEST_FAILED");
    }catch(e){
      if(e?.code==="ORG_SCOPE_FORBIDDEN") checks.negativeOrgScope=true;
      else throw e;
    }

    blob=await put("compliance-evidence/smoke-"+suffix+".txt",content,{access:"private",contentType:"text/plain"});
    checks.privateUpload=Boolean(blob?.url);

    const path=pathnameFromUrl(blob.url);
    const read=await get(path,{access:"private",useCache:false});
    if(!read?.stream)throw new Error("PRIVATE_BLOB_GET_NO_STREAM");
    const chunks=[];
    for await (const chunk of read.stream)chunks.push(Buffer.from(chunk));
    const readBody=Buffer.concat(chunks);
    checks.privateRead=readBody.equals(content);
    checks.sha256=crypto.createHash("sha256").update(readBody).digest("hex")===expectedHash;

    const unauth=await fetch(blob.url,{redirect:"manual"});
    checks.unauthenticatedDenied=unauth.status!==200;

    await sql`INSERT INTO evidence(id,name,evidence_type,source_system,confidentiality,status,owner_user_id,org_unit_id)
      VALUES(${ids.evidence}::uuid,'smoke-private-blob.txt','text/plain','Vercel Blob','internal','active',${admin.id},${ids.org}::uuid)`;
    await sql`INSERT INTO evidence_revisions(id,evidence_id,version,file_uri,original_filename,mime_type,sha256,captured_at,file_size,storage_provider)
      VALUES(${ids.revision}::uuid,${ids.evidence}::uuid,1,${blob.url},'smoke-private-blob.txt','text/plain',${expectedHash},now(),${content.length},'vercel_blob')`;
    await sql`INSERT INTO evidence_links(id,evidence_revision_id,target_type,target_id,purpose,linked_by)
      VALUES(${ids.link}::uuid,${ids.revision}::uuid,'RequirementAssessment',${ids.ra}::uuid,'smoke_test',${admin.id})`;
    await sql`INSERT INTO decision_logs(id,object_type,object_id,decision_type,from_state,to_state,reason,decided_by,approval_ref)
      VALUES(${ids.audit}::uuid,'EvidenceRevision',${ids.revision}::uuid,'private_blob_smoke',NULL,'verified','Authenticated production private Blob smoke test',${admin.id},'SMOKE-TEST')`;

    const verify=await sql`
      SELECT
        EXISTS(SELECT 1 FROM evidence WHERE id=${ids.evidence}::uuid AND owner_user_id=${admin.id} AND org_unit_id=${ids.org}::uuid) AS evidence_ok,
        EXISTS(SELECT 1 FROM evidence_revisions WHERE id=${ids.revision}::uuid AND sha256=${expectedHash} AND storage_provider='vercel_blob') AS revision_ok,
        EXISTS(SELECT 1 FROM evidence_links WHERE id=${ids.link}::uuid AND target_type='RequirementAssessment' AND target_id=${ids.ra}::uuid) AS link_ok,
        EXISTS(SELECT 1 FROM decision_logs WHERE id=${ids.audit}::uuid AND decision_type='private_blob_smoke' AND decided_by=${admin.id}) AS audit_ok
    `;
    Object.assign(checks,verify[0]||{});
    checks.pass=Object.values(checks).every(v=>v===true);

    const result={ok:checks.pass,user:{id:admin.id,email:admin.email,role:admin.role},checks,fixture:{assessmentId:ids.assessment,requirementAssessmentId:ids.ra},cleanup:"pending"};

    // cleanup before responding
    await sql`DELETE FROM decision_logs WHERE id=${ids.audit}::uuid`;
    await sql`DELETE FROM evidence_links WHERE id=${ids.link}::uuid`;
    await sql`DELETE FROM evidence_revisions WHERE id=${ids.revision}::uuid`;
    await sql`DELETE FROM evidence WHERE id=${ids.evidence}::uuid`;
    await sql`DELETE FROM requirement_assessments WHERE id=${ids.ra}::uuid`;
    await sql`DELETE FROM assessment_scopes WHERE id=${ids.scope}::uuid`;
    await sql`DELETE FROM compliance_assessments WHERE id=${ids.assessment}::uuid`;
    await sql`DELETE FROM compliance_requirements WHERE id=${ids.requirement}::uuid`;
    await sql`DELETE FROM compliance_frameworks WHERE id=${ids.framework}::uuid`;
    await sql`DELETE FROM org_units WHERE id=${ids.org}::uuid`;
    await del(path);
    result.cleanup="complete";

    return html(res,checks.pass?200:500,`<h1 class="${checks.pass?"ok":"bad"}">${checks.pass?"PASS":"FAIL"}</h1><p>Authenticated private Blob production smoke test.</p><pre>${JSON.stringify(result,null,2)}</pre><p>You can close this tab and return to ChatGPT.</p>`);
  }catch(error){
    console.error("private blob smoke failed",error);
    try{
      await sql`DELETE FROM decision_logs WHERE id=${ids.audit}::uuid`;
      await sql`DELETE FROM evidence_links WHERE id=${ids.link}::uuid`;
      await sql`DELETE FROM evidence_revisions WHERE id=${ids.revision}::uuid`;
      await sql`DELETE FROM evidence WHERE id=${ids.evidence}::uuid`;
      await sql`DELETE FROM requirement_assessments WHERE id=${ids.ra}::uuid`;
      await sql`DELETE FROM assessment_scopes WHERE id=${ids.scope}::uuid`;
      await sql`DELETE FROM compliance_assessments WHERE id=${ids.assessment}::uuid`;
      await sql`DELETE FROM compliance_requirements WHERE id=${ids.requirement}::uuid`;
      await sql`DELETE FROM compliance_frameworks WHERE id=${ids.framework}::uuid`;
      await sql`DELETE FROM org_units WHERE id=${ids.org}::uuid`;
    }catch{}
    try{if(blob?.url)await del(pathnameFromUrl(blob.url));}catch{}
    return html(res,500,`<h1 class="bad">FAIL</h1><pre>${String(error?.stack||error)}</pre><p>Cleanup attempted.</p>`);
  }
}
