import { createClerkClient, verifyToken } from "@clerk/backend";

const ALLOWED_ROLES=new Set(["compliance_admin","compliance_manager","lead_assessor","assessor","reviewer","unit_owner","viewer"]);

function cookieMap(req){
  const raw=String(req.headers?.cookie||"");
  return Object.fromEntries(raw.split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return i<0?[x,""]:[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
}
function bearer(req){
  const h=String(req.headers?.authorization||"");
  return h.startsWith("Bearer ")?h.slice(7):null;
}
export function clerkConfigured(){
  return process.env.AUTH_MODE==="clerk"&&Boolean(process.env.CLERK_PUBLISHABLE_KEY&&process.env.CLERK_SECRET_KEY);
}
export function appUrl(req){
  if(process.env.APP_URL)return process.env.APP_URL.replace(/\/$/,"");
  const proto=String(req.headers["x-forwarded-proto"]||"https").split(",")[0];
  const host=String(req.headers["x-forwarded-host"]||req.headers.host||"").split(",")[0];
  return proto+"://"+host;
}
export function allowedEmail(email){
  const configured=String(process.env.AUTH_ALLOWED_EMAIL_DOMAINS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!configured.length)return true;
  const domain=String(email||"").toLowerCase().split("@")[1]||"";
  return configured.includes(domain);
}
export function normalizeRole(role){
  return ALLOWED_ROLES.has(String(role||""))?String(role):"viewer";
}
export function clerkClient(){
  if(!process.env.CLERK_SECRET_KEY)throw new Error("CLERK_SECRET_KEY_NOT_CONFIGURED");
  return createClerkClient({secretKey:process.env.CLERK_SECRET_KEY,publishableKey:process.env.CLERK_PUBLISHABLE_KEY});
}
export async function authenticateClerkRequest(req){
  if(!clerkConfigured())return null;
  const token=bearer(req)||cookieMap(req).__session;
  if(!token)return null;
  try{
    const opts={secretKey:process.env.CLERK_SECRET_KEY};
    if(process.env.APP_URL)opts.authorizedParties=[process.env.APP_URL.replace(/\/$/,"")];
    const payload=await verifyToken(token,opts);
    return{userId:String(payload.sub),sessionId:payload.sid?String(payload.sid):null,claims:payload};
  }catch{return null}
}
export async function userContext(req){
  const auth=await authenticateClerkRequest(req);if(!auth)return null;
  const user=await clerkClient().users.getUser(auth.userId);
  const email=user.primaryEmailAddress?.emailAddress||user.emailAddresses?.[0]?.emailAddress||"";
  const meta=user.publicMetadata||{};
  const bootstrapAdmins=String(process.env.AUTH_BOOTSTRAP_ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  const bootstrap=bootstrapAdmins.includes(email.toLowerCase());
  const provisioned=bootstrap||Boolean(meta.role||meta.status||Array.isArray(meta.orgIds));
  return{
    id:user.id,
    email,
    name:[user.firstName,user.lastName].filter(Boolean).join(" ")||email,
    role:bootstrap?"compliance_admin":normalizeRole(meta.role),
    orgIds:bootstrap?["*"]:Array.isArray(meta.orgIds)?meta.orgIds.map(String):[],
    status:meta.status==="inactive"?"inactive":provisioned?"active":"pending",
    provisioned,
    bootstrapAdmin:bootstrap,
    imageUrl:user.imageUrl||null
  };
}
export async function requireAdmin(req){
  const user=await userContext(req);
  return user&&user.status==="active"&&user.role==="compliance_admin"?user:null;
}
