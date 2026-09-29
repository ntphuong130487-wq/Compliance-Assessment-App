import { SignJWT, jwtVerify } from "jose";

const COOKIE="agris_compliance_session";
const STATE_COOKIE="agris_oauth_state";

function cookieMap(req){
  const raw=String(req.headers?.cookie||"");
  return Object.fromEntries(raw.split(";").map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf("=");return i<0?[x,""]:[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
}
function secret(){
  const s=process.env.SESSION_SECRET;
  return s&&s.length>=32?new TextEncoder().encode(s):null;
}
export function authConfigured(){
  return process.env.AUTH_MODE==="entra" &&
    Boolean(process.env.ENTRA_TENANT_ID&&process.env.ENTRA_CLIENT_ID&&process.env.ENTRA_CLIENT_SECRET&&secret());
}
export function roleForIdentity(email){
  const e=String(email||"").toLowerCase();
  const list=k=>String(process.env[k]||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(list("AUTH_ADMIN_EMAILS").includes(e))return"compliance_admin";
  if(list("AUTH_MANAGER_EMAILS").includes(e))return"compliance_manager";
  if(list("AUTH_REVIEWER_EMAILS").includes(e))return"reviewer";
  return process.env.AUTH_DEFAULT_ROLE||"viewer";
}
export async function createSession(user){
  const k=secret();if(!k)throw new Error("SESSION_SECRET_NOT_CONFIGURED");
  return new SignJWT(user).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("8h").setIssuer("agris-compliance").setAudience("agris-compliance-web").sign(k);
}
export async function readSession(req){
  const k=secret();if(!k)return null;
  const token=cookieMap(req)[COOKIE];if(!token)return null;
  try{
    const {payload}=await jwtVerify(token,k,{issuer:"agris-compliance",audience:"agris-compliance-web"});
    return payload;
  }catch{return null}
}
export function setSessionCookie(res,token){
  res.setHeader("Set-Cookie",COOKIE+"="+encodeURIComponent(token)+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800");
}
export function clearSessionCookie(res){
  res.setHeader("Set-Cookie",COOKIE+"=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
}
export function setStateCookie(res,state){
  res.setHeader("Set-Cookie",STATE_COOKIE+"="+encodeURIComponent(state)+"; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600");
}
export function consumeState(req,res){
  const value=cookieMap(req)[STATE_COOKIE]||null;
  res.setHeader("Set-Cookie",STATE_COOKIE+"=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return value;
}
export function appUrl(req){
  if(process.env.APP_URL)return process.env.APP_URL.replace(/\/$/,"");
  const proto=String(req.headers["x-forwarded-proto"]||"https").split(",")[0];
  const host=String(req.headers["x-forwarded-host"]||req.headers.host||"").split(",")[0];
  return proto+"://"+host;
}
