)}`).join(' | '):'Chưa có'}</div>
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
  return shell('Báo cáo & giám sát',`<div class="triple"><div class="card"><h2>Coverage</h2><div style="font-size:42px;font-weight:900">${m.coverage}%</div><div class="bar"><i style="width:${m.coverage}%"></i></div><p class="small muted">Coverage chỉ phản ánh mức đã hoàn tất đánh giá.</p></div><div class="card"><h2>Phân bố kết quả</h2>${vals.map(x=>`<div class="row small" style="margin:9px 0"><span style="width:145px">${esc(lab(x.k))}</span><div class="bar" style="flex:1"><i style="width:${x.n/mx*100}%"></i></div><b>${x.n}</b></div>`).join('')}</div><div class="card"><h2>Finding lặp lại</h2>${repeats.length?repeats.ma