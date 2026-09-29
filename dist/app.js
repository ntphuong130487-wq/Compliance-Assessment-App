import {
  can, emptyState, generateId, nowIso, appendDecision, loadDemo,
  createAssessmentFromFramework, transitionAssessment, metrics, validateState,
  frameworkRequirementIds, repeatFindingGroups
} from './domain.js';
import { loadState, saveState, resetState, exportState, importState, sha256, backendHealth } from './store.js';

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
backendHealth().then(x=>{backend=x;render();});

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
  if(backend.databaseConfigured) return `<div class="note"><b>Lưu trữ:</b> backend đã nhận cấu hình database. Trạng thái kết nối chi tiết xem QA/Health.</div>`;
  return `<div class="note"><b>Trạng thái hiện tại:</b> dữ liệu nghiệp vụ đang lưu trên trình duyệt để tiếp tục kiểm thử an toàn. Database dùng chung chưa được kích hoạt; chức năng Export/Import dùng để sao lưu trong giai đoạn này.</div>`;
}
function shell(title,body){
  return `<div class="app">
    <aside class="side">
      <div class="brand"><div class="logo">A</div><div><b>AgriS Compliance</b><small>Assessment App · Production Candidate</small></div></div>
      <div class="nav">${navHtml()}</div>
      <div class="sideFoot"><label>Vai trò đang mô phỏng</label><select id="roleSel">${ROLES.map(r=>`<option ${r===currentRole?'selected':''}>${r}</option>`).join('')}</select><div class="tiny" style="margin-top:7px;opacity:.7">RBAC mô phỏng để kiểm thử UX; chưa thay thế SSO.</div></div>
    </aside>
    <main class="main">
      <header class="top"><div><h1>${esc(title)}</h1><div class="tiny muted">Role: ${esc(currentRole)} · ${backend.databaseConfigured?'DB configured':'Browser persistence'}</div></div>
        <div class="row"><button class="btn alt" data-act="qa">QA Check</button><button class="btn alt" data-act="export">Export</button><button class="btn alt" data-act="import">Import</button></div>
      </header>
      <div class="mobile">${navHtml()}</div>
      <div class="content">${persistenceBanner()}${body}</div>
    </main>
  </div>`;
}

function dashboard(){
  const m=metrics(state);
  const recent=state.decisionLogs.slice().reverse().slice(0,8);
  return shell('Điểm chính cần nắm',`
    <div class="grid kpis">
      <div class="card kpi"><span class="muted small">Assessment đang mở</span><b>${m.active}</b></div>
      <div class="card kpi"><span class="muted small">Điểm hoàn tất</span><b>${m.done}/${m.total}</b></div>
      <div class="card kpi"><span class="muted small">Coverage</span><b>${m.coverage}%</b></div>
      <div class="card kpi"><span class="muted small">Không tuân thủ</span><b>${m.nonCompliant}</b></div>
      <div class="card kpi"><span class="muted small">Finding mở</span><b>${m.findingsOpen}</b></div>
      <div class="card kpi"><span class="muted small">Action quá hạn</span><b>${m.actionsOverdue}</b></div>
    </div>
    <div class="split" style="margin-top:14px">
      <div class="card"><div class="sectionTitle"><div><h2>Tiến độ chương trình</h2><span class="small muted">Coverage tách riêng khỏi kết quả tuân thủ.</span></div>${!state.meta.demoLoaded?'<button class="btn alt" data-act="loadDemo">Nạp dữ liệu demo</button>':''}</div>
        ${state.assessments.length?state.assessments.map(a=>{const rows=assessmentRAs(a.id),done=rows.filter(r=>r.workflowStatus==='done').length,p=rows.length?Math.round(done*100/rows.length):0;return `<div style="margin:14px 0"><div class="row"><b>${esc(a.name)}</b><span class="right">${statusTag(a.status)} ${a.locked?'<span class="tag gray">LOCKED</span>':''}</span></div><div class="small muted">${done}/${rows.length} điểm hoàn tất</div><div class="bar"><i style="width:${p}%"></i></div></div>`}).join(''):'<div class="muted">Chưa có assessment. Bắt đầu từ Khung tuân thủ hoặc Chương trình đánh giá.</div>'}
      </div>
      <div class="card"><h2>Decision log gần nhất</h2>${recent.length?recent.map(x=>`<div class="small" style="padding:8px 0;border-bottom:1px solid var(--line)"><b>${esc(x.decisionType)}</b> · ${esc(x.objectType)}<div class="muted">${new Date(x.decidedAt).toLocaleString('vi-VN')} · ${esc(x.reason||'')}</div></div>`).join(''):'<div class="muted">Chưa có log.</div>'}</div>
    </div>`);
}

function frameworks(){
  return shell('Khung tuân thủ',`
    <div class="sectionTitle"><div><h2>Nguồn tuân thủ</h2><span class="small muted">Pháp luật, VBLQ, quy trình, SOP, hợp đồng, tiêu chuẩn…</span></div>${roleCan('manage_master')?'<button class="btn" data-act="newSource">+ Nguồn</button>':''}</div>
    <div class="table"><table><thead><tr><th>Mã</th><th>Nguồn</th><th>Loại</th><th>Phiên bản</th><th>Hiệu lực</th><th>Owner</th></tr></thead><tbody>${state.complianceSources.length?state.complianceSources.map(s=>`<tr><td>${esc(s.code)}</td><td><b>${esc(s.title)}</b></td><td>${esc(s.sourceType)}</td><td>${esc(s.version||'—')}</td><td>${esc(s.effectiveFrom||'—')}</td><td>${esc(s.owner||'—')}</td></tr>`).join(''):'<tr><td colspan="6" class="muted">Chưa có nguồn tuân thủ.</td></tr>'}</tbody></table></div>
    <div class="sectionTitle" style="margin-top:22px"><div><h2>Framework & Requirement</h2><span class="small muted">Requirement là master; mỗi cuộc đánh giá tạo instance riêng.</span></div>${roleCan('manage_master')?'<button class="btn" data-act="newFramework">+ Tạo khung</button>':''}</div>
    ${state.frameworks.length?state.frameworks.map(f=>{const ids=frameworkRequirementIds(state,f.id),rows=ids.map(requirement).filter(Boolean);return `<div class="card" style="margin-bottom:14px"><div class="row"><div><b>${esc(f.code)} · ${esc(f.name)}</b><div class="small muted">Version ${esc(f.version)} · ${rows.length} requirement</div></div><span class="right">${statusTag(f.status)}</span></div><div class="table" style="margin-top:10px"><table><thead><tr><th>Mã</th><th>Điểm phải tuân thủ</th><th>Nguồn/Điều khoản</th><th>Thủ tục kiểm tra</th><th>Bằng chứng kỳ vọng</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.code)}</td><td><b>${esc(r.title)}</b><div class="tiny muted">${esc(r.description||'')}</div></td><td>${esc(state.complianceSources.find(s=>s.id===r.sourceId)?.code||'—')}<div class="tiny muted">${esc(r.sourceClause||'')}</div></td><td>${esc(r.testProcedure||'Chưa xác định')}</td><td>${esc(r.expectedEvidence||'Chưa xác định')}</td></tr>`).join('')}</tbody></table></div></div>`}).join(''):'<div class="card muted">Chưa có framework.</div>'}`);
}

function lifecycleButtons(a){
  if(!roleCan('manage_assessment')&&!roleCan('signoff')&&!roleCan('reopen')) return '';
  const rows=assessmentRAs(a.id),allDone=rows.length>0&&rows.every(r=>r.workflowStatus==='done');
  const buttons=[];
  if(a.status==='draft'&&roleCan('manage_assessment'))buttons.push(`<button class="btn" data-transition="${a.id}|fieldwork">Bắt đầu fieldwork</button>`);
  if(a.status==='fieldwork'&&roleCan('manage_assessment'))buttons.push(`<button class="btn alt" data-transition="${a.id}|unit_response">Gửi đơn vị phản hồi</button>`,`<button class="btn" data-transition="${a.id}|review">Chuyển review</button>`);
  if(a.status==='unit_response'&&roleCan('manage_assessment'))buttons.push(`<button class="btn" data-transition="${a.id}|review">Chuyển review</button>`);
  if(a.status==='review'&&roleCan('signoff'))buttons.push(`<button class="btn" ${allDone?'':'disabled title="Phải hoàn tất toàn bộ Requirement Assessment"'} data-transition="${a.id}|signed_off">Sign-off & Lock</button>`);
  if(a.status==='signed_off'&&roleCan('signoff'))buttons.push(`<button class="btn" data-transition="${a.id}|closed">Đóng assessment</button>`);
  if(['signed_off','closed'].includes(a.status)&&roleCan('reopen'))buttons.push(`<button class="btn red" data-transition="${a.id}|reopened">Mở lại</button>`);
  if(a.status==='reopened'&&roleCan('manage_assessment'))buttons.push(`<button class="btn" data-transition="${a.id}|fieldwork">Quay lại fieldwork</button>`);
  return buttons.join(' ');
}

function assessments(){
  return shell('Chương trình đánh giá',`
    <div class="sectionTitle"><div><h2>Assessment</h2><span class="small muted">Nếu không mô tả giới hạn requirement, hệ thống mặc định toàn bộ requirement assessable thuộc phạm vi.</span></div>${roleCan('create_assessment')?'<button class="btn" data-act="newAssessment">+ Tạo chương trình</button>':''}</div>
    <div class="table"><table><thead><tr><th>Chương trình / Assessment</th><th>Đơn vị</th><th>Khung</th><th>Phạm vi</th><th>Coverage</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${state.assessments.length?state.assessments.map(a=>{const sc=assessmentScope(a.id),rows=assessmentRAs(a.id),done=rows.filter(r=>r.workflowStatus==='done').length,p=rows.length?Math.round(done*100/rows.length):0;return `<tr><td><b>${esc(a.name)}</b><div class="tiny muted">${esc(a.objective||'')}</div></td><td>${esc(orgName(sc?.orgUnitId))}</td><td>${esc(frameworkName(a.frameworkId))}</td><td>${sc?.includeAllRequirements?'<span class="tag green">Toàn bộ requirement</span>':esc(sc?.scopeNote||'—')}</td><td>${done}/${rows.length} · ${p}%</td><td>${statusTag(a.status)} ${a.locked?'<span class="tag gray">LOCKED</span>':''}</td><td><div class="row"><button class="btn alt" data-openassessment="${a.id}">Mở</button>${lifecycleButtons(a)}</div></td></tr>`}).join(''):'<tr><td colspan="7" class="muted">Chưa có assessment.</td></tr>'}</tbody></table></div>`);
}

function fieldwork(){
  let a=assessment(selectedAssessment)||state.assessments[0];
  if(!a)return shell('Kiểm tra hiện trường','<div class="card muted">Chưa có assessment. Hãy tạo chương trình đánh giá trước.</div>');
  selectedAssessment=a.id;
  const rows=assessmentRAs(a.id);
  if(!rows.some(r=>r.id===selectedRA))selectedRA=rows[0]?.id||null;
  const ra=raById(selectedRA),q=ra?requirement(ra.requirementId):null;
  const locked=a.locked;
  const links=ra?state.evidenceLinks.filter(l=>l.targetType==='RequirementAssessment'&&l.targetId===ra.id):[];
  const proposals=ra?state.aiProposals.filter(p=>p.requirementAssessmentId===ra.id).slice().reverse():[];
  const left=rows.map(r=>{const rq=requirement(r.requirementId);return `<div class="req ${r.id===selectedRA?'on':''} ${locked?'locked':''}" data-ra="${r.id}"><div class="row"><div><b>${esc(r.snapshot?.code||rq?.code)} · ${esc(r.snapshot?.title||rq?.title)}</b><div class="tiny muted">${esc(r.snapshot?.expectedEvidence||rq?.expectedEvidence||'')}</div></div><span class="right">${statusTag(r.complianceResult)} ${statusTag(r.workflowStatus)}</span></div></div>`}).join('');
  let right='<div class="card muted">Chưa có requirement trong assessment.</div>';
  if(ra&&q){
    const canEdit=roleCan('fieldwork')&&!locked;
    right=`<div class="card"><div class="row"><div><h2>${esc(ra.snapshot?.code||q.code)} · ${esc(ra.snapshot?.title||q.title)}</h2><span class="small muted">Source clause: ${esc(ra.snapshot?.sourceClause||q.sourceClause||'—')}</span></div><span class="right">${locked?'<span class="tag gray">LOCKED</span>':''}</span></div>
      <div class="callout"><b>Thủ tục kiểm tra</b><div>${esc(ra.snapshot?.testProcedure||q.testProcedure||'Chưa xác định')}</div><div class="small muted" style="margin-top:6px"><b>Bằng chứng kỳ vọng:</b> ${esc(ra.snapshot?.expectedEvidence||q.expectedEvidence||'Chưa xác định')}</div></div>
      ${canEdit?'<div class="drop" data-act="uploadEvidence" style="margin-top:12px"><b>+ Chụp / Upload bằng chứng</b><div class="small muted">App tính SHA-256 và lưu metadata; file binary chưa được lưu server ở giai đoạn browser persistence.</div></div>':''}
      <div class="field"><label>Ghi nhận người kiểm tra</label><textarea id="observation" ${canEdit?'':'disabled'} placeholder="Ghi dữ kiện quan sát được; tránh trộn với kết luận.">${esc(ra.observation||'')}</textarea></div>
      ${canEdit?'<div class="row"><button class="btn alt" data-act="saveObservation">Lưu ghi nhận</button><button class="btn alt" data-act="analyze">Phân tích / đề xuất</button></div>':''}
      <h3>Bằng chứng</h3>${links.length?links.map(l=>{const rv=state.evidenceRevisions.find(x=>x.id===l.evidenceRevisionId),ev=rv&&state.evidence.find(x=>x.id===rv.evidenceId);return `<div class="small" style="padding:8px 0;border-bottom:1px solid var(--line)"><div class="row"><b>${esc(ev?.name)}</b><span class="tag gray">v${esc(rv?.version)}</span><span class="right muted">${formatBytes(rv?.size||0)}</span></div><div class="tiny muted">SHA-256: ${esc(rv?.sha256||'—')}</div></div>`}).join(''):'<div class="small muted">Chưa có bằng chứng.</div>'}
      <h3>AI / Rule proposal</h3>${proposals.length?proposals.map(p=>`<div class="ai"><div class="row"><b>${esc(lab(p.proposedResult))}</b><span class="right">${statusTag(p.status)}</span></div><p class="small">${esc(p.rationale)}</p><div class="tiny muted">Proposal chỉ hỗ trợ reviewer; không có hiệu lực nếu chưa được con người chấp nhận/xác nhận.</div>${p.status==='proposed'&&canEdit?`<div class="row" style="margin-top:8px"><button class="btn" data-proposalaccept="${p.id}">Chấp nhận proposal</button><button class="btn alt" data-proposalreject="${p.id}">Bác bỏ</button></div>`:''}</div>`).join(''):'<div class="small muted">Chưa có proposal.</div>'}
      ${canEdit?`<div class="row" style="margin-top:14px"><button class="btn red" data-act="createFinding">Xác nhận Finding</button><button class="btn" data-result="compliant">Tuân thủ</button><button class="btn alt" data-result="partially_compliant">Tuân thủ một phần</button><button class="btn alt" data-result="not_applicable">Không áp dụng</button><button class="btn alt" data-result="insufficient_evidence">Chưa đủ bằng chứng</button></div>`:''}
    </div>`;
  }
  return shell('Kiểm tra hiện trường',`<div class="row" style="margin-bottom:12px"><select id="assessmentSelect">${state.assessments.map(x=>`<option value="${x.id}" ${x.id===a.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>${statusTag(a.status)} ${a.locked?'<span class="tag gray">LOCKED</span>':''}</div><div class="split"><div class="stack">${left||'<div class="card muted">Không có requirement.</div>'}</div>${right}</div>`);
}

function findings(){
  const cards=state.findings.map(f=>{
    const ra=raById(f.requirementAssessmentId),q=ra&&requirement(ra.requirementId),a=ra&&assessment(ra.assessmentId);
    const responses=state.unitResponses.filter(r=>r.findingId===f.id);
    const actions=state.remediationActions.filter(x=>x.findingId===f.id);
    return `<div class="card finding" style="margin-bottom:12px"><div class="row"><div><b>${esc(f.title)}</b><div class="small muted">${esc(q?.code||'—')} · ${esc(a?.name||'—')}</div></div><span class="right">${statusTag(f.status)} <span class="tag red">${esc(f.severity||'—')}</span></span></div>
      <div class="split" style="margin-top:10px"><div><b class="small">Dữ kiện</b><div>${esc(f.fact)}</div></div><div><b class="small">Tiêu chí</b><div>${esc(f.criteria)}</div></div><div><b class="small">Khoảng cách</b><div>${esc(f.gap)}</div></div><div><b class="small">Rủi ro/Tác động</b><div>${esc(f.riskImpact||'—')}</div></div></div>
      <div class="callout" style="margin-top:10px"><b>Khuyến nghị / Yêu cầu</b><div>${esc(f.recommendation||'—')}</div></div>
      <div class="small" style="margin-top:10px"><b>Phản hồi đơn vị:</b> ${responses.length?responses.map(r=>`${esc(r.responseType)} — ${esc(r.responseText)}`).join(' | '):'Chưa có'}</div>
      <div class="small"><b>Hành động:</b> ${actions.length?actions.length:'Chưa giao'}</div>
      <div class="row" style="margin-top:10px">${roleCan('unit_response')?`<button class="btn alt" data-unitresponse="${f.id}">Phản hồi đơn vị</button>`:''}${roleCan('assign_action')?`<button class="btn" data-actionfor="${f.id}">+ Giao hành động</button>`:''}</div>
    </div>`;
  }).join('');
  return shell('Phát hiện tuân thủ',cards||'<div class="card muted">Chưa có finding chính thức.</div>');
}

function actions(){
  const rows=state.remediationActions.map(a=>{
    const f=state.findings.find(x=>x.id===a.findingId),over=a.status!=='closed'&&a.dueDate&&new Date(a.dueDate)<new Date();
    return `<tr><td><b>${esc(a.actionText)}</b><div class="tiny muted">Finding: ${esc(f?.title||'—')}</div></td><td>${esc(a.owner||'—')}</td><td>${esc(a.dueDate||'—')}</td><td>${over?statusTag('overdue'):statusTag(a.status)}</td><td><div class="row">${roleCan('update_action')&&a.status!=='closed'?`<button class="btn alt" data-actionupdate="${a.id}">Cập nhật</button>`:''}${roleCan('verify_action')&&a.status!=='closed'?`<button class="btn" data-verify="${a.id}">Xác minh</button>`:''}</div></td></tr>`;
  }).join('');
  return shell('Theo dõi khắc phục',`<div class="table"><table><thead><tr><th>Hành động</th><th>Owner</th><th>Hạn</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="muted">Chưa có hành động khắc phục.</td></tr>'}</tbody></table></div>`);
}

function exceptions(){
  const rows=state.exceptions.map(e=>{const expired=e.expiryDate&&e.expiryDate<today();return `<tr><td>${esc(requirement(e.requirementId)?.code||'—')}<div class="tiny muted">${esc(requirement(e.requirementId)?.title||'')}</div></td><td>${esc(orgName(e.orgUnitId))}</td><td>${esc(e.justification)}</td><td>${esc(e.compensatingControl||'—')}</td><td>${esc(e.approver||'—')}</td><td>${esc(e.expiryDate||'—')}</td><td>${statusTag(expired?'expired':e.status)}</td></tr>`}).join('');
  return shell('Ngoại lệ / Waiver',`<div class="sectionTitle"><div><h2>Compliance Exception</h2><span class="small muted">Ngoại lệ phải có requirement, lý do, kiểm soát bù trừ, approver và ngày hết hạn.</span></div>${roleCan('manage_exception')?'<button class="btn" data-act="newException">+ Ngoại lệ</button>':''}</div><div class="table"><table><thead><tr><th>Requirement</th><th>Đơn vị</th><th>Lý do</th><th>Kiểm soát bù trừ</th><th>Approver</th><th>Hết hạn</th><th>Trạng thái</th></tr></thead><tbody>${rows||'<tr><td colspan="7" class="muted">Chưa có ngoại lệ.</td></tr>'}</tbody></table></div>`);
}

function reports(){
  const m=metrics(state);
  const vals=['not_assessed','compliant','partially_compliant','non_compliant','not_applicable','insufficient_evidence'].map(k=>({k,n:state.requirementAssessments.filter(x=>x.complianceResult===k).length}));
  const mx=Math.max(1,...vals.map(x=>x.n));
  const repeats=repeatFindingGroups(state);
  return shell('Báo cáo & giám sát',`<div class="triple"><div class="card"><h2>Coverage</h2><div style="font-size:42px;font-weight:900">${m.coverage}%</div><div class="bar"><i style="width:${m.coverage}%"></i></div><p class="small muted">Coverage chỉ phản ánh mức đã hoàn tất đánh giá.</p></div><div class="card"><h2>Phân bố kết quả</h2>${vals.map(x=>`<div class="row small" style="margin:9px 0"><span style="width:145px">${esc(lab(x.k))}</span><div class="bar" style="flex:1"><i style="width:${x.n/mx*100}%"></i></div><b>${x.n}</b></div>`).join('')}</div><div class="card"><h2>Finding lặp lại</h2>${repeats.length?repeats.map(g=>`<div class="small" style="margin:8px 0"><b>${esc(requirement(g.requirementId)?.code||g.requirementId)}</b> · ${g.count} finding</div>`).join(''):'<div class="muted small">Chưa phát hiện finding lặp lại theo requirement.</div>'}</div></div><div class="card" style="margin-top:14px"><h2>Decision log</h2>${state.decisionLogs.length?state.decisionLogs.slice().reverse().map(x=>`<div class="small" style="padding:8px 0;border-bottom:1px solid var(--line)"><b>${esc(x.decisionType)}</b> · ${esc(x.objectType)}<div class="muted">${new Date(x.decidedAt).toLocaleString('vi-VN')} · ${esc(x.reason||'')}</div></div>`).join(''):'<div class="muted">Chưa có log.</div>'}</div>`);
}

function render(){
  const fn={dashboard,frameworks,assessments,fieldwork,findings,actions,exceptions,reports}[view]||dashboard;
  root.innerHTML=fn();
  bind();
}

function modal(html){
  document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modalBg"><div class="modal">${html}<div class="row" style="margin-top:14px"><button class="btn alt right" data-act="closeModal">Đóng</button></div></div></div>`);
  bind();
}
const closeModal=()=>document.getElementById('modalBg')?.remove();

function formatBytes(n){if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`;}

function qa(){
  const q=validateState(state);
  const backendText=backend.databaseConfigured?`Database configured (${esc(backend.persistence||'server')})`:'Database chưa cấu hình; đang dùng browser persistence.';
  modal(`<h2>QA Check</h2><div class="${q.pass?'pass':'fail'}">${q.pass?'PASS':'FAIL'} · ${q.errors.length} lỗi · ${q.warnings.length} cảnh báo</div><p class="small">${backendText}</p>${q.errors.length?`<h3>Lỗi</h3><ul>${q.errors.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${q.warnings.length?`<h3>Cảnh báo</h3><ul>${q.warnings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${q.pass&&!q.warnings.length?'<div class="callout">Không phát hiện lỗi toàn vẹn dữ liệu lõi trong bộ kiểm tra hiện tại.</div>':''}`);
}

function newSource(){
  modal(`<h2>Tạo nguồn tuân thủ</h2><form id="sourceForm"><div class="field"><label>Loại nguồn</label><select name="sourceType"><option value="law">Pháp luật</option><option value="internal_policy">VBLQ nội bộ</option><option value="process">Quy trình/SOP</option><option value="contract">Hợp đồng/Cam kết</option><option value="standard">Tiêu chuẩn</option><option value="other">Khác</option></select></div><div class="field"><label>Mã</label><input name="code" required></div><div class="field"><label>Tên nguồn</label><input name="title" required></div><div class="split"><div class="field"><label>Phiên bản</label><input name="version"></div><div class="field"><label>Ngày hiệu lực</label><input type="date" name="effectiveFrom"></div></div><div class="field"><label>Owner</label><input name="owner"></div><button class="btn">Lưu nguồn</button></form>`);
  document.getElementById('sourceForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const o={id:generateId('src'),...d,status:'draft'};state.complianceSources.push(o);appendDecision(state,{objectType:'ComplianceSource',objectId:o.id,decisionType:'create',reason:o.title,actor:currentRole});persist();closeModal();render();};
}

function newFramework(){
  if(!state.complianceSources.length){modal('<h2>Chưa có nguồn tuân thủ</h2><p>Hãy tạo ít nhất một nguồn trước khi tạo framework/requirement.</p>');return;}
  modal(`<h2>Tạo khung tuân thủ</h2><form id="fwForm"><div class="split"><div class="field"><label>Mã khung</label><input name="code" required></div><div class="field"><label>Phiên bản</label><input name="version" value="0.1" required></div></div><div class="field"><label>Tên khung</label><input name="name" required></div><div class="field"><label>Nguồn mặc định</label><select name="sourceId">${state.complianceSources.map(s=>`<option value="${s.id}">${esc(s.code)} · ${esc(s.title)}</option>`).join('')}</select></div><div class="field"><label>Các requirement</label><textarea name="requirements" required placeholder="Mỗi dòng một requirement. Có thể nhập: Mã | Nội dung | Điều khoản nguồn"></textarea><div class="tiny muted">Ví dụ định dạng: REQ-001 | Nội dung phải tuân thủ | Điều 3. Không bắt buộc phải có mã/điều khoản.</div></div><button class="btn">Tạo framework</button></form>`);
  document.getElementById('fwForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),fw={id:generateId('fw'),code:d.code,name:d.name,version:d.version,status:'draft',owner:currentRole,effectiveFrom:null};state.frameworks.push(fw);let sort=1;for(const line of d.requirements.split('\n').map(x=>x.trim()).filter(Boolean)){const p=line.split('|').map(x=>x.trim()),code=p.length>1&&p[0]?p[0]:`${d.code}-${String(sort).padStart(2,'0')}`,title=p.length>1?p[1]:p[0],clause=p.length>2?p[2]:'';const r={id:generateId('req'),code,title,description:'',sourceId:d.sourceId,sourceClause:clause,parentId:null,assessable:true,mandatoryLevel:'mandatory',testProcedure:'Cần xác định',expectedEvidence:'Cần xác định',status:'draft'};state.requirements.push(r);state.frameworkRequirements.push({id:generateId('fr'),frameworkId:fw.id,requirementId:r.id,sortOrder:sort++,applicabilityRule:null});}appendDecision(state,{objectType:'ComplianceFramework',objectId:fw.id,decisionType:'create',reason:fw.name,actor:currentRole});persist();closeModal();render();};
}

function newAssessment(){
  if(!state.frameworks.length){modal('<h2>Chưa có framework</h2><p>Hãy tạo khung tuân thủ trước khi tạo chương trình đánh giá.</p>');return;}
  modal(`<h2>Tạo chương trình đánh giá</h2><form id="asForm"><div class="field"><label>Tên chương trình / assessment</label><input name="name" required></div><div class="field"><label>Khung tuân thủ</label><select name="frameworkId">${state.frameworks.map(f=>`<option value="${f.id}">${esc(f.code)} · ${esc(f.name)}</option>`).join('')}</select></div><div class="field"><label>Đơn vị/phạm vi tổ chức</label><select name="orgUnitId">${state.orgUnits.map(o=>`<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></div><div class="field"><label>Mục tiêu</label><textarea name="objective"></textarea></div><div class="field"><label>Giới hạn phạm vi requirement (nếu có)</label><textarea name="scopeNote" placeholder="Để trống = toàn bộ requirement assessable của framework"></textarea></div><div class="split"><div class="field"><label>Từ ngày</label><input type="date" name="periodFrom"></div><div class="field"><label>Đến ngày</label><input type="date" name="periodTo"></div></div><button class="btn">Tạo chương trình</button></form>`);
  document.getElementById('asForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),program={id:generateId('prog'),code:`PROGRAM-${new Date().getFullYear()}-${String(state.assessmentPrograms.length+1).padStart(3,'0')}`,name:d.name,period:[d.periodFrom,d.periodTo].filter(Boolean).join(' → '),objective:d.objective,ownerActorId:null,status:'draft'},a={id:generateId('as'),programId:program.id,frameworkId:d.frameworkId,name:d.name,objective:d.objective,periodFrom:d.periodFrom||null,periodTo:d.periodTo||null,status:'draft',locked:false,lockedAt:null,createdAt:nowIso()},scope={id:generateId('scope'),assessmentId:a.id,orgUnitId:d.orgUnitId,processRef:null,locationRef:null,activityRef:null,scopeNote:d.scopeNote,includeAllRequirements:!d.scopeNote.trim()};state.assessmentPrograms.push(program);createAssessmentFromFramework(state,a,scope);persist();selectedAssessment=a.id;selectedRA=null;closeModal();view='assessments';render();};
}

async function uploadEvidence(){
  const a=assessment(selectedAssessment);if(!a||a.locked||!roleCan('fieldwork'))return;
  fileInput.value='';
  fileInput.onchange=async()=>{
    for(const file of [...fileInput.files]){
      const hash=await sha256(file),ev={id:generateId('ev'),name:file.name,evidenceType:file.type||'file',ownerActorId:null,sourceSystem:'manual_upload',confidentiality:'internal',validFrom:null,validTo:null,status:'active'},rev={id:generateId('rev'),evidenceId:ev.id,version:1,fileUri:null,originalFilename:file.name,mimeType:file.type||'application/octet-stream',size:file.size,sha256:hash,capturedAt:nowIso(),uploadedBy:currentRole,observation:'Metadata only; binary file chưa lưu server.'},link={id:generateId('el'),evidenceRevisionId:rev.id,targetType:'RequirementAssessment',targetId:selectedRA,purpose:'assessment_evidence',linkedBy:currentRole,linkedAt:nowIso()};state.evidence.push(ev);state.evidenceRevisions.push(rev);state.evidenceLinks.push(link);appendDecision(state,{objectType:'EvidenceRevision',objectId:rev.id,decisionType:'link',reason:`${file.name} → RequirementAssessment ${selectedRA}`,actor:currentRole});
    }
    persist();render();
  };
  fileInput.click();
}

function saveObservation(){const ra=raById(selectedRA),el=document.getElementById('observation');if(!ra||!el||isLocked(ra.assessmentId))return;ra.observation=el.value.trim();if(ra.workflowStatus==='to_do')ra.workflowStatus='in_progress';appendDecision(state,{objectType:'RequirementAssessment',objectId:ra.id,decisionType:'observation_update',reason:'Cập nhật ghi nhận fieldwork',actor:currentRole});persist();render();}

function analyze(){
  const ra=raById(selectedRA),q=ra&&requirement(ra.requirementId);if(!ra||!q||isLocked(ra.assessmentId))return;
  const observation=(document.getElementById('observation')?.value||ra.observation||'').trim();ra.observation=observation;
  const text=observation.toLowerCase(),neg=['không','thiếu','chưa','sai','quá hạn','vượt thẩm quyền','không có','không đủ'].some(k=>text.includes(k));
  const evidenceCount=state.evidenceLinks.filter(l=>l.targetType==='RequirementAssessment'&&l.targetId===ra.id).length;
  const p={id:generateId('ai'),evidenceRevisionId:null,assessmentId:ra.assessmentId,requirementAssessmentId:ra.id,proposedRequirementId:q.id,proposedResult:neg?'non_compliant':'insufficient_evidence',proposedFinding:neg?`Có dấu hiệu không phù hợp với ${q.code}`:null,confidence:null,rationale:neg?`Ghi nhận chứa dấu hiệu cần kiểm tra thêm; đã có ${evidenceCount} evidence link. Đây là screening theo rule, chưa phải kết luận AI/LLM.`:`Chưa có dấu hiệu đủ mạnh để kết luận. Cần bổ sung/đối chiếu bằng chứng. Đây là screening theo rule.`,status:'proposed',reviewedBy:null,reviewedAt:null};
  state.aiProposals.push(p);appendDecision(state,{objectType:'AIAnalysisProposal',objectId:p.id,decisionType:'propose',reason:p.rationale,actor:'Rule engine'});persist();render();
}

function proposalDecision(idValue,accept){const p=state.aiProposals.find(x=>x.id===idValue);if(!p)return;p.status=accept?'accepted':'rejected';p.reviewedBy=currentRole;p.reviewedAt=nowIso();if(accept){const ra=raById(p.requirementAssessmentId);ra.complianceResult=p.proposedResult;ra.workflowStatus='in_review';}appendDecision(state,{objectType:'AIAnalysisProposal',objectId:p.id,decisionType:accept?'accept':'reject',reason:'Human review',actor:currentRole});persist();render();}

function setResult(result){const ra=raById(selectedRA);if(!ra||isLocked(ra.assessmentId))return;const prev=ra.complianceResult;ra.complianceResult=result;ra.workflowStatus='done';ra.assessedBy=currentRole;ra.assessedAt=nowIso();appendDecision(state,{objectType:'RequirementAssessment',objectId:ra.id,decisionType:'result_change',fromState:prev,toState:result,reason:'Kết quả do người đánh giá xác nhận',actor:currentRole});persist();render();}

function createFinding(){
  const ra=raById(selectedRA),q=ra&&requirement(ra.requirementId);if(!ra||!q||isLocked(ra.assessmentId))return;
  const evidenceCount=state.evidenceLinks.filter(l=>l.targetType==='RequirementAssessment'&&l.targetId===ra.id).length;
  modal(`<h2>Xác nhận Finding</h2><div class="note">Finding chính thức do con người xác nhận. Hiện có ${evidenceCount} evidence link; nếu không có file, phải mô tả rõ dữ kiện quan sát/phỏng vấn.</div><form id="findingForm"><div class="field"><label>Tiêu đề</label><input name="title" value="Không tuân thủ ${esc(q.code)}" required></div><div class="field"><label>Dữ kiện (Fact)</label><textarea name="fact" required>${esc(ra.observation||'')}</textarea></div><div class="field"><label>Tiêu chí (Criteria)</label><textarea name="criteria" required>${esc(q.title)}${q.sourceClause?` — ${esc(q.sourceClause)}`:''}</textarea></div><div class="field"><label>Khoảng cách/Vi phạm (Gap)</label><textarea name="gap" required></textarea></div><div class="field"><label>Nguyên nhân gốc (nếu đã xác định)</label><textarea name="rootCause"></textarea></div><div class="field"><label>Rủi ro/Tác động</label><textarea name="riskImpact"></textarea></div><div class="field"><label>Yêu cầu/Khuyến nghị</label><textarea name="recommendation"></textarea></div><div class="split"><div class="field"><label>Mức độ</label><select name="severity"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div><div class="field"><label>Ưu tiên xử lý</label><select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div></div><button class="btn red">Xác nhận Finding</button></form>`);
  document.getElementById('findingForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(!d.fact.trim()){alert('Finding phải có dữ kiện.');return;}const f={id:generateId('finding'),requirementAssessmentId:ra.id,...d,status:'confirmed',confirmedBy:currentRole,confirmedAt:nowIso()};state.findings.push(f);ra.complianceResult='non_compliant';ra.workflowStatus='done';ra.assessedBy=currentRole;ra.assessedAt=nowIso();appendDecision(state,{objectType:'Finding',objectId:f.id,decisionType:'confirm',reason:f.title,actor:currentRole});persist();closeModal();view='findings';render();};
}

function unitResponse(findingId){modal(`<h2>Phản hồi đơn vị</h2><form id="responseForm"><div class="field"><label>Loại phản hồi</label><select name="responseType"><option>Đồng ý</option><option>Không đồng ý</option><option>Bổ sung bằng chứng</option><option>Đề xuất điều chỉnh</option></select></div><div class="field"><label>Nội dung phản hồi</label><textarea name="responseText" required></textarea></div><button class="btn">Gửi phản hồi</button></form>`);document.getElementById('responseForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),r={id:generateId('resp'),findingId,actorId:null,...d,submittedAt:nowIso(),assessorDisposition:null,dispositionNote:null};state.unitResponses.push(r);appendDecision(state,{objectType:'UnitResponse',objectId:r.id,decisionType:'submit',reason:d.responseType,actor:currentRole});persist();closeModal();render();};}

function assignAction(findingId){modal(`<h2>Giao hành động khắc phục</h2><form id="actionForm"><div class="field"><label>Loại hành động</label><select name="actionType"><option value="corrective">Khắc phục</option><option value="preventive">Phòng ngừa</option><option value="improvement">Cải tiến</option></select></div><div class="field"><label>Hành động</label><textarea name="actionText" required></textarea></div><div class="field"><label>Owner</label><input name="owner" required></div><div class="field"><label>Hạn hoàn thành</label><input type="date" name="dueDate" required></div><button class="btn">Giao hành động</button></form>`);document.getElementById('actionForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),a={id:generateId('action'),findingId,...d,status:'open',progress:0,escalationLevel:0,createdAt:nowIso()};state.remediationActions.push(a);const f=state.findings.find(x=>x.id===findingId);if(f&&f.status==='confirmed')f.status='assigned';appendDecision(state,{objectType:'RemediationAction',objectId:a.id,decisionType:'assign',reason:a.actionText,actor:currentRole});persist();closeModal();view='actions';render();};}

function updateAction(actionId){const a=state.remediationActions.find(x=>x.id===actionId);if(!a)return;modal(`<h2>Cập nhật hành động</h2><form id="updateActionForm"><div class="field"><label>Tiến độ %</label><input type="number" min="0" max="100" name="progress" value="${a.progress||0}"></div><div class="field"><label>Trạng thái</label><select name="status"><option value="open" ${a.status==='open'?'selected':''}>Mở</option><option value="in_progress" ${a.status==='in_progress'?'selected':''}>Đang thực hiện</option><option value="pending_verification" ${a.status==='pending_verification'?'selected':''}>Chờ xác minh</option></select></div><button class="btn">Cập nhật</button></form>`);document.getElementById('updateActionForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),prev=a.status;a.progress=Number(d.progress);a.status=d.status;appendDecision(state,{objectType:'RemediationAction',objectId:a.id,decisionType:'status_change',fromState:prev,toState:a.status,reason:`Progress ${a.progress}%`,actor:currentRole});persist();closeModal();render();};}

function verifyAction(actionId){const a=state.remediationActions.find(x=>x.id===actionId);if(!a)return;modal(`<h2>Xác minh hành động</h2><form id="verifyForm"><div class="field"><label>Kết quả</label><select name="result"><option value="effective">Đạt/hiệu lực</option><option value="ineffective">Chưa đạt</option></select></div><div class="field"><label>Ghi chú xác minh</label><textarea name="note" required></textarea></div><button class="btn">Ghi nhận xác minh</button></form>`);document.getElementById('verifyForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),v={id:generateId('verify'),actionId,verifierActorId:null,verifier:currentRole,verificationDate:today(),result:d.result,note:d.note,nextReviewDate:null};state.verifications.push(v);const prev=a.status;a.status=d.result==='effective'?'closed':'reopened';a.progress=d.result==='effective'?100:a.progress;const f=state.findings.find(x=>x.id===a.findingId),actionsForFinding=state.remediationActions.filter(x=>x.findingId===a.findingId);if(f&&actionsForFinding.length&&actionsForFinding.every(x=>x.status==='closed'))f.status='closed';appendDecision(state,{objectType:'Verification',objectId:v.id,decisionType:'verify',fromState:prev,toState:a.status,reason:d.note,actor:currentRole});persist();closeModal();render();};}

function newException(){
  if(!state.requirements.length){modal('<h2>Chưa có requirement</h2><p>Không thể tạo ngoại lệ nếu chưa có requirement cụ thể.</p>');return;}
  modal(`<h2>Tạo Compliance Exception</h2><form id="exceptionForm"><div class="field"><label>Requirement</label><select name="requirementId">${state.requirements.map(r=>`<option value="${r.id}">${esc(r.code)} · ${esc(r.title)}</option>`).join('')}</select></div><div class="field"><label>Đơn vị</label><select name="orgUnitId">${state.orgUnits.map(o=>`<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></div><div class="field"><label>Lý do ngoại lệ</label><textarea name="justification" required></textarea></div><div class="field"><label>Kiểm soát bù trừ</label><textarea name="compensatingControl" required></textarea></div><div class="field"><label>Approver</label><input name="approver" required></div><div class="field"><label>Ngày hết hạn</label><input type="date" name="expiryDate" required></div><button class="btn">Lưu ngoại lệ</button></form>`);document.getElementById('exceptionForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),x={id:generateId('exception'),assessmentId:null,...d,approvedAt:nowIso(),status:'active'};state.exceptions.push(x);appendDecision(state,{objectType:'ComplianceException',objectId:x.id,decisionType:'approve',reason:x.justification,actor:x.approver});persist();closeModal();render();};
}

function transition(idValue,next){const a=assessment(idValue);if(!a)return;let reason='';if(next==='reopened'){reason=prompt('Lý do mở lại assessment:')||'';if(!reason)return;}try{transitionAssessment(state,idValue,next,currentRole,reason||`Chuyển trạng thái sang ${lab(next)}`);persist();render();}catch(e){alert(e.message);}}

function bind(){
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{view=b.dataset.nav;render();});
  const role=document.getElementById('roleSel');if(role)role.onchange=()=>{currentRole=role.value;sessionStorage.setItem('agris_compliance_role',currentRole);render();};
  document.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{
    const a=b.dataset.act;
    if(a==='qa')qa(); if(a==='export')exportState(state); if(a==='import'){if(!roleCan('import')&&currentRole!=='Admin'){alert('Chỉ Admin được import/restore dữ liệu.');return;}importInput.click();}
    if(a==='closeModal')closeModal(); if(a==='loadDemo'){if(confirm('Nạp dữ liệu DEMO? Dữ liệu hiện tại sẽ được thay bằng bộ minh họa.')){state=loadDemo(state);persist();selectedAssessment=state.assessments[0]?.id;selectedRA=state.requirementAssessments[0]?.id;render();}}
    if(a==='newSource')newSource(); if(a==='newFramework')newFramework(); if(a==='newAssessment')newAssessment(); if(a==='uploadEvidence')uploadEvidence(); if(a==='saveObservation')saveObservation(); if(a==='analyze')analyze(); if(a==='createFinding')createFinding();
  });
  document.querySelectorAll('[data-openassessment]').forEach(b=>b.onclick=()=>{selectedAssessment=b.dataset.openassessment;selectedRA=null;view='fieldwork';render();});
  document.querySelectorAll('[data-ra]').forEach(b=>b.onclick=()=>{selectedRA=b.dataset.ra;render();});
  document.querySelectorAll('[data-proposalaccept]').forEach(b=>b.onclick=()=>proposalDecision(b.dataset.proposalaccept,true));
  document.querySelectorAll('[data-proposalreject]').forEach(b=>b.onclick=()=>proposalDecision(b.dataset.proposalreject,false));
  document.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>setResult(b.dataset.result));
  document.querySelectorAll('[data-unitresponse]').forEach(b=>b.onclick=()=>unitResponse(b.dataset.unitresponse));
  document.querySelectorAll('[data-actionfor]').forEach(b=>b.onclick=()=>assignAction(b.dataset.actionfor));
  document.querySelectorAll('[data-actionupdate]').forEach(b=>b.onclick=()=>updateAction(b.dataset.actionupdate));
  document.querySelectorAll('[data-verify]').forEach(b=>b.onclick=()=>verifyAction(b.dataset.verify));
  document.querySelectorAll('[data-transition]').forEach(b=>b.onclick=()=>{if(b.disabled)return;const [idValue,next]=b.dataset.transition.split('|');transition(idValue,next);});
  const sel=document.getElementById('assessmentSelect');if(sel)sel.onchange=()=>{selectedAssessment=sel.value;selectedRA=null;render();};
}

importInput.onchange=async()=>{const f=importInput.files?.[0];if(!f)return;try{const imported=await importState(f);const q=validateState(imported);if(q.errors.length){alert(`Không import: dữ liệu có ${q.errors.length} lỗi toàn vẹn.`);return;}state=imported;appendDecision(state,{objectType:'System',objectId:'import',decisionType:'restore',reason:`Restore từ ${f.name}`,actor:currentRole});persist();selectedAssessment=state.assessments[0]?.id||null;selectedRA=state.requirementAssessments[0]?.id||null;render();}catch(e){alert('Import thất bại: '+e.message);}finally{importInput.value='';}};

render();
