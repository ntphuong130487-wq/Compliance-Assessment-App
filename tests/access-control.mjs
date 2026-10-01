import fs from "node:fs";
import vm from "node:vm";

const code=fs.readFileSync("access-control.js","utf8");
const store=new Map();
const context={
  window:{},
  localStorage:{
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v))
  }
};
vm.createContext(context);
vm.runInContext(code,context);
const A=context.window.ComplianceAccess;
function assert(ok,msg){if(!ok)throw new Error(msg)}

assert(A&&A.roles&&A.personas,"AccessControl not initialized");
A.setPersona("p_viewer");
assert(!A.can("manage_framework"),"Viewer must not manage framework");
assert(A.can("view_reports"),"Viewer should view reports");

A.setPersona("p_admin");
assert(A.can("administer_access"),"Admin must administer access");
assert(A.can("approve_framework"),"Admin must approve framework");
assert(A.can("confirm_finding"),"Admin must confirm finding");

A.setPersona("p_manager");
assert(A.can("approve_framework"),"Compliance manager must approve framework");
assert(A.can("review_assessment"),"Compliance manager should review/close assessments");
assert(A.can("approve_action_change"),"Compliance manager should approve action due-date changes");
assert(A.can("assign_assessment_work"),"Compliance manager should assign requirement work");

A.setPersona("p_assessor");
assert(A.can("conduct_fieldwork",{assessment:{orgId:"agric"}}),"Assessor should work in assigned org");
assert(!A.can("conduct_fieldwork",{assessment:{orgId:"proc"}}),"Assessor must be blocked outside org scope");
assert(!A.can("confirm_finding",{assessment:{orgId:"agric"}}),"Assessor must not confirm finding");

A.setPersona("p_reviewer");
assert(A.can("verify_action"),"Reviewer should verify actions");
assert(A.can("review_assessment"),"Reviewer should review/close assessments");
assert(!A.can("approve_action_change"),"Reviewer should not approve action due-date changes");

A.setRuntimeUser({id:"user_real",role:"assessor",orgIds:["proc"],name:"Real User"});
assert(A.can("conduct_fieldwork",{assessment:{orgId:"proc"}}),"Runtime Clerk user should inherit assigned org scope");
assert(!A.can("conduct_fieldwork",{assessment:{orgId:"agric"}}),"Runtime Clerk user must be blocked outside assigned org scope");
A.setRuntimeUser(null);

console.log("PASS - RBAC role matrix and runtime org scope");
