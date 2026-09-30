import { clerkConfigured, userContext } from "./clerk-auth.js";

export async function handleAuth(req,res,route){
  res.setHeader("Cache-Control","no-store");

  if(route==="config"){
    return res.status(200).json({
      ok:true,
      configured:clerkConfigured(),
      publishableKey:clerkConfigured()?process.env.CLERK_PUBLISHABLE_KEY:null,
      provider:"Clerk",
      mode:process.env.AUTH_MODE||null,
      invitationOnly:true
    });
  }

  if(route==="me"){
    if(!clerkConfigured())return res.status(200).json({ok:true,configured:false,authenticated:false});
    const user=await userContext(req);
    if(!user)return res.status(401).json({ok:false,configured:true,authenticated:false});
    if(user.status!=="active")return res.status(403).json({
      ok:false,configured:true,authenticated:true,
      error:user.status==="pending"?"USER_NOT_PROVISIONED":"USER_INACTIVE",
      user:{id:user.id,email:user.email,name:user.name,status:user.status}
    });
    return res.status(200).json({ok:true,configured:true,authenticated:true,user});
  }

  return res.status(404).json({ok:false,error:"AUTH_ROUTE_NOT_FOUND"});
}
