import fs from "node:fs";
const schema=fs.readFileSync("db/schema.sql","utf8");
const migration=fs.readFileSync("db/migrations/002_p2_operational.sql","utf8");
function assert(ok,msg){if(!ok)throw new Error(msg)}
for(const name of ["app_users","user_org_scopes","notifications","user_notification_reads"]){
  assert(schema.includes("CREATE TABLE IF NOT EXISTS "+name),"Canonical schema missing "+name);
  assert(migration.includes("CREATE TABLE IF NOT EXISTS "+name),"P2 migration missing "+name);
}
for(const col of ["issuer","issue_date","applicability","obligation_type","approved_at","disposition","closure_submitted_at"]){
  assert((schema+migration).includes(col),"Missing P2 field "+col);
}
console.log("PASS - normalized P2 database schema readiness");
