process.env.AUTH_MODE="clerk";
process.env.CLERK_PUBLISHABLE_KEY="pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk";
process.env.CLERK_SECRET_KEY="sk_test_example";
process.env.AUTH_ALLOWED_EMAIL_DOMAINS="agris.example,subsidiary.example";

const A=await import("../lib/clerk-auth.js");
function assert(ok,msg){if(!ok)throw new Error(msg)}
assert(A.clerkConfigured(),"Clerk should be configured");
assert(A.allowedEmail("user@agris.example"),"Allowed domain should pass");
assert(!A.allowedEmail("user@gmail.com"),"Unapproved domain should fail");
assert(A.normalizeRole("compliance_manager")==="compliance_manager","Known role normalization failed");
assert(A.normalizeRole("unknown_role")==="viewer","Unknown role should fall back to viewer");
console.log("PASS - Clerk auth/provisioning foundation");

const userRoutes=read("lib/user-routes.js");
const clerkAuth=read("lib/clerk-auth.js");
assert(userRoutes.includes("self-signup-preprovisioned"),"Pre-provision access model missing");
assert(clerkAuth.includes("FROM app_users WHERE lower(email)="),"DB-backed user provisioning lookup missing");
assert(!userRoutes.includes("createInvitation({"),"Paid/custom-domain Clerk invitation path should not be required");
