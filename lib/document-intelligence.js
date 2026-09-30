const TEXT_EXT=/\.(txt|md|csv|json|xml|html?)$/i;
const PDF_EXT=/\.pdf$/i;
const DOCX_EXT=/\.docx$/i;
const IMAGE_EXT=/\.(png|jpe?g|webp|tiff?)$/i;

function clean(text){
  return String(text||"").replace(/\r/g,"\n").replace(/[\t ]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
}

export function ocrConfigured(){
  return Boolean(process.env.OCR_ENDPOINT);
}

async function extractTextLayer(buffer,name="",type="application/octet-stream"){
  const lower=String(name||"").toLowerCase();
  if(String(type).startsWith("text/")||TEXT_EXT.test(lower)){
    return {text:clean(buffer.toString("utf8")),method:"text-layer"};
  }
  if(type==="application/pdf"||PDF_EXT.test(lower)){
    const mod=await import("pdf-parse/lib/pdf-parse.js");
    const pdf=mod.default||mod;
    const data=await pdf(buffer);
    return {text:clean(data.text||""),method:"pdf-text-layer",pages:Number(data.numpages||0)||null};
  }
  if(/wordprocessingml|msword/.test(type)||DOCX_EXT.test(lower)){
    const mod=await import("mammoth");
    const mammoth=mod.default||mod;
    const data=await mammoth.extractRawText({buffer});
    return {text:clean(data.value||""),method:"docx-text-layer"};
  }
  if(String(type).startsWith("image/")||IMAGE_EXT.test(lower)){
    return {text:"",method:"image-no-text-layer",pages:1};
  }
  const err=new Error("UNSUPPORTED_FILE");
  err.code="UNSUPPORTED_FILE";
  throw err;
}

async function ocrViaEndpoint(buffer,{name,type}){
  if(!ocrConfigured())return null;
  const headers={
    "content-type":type||"application/octet-stream",
    "x-file-name":encodeURIComponent(name||"document")
  };
  if(process.env.OCR_API_KEY)headers.authorization="Bearer "+process.env.OCR_API_KEY;
  const response=await fetch(process.env.OCR_ENDPOINT,{method:"POST",headers,body:buffer});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(data.error||"OCR_PROVIDER_ERROR"),{code:"OCR_PROVIDER_ERROR",status:response.status});
  const text=clean(data.text||"");
  if(!text)throw Object.assign(new Error("OCR_EMPTY_RESULT"),{code:"OCR_EMPTY_RESULT"});
  return {text,method:"ocr-provider",provider:data.provider||null,pages:data.pages||null,confidence:data.confidence??null};
}

export async function extractDocumentText(buffer,{name="",type="application/octet-stream",minTextLength=20}={}){
  const layer=await extractTextLayer(buffer,name,type);
  if(layer.text.length>=minTextLength){
    return {...layer,ocrRequired:false,ocrUsed:false};
  }
  if(ocrConfigured()){
    const ocr=await ocrViaEndpoint(buffer,{name,type});
    return {...ocr,ocrRequired:false,ocrUsed:true};
  }
  return {...layer,ocrRequired:true,ocrUsed:false,text:layer.text||""};
}

export function documentIntelligenceReadiness(){
  return {
    textLayer:true,
    supported:["txt","md","csv","json","xml","html","pdf","docx","png","jpg","jpeg","webp","tif","tiff"],
    ocrConfigured:ocrConfigured(),
    ocrMode:ocrConfigured()?"external-adapter":"not-configured"
  };
}
