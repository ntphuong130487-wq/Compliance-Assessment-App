import { neon } from "@neondatabase/serverless";

if(!process.env.DATABASE_URL){
  console.error("DATABASE_URL chưa được cấu hình.");
  process.exit(2);
}
const sql=neon(process.env.DATABASE_URL);
const rows=await sql`
  SELECT
    current_database() AS database_name,
    to_regclass('public.compliance_app_state') IS NOT NULL AS state_store,
    to_regclass('public.compliance_requirements') IS NOT NULL AS requirements,
    to_regclass('public.app_users') IS NOT NULL AS app_users,
    to_regclass('public.notifications') IS NOT NULL AS notifications
`;
console.log(JSON.stringify(rows[0],null,2));
if(!rows[0].requirements||!rows[0].app_users||!rows[0].notifications)process.exit(1);
