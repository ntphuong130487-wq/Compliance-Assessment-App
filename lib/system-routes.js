import { neon } from "@neondatabase/serverless";
import { clerkConfigured } from "./clerk-auth.js";
import { documentIntelligenceReadiness } from "./document-intelligence.js";
import { aiExtractionReadiness } from "./ai-obligation-extractor.js";

const roles = {
  compliance_admin:["view_dashboard","manage_framework","approve_framework","manage_assessment","conduct_fieldwork","review_ai","confirm_finding","assign_action","verify_action","view_reports","administer_access"],
  compliance_manager:["view_dashboard","manage_framework","approve_framework","manage_assessment","conduct_fieldwork","review_ai","confirm_finding","assign_action","verify_action","view_reports"],
  lead_assessor:["view_dashboard","conduct_fieldwork","review_ai","confirm_finding","assign_action","verify_action","view_reports"],
  assessor:["view_dashboard","conduct_fieldwork","review_ai","view_reports"],
  reviewer:["view_dashboard","review_ai","confirm_finding","verify_action","view_reports"],
  unit_owner:["view_dashboard","respond_finding","update_assigned_action","view_reports"],
  viewer:["view_dashboard","view_reports"]
};

export async function handleSystem(req,res,route){
  res.setHeader("Cache-Control","no-store");

  if(route==="health"){
    return res.status(200).json({
      ok:true,
      service:"AgriS Compliance Assessment",
      version:"0.8.0",
      databaseConfigured:Boolean(process.env.DATABASE_URL),
      authConfigured:clerkConfigured(),
      evidenceStorageConfigured:Boolean(process.env.BLOB_STORE_ID||process.env.BLOB_READ_WRITE_TOKEN),
      timestamp:new Date().toISOString()
    });
  }

  if(route==="access"){
    return res.status(200).json({
      ok:true,
      authConfigured:clerkConfigured(),
      authMode:process.env.AUTH_MODE||"not-configured",
      enforcement:"server-side-rbac-and-org-scope-ready",
      roles
    });
  }

  if(route!=="readiness")return res.status(404).json({ok:false,error:"SYSTEM_ROUTE_NOT_FOUND"});

  const databaseConfigured=Boolean(process.env.DATABASE_URL);
  let normalizedReady=false,productionCoreReady=false,stateStoreReady=false,dbError=null;
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
      if(normalizedReady){
        const core=await sql`
          SELECT
            to_regclass('public.draft_requirements') IS NOT NULL AS draft_requirements,
            to_regclass('public.unit_responses') IS NOT NULL AS unit_responses,
            to_regclass('public.assessment_assignments') IS NOT NULL AS assignments,
            to_regclass('public.evidence_links') IS NOT NULL AS evidence_links
        `;
        productionCoreReady=Object.values(core[0]||{}).every(Boolean);
      }
    }catch(e){dbError="DATABASE_CHECK_FAILED"}
  }

  const missing=[];
  if(process.env.AUTH_MODE!=="clerk")missing.push("AUTH_MODE=clerk");
  for(const k of ["CLERK_PUBLISHABLE_KEY","CLERK_SECRET_KEY","APP_URL"])if(!process.env[k])missing.push(k);
  if(!process.env.DATABASE_URL)missing.push("DATABASE_URL");
  if(!process.env.BLOB_STORE_ID&&!process.env.BLOB_READ_WRITE_TOKEN)missing.push("Vercel Blob");
  if(process.env.DATA_MODE!=="normalized")missing.push("DATA_MODE=normalized");

  return res.status(200).json({
    ok:true,
    version:"0.8.0",
    productionReady:clerkConfigured()&&databaseConfigured&&normalizedReady&&productionCoreReady&&Boolean(process.env.BLOB_STORE_ID||process.env.BLOB_READ_WRITE_TOKEN)&&process.env.DATA_MODE==="normalized",
    missing,
    auth:{configured:clerkConfigured(),mode:process.env.AUTH_MODE||null,provider:process.env.AUTH_MODE==="clerk"?"Clerk":null,accessModel:"open-signup+server-preprovision"},
    database:{configured:databaseConfigured,stateStoreReady,normalizedReady,productionCoreReady,dataMode:process.env.DATA_MODE||"shared-json",error:dbError},
    storage:{configured:Boolean(process.env.BLOB_STORE_ID||process.env.BLOB_READ_WRITE_TOKEN),provider:(process.env.BLOB_STORE_ID||process.env.BLOB_READ_WRITE_TOKEN)?"Vercel Blob":null,authMode:process.env.BLOB_READ_WRITE_TOKEN?"token":"oidc"},
    search:{regulationProviderConfigured:Boolean(process.env.REGULATION_SEARCH_PROVIDER)},
    documentIntelligence:documentIntelligenceReadiness(),
    ai:aiExtractionReadiness()
  });
}
