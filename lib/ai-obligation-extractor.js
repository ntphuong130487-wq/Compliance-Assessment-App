import { extractObligations } from "./obligation-extractor.js";

const REQUIRED_FIELDS=["obligation","obligationType","mandatoryLevel","expectedEvidence","testProcedure"];

export function aiExtractionConfigured(){
  return Boolean(process.env.AI_EXTRACTION_ENDPOINT&&process.env.AI_GATEWAY_API_KEY&&process.env.AI_EXTRACTION_MODEL);
}

export function normalizeAIObligation(row,sourceId=null){
  const x=row&&typeof row==="object"?row:{};
  return {
    sourceId,
    sourceClause:String(x.sourceClause||"").slice(0,500),
    originalText:String(x.originalText||x.obligation||"").slice(0,6000),
    obligation:String(x.obligation||"").trim().slice(0,6000),
    applicability:String(x.applicability||"").slice(0,3000),
    obligationType:String(x.obligationType||"general").slice(0,80),
    mandatoryLevel:String(x.mandatoryLevel||"review").slice(0,80),
    expectedEvidence:String(x.expectedEvidence||"").slice(0,3000),
    testProcedure:String(x.testProcedure||"").slice(0,3000),
    confidence:Number.isFinite(Number(x.confidence))?Math.max(0,Math.min(1,Number(x.confidence))):null,
    reviewStatus:"draft",
    aiGenerated:true
  };
}

export function validateAIObligations(rows){
  if(!Array.isArray(rows))return [];
  return rows.map(x=>normalizeAIObligation(x,x?.sourceId||null))
    .filter(x=>x.obligation.length>=12&&REQUIRED_FIELDS.every(k=>String(x[k]??"").length>0))
    .slice(0,100);
}

async function callAIExtraction(text,sourceId){
  const payload={
    task:"compliance_obligation_extraction",
    schemaVersion:"v1",
    model:process.env.AI_EXTRACTION_MODEL,
    sourceId:sourceId||null,
    instructions:{
      language:"vi",
      humanReviewRequired:true,
      prohibitLegalConfirmation:true,
      outputFields:["sourceClause","originalText","obligation","applicability","obligationType","mandatoryLevel","expectedEvidence","testProcedure","confidence"]
    },
    text
  };
  const response=await fetch(process.env.AI_EXTRACTION_ENDPOINT,{
    method:"POST",
    headers:{"content-type":"application/json","authorization":"Bearer "+process.env.AI_GATEWAY_API_KEY},
    body:JSON.stringify(payload)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(data.error||"AI_EXTRACTION_PROVIDER_ERROR"),{code:"AI_EXTRACTION_PROVIDER_ERROR",status:response.status});
  const raw=data.obligations||data.items||[];
  const rows=raw.map(r=>({...r,sourceId}));
  const validated=validateAIObligations(rows);
  if(!validated.length)throw Object.assign(new Error("AI_EXTRACTION_EMPTY"),{code:"AI_EXTRACTION_EMPTY"});
  return validated;
}

export async function extractObligationsHybrid(text,sourceId=null,{preferAI=true}={}){
  const ruleRows=extractObligations(text,sourceId);
  if(!preferAI||!aiExtractionConfigured()){
    return {engine:"rule-v0.2",aiUsed:false,humanReviewRequired:true,obligations:ruleRows};
  }
  try{
    const aiRows=await callAIExtraction(text,sourceId);
    return {engine:"ai-adapter-v0.1",aiUsed:true,humanReviewRequired:true,obligations:aiRows};
  }catch(error){
    return {
      engine:"rule-v0.2",
      aiUsed:false,
      aiFallback:true,
      aiError:error?.code||"AI_EXTRACTION_FAILED",
      humanReviewRequired:true,
      obligations:ruleRows
    };
  }
}

export function aiExtractionReadiness(){
  return {
    configured:aiExtractionConfigured(),
    model:process.env.AI_EXTRACTION_MODEL||null,
    adapter:process.env.AI_EXTRACTION_ENDPOINT?"external-http":"not-configured",
    humanReviewRequired:true
  };
}
