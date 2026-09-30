import fs from "node:fs";
const schema=fs.readFileSync("db/schema.sql","utf8");
const migration=fs.readFileSync("db/migrations/002_p2_operational.sql","utf8");
const clerkMigration=fs.readFileSync("db/migrations/003_clerk_neon_auth.sql","utf8");
const aiMigration=fs.readFileSync("db/migrations/005_ai_obligation_intelligence.sql","utf8");
function assert(ok,msg){if(!ok)throw new Error(msg)}
for(const name of ["app_users","user_org_scopes","notifications","user_notification_reads"]){
  assert(schema.includes("CREATE TABLE IF NOT EXISTS "+name),"Canonical schema missing "+name);
  assert(migration.includes("CREATE TABLE IF NOT EXISTS "+name),"P2 migration missing "+name);
}
for(const col of ["issuer","issue_date","applicability","obligation_type","approved_at","disposition","closure_submitted_at"]){
  assert((schema+migration).includes(col),"Missing P2 field "+col);
}
assert(clerkMigration.includes("public_metadata")&&clerkMigration.includes("identity_provider"),"Clerk migration incomplete");
for(const col of ["ai_generated","ai_confidence","ai_engine","ai_schema_version","ai_field_confidence","ai_review_reasons","ai_uncertainties","ai_payload"]){
  assert(schema.includes(col),"Canonical schema missing AI field "+col);
  assert(aiMigration.includes(col),"AI migration missing "+col);
}
assert(aiMigration.includes("chk_draft_requirements_ai_confidence"),"AI confidence constraint missing");
console.log("PASS - normalized schema + Clerk + AI obligation metadata readiness");
