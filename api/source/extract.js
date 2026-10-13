import { extractDocumentText, documentIntelligenceReadiness } from "../../lib/document-intelligence.js";
import { extractObligationsHybrid, aiExtractionReadiness } from "../../lib/ai-obligation-extractor.js";
import { normalizedMode, sqlClient, asUuid } from "../../lib/db.js";
import { requireUser, assertPermission } from "../../lib/server-authz.js";
import { assessmentSourceContext, assertExtractableSourceContext, scopeContextFromAssessmentSource } from "../../lib/source-context.js";
import { persistDraftObligations } from "../../lib/draft-requirement-store.js";

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

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method==="GET"){
    return res.status(200).json({ok:true,...documentIntelligenceReadiness(),maxBytes:MAX_BYTES,ai:aiExtractionReadiness(),assessmentScoped:true});
  }
  if(req.method!=="POST"){
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }
  try{
    const sourceId=String(req.headers["x-source-id"]||"");
    const assessmentId=String(req.headers["x-assessment-id"]||"");
    let sql=null,scopeContext={};
    if(normalizedMode()){
      const auth=await requireUser(req);
      if(!auth.ok)return res.status(auth.status).json({ok:false,error:auth.error});
      assertPermission(auth.user,"manage_framework");
      if(!asUuid(sourceId))return res.status(400).json({ok:false,error:"VALID_SOURCE_ID_REQUIRED"});
      if(!asUuid(assessmentId))return res.status(400).json({ok:false,error:"VALID_ASSESSMENT_ID_REQUIRED"});
      sql=sqlClient();
      const ctx=await assessmentSourceContext(sql,{sourceId,assessmentId});
      try{assertExtractableSourceContext(ctx)}catch(e){return res.status(e.status||409).json({ok:false,error:e.code||e.message})}
      scopeContext=scopeContextFromAssessmentSource(ctx);
    }

    const body=await readBody(req);
    const name=decodeURIComponent(String(req.headers["x-file-name"]||"source"));
    const type=String(req.headers["content-type"]||"application/octet-stream");
    const extracted=await extractDocumentText(body,{name,type,minTextLength:20});
    if(extracted.ocrRequired){
      return res.status(422).json({ok:false,error:"OCR_REQUIRED",ocrRequired:true,name,type,method:extracted.method,ocrConfigured:documentIntelligenceReadiness().ocrConfigured});
    }

    const text=extracted.text;
    const hybrid=await extractObligationsHybrid(text,sourceId||null,{assessmentId:assessmentId||null,scopeContext,preferAI:true});
    let obligations=hybrid.obligations;

    if(normalizedMode()){
      obligations=await persistDraftObligations(sql,{sourceId,assessmentId,hybrid,obligations});
      await sql`
        UPDATE compliance_sources SET status='extracted',original_filename=${name},mime_type=${type},
          extracted_at=now(),updated_at=now()
        WHERE id=${sourceId}::uuid
      `;
    }

    return res.status(200).json({
      ok:true,name,type,text:text.slice(0,250000),count:obligations.length,obligations,
      engine:hybrid.engine,schemaVersion:hybrid.schemaVersion||"v2",
      aiUsed:hybrid.aiUsed,aiFallback:Boolean(hybrid.aiFallback),humanReviewRequired:true,assessmentScoped:true,
      extraction:{method:extracted.method,ocrUsed:Boolean(extracted.ocrUsed),confidence:extracted.confidence??null},
      persisted:normalizedMode()
    });
  }catch(error){
    if(error?.code==="FILE_TOO_LARGE")return res.status(413).json({ok:false,error:"FILE_TOO_LARGE"});
    if(error?.code==="UNSUPPORTED_FILE")return res.status(415).json({ok:false,error:"UNSUPPORTED_FILE",ocrRequired:false});
    if(error?.code==="OCR_PROVIDER_ERROR"||error?.code==="OCR_EMPTY_RESULT")return res.status(502).json({ok:false,error:error.code});
    console.error("source extract error",error);
    return res.status(500).json({ok:false,error:"SOURCE_EXTRACTION_ERROR"});
  }
}
