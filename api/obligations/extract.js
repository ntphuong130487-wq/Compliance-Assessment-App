import crypto from "node:crypto";
import { extractObligationsHybrid, aiExtractionReadiness } from "../../lib/ai-obligation-extractor.js";
import { normalizedMode, sqlClient, asUuid } from "../../lib/db.js";
import { requireUser, assertPermission } from "../../lib/server-authz.js";

const MAX_TEXT = 250000;

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method==="GET"){
    return res.status(200).json({
      ok:true,
      engine:"hybrid-v0.1",
      ai:aiExtractionReadiness()
    });
  }
  if(req.method!=="POST"){
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }
  const text=String(req.body?.text||"");
  if(!text.trim())return res.status(400).json({ok:false,error:"TEXT_REQUIRED"});
  if(text.length>MAX_TEXT)return res.status(413).json({ok:false,error:"TEXT_TOO_LARGE"});
  const sourceId=String(req.body?.sourceId||"");
  const hybrid=await extractObligationsHybrid(text,sourceId||null,{preferAI:true});
  let obligations=hybrid.obligations;
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
    await sql`UPDATE compliance_sources SET status='extracted',extracted_at=now(),updated_at=now() WHERE id=${sourceId}::uuid`;
    obligations=persisted;
  }
  return res.status(200).json({ok:true,engine:hybrid.engine,aiUsed:hybrid.aiUsed,aiFallback:Boolean(hybrid.aiFallback),humanReviewRequired:true,count:obligations.length,obligations,persisted:normalizedMode()});
}
