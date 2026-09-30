(function(){
  function esc(s){return String(s==null?"":s).replace(/[&<>'"]/g,function(m){return{"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[m]})}
  function pageIntro(o){
    o=o||{};
    return '<section class="product-hero">'+
      '<div><div class="eyebrow">'+esc(o.eyebrow||"COMPLIANCE CONTROL TOWER")+'</div>'+
      '<h2>'+esc(o.title||"")+'</h2>'+
      (o.description?'<p>'+esc(o.description)+'</p>':"")+'</div>'+
      (o.actions?'<div class="hero-actions">'+o.actions+'</div>':"")+
      '</section>';
  }
  function metric(o){
    o=o||{};
    var tone=o.tone||"neutral";
    return '<article class="metric-card tone-'+esc(tone)+'">'+
      '<div class="metric-label">'+esc(o.label||"")+'</div>'+
      '<div class="metric-row"><strong>'+esc(o.value==null?"—":o.value)+'</strong>'+
      (o.badge?'<span class="metric-badge">'+esc(o.badge)+'</span>':"")+'</div>'+
      (o.meta?'<div class="metric-meta">'+esc(o.meta)+'</div>':"")+
      '</article>';
  }
  function metricGrid(items){return '<div class="metric-grid">'+(items||[]).map(metric).join("")+'</div>'}
  function sectionHeader(title,meta,actions){
    return '<div class="section-head"><div><h3>'+esc(title||"")+'</h3>'+(meta?'<p>'+esc(meta)+'</p>':"")+'</div>'+(actions?'<div class="section-actions">'+actions+'</div>':"")+'</div>';
  }
  function empty(title,text){
    return '<div class="product-empty"><div class="empty-mark">✓</div><b>'+esc(title||"Không có dữ liệu")+'</b>'+(text?'<p>'+esc(text)+'</p>':"")+'</div>';
  }
  function progress(value,label){
    var n=Math.max(0,Math.min(100,Number(value)||0));
    return '<div class="progress-block"><div class="progress-head"><span>'+esc(label||"Tiến độ")+'</span><b>'+n+'%</b></div><div class="product-progress"><i style="width:'+n+'%"></i></div></div>';
  }
  function screenClass(view){return "screen-"+String(view||"dashboard").replace(/[^a-z0-9_-]/gi,"")}
  window.ComplianceProductUI={pageIntro:pageIntro,metric:metric,metricGrid:metricGrid,sectionHeader:sectionHeader,empty:empty,progress:progress,screenClass:screenClass};
})();