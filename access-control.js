(function(g){
  "use strict";
  var STORAGE_KEY="agris_compliance_persona_v03";
  var roles={
    compliance_admin:{
      label:"Quản trị Tuân thủ",
      permissions:["view_dashboard","manage_framework","approve_framework","manage_assessment","conduct_fieldwork","review_ai","confirm_finding","assign_action","verify_action","view_reports","administer_access"]
    },
    compliance_manager:{
      label:"Quản lý Tuân thủ",
      permissions:["view_dashboard","manage_framework","approve_framework","manage_assessment","conduct_fieldwork","review_ai","confirm_finding","assign_action","verify_action","view_reports"]
    },
    lead_assessor:{
      label:"Trưởng đoàn đánh giá",
      permissions:["view_dashboard","conduct_fieldwork","review_ai","confirm_finding","assign_action","verify_action","view_reports"]
    },
    assessor:{
      label:"Người kiểm tra",
      permissions:["view_dashboard","conduct_fieldwork","review_ai","view_reports"]
    },
    reviewer:{
      label:"Người rà soát",
      permissions:["view_dashboard","review_ai","confirm_finding","verify_action","view_reports"]
    },
    unit_owner:{
      label:"Đơn vị được đánh giá",
      permissions:["view_dashboard","respond_finding","update_assigned_action","view_reports"]
    },
    viewer:{
      label:"Chỉ xem",
      permissions:["view_dashboard","view_reports"]
    }
  };
  var personas=[
    {id:"p_admin",label:"Mô phỏng · Quản trị Tuân thủ",role:"compliance_admin",orgIds:["*"]},
    {id:"p_manager",label:"Mô phỏng · Quản lý Tuân thủ",role:"compliance_manager",orgIds:["*"]},
    {id:"p_lead",label:"Mô phỏng · Trưởng đoàn đánh giá",role:"lead_assessor",orgIds:["*"]},
    {id:"p_assessor",label:"Mô phỏng · Người kiểm tra",role:"assessor",orgIds:["agric"]},
    {id:"p_reviewer",label:"Mô phỏng · Người rà soát",role:"reviewer",orgIds:["*"]},
    {id:"p_unit",label:"Mô phỏng · Đơn vị được đánh giá",role:"unit_owner",orgIds:["agric"]},
    {id:"p_viewer",label:"Mô phỏng · Chỉ xem",role:"viewer",orgIds:["*"]}
  ];
  function current(){
    var id;
    try{id=localStorage.getItem(STORAGE_KEY)}catch(e){}
    return personas.find(function(p){return p.id===id})||personas[0];
  }
  function setPersona(id){
    if(!personas.some(function(p){return p.id===id}))return false;
    try{localStorage.setItem(STORAGE_KEY,id)}catch(e){}
    return true;
  }
  function allowedOrg(persona,assessment){
    if(!assessment)return true;
    if(persona.orgIds.indexOf("*")>=0)return true;
    return persona.orgIds.indexOf(assessment.orgId)>=0;
  }
  function can(permission,ctx){
    var p=current(),r=roles[p.role];
    if(!r||r.permissions.indexOf(permission)<0)return false;
    return allowedOrg(p,ctx&&ctx.assessment);
  }
  function viewAllowed(view){
    var map={
      dashboard:"view_dashboard",
      frameworks:"view_dashboard",
      assessments:"view_dashboard",
      fieldwork:"view_dashboard",
      findings:"view_dashboard",
      actions:"view_dashboard",
      reports:"view_reports",
      settings:"administer_access"
    };
    return can(map[view]||"view_dashboard");
  }
  g.ComplianceAccess={roles:roles,personas:personas,current:current,setPersona:setPersona,can:can,viewAllowed:viewAllowed};
})(window);
