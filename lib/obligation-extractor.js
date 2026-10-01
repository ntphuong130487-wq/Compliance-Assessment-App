import crypto from "node:crypto";

const KEYWORDS = [
  "phải","không được","có trách nhiệm","chịu trách nhiệm","chỉ được","bắt buộc",
  "thực hiện","bảo đảm","đảm bảo","lưu giữ","lưu trữ","báo cáo","phê duyệt",
  "tuân thủ","cấm","nghĩa vụ","đăng ký","thông báo","cung cấp","kiểm tra"
];

function normalize(text){
  return String(text||"")
    .replace(/\r/g,"\n")
    .replace(/[\t ]+/g," ")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

function chunks(text){
  const t=normalize(text);
  if(!t)return[];
  const lines=t.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const out=[];
  for(const line of lines){
    if(line.length<=420){out.push(line);continue;}
    for(const s of line.split(/(?<=[.;!?])\s+/)) if(s.trim()) out.push(s.trim());
  }
  return out;
}

function typeOf(s){
  const x=s.toLowerCase();
  if(/không được|cấm/.test(x))return"prohibition";
  if(/phê duyệt|chấp thuận|ủy quyền|uỷ quyền/.test(x))return"approval";
  if(/lưu giữ|lưu trữ|hồ sơ|chứng từ/.test(x))return"record";
  if(/báo cáo|thông báo/.test(x))return"reporting";
  if(/đăng ký|giấy phép|điều kiện/.test(x))return"condition";
  if(/trách nhiệm|chịu trách nhiệm/.test(x))return"responsibility";
  return"general";
}

function mandatoryOf(s){
  const x=s.toLowerCase();
  if(/\bnếu\b|trường hợp|\bkhi\b|với điều kiện/.test(x))return"conditional";
  if(/phải|không được|cấm|bắt buộc|chỉ được/.test(x))return"mandatory";
  return"review";
}

function firstClauseRef(s){
  const m=String(s||"").match(/\b(Điều|Khoản|Mục|Điểm)\s+[\w.\-]+(?:\s*[,;:]?\s*(?:Khoản|Điểm)\s+[\w.\-]+)*/i);
  return m?m[0]:"";
}

function heuristicActor(s){
  const m=String(s||"").match(/^(.{2,120}?)(?=\s+(?:phải|không được|có trách nhiệm|chịu trách nhiệm|chỉ được|bắt buộc)\b)/i);
  return m?m[1].replace(/^(?:Điều|Khoản|Mục|Điểm)\s+[\w.\-]+\s*[:.\-]?\s*/i,"").trim():"";
}

function heuristicAction(s){
  const m=String(s||"").match(/\b(phải|không được|có trách nhiệm|chịu trách nhiệm|chỉ được|bắt buộc)\s+(.+)/i);
  return m?m[2].trim():"";
}

function refs(v){
  return Array.isArray(v)?v.map(x=>String(x||"").trim()).filter(Boolean):[];
}

export function obligationKey(row){
  const parts=[
    row.sourceId||"",row.sourceClause||"",row.actorText||"",row.actionText||"",
    row.objectText||"",row.conditionText||"",row.exceptionText||""
  ].map(x=>String(x).toLowerCase().replace(/\s+/g," ").trim());
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

export function extractObligations(text,sourceId=null,assessmentId=null){
  const units=chunks(text);
  let candidates=units.filter(s=>{
    const x=s.toLowerCase();
    return s.length>=18 && KEYWORDS.some(k=>x.includes(k));
  });
  if(!candidates.length)candidates=units.filter(s=>s.length>=40).slice(0,40);

  const seen=new Set();
  const out=[];
  for(const s of candidates){
    const originalText=s.trim();
    const type=typeOf(originalText);
    const actorText=heuristicActor(originalText);
    const actionText=heuristicAction(originalText);
    const row={
      sourceId,
      assessmentId,
      sourceClause:firstClauseRef(originalText),
      originalText,
      obligation:originalText,
      actorText,
      actionText,
      objectText:"",
      conditionText:/\bnếu\b|trường hợp|\bkhi\b|với điều kiện/i.test(originalText)?originalText:"",
      exceptionText:/ngoại trừ|trừ trường hợp|trừ khi|không áp dụng/i.test(originalText)?originalText:"",
      timingText:"",
      frequencyText:"",
      applicability:"",
      applicableOrgRefs:[],
      applicableProcessRefs:[],
      applicableActivityRefs:[],
      applicableRoleRefs:[],
      controlPoint:"",
      controlObjective:"",
      obligationType:type,
      mandatoryLevel:mandatoryOf(originalText),
      expectedEvidence:"",
      testProcedure:"",
      verificationMethod:"",
      confidence:null,
      fieldConfidence:{},
      reviewReasons:[
        ...(!actorText?["Chưa xác định rõ chủ thể nghĩa vụ"]:[]),
        ...(!actionText?["Chưa tách rõ hành động phải thực hiện"]:[]),
        ...(!firstClauseRef(originalText)?["Chưa định vị điều/khoản/mục"]:[]),
        "Rule fallback chỉ tạo ứng viên; cần human review trước khi sử dụng"
      ],
      uncertainties:[],
      aiGenerated:false,
      humanReviewRequired:true,
      reviewStatus:"draft"
    };
    row.obligationKey=obligationKey(row);
    if(seen.has(row.obligationKey))continue;
    seen.add(row.obligationKey);
    out.push(row);
    if(out.length>=100)break;
  }
  return out;
}

export function normalizeRefs(v){return refs(v)}
