ới hạn requirement, hệ thống mặc định toàn bộ requirement assessable thuộc phạm vi.</span></div>${roleCan('create_assessment')?'<button class="btn" data-act="newAssessment">+ Tạo chương trình</button>':''}</div>
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
      <div class="field"><label>Ghi nhận người kiểm tra</label><textarea id="observation" ${canEdit?'':'disabled'} placeholder="Ghi dữ kiện quan sát được; tránh trộn với kết luậ