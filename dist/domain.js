export const MODEL_VERSION = '1.0-rc1';

export const ROLE_CAPABILITIES = {
  Admin: new Set(['manage_master','create_assessment','manage_assessment','fieldwork','confirm_finding','assign_action','verify_action','manage_exception','signoff','reopen','export','import','qa']),
  Compliance: new Set(['manage_master','create_assessment','manage_assessment','fieldwork','confirm_finding','assign_action','verify_action','manage_exception','signoff','reopen','export','qa']),
  Assessor: new Set(['fieldwork','confirm_finding','export','qa']),
  Reviewer: new Set(['fieldwork','confirm_finding','verify_action','signoff','export','qa']),
  'Unit Owner': new Set(['unit_response','update_action','export']),
  Viewer: new Set(['export'])
};

export const can = (role, capability) => Boolean(ROLE_CAPABILITIES[role]?.has(capability));

export const emptyState = () => ({
  meta: { modelVersion: MODEL_VERSION, createdAt: new Date().toISOString(), mode: 'browser-local', demoLoaded: false },
  orgUnits: [
    {id:'org_ho',code:'HO',name:'HO',type:'HO',parentId:null,status:'active'},
    {id:'org_agric',code:'AgriC',name:'AgriC',type:'Center',parentId:'org_ho',status:'active'},
    {id:'org_proc',code:'ProC',name:'ProC',type:'Center',parentId:'org_ho',status:'active'},
    {id:'org_comc',code:'ComC',name:'ComC',type:'Center',parentId:'org_ho',status:'active'}
  ],
  actors: [],
  complianceSources: [],
  frameworks: [],
  requirements: [],
  frameworkRequirements: [],
  controlReferences: [],
  existingControls: [],
  requirementControlReferences: [],
  assessmentPrograms: [],
  assessments: [],
  assessmentScopes: [],
  assessmentAssignments: [],
  requirementAssessments: [],
  requirementAssessmentExistingControls: [],
  findings: [],
  remediationActions: [],
  verifications: [],
  exceptions: [],
  unitResponses: [],
  evidence: [],
  evidenceRevisions: [],
  evidenceLinks: [],
  aiProposals: [],
  decisionLogs: []
});

export const generateId = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
export const nowIso = () => new Date().toISOString();

export function appendDecision(state, {objectType, objectId, decisionType, fromState=null, toState=null, reason='', actor='Current user'}) {
  state.decisionLogs.push({
    id: generateId('log'), objectType, objectId, decisionType, fromState, toState, reason,
    decidedBy: actor, decidedAt: nowIso()
  });
}

export function loadDemo(state) {
  const s = structuredClone(emptyState());
  const sourceId='src_demo', fwId='fw_demo', programId='prog_demo', asId='as_demo';
  s.complianceSources.push({
    id:sourceId, sourceType:'internal_policy', code:'DEMO-SOURCE', title:'Nguồn minh họa – không phải quy định thực tế của AgriS',
    version:'0.1', effectiveFrom:null, effectiveTo:null, owner:'DEMO', status:'draft'
  });
  s.frameworks.push({id:fwId,code:'FW-DEMO',name:'Khung tuân thủ minh họa',version:'0.1',status:'draft',owner:'DEMO',effectiveFrom:null});
  const reqs = [
    ['REQ-DEMO-01','Phê duyệt phải hoàn tất trước khi thực hiện giao dịch'],
    ['REQ-DEMO-02','Hồ sơ phải được lưu đầy đủ và có thể truy xuất'],
    ['REQ-DEMO-03','Giao dịch phải tuân thủ phân quyền được phê duyệt']
  ].map(([code,title],idx)=>({
    id:`req_demo_${idx+1}`,code,title,description:'Yêu cầu minh họa phục vụ kiểm thử chức năng, không phải nghĩa vụ thực tế.',
    sourceId,sourceClause:`DEMO-${idx+1}`,parentId:null,assessable:true,mandatoryLevel:'mandatory',
    testProcedure:'Đối chiếu hồ sơ/chứng từ và dữ liệu vận hành với yêu cầu.',expectedEvidence:'Hồ sơ, chứng từ, log hệ thống hoặc hình ảnh phù hợp.',status:'draft'
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
  const total=state.requirementAssessments.length;
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
