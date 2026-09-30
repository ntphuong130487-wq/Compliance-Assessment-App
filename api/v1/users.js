import { clerkClient } from "../../lib/clerk-auth.js";
import { requireUser, hasPermission, orgAllowed } from "../../lib/server-authz.js";

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET"){
    res.setHeader("Allow","GET");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }
  const auth=await requireUser(req);
  if(!auth.ok)return res.status(auth.status).json({ok:false,error:auth.error});
  const user=auth.user;
  if(!hasPermission(user,"assign_action")&&!hasPermission(user,"manage_assessment")&&!hasPermission(user,"administer_access")){
    return res.status(403).json({ok:false,error:"FORBIDDEN"});
  }
  try{
    const result=await clerkClient().users.getUserList({limit:100,orderBy:"first_name"});
    const users=result.data.map(u=>{
      const email=u.primaryEmailAddress?.emailAddress||u.emailAddresses?.[0]?.emailAddress||"";
      const meta=u.publicMetadata||{};
      const orgIds=Array.isArray(meta.orgIds)?meta.orgIds.map(String):[];
      return{
        id:u.id,
        email,
        name:[u.firstName,u.lastName].filter(Boolean).join(" ")||email,
        role:String(meta.role||"viewer"),
        orgIds,
        status:meta.status==="inactive"?"inactive":"active"
      };
    }).filter(u=>u.status==="active"&&(user.orgIds?.includes("*")||u.orgIds.includes("*")||u.orgIds.some(id=>user.orgIds?.includes(id))));
    return res.status(200).json({ok:true,users,totalCount:users.length});
  }catch(error){
    console.error("assignment users error",error);
    return res.status(500).json({ok:false,error:"USER_DIRECTORY_ERROR"});
  }
}
