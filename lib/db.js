import { neon } from "@neondatabase/serverless";

export function normalizedMode(){
  return process.env.DATA_MODE==="normalized";
}

export function databaseConfigured(){
  return Boolean(process.env.DATABASE_URL);
}

export function sqlClient(){
  if(!databaseConfigured()) throw new Error("DATABASE_URL_NOT_CONFIGURED");
  return neon(process.env.DATABASE_URL);
}

export async function normalizedReady(sql=sqlClient()){
  const rows=await sql`
    SELECT
      to_regclass('public.org_units') IS NOT NULL AS org_units,
      to_regclass('public.compliance_sources') IS NOT NULL AS sources,
      to_regclass('public.compliance_requirements') IS NOT NULL AS requirements,
      to_regclass('public.compliance_assessments') IS NOT NULL AS assessments,
      to_regclass('public.requirement_assessments') IS NOT NULL AS requirement_assessments,
      to_regclass('public.findings') IS NOT NULL AS findings,
      to_regclass('public.remediation_actions') IS NOT NULL AS actions,
      to_regclass('public.app_users') IS NOT NULL AS users,
      to_regclass('public.unit_responses') IS NOT NULL AS unit_responses,
      to_regclass('public.draft_requirements') IS NOT NULL AS draft_requirements
  `;
  return Object.values(rows[0]||{}).every(Boolean);
}

export function asUuid(value){
  const s=String(value||"").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)?s:null;
}

export function publicError(error,fallback="DATABASE_ERROR"){
  const code=String(error?.code||"");
  if(code==="23505") return "DUPLICATE_RECORD";
  if(code==="23503") return "REFERENCE_CONSTRAINT";
  if(code==="22P02") return "INVALID_IDENTIFIER";
  return fallback;
}
