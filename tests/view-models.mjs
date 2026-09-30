global.window={};
await import("../src/ui/view-models.js");
const VM=global.window.ComplianceViewModels;

function assert(ok,msg){if(!ok)throw new Error(msg)}

const assessments=[
  {id:"a1",status:"fieldwork",orgId:"o1"},
  {id:"a2",status:"closed",orgId:"o2"},
  {id:"a3",status:"review",orgId:"o1"}
];
const ra=[
  {workflow:"done",result:"compliant"},
  {workflow:"in_review",result:"non_compliant"},
  {workflow:"done",result:"not_applicable"}
];
const as=VM.assessmentSummary(assessments,ra);
assert(as.open===2&&as.fieldwork===1&&as.review===1&&as.closed===1,"Assessment summary incorrect");
assert(as.coverage===67&&as.orgCount===2,"Assessment coverage/org summary incorrect");

const fs=VM.findingSummary([
  {status:"pending_unit_response",severity:"high"},
  {status:"pending_final_review",severity:"medium"},
  {status:"final",severity:"critical"},
  {status:"closed",severity:"critical"}
]);
assert(fs.open===3&&fs.high===2&&fs.pendingResponse===1&&fs.pendingFinal===1&&fs.final===1&&fs.closed===1,"Finding summary incorrect");

const today=new Date();
function duediff(d){return d}
const actions=[
  {id:"x1",status:"open",due:-2},
  {id:"x2",status:"submitted_for_verification",due:3},
  {id:"x3",status:"closed",due:-8}
];
const ac=VM.actionSummary(actions,duediff,function(id){return id==="x2"?1:0});
assert(ac.total===3&&ac.open===2&&ac.overdue===1&&ac.pendingVerification===1&&ac.closed===1&&ac.withClosureEvidence===1,"Action summary incorrect");

const dist=VM.resultDistribution(ra);
assert(dist.find(x=>x.k==="compliant").n===1&&dist.find(x=>x.k==="non_compliant").n===1,"Result distribution incorrect");

console.log("PASS - Product view-model behavior");
