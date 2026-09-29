ảnh phù hợp.',status:'draft'
  }));
  s.requirements.push(...reqs);
  s.frameworkRequirements.push(...reqs.map((r,i)=>({id:`fr_demo_${i+1}`,frameworkId:fwId,requirementId:r.id,sortOrder:i+1,applicabilityRule:null})));
  s.assessmentPrograms.push({id:programId,code:'PROGRAM-DEMO',name:'Chương trình minh họa',period:'DEMO',objective:'Kiểm thử end-to-end.',ownerActorId:null,status:'draft'});
  s.assessments.push({
    id:asId,programId,frameworkId:fwId,name:'Đánh giá minh họa – AgriC',objective:'Kiểm thử luồng nghiệp vụ.',
    periodFrom:null,periodTo:null,status:'fieldwork',locked:false,lockedAt:null,createdAt:nowIso()
  });
  s.assessmentScopes.push({id:'scope_demo',assessmentId:asId,orgUnitId:'org_agric',processRef:null,locationRef:null,activityRef:null,scopeNote:'',includeAllRequirements:true});
  s.requirementAssessments.push(...reqs.map((r,i)=>({
    id:`ra_demo_${i+1}`,assessmentId:asId,requirementId:r.id,workflowStatus:i===0?'in_progress':'to_do',complianceResult:'not_assessed',
    findingType:null,observation:'',assessedBy:null,assessedAt:null,snapshot:{code:r.code,title:r.title,sourceClause:r.sourceClause,testProcedure:r.testProcedure,expectedEvidence:r.expectedEvidence}
  })));
  s.meta.demoLoaded=true;
  appendDecision(s,{objectType:'System',objectId:'demo',decisionType:'load_demo',reason:'Dữ liệu minh họa được nạp theo yêu cầu người dùng.'});
  return s;
}

export function frameworkRequirementIds(state, frameworkId) {
  return state.frameworkRequirements.filter(x=>x.frameworkId===frameworkId).sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)).map(x=>x.requirementId);
}

export function createAssessmentFromFramework(state, assessment, scope) {
  state.assessments.push(assessment);
  state.assessmentScopes.push(scope);
  const reqIds = frameworkRequirementIds(state, assessment.frameworkId);
  for (const requirementId of reqIds) {
    const r = state.requirements.find(x=>x.id===requirementId);
    if (!r?.assessable) continue;
    state.requirementAssessments.push({
      id:generateId('ra'),assessmentId:assessment.id,requirementId:r.id,workflowStatus:'to_do',complianceResult:'not_assessed',
      findingType:null,observation:'',assessedBy:null,assessedAt:null,
      snapshot:{code:r.code,title:r.title,sourceClause:r.sourceClause,testProcedure:r.testProcedure,expectedEvidence:r.expectedEvidence}
    });
  }
  appendDecision(state,{objectType:'ComplianceAssessment',objectId:assessment.id,decisionType:'create',toState:assessment.status,reason:assessment.name});
}

export function transitionAssessment(state, assessmentId, nextStatus, actor='Current user', reason='') {
  const a=state.assessments.find(x=>x.id===assessmentId);
  if (!a) throw new Error('Assessment không tồn tại');
  const allowed={
    draft:['approved_plan','fieldwork'],approved_plan:['fieldwork'],fieldwork:['unit_response','review'],unit_response:['review'],review:['signed_off'],signed_off:['closed','reopened'],closed:['reopened'],reopened:['fieldwork','review']
  };
  if (!(allowed[a.status]||[]).includes(nextStatus)) throw new Error(`Không thể chuyển ${a.status} → ${nextStatus}`);
  const prev=a.status;a.status=nextStatus;
  if (nextStatus==='signed_off'||nextStatus==='closed') {a.locked=true;a.lockedAt=nowIso();}
  if (nextStatus==='reopened') {a.locked=false;a.lockedAt=null;}
  appendDecision(state,{objectType:'ComplianceAssessment',objectId:a.id,decisionType:'status_change',fromState:prev,toState:nextStatus,reason,actor});
}

export function metrics(state) {
  const active=state.assessments.filter(a=>!['closed'].includes(a.status)).length;
  const total=state.re