import { extractObligationsHybrid, aiExtractionReadiness } from "../../lib/ai-obligation-extractor.js";
import { normalizedMode, sqlClient, asUuid } from "../../lib/db.js";
import { requireUser, assertPermission } from "../../lib/server-authz.js";
import { assessmentSourceContext, assertExtractableSourceContext, scopeContextFromAssessmentSource } from "../../lib/source-context.js";
import { persistDraftObligations } from "../../lib/draft-requirement-store.js";

const MAX_TEXT=250000;

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method==="GET"){
    return res.status(200).json({ok:true,engine:"hybrid-v0.2",ai:aiExtractionReadiness(),assessmentScoped:true});
  }
  if(req.method!=="POST"){
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }

  const text=String(req.body?.text||"");
  const sourceId=String(req.body?.sourceId||"");
  const assessmentId=String(req.body?.assessmentId||"");
  if(!text.trim())return res.status(400).json({ok:false,error:"TEXT_REQUIRED"});
  if(text.length>MAX_TEXT)return res.status(413).json({ok:false,error:"TEXT_TOO_LARGE"});

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

  const hybrid=await extractObligationsHybrid(text,sourceId||null,{assessmentId:assessmentId||null,scopeContext,preferAI:true});
  let obligations=hybrid.obligations;
  if(normalizedMode()){
    obligations=await persistDraftObligations(sql,{sourceId,assessmentId,hybrid,obligations});
    await sql`UPDATE compliance_sources SET status='extracted',extracted_at=now(),updated_at=now() WHERE id=${sourceId}::uuid`;
  }

  return res.status(200).json({
    ok:true,engine:hybrid.engine,schemaVersion:hybrid.schemaVersion||"v2",
    aiUsed:hybrid.aiUsed,aiFallback:Boolean(hybrid.aiFallback),humanReviewRequired:true,
    assessmentScoped:true,count:obligations.length,obligations,persisted:normalizedMode()
  });
}
