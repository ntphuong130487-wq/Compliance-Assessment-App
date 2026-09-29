import { neon } from "@neondatabase/serverless";
import { clerkConfigured } from "../lib/clerk-auth.js";

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const databaseConfigured=Boolean(process.env.DATABASE_URL);
  let normalizedReady=false,stateStoreReady=false,dbError=null;
  if(databaseConfigured){
    try{
      const sql=neon(process.env.DATABASE_URL);
      const rows=await sql`
        SELECT
          to_regclass('public.compliance_app_state') IS NOT NULL AS state_store,
          to_regclass('public.compliance_requirements') IS NOT NULL
            AND to_regclass('public.notifications') IS NOT NULL
            AND to_regclass('public.app_users') IS NOT NULL AS normalized_ready
      `;
      stateStoreReady=Boolean(rows[0]?.state_store);
      normalizedReady=Boolean(rows[0]?.normalized_ready);
    }catch(e){dbError="DATABASE_CHECK_FAILED"}
  }
  const missing=[];
  if(process.env.AUTH_MODE!=="clerk")missing.push("AUTH_MODE=clerk");
  for(const k of ["CLERK_PUBLISHABLE_KEY","CLERK_SECRET_KEY","APP_URL"])if(!process.env[k])missing.push(k);
  if(!process.env.DATABASE_URL)missing.push("DATABASE_URL");
  if(!process.env.BLOB_READ_WRITE_TOKEN)missing.push("BLOB_READ_WRITE_TOKEN");
  res.status(200).json({
    ok:true,
    version:"0.7.0",
    productionReady:clerkConfigured()&&databaseConfigured&&normalizedReady&&Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    missing,
    auth:{configured:clerkConfigured(),mode:process.env.AUTH_MODE||null,provider:process.env.AUTH_MODE==="clerk"?"Clerk":null,invitationOnly:true},
    database:{configured:databaseConfigured,stateStoreReady,normalizedReady,error:dbError},
    storage:{configured:Boolean(process.env.BLOB_READ_WRITE_TOKEN),provider:process.env.BLOB_READ_WRITE_TOKEN?"Vercel Blob":null},
    search:{regulationProviderConfigured:Boolean(process.env.REGULATION_SEARCH_PROVIDER)},
    ai:{configured:Boolean(process.env.AI_GATEWAY_API_KEY&&process.env.AI_EXTRACTION_MODEL)}
  });
}
