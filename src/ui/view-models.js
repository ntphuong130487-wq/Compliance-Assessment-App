(function(){
  function count(list,p){return (list||[]).filter(p).length}
  function assessmentSummary(assessments,ra){
    assessments=assessments||[];ra=ra||[];
    var total=ra.length,done=count(ra,function(r){return r.workflow==="done"});
    return{
      open:count(assessments,function(a){return a.status!=="closed"}),
      fieldwork:count(assessments,function(a){return a.status==="fieldwork"}),
      review:count(assessments,function(a){return a.status==="review"||a.status==="in_review"}),
      closed:count(assessments,function(a){return a.status==="closed"}),
      coverage:total?Math.round(done*100/total):0,
      totalPoints:total,
      donePoints:done,
      orgCount:new Set(assessments.map(function(a){return a.orgId}).filter(Boolean)).size
    }
  }
  function findingSummary(findings){
    findings=findings||[];
    return{
      open:count(findings,function(f){return f.status!=="closed"&&f.status!=="dismissed"}),
      high:count(findings,function(f){return (f.severity==="high"||f.severity==="critical")&&f.status!=="closed"&&f.status!=="dismissed"}),
      pendingResponse:count(findings,function(f){return f.status==="pending_unit_response"}),
      pendingFinal:count(findings,function(f){return f.status==="pending_final_review"}),
      final:count(findings,function(f){return f.status==="final"}),
      closed:count(findings,function(f){return f.status==="closed"||f.status==="dismissed"})
    }
  }
  function actionSummary(actions,daysUntil,evidenceCount){
    actions=actions||[];
    return{
      total:actions.length,
      open:count(actions,function(a){return a.status!=="closed"}),
      overdue:count(actions,function(a){var d=daysUntil(a.due);return a.status!=="closed"&&d!==null&&d<0}),
      pendingVerification:count(actions,function(a){return a.status==="submitted_for_verification"}),
      closed:count(actions,function(a){return a.status==="closed"}),
      withClosureEvidence:count(actions,function(a){return evidenceCount(a.id)>0})
    }
  }
  function resultDistribution(ra,keys){
    ra=ra||[];keys=keys||["not_assessed","compliant","partially_compliant","non_compliant","not_applicable","insufficient_evidence"];
    return keys.map(function(k){return{k:k,n:count(ra,function(x){return x.result===k})}})
  }
  window.ComplianceViewModels={assessmentSummary:assessmentSummary,findingSummary:findingSummary,actionSummary:actionSummary,resultDistribution:resultDistribution};
})();