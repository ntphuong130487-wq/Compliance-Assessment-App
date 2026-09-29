quirementAssessments.length;
  const done=state.requirementAssessments.filter(r=>r.workflowStatus==='done').length;
  const coverage=total?Math.round(done*100/total):0;
  const nonCompliant=state.requirementAssessments.filter(r=>r.complianceResult==='non_compliant').length;
  const findingsOpen=state.findings.filter(f=>!['closed','dismissed'].includes(f.status)).length;
  const today=Date.now();
  const actionsOverdue=state.remediationActions.filter(a=>a.status!=='closed'&&a.dueDate&&new Date(a.dueDate).getTime()<today).length;
  return {active,total,done,coverage,nonCompliant,findingsOpen,actionsOverdue};
}

export function validateState(state) {
  const errors=[],warnings=[];
  const exists=(arr,id)=>arr.some(x=>x.id===id);
  for(const fr of state.frameworkRequirements){if(!exists(state.frameworks,fr.frameworkId))errors.push(`frameworkRequirements ${fr.id}: thiếu Framework`);if(!exists(state.requirements,fr.requirementId))errors.push(`frameworkRequirements ${fr.id}: thiếu Requirement`)}
  for(const a of state.assessments){if(!exists(state.frameworks,a.frameworkId))errors.push(`Assessment ${a.id}: thiếu Framework`);if(['signed_off','closed'].includes(a.status)&&!a.locked)errors.push(`Assessment ${a.id}: đã sign-off/closed nhưng chưa lock`)}
  for(const ra of state.requirementAssessments){if(!exists(state.assessments,ra.assessmentId))errors.push(`RequirementAssessment ${ra.id}: thiếu Assessment`);if(!exists(state.requirements,ra.requirementId))errors.push(`RequirementAssessment ${ra.id}: thiếu Requirement`);if(!ra.snapshot?.code)warnings.push(`RequirementAssessment ${ra.id}: chưa có snapshot`)}
  for(const rev of state.evidenceRevisions){if(!exists(state.evidence,rev.evidenceId))errors.push(`EvidenceRevision ${rev.id}: thiếu Evidence`);if(!rev.sha256)warnings.push(`EvidenceRevision ${rev.id}: chưa có SHA-256`)}
  for(const link of state.evidenceLinks){if(!exists(state.evidenceRevisions,link.evidenceRevisionId))errors.push(`EvidenceLink ${link.id}: thiếu Revision`)}
  for(const f of state.findings){if(!exists(state.requirementAssessments,f.requirementAssessmentId))errors.push(`Finding ${f.id}: thiếu RequirementAssessment`);if(f.status!=='draft'&&!f.confirmedAt)errors.push(`Finding ${f.id}: chính thức nhưng thiếu confirmedAt`)}
  for(const a of state.remediationActions){if(!exists(state.findings,a.findingId))errors.push(`RemediationAction ${a.id}: thiếu Finding`);if(!a.owner)warnings.push(`Action ${a.id}: chưa có owner`)}
  for(const v of state.verifications){if(!exists(state.remediationActions,v.actionId))errors.push(`Verification ${v.id}: thiếu Action`)}
  for(const e of state.exceptions){if(!exists(state.requirements,e.requirementId))errors.push(`Exception ${e.id}: thiếu Requirement`);if(!e.expiryDate)errors.push(`Exception ${e.id}: thiếu expiry date`);if(!e.approver)warnings.push(`Exception ${e.id}: chưa có approver`)}
  return {errors,warnings,pass:errors.length===0};
}

export function repeatFindingGroups(state) {
  const map=new Map();
  for(const f of state.findings){
    const ra=state.requirementAssessments.find(x=>x.id===f.requirementAssessmentId);
    if(!ra)continue;
    const key=ra.requirementId;
    if(!map.has(key))map.set(key,[]);
    map.get(key).push(f);
  }
  return [...map.entries()].filter(([,arr])=>arr.length>1).map(([requirementId,arr])=>({requirementId,count:arr.length,findings:arr}));
}
