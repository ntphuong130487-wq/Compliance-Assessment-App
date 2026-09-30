import crypto from "node:crypto";
import { extractDocumentText, documentIntelligenceReadiness } from "../../lib/document-intelligence.js";
import { extractObligationsHybrid, aiExtractionReadiness } from "../../lib/ai-obligation-extractor.js";
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

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method==="GET"){
    return res.status(200).json({
      ok:true,
      ...documentIntelligenceReadiness(),
      maxBytes:MAX_BYTES,
      ai:aiExtractionReadiness()
    });
  }
  if(req.method!=="POST"){
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }
  try{
    let sourceId=String(req.headers["x-source-id"]||"");
    let sql=null;
    if(normalizedMode()){
      const auth=await requireUser(req);
      if(!auth.ok)return res.status(auth.status).json({ok:false,error:auth.error});
      assertPermission(auth.user,"manage_framework");
      if(!asUuid(sourceId))return res.status(400).json({ok:false,error:"VALID_SOURCE_ID_REQUIRED"});
      sql=sqlClient();
      const exists=await sql`SELECT id::text FROM compliance_sources WHERE id=${sourceId}::uuid`;
      if(!exists.length)return res.status(404).json({ok:false,error:"SOURCE_NOT_FOUND"});
    }

    const body=await readBody(req);
    const name=decodeURIComponent(String(req.headers["x-file-name"]||"source"));
    const type=String(req.headers["content-type"]||"application/octet-stream");
    const extracted=await extractDocumentText(body,{name,type,minTextLength:20});
    if(extracted.ocrRequired){
      return res.status(422).json({ok:false,error:"OCR_REQUIRED",ocrRequired:true,name,type,method:extracted.method,ocrConfigured:documentIntelligenceReadiness().ocrConfigured});
    }
    const text=extracted.text;
    const hybrid=await extractObligationsHybrid(text,sourceId||null,{preferAI:true});
    let obligations=hybrid.obligations;

    if(normalizedMode()){
      await sql`DELETE FROM draft_requirements WHERE source_id=${sourceId}::uuid AND review_status<>'published'`;
      const persisted=[];
      for(const o of obligations){
        const id=crypto.randomUUID();
        await sql`
          INSERT INTO draft_requirements
            (id,source_id,source_clause,original_text,obligation,applicability,obligation_type,
             mandatory_level,expected_evidence,test_procedure,review_status,
             ai_generated,ai_confidence,ai_engine,ai_schema_version,ai_field_confidence,
             ai_review_reasons,ai_uncertainties,ai_payload,created_at,updated_at)
          VALUES
            (${id}::uuid,${sourceId}::uuid,${o.sourceClause||null},${o.originalText||null},${o.obligation},
             ${o.applicability||null},${o.obligationType||"general"},${o.mandatoryLevel||"review"},
             ${o.expectedEvidence||null},${o.testProcedure||null},'draft',
             ${Boolean(o.aiGenerated)},${o.confidence??null},${hybrid.engine},${o.schemaVersion||hybrid.schemaVersion||"v1"},
             ${JSON.stringify(o.fieldConfidence||{})}::jsonb,${JSON.stringify(o.reviewReasons||[])}::jsonb,
             ${JSON.stringify(o.uncertainties||[])}::jsonb,${JSON.stringify(o)}::jsonb,now(),now())
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
      engine:hybrid.engine,
      aiUsed:hybrid.aiUsed,
      aiFallback:Boolean(hybrid.aiFallback),
      humanReviewRequired:true,
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
