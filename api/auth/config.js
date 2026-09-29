import { clerkConfigured } from "../../lib/clerk-auth.js";
export default function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  return res.status(200).json({
    ok:true,
    configured:clerkConfigured(),
    publishableKey:clerkConfigured()?process.env.CLERK_PUBLISHABLE_KEY:null,
    provider:"Clerk",
    mode:process.env.AUTH_MODE||null,
    invitationOnly:true
  });
}
