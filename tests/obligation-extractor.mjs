import { extractObligations } from "../lib/obligation-extractor.js";

function assert(ok,msg){if(!ok)throw new Error(msg)}

const text=`
Điều 1. Đơn vị phải lưu giữ đầy đủ hồ sơ và chứng từ liên quan.
Giao dịch không được thực hiện trước khi có phê duyệt của cấp có thẩm quyền.
Trường hợp phát sinh sự cố, đơn vị có trách nhiệm báo cáo trong thời hạn quy định.
Nội dung mô tả chung không chứa nghĩa vụ cụ thể.
`;

const rows=extractObligations(text,"src_test","assessment_test");
assert(rows.length>=3,"Expected at least 3 obligations");
assert(rows.every(x=>x.sourceId==="src_test"&&x.assessmentId==="assessment_test"),"Assessment/source traceability missing");
assert(rows.some(x=>x.obligationType==="record"),"Record obligation not classified");
assert(rows.some(x=>x.obligationType==="prohibition"||x.obligationType==="approval"),"Approval/prohibition not classified");
assert(rows.every(x=>x.reviewStatus==="draft"),"Draft review state required");
assert(rows.some(x=>x.actorText),"Actor extraction candidate missing");
assert(rows.some(x=>x.actionText),"Action extraction candidate missing");
assert(rows.every(x=>x.expectedEvidence===""&&x.testProcedure===""),"Rule fallback must not invent evidence or test procedures");
console.log("PASS - obligation extraction and traceability");
