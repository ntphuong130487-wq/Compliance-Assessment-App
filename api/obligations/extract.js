import { extractObligations } from "../../lib/obligation-extractor.js";

const MAX_TEXT = 250000;

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method==="GET"){
    return res.status(200).json({
      ok:true,
      engine:"rule-v0.1",
      aiConfigured:Boolean(process.env.AI_GATEWAY_API_KEY&&process.env.AI_EXTRACTION_MODEL)
    });
  }
  if(req.method!=="POST"){
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }
  const text=String(req.body?.text||"");
  if(!text.trim())return res.status(400).json({ok:false,error:"TEXT_REQUIRED"});
  if(text.length>MAX_TEXT)return res.status(413).json({ok:false,error:"TEXT_TOO_LARGE"});
  const obligations=extractObligations(text,req.body?.sourceId||null);
  return res.status(200).json({ok:true,engine:"rule-v0.1",count:obligations.length,obligations});
}
