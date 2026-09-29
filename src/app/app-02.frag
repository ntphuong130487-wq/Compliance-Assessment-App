function shell(title,body){
  return `<div class="app">
    <aside class="side">
      <div class="brand"><div class="logo">A</div><div><b>AgriS Compliance</b><small>Assessment App · Production Candidate</small></div></div>
      <div class="nav">${navHtml()}</div>
      <div class="sideFoot"><label>Vai trò đang mô phỏng</label><select id="roleSel">${ROLES.map(r=>`<option ${r===currentRole?'selected':''}>${r}</option>`).join('')}</select><div class="tiny" style="margin-top:7px;opacity:.7">RBAC mô phỏng để kiểm thử UX; chưa thay thế SSO.</div></div>
    </aside>
    <main class="main">
      <header class="top"><div><h1>${esc(title)}</h1><div class="tiny muted">Role: ${esc(currentRole)} · ${sync.configured&&sync.mode==='cloud'?'Cloud sync':backend.databaseConfigured?'DB configured · '+sync.mode:'Browser persistence'}</div></div>
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
    <div class="sectionTitle"><div><h2>Nguồn tuân thủ</h2><span class="small muted">Pháp luật, VBLQ, quy trình, SOP, hợp đồng, tiêu chuẩn…</span></div>${roleCan('manage_master')?'<button class="