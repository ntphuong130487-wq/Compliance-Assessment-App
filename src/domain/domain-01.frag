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
    testProcedure:'Đối chiếu hồ sơ/chứng từ và dữ liệu vận hành với yêu cầu.',expectedEvidence:'Hồ sơ, chứng từ, log hệ thống hoặc hình 