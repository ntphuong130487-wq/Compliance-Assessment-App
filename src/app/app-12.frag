s;const f=state.findings.find(x=>x.id===a.findingId),actionsForFinding=state.remediationActions.filter(x=>x.findingId===a.findingId);if(f&&actionsForFinding.length&&actionsForFinding.every(x=>x.status==='closed'))f.status='closed';appendDecision(state,{objectType:'Verification',objectId:v.id,decisionType:'verify',fromState:prev,toState:a.status,reason:d.note,actor:currentRole});persist();closeModal();render();};}

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
    if(a==='syncNow')syncNow(state).then(r=>{if(!r.ok&&!r.conflict)alert('Đồng bộ chưa thành công; dữ liệu cục bộ vẫn được giữ.');});
    if(a==='pullCloud'){if(confirm('Nạp phiên bản Cloud? Các thay đổi cục bộ chưa đồng bộ sẽ bị thay thế.'))pullCloudState();}
    if(a==='forceCloud'){if(currentRole!=='Admin'){alert('Chỉ Admin được ghi đè Cloud.');return;}if(confirm('Ghi đè dữ liệu Cloud bằng bản đang có trên trình duyệt? Hành động này chỉ nên dùng sau khi đã đối chiếu xung đột.'))forcePushCloud(state);}
    if(a==='closeModal')closeModal(); if(a==='loadDemo'){if(confirm('Nạp dữ liệu DEMO? Dữ liệu hiện tại sẽ được thay bằng bộ minh họa.')){state=loadDemo(state);persist();selectedAssessment=state.assessments[0]?.id;selectedRA=state.requirementAssessments[0]?.id;render();}}
    if(a==='newSource')newSource(); if(a==='newFramework')newFramework(); if(a==='newAssessment')newAssessment(); if(a==='uploadEvidence')uploadEvidence(); if(a==='saveObservation')saveObservation(); if(a==='analyze')analyze(); if(a==='createFinding')createFinding();
  });
  document.querySelectorAll('[data-openassessment]').forEach(b=>b.onclick=()=>{selectedAssessment=b.dataset.openassessment;selectedRA=null;view='fieldwork';render();});
  document.querySelectorAll('[data-ra]').forEach(b=>b.onclick=()=>{selectedRA=b.dataset.ra;render();});
 