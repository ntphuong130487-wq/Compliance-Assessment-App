import { extractObligations } from "../../lib/obligation-extractor.js";

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

async function extractText(buffer,name,type){
  const lower=(name||"").toLowerCase();
  if(type.startsWith("text/")||/\.(txt|md|csv|json|xml|html?)$/.test(lower)){
    return buffer.toString("utf8");
  }
  if(type==="application/pdf"||lower.endsWith(".pdf")){
    const mod=await import("pdf-parse");
    const pdf=mod.default||mod;
    const data=await pdf(buffer);
    return data.text||"";
  }
  if(/wordprocessingml|msword/.test(type)||lower.endsWith(".docx")){
    const mod=await import("mammoth");
    const mammoth=mod.default||mod;
    const data=await mammoth.extractRawText({buffer});
    return data.value||"";
  }
  throw Object.assign(new Error("UNSUPPORTED_FILE"),{code:"UNSUPPORTED_FILE"});
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method==="GET"){
    return res.status(200).json({
      ok:true,
      supported:["txt","md","csv","json","xml","html","pdf","docx"],
      maxBytes:MAX_BYTES,
      ocrConfigured:false
    });
  }
  if(req.method!=="POST"){
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }
  try{
    const body=await readBody(req);
    const name=decodeURIComponent(String(req.headers["x-file-name"]||"source"));
    const type=String(req.headers["content-type"]||"application/octet-stream");
    const text=await extractText(body,name,type);
    const obligations=extractObligations(text,req.headers["x-source-id"]||null);
    return res.status(200).json({
      ok:true,name,type,text:text.slice(0,250000),
      count:obligations.length,obligations,
      engine:"file-text+rule-v0.1"
    });
  }catch(error){
    if(error?.code==="FILE_TOO_LARGE")return res.status(413).json({ok:false,error:"FILE_TOO_LARGE"});
    if(error?.code==="UNSUPPORTED_FILE")return res.status(415).json({ok:false,error:"UNSUPPORTED_FILE",ocrRequired:true});
    console.error("source extract error",error);
    return res.status(500).json({ok:false,error:"SOURCE_EXTRACTION_ERROR"});
  }
}
