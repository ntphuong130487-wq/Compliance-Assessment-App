import { neon } from "@neondatabase/serverless";
import { appUrl, allowedEmail, clerkClient, clerkConfigured, normalizeRole, requireAdmin } from "../../lib/clerk-auth.js";

function orgIds(value){
  return Array.isArray(value)?value.map(String).filter(Boolean):[];
}
async function upsertPreProvision(email,role,orgs){
  if(!process.env.DATABASE_URL)return;
  const sql=neon(process.env.DATABASE_URL);
  await sql`
    INSERT INTO app_users (id,email,display_name,role_code,status,identity_provider,public_metadata,invited_at)
    VALUES (${"invite:"+email.toLowerCase()},${email.toLowerCase()},NULL,${role},'invited','clerk',${JSON.stringify({role,orgIds:orgs})}::jsonb,now())
    ON CONFLICT (email) DO UPDATE SET
      role_code=EXCLUDED.role_code,
      status='invited',
      identity_provider='clerk',
      public_metadata=EXCLUDED.public_metadata,
      invited_at=now(),
      updated_at=now()
  `;
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(!clerkConfigured())return res.status(503).json({ok:false,error:"CLERK_NOT_CONFIGURED"});
  const admin=await requireAdmin(req);
  if(!admin)return res.status(403).json({ok:false,error:"ADMIN_REQUIRED"});
  const client=clerkClient();

  if(req.method==="GET"){
    const result=await client.users.getUserList({limit:100,orderBy:"-created_at"});
    return res.status(200).json({
      ok:true,
      users:result.data.map(u=>{
        const email=u.primaryEmailAddress?.emailAddress||u.emailAddresses?.[0]?.emailAddress||"";
        const meta=u.publicMetadata||{};
        return{id:u.id,email,name:[u.firstName,u.lastName].filter(Boolean).join(" ")||email,role:normalizeRole(meta.role),orgIds:orgIds(meta.orgIds),lastSignInAt:u.lastSignInAt||null,createdAt:u.createdAt||null,imageUrl:u.imageUrl||null};
      }),
      totalCount:result.totalCount
    });
  }

  if(req.method==="POST"){
    const email=String(req.body?.email||"").trim().toLowerCase();
    const role=normalizeRole(req.body?.role);
    const scopes=orgIds(req.body?.orgIds);
    if(!email||!email.includes("@"))return res.status(400).json({ok:false,error:"INVALID_EMAIL"});
    if(!allowedEmail(email))return res.status(400).json({ok:false,error:"EMAIL_DOMAIN_NOT_ALLOWED"});
    const invitation=await client.invitations.createInvitation({
      emailAddress:email,
      redirectUrl:appUrl(req)+"/",
      publicMetadata:{role,orgIds:scopes.length?scopes:["*"],status:"active"},
      notify:true,
      expiresInDays:30
    });
    await upsertPreProvision(email,role,scopes.length?scopes:["*"]);
    return res.status(201).json({ok:true,invitation:{id:invitation.id,emailAddress:invitation.emailAddress,status:invitation.status,createdAt:invitation.createdAt}});
  }

  res.setHeader("Allow","GET, POST");
  return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
}
