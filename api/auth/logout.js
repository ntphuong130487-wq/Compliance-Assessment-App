import { appUrl, clearSessionCookie } from "../../lib/auth-session.js";
export default function handler(req,res){clearSessionCookie(res);res.redirect(302,appUrl(req)+"/")}
