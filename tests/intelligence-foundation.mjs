import { extractDocumentText, documentIntelligenceReadiness } from "../lib/document-intelligence.js";
import { extractObligationsHybrid, validateAIObligations, aiExtractionReadiness } from "../lib/ai-obligation-extractor.js";

function assert(ok,msg){if(!ok)throw new Error(msg)}

delete process.env.OCR_ENDPOINT;
delete process.env.AI_EXTRACTION_ENDPOINT;
delete process.env.AI_GATEWAY_API_KEY;
delete process.env.AI_EXTRACTION_MODEL;

const doc=await extractDocumentText(Buffer.from("Đơn vị phải lưu giữ hồ sơ đầy đủ và báo cáo khi phát sinh sai lệch.","utf8"),{name:"rule.txt",type:"text/plain"});
assert(doc.text.includes("phải lưu giữ"),"Text-layer extraction failed");
assert(doc.ocrUsed===false&&doc.ocrRequired===false,"Text file should not require OCR");
assert(documentIntelligenceReadiness().ocrConfigured===false,"OCR readiness must reflect configuration");

const hybrid=await extractObligationsHybrid("Đơn vị phải lưu giữ đầy đủ hồ sơ và chứng từ liên quan.", "src_test");
assert(hybrid.aiUsed===false,"AI must not be used when adapter is not configured");
assert(hybrid.humanReviewRequired===true,"Human review gate must always be explicit");
assert(hybrid.obligations.length>=1,"Rule fallback should extract obligations");
assert(hybrid.obligations.every(x=>x.reviewStatus==="draft"),"Extracted obligations must remain draft");

const validated=validateAIObligations([{
  obligation:"Đơn vị phải báo cáo sự cố theo thời hạn quy định.",
  obligationType:"reporting",
  mandatoryLevel:"mandatory",
  expectedEvidence:"Báo cáo và bằng chứng gửi nhận.",
  testProcedure:"Đối chiếu báo cáo với thời hạn và bằng chứng gửi nhận.",
  confidence:0.84
}]);
assert(validated.length===1&&validated[0].reviewStatus==="draft","AI result normalization must force draft review");
assert(validated[0].confidence===0.84,"AI confidence normalization failed");
assert(aiExtractionReadiness().configured===false,"AI readiness must not claim configured without endpoint/model/key");

console.log("PASS - OCR/AI foundation with safe fallback and human review");
