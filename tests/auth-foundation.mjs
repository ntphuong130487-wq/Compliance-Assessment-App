process.env.AUTH_MODE="entra";
process.env.ENTRA_TENANT_ID="tenant-test";
process.env.ENTRA_CLIENT_ID="client-test";
process.env.ENTRA_CLIENT_SECRET="secret-test";
process.env.SESSION_SECRET="0123456789abcdef0123456789abcdef";
process.env.AUTH_MANAGER_EMAILS="manager@example.com";
process.env.AUTH_DEFAULT_ROLE="viewer";

const A=await import("../lib/auth-session.js");
function assert(ok,msg){if(!ok)throw new Error(msg)}
assert(A.authConfigured(),"Entra auth should be configured");
assert(A.roleForIdentity("manager@example.com")==="compliance_manager","Manager mapping failed");
assert(A.roleForIdentity("other@example.com")==="viewer","Default role failed");
const token=await A.createSession({sub:"u1",email:"manager@example.com",name:"Manager",role:"compliance_manager",tenantId:"t1"});
const user=await A.readSession({headers:{cookie:"agris_compliance_session="+encodeURIComponent(token)}});
assert(user&&user.email==="manager@example.com","Signed session verification failed");
console.log("PASS - Entra auth/session foundation");
