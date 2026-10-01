import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { put, get, del } from "@vercel/blob";
import { clerkConfigured, requireAdmin } from "./clerk-auth.js";
import { assertOrgScope } from "./server-authz.js";
import { sqlClient } from "./db.js";


function blobPath(url){
  const u=new URL(url);
  return decodeURIComponent(u.pathname.replace(/^\/+/,""));
}

function smokeHtml(res,status,title,payload){
  res.status(status);
  res.setHeader("Content-Type","text/html; charset=utf-8");
  return res.end(\`<!doctype html><meta charset="utf-8"><title>\${title}</title>
  <style>body{font-family:system-ui;margin:40px;max-width:960px;background:#fafafa;color:#18251d}
  h1{color:\${status===200?"#087a2b":"#b42318"}}pre{background:#111;color:#eee;padding:18px;border-radius:10px;overflow:auto}</style>
  <h1>\${title}</h1><pre>\${JSON.stringify(payload,null,2)}</pre><p>Có thể đóng tab này.</p>\`);
}

async function runPrivateBlobSmoke(req,res){
  const admin=await requireAdmin(req);
  if(!admin)return smokeHtml(res,403,"AUTH REQUIRED",{ok:false,error:"ADMIN_REQUIRED"});

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

  async function cleanup(){
    const errors=[];
    const ops=[
      ()=>sql\`DELETE FROM decision_logs WHERE id=\${ids.audit}::uuid\`,
      ()=>sql\`DELETE FROM evidence_links WHERE id=\${ids.link}::uuid\`,
      ()=>sql\`DELETE FROM evidence_revisions WHERE id=\${ids.revision}::uuid\`,
      ()=>sql\`DELETE FROM evidence WHERE id=\${ids.evidence}::uuid\`,
      ()=>sql\`DELETE FROM requirement_assessments WHERE id=\${ids.ra}::uuid\`,
      ()=>sql\`DELETE FROM assessment_scopes WHERE id=\${ids.scope}::uuid\`,
      ()=>sql\`DELETE FROM compliance_assessments WHERE id=\${ids.assessment}::uuid\`,
      ()=>sql\`DELETE FROM compliance_requirements WHERE id=\${ids.requirement}::uuid\`,
      ()=>sql\`DELETE FROM compliance_frameworks WHERE id=\${ids.framework}::uuid\`,
      ()=>sql\`DELETE FROM org_units WHERE id=\${ids.org}::uuid\`
    ];
    for(const op of ops){try{await op();}catch(e){errors.push(String(e?.message||e));}}
    if(blob?.url){try{await del(blobPath(blob.url));}catch(e){errors.push("blob:"+String(e?.message||e));}}
    return errors;
  }

  try{
    await sql\`INSERT INTO org_units(id,code,name,unit_type,status) VALUES(\${ids.org}::uuid,\${"SMOKE-"+suffix},'Smoke Org','test','active')\`;
    await sql\`INSERT INTO compliance_frameworks(id,code,name,version,status,owner) VALUES(\${ids.framework}::uuid,\${"SMOKE-FW-"+suffix},'Smoke Framework','1','active',\${admin.id})\`;
    await sql\`INSERT INTO compliance_requirements(id,code,title,assessable,status) VALUES(\${ids.requirement}::uuid,\${"SMOKE-REQ-"+suffix},'Private Blob Smoke Requirement',true,'active')\`;
    await sql\`INSERT INTO compliance_assessments(id,framework_id,name,status,lead_assessor) VALUES(\${ids.assessment}::uuid,\${ids.framework}::uuid,'Private Blob Smoke Assessment','in_progress',\${admin.id})\`;
    await sql\`INSERT INTO assessment_scopes(id,assessment_id,org_unit_id,scope_note,include_all_requirements) VALUES(\${ids.scope}::uuid,\${ids.assessment}::uuid,\${ids.org}::uuid,'isolated smoke fixture',true)\`;
    await sql\`INSERT INTO requirement_assessments(id,assessment_id,requirement_id,workflow_status,compliance_result,assessed_by) VALUES(\${ids.ra}::uuid,\${ids.assessment}::uuid,\${ids.requirement}::uuid,'in_progress','not_assessed',\${admin.id})\`;

    checks.authenticatedAdmin=true;
    assertOrgScope(admin,ids.org);
    checks.positiveOrgScope=true;
    try{
      assertOrgScope({id:"synthetic-restricted",orgIds:[],role:"assessor"},ids.org);
      checks.negativeOrgScope=false;
    }catch(e){
      checks.negativeOrgScope=e?.code==="ORG_SCOPE_FORBIDDEN";
    }

    blob=await put("compliance-evidence/smoke-"+suffix+".txt",content,{access:"private",contentType:"text/plain"});
    checks.privateUpload=Boolean(blob?.url);

    const read=await get(blobPath(blob.url),{access:"private",useCache:false});
    if(!read?.stream)throw new Error("PRIVATE_BLOB_GET_NO_STREAM");
    const chunks=[];
    for await (const chunk of read.stream)chunks.push(Buffer.from(chunk));
    const readBody=Buffer.concat(chunks);
    checks.privateRead=readBody.equals(content);
    checks.sha256=crypto.createHash("sha256").update(readBody).digest("hex")===expectedHash;

    const unauth=await fetch(blob.url,{redirect:"manual"});
    checks.unauthenticatedDenied=unauth.status!==200;

    await sql\`INSERT INTO evidence(id,name,evidence_type,source_system,confidentiality,status,owner_user_id,org_unit_id)
      VALUES(\${ids.evidence}::uuid,'smoke-private-blob.txt','text/plain','Vercel Blob','internal','active',\${admin.id},\${ids.org}::uuid)\`;
    await sql\`INSERT INTO evidence_revisions(id,evidence_id,version,file_uri,original_filename,mime_type,sha256,captured_at,file_size,storage_provider)
      VALUES(\${ids.revision}::uuid,\${ids.evidence}::uuid,1,\${blob.url},'smoke-private-blob.txt','text/plain',\${expectedHash},now(),\${content.length},'vercel_blob')\`;
    await sql\`INSERT INTO evidence_links(id,evidence_revision_id,target_type,target_id,purpose,linked_by)
      VALUES(\${ids.link}::uuid,\${ids.revision}::uuid,'RequirementAssessment',\${ids.ra}::uuid,'smoke_test',\${admin.id})\`;
    await sql\`INSERT INTO decision_logs(id,object_type,object_id,decision_type,from_state,to_state,reason,decided_by,approval_ref)
      VALUES(\${ids.audit}::uuid,'EvidenceRevision',\${ids.revision}::uuid,'private_blob_smoke',NULL,'verified','Authenticated production private Blob smoke test',\${admin.id},'SMOKE-TEST')\`;

    const verify=await sql\`
      SELECT
        EXISTS(SELECT 1 FROM evidence WHERE id=\${ids.evidence}::uuid AND owner_user_id=\${admin.id} AND org_unit_id=\${ids.org}::uuid) AS evidence_ok,
        EXISTS(SELECT 1 FROM evidence_revisions WHERE id=\${ids.revision}::uuid AND sha256=\${expectedHash} AND storage_provider='vercel_blob') AS revision_ok,
        EXISTS(SELECT 1 FROM evidence_links WHERE id=\${ids.link}::uuid AND target_type='RequirementAssessment' AND target_id=\${ids.ra}::uuid) AS link_ok,
        EXISTS(SELECT 1 FROM decision_logs WHERE id=\${ids.audit}::uuid AND decision_type='private_blob_smoke' AND decided_by=\${admin.id}) AS audit_ok
    \`;
    Object.assign(checks,verify[0]||{});
    checks.pass=[
      "authenticatedAdmin","positiveOrgScope","negativeOrgScope","privateUpload","privateRead",
      "sha256","unauthenticatedDenied","evidence_ok","revision_ok","link_ok","audit_ok"
    ].every(k=>checks[k]===true);

    const cleanupErrors=await cleanup();
    return smokeHtml(res,checks.pass&&cleanupErrors.length===0?200:500,
      checks.pass&&cleanupErrors.length===0?"PASS":"FAIL",
      {ok:checks.pass&&cleanupErrors.length===0,user:{email:admin.email,role:admin.role},checks,cleanup:{complete:cleanupErrors.length===0,errors:cleanupErrors}});
  }catch(error){
    const cleanupErrors=await cleanup();
    return smokeHtml(res,500,"FAIL",{ok:false,error:String(error?.stack||error),checks,cleanup:{complete:cleanupErrors.length===0,errors:cleanupErrors}});
  }
}

const roles = {
  compliance_admin:["view_dashboard","manage_framework","approve_framework","manage_assessment","conduct_fieldwork","review_ai","confirm_finding","assign_action","verify_action","view_reports","administer_access"],
  compliance_manager:["view_dashboard","manage_framework","approve_framework","manage_assessment","conduct_fieldwork","review_ai","confirm_finding","assign_action","verify_action","view_reports"],
  lead_assessor:["view_dashboard","conduct_fieldwork","review_ai","confirm_finding","assign_action","verify_action","view_reports"],
  assessor:["view_dashboard","conduct_fieldwork","review_ai","view_reports"],
  reviewer:["view_dashboard","review_ai","confirm_finding","verify_action","view_reports"],
  unit_owner:["view_dashboard","respond_finding","update_assigned_action","view_reports"],
  viewer:["view_dashboard","view_reports"]
};

export async function handleSystem(req,res,route){
  res.setHeader("Cache-Control","no-store");

  if(route==="private-blob-smoke"){
    return runPrivateBlobSmoke(req,res);
  }

  if(route==="health"){
    return res.status(200).json({
      ok:true,
      service:"AgriS Compliance Assessment",
      version:"0.8.0",
      databaseConfigured:Boolean(process.env.DATABASE_URL),
      authConfigured:clerkConfigured(),
      evidenceStorageConfigured:Boolean(process.env.BLOB_STORE_ID||process.env.BLOB_READ_WRITE_TOKEN),
      timestamp:new Date().toISOString()
    });
  }

  if(route==="access"){
    return res.status(200).json({
      ok:true,
      authConfigured:clerkConfigured(),
      authMode:process.env.AUTH_MODE||"not-configured",
      enforcement:"server-side-rbac-and-org-scope-ready",
      roles
    });
  }

  if(route!=="readiness")return res.status(404).json({ok:false,error:"SYSTEM_ROUTE_NOT_FOUND"});

  const databaseConfigured=Boolean(process.env.DATABASE_URL);
  let normalizedReady=false,productionCoreReady=false,stateStoreReady=false,dbError=null;
  if(databaseConfigured){
    try{
      const sql=neon(process.env.DATABASE_URL);
      const rows=await sql`
        SELECT
          to_regclass('public.compliance_app_state') IS NOT NULL AS state_store,
          to_regclass('public.compliance_requirements') IS NOT NULL
            AND to_regclass('public.notifications') IS NOT NULL
            AND to_regclass('public.app_users') IS NOT NULL AS normalized_ready
      `;
      stateStoreReady=Boolean(rows[0]?.state_store);
      normalizedReady=Boolean(rows[0]?.normalized_ready);
      if(normalizedReady){
        const core=await sql`
          SELECT
            to_regclass('public.draft_requirements') IS NOT NULL AS draft_requirements,
            to_regclass('public.unit_responses') IS NOT NULL AS unit_responses,
            to_regclass('public.assessment_assignments') IS NOT NULL AS assignments,
            to_regclass('public.evidence_links') IS NOT NULL AS evidence_links
        `;
        productionCoreReady=Object.values(core[0]||{}).every(Boolean);
      }
    }catch(e){dbError="DATABASE_CHECK_FAILED"}
  }

  const missing=[];
  if(process.env.AUTH_MODE!=="clerk")missing.push("AUTH_MODE=clerk");
  for(const k of ["CLERK_PUBLISHABLE_KEY","CLERK_SECRET_KEY","APP_URL"])if(!process.env[k])missing.push(k);
  if(!process.env.DATABASE_URL)missing.push("DATABASE_URL");
  if(!process.env.BLOB_STORE_ID&&!process.env.BLOB_READ_WRITE_TOKEN)missing.push("Vercel Blob");
  if(process.env.DATA_MODE!=="normalized")missing.push("DATA_MODE=normalized");

  return res.status(200).json({
    ok:true,
    version:"0.8.0",
    productionReady:clerkConfigured()&&databaseConfigured&&normalizedReady&&productionCoreReady&&Boolean(process.env.BLOB_STORE_ID||process.env.BLOB_READ_WRITE_TOKEN)&&process.env.DATA_MODE==="normalized",
    missing,
    auth:{configured:clerkConfigured(),mode:process.env.AUTH_MODE||null,provider:process.env.AUTH_MODE==="clerk"?"Clerk":null,invitationOnly:true},
    database:{configured:databaseConfigured,stateStoreReady,normalizedReady,productionCoreReady,dataMode:process.env.DATA_MODE||"shared-json",error:dbError},
    storage:{configured:Boolean(process.env.BLOB_STORE_ID||process.env.BLOB_READ_WRITE_TOKEN),provider:(process.env.BLOB_STORE_ID||process.env.BLOB_READ_WRITE_TOKEN)?"Vercel Blob":null,authMode:process.env.BLOB_READ_WRITE_TOKEN?"token":"oidc"},
    search:{regulationProviderConfigured:Boolean(process.env.REGULATION_SEARCH_PROVIDER)},
    ai:{configured:Boolean(process.env.AI_GATEWAY_API_KEY&&process.env.AI_EXTRACTION_MODEL)}
  });
}
