(function(){
  var Screens=window.ComplianceScreens=window.ComplianceScreens||{},U=function(){return Screens.util};
  function sourceRoleLabel(v){return({basis_external:"Căn cứ bên ngoài",basis_internal:"Căn cứ nội bộ",context:"Nguồn bối cảnh",test_data:"Dữ liệu kiểm tra",evidence:"Bằng chứng"})[v]||v||"—"}
  function refs(v){return Array.isArray(v)&&v.length?v.join(", "):"Áp dụng chung/chưa chỉ rõ"}
  Screens.frameworks=function(c){
    var S=c.S,UI=c.UI,esc=c.esc,tag=c.tag,f=c.filters||{},links=S.assessmentSources||[],
        drafts=S.draftRequirements.filter(function(d){return d.reviewStatus!=="published"});

    var filtered=drafts.filter(function(d){
      var src=S.sources.find(function(s){return s.id===d.sourceId});
      if(f.draftSourceFilter&&f.draftSourceFilter!=="all"&&d.sourceId!==f.draftSourceFilter)return false;
      if(f.draftStatusFilter&&f.draftStatusFilter!=="all"&&d.reviewStatus!==f.draftStatusFilter)return false;
      if(f.draftTypeFilter&&f.draftTypeFilter!=="all"&&(d.obligationType||"general")!==f.draftTypeFilter)return false;
      var q=String(f.draftQuery||"").trim().toLowerCase();
      return !q||[d.obligation,d.sourceClause,d.actorText,d.actionText,d.applicability,src&&src.title].filter(Boolean).join(" ").toLowerCase().includes(q)
    });
    var accepted=drafts.filter(function(d){return d.reviewStatus==="accepted"}).length,
        types=Array.from(new Set(drafts.map(function(d){return d.obligationType||"general"}))).sort(),
        basisLinks=links.filter(function(x){return x.sourceRole==="basis_external"||x.sourceRole==="basis_internal"}),
        verifiedBasis=basisLinks.filter(function(x){return x.relevanceStatus==="verified"&&x.effectivenessStatus==="verified"}).length;

    var hero=UI.pageIntro({
      eyebrow:"ASSESSMENT-SCOPED SOURCE & OBLIGATION",
      title:"Nguồn căn cứ & Nghĩa vụ tuân thủ",
      description:"Phạm vi cuộc đánh giá → kế hoạch nguồn → xác nhận hiệu lực/liên quan → AI bóc nghĩa vụ → human review → duyệt → Yêu cầu tuân thủ hiệu lực."
    });

    var metrics=UI.metricGrid([
      {label:"Nguồn gắn cuộc đánh giá",value:links.length,tone:"info"},
      {label:"Nguồn căn cứ đã xác nhận",value:verifiedBasis,tone:"positive"},
      {label:"Nghĩa vụ đang rà soát",value:drafts.length,tone:drafts.length?"warning":"neutral"},
      {label:"Đã chấp nhận",value:accepted,tone:"positive"},
      {label:"Yêu cầu hiệu lực",value:S.requirements.filter(function(r){return r.status==="effective"}).length,tone:"positive"},
      {label:"Cuộc đánh giá",value:S.assessments.length,tone:"neutral"}
    ]);

    var scopeGuide='<div class="card">'+UI.sectionHeader("1. Xác định phạm vi trước","Nguồn không đứng độc lập; mỗi nguồn phải gắn với một cuộc đánh giá/phạm vi.","")+
      '<div class="note"><b>Phân loại nguồn:</b> Căn cứ bên ngoài/nội bộ → được bóc nghĩa vụ sau khi xác nhận liên quan & hiệu lực. Nguồn bối cảnh (ví dụ JD), dữ liệu kiểm tra và bằng chứng → <b>không bóc nghĩa vụ</b>.</div>'+
      '<div class="source-modes"><div class="source-mode '+(f.sourceMode==="file"?"on":"")+'" data-source-mode="file"><b>📎 Upload file</b><span class="small muted">Luật, chính sách, quy trình, dữ liệu hoặc chứng từ.</span></div><div class="source-mode '+(f.sourceMode==="text"?"on":"")+'" data-source-mode="text"><b>✍ Nhập / dán text</b><span class="small muted">Nhập trực tiếp nội dung nguồn.</span></div><div class="source-mode '+(f.sourceMode==="search"?"on":"")+'" data-source-mode="search"><b>⌕ Tìm quy định nhà nước</b><span class="small muted">Chỉ hoạt động khi có provider thật.</span></div></div>'+
      '<div class="row" style="margin-top:12px">'+(f.sourceMode==="file"?'<button class="btn" data-act="sourceFile">Thêm nguồn từ file</button>':f.sourceMode==="text"?'<button class="btn" data-act="sourceText">Thêm nguồn từ text</button>':'<button class="btn" data-act="sourceSearch">Tìm quy định</button>')+'</div></div>';

    var sources='<div class="card" style="margin-top:14px">'+UI.sectionHeader("2. Kế hoạch nguồn theo cuộc đánh giá",links.length+" liên kết nguồn","")+
      '<div class="stack">'+(S.sources.length?S.sources.map(function(s){
        var sl=links.filter(function(x){return x.sourceId===s.id}),n=S.draftRequirements.filter(function(d){return d.sourceId===s.id}).length;
        var meta=[s.sourceCode,s.issuer,s.version?("Phiên bản "+s.version):"",s.effectiveFrom?("Hiệu lực "+s.effectiveFrom):""].filter(Boolean).join(" · ");
        var linkHtml=sl.length?sl.map(function(l){var a=S.assessments.find(function(x){return x.id===l.assessmentId}),verified=l.relevanceStatus==="verified"&&l.effectivenessStatus==="verified";
          return '<div class="mini-stat"><div class="small"><b>'+esc(a&&a.name||"Cuộc đánh giá")+'</b></div><div class="small">'+esc(sourceRoleLabel(l.sourceRole))+' · '+(l.extractionEligible?"Có thể bóc nghĩa vụ":"Không bóc nghĩa vụ")+'</div><div class="small muted">Liên quan: '+esc(l.relevanceStatus)+' · Hiệu lực: '+esc(l.effectivenessStatus)+'</div>'+(!verified&&l.extractionEligible?'<button class="btn alt" style="margin-top:6px" data-source-verify="'+s.id+'" data-assessment-id="'+l.assessmentId+'">Xác nhận nguồn căn cứ</button>':"")+'</div>'
        }).join(""):'<div class="search-warning">Nguồn chưa gắn với cuộc đánh giá.</div>';
        return '<div class="source-card"><div class="row"><div><b>'+esc(s.title)+'</b><div class="small muted">'+esc(s.sourceType||"")+' · '+esc(meta||"Chưa cập nhật metadata")+'</div></div><span class="right tag '+(s.status==="published"||s.status==="effective"?"green":s.status==="error"||s.status==="needs_ocr"?"red":"blue")+'">'+esc(c.sourceStatusLabel(s.status))+'</span></div>'+
          '<div class="source-meta"><div class="mini-stat"><b>'+n+'</b><div class="small muted">Nghĩa vụ dự thảo</div></div><div class="mini-stat"><b>'+S.draftRequirements.filter(function(d){return d.sourceId===s.id&&d.reviewStatus==="accepted"}).length+'</b><div class="small muted">Đã chấp nhận</div></div><div class="mini-stat"><b>'+S.requirements.filter(function(r){return r.sourceId===s.id&&r.status==="effective"}).length+'</b><div class="small muted">Yêu cầu hiệu lực</div></div></div>'+
          '<div class="stack" style="margin-top:9px">'+linkHtml+'</div><div class="row" style="margin-top:9px"><button class="btn alt" data-source-edit="'+s.id+'">Metadata</button>'+((s.status==="needs_ocr"||s.status==="error")?'<button class="btn alt" data-source-text="'+s.id+'">Nhập text thay thế</button>':"")+'</div></div>'
      }).join(""):UI.empty("Chưa có nguồn","Tạo cuộc đánh giá, xác định phạm vi rồi tiếp nhận nguồn."))+'</div></div>';

    var review='<div class="card" style="margin-top:14px">'+UI.sectionHeader("3. Rà soát nghĩa vụ dự thảo","Mỗi bản ghi = một nghĩa vụ độc lập có thể kiểm tra. AI không được tự làm mất điều kiện/ngoại lệ.",'<span class="tag green">'+accepted+' đã chấp nhận</span>')+
      '<div class="row product-toolbar"><select id="draftSourceFilter"><option value="all">Tất cả nguồn</option>'+S.sources.map(function(s){return'<option value="'+s.id+'" '+(f.draftSourceFilter===s.id?"selected":"")+'>'+esc(s.title)+'</option>'}).join("")+'</select><select id="draftStatusFilter"><option value="all">Tất cả trạng thái</option><option value="draft" '+(f.draftStatusFilter==="draft"?"selected":"")+'>Nháp</option><option value="accepted" '+(f.draftStatusFilter==="accepted"?"selected":"")+'>Đã chấp nhận</option><option value="rejected" '+(f.draftStatusFilter==="rejected"?"selected":"")+'>Đã loại</option></select><select id="draftTypeFilter"><option value="all">Tất cả loại</option>'+types.map(function(t){return'<option value="'+esc(t)+'" '+(f.draftTypeFilter===t?"selected":"")+'>'+esc(t)+'</option>'}).join("")+'</select><input id="draftSearch" value="'+esc(f.draftQuery||"")+'" placeholder="Tìm nghĩa vụ/chủ thể/hành động/điều khoản..."><button class="btn" data-act="bulkAccept">Chấp nhận đã chọn</button><button class="btn alt" data-act="bulkReject">Loại đã chọn</button></div>'+
      '<div class="stack" style="margin-top:10px">'+(filtered.length?filtered.map(function(d){
        var src=S.sources.find(function(s){return s.id===d.sourceId}),a=S.assessments.find(function(x){return x.id===d.originAssessmentId}),conf=U().confidence(d.confidence!=null?d.confidence:d.aiConfidence),reasons=d.aiReviewReasons||d.reviewReasons||[],events=(S.draftReviewEvents||[]).filter(function(e){return e.objectId===d.id}).slice(0,5);
        var incomplete=[["Điều khoản",d.sourceClause],["Chủ thể",d.actorText],["Hành động",d.actionText],["Bằng chứng",d.expectedEvidence],["Phương pháp kiểm tra",d.testProcedure]].filter(function(x){return !String(x[1]||"").trim()}).map(function(x){return x[0]});
        return '<div class="obligation '+esc(d.reviewStatus)+'"><div class="row"><input class="draftCheck" type="checkbox" value="'+d.id+'"><div style="flex:1"><b>'+esc(d.obligation)+'</b><div class="small muted">'+esc(src&&src.title||"Nguồn chưa xác định")+(d.sourceClause?" · "+esc(d.sourceClause):"")+(a?" · "+esc(a.name):"")+'</div></div><span>'+tag(d.reviewStatus)+'</span></div>'+
          '<div class="obligation-intel">'+(d.aiGenerated?'<span class="confidence-chip info">AI draft</span>':'<span class="confidence-chip neutral">Rule/manual</span>')+(conf.pct!==null?'<span class="confidence-chip '+conf.tone+'">'+conf.pct+'% · '+conf.label+'</span>':'<span class="confidence-chip neutral">Chưa có confidence</span>')+'<span class="human-review-chip">Human review bắt buộc</span>'+(incomplete.length?'<span class="confidence-chip danger">Thiếu: '+esc(incomplete.join(", "))+'</span>':'<span class="confidence-chip positive">Đủ trường tối thiểu</span>')+'</div>'+
          (conf.pct!==null?'<div class="confidence-bar"><i style="width:'+conf.pct+'%"></i></div>':"")+
          (reasons.length?'<div class="small muted">Cần rà soát: '+esc(reasons.join(" · "))+'</div>':"")+
          '<div class="requirement-meta"><div><b>Chủ thể → Hành động</b><p>'+esc(d.actorText||"—")+' → '+esc(d.actionText||"—")+(d.objectText?' · '+esc(d.objectText):"")+'</p></div><div><b>Điều kiện / Ngoại lệ</b><p>'+esc(d.conditionText||"—")+(d.exceptionText?' | Ngoại lệ: '+esc(d.exceptionText):"")+'</p></div><div><b>Phạm vi cấu trúc</b><p>Đơn vị: '+esc(refs(d.applicableOrgRefs))+' · Quy trình: '+esc(refs(d.applicableProcessRefs))+' · Hoạt động: '+esc(refs(d.applicableActivityRefs))+'</p></div><div><b>Kiểm tra</b><p>'+esc(d.testProcedure||"Chưa xác định")+'</p></div></div>'+
          '<div class="small muted"><b>Bằng chứng:</b> '+esc(d.expectedEvidence||"Chưa xác định")+'</div>'+
          (events.length?'<details class="review-audit"><summary>Nhật ký human review · '+events.length+' gần nhất</summary>'+events.map(function(e){var meta=e.metadata||{};return'<div class="audit-event"><b>'+esc(c.lab(e.toState||e.decisionType))+'</b><span>'+esc(U().fmtDate(e.decidedAt))+' · '+esc(e.decidedBy||"—")+'</span>'+(meta.aiConfidence!=null?'<span>AI confidence: '+Math.round(Number(meta.aiConfidence)*100)+'%</span>':"")+(e.reason?'<span>Lý do: '+esc(e.reason)+'</span>':"")+'</div>'}).join("")+'</details>':'')+
          '<div class="row" style="margin-top:9px">'+(d.reviewStatus!=="accepted"?'<button class="btn" data-draft-accept="'+d.id+'" '+(incomplete.length?'disabled title="Cần hoàn thiện các trường bắt buộc trước khi chấp nhận"':'')+'>Chấp nhận</button>':"")+(d.reviewStatus!=="rejected"?'<button class="btn alt" data-draft-reject="'+d.id+'">Loại</button>':"")+'<button class="btn alt" data-draft-edit="'+d.id+'">Rà soát/Sửa</button></div></div>'
      }).join(""):UI.empty("Không có nghĩa vụ phù hợp","Thay đổi bộ lọc hoặc tiếp nhận nguồn căn cứ mới."))+'</div>'+
      (accepted?'<div class="row" style="margin-top:14px"><select id="publishFw"><option value="">Sổ nghĩa vụ chung — không gắn khung</option>'+S.frameworks.map(function(fw){return'<option value="'+fw.id+'">'+esc(fw.code+" · "+fw.name)+'</option>'}).join("")+'</select><button class="btn" data-act="publishDrafts">Gửi duyệt '+accepted+' nghĩa vụ</button></div>':"")+'</div>';

    var fw='<div class="card" style="margin-top:14px">'+UI.sectionHeader("4. Yêu cầu tuân thủ chính thức","Chỉ yêu cầu đã duyệt, còn hiệu lực và khớp phạm vi mới được đưa vào cuộc đánh giá.",c.can("manage_framework")?'<button class="btn alt" data-act="newfw">+ Tạo khung thủ công</button>':"")+
      S.frameworks.map(function(x){var rr=S.requirements.filter(function(r){return x.reqIds.indexOf(r.id)>=0});return'<div class="framework-block"><div class="framework-head"><span class="dot"></span><b>'+esc(x.code)+' · '+esc(x.name)+'</b><span class="right">'+tag(x.status)+'</span></div><div class="table"><table><thead><tr><th>Mã</th><th>Yêu cầu tuân thủ</th><th>Nguồn/Điều khoản</th><th>Chủ thể/Hành động</th><th>Kiểm tra</th></tr></thead><tbody>'+rr.map(function(r){var src=S.sources.find(function(s){return s.id===r.sourceId});return'<tr><td>'+esc(r.code)+'<div>'+tag(r.status||"effective")+'</div></td><td><b>'+esc(r.title)+'</b><div class="small muted">'+esc(r.applicability||"Áp dụng chung/chưa chỉ rõ")+'</div></td><td>'+esc(src&&src.title||"—")+(r.sourceClause?'<div class="small muted">'+esc(r.sourceClause)+'</div>':"")+'</td><td>'+esc(r.actorText||"—")+'<div class="small muted">'+esc(r.actionText||"—")+'</div></td><td>'+esc(r.test||"—")+'<div class="small muted">Bằng chứng: '+esc(r.expected||"—")+'</div>'+(r.status==="pending_approval"&&c.can("approve_framework")?'<div class="row"><button class="btn" data-approve-req="'+r.id+'">Duyệt</button><button class="btn alt" data-reject-req="'+r.id+'">Từ chối</button></div>':"")+'</td></tr>'}).join("")+'</tbody></table></div></div>'}).join("")+
      '</div>';

    return hero+metrics+scopeGuide+sources+review+fw;
  };
})();
