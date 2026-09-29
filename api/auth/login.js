import crypto from "node:crypto";
import { authConfigured, appUrl, setStateCookie } from "../../lib/auth-session.js";

export default function handler(req,res){
  if(!authConfigured())return res.status(503).json({ok:false,error:"AUTH_NOT_CONFIGURED"});
  const state=crypto.randomUUID();setStateCookie(res,state);
  const tenant=process.env.ENTRA_TENANT_ID,client=process.env.ENTRA_CLIENT_ID;
  const redirect=appUrl(req)+"/api/auth/callback";
  const params=new URLSearchParams({client_id:client,response_type:"code",redirect_uri:redirect,response_mode:"query",scope:"openid profile email",state});
  res.redirect(302,"https://login.microsoftonline.com/"+encodeURIComponent(tenant)+"/oauth2/v2.0/authorize?"+params.toString());
}
