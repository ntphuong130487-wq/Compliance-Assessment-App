btn" data-act="newSource">+ Nguồn</button>':''}</div>
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
    <div class="sectionTitle"><div><h2>Assessment</h2><span class="small muted">Nếu không mô tả gi