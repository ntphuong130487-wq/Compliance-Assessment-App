p(g=>`<div class="small" style="margin:8px 0"><b>${esc(requirement(g.requirementId)?.code||g.requirementId)}</b> · ${g.count} finding</div>`).join(''):'<div class="muted small">Chưa phát hiện finding lặp lại theo requirement.</div>'}</div></div><div class="card" style="margin-top:14px"><h2>Decision log</h2>${state.decisionLogs.length?state.decisionLogs.slice().reverse().map(x=>`<div class="small" style="padding:8px 0;border-bottom:1px solid var(--line)"><b>${esc(x.decisionType)}</b> · ${esc(x.objectType)}<div class="muted">${new Date(x.decidedAt).toLocaleString('vi-VN')} · ${esc(x.reason||'')}</div></div>`).join(''):'<div class="muted">Chưa có log.</div>'}</div>`);
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
  modal(`<h2>Tạo khung tuân thủ</h2><form id="fwForm"><div class="split"><div class="field"><label>Mã khung</label><inp