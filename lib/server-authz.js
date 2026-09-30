import { userContext } from "./clerk-auth.js";

const ROLE_PERMISSIONS={
  compliance_admin:["view_dashboard","manage_framework","approve_framework","manage_assessment","assign_assessment_work","conduct_fieldwork","review_assessment","review_ai","confirm_finding","assign_action","approve_action_change","verify_action","view_reports","administer_access"],
  compliance_manager:["view_dashboard","manage_framework","approve_framework","manage_assessment","assign_assessment_work","conduct_fieldwork","review_assessment","review_ai","confirm_finding","assign_action","approve_action_change","verify_action","view_reports"],
  lead_assessor:["view_dashboard","assign_assessment_work","conduct_fieldwork","review_ai","confirm_finding","assign_action","approve_action_change","verify_action","view_reports"],
  assessor:["view_dashboard","conduct_fieldwork","review_ai","view_reports"],
  reviewer:["view_dashboard","review_assessment","review_ai","confirm_finding","verify_action","view_reports"],
  unit_owner:["view_dashboard","respond_finding","update_assigned_action","view_reports"],
  viewer:["view_dashboard","view_reports"]
};

export async function requireUser(req){
  const user=await userContext(req);
  if(!user) return {ok:false,status:401,error:"AUTH_REQUIRED"};
  if(!user.provisioned||user.status!=="active") return {ok:false,status:403,error:"USER_NOT_PROVISIONED"};
  return {ok:true,user};
}

export function hasPermission(user,permission){
  return Boolean(user&&ROLE_PERMISSIONS[user.role]?.includes(permission));
}

export function orgAllowed(user,orgId){
  if(!user) return false;
  if(user.orgIds?.includes("*")) return true;
  return Boolean(orgId&&user.orgIds?.includes(String(orgId)));
}

export function assertPermission(user,permission){
  if(!hasPermission(user,permission)){
    const e=new Error("FORBIDDEN");
    e.status=403;e.code="FORBIDDEN";
    throw e;
  }
}

export function assertOrgScope(user,orgId){
  if(!orgAllowed(user,orgId)){
    const e=new Error("ORG_SCOPE_FORBIDDEN");
    e.status=403;e.code="ORG_SCOPE_FORBIDDEN";
    throw e;
  }
}

export function visibleOrgIds(user){
  return user?.orgIds?.includes("*")?null:(user?.orgIds||[]);
}

export function permissionMatrix(){
  return ROLE_PERMISSIONS;
}
