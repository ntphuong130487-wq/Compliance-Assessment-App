const roles = {
  compliance_admin:["view_dashboard","manage_framework","manage_assessment","conduct_fieldwork","review_ai","confirm_finding","assign_action","verify_action","view_reports","administer_access"],
  compliance_manager:["view_dashboard","manage_framework","manage_assessment","conduct_fieldwork","review_ai","confirm_finding","assign_action","verify_action","view_reports"],
  lead_assessor:["view_dashboard","conduct_fieldwork","review_ai","confirm_finding","assign_action","verify_action","view_reports"],
  assessor:["view_dashboard","conduct_fieldwork","review_ai","view_reports"],
  reviewer:["view_dashboard","review_ai","confirm_finding","verify_action","view_reports"],
  unit_owner:["view_dashboard","respond_finding","update_assigned_action","view_reports"],
  viewer:["view_dashboard","view_reports"]
};

export default function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  res.status(200).json({
    ok:true,
    authConfigured:Boolean(process.env.AUTH_MODE),
    authMode:process.env.AUTH_MODE||"not-configured",
    enforcement:"authorization-policy-ready; authentication-provider-pending",
    roles
  });
}
