n.">${esc(ra.observation||'')}</textarea></div>
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
      <div class="small" style="margin-top:10px"><b>Phản hồi đơn vị:</b> ${responses.length?responses.map(r=>`${esc(r.responseType)} — ${esc(r.responseText