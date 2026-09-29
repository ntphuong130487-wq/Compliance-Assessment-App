import {
  can, emptyState, generateId, nowIso, appendDecision, loadDemo,
  createAssessmentFromFramework, transitionAssessment, metrics, validateState,
  frameworkRequirementIds, repeatFindingGroups
} from './domain.js';
import {
  loadState, saveState, resetState, exportState, importState, sha256, backendHealth,
  initializeCloudSync, getSyncStatus, onSyncStatus, syncNow, pullCloudState, forcePushCloud
} from './store.js';

const root=document.getElementById('root');
const fileInput=document.getElementById('fileInput');
const importInput=document.getElementById('importInput');

const NAV=[
  ['dashboard','Điều hành'],['frameworks','Khung tuân thủ'],['assessments','Chương trình đánh giá'],
  ['fieldwork','Kiểm tra hiện trường'],['findings','Phát hiện'],['actions','Khắc phục'],
  ['exceptions','Ngoại lệ'],['reports','Báo cáo']
];
const ROLES=['Admin','Compliance','Assessor','Reviewer','Unit Owner','Viewer'];
const LABELS={
  draft:'Nháp',approved_plan:'Kế hoạch đã duyệt',fieldwork:'Đang kiểm tra',unit_response:'Đơn vị phản hồi',review:'Rà soát',signed_off:'Đã ký chốt',closed:'Đã đóng',reopened:'Mở lại',
  to_do:'Chưa làm',in_progress:'Đang làm',in_review:'Đang rà soát',done:'Hoàn tất',
  not_assessed:'Chưa đánh giá',compliant:'Tuân thủ',partially_compliant:'Tuân thủ một phần',non_compliant:'Không tuân thủ',not_applicable:'Không áp dụng',insufficient_evidence:'Chưa đủ bằng chứng',
  confirmed:'Đã xác nhận',assigned:'Đã giao',pending_verification:'Chờ xác minh',open:'Mở',verified:'Đã xác minh',overdue:'Quá hạn',accepted:'Đã chấp nhận',rejected:'Đã bác bỏ',expired:'Hết hiệu lực',active:'Hiệu lực',dismissed:'Loại bỏ'
};

let state=loadState();
let view='dashboard';
let currentRole=sessionStorage.getItem('agris_compliance_role')||'Compliance';
let selectedAssessment=state.assessments[0]?.id||null;
let selectedRA=state.requirementAssessments[0]?.id||null;
let backend={ok:false,persistence:'browser-local',databaseConfigured:false};
let sync=getSyncStatus();
onSyncStatus(x=>{sync=x;render();});
backendHealth().then(x=>{backend=x;render();});
initializeCloudSync(remote=>{
  state=remote;
  selectedAssessment=state.assessments[0]?.id||null;
  selectedRA=state.requirementAssessments[0]?.id||null;
  render();
});

const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const lab=x=>LABELS[x]||x||'—';
const statusTag=x=>{
  const c=['non_compliant','overdue','reopened','expired'].includes(x)?'red':['compliant','closed','verified','done','signed_off'].includes(x)?'green':['partially_compliant','in_review','pending_verification','unit_response'].includes(x)?'amber':['draft','not_assessed'].includes(x)?'gray':'blue';
  return `<span class="tag ${c}">${esc(lab(x))}</span>`;
};
const persist=()=>saveState(state);
const orgName=id=>state.orgUnits.find(x=>x.id===id)?.name||'—';
const frameworkName=id=>state.frameworks.find(x=>x.id===id)?.name||'—';
const requirement=id=>state.requirements.find(x=>x.id===id);
const assessment=id=>state.assessments.find(x=>x.id===id);
const raById=id=>state.requirementAssessments.find(x=>x.id===id);
const assessmentScope=id=>state.assessmentScopes.find(x=>x.assessmentId===id);
const assessmentRAs=id=>state.requirementAssessments.filter(x=>x.assessmentId===id);
const isLocked=id=>Boolean(assessment(id)?.locked);
const roleCan=cap=>can(currentRole,cap);
const today=()=>new Date().toISOString().slice(0,10);

function navHtml(){return NAV.map(([k,t])=>`<button data-nav="${k}" class="${view===k?'on':''}">${t}</button>`).join('');}
function persistenceBanner(){
  if(sync.conflict){
    return `<div class="note danger"><b>Xung đột phiên bản:</b> cloud có phiên bản mới hơn nên hệ thống đã dừng ghi đè tự động. Dữ liệu trên trình duyệt vẫn được giữ an toàn.
      <div class="row" style="margin-top:8px"><button class="btn alt" data-act="pullCloud">Nạp bản Cloud</button>
      ${currentRole==='Admin'?'<button class="btn red" data-act="forceCloud">Ghi đè Cloud bằng bản hiện tại</button>':''}</div></div>`;
  }
  if(sync.configured&&sync.mode==='cloud'){
    const t=sync.updatedAt?new Date(sync.updatedAt).toLocaleString('vi-VN'):'—';
    return `<div class="note"><b>Lưu trữ dùng chung:</b> Cloud sync đang hoạt động · phiên bản ${esc(sync.version)} · cập nhật ${esc(t)}.
      <button class="btn alt" style="margin-left:8px" data-act="syncNow">Đồng bộ ngay</button></div>`;
  }
  if(backend.databaseConfigured){
    return `<div class="note"><b>Database:</b> backend đã nhận cấu hình nhưng phiên đồng bộ hiện ở trạng thái <b>${esc(sync.mode)}</b>. Dữ liệu cục bộ vẫn được giữ để tránh mất thông tin.</div>`;
  }
  if(sync.mode==='offline'){
    return `<div class="note danger"><b>Offline fallback:</b> chưa kết nối được backend. Dữ liệu vẫn lưu trên trình duyệt và có thể Export/Import để sao lưu.</div>`;
  }
  return `<div class="note"><b>Trạng thái hiện tại:</b> dữ liệu nghiệp vụ đang lưu trên trình duyệt để tiếp tục kiểm thử an toàn. Database dùng chung chưa được kích hoạt; chức năng Export/Import dùng để sao lưu trong giai đoạn này.</div>`;
}
