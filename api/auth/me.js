import { clerkConfigured, userContext } from "../../lib/clerk-auth.js";
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(!clerkConfigured())return res.status(200).json({ok:true,configured:false,authenticated:false});
  const user=await userContext(req);
  if(!user)return res.status(401).json({ok:false,configured:true,authenticated:false});
  if(user.status!=="active")return res.status(403).json({ok:false,configured:true,authenticated:true,error:"USER_INACTIVE"});
  return res.status(200).json({ok:true,configured:true,authenticated:true,user});
}
