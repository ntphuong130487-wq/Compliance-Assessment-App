import { createRemoteJWKSet, jwtVerify } from "jose";
import { authConfigured, appUrl, consumeState, createSession, roleForIdentity, setSessionCookie } from "../../lib/auth-session.js";

export default async function handler(req,res){
  if(!authConfigured())return res.status(503).json({ok:false,error:"AUTH_NOT_CONFIGURED"});
  const expected=consumeState(req,res);
  if(!expected||req.query?.state!==expected)return res.status(400).send("OAuth state không hợp lệ.");
  if(!req.query?.code)return res.status(400).send("Thiếu authorization code.");
  const tenant=process.env.ENTRA_TENANT_ID,client=process.env.ENTRA_CLIENT_ID,secret=process.env.ENTRA_CLIENT_SECRET;
  const redirect=appUrl(req)+"/api/auth/callback";
  const body=new URLSearchParams({client_id:client,client_secret:secret,grant_type:"authorization_code",code:String(req.query.code),redirect_uri:redirect,scope:"openid profile email"});
  const tokenRes=await fetch("https://login.microsoftonline.com/"+encodeURIComponent(tenant)+"/oauth2/v2.0/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
  const tokens=await tokenRes.json();
  if(!tokenRes.ok||!tokens.id_token)return res.status(401).json({ok:false,error:"TOKEN_EXCHANGE_FAILED"});
  const jwks=createRemoteJWKSet(new URL("https://login.microsoftonline.com/"+encodeURIComponent(tenant)+"/discovery/v2.0/keys"));
  const issuer="https://login.microsoftonline.com/"+tenant+"/v2.0";
  const {payload}=await jwtVerify(tokens.id_token,jwks,{issuer,audience:client});
  const email=String(payload.preferred_username||payload.email||payload.upn||"");
  if(!email)return res.status(401).json({ok:false,error:"IDENTITY_EMAIL_MISSING"});
  const user={sub:String(payload.sub),email,name:String(payload.name||email),role:roleForIdentity(email),tenantId:String(payload.tid||tenant)};
  const session=await createSession(user);setSessionCookie(res,session);
  res.redirect(302,appUrl(req)+"/");
}
