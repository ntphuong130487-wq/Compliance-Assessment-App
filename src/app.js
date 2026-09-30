(function(){
var KEY="agris_compliance_mvp01";
var tabs=[["dashboard","Điều hành"],["frameworks","Nguồn & Khung tuân thủ"],["assessments","Chương trình đánh giá"],["fieldwork","Kiểm tra hiện trường"],["findings","Phát hiện"],["actions","Khắc phục"],["reports","Báo cáo"],["settings","Cấu hình"]];
var tabIcons={dashboard:"◫",frameworks:"▤",assessments:"◎",fieldwork:"✓",findings:"!",actions:"↻",reports:"▥",settings:"⚙"};
var UI=window.ComplianceProductUI||{pageIntro:function(){return""},metricGrid:function(){return""},sectionHeader:function(t){return"<h3>"+t+"</h3>"},empty:function(t){return"<div class=\"card\">"+t+"</div>"},progress:function(){return""},screenClass:function(v){return"screen-"+v}};
var VM=window.ComplianceViewModels||{};
var Screens=window.ComplianceScreens||{};
var view="dashboard",selectedAssessment=null,selectedRA=null,sourceMode="file",draftSourceFilter="all",draftStatusFilter="all",draftTypeFilter="all",draftQuery="",assessmentQuery="",assessmentStatusFilter="all",assessmentOrgFilter="all",findingQuery="",findingStatusFilter="all",findingSeverityFilter="all",actionQuery="",actionStatusFilter="all",actionOwnerFilter="all",runtimeReadiness=null,currentUser=null,clerkInstance=null,clerkConfig=null,clerkLoadError=null,clerkListenerBound=false;
function id(p){return p+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7)}
function now(){return new Date().toISOString()}
function seed(){
  if(window.AgriSComplianceDemoState)return window.AgriSComplianceDemoState();
  var fw="fw_demo";var req=[["r1","REQ-DEMO-01","Phê duyệt trước khi thực hiện giao dịch"],["r2","REQ-DEMO-02","Lưu hồ sơ đầy đủ và có thể truy xuất"],["r3","REQ-DEMO-03","Thực hiện đúng phân quyền"]].map(function(x){return{id:x[0],frameworkId:fw,code:x[1],title:x[2],description:"Yêu cầu minh họa để kiểm thử sản phẩm, không phải quy định thực tế của AgriS.",assessable:true,test:"Đối chiếu hồ sơ và dữ liệu thực tế với yêu cầu.",expected:"Chứng từ, hồ sơ, log hệ thống hoặc hình ảnh phù hợp."}});
  var as="as_demo";return{meta:{demo:true,version:"0.1"},org:[{id:"ho",name:"HO"},{id:"agric",name:"AgriC"}],frameworks:[{id:fw,code:"FW-DEMO-01",name:"Khung tuân thủ minh họa",version:"0.1",status:"draft",reqIds:req.map(function(r){return r.id})}],requirements:req,assessments:[{id:as,name:"Đánh giá minh họa – AgriC",frameworkId:fw,orgId:"agric",objective:"Kiểm thử end-to-end.",status:"fieldwork",locked:false}],ra:req.map(function(r,i){return{id:"ra"+i,assessmentId:as,requirementId:r.id,workflow:i===0?"in_progress":"to_do",result:"not_assessed",evidenceIds:[]}}),evidence:[],revisions:[],links:[],proposals:[],findings:[],actions:[],verifications:[],logs:[{id:id("log"),type:"seed_demo",object:"Assessment",at:now(),note:"Dữ liệu minh họa để kiểm thử ứng dụng."}]}
}
function normalizeState(s){
  s=s||seed();
  if(s.meta&&s.meta.demo&&s.meta.version!=="0.8-demo"&&window.AgriSComplianceDemoState)s=seed();
  s.responses=s.responses||[];s.sources=s.sources||[];s.draftRequirements=s.draftRequirements||[];s.draftReviewEvents=s.draftReviewEvents||[];
  (s.requirements||[]).forEach(function(r){if(!r.status)r.status="effective"});
  (s.assessments||[]).forEach(function(a){a.processRef=a.processRef||"";a.activityRef=a.activityRef||"";a.locationRef=a.locationRef||"";a.periodFrom=a.periodFrom||"";a.periodTo=a.periodTo||""});
  (s.findings||[]).forEach(function(f){if(f.status==="confirmed")f.status="final";if(f.remediationRequired==null)f.remediationRequired=false;f.remediationRequirement=f.remediationRequirement||""});
  (s.sources||[]).forEach(function(x){x.sourceCode=x.sourceCode||"";x.issuer=x.issuer||"";x.issueDate=x.issueDate||"";x.effectiveFrom=x.effectiveFrom||"";x.effectiveTo=x.effectiveTo||"";x.version=x.version||"";x.supersedesRef=x.supersedesRef||"";x.owner=x.owner||""});
  (s.actions||[]).forEach(function(a){a.closureEvidenceIds=a.closureEvidenceIds||[];a.createdAt=a.createdAt||null;a.actionType=a.actionType||"mandatory_remediation";a.progress=Number(a.progress||0)});
  s.actionChangeRequests=s.actionChangeRequests||[];
  s.requirementAssignments=s.requirementAssignments||[];
  s.notifications=s.notifications||[];
  s.notificationSettings=s.notificationSettings||{inApp:true,overdueEscalation:true};
  return s
}
function load(){try{return normalizeState(JSON.parse(localStorage.getItem(KEY))||seed())}catch(e){return normalizeState(seed())}}
var S=load(),syncMode="local",remoteVersion=0,syncTimer=null,lastSyncAt=null,dataModeRuntime="shared-json";
selectedAssessment=S.assessments[0]&&S.assessments[0].id;selectedRA=S.ra[0]&&S.ra[0].id;
function persistLocal(){localStorage.setItem(KEY,JSON.stringify(S))}
async function pullRemote(){
  try{
    var ready=await fetch("/api/readiness",{headers:{"Accept":"application/json"}}).then(function(r){return r.json()});
    runtimeReadiness=ready;dataModeRuntime=ready&&ready.database&&ready.database.dataMode||"shared-json";
    if(dataModeRuntime==="normalized"){
      var nr=await fetch("/api/v1/bootstrap",{headers:{"Accept":"application/json"}}),nd=await nr.json();
      if(nr.status===401||nr.status===403){syncMode="secure-local";render();return}
      if(!nr.ok||!nd.ok){syncMode="offline";render();return}
      S=normalizeState(nd.state);syncMode="normalized";lastSyncAt=now();persistLocal();
      selectedAssessment=S.assessments[0]&&S.assessments[0].id;
      selectedRA=S.ra[0]&&S.ra[0].id;
      render();return;
    }
    var res=await fetch("/api/state",{headers:{"Accept":"application/json"}});
    var data=await res.json();
    if(!data.configured){syncMode="local";render();return}
    if(data.authRequired){syncMode="secure-local";render();return}
    syncMode="cloud";
    if(data.exists&&data.state){
      S=normalizeState(data.state);remoteVersion=Number(data.version||0);lastSyncAt=data.updatedAt||null;
      persistLocal();
      selectedAssessment=S.assessments[0]&&S.assessments[0].id;
      selectedRA=S.ra[0]&&S.ra[0].id;
      render();
    }else{
      await pushRemote(true);
    }
  }catch(e){syncMode="offline";render()}
}
async function pushRemote(force){
  if(syncMode==="normalized")return;
  if(!force&&syncMode!=="cloud")return;
  try{
    var res=await fetch("/api/state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({state:S,version:remoteVersion})});
    var data=await res.json();
    if(res.status===409){await pullRemote();return}
    if(data.configured&&data.ok){syncMode="cloud";remoteVersion=Number(data.version||remoteVersion);lastSyncAt=data.updatedAt||now();render()}
  }catch(e){syncMode="offline"}
}
async function apiCommand(command,payload){
  var res=await fetch("/api/v1/commands",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({command:command,payload:payload||{}})});
  var data=await res.json();
  if(!res.ok||!data.ok){throw new Error(data.error||"COMMAND_FAILED")}
  await pullRemote();
  return data;
}
function save(){
  persistLocal();
  if(syncMode==="normalized")return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(function(){pushRemote(false)},450);
}
function esc(s){return String(s==null?"":s).replace(/[&<>'"]/g,function(m){return{"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[m]})}
var labels={dashboard:"Điều hành",draft:"Nháp",fieldwork:"Đang kiểm tra",review:"Rà soát",closed:"Đã đóng",to_do:"Chưa làm",in_progress:"Đang làm",in_review:"Đang rà soát",done:"Hoàn tất",not_assessed:"Chưa đánh giá",compliant:"Tuân thủ",partially_compliant:"Tuân thủ một phần",non_compliant:"Không tuân thủ",not_applicable:"Không áp dụng",insufficient_evidence:"Chưa đủ bằng chứng",confirmed:"Đã xác nhận",assigned:"Đã giao",pending_verification:"Chờ xác minh",open:"Mở",verified:"Đã xác minh",overdue:"Quá hạn",reopened:"Mở lại",accepted:"Đã chấp nhận",rejected:"Đã bác bỏ",pending_approval:"Chờ duyệt",effective:"Hiệu lực",published:"Đã gửi duyệt",submitted_for_verification:"Chờ xác minh",pending_unit_response:"Chờ đơn vị phản hồi",pending_final_review:"Chờ chốt cuối",final:"Chính thức",dismissed:"Hủy"};
function lab(x){return labels[x]||x}
function tag(x){var c=["non_compliant","overdue","reopened"].indexOf(x)>=0?"red":["compliant","closed","verified","done"].indexOf(x)>=0?"green":["partially_compliant","in_review","pending_verification"].indexOf(x)>=0?"amber":"blue";return'<span class="tag '+c+'">'+esc(lab(x))+"</span>"}
function isoDay(d){var x=d?new Date(d):new Date();return new Date(x.getFullYear(),x.getMonth(),x.getDate())}
function daysFrom(date){if(!date)return null;return Math.floor((isoDay()-isoDay(date))/86400000)}
function daysUntil(date){if(!date)return null;return Math.ceil((isoDay(date)-isoDay())/86400000)}
function notificationCandidates(){
  var ns=S.notificationSettings||{};if(ns.inApp===false)return[];
  var out=[],visibleF=visibleFindings(),visibleA=visibleActions();
  visibleF.forEach(function(f){
    if(f.status==="pending_unit_response")out.push({id:"f_resp_"+f.id,level:"warning",type:"Phát hiện",title:"Chờ đơn vị phản hồi",text:f.title,target:"findings",objectId:f.id});
    if(f.status==="pending_final_review")out.push({id:"f_final_"+f.id,level:"warning",type:"Phát hiện",title:"Chờ chốt sau phản hồi",text:f.title,target:"findings",objectId:f.id});
    if(f.status==="final"&&!S.actions.some(function(a){return a.findingId===f.id}))out.push({id:"f_action_"+f.id,level:(f.severity==="critical"||f.severity==="high")?"critical":"warning",type:"Phát hiện",title:"Chưa có hành động khắc phục",text:f.title,target:"findings",objectId:f.id});
  });
  visibleA.forEach(function(a){
    var d=daysUntil(a.due);
    if(ns.overdueEscalation!==false&&a.status!=="closed"&&d!==null&&d<0)out.push({id:"a_over_"+a.id,level:"critical",type:"Chuyển cấp",title:"Hành động quá hạn "+Math.abs(d)+" ngày",text:a.text,target:"actions",objectId:a.id});
    var rd=Number(ns.reminderBeforeDueDays);if(a.status!=="closed"&&d!==null&&ns.reminderBeforeDueDays!==""&&ns.reminderBeforeDueDays!=null&&!Number.isNaN(rd)&&d>=0&&d<=rd)out.push({id:"a_due_"+a.id+"_"+rd,level:"info",type:"Nhắc việc",title:"Hành động sắp đến hạn trong "+d+" ngày",text:a.text,target:"actions",objectId:a.id});
    if(a.status==="submitted_for_verification")out.push({id:"a_verify_"+a.id,level:"warning",type:"Hành động",title:"Chờ xác minh",text:a.text,target:"actions",objectId:a.id});
    if(a.status==="reopened")out.push({id:"a_reopen_"+a.id,level:"warning",type:"Hành động",title:"Xác minh chưa đạt – cần xử lý lại",text:a.text,target:"actions",objectId:a.id});
  });
  S.requirements.filter(function(r){return r.status==="pending_approval"}).forEach(function(r){
    if(can("approve_framework"))out.push({id:"r_approve_"+r.id,level:"info",type:"Khung tuân thủ",title:"Yêu cầu tuân thủ chờ duyệt",text:r.code+" · "+r.title,target:"frameworks",objectId:r.id});
  });
  return out;
}
function syncNotifications(){
  var old=new Map((S.notifications||[]).map(function(n){return[n.id,n]})),cand=notificationCandidates();
  S.notifications=cand.map(function(n){var p=old.get(n.id);return Object.assign({createdAt:(p&&p.createdAt)||now(),readAt:p&&p.readAt||null},n)});
  persistLocal();
  return S.notifications;
}
function unreadCount(){return syncNotifications().filter(function(n){return !n.readAt}).length}
function openNotifications(){
  var rows=syncNotifications();
  modal('<div class="row"><div><h3 style="margin:0">Thông báo & chuyển cấp</h3><div class="small muted">Tạo từ trạng thái nghiệp vụ và thời hạn thực tế; không dùng ngưỡng giả định.</div></div>'+(rows.some(function(n){return !n.readAt})?'<button class="btn alt right" data-act="readAll">Đánh dấu đã đọc</button>':"")+'</div><div class="alert-list" style="margin-top:12px">'+(rows.length?rows.map(function(n){return'<div class="alert-item '+esc(n.level)+'" data-notif-nav="'+esc(n.target)+'"><div class="row"><span class="tag '+(n.level==="critical"?"red":n.level==="warning"?"amber":"blue")+'">'+esc(n.type)+'</span>'+(!n.readAt?'<span class="tag red">Mới</span>':"")+'</div><b>'+esc(n.title)+'</b><div class="small">'+esc(n.text)+'</div></div>'}).join(""):'<div class="small muted">Không có thông báo cần xử lý.</div>')+'</div>');
}
function markAllNotificationsRead(){var t=now();(S.notifications||[]).forEach(function(n){n.readAt=t});save();document.getElementById("mb")?.remove();render()}
function globalSearch(q){
  q=String(q||"").trim().toLowerCase();if(!q)return[];
  var out=[];
  S.sources.forEach(function(x){if([x.title,x.sourceCode,x.issuer,x.owner].filter(Boolean).join(" ").toLowerCase().includes(q))out.push({type:"Nguồn",title:x.title,sub:[x.sourceCode,x.issuer].filter(Boolean).join(" · "),view:"frameworks"})});
  S.requirements.forEach(function(x){if([x.code,x.title,x.description,x.sourceClause,x.applicability].filter(Boolean).join(" ").toLowerCase().includes(q))out.push({type:"Yêu cầu tuân thủ",title:x.code+" · "+x.title,sub:lab(x.status||"effective"),view:"frameworks"})});
  visibleAssessments().forEach(function(x){if([x.name,x.objective,x.processRef,x.activityRef,x.locationRef].filter(Boolean).join(" ").toLowerCase().includes(q))out.push({type:"Cuộc đánh giá",title:x.name,sub:[x.processRef,x.activityRef,x.locationRef].filter(Boolean).join(" · "),view:"fieldwork",assessmentId:x.id})});
  visibleFindings().forEach(function(x){if([x.title,x.fact,x.criteria,x.gap,x.impact,x.rec].filter(Boolean).join(" ").toLowerCase().includes(q))out.push({type:"Phát hiện",title:x.title,sub:lab(x.status),view:"findings"})});
  visibleActions().forEach(function(x){if([x.text,x.owner,x.status].filter(Boolean).join(" ").toLowerCase().includes(q))out.push({type:"Hành động",title:x.text,sub:x.owner+" · "+lab(x.status),view:"actions"})});
  var visibleRaIds=visibleRA().map(function(r){return r.id}),visibleActionIds=visibleActions().map(function(a){return a.id}),visibleEvIds=S.links.filter(function(l){return(l.targetType==="RequirementAssessment"&&visibleRaIds.indexOf(l.targetId)>=0)||(l.targetType==="RemediationAction"&&visibleActionIds.indexOf(l.targetId)>=0)}).map(function(l){var rv=S.revisions.find(function(r){return r.id===l.revId});return rv&&rv.evidenceId}).filter(Boolean);S.evidence.filter(function(x){return visibleEvIds.indexOf(x.id)>=0}).forEach(function(x){if([x.name,x.type].filter(Boolean).join(" ").toLowerCase().includes(q))out.push({type:"Bằng chứng",title:x.name,sub:x.type||"",view:"fieldwork"})});
  return out.slice(0,80);
}
function openGlobalSearch(q){
  var rows=globalSearch(q);
  modal('<h3>Tìm kiếm toàn hệ thống</h3><div class="field"><label>Từ khóa</label><input id="searchModalInput" value="'+esc(q||"")+'" placeholder="Nguồn, yêu cầu, đánh giá, phát hiện, hành động, bằng chứng..."></div><div id="searchModalResults">'+renderSearchResults(rows)+'</div>');
  var inp=document.getElementById("searchModalInput");if(inp)inp.oninput=function(){document.getElementById("searchModalResults").innerHTML=renderSearchResults(globalSearch(inp.value));bindSearchResults()};
  bindSearchResults();
}
function renderSearchResults(rows){return rows.length?rows.map(function(r,i){return'<div class="search-result" data-search-index="'+i+'"><div class="search-type">'+esc(r.type)+'</div><b>'+esc(r.title)+'</b><div class="small muted">'+esc(r.sub||"")+'</div></div>'}).join(""):'<div class="small muted">Không tìm thấy dữ liệu phù hợp.</div>'}
var __searchRows=[];
function bindSearchResults(){
  var inp=document.getElementById("searchModalInput");__searchRows=globalSearch(inp?inp.value:"");
  document.querySelectorAll("[data-search-index]").forEach(function(el){el.onclick=function(){var r=__searchRows[Number(el.dataset.searchIndex)];if(!r)return;if(r.assessmentId){selectedAssessment=r.assessmentId;selectedRA=null}view=r.view;document.getElementById("mb")?.remove();render()}});
}
function exportBlob(filename,mime,text){var blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},500)}
function csvCell(v){var s=String(v==null?"":v).replace(/"/g,'""');return '"'+s+'"'}
function exportCSV(kind){
  var headers=[],rows=[];
  if(kind==="findings"){headers=["Tiêu đề","Trạng thái","Mức độ","Đơn vị","Yêu cầu","Dữ kiện","Khoảng cách","Rủi ro/Tác động","Khuyến nghị"];rows=visibleFindings().map(function(f){var ra=S.ra.find(function(r){return r.id===f.raId}),a=ra&&S.assessments.find(function(x){return x.id===ra.assessmentId}),u=a&&S.org.find(function(x){return x.id===a.orgId}),q=ra&&S.requirements.find(function(x){return x.id===ra.requirementId});return[f.title,lab(f.status),f.severity,u&&u.name,q&&q.code,f.fact,f.gap,f.impact,f.rec]})}
  else if(kind==="actions"){headers=["Hành động","Người phụ trách","Hạn","Trạng thái","Số bằng chứng","Phát hiện"];rows=visibleActions().map(function(a){var f=S.findings.find(function(x){return x.id===a.findingId});return[a.text,a.owner,a.due,lab(a.status),actionEvidenceCount(a.id),f&&f.title]})}
  else {headers=["Cuộc đánh giá","Đơn vị","Quy trình","Hoạt động","Địa điểm","Từ ngày","Đến ngày","Trạng thái","Số yêu cầu"];rows=visibleAssessments().map(function(a){var u=S.org.find(function(x){return x.id===a.orgId});return[a.name,u&&u.name,a.processRef,a.activityRef,a.locationRef,a.periodFrom,a.periodTo,lab(a.status),S.ra.filter(function(r){return r.assessmentId===a.id}).length]})}
  var csv="\ufeff"+headers.map(csvCell).join(",")+"\n"+rows.map(function(r){return r.map(csvCell).join(",")}).join("\n");exportBlob("AgriS_Compliance_"+kind+"_"+new Date().toISOString().slice(0,10)+".csv","text/csv;charset=utf-8",csv)
}
function exportJSON(){var payload={exportedAt:now(),assessments:visibleAssessments(),requirementAssessments:visibleRA(),findings:visibleFindings(),actions:visibleActions(),sources:S.sources,requirements:S.requirements};exportBlob("AgriS_Compliance_snapshot_"+new Date().toISOString().slice(0,10)+".json","application/json;charset=utf-8",JSON.stringify(payload,null,2))}
function printManagementReport(){
  var m=metrics(),fs=visibleFindings(),as=visibleActions(),w=window.open("","_blank");if(!w)return;
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Báo cáo tuân thủ AgriS</title><style>body{font:13px Arial;padding:28px;color:#173027}h1{color:#0b7338}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#f2f7f3}.k{display:inline-block;margin-right:28px}</style></head><body><h1>Báo cáo quản trị tuân thủ</h1><p>Thời điểm xuất: '+new Date().toLocaleString("vi-VN")+'</p><p><span class="k"><b>Coverage:</b> '+m.coverage+'%</span><span class="k"><b>Phát hiện mở:</b> '+m.find+'</span><span class="k"><b>Hành động quá hạn:</b> '+m.over+'</span></p><h2>Phát hiện</h2><table><tr><th>Tiêu đề</th><th>Mức độ</th><th>Trạng thái</th></tr>'+fs.map(function(f){return'<tr><td>'+esc(f.title)+'</td><td>'+esc(f.severity)+'</td><td>'+esc(lab(f.status))+'</td></tr>'}).join("")+'</table><h2>Hành động</h2><table><tr><th>Hành động</th><th>Người phụ trách</th><th>Hạn</th><th>Trạng thái</th></tr>'+as.map(function(a){return'<tr><td>'+esc(a.text)+'</td><td>'+esc(a.owner)+'</td><td>'+esc(a.due||"")+'</td><td>'+esc(lab(a.status))+'</td></tr>'}).join("")+'</table></body></html>');w.document.close();w.focus();setTimeout(function(){w.print()},250)
}
function loadExternalScript(src,id){
  return new Promise(function(resolve,reject){
    if(document.getElementById(id))return resolve();
    var s=document.createElement("script");s.id=id;s.src=src;s.defer=true;s.crossOrigin="anonymous";s.onload=resolve;s.onerror=function(){reject(new Error("SCRIPT_LOAD_FAILED"))};document.head.appendChild(s);
  });
}
async function initClerk(){
  try{
    clerkLoadError=null;
    clerkConfig=await fetch("/api/auth/config",{headers:{"Accept":"application/json"}}).then(function(r){return r.json()});
    if(!clerkConfig.configured||!clerkConfig.publishableKey)return null;
    var token=String(clerkConfig.publishableKey).split("_")[2],domain=atob(token).slice(0,-1);
    await loadExternalScript("https://"+domain+"/npm/@clerk/ui@1/dist/ui.browser.js","clerk-ui");
    if(!document.getElementById("clerk-js")){
      await new Promise(function(resolve,reject){
        var s=document.createElement("script");
        s.id="clerk-js";
        s.defer=true;
        s.crossOrigin="anonymous";
        s.setAttribute("data-clerk-publishable-key",clerkConfig.publishableKey);
        s.src="https://"+domain+"/npm/@clerk/clerk-js@6/dist/clerk.browser.js";
        s.onload=resolve;
        s.onerror=function(){reject(new Error("CLERK_JS_LOAD_FAILED"))};
        document.head.appendChild(s);
      });
    }
    if(!window.Clerk)throw new Error("CLERK_GLOBAL_MISSING");
    await window.Clerk.load({ui:{ClerkUI:window.__internal_ClerkUICtor}});
    clerkInstance=window.Clerk;
    if(!clerkListenerBound&&clerkInstance.addListener){
      clerkListenerBound=true;
      clerkInstance.addListener(async function(evt){
        if(evt&&evt.user){
          await refreshCurrentUser();
          await pullRemote();
          render();
        }else if(currentUser){
          currentUser=null;ComplianceAccess.setRuntimeUser(null);render();
        }
      });
    }
    return clerkInstance;
  }catch(e){clerkLoadError=String(e&&e.message||e);clerkInstance=null;return null}
}
async function refreshCurrentUser(){
  try{
    var me=await fetch("/api/auth/me",{headers:{"Accept":"application/json"}}),d=await me.json();
    currentUser=me.ok&&d.authenticated?d.user:null;
    ComplianceAccess.setRuntimeUser(currentUser);
  }catch(e){currentUser=null}
}
async function loadRuntimeReadiness(){
  try{runtimeReadiness=await fetch("/api/readiness",{headers:{"Accept":"application/json"}}).then(function(r){return r.json()})}catch(e){runtimeReadiness={ok:false}}
  dataModeRuntime=runtimeReadiness&&runtimeReadiness.database&&runtimeReadiness.database.dataMode||dataModeRuntime;
  await initClerk();
  await refreshCurrentUser();
  render();
}
async function openClerkSignIn(){
  if(!clerkInstance)await initClerk();
  if(clerkInstance)return clerkInstance.openSignIn({});
  modal('<h3>Không tải được đăng nhập</h3><p>Clerk đã được cấu hình nhưng client xác thực chưa tải thành công.</p><p class="small muted">'+esc(clerkLoadError||"Vui lòng tải lại trang và thử lại.")+'</p>');
}
async function signOutClerk(){
  ComplianceAccess.setRuntimeUser(null);currentUser=null;
  if(clerkInstance){await clerkInstance.signOut();location.reload()}
}
function authWidget(){
  if(currentUser)return'<span class="top-auth" title="'+esc(currentUser.email||"")+'">'+esc(currentUser.name||currentUser.email||"Đã đăng nhập")+'</span><button class="btn alt" data-auth="logout">Đăng xuất</button>';
  if(runtimeReadiness&&runtimeReadiness.auth&&runtimeReadiness.auth.configured)return'<button class="btn alt" data-auth="login">Đăng nhập bằng email</button>';
  return can("administer_access")?'<span class="top-auth">Clerk chưa cấu hình</span>':"";
}

function visibleAssessments(){return S.assessments.filter(function(a){return can("view_dashboard",a)})}
function visibleRA(){var ids=visibleAssessments().map(function(a){return a.id});return S.ra.filter(function(r){return ids.indexOf(r.assessmentId)>=0})}
function findingAssessment(f){var r=S.ra.find(function(x){return x.id===f.raId});return r&&S.assessments.find(function(a){return a.id===r.assessmentId})}
function visibleFindings(){return S.findings.filter(function(f){var a=findingAssessment(f);return a&&can("view_dashboard",a)})}
function visibleActions(){var fs=visibleFindings().map(function(f){return f.id});return S.actions.filter(function(a){return fs.indexOf(a.findingId)>=0})}
function metrics(){var rs=visibleRA(),fs=visibleFindings(),as=visibleActions(),done=rs.filter(function(x){return x.workflow==="done"}).length;return{active:visibleAssessments().filter(function(a){return a.status!=="closed"}).length,done:done,total:rs.length,coverage:rs.length?Math.round(done*100/rs.length):0,nc:rs.filter(function(x){return x.result==="non_compliant"}).length,find:fs.filter(function(x){return x.status!=="closed"&&x.status!=="dismissed"}).length,over:as.filter(function(x){return x.status==="overdue"||(x.due&&new Date(x.due)<new Date()&&x.status!=="closed")}).length}}
function nav(){return tabs.filter(function(t){return ComplianceAccess.viewAllowed(t[0])}).map(function(t){return'<button data-nav="'+t[0]+'" class="'+(view===t[0]?"on":"")+'"><span class="nav-icon">'+(tabIcons[t[0]]||"•")+'</span><span>'+t[1]+"</span></button>"}).join("")}
function syncBadge(){var t=syncMode==="cloud"?"Cloud sync":syncMode==="offline"?"Offline fallback":syncMode==="secure-local"?"Secure local":"Local";var cls=syncMode==="cloud"?"green":syncMode==="offline"||syncMode==="secure-local"?"amber":"blue";return'<span class="tag '+cls+'" title="'+esc(lastSyncAt?"Đồng bộ: "+lastSyncAt:"")+'">'+t+'</span>'}
function can(p,a){return ComplianceAccess.can(p,{assessment:a||null})}
function guard(p,a){if(can(p,a))return true;modal('<h3>Không đủ quyền</h3><p>Vai trò mô phỏng hiện tại không có quyền thực hiện thao tác này.</p><p class="small muted">Đây là kiểm thử policy; khi Clerk được cấu hình, quyền sẽ lấy từ tài khoản người dùng.</p>');return false}
function roleSelector(){if(currentUser)return'<span class="tag green" title="Vai trò từ Clerk">'+esc((ComplianceAccess.roles[currentUser.role]&&ComplianceAccess.roles[currentUser.role].label)||currentUser.role)+'</span>';var cur=ComplianceAccess.current();return'<select id="personaSel" title="Mô phỏng quyền — chưa phải đăng nhập thật">'+ComplianceAccess.personas.map(function(p){return'<option value="'+p.id+'" '+(p.id===cur.id?"selected":"")+'>'+esc(p.label)+"</option>"}).join("")+"</select>"}
function shell(title,body){var n=unreadCount();return'<div class="app"><aside class="side"><div class="brand"><img class="brand-logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAABLCAMAAADu113MAAAAwFBMVEUsiFYeTHdwoZRwtrZxt3JnpYbY5+Imcm14eHgDbjMbL3az08XQ5902X4SItqOo86lVnHVTdpSJr6uozLoacyFzl6B///9ZXKoALmJHbI5UdZSsuLSbxq+juMir5+MAPy0A/wAA//+gssI+ZYgWqmBdn3w4X4R/f/9//38AAP+42MkvV3wAVao5jWBmmcyXr8Gs0b3/AP//f////wAAAAANdDwBNWj+/v4siFZUmnSqqqqaxa5Klm3c6Of5/PsSe0J98JYUAAAAAXRSTlMAQObYZgAACIVJREFUeNrtmgd7o7oShoUwxQ13J3H6braccu89RViCYPj//+qMAINGCGzH8Z7N81xtDXHM62HKNyMR9gEX+T/0vw3N9+uSd+cdd1nbg3x5MT8W2v8RFntq/Y7/O/rS/gCWzr/arTazr799na3u5ZdXh6FttnCmjlzTKb0UeFzdBG4TsPomAJjSsWVt82VZ1mzO0bM3QnPGp2G5+mSkP513WjZ7Jf39baL65gPG6XiLlmVtOBt0Q9t8JMKsfLuMXsjBAVrs71FDw73+Z22b62ZUu4gRusfoHhnWlDN+Yeja0j7jMxPzdju+Z14HNGcpqZlD8noZU5ugwT6zrXldW/fsWzt0j90JBTp0LmNqAzT3Od22resxL61nDsRIZQ7FCD7HD4G22dzatq9ZO3TMXGToMKT8QtAEQ8MT7WLeWp+KYDRAe1wNQ7mSg/7B/fX6lHQucz/k6Wm0X1Te4YrRbeei3DNDQxgmmDkUr13+sZ487v+7nBwDHnvm68+M36g+LOsKtvy4sF4T2mNzokF3hWLx2TlP3ZQXznXIyPKvdLdjXE9KPnNVRitIGU9RMoEEEpvdQwvDsio+mBHgCfAhnU6FECSJghE/gjkNokREJidfqdC0uKoa39rkuboBPWEjoUPLqui1aEEeJKIKgUw4I5AAZL8iaU/+xGl1BXw3IFnYD/8D77iI1Ovg0hsV8IHdMvZf9slC+WNggl4yPQzzAmP0D7h0l2ivJne89i6xg8cJP1oHScSdQnBEAK1lD49RBdByi8hWE4r11QhtCMMcZW4wNfBQw1O5S/o6dO1wTlBRenqe9pB7WCNpaXiY883nzefP8Gez2azyOCANH1U+fmIpFjIwp07z42V9IcJW6L4j2qFjXFpm4DD+ce2WGoZ/KA/a1fMCNzJrubJhaYXSAI2zB1CzAZAPquUZK+KDGoYinaqh2NNSHT/I3AVNmtBML4hWIJ/v+pClIRbUQhgQtSp+w84RkHOgI/7SgPZQ+pDU4xVvtoga9HemhD4YVxEhWlVsCpSToZcNaHil1rJcb8d018AmmqFXihsv0N1wKPq6c2REkOxc97gyqTxrdquNB4jWGyaoY2G0JRRtrQSJKLh7nQeROAo6g/IpY6TZBJglk3UzRP04wflORfkCXw+FORR91ffB4YfFY+CjKDsE3RfT1UIKlQdT5+JBt3VtwJ6lMpGYoJcqCnjHBFkeQnEfyGvV96FipOBZXs97gbs62QFosuAdPSJ8b2XU1NacVUWZtPaGIpUKjqJe0aseyUJ5JEnK9pIUPqbTDU0WYJye1NNGaAl2P96ajE0rKUGQ/FGzWFQMbYQpFFG7Dt3YpHqPW7YTndCRzFHtloY1YHw1NrcApYeQtjAkAXgLViKiFqiqPR2+5GpcfOmCzurWrQ1axnsaWAYnoWXqI2hMpRqpTBZfkED1mx9P01K9p9cO7RGSFTsILY0N1r6xDH7ta9DIgSHs/oauz35W25h9rwj/KGBDbiMlPyIdKk+pUR3QRT/0qTG2udHbrTUKw6zsG1DhI+UdMbSL1AGK5lOh/Xrl2C7VxIjebqFqCP67H8I6qPZ6DWhS6F6jIH+zpfMltQ7H2FrngsMwFNOkWNNErQuFo2vugZRBfIalOV5geUAMLOwfKjSqfm2rrIrqKBg6FaQL7KeheBv0mn0aW/Va5aHyDY8VrNyplUCkh1WbDMXv+lNxOPuzZeJ6KnRdwa+3qyIpeUiNAPRzDQ2ueITUhFDkeSLkFKXv25ZkfzJ0c5o0eEbQrgrtHaPpq7HNizrQ6cO1fUnkj6iZPwma426rnCZdsRm2tF9BmzWvSda7EnCCMiFUOYiZOI79R4gbEb4ZGndbkHQHjwPcF4xVn/ZRNTwYitpnzKZpCZLimcKp2WOM65+0dOqgYZ5axpfMCY9bEIp/yXDDAz9BXx/ch1eqNS+nQQ/YTOsQZ3Q21tRHPRbTNiw6/eO1MHVaj2SKEJXTvOxgu9UFHbNhUyVda+LDrqA9ta8qANDCA4tlMbN/U2Pb6R6D7pl6Hoe/7KG1apjR4WKorl9FqMs/3jti7HEq9IHdi61V5m7SFKV9kuoqIGpWxbV56HcWNLviThf0Df/luYJeqqpZ5mLbntQrtlmQNTczHthIc+vzoX1ctPXdLVfZKNKqoZhrE7BY+355X1DOiWkAmbxdmhrGNWj30657xCWuho1tIb3yOGVfbDPXQC1G4gxpGutitEoiN26lJkkRhn20AffSmP8GWb8hUOV1TvVUmSxSA3S/ihcEbdjQh1ffj61GOy57cVuZe9hsmCjpLVk0Bn4xmFR5BfS8verwyIgS4M5v3g8zQXeqxJVjCPnLUd+9hl5Mq+uOur3AV1/HaOibD/RsdcIEQiXd7XauK3/Dv8Y5diq/lb9AvkzuTBVCHdTG6O7LNM/sJKIjCCalVorc0+AGI/mz+bu71Xkazt2RvJhf3ikuKdNauprdjKW8HkNZzOdX/L0PXvF0cns7yffkeqogSN62q16IUqacufHWjakpj3GX03lwp3wJT+tV/chjjDORw5s/jd60urHf2CCtz6QM9KNXb7O0DAOS7JecgLqxHQMBdAMOqkPLs084vdu5PLnZ2A/7xYJ0spBW9iQgV+uQ1vP+y4cJc7FSb3mG4i4tR72OCM926UudgNTqUUgShwbUSZDyIyvm/UzHNg17pJmmpqGep0/8Z4IGX707oKf7ZHj4SMKPhZbbiFm3wgsudvbzzcXFZ51dQF8EZ6W7y0DnkqLd1smv7IX/fNCSmrb4tXBStrzc0dpztMd3EEuOaFhbnlThFzkU9y6CiS/lWSAiiLqtOQ1crMl+MuhC4/Lh3ImiZJokkUNfXYk7uSjz2dKUx8ta3JRyOGYXXu+gp/mkLtbLXswZ+wDQuqU/DvQPXR8S+h9gwC/kbmzZ8AAAAABJRU5ErkJggg=="><div class="brand-copy"><b>Đánh giá tuân thủ</b><small>Ứng dụng · Product v1</small></div></div><div class="nav">'+nav()+'</div></aside><main class="main '+UI.screenClass(view)+'"><header class="top"><h1>'+esc(title)+'</h1><div class="top-tools"><div class="global-search"><span>⌕</span><input id="globalSearch" placeholder="Tìm toàn hệ thống..."></div><button class="notif-btn" data-act="notifications" title="Thông báo">🔔'+(n?'<span class="notif-count">'+n+'</span>':"")+'</button>'+roleSelector()+syncBadge()+authWidget()+(can("administer_access")?'<button class="btn alt" data-act="qa">QA</button>':"")+'</div></header><div class="mobile">'+nav()+'</div><div class="content"><div class="note"><b>Môi trường kiểm thử:</b> Dữ liệu mặc định là minh họa, không phải số liệu tuân thủ thực tế của AgriS. Khi đăng nhập production, quyền truy cập và dữ liệu được giới hạn theo vai trò và phạm vi đơn vị.</div>'+body+"</div></main></div>"}function screenContext(){
  return{
    S:S,UI:UI,VM:VM,ComplianceAccess:ComplianceAccess,currentUser:currentUser,runtimeReadiness:runtimeReadiness,
    esc:esc,tag:tag,lab:lab,can:can,daysUntil:daysUntil,daysFrom:daysFrom,metrics:metrics,
    visibleFindings:visibleFindings,visibleActions:visibleActions,visibleAssessments:visibleAssessments,visibleRA:visibleRA,
    syncNotifications:syncNotifications,sourceStatusLabel:sourceStatusLabel,findingAssessment:findingAssessment,
    actionEvidenceCount:actionEvidenceCount,canUpdateAction:canUpdateAction,
    filters:{
      sourceMode:sourceMode,draftSourceFilter:draftSourceFilter,draftStatusFilter:draftStatusFilter,draftTypeFilter:draftTypeFilter,draftQuery:draftQuery,
      assessmentQuery:assessmentQuery,assessmentStatusFilter:assessmentStatusFilter,assessmentOrgFilter:assessmentOrgFilter,
      findingQuery:findingQuery,findingStatusFilter:findingStatusFilter,findingSeverityFilter:findingSeverityFilter,
      actionQuery:actionQuery,actionStatusFilter:actionStatusFilter,actionOwnerFilter:actionOwnerFilter
    },
    selection:{selectedAssessment:selectedAssessment,selectedRA:selectedRA},
    getSelection:function(k){return k==="selectedAssessment"?selectedAssessment:selectedRA},
    setSelection:function(k,v){if(k==="selectedAssessment")selectedAssessment=v;if(k==="selectedRA")selectedRA=v}
  }
}
function dashboard(){return shell("Điều hành",Screens.dashboard(screenContext()))}

function sourceStatusLabel(s){
  return({draft:"Nháp",extracted:"Đã bóc tách",pending_approval:"Chờ duyệt",published:"Đã hiệu lực",search_not_configured:"Chưa kết nối nguồn search",needs_ocr:"Cần OCR/AI",error:"Lỗi"})[s]||s;
}
function localExtract(text,sourceId){
  var keys=["phải","không được","có trách nhiệm","chịu trách nhiệm","chỉ được","bắt buộc","thực hiện","bảo đảm","đảm bảo","lưu giữ","lưu trữ","báo cáo","phê duyệt","tuân thủ","cấm","đăng ký","thông báo"];
  var parts=String(text||"").replace(/\r/g,"\n").split(/\n+|(?<=[.;!?])\s+/).map(function(x){return x.trim()}).filter(Boolean);
  var cand=parts.filter(function(s){var x=s.toLowerCase();return s.length>=18&&keys.some(function(k){return x.indexOf(k)>=0})});
  if(!cand.length)cand=parts.filter(function(s){return s.length>=40}).slice(0,30);
  return cand.slice(0,60).map(function(s){
    var x=s.toLowerCase(),type=/không được|cấm/.test(x)?"prohibition":/phê duyệt|chấp thuận/.test(x)?"approval":/lưu giữ|lưu trữ|hồ sơ|chứng từ/.test(x)?"record":/báo cáo|thông báo/.test(x)?"reporting":/đăng ký|giấy phép|điều kiện/.test(x)?"condition":/trách nhiệm/.test(x)?"responsibility":"general";
    return{id:id("dr"),sourceId:sourceId,sourceClause:"",originalText:s,obligation:s,applicability:"",obligationType:type,mandatoryLevel:/nếu|trường hợp|khi /.test(x)?"conditional":/phải|không được|cấm|bắt buộc|chỉ được/.test(x)?"mandatory":"review",expectedEvidence:"Hồ sơ, dữ liệu hệ thống, chứng từ hoặc bằng chứng thực tế phù hợp.",testProcedure:"Đối chiếu bằng chứng thực tế với yêu cầu và phạm vi áp dụng của nghĩa vụ.",reviewStatus:"draft"};
  });
}
async function extractTextSource(src,text){
  var drafts=[];
  try{
    var res=await fetch("/api/obligations/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:text,sourceId:src.id})});
    var data=await res.json();
    if(res.ok&&data.ok){
      if(syncMode==="normalized"){await pullRemote();render();return}
      drafts=(data.obligations||[]).map(function(d){d.id=id("dr");return d});
    }
  }catch(e){if(syncMode==="normalized"){alert("Không bóc tách được nghĩa vụ: "+e.message);return}}
  if(!drafts.length)drafts=localExtract(text,src.id);
  S.draftRequirements=S.draftRequirements.concat(drafts);
  src.status="extracted";src.extractedCount=drafts.length;src.updatedAt=now();save();render();
}
function sourceMetaFields(s){
  s=s||{};
  return '<div class="split"><div class="field"><label>Số hiệu/Mã nguồn</label><input name="sourceCode" value="'+esc(s.sourceCode||"")+'" placeholder="Số hiệu văn bản hoặc mã nội bộ"></div><div class="field"><label>Cơ quan/Đơn vị ban hành</label><input name="issuer" value="'+esc(s.issuer||"")+'"></div><div class="field"><label>Phiên bản</label><input name="version" value="'+esc(s.version||"")+'"></div><div class="field"><label>Người phụ trách quản lý nguồn</label><input name="owner" value="'+esc(s.owner||"")+'"></div><div class="field"><label>Ngày ban hành</label><input type="date" name="issueDate" value="'+esc(s.issueDate||"")+'"></div><div class="field"><label>Ngày hiệu lực</label><input type="date" name="effectiveFrom" value="'+esc(s.effectiveFrom||"")+'"></div><div class="field"><label>Ngày hết hiệu lực</label><input type="date" name="effectiveTo" value="'+esc(s.effectiveTo||"")+'"></div><div class="field"><label>Thay thế/được thay thế bởi</label><input name="supersedesRef" value="'+esc(s.supersedesRef||"")+'" placeholder="Số hiệu hoặc tham chiếu"></div></div>';
}
function applySourceMeta(src,d){
  ["sourceCode","issuer","version","owner","issueDate","effectiveFrom","effectiveTo","supersedesRef"].forEach(function(k){src[k]=d[k]||""});
}
function addTextSource(){
  if(!guard("manage_framework"))return;
  modal('<h3>Nhập nội dung nguồn tuân thủ</h3><form id="srcTextForm"><div class="field"><label>Tên nguồn</label><input name="title" required placeholder="Ví dụ: Quy chế/Quy trình/Văn bản..."></div><div class="field"><label>Loại nguồn</label><select name="sourceType"><option>Quy định nội bộ</option><option>Quy trình</option><option>Quy định nhà nước</option><option>Tiêu chuẩn</option><option>Hợp đồng/Cam kết</option></select></div>'+sourceMetaFields({})+'<div class="field"><label>Nội dung</label><textarea name="text" required style="min-height:220px" placeholder="Dán nội dung cần bóc tách nghĩa vụ..."></textarea></div><button class="btn">Bóc tách nghĩa vụ</button></form>');
  document.getElementById("srcTextForm").onsubmit=async function(ev){ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target));if(syncMode==="normalized"){try{var out=await apiCommand("source.create",{title:d.title,sourceType:d.sourceType,sourceCode:d.sourceCode||"",issuer:d.issuer||"",version:d.version||"",owner:d.owner||"",issueDate:d.issueDate||null,effectiveFrom:d.effectiveFrom||null,effectiveTo:d.effectiveTo||null,supersedesRef:d.supersedesRef||""});document.getElementById("mb")?.remove();var src={id:out.record.id,title:d.title};await extractTextSource(src,d.text)}catch(e){alert("Không tạo được nguồn: "+e.message)}return}var src={id:id("src"),title:d.title,sourceType:d.sourceType,inputMode:"text",status:"draft",createdAt:now(),excerpt:d.text.slice(0,1000)};applySourceMeta(src,d);S.sources.unshift(src);document.getElementById("mb").remove();extractTextSource(src,d.text)}
}
async function processSourceFile(src,file){
  try{
    var res=await fetch("/api/source/extract",{method:"POST",headers:{"Content-Type":file.type||"application/octet-stream","X-File-Name":encodeURIComponent(file.name),"X-Source-Id":src.id},body:file});
    var data=await res.json();
    if(syncMode==="normalized"){
      if(res.ok&&data.ok){await pullRemote();render();return}
      var status=data.ocrRequired?"needs_ocr":"error";
      try{await apiCommand("source.update",{id:src.id,status:status})}catch(e){}
      alert(data.ocrRequired?"Không đọc được lớp text; nguồn đã chuyển trạng thái Cần OCR.":data.error||"Không đọc được tệp");
      return;
    }
    if(res.ok&&data.ok){var ds=(data.obligations||[]).map(function(d){d.id=id("dr");return d});S.draftRequirements=S.draftRequirements.concat(ds);src.status="extracted";src.extractedCount=ds.length;src.excerpt=(data.text||"").slice(0,1000)}
    else{src.status=data.ocrRequired?"needs_ocr":"error";src.error=data.ocrRequired?"Không đọc được lớp text của file. Có thể là file scan/ảnh; cần OCR hoặc nhập text thay thế.":data.error||"Không đọc được tệp";}
  }catch(e){if(syncMode==="normalized"){alert("Không kết nối được bộ đọc tài liệu");return}src.status="error";src.error="Không kết nối được bộ đọc tài liệu"}
  src.updatedAt=now();save();render();
}
function addFileSource(){
  if(!guard("manage_framework"))return;
  var p=document.getElementById("sourceFile");p.value="";
  p.onchange=function(){var file=p.files&&p.files[0];if(!file)return;modal('<h3>Thông tin nguồn đính kèm</h3><form id="srcFileMeta"><div class="field"><label>Tên nguồn</label><input name="title" required value="'+esc(file.name)+'"></div><div class="field"><label>Loại nguồn</label><select name="sourceType"><option>Tệp đính kèm</option><option>Quy định nội bộ</option><option>Quy trình</option><option>Quy định nhà nước</option><option>Tiêu chuẩn</option></select></div>'+sourceMetaFields({})+'<button class="btn">Lưu & bóc tách</button></form>');document.getElementById("srcFileMeta").onsubmit=async function(ev){ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target));if(syncMode==="normalized"){try{var out=await apiCommand("source.create",{title:d.title,sourceType:d.sourceType,sourceCode:d.sourceCode||"",issuer:d.issuer||"",version:d.version||"",owner:d.owner||"",issueDate:d.issueDate||null,effectiveFrom:d.effectiveFrom||null,effectiveTo:d.effectiveTo||null,supersedesRef:d.supersedesRef||"",fileName:file.name,mimeType:file.type||""});document.getElementById("mb")?.remove();await processSourceFile({id:out.record.id,title:d.title},file)}catch(e){alert("Không tạo được nguồn: "+e.message)}return}var src={id:id("src"),title:d.title,sourceType:d.sourceType,inputMode:"file",fileName:file.name,fileType:file.type,status:"draft",createdAt:now()};applySourceMeta(src,d);S.sources.unshift(src);document.getElementById("mb").remove();save();render();processSourceFile(src,file)}};p.click();
}
function searchRegulations(){
  if(!guard("manage_framework"))return;
  modal('<h3>Tìm quy định nhà nước</h3><form id="srcSearchForm"><div class="field"><label>Từ khóa</label><input name="query" required placeholder="Ví dụ: an toàn thực phẩm, hóa chất, lao động..."></div><div class="field"><label>Ghi chú phạm vi</label><textarea name="scope" placeholder="Cơ quan ban hành, lĩnh vực, thời kỳ..."></textarea></div><div class="search-warning">Nguồn tìm kiếm pháp lý công khai chưa được cấu hình. Hệ thống sẽ lưu truy vấn và không tạo kết quả giả.</div><button class="btn">Kiểm tra nguồn tìm kiếm</button></form>');
  document.getElementById("srcSearchForm").onsubmit=async function(ev){ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target)),src={id:id("src"),title:"Tìm quy định: "+d.query,sourceType:"Quy định nhà nước",inputMode:"search",query:d.query,scope:d.scope,status:"draft",createdAt:now(),sourceCode:"",issuer:"",issueDate:"",effectiveFrom:"",effectiveTo:"",version:"",supersedesRef:"",owner:""};S.sources.unshift(src);
    try{var res=await fetch("/api/regulations/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:d.query,scope:d.scope})});var data=await res.json();src.status=res.ok?"extracted":"search_not_configured";src.error=data.message||data.error||""}catch(e){src.status="search_not_configured";src.error="Chưa kết nối nguồn tìm kiếm"}
    save();document.getElementById("mb").remove();render();
  }
}
function editSourceMetadata(sid){
  var s=S.sources.find(function(x){return x.id===sid});if(!s||!guard("manage_framework"))return;
  modal('<h3>Metadata vòng đời nguồn</h3><form id="sourceMetaEdit"><div class="field"><label>Tên nguồn</label><input name="title" required value="'+esc(s.title)+'"></div><div class="field"><label>Loại nguồn</label><input name="sourceType" value="'+esc(s.sourceType||"")+'"></div>'+sourceMetaFields(s)+'<button class="btn">Lưu metadata</button></form>');
  document.getElementById("sourceMetaEdit").onsubmit=async function(ev){ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target));if(syncMode==="normalized"){try{await apiCommand("source.update",{id:sid,title:d.title,sourceType:d.sourceType,sourceCode:d.sourceCode||"",issuer:d.issuer||"",version:d.version||"",owner:d.owner||"",issueDate:d.issueDate||null,effectiveFrom:d.effectiveFrom||null,effectiveTo:d.effectiveTo||null,supersedesRef:d.supersedesRef||""});document.getElementById("mb")?.remove();render()}catch(e){alert("Không lưu được metadata: "+e.message)}return}s.title=d.title;s.sourceType=d.sourceType;applySourceMeta(s,d);s.updatedAt=now();save();document.getElementById("mb").remove();render()}
}
function provideSourceText(sid){
  var s=S.sources.find(function(x){return x.id===sid});if(!s||!guard("manage_framework"))return;
  modal('<h3>Nhập text thay thế cho file scan</h3><form id="sourceFallbackText"><div class="field"><label>Nội dung đã OCR/đọc thủ công</label><textarea name="text" required style="min-height:240px"></textarea></div><button class="btn">Bóc tách từ nội dung này</button></form>');
  document.getElementById("sourceFallbackText").onsubmit=function(ev){ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target));s.excerpt=d.text.slice(0,1000);s.error="";document.getElementById("mb").remove();extractTextSource(s,d.text)}
}
function editDraft(did){
  var d=S.draftRequirements.find(function(x){return x.id===did});if(!d)return;
  modal('<h3>Rà soát nghĩa vụ</h3><form id="draftEdit"><div class="field"><label>Nghĩa vụ tuân thủ</label><textarea name="obligation" required>'+esc(d.obligation)+'</textarea></div><div class="field"><label>Điều/Khoản/Mục nguồn</label><input name="sourceClause" value="'+esc(d.sourceClause||"")+'"></div><div class="field"><label>Đối tượng/phạm vi áp dụng</label><input name="applicability" value="'+esc(d.applicability||"")+'"></div><div class="field"><label>Loại nghĩa vụ</label><input name="obligationType" value="'+esc(d.obligationType||"general")+'"></div><div class="field"><label>Bằng chứng kỳ vọng</label><textarea name="expectedEvidence">'+esc(d.expectedEvidence||"")+'</textarea></div><div class="field"><label>Thủ tục kiểm tra</label><textarea name="testProcedure">'+esc(d.testProcedure||"")+'</textarea></div><button class="btn">Lưu rà soát</button></form>');
  document.getElementById("draftEdit").onsubmit=async function(ev){ev.preventDefault();var x=Object.fromEntries(new FormData(ev.target));if(syncMode==="normalized"){try{await apiCommand("draftRequirement.update",Object.assign({id:did},x));document.getElementById("mb")?.remove();render()}catch(e){alert("Không lưu được nghĩa vụ: "+e.message)}return}Object.assign(d,x);document.getElementById("mb").remove();save();render()}
}
function nextRequirementCode(fw,offset){
  var prefix=String(fw.code||"YC").toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"")||"YC";
  var nums=S.requirements.filter(function(r){return r.frameworkId===fw.id}).map(function(r){var m=String(r.code||"").match(/-(\d+)$/);return m?Number(m[1]):0});
  var n=(nums.length?Math.max.apply(null,nums):0)+1+(offset||0);
  return prefix+"-"+String(n).padStart(3,"0");
}
function publishDrafts(){
  if(!guard("manage_framework"))return;
  var fwId=document.getElementById("publishFw")&&document.getElementById("publishFw").value,fw=S.frameworks.find(function(x){return x.id===fwId}),ds=S.draftRequirements.filter(function(d){return d.reviewStatus==="accepted"});
  if(!fw||!ds.length){modal('<h3>Chưa thể gửi duyệt</h3><p>Cần có ít nhất một nghĩa vụ đã <b>Chấp nhận</b> và chọn Khung đích.</p>');return}
  if(syncMode==="normalized"){
    apiCommand("draftRequirement.publishBatch",{frameworkId:fwId,ids:ds.map(function(d){return d.id})}).then(function(){render()}).catch(function(e){alert("Không gửi duyệt được: "+e.message)});return;
  }
  ds.forEach(function(d,i){var req={id:id("r"),frameworkId:fw.id,code:nextRequirementCode(fw,i),title:d.obligation,description:d.originalText||"",assessable:true,test:d.testProcedure||"Cần xác định",expected:d.expectedEvidence||"Cần xác định",sourceId:d.sourceId,sourceClause:d.sourceClause||"",applicability:d.applicability||"",obligationType:d.obligationType||"general",mandatoryLevel:d.mandatoryLevel||"review",status:"pending_approval"};S.requirements.push(req);fw.reqIds.push(req.id);d.reviewStatus="published"});
  S.sources.forEach(function(s){var own=S.draftRequirements.filter(function(d){return d.sourceId===s.id});if(own.length&&own.every(function(d){return d.reviewStatus==="published"||d.reviewStatus==="rejected"}))s.status="pending_approval"});
  save();render();
}
function approveRequirement(rid){
  if(!guard("approve_framework"))return;
  if(syncMode==="normalized"){apiCommand("requirement.approve",{requirementId:rid,approve:true}).then(render).catch(function(e){alert("Không duyệt được yêu cầu: "+e.message)});return}
  var r=S.requirements.find(function(x){return x.id===rid});if(!r)return;
  r.status="effective";r.approvedBy=ComplianceAccess.current().role;r.approvedAt=now();
  var fw=S.frameworks.find(function(f){return f.reqIds.indexOf(rid)>=0});
  if(fw&&fw.reqIds.every(function(id){var q=S.requirements.find(function(x){return x.id===id});return !q||q.status!=="pending_approval"}))fw.status="effective";
  if(r.sourceId){var src=S.sources.find(function(s){return s.id===r.sourceId});if(src){var related=S.requirements.filter(function(q){return q.sourceId===src.id});if(related.length&&related.every(function(q){return q.status==="effective"||q.status==="rejected"}))src.status="published"}}
  S.logs.push({id:id("log"),type:"approve_requirement",object:"Yêu cầu tuân thủ",at:now(),note:r.code||r.title});save();render();
}
function rejectRequirement(rid){
  if(!guard("approve_framework"))return;
  if(syncMode==="normalized"){apiCommand("requirement.approve",{requirementId:rid,approve:false}).then(render).catch(function(e){alert("Không từ chối được yêu cầu: "+e.message)});return}
  var r=S.requirements.find(function(x){return x.id===rid});if(!r)return;
  r.status="rejected";r.approvedBy=ComplianceAccess.current().role;r.approvedAt=now();
  S.logs.push({id:id("log"),type:"reject_requirement",object:"Yêu cầu tuân thủ",at:now(),note:r.code||r.title});save();render();
}
function bulkDraft(status){
  if(!guard("manage_framework"))return;
  var ids=Array.from(document.querySelectorAll(".draftCheck:checked")).map(function(x){return x.value});
  if(!ids.length){modal('<h3>Chưa chọn nghĩa vụ</h3><p>Chọn ít nhất một nghĩa vụ để xử lý hàng loạt.</p>');return}
  if(syncMode==="normalized"){apiCommand("draftRequirement.reviewBatch",{ids:ids,status:status}).then(render).catch(function(e){alert("Không cập nhật được nghĩa vụ: "+e.message)});return}
  S.draftRequirements.forEach(function(d){if(ids.indexOf(d.id)>=0)d.reviewStatus=status});save();render();
}
function frameworks(){return shell("Nguồn quy định & Khung tuân thủ",Screens.frameworks(screenContext()))}

function requirementApplies(q,ctx){
  if(!q||q.assessable===false||q.status==="rejected"||q.status==="pending_approval")return false;
  var raw=(q.applicability||"").trim().toLowerCase();
  if(!raw)return true;
  var org=S.org.find(function(x){return x.id===ctx.orgId});
  var hay=[org&&org.name,ctx.processRef,ctx.activityRef,ctx.locationRef].filter(Boolean).join(" ").toLowerCase();
  var tokens=raw.split(/[,;|]/).map(function(x){return x.trim()}).filter(Boolean);
  return tokens.some(function(t){return hay.indexOf(t)>=0});
}
function applicableRequirements(fw,ctx){
  return fw.reqIds.map(function(rid){return S.requirements.find(function(x){return x.id===rid})})
    .filter(function(q){return requirementApplies(q,ctx)});
}
function assessments(){return shell("Chương trình đánh giá",Screens.assessments(screenContext()))}

function setRequirementResult(){
  var ra=S.ra.find(function(x){return x.id===selectedRA}),a=S.assessments.find(function(x){return x.id===selectedAssessment});if(!ra||!guard("conduct_fieldwork",a))return;
  modal('<h3>Ghi nhận kết quả Yêu cầu tuân thủ</h3><form id="resultForm"><div class="field"><label>Kết quả</label><select name="result"><option value="compliant" '+(ra.result==="compliant"?"selected":"")+'>Tuân thủ</option><option value="partially_compliant" '+(ra.result==="partially_compliant"?"selected":"")+'>Tuân thủ một phần</option><option value="non_compliant" '+(ra.result==="non_compliant"?"selected":"")+'>Không tuân thủ</option><option value="not_applicable" '+(ra.result==="not_applicable"?"selected":"")+'>Không áp dụng</option><option value="insufficient_evidence" '+(ra.result==="insufficient_evidence"?"selected":"")+'>Chưa đủ bằng chứng</option></select></div><div class="field"><label>Ghi nhận/quan sát</label><textarea name="observation" required>'+esc(ra.observation||"")+'</textarea></div><div class="note"><b>Quy tắc:</b> Tuân thủ/Không áp dụng có thể hoàn tất ngay. Tuân thủ một phần/Không tuân thủ chuyển sang rà soát và nên có Phát hiện dự thảo. Chưa đủ bằng chứng vẫn ở trạng thái rà soát.</div><button class="btn">Lưu kết quả</button></form>');
  document.getElementById("resultForm").onsubmit=async function(ev){ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target)),workflow=(d.result==="compliant"||d.result==="not_applicable")?"done":"in_review";if(syncMode==="normalized"){try{await apiCommand("requirementAssessment.update",{id:ra.id,assessmentId:selectedAssessment,result:d.result,observation:d.observation,workflow:workflow});document.getElementById("mb")?.remove();render()}catch(e){alert("Không lưu được kết quả: "+e.message)}return}ra.result=d.result;ra.observation=d.observation;ra.assessedAt=now();ra.assessedBy=ComplianceAccess.current().role;ra.workflow=workflow;S.logs.push({id:id("log"),type:"requirement_result",object:"Yêu cầu tuân thủ",at:now(),note:lab(d.result)});save();document.getElementById("mb").remove();render()}
}

function fieldwork(){return shell("Kiểm tra hiện trường",Screens.fieldwork(screenContext()))}

function findings(){return shell("Phát hiện tuân thủ",Screens.findings(screenContext()))}

function actionEvidenceCount(aid){return S.links.filter(function(l){return l.targetType==="RemediationAction"&&l.targetId===aid}).length}
function canUpdateAction(a){return ComplianceAccess.current().id===a.ownerPersonaId||can("assign_action")||can("update_assigned_action")}
function uploadActionEvidence(aid){
  var a=S.actions.find(function(x){return x.id===aid});if(!a||!canUpdateAction(a)){modal('<h3>Không đủ quyền</h3><p>Chỉ người phụ trách hành động hoặc vai trò quản lý được nộp bằng chứng hoàn thành.</p>');return}
  var p=document.getElementById("actionEvidence");p.value="";
  p.onchange=async function(){for(const file of Array.from(p.files)){var stored=await storeEvidenceFile(file),ev={id:id("ev"),name:file.name,type:file.type||"file",storage:stored.storage},rv={id:id("rv"),evidenceId:ev.id,version:1,size:file.size,mime:file.type,capturedAt:now(),fileUri:stored.fileUri||null,downloadUrl:stored.downloadUrl||null},ln={id:id("ln"),revId:rv.id,targetId:aid,targetType:"RemediationAction",purpose:"closure_evidence"};S.evidence.push(ev);S.revisions.push(rv);S.links.push(ln);a.closureEvidenceIds=a.closureEvidenceIds||[];a.closureEvidenceIds.push(ev.id)}a.status="submitted_for_verification";a.closureSubmittedAt=now();S.logs.push({id:id("log"),type:"submit_action_closure",object:"Hành động",at:now(),note:a.text});save();render()};p.click();
}
function actions(){return shell("Theo dõi khắc phục",Screens.actions(screenContext()))}

function reports(){return shell("Báo cáo & giám sát",Screens.reports(screenContext()))}

async function openUserManagement(){
  if(!currentUser||currentUser.role!=="compliance_admin"){modal('<h3>Không đủ quyền</h3><p>Chỉ Quản trị Tuân thủ đã đăng nhập mới được cấp quyền thành viên.</p>');return}
  modal('<h3>Thành viên nội bộ</h3><div id="userAdminBody"><div class="small muted">Đang tải...</div></div>');
  try{
    var res=await fetch("/api/admin/users",{headers:{"Accept":"application/json"}}),data=await res.json();
    if(!res.ok)throw new Error(data.error||"LOAD_FAILED");
    var roles=Object.keys(ComplianceAccess.roles);
    document.getElementById("userAdminBody").innerHTML=
      '<form id="inviteUserForm"><div class="split"><div class="field"><label>Email</label><input type="email" name="email" required placeholder="user@company.com"></div><div class="field"><label>Vai trò</label><select name="role">'+roles.map(function(r){return'<option value="'+r+'">'+esc(ComplianceAccess.roles[r].label)+'</option>'}).join("")+'</select></div></div><div class="field"><label>Phạm vi đơn vị</label><select name="orgIds" multiple size="5">'+S.org.map(function(o){return'<option value="'+o.id+'">'+esc(o.name)+'</option>'}).join("")+'<option value="*">Toàn bộ</option></select><div class="small muted">Giữ Ctrl/Cmd để chọn nhiều đơn vị.</div></div><button class="btn">Cấp quyền email</button></form>'+
      '<h3 style="margin-top:18px">Người dùng hiện có</h3><div class="table"><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Phạm vi</th><th>Lần đăng nhập cuối</th></tr></thead><tbody>'+data.users.map(function(u){return'<tr><td><b>'+esc(u.name||u.email)+'</b><div class="small muted">'+esc(u.email)+'</div></td><td>'+esc((ComplianceAccess.roles[u.role]&&ComplianceAccess.roles[u.role].label)||u.role)+'</td><td>'+esc((u.orgIds||[]).join(", ")||"—")+'</td><td>'+esc(u.lastSignInAt?new Date(u.lastSignInAt).toLocaleString("vi-VN"):"Chưa đăng nhập")+'</td></tr>'}).join("")+'</tbody></table></div>';
    document.getElementById("inviteUserForm").onsubmit=async function(ev){
      ev.preventDefault();var fd=new FormData(ev.target),orgs=Array.from(ev.target.elements.orgIds.selectedOptions).map(function(o){return o.value});
      var payload={email:fd.get("email"),role:fd.get("role"),orgIds:orgs};
      var rr=await fetch("/api/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),dd=await rr.json();
      if(!rr.ok){alert("Không cấp được quyền: "+(dd.error||"Lỗi"));return}
      alert("Đã cấp quyền cho "+payload.email+". Người dùng tự đăng ký/đăng nhập bằng đúng email này.");document.getElementById("mb")?.remove();openUserManagement();
    };
  }catch(e){document.getElementById("userAdminBody").innerHTML='<div class="fail">Không tải được danh sách người dùng.</div><div class="small muted">'+esc(String(e.message||e))+'</div>'}
}
function settings(){return shell("Cấu hình vận hành",Screens.settings(screenContext()))}
function modal(body){document.body.insertAdjacentHTML("beforeend",'<div class="modalbg" id="mb"><div class="modal">'+body+'<div class="row" style="margin-top:14px"><button class="btn alt right" data-act="close">Đóng</button></div></div></div>');bind()}
function qa(){var e=[];S.ra.forEach(function(r){if(!S.assessments.some(function(a){return a.id===r.assessmentId}))e.push("Bản ghi đánh giá yêu cầu thiếu Cuộc đánh giá");if(!S.requirements.some(function(q){return q.id===r.requirementId}))e.push("Bản ghi đánh giá yêu cầu thiếu Yêu cầu tuân thủ")});S.revisions.forEach(function(r){if(!S.evidence.some(function(e){return e.id===r.evidenceId}))e.push("Phiên bản bằng chứng thiếu Bằng chứng gốc")});S.findings.forEach(function(f){if(!S.ra.some(function(r){return r.id===f.raId}))e.push("Phát hiện thiếu bản ghi đánh giá Yêu cầu tuân thủ")});modal("<h3>QA Check</h3>"+(e.length?'<div class="fail">FAIL · '+e.length+" lỗi</div><ul>"+e.map(function(x){return"<li>"+esc(x)+"</li>"}).join("")+"</ul>":'<div class="pass">PASS · Không phát hiện lỗi toàn vẹn dữ liệu lõi.</div><p class="small muted">Đã kiểm tra liên kết Cuộc đánh giá – Yêu cầu tuân thủ, Bằng chứng – Phiên bản và Phát hiện – Kết quả đánh giá.</p>'))}
function newfw(){modal('<h3>Tạo khung tuân thủ thủ công</h3><form id="f"><div class="field"><label>Tên khung</label><input name="name" required></div><div class="field"><label>Mã</label><input name="code" required></div><div class="field"><label>Cơ sở/diễn giải nội bộ</label><textarea name="basis" required placeholder="Nêu nguồn hoặc cơ sở hình thành các yêu cầu thủ công"></textarea></div><div class="field"><label>Các điểm phải tuân thủ</label><textarea name="req" placeholder="Mỗi dòng là một yêu cầu" required></textarea></div><button class="btn">Tạo & gửi duyệt</button></form>');document.getElementById("f").onsubmit=async function(ev){ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target)),items=d.req.split("\n").map(function(x){return x.trim()}).filter(Boolean);if(syncMode==="normalized"){try{await apiCommand("framework.createManual",{name:d.name,code:d.code,basis:d.basis,requirements:items});document.getElementById("mb")?.remove();render()}catch(e){alert("Không tạo được khung: "+e.message)}return}var fid=id("fw"),sid=id("src"),src={id:sid,title:"Manual/Internal Interpretation · "+d.name,sourceType:"Manual/Internal Interpretation",inputMode:"manual",status:"pending_approval",createdAt:now(),excerpt:d.basis};S.sources.unshift(src);var rr=items.map(function(t,i){return{id:id("r"),frameworkId:fid,code:(d.code||"FW")+"-"+String(i+1).padStart(2,"0"),title:t,description:d.basis,assessable:true,test:"Cần xác định",expected:"Cần xác định",sourceId:sid,status:"pending_approval"}});S.requirements=S.requirements.concat(rr);S.frameworks.push({id:fid,code:d.code||fid,name:d.name,version:"0.1",status:"pending_approval",reqIds:rr.map(function(x){return x.id})});save();document.getElementById("mb").remove();render()}}
function newas(){modal('<h3>Tạo đánh giá tuân thủ</h3><form id="f"><div class="field"><label>Tên cuộc đánh giá</label><input name="name" required></div><div class="field"><label>Khung tuân thủ</label><select name="fw">'+S.frameworks.map(function(f){return'<option value="'+f.id+'">'+esc(f.name)+"</option>"}).join("")+'</select></div><div class="field"><label>Đơn vị được đánh giá</label><select name="org">'+S.org.map(function(u){return'<option value="'+u.id+'">'+esc(u.name)+"</option>"}).join("")+'</select></div><div class="split"><div class="field"><label>Quy trình</label><input name="processRef" placeholder="Ví dụ: Mua hàng"></div><div class="field"><label>Hoạt động</label><input name="activityRef" placeholder="Ví dụ: Lựa chọn NCC"></div><div class="field"><label>Địa điểm</label><input name="locationRef" placeholder="Ví dụ: Tây Ninh"></div><div class="field"><label>Mục tiêu</label><input name="objective" placeholder="Mục tiêu đánh giá"></div></div><div class="split"><div class="field"><label>Từ ngày</label><input type="date" name="periodFrom"></div><div class="field"><label>Đến ngày</label><input type="date" name="periodTo"></div><div class="field"><label>Trưởng đoàn</label><input name="leadAssessor"></div><div class="field"><label>Người rà soát</label><input name="reviewer"></div></div><div class="field"><label>Đại diện đơn vị được đánh giá</label><input name="unitRepresentative"></div><div class="note"><b>Quy tắc phạm vi:</b> hệ thống tự xác định Yêu cầu tuân thủ theo phạm vi áp dụng của Khung đối với Đơn vị + Quy trình + Hoạt động + Địa điểm. Yêu cầu tuân thủ không có phạm vi áp dụng cụ thể được hiểu là áp dụng chung.</div><button class="btn">Tạo đánh giá</button></form>');document.getElementById("f").onsubmit=async function(ev){ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target)),fw=S.frameworks.find(function(x){return x.id===d.fw}),ctx={orgId:d.org,processRef:d.processRef||"",activityRef:d.activityRef||"",locationRef:d.locationRef||""},reqs=applicableRequirements(fw,ctx);if(syncMode==="normalized"){try{var out=await apiCommand("assessment.create",{name:d.name,frameworkId:d.fw,orgId:d.org,objective:d.objective||"",processRef:ctx.processRef,activityRef:ctx.activityRef,locationRef:ctx.locationRef,periodFrom:d.periodFrom||null,periodTo:d.periodTo||null,leadAssessor:d.leadAssessor||"",reviewer:d.reviewer||"",unitRepresentative:d.unitRepresentative||"",requirementIds:reqs.map(function(q){return q.id})});document.getElementById("mb")?.remove();selectedAssessment=out.record.id;selectedRA=null;view="assessments";render()}catch(e){alert("Không tạo được cuộc đánh giá: "+e.message)}return}var aid=id("as"),a={id:aid,name:d.name,frameworkId:d.fw,orgId:d.org,objective:d.objective||"",processRef:ctx.processRef,activityRef:ctx.activityRef,locationRef:ctx.locationRef,periodFrom:d.periodFrom||"",periodTo:d.periodTo||"",leadAssessor:d.leadAssessor||"",reviewer:d.reviewer||"",unitRepresentative:d.unitRepresentative||"",status:"draft",locked:false,scopeRule:"auto_applicability"};S.assessments.push(a);reqs.forEach(function(q){S.ra.push({id:id("ra"),assessmentId:aid,requirementId:q.id,workflow:"to_do",result:"not_assessed",evidenceIds:[]})});S.logs.push({id:id("log"),type:"create_assessment",object:"Assessment",at:now(),note:d.name+" · "+reqs.length+" requirements"});save();document.getElementById("mb").remove();selectedAssessment=aid;selectedRA=null;view="assessments";render()}}
function assessmentLocalGate(aid){
  var ras=S.ra.filter(function(r){return r.assessmentId===aid});
  var done=ras.filter(function(r){return r.workflow==="done"&&r.result!=="not_assessed"}).length;
  var scoped=S.findings.filter(function(f){var r=S.ra.find(function(x){return x.id===f.raId});return r&&r.assessmentId===aid});
  var pending=scoped.filter(function(f){return["draft","pending_unit_response","pending_final_review"].includes(f.status)}).length;
  var missingMandatory=scoped.filter(function(f){return f.status==="final"&&f.remediationRequired&&!S.actions.some(function(x){return x.findingId===f.id&&x.actionType==="mandatory_remediation"})}).length;
  var unassigned=ras.filter(function(r){return!(S.requirementAssignments||[]).some(function(x){return x.raId===r.id&&x.assignmentRole==="primary_assessor"&&x.status==="active"})}).length;
  return{total:ras.length,done:done,pendingFindings:pending,mandatoryFindingsWithoutAction:missingMandatory,unassignedRequirements:unassigned};
}
async function startAssessment(aid){
  var a=S.assessments.find(function(x){return x.id===aid});if(!a)return;
  try{
    if(syncMode==="normalized"){
      await apiCommand("assessment.startFieldwork",{assessmentId:aid});
    }else{
      var g=assessmentLocalGate(aid);if(a.status!=="draft"||g.total<1)throw new Error("ASSESSMENT_REQUIREMENTS_REQUIRED");
      if(g.unassignedRequirements>0)throw new Error("ASSESSMENT_ASSIGNMENTS_INCOMPLETE");
      a.status="fieldwork";a.lockedAt=now();S.logs.push({id:id("log"),type:"start_fieldwork",object:"Assessment",at:now(),note:a.name+" · scope frozen"});save();
    }
    selectedAssessment=aid;selectedRA=null;view="fieldwork";render();
  }catch(e){alert("Không bắt đầu được đánh giá: "+e.message)}
}
async function submitAssessmentReview(aid){
  var a=S.assessments.find(function(x){return x.id===aid});if(!a)return;
  try{
    if(syncMode==="normalized"){
      await apiCommand("assessment.submitForReview",{assessmentId:aid});
    }else{
      var g=assessmentLocalGate(aid);
      if(a.status!=="fieldwork")throw new Error("ASSESSMENT_NOT_IN_FIELDWORK");
      if(g.total<1||g.done!==g.total)throw new Error("ASSESSMENT_REQUIREMENTS_INCOMPLETE");
      if(g.pendingFindings>0)throw new Error("ASSESSMENT_FINDINGS_PENDING");
      if(g.mandatoryFindingsWithoutAction>0)throw new Error("MANDATORY_REMEDIATION_ACTION_REQUIRED");
      a.status="review";S.logs.push({id:id("log"),type:"submit_for_review",object:"Assessment",at:now(),note:a.name});save();
    }
    view="assessments";render();
  }catch(e){alert("Chưa thể gửi rà soát: "+e.message)}
}
function closeAssessment(aid){
  var a=S.assessments.find(function(x){return x.id===aid});if(!a)return;
  modal('<h3>Đóng cuộc đánh giá</h3><p>Đóng assessment xác nhận kết quả đánh giá đã được rà soát. Các hành động khắc phục còn mở vẫn tiếp tục được theo dõi sau khi assessment đóng.</p><form id="closeAssessmentForm"><div class="field"><label>Ghi chú rà soát/đóng</label><textarea name="note" placeholder="Nhận xét của người rà soát (nếu có)"></textarea></div><button class="btn">Xác nhận đóng</button></form>');
  document.getElementById("closeAssessmentForm").onsubmit=async function(ev){
    ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target));
    try{
      if(syncMode==="normalized"){
        await apiCommand("assessment.close",{assessmentId:aid,note:d.note||null});
      }else{
        var g=assessmentLocalGate(aid);
        if(a.status!=="review")throw new Error("ASSESSMENT_NOT_IN_REVIEW");
        if(g.total<1||g.done!==g.total)throw new Error("ASSESSMENT_REQUIREMENTS_INCOMPLETE");
        if(g.pendingFindings>0)throw new Error("ASSESSMENT_FINDINGS_PENDING");
        if(g.mandatoryFindingsWithoutAction>0)throw new Error("MANDATORY_REMEDIATION_ACTION_REQUIRED");
        a.status="closed";S.logs.push({id:id("log"),type:"close_assessment",object:"Assessment",at:now(),note:d.note||a.name});save();
      }
      document.getElementById("mb")?.remove();view="assessments";render();
    }catch(e){alert("Chưa thể đóng đánh giá: "+e.message)}
  }
}

async function storeEvidenceFile(f,targetType,targetId,purpose){
  try{
    var cfg=await fetch("/api/evidence",{headers:{"Accept":"application/json"}}).then(function(r){return r.json()});
    if(!cfg.configured||!cfg.authConfigured)return{storage:"local-metadata"};
    var headers={"Content-Type":f.type||"application/octet-stream","X-File-Name":encodeURIComponent(f.name)};
    if(syncMode==="normalized"){headers["X-Target-Type"]=targetType||"RequirementAssessment";headers["X-Target-Id"]=targetId||selectedRA;headers["X-Evidence-Purpose"]=purpose||"supporting_evidence"}
    var res=await fetch("/api/evidence",{method:"POST",headers:headers,body:f});
    var data=await res.json();
    if(res.ok&&data.ok)return{storage:"blob-private",fileUri:data.url,downloadUrl:data.downloadUrl||null,normalizedRecord:data.normalizedRecord||null};
    throw new Error(data.error||"EVIDENCE_UPLOAD_FAILED");
  }catch(e){if(syncMode==="normalized")throw e}
  return{storage:"local-metadata"};
}
function upload(){
  var a=S.assessments.find(function(x){return x.id===selectedAssessment});
  if(!guard("conduct_fieldwork",a))return;
  var p=document.getElementById("files");p.value="";
  p.onchange=async function(){
    try{
      for(const f of Array.from(p.files)){
        var stored=await storeEvidenceFile(f,"RequirementAssessment",selectedRA,"supporting_evidence");
        if(syncMode==="normalized")continue;
        var ev={id:id("ev"),name:f.name,type:f.type||"file",storage:stored.storage},
            rv={id:id("rv"),evidenceId:ev.id,version:1,size:f.size,mime:f.type,capturedAt:now(),fileUri:stored.fileUri||null,downloadUrl:stored.downloadUrl||null},
            ln={id:id("ln"),revId:rv.id,targetId:selectedRA,targetType:"RequirementAssessment"};
        S.evidence.push(ev);S.revisions.push(rv);S.links.push(ln);
        var ra=S.ra.find(function(x){return x.id===selectedRA});if(ra)ra.evidenceIds.push(ev.id);
      }
      if(syncMode==="normalized")await pullRemote();else save();
      render();
    }catch(e){alert("Không upload được bằng chứng: "+e.message)}
  };
  p.click();
}
function analyze(){var ra=S.ra.find(function(x){return x.id===selectedRA}),q=ra&&S.requirements.find(function(x){return x.id===ra.requirementId}),txt=(document.getElementById("obs").value||"").toLowerCase(),neg=["không","thiếu","chưa","sai","quá hạn"].some(function(k){return txt.indexOf(k)>=0}),p={id:id("p"),raId:selectedRA,assessmentId:selectedAssessment,requirementId:q.id,result:neg?"non_compliant":"insufficient_evidence",text:neg?"Có dấu hiệu không tuân thủ liên quan "+q.code+". Cần người kiểm tra xác nhận.":"Chưa đủ căn cứ để kết luận; cần bổ sung hoặc đối chiếu bằng chứng.",status:"proposed",at:now()};S.proposals.push(p);save();render()}
function finding(){var ra=S.ra.find(function(x){return x.id===selectedRA}),q=ra&&S.requirements.find(function(x){return x.id===ra.requirementId});modal('<h3>Tạo Phát hiện dự thảo</h3><form id="f"><div class="field"><label>Tiêu đề</label><input name="title" value="Dấu hiệu không tuân thủ '+esc(q.code)+'" required></div><div class="field"><label>Dữ kiện</label><textarea name="fact" required></textarea></div><div class="field"><label>Tiêu chí</label><textarea name="criteria" required>'+esc(q.title)+'</textarea></div><div class="field"><label>Khoảng cách/vi phạm dự kiến</label><textarea name="gap" required></textarea></div><div class="field"><label>Rủi ro/Tác động</label><textarea name="impact"></textarea></div><div class="field"><label>Khuyến nghị dự thảo</label><textarea name="rec"></textarea></div><div class="field"><label>Mức độ dự kiến</label><select name="severity"><option>low</option><option selected>medium</option><option>high</option><option>critical</option></select></div><button class="btn red">Gửi Phát hiện dự thảo để phản hồi</button></form>');document.getElementById("f").onsubmit=async function(ev){ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target));if(syncMode==="normalized"){try{await apiCommand("finding.create",{assessmentId:selectedAssessment,raId:selectedRA,title:d.title,fact:d.fact,criteria:d.criteria,gap:d.gap,impact:d.impact||"",rec:d.rec||"",severity:d.severity});document.getElementById("mb")?.remove();view="findings";render()}catch(e){alert("Không tạo được phát hiện: "+e.message)}return}d.id=id("fd");d.raId=selectedRA;d.status="pending_unit_response";d.createdBy=ComplianceAccess.current().role;d.createdAt=now();S.findings.push(d);ra.workflow="in_review";S.logs.push({id:id("log"),type:"draft_finding",object:"Finding",at:now(),note:d.title});save();document.getElementById("mb").remove();view="findings";render()}}

function respond(fid){
  var f=S.findings.find(function(x){return x.id===fid}),a=f&&findingAssessment(f);
  if(!guard("respond_finding",a))return;
  modal('<h3>Phản hồi phát hiện</h3><form id="f"><div class="field"><label>Loại phản hồi</label><select name="type"><option>Đồng ý</option><option>Không đồng ý</option><option>Bổ sung bằng chứng</option><option>Đề xuất kế hoạch xử lý</option></select></div><div class="field"><label>Nội dung</label><textarea name="text" required></textarea></div><button class="btn">Gửi phản hồi</button></form>');
  document.getElementById("f").onsubmit=async function(ev){ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target));if(syncMode==="normalized"){try{await apiCommand("finding.respond",{findingId:fid,type:d.type,text:d.text});document.getElementById("mb")?.remove();render()}catch(e){alert("Không gửi được phản hồi: "+e.message)}return}S.responses.push({id:id("resp"),findingId:fid,type:d.type,text:d.text,at:now(),persona:ComplianceAccess.current().role});f.status="pending_final_review";S.logs.push({id:id("log"),type:"unit_response",object:"Finding",at:now(),note:d.type});save();document.getElementById("mb").remove();render()}
}

function finalizeFinding(fid){
  var f=S.findings.find(function(x){return x.id===fid}),a0=f&&findingAssessment(f);if(!f||!guard("confirm_finding",a0))return;
  var ra=S.ra.find(function(x){return x.id===f.raId});
  modal('<h3>Chốt Phát hiện sau phản hồi</h3><form id="finalFindingForm"><div class="field"><label>Cách xử lý sau phản hồi</label><select name="disposition"><option value="keep">Giữ nguyên</option><option value="adjust">Điều chỉnh</option><option value="dismiss">Hủy Phát hiện dự thảo</option></select></div><div class="field"><label>Kết quả tuân thủ cuối</label><select name="result"><option value="non_compliant">Không tuân thủ</option><option value="partially_compliant">Tuân thủ một phần</option><option value="compliant">Tuân thủ</option><option value="not_applicable">Không áp dụng</option><option value="insufficient_evidence">Chưa đủ bằng chứng</option></select></div><div class="field"><label>Tiêu đề cuối</label><input name="title" value="'+esc(f.title)+'"></div><div class="field"><label>Khoảng cách/vi phạm cuối</label><textarea name="gap">'+esc(f.gap||"")+'</textarea></div><div class="field"><label>Khuyến nghị cải thiện</label><textarea name="rec" placeholder="Khuyến nghị mang tính cải thiện; không mặc định là hành động bắt buộc">'+esc(f.rec||"")+'</textarea></div><div class="field"><label><input type="checkbox" name="remediationRequired" id="remediationRequired" '+(f.remediationRequired?"checked":"")+'> Yêu cầu khắc phục bắt buộc</label></div><div class="field" id="remediationRequirementWrap"><label>Yêu cầu khắc phục bắt buộc</label><textarea name="remediationRequirement" placeholder="Mô tả kết quả/hành động bắt buộc đơn vị phải thực hiện">'+esc(f.remediationRequirement||"")+'</textarea></div><div class="note">Khuyến nghị và yêu cầu khắc phục là hai lớp khác nhau. Chỉ Finding được đánh dấu <b>Yêu cầu khắc phục bắt buộc</b> mới bắt buộc có action trước khi gửi rà soát/đóng assessment.</div><div class="field"><label>Nhận định sau phản hồi</label><textarea name="dispositionNote" required></textarea></div><button class="btn">Chốt kết quả</button></form>');
  var rem=document.getElementById("remediationRequired"),wrap=document.getElementById("remediationRequirementWrap");function syncRem(){if(wrap)wrap.style.display=rem&&rem.checked?"block":"none"}if(rem){rem.onchange=syncRem;syncRem()}
  document.getElementById("finalFindingForm").onsubmit=async function(ev){ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target)),required=Boolean(rem&&rem.checked),remediation=String(d.remediationRequirement||"").trim();if(required&&!remediation){alert("Cần nhập Yêu cầu khắc phục bắt buộc.");return}if(syncMode==="normalized"){try{await apiCommand("finding.finalize",{findingId:fid,disposition:d.disposition,result:d.result,title:d.title,gap:d.gap,rec:d.rec,remediationRequired:required,remediationRequirement:remediation,dispositionNote:d.dispositionNote});document.getElementById("mb")?.remove();render()}catch(e){alert("Không chốt được phát hiện: "+e.message)}return}f.disposition=d.disposition;f.dispositionNote=d.dispositionNote;f.finalizedBy=ComplianceAccess.current().role;f.finalizedAt=now();f.title=d.title;f.gap=d.gap;f.rec=d.rec;f.remediationRequired=d.disposition==="dismiss"?false:required;f.remediationRequirement=f.remediationRequired?remediation:"";if(d.disposition==="dismiss"){f.status="dismissed"}else{f.status="final"}ra.result=d.result;ra.workflow="done";S.logs.push({id:id("log"),type:"finalize_finding",object:"Finding",at:now(),note:f.title+" · "+d.disposition+(f.remediationRequired?" · mandatory remediation":"")});save();document.getElementById("mb").remove();render()}
}

function actionEvidenceCount(aid){return S.links.filter(function(l){return l.targetType==="RemediationAction"&&l.targetId===aid}).length}
function canUpdateAction(a){return ComplianceAccess.current().id===a.ownerPersonaId||can("assign_action")||can("update_assigned_action")}
function uploadActionEvidence(aid){
  var a=S.actions.find(function(x){return x.id===aid});if(!a||!canUpdateAction(a)){modal('<h3>Không đủ quyền</h3><p>Chỉ người phụ trách hành động hoặc vai trò quản lý được nộp bằng chứng hoàn thành.</p>');return}
  var p=document.getElementById("actionEvidence");p.value="";
  p.onchange=async function(){try{for(const file of Array.from(p.files)){var stored=await storeEvidenceFile(file,"RemediationAction",aid,"closure_evidence");if(syncMode==="normalized")continue;var ev={id:id("ev"),name:file.name,type:file.type||"file",storage:stored.storage},rv={id:id("rv"),evidenceId:ev.id,version:1,size:file.size,mime:file.type,capturedAt:now(),fileUri:stored.fileUri||null,downloadUrl:stored.downloadUrl||null},ln={id:id("ln"),revId:rv.id,targetId:aid,targetType:"RemediationAction",purpose:"closure_evidence"};S.evidence.push(ev);S.revisions.push(rv);S.links.push(ln);a.closureEvidenceIds=a.closureEvidenceIds||[];a.closureEvidenceIds.push(ev.id)}if(syncMode==="normalized"){await apiCommand("action.submitForVerification",{actionId:aid});render();return}a.status="submitted_for_verification";a.closureSubmittedAt=now();S.logs.push({id:id("log"),type:"submit_action_closure",object:"Hành động",at:now(),note:a.text});save();render()}catch(e){alert("Không nộp được bằng chứng hoàn thành: "+e.message)}};p.click();
}

function bind(){
  document.querySelectorAll("[data-nav]").forEach(function(b){b.onclick=function(){if(ComplianceAccess.viewAllowed(b.dataset.nav)){view=b.dataset.nav;render()}}});
  document.querySelectorAll("[data-source-mode]").forEach(function(b){b.onclick=function(){sourceMode=b.dataset.sourceMode;render()}});
  document.querySelectorAll("[data-draft-accept]").forEach(function(b){b.onclick=function(){var d=S.draftRequirements.find(function(x){return x.id===b.dataset.draftAccept});if(!d)return;if(syncMode==="normalized"){apiCommand("draftRequirement.reviewBatch",{ids:[d.id],status:"accepted"}).then(render).catch(function(e){alert("Không cập nhật được nghĩa vụ: "+e.message)});return}d.reviewStatus="accepted";save();render()}});
  document.querySelectorAll("[data-draft-reject]").forEach(function(b){b.onclick=function(){var d=S.draftRequirements.find(function(x){return x.id===b.dataset.draftReject});if(!d)return;if(syncMode==="normalized"){apiCommand("draftRequirement.reviewBatch",{ids:[d.id],status:"rejected"}).then(render).catch(function(e){alert("Không cập nhật được nghĩa vụ: "+e.message)});return}d.reviewStatus="rejected";save();render()}});
  document.querySelectorAll("[data-draft-edit]").forEach(function(b){b.onclick=function(){editDraft(b.dataset.draftEdit)}});
  document.querySelectorAll("[data-approve-req]").forEach(function(b){b.onclick=function(){approveRequirement(b.dataset.approveReq)}});
  document.querySelectorAll("[data-reject-req]").forEach(function(b){b.onclick=function(){rejectRequirement(b.dataset.rejectReq)}});
  document.querySelectorAll("[data-source-edit]").forEach(function(b){b.onclick=function(){editSourceMetadata(b.dataset.sourceEdit)}});
  document.querySelectorAll("[data-source-text]").forEach(function(b){b.onclick=function(){provideSourceText(b.dataset.sourceText)}});
  var dsf=document.getElementById("draftSourceFilter");if(dsf)dsf.onchange=function(){draftSourceFilter=dsf.value;render()};
  var aq=document.getElementById("assessmentSearch");if(aq)aq.oninput=function(){assessmentQuery=aq.value;clearTimeout(window.__aq);window.__aq=setTimeout(render,250)};
  var asf=document.getElementById("assessmentStatusFilter");if(asf)asf.onchange=function(){assessmentStatusFilter=asf.value;render()};
  var aof=document.getElementById("assessmentOrgFilter");if(aof)aof.onchange=function(){assessmentOrgFilter=aof.value;render()};
  var fq=document.getElementById("findingSearch");if(fq)fq.oninput=function(){findingQuery=fq.value;clearTimeout(window.__fq);window.__fq=setTimeout(render,250)};
  var fsf=document.getElementById("findingStatusFilter");if(fsf)fsf.onchange=function(){findingStatusFilter=fsf.value;render()};
  var fsev=document.getElementById("findingSeverityFilter");if(fsev)fsev.onchange=function(){findingSeverityFilter=fsev.value;render()};
  var acq=document.getElementById("actionSearch");if(acq)acq.oninput=function(){actionQuery=acq.value;clearTimeout(window.__acq);window.__acq=setTimeout(render,250)};
  var ast=document.getElementById("actionStatusFilter");if(ast)ast.onchange=function(){actionStatusFilter=ast.value;render()};
  var aow=document.getElementById("actionOwnerFilter");if(aow)aow.onchange=function(){actionOwnerFilter=aow.value;render()};

  var dst=document.getElementById("draftStatusFilter");if(dst)dst.onchange=function(){draftStatusFilter=dst.value;render()};
  var dtf=document.getElementById("draftTypeFilter");if(dtf)dtf.onchange=function(){draftTypeFilter=dtf.value;render()};
  var dqs=document.getElementById("draftSearch");if(dqs)dqs.oninput=function(){draftQuery=dqs.value;clearTimeout(window.__draftQ);window.__draftQ=setTimeout(render,250)};



  document.querySelectorAll("[data-act]").forEach(function(b){b.onclick=function(){
    var x=b.dataset.act,a=S.assessments.find(function(z){return z.id===selectedAssessment});
    if(x==="qa")qa();
    if(x==="notifications")openNotifications();
    if(x==="readAll")markAllNotificationsRead();
    if(x==="exportJson")exportJSON();
    if(x==="printReport")printManagementReport();
    if(x==="saveNotifySettings"){var rd=document.getElementById("setReminderDays");S.notificationSettings={inApp:document.getElementById("setInApp").checked,overdueEscalation:document.getElementById("setOverdue").checked,reminderBeforeDueDays:rd&&rd.value!==""?Number(rd.value):""};save();render()}
    if(x==="refreshReadiness")loadRuntimeReadiness();
    if(x==="manageUsers")openUserManagement();
    if(x==="close")document.getElementById("mb").remove();
    if(x==="newfw"&&guard("manage_framework"))newfw();
    if(x==="sourceFile")addFileSource();
    if(x==="sourceText")addTextSource();
    if(x==="sourceSearch")searchRegulations();
    if(x==="publishDrafts")publishDrafts();
    if(x==="bulkAccept")bulkDraft("accepted");
    if(x==="bulkReject")bulkDraft("rejected");
    if(x==="newas"&&guard("manage_assessment"))newas();
    if(x==="upload")upload();
    if(x==="analyze"&&guard("review_ai",a))analyze();
    if(x==="finding"&&guard("confirm_finding",a))finding();
    if(x==="setResult")setRequirementResult();
  }});
  function assessmentAssignmentContext(){return{S:S,modal:modal,apiCommand:apiCommand,syncMode:syncMode,save:save,render:render,esc:esc,currentId:ComplianceAccess.current().id,now:now,id:id,ComplianceAccess:ComplianceAccess}}
  document.querySelectorAll("[data-assignment]").forEach(function(b){b.onclick=function(){ComplianceAssessmentAssignment.open(assessmentAssignmentContext(),b.dataset.assignment)}});
  document.querySelectorAll("[data-assessment-start]").forEach(function(b){b.onclick=function(){startAssessment(b.dataset.assessmentStart)}});
  document.querySelectorAll("[data-assessment-review]").forEach(function(b){b.onclick=function(){if(!b.disabled)submitAssessmentReview(b.dataset.assessmentReview)}});
  document.querySelectorAll("[data-assessment-close]").forEach(function(b){b.onclick=function(){closeAssessment(b.dataset.assessmentClose)}});
  document.querySelectorAll("[data-open]").forEach(function(b){b.onclick=function(){var a=S.assessments.find(function(x){return x.id===b.dataset.open});if(can("view_dashboard",a)){selectedAssessment=b.dataset.open;selectedRA=null;view="fieldwork";render()}}});
  document.querySelectorAll("[data-ra]").forEach(function(b){b.onclick=function(){selectedRA=b.dataset.ra;render()}});
  document.querySelectorAll("[data-accept]").forEach(function(b){b.onclick=function(){var a=S.assessments.find(function(x){return x.id===selectedAssessment});if(!guard("review_ai",a))return;var p=S.proposals.find(function(x){return x.id===b.dataset.accept}),r=S.ra.find(function(x){return x.id===p.raId});p.status="accepted";r.result=p.result;r.workflow="in_review";save();render()}});
  document.querySelectorAll("[data-reject]").forEach(function(b){b.onclick=function(){var a=S.assessments.find(function(x){return x.id===selectedAssessment});if(!guard("review_ai",a))return;S.proposals.find(function(x){return x.id===b.dataset.reject}).status="rejected";save();render()}});
  document.querySelectorAll("[data-respond]").forEach(function(b){b.onclick=function(){respond(b.dataset.respond)}});
  document.querySelectorAll("[data-finalize]").forEach(function(b){b.onclick=function(){finalizeFinding(b.dataset.finalize)}});

  document.querySelectorAll("[data-actionfor]").forEach(function(b){b.onclick=function(){var f=S.findings.find(function(x){return x.id===b.dataset.actionfor}),a=f&&findingAssessment(f);if(guard("assign_action",a))ComplianceActionGovernance.createAction(actionGovernanceContext(),b.dataset.actionfor)}});
  function actionGovernanceContext(){return{S:S,modal:modal,apiCommand:apiCommand,syncMode:syncMode,save:save,render:render,esc:esc,currentId:ComplianceAccess.current().id,now:now,id:id,ComplianceAccess:ComplianceAccess,actionEvidenceCount:actionEvidenceCount,setView:function(v){view=v}}}
  document.querySelectorAll("[data-action-progress]").forEach(function(b){b.onclick=function(){ComplianceActionGovernance.updateProgress(actionGovernanceContext(),b.dataset.actionProgress)}});
  document.querySelectorAll("[data-action-due-request]").forEach(function(b){b.onclick=function(){ComplianceActionGovernance.requestDueDateChange(actionGovernanceContext(),b.dataset.actionDueRequest)}});
  document.querySelectorAll("[data-action-due-decide]").forEach(function(b){b.onclick=function(){ComplianceActionGovernance.decideDueDateChange(actionGovernanceContext(),b.dataset.actionDueDecide)}});
  document.querySelectorAll("[data-action-evidence]").forEach(function(b){b.onclick=function(){uploadActionEvidence(b.dataset.actionEvidence)}});
  document.querySelectorAll("[data-evidence-preview]").forEach(function(b){b.onclick=function(){
    var id=b.dataset.evidencePreview;if(!id)return;
    window.open("/api/evidence?revisionId="+encodeURIComponent(id)+"&mode=inline","_blank","noopener,noreferrer");
  }});
  document.querySelectorAll("[data-evidence-download]").forEach(function(b){b.onclick=function(){
    var id=b.dataset.evidenceDownload;if(!id)return;
    var a=document.createElement("a");a.href="/api/evidence?revisionId="+encodeURIComponent(id)+"&mode=download";a.target="_blank";a.rel="noopener noreferrer";document.body.appendChild(a);a.click();a.remove();
  }});

  document.querySelectorAll("[data-verify]").forEach(function(b){b.onclick=function(){if(guard("verify_action"))ComplianceActionGovernance.verifyAction(actionGovernanceContext(),b.dataset.verify)}});
  document.querySelectorAll("[data-export]").forEach(function(b){b.onclick=function(){exportCSV(b.dataset.export)}});
  document.querySelectorAll("[data-notif-nav]").forEach(function(b){b.onclick=function(){var n=(S.notifications||[]).find(function(x){return x.target===b.dataset.notifNav&&!x.readAt});if(n)n.readAt=now();view=b.dataset.notifNav;document.getElementById("mb")?.remove();save();render()}});
  var gs=document.getElementById("globalSearch");if(gs){gs.onkeydown=function(e){if(e.key==="Enter")openGlobalSearch(gs.value)};gs.onfocus=function(){if(gs.value.trim().length>=2)openGlobalSearch(gs.value)}}
  document.querySelectorAll("[data-auth]").forEach(function(b){b.onclick=function(){if(b.dataset.auth==="login")openClerkSignIn();else signOutClerk()}});
  var s=document.getElementById("asSel");if(s)s.onchange=function(){selectedAssessment=s.value;selectedRA=null;render()};
  var ps=document.getElementById("personaSel");if(ps)ps.onchange=function(){ComplianceAccess.setPersona(ps.value);if(!ComplianceAccess.viewAllowed(view))view="dashboard";render()};
}
function loginGate(){
  var configured=runtimeReadiness&&runtimeReadiness.auth&&runtimeReadiness.auth.configured;
  return '<div style="min-height:100vh;display:grid;place-items:center;background:#f3f7f4;padding:24px"><div class="card" style="max-width:520px;width:100%;padding:28px"><h1 style="margin-top:0;color:#075a32">Đánh giá tuân thủ</h1><p class="muted">Compliance Assessment App · AgriS</p><h2>Đăng nhập để tiếp tục</h2><p>Ứng dụng đang sử dụng dữ liệu production chuẩn hóa. Vui lòng xác thực bằng email đã được mời vào hệ thống.</p>'+(configured?'<button class="btn" data-auth="login">Đăng nhập bằng email</button>':'<div class="fail">Clerk chưa được cấu hình.</div>')+(clerkLoadError?'<div class="search-warning" style="margin-top:12px">Không tải được Clerk client: '+esc(clerkLoadError)+'</div>':'')+'</div></div>'
}
function render(){
  if(runtimeReadiness&&runtimeReadiness.auth&&runtimeReadiness.auth.configured&&dataModeRuntime==="normalized"&&!currentUser){
    document.getElementById("root").innerHTML=loginGate();bind();return;
  }
  if(!ComplianceAccess.viewAllowed(view))view="dashboard";
  var f={dashboard:dashboard,frameworks:frameworks,assessments:assessments,fieldwork:fieldwork,findings:findings,actions:actions,reports:reports,settings:settings}[view]||dashboard;
  document.getElementById("root").innerHTML=f();bind()
}
async function boot(){
  document.getElementById("root").innerHTML='<div style="min-height:100vh;display:grid;place-items:center;background:#f3f7f4"><div class="card"><b>Đang khởi tạo ứng dụng...</b></div></div>';
  await loadRuntimeReadiness();
  if(currentUser)await pullRemote();
  render();
}
boot();
})();
