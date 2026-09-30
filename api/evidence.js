import crypto from "node:crypto";
import { put, get, del } from "@vercel/blob";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { clerkConfigured, userContext } from "../lib/clerk-auth.js";
import { normalizedMode, sqlClient } from "../lib/db.js";
import { assertOrgScope, hasPermission } from "../lib/server-authz.js";

export const config = { api: { bodyParser: false } };

const MAX_BYTES = 8 * 1024 * 1024;


async function revisionContext(sql,revisionId){
  const rows=await sql`
    SELECT r.id::text AS "revisionId",r.file_uri AS "fileUri",r.original_filename AS "originalFilename",
           r.mime_type AS "mimeType",r.file_size AS "fileSize",r.sha256,
           e.id::text AS "evidenceId",e.org_unit_id::text AS "orgId",e.status,
           COUNT(l.id)::int AS "linkCount"
    FROM evidence_revisions r
    JOIN evidence e ON e.id=r.evidence_id
    LEFT JOIN evidence_links l ON l.evidence_revision_id=r.id
    WHERE r.id=${revisionId}::uuid
    GROUP BY r.id,e.id
  `;
  return rows[0]||null;
}

function blobPathname(fileUri){
  try{
    const u=new URL(fileUri);
    const raw=u.pathname.replace(/^\/+/, "");
    try{return decodeURIComponent(raw)}catch(_){return raw}
  }catch(_){
    return String(fileUri||"").replace(/^\/+/, "");
  }
}

function contentDisposition(filename,mode){
  const name=String(filename||"evidence.bin").replace(/[\r\n"]/g,"_");
  const ascii=name.replace(/[^\x20-\x7E]/g,"_");
  const kind=mode==="download"?"attachment":"inline";
  return kind+'; filename="'+ascii+'"; filename*=UTF-8\'\''+encodeURIComponent(name);
}

async function streamEvidence(req,res,session){
  if(!normalizedMode())return res.status(409).json({ok:false,error:"NORMALIZED_MODE_REQUIRED"});
  const revisionId=String(req.query?.revisionId||"");
  if(!revisionId)return null;
  const sql=sqlClient();
  const ctx=await revisionContext(sql,revisionId);
  if(!ctx||ctx.status!=="active")return res.status(404).json({ok:false,error:"EVIDENCE_NOT_FOUND"});
  if(!ctx.orgId)return res.status(403).json({ok:false,error:"EVIDENCE_SCOPE_UNRESOLVED"});
  assertOrgScope(session,ctx.orgId);
  if(!ctx.fileUri)return res.status(404).json({ok:false,error:"EVIDENCE_FILE_MISSING"});

  const pathname=blobPathname(ctx.fileUri);
  if(!pathname)return res.status(404).json({ok:false,error:"EVIDENCE_PATH_MISSING"});
  const options={access:"private",useCache:false};
  if(process.env.BLOB_READ_WRITE_TOKEN)options.token=process.env.BLOB_READ_WRITE_TOKEN;
  const result=await get(pathname,options);
  if(!result||!result.stream)return res.status(404).json({ok:false,error:"EVIDENCE_BLOB_NOT_FOUND"});

  const mode=String(req.query?.mode||"inline")==="download"?"download":"inline";
  const contentType=result.blob?.contentType||ctx.mimeType||"application/octet-stream";
  res.statusCode=200;
  res.setHeader("Content-Type",contentType);
  res.setHeader("Content-Disposition",contentDisposition(ctx.originalFilename,mode));
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Cache-Control","private, no-store");
  if(ctx.fileSize)res.setHeader("Content-Length",String(ctx.fileSize));

  const stream=result.stream;
  const nodeStream=typeof stream.pipe==="function"?stream:Readable.fromWeb(stream);
  await pipeline(nodeStream,res);
  return true;
}

async function targetContext(sql,targetType,targetId){
  if(targetType==="RequirementAssessment"){
    const rows=await sql`
      SELECT ra.id::text,s.org_unit_id::text AS "orgId"
      FROM requirement_assessments ra
      LEFT JOIN LATERAL (
        SELECT org_unit_id FROM assessment_scopes s0 WHERE s0.assessment_id=ra.assessment_id ORDER BY s0.id LIMIT 1
      ) s ON true
      WHERE ra.id=${targetId}::uuid
    `;
    return rows[0]||null;
  }
  if(targetType==="RemediationAction"){
    const rows=await sql`
      SELECT a.id::text,a.owner_identity_id AS "ownerIdentityId",s.org_unit_id::text AS "orgId"
      FROM remediation_actions a
      JOIN findings f ON f.id=a.finding_id
      JOIN requirement_assessments ra ON ra.id=f.requirement_assessment_id
      LEFT JOIN LATERAL (
        SELECT org_unit_id FROM assessment_scopes s0 WHERE s0.assessment_id=ra.assessment_id ORDER BY s0.id LIMIT 1
      ) s ON true
      WHERE a.id=${targetId}::uuid
    `;
    return rows[0]||null;
  }
  return null;
}


async function readBody(req){
  var chunks=[],size=0;
  for await (const chunk of req){
    size+=chunk.length;
    if(size>MAX_BYTES) throw Object.assign(new Error("FILE_TOO_LARGE"),{code:"FILE_TOO_LARGE"});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}


export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");

  if(req.method==="GET"){
    const revisionId=String(req.query?.revisionId||"");
    if(!revisionId){
      return res.status(200).json({
        ok:true,
        configured:Boolean(process.env.BLOB_STORE_ID||process.env.BLOB_READ_WRITE_TOKEN),
        authConfigured:clerkConfigured(),
        authMode:process.env.BLOB_READ_WRITE_TOKEN?"token":"oidc",
        maxBytes:MAX_BYTES,
        privateRead:true
      });
    }
    if(!process.env.BLOB_STORE_ID&&!process.env.BLOB_READ_WRITE_TOKEN){
      return res.status(503).json({ok:false,error:"BLOB_NOT_CONFIGURED"});
    }
    if(!clerkConfigured())return res.status(403).json({ok:false,error:"AUTH_NOT_CONFIGURED"});
    const session=await userContext(req);
    if(!session)return res.status(401).json({ok:false,error:"AUTH_REQUIRED"});
    if(!session.provisioned||session.status!=="active")return res.status(403).json({ok:false,error:"USER_NOT_PROVISIONED"});
    try{
      return await streamEvidence(req,res,session);
    }catch(error){
      console.error("evidence read error",error);
      return res.status(Number(error?.status||500)).json({ok:false,error:error?.code||"EVIDENCE_READ_ERROR"});
    }
  }

  if(req.method!=="POST"){
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }

  if(!process.env.BLOB_STORE_ID&&!process.env.BLOB_READ_WRITE_TOKEN){
    return res.status(503).json({ok:false,error:"BLOB_NOT_CONFIGURED"});
  }

  if(!clerkConfigured()){
    return res.status(403).json({ok:false,error:"AUTH_NOT_CONFIGURED"});
  }
  const session=await userContext(req);
  if(!session)return res.status(401).json({ok:false,error:"AUTH_REQUIRED"});
  if(!session.provisioned||session.status!=="active")return res.status(403).json({ok:false,error:"USER_NOT_PROVISIONED"});

  try{
    let sql=null,ctx=null,targetType="",targetId="",purpose="supporting_evidence";
    if(normalizedMode()){
      targetType=String(req.headers["x-target-type"]||"");
      targetId=String(req.headers["x-target-id"]||"");
      purpose=String(req.headers["x-evidence-purpose"]||"supporting_evidence");
      if(!["RequirementAssessment","RemediationAction"].includes(targetType)||!targetId){
        return res.status(400).json({ok:false,error:"NORMALIZED_TARGET_REQUIRED"});
      }
      sql=sqlClient();
      ctx=await targetContext(sql,targetType,targetId);
      if(!ctx)return res.status(404).json({ok:false,error:"TARGET_NOT_FOUND"});
      assertOrgScope(session,ctx.orgId);
      if(targetType==="RequirementAssessment"&&!hasPermission(session,"conduct_fieldwork")){
        return res.status(403).json({ok:false,error:"FORBIDDEN"});
      }
      if(targetType==="RemediationAction"){
        const owner=ctx.ownerIdentityId===session.id;
        const allowed=owner||hasPermission(session,"update_assigned_action")||hasPermission(session,"assign_action");
        if(!allowed)return res.status(403).json({ok:false,error:"FORBIDDEN"});
      }
    }

    const body=await readBody(req);
    const original=(req.headers["x-file-name"]||"evidence.bin").toString();
    const safe=original.replace(/[^a-zA-Z0-9._-]+/g,"_").slice(-160);
    const contentType=(req.headers["content-type"]||"application/octet-stream").toString();
    const pathname="compliance-evidence/"+Date.now()+"-"+safe;
    const blobOptions={access:"private",contentType};
    if(process.env.BLOB_READ_WRITE_TOKEN)blobOptions.token=process.env.BLOB_READ_WRITE_TOKEN;
    const blob=await put(pathname,body,blobOptions);

    let normalizedRecord=null;
    if(normalizedMode()){
      const evidenceId=crypto.randomUUID(),revisionId=crypto.randomUUID(),linkId=crypto.randomUUID();
      const sha256=crypto.createHash("sha256").update(body).digest("hex");
      try{
        await sql.transaction([
          sql`
            INSERT INTO evidence(id,name,evidence_type,source_system,confidentiality,status,owner_user_id,org_unit_id,created_at)
            VALUES(${evidenceId}::uuid,${original},${contentType},'Vercel Blob','internal','active',${session.id},${ctx.orgId}::uuid,now())
          `,
          sql`
            INSERT INTO evidence_revisions
              (id,evidence_id,version,file_uri,original_filename,mime_type,sha256,captured_at,file_size,storage_provider,created_at)
            VALUES
              (${revisionId}::uuid,${evidenceId}::uuid,1,${blob.url},${original},${contentType},${sha256},now(),${body.length},'vercel_blob',now())
          `,
          sql`
            INSERT INTO evidence_links(id,evidence_revision_id,target_type,target_id,purpose,linked_by,linked_at)
            VALUES(${linkId}::uuid,${revisionId}::uuid,${targetType},${targetId}::uuid,${purpose},${session.id},now())
          `
        ]);
      }catch(error){
        try{
          const deleteOptions={};
          if(process.env.BLOB_READ_WRITE_TOKEN)deleteOptions.token=process.env.BLOB_READ_WRITE_TOKEN;
          await del(blob.url,deleteOptions);
        }catch(cleanupError){
          console.error("evidence blob cleanup error",cleanupError);
        }
        throw error;
      }
      normalizedRecord={evidenceId,revisionId,linkId,sha256,targetType,targetId,purpose};
    }

    return res.status(200).json({
      ok:true,
      pathname:blob.pathname,
      url:blob.url,
      downloadUrl:blob.downloadUrl||null,
      contentType:blob.contentType||contentType,
      size:body.length,
      normalizedRecord
    });
  }catch(error){
    if(error&&error.code==="FILE_TOO_LARGE")return res.status(413).json({ok:false,error:"FILE_TOO_LARGE"});
    console.error("evidence upload error",error);
    return res.status(500).json({ok:false,error:"EVIDENCE_UPLOAD_ERROR"});
  }
}
