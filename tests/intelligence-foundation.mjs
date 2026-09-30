import fs from "node:fs";
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
  confidence:0.84,
  fieldConfidence:{obligation:0.95,applicability:0.6,evidence:0.8,testProcedure:0.78},
  reviewReasons:["Kiểm tra phạm vi áp dụng"],
  uncertainties:["Thời hạn cụ thể chưa được định vị trong đoạn trích"]
}]);
assert(validated.length===1&&validated[0].reviewStatus==="draft","AI result normalization must force draft review");
assert(validated[0].confidence===0.84,"AI confidence normalization failed");
assert(validated[0].confidenceBand==="medium","AI confidence band incorrect");
assert(validated[0].schemaVersion==="v1"&&validated[0].humanReviewRequired===true,"AI schema/human-review flags missing");
assert(Array.isArray(validated[0].reviewReasons)&&validated[0].reviewReasons.length>=1,"AI review reasons missing");
const schema=JSON.parse(fs.readFileSync("schemas/ai-obligation-extraction-v1.schema.json","utf8"));
assert(schema.properties?.humanReviewRequired?.const===true,"JSON schema must force human review");
assert(schema.properties?.obligations?.items?.properties?.confidence?.maximum===1,"JSON schema confidence range missing");
assert(aiExtractionReadiness().configured===false,"AI readiness must not claim configured without endpoint/model/key");

console.log("PASS - OCR/AI foundation with safe fallback and human review");
