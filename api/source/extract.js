import crypto from "node:crypto";
import { extractObligations } from "../../lib/obligation-extractor.js";
import { normalizedMode, sqlClient, asUuid } from "../../lib/db.js";
import { requireUser, assertPermission } from "../../lib/server-authz.js";

export const config={api:{bodyParser:false}};
const MAX_BYTES=8*1024*1024;

async function readBody(req){
  const chunks=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>MAX_BYTES)throw Object.assign(new Error("FILE_TOO_LARGE"),{code:"FILE_TOO_LARGE"});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function extractText(buffer,name,type){
  const lower=(name||"").toLowerCase();
  if(type.startsWith("text/")||/\.(txt|md|csv|json|xml|html?)$/.test(lower)){
    return buffer.toString("utf8");
  }
  if(type==="application/pdf"||lower.endsWith(".pdf")){
    const mod=await import("pdf-parse");
    const pdf=mod.default||mod;
    const data=await pdf(buffer);
    return data.text||"";
  }
  if(/wordprocessingml|msword/.test(type)||lower.endsWith(".docx")){
    const mod=await import("mammoth");
    const mammoth=mod.default||mod;
    const data=await mammoth.extractRawText({buffer});
    return data.value||"";
  }
  throw Object.assign(new Error("UNSUPPORTED_FILE"),{code:"UNSUPPORTED_FILE"});
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method==="GET"){
    return res.status(200).json({
      ok:true,
      supported:["txt","md","csv","json","xml","html","pdf","docx"],
      maxBytes:MAX_BYTES,
      ocrConfigured:false
    });
  }
  if(req.method!=="POST"){
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }
  try{
    const body=await readBody(req);
    const name=decodeURIComponent(String(req.headers["x-file-name"]||"source"));
    const type=String(req.headers["content-type"]||"application/octet-stream");
    const text=await extractText(body,name,type);
    if(!String(text||"").trim()||String(text).trim().length<20){
      return res.status(422).json({ok:false,error:"OCR_REQUIRED",ocrRequired:true,name,type});
    }
    let sourceId=String(req.headers["x-source-id"]||"");
    let obligations=extractObligations(text,sourceId||null);

    if(normalizedMode()){
      const auth=await requireUser(req);
      if(!auth.ok)return res.status(auth.status).json({ok:false,error:auth.error});
      assertPermission(auth.user,"manage_framework");
      if(!asUuid(sourceId))return res.status(400).json({ok:false,error:"VALID_SOURCE_ID_REQUIRED"});
      const sql=sqlClient();
      const exists=await sql`SELECT id::text FROM compliance_sources WHERE id=${sourceId}::uuid`;
      if(!exists.length)return res.status(404).json({ok:false,error:"SOURCE_NOT_FOUND"});
      await sql`DELETE FROM draft_requirements WHERE source_id=${sourceId}::uuid AND review_status<>'published'`;
      const persisted=[];
      for(const o of obligations){
        const id=crypto.randomUUID();
        await sql`
          INSERT INTO draft_requirements
            (id,source_id,source_clause,original_text,obligation,applicability,obligation_type,
             mandatory_level,expected_evidence,test_procedure,review_status,created_at,updated_at)
          VALUES
            (${id}::uuid,${sourceId}::uuid,${o.sourceClause||null},${o.originalText||null},${o.obligation},
             ${o.applicability||null},${o.obligationType||"general"},${o.mandatoryLevel||"review"},
             ${o.expectedEvidence||null},${o.testProcedure||null},'draft',now(),now())
        `;
        persisted.push({...o,id,sourceId});
      }
      await sql`
        UPDATE compliance_sources SET status='extracted',original_filename=${name},mime_type=${type},
          extracted_at=now(),updated_at=now()
        WHERE id=${sourceId}::uuid
      `;
      obligations=persisted;
    }

    return res.status(200).json({
      ok:true,name,type,text:text.slice(0,250000),
      count:obligations.length,obligations,
      engine:"file-text+rule-v0.2",
      persisted:normalizedMode()
    });
  }catch(error){
    if(error?.code==="FILE_TOO_LARGE")return res.status(413).json({ok:false,error:"FILE_TOO_LARGE"});
    if(error?.code==="UNSUPPORTED_FILE")return res.status(415).json({ok:false,error:"UNSUPPORTED_FILE",ocrRequired:true});
    console.error("source extract error",error);
    return res.status(500).json({ok:false,error:"SOURCE_EXTRACTION_ERROR"});
  }
}
