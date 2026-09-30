import { extractObligations } from "./obligation-extractor.js";

const REQUIRED_FIELDS=["obligation","obligationType","mandatoryLevel","expectedEvidence","testProcedure"];
const ALLOWED_TYPES=new Set(["general","prohibition","approval","record","reporting","condition","responsibility"]);
const ALLOWED_LEVELS=new Set(["mandatory","conditional","review"]);
const SCHEMA_VERSION="v1";

function clip01(v){
  const n=Number(v);
  return Number.isFinite(n)?Math.max(0,Math.min(1,n)):null;
}
function stringArray(v,max=10){
  return Array.isArray(v)?v.map(x=>String(x||"").trim()).filter(Boolean).slice(0,max):[];
}
function confidenceBand(v){
  const n=clip01(v);
  if(n===null)return"unknown";
  if(n>=0.85)return"high";
  if(n>=0.65)return"medium";
  return"low";
}

export function aiExtractionConfigured(){
  return Boolean(process.env.AI_EXTRACTION_ENDPOINT&&process.env.AI_GATEWAY_API_KEY&&process.env.AI_EXTRACTION_MODEL);
}

export function normalizeAIObligation(row,sourceId=null){
  const x=row&&typeof row==="object"?row:{};
  const sourceClause=String(x.sourceClause||"").slice(0,500);
  const applicability=String(x.applicability||"").slice(0,3000);
  const confidence=clip01(x.confidence);
  const type=ALLOWED_TYPES.has(String(x.obligationType))?String(x.obligationType):"general";
  const level=ALLOWED_LEVELS.has(String(x.mandatoryLevel))?String(x.mandatoryLevel):"review";
  const reviewReasons=stringArray(x.reviewReasons);
  if(confidence!==null&&confidence<0.65&&!reviewReasons.includes("Độ tin cậy thấp"))reviewReasons.push("Độ tin cậy thấp");
  if(!sourceClause&&!reviewReasons.includes("Chưa định vị điều khoản"))reviewReasons.push("Chưa định vị điều khoản");
  if(!applicability&&!reviewReasons.includes("Phạm vi áp dụng chưa rõ"))reviewReasons.push("Phạm vi áp dụng chưa rõ");
  return {
    sourceId,
    sourceClause,
    originalText:String(x.originalText||x.obligation||"").slice(0,6000),
    obligation:String(x.obligation||"").trim().slice(0,6000),
    applicability,
    obligationType:type,
    mandatoryLevel:level,
    expectedEvidence:String(x.expectedEvidence||"").slice(0,3000),
    testProcedure:String(x.testProcedure||"").slice(0,3000),
    confidence,
    confidenceBand:confidenceBand(confidence),
    fieldConfidence:{
      obligation:clip01(x.fieldConfidence?.obligation),
      applicability:clip01(x.fieldConfidence?.applicability),
      evidence:clip01(x.fieldConfidence?.evidence),
      testProcedure:clip01(x.fieldConfidence?.testProcedure)
    },
    reviewReasons:reviewReasons.slice(0,10),
    uncertainties:stringArray(x.uncertainties),
    schemaVersion:SCHEMA_VERSION,
    humanReviewRequired:true,
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
      schemaVersion:SCHEMA_VERSION,
      confidencePolicy:{high:0.85,medium:0.65,humanReviewAlwaysRequired:true},
      outputFields:["sourceClause","originalText","obligation","applicability","obligationType","mandatoryLevel","expectedEvidence","testProcedure","confidence","fieldConfidence","reviewReasons","uncertainties"]
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
    return {engine:"ai-adapter-v0.2",schemaVersion:SCHEMA_VERSION,aiUsed:true,humanReviewRequired:true,obligations:aiRows};
  }catch(error){
    return {
      engine:"rule-v0.2",
      aiUsed:false,
      aiFallback:true,
      aiError:error?.code||"AI_EXTRACTION_FAILED",
      schemaVersion:SCHEMA_VERSION,
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
    humanReviewRequired:true,
    schemaVersion:SCHEMA_VERSION,
    confidenceThresholds:{high:0.85,medium:0.65}
  };
}
