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
    if(line.length<=320){out.push(line);continue;}
    for(const s of line.split(/(?<=[.;:!?])\s+/)) if(s.trim()) out.push(s.trim());
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
  if(/nếu|trường hợp|khi /.test(x))return"conditional";
  if(/phải|không được|cấm|bắt buộc|chỉ được/.test(x))return"mandatory";
  return"review";
}

function evidenceFor(type){
  return ({
    approval:"Phê duyệt/ủy quyền, log hệ thống, hồ sơ giao dịch.",
    record:"Hồ sơ, chứng từ, tài liệu lưu trữ và dấu vết truy xuất.",
    reporting:"Báo cáo/thông báo đã phát hành và bằng chứng gửi/nhận.",
    prohibition:"Bằng chứng giao dịch/hoạt động và dấu vết kiểm soát ngăn chặn.",
    condition:"Giấy phép, đăng ký, hồ sơ chứng minh điều kiện.",
    responsibility:"Phân công trách nhiệm, quyết định/ủy quyền và bằng chứng thực hiện.",
    general:"Hồ sơ, dữ liệu hệ thống, chứng từ hoặc bằng chứng thực tế phù hợp."
  })[type];
}

export function extractObligations(text,sourceId=null){
  const units=chunks(text);
  let candidates=units.filter(s=>{
    const x=s.toLowerCase();
    return s.length>=18 && KEYWORDS.some(k=>x.includes(k));
  });
  if(!candidates.length){
    candidates=units.filter(s=>s.length>=40).slice(0,30);
  }
  const seen=new Set();
  const out=[];
  for(const s of candidates){
    const key=s.toLowerCase().replace(/\s+/g," ").slice(0,220);
    if(seen.has(key))continue;
    seen.add(key);
    const type=typeOf(s);
    out.push({
      sourceId,
      sourceClause:"",
      originalText:s,
      obligation:s,
      applicability:"",
      obligationType:type,
      mandatoryLevel:mandatoryOf(s),
      expectedEvidence:evidenceFor(type),
      testProcedure:"Đối chiếu bằng chứng thực tế với yêu cầu và phạm vi áp dụng của nghĩa vụ.",
      reviewStatus:"draft"
    });
    if(out.length>=60)break;
  }
  return out;
}
