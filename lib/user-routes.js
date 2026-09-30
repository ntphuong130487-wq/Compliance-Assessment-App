import { neon } from "@neondatabase/serverless";
import { allowedEmail, clerkClient, clerkConfigured, normalizeRole, requireAdmin } from "./clerk-auth.js";
import { requireUser, hasPermission } from "./server-authz.js";

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

export async function handleUsers(req,res,route){
  res.setHeader("Cache-Control","no-store");

  if(route==="admin"){
    if(!clerkConfigured())return res.status(503).json({ok:false,error:"CLERK_NOT_CONFIGURED"});
    const admin=await requireAdmin(req);
    if(!admin)return res.status(403).json({ok:false,error:"ADMIN_REQUIRED"});
    const client=clerkClient();

    if(req.method==="GET"){
      const sql=neon(process.env.DATABASE_URL);
      const rows=await sql`
        SELECT id,email,display_name AS name,role_code AS role,status,
               public_metadata AS "publicMetadata",last_sign_in_at AS "lastSignInAt",created_at AS "createdAt"
        FROM app_users ORDER BY created_at DESC LIMIT 200
      `;
      const byEmail=new Map(rows.map(r=>[String(r.email).toLowerCase(),r]));
      const result=await client.users.getUserList({limit:100,orderBy:"-created_at"});
      for(const u of result.data){
        const email=(u.primaryEmailAddress?.emailAddress||u.emailAddresses?.[0]?.emailAddress||"").toLowerCase();
        if(!email)continue;
        const existing=byEmail.get(email);
        if(existing){
          existing.name=existing.name||[u.firstName,u.lastName].filter(Boolean).join(" ")||email;
          existing.lastSignInAt=u.lastSignInAt||existing.lastSignInAt;
          existing.id=u.id;
        }else{
          const meta=u.publicMetadata||{};
          byEmail.set(email,{id:u.id,email,name:[u.firstName,u.lastName].filter(Boolean).join(" ")||email,role:normalizeRole(meta.role),status:"unprovisioned",publicMetadata:{orgIds:orgIds(meta.orgIds)},lastSignInAt:u.lastSignInAt||null,createdAt:u.createdAt||null});
        }
      }
      const users=Array.from(byEmail.values()).map(u=>({id:u.id,email:u.email,name:u.name||u.email,role:normalizeRole(u.role),status:u.status,orgIds:orgIds(u.publicMetadata?.orgIds),lastSignInAt:u.lastSignInAt||null,createdAt:u.createdAt||null}));
      return res.status(200).json({ok:true,users,totalCount:users.length,accessModel:"self-signup-preprovisioned"});
    }

    if(req.method==="POST"){
      const email=String(req.body?.email||"").trim().toLowerCase();
      const role=normalizeRole(req.body?.role);
      const scopes=orgIds(req.body?.orgIds);
      if(!email||!email.includes("@"))return res.status(400).json({ok:false,error:"INVALID_EMAIL"});
      if(!allowedEmail(email))return res.status(400).json({ok:false,error:"EMAIL_DOMAIN_NOT_ALLOWED"});
      await upsertPreProvision(email,role,scopes.length?scopes:["*"]);
      return res.status(201).json({
        ok:true,
        provisioned:{email,role,orgIds:scopes.length?scopes:["*"],status:"preprovisioned"},
        accessModel:"self-signup-preprovisioned",
        nextStep:"User signs up with the same email; backend activates only pre-provisioned accounts."
      });
    }

    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }

  if(route==="directory"){
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
      const sql=neon(process.env.DATABASE_URL);
      const rows=await sql`
        SELECT id,email,display_name AS name,role_code AS role,status,public_metadata AS "publicMetadata"
        FROM app_users WHERE status='active' ORDER BY display_name NULLS LAST,email
      `;
      const mapped=rows.map(u=>({id:u.id,email:u.email,name:u.name||u.email,role:normalizeRole(u.role),orgIds:orgIds(u.publicMetadata?.orgIds),status:u.status}))
        .filter(u=>user.orgIds?.includes("*")||u.orgIds.includes("*")||u.orgIds.some(id=>user.orgIds?.includes(id)));
      return res.status(200).json({ok:true,users:mapped,totalCount:mapped.length});
    }catch(error){
      console.error("assignment users error",error);
      return res.status(500).json({ok:false,error:"USER_DIRECTORY_ERROR"});
    }
  }

  return res.status(404).json({ok:false,error:"USER_ROUTE_NOT_FOUND"});
}
