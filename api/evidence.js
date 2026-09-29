import { put } from "@vercel/blob";

export const config = { api: { bodyParser: false } };

const MAX_BYTES = 8 * 1024 * 1024;

async function readBody(req){
  var chunks=[],size=0;
  for await (const chunk of req){
    size+=chunk.length;
    if(size>MAX_BYTES) throw Object.assign(new Error("FILE_TOO_LARGE"),{code:"FILE_TOO_LARGE"});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function authConfigured(){
  return Boolean(process.env.AUTH_MODE);
}

function authEnforcementReady(){
  // Secure-by-default: this release does not yet verify an end-user identity
  // on each request. Do not enable private evidence writes until that layer exists.
  return false;
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");

  if(req.method==="GET"){
    return res.status(200).json({
      ok:true,
      configured:Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      authConfigured:authConfigured(),
      authEnforcementReady:authEnforcementReady(),
      maxBytes:MAX_BYTES
    });
  }

  if(req.method!=="POST"){
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }

  if(!process.env.BLOB_READ_WRITE_TOKEN){
    return res.status(503).json({ok:false,error:"BLOB_NOT_CONFIGURED"});
  }

  if(!authConfigured()){
    return res.status(403).json({ok:false,error:"AUTH_REQUIRED"});
  }

  if(!authEnforcementReady()){
    return res.status(501).json({
      ok:false,
      error:"AUTH_ENFORCEMENT_PENDING",
      message:"Private evidence upload remains disabled until identity verification is enforced server-side."
    });
  }

  try{
    const body=await readBody(req);
    const original=(req.headers["x-file-name"]||"evidence.bin").toString();
    const safe=original.replace(/[^a-zA-Z0-9._-]+/g,"_").slice(-160);
    const contentType=(req.headers["content-type"]||"application/octet-stream").toString();
    const pathname="compliance-evidence/"+Date.now()+"-"+safe;
    const blob=await put(pathname,body,{access:"private",contentType,token:process.env.BLOB_READ_WRITE_TOKEN});
    return res.status(200).json({
      ok:true,
      pathname:blob.pathname,
      url:blob.url,
      downloadUrl:blob.downloadUrl||null,
      contentType:blob.contentType||contentType,
      size:body.length
    });
  }catch(error){
    if(error&&error.code==="FILE_TOO_LARGE")return res.status(413).json({ok:false,error:"FILE_TOO_LARGE"});
    console.error("evidence upload error",error);
    return res.status(500).json({ok:false,error:"EVIDENCE_UPLOAD_ERROR"});
  }
}
