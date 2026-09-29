import { authConfigured, readSession } from "../../lib/auth-session.js";
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(!authConfigured())return res.status(200).json({ok:true,configured:false,authenticated:false});
  const user=await readSession(req);
  if(!user)return res.status(401).json({ok:false,configured:true,authenticated:false});
  return res.status(200).json({ok:true,configured:true,authenticated:true,user:{sub:user.sub,email:user.email,name:user.name,role:user.role,tenantId:user.tenantId}});
}
