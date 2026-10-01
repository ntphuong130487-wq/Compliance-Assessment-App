(function(g){
  "use strict";

  function localLog(ctx,type,action,note,fromState,toState,metadata){
    ctx.S.logs.push({
      id:ctx.id("log"),type:type,object:"RemediationAction",objectId:action.id,
      at:ctx.now(),note:note||"",fromState:fromState==null?null:String(fromState),
      toState:toState==null?null:String(toState),metadata:metadata||{}
    });
  }

  function updateProgress(ctx,actionId){
    var a=ctx.S.actions.find(function(x){return x.id===actionId});if(!a)return;
    ctx.modal('<h3>Cập nhật tiến độ hành động</h3><form id="actionProgressForm"><div class="field"><label>Tiến độ (%)</label><input type="number" name="progress" min="0" max="100" step="1" value="'+Number(a.progress||0)+'" required></div><div class="field"><label>Ghi chú cập nhật</label><textarea name="note" required placeholder="Nêu kết quả đã thực hiện, vướng mắc hoặc bước tiếp theo"></textarea></div><div class="note">Tiến độ 100% không tự đóng hành động. Muốn đóng vẫn phải nộp bằng chứng và qua xác minh độc lập.</div><button class="btn">Lưu tiến độ</button></form>');
    document.getElementById("actionProgressForm").onsubmit=async function(ev){
      ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target)),progress=Number(d.progress);
      try{
        if(ctx.syncMode==="normalized"){
          await ctx.apiCommand("action.updateProgress",{actionId:actionId,progress:progress,note:d.note});
        }else{
          if(!Number.isInteger(progress)||progress<0||progress>100)throw new Error("INVALID_ACTION_PROGRESS");
          var before=Number(a.progress||0);a.progress=progress;
          localLog(ctx,"progress_update",a,d.note,before,progress,{previousProgress:before,newProgress:progress});
          ctx.save();
        }
        document.getElementById("mb")?.remove();ctx.render();
      }catch(e){alert("Không cập nhật được tiến độ: "+e.message)}
    };
  }

  function requestDueDateChange(ctx,actionId){
    var a=ctx.S.actions.find(function(x){return x.id===actionId});if(!a)return;
    var pending=(ctx.S.actionChangeRequests||[]).find(function(x){return x.actionId===actionId&&x.status==="pending"});
    if(pending){alert("Hành động đã có một đề nghị đổi hạn đang chờ phê duyệt.");return}
    ctx.modal('<h3>Đề nghị thay đổi hạn xử lý</h3><form id="dueDateRequestForm"><div class="field"><label>Hạn hiện tại</label><input value="'+ctx.esc(a.due||"Chưa có")+'" disabled></div><div class="field"><label>Hạn đề nghị</label><input type="date" name="requestedDueDate" required></div><div class="field"><label>Lý do thay đổi</label><textarea name="reason" required placeholder="Nêu nguyên nhân, tác động và cam kết xử lý"></textarea></div><div class="note">Hạn chỉ thay đổi sau khi người có thẩm quyền phê duyệt. Người đề nghị không được tự phê duyệt.</div><button class="btn">Gửi đề nghị</button></form>');
    document.getElementById("dueDateRequestForm").onsubmit=async function(ev){
      ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target));
      try{
        if(ctx.syncMode==="normalized"){
          await ctx.apiCommand("action.requestDueDateChange",{actionId:actionId,requestedDueDate:d.requestedDueDate,reason:d.reason});
        }else{
          if(d.requestedDueDate===a.due)throw new Error("DUE_DATE_UNCHANGED");
          var req={id:ctx.id("acr"),actionId:actionId,requestType:"due_date_change",currentDueDate:a.due||null,requestedDueDate:d.requestedDueDate,reason:d.reason,requestedBy:ctx.currentId,status:"pending",requestedAt:ctx.now()};
          ctx.S.actionChangeRequests.push(req);
          localLog(ctx,"due_date_change_requested",a,d.reason,a.due||null,d.requestedDueDate,{requestId:req.id});
          ctx.save();
        }
        document.getElementById("mb")?.remove();ctx.render();
      }catch(e){alert("Không gửi được đề nghị đổi hạn: "+e.message)}
    };
  }

  function decideDueDateChange(ctx,requestId){
    var req=(ctx.S.actionChangeRequests||[]).find(function(x){return x.id===requestId});if(!req)return;
    var a=ctx.S.actions.find(function(x){return x.id===req.actionId});if(!a)return;
    ctx.modal('<h3>Phê duyệt thay đổi hạn xử lý</h3><div class="note"><b>Hạn hiện tại:</b> '+ctx.esc(req.currentDueDate||"Chưa có")+' → <b>Hạn đề nghị:</b> '+ctx.esc(req.requestedDueDate)+'<br><b>Lý do:</b> '+ctx.esc(req.reason)+'</div><form id="dueDateDecisionForm"><div class="field"><label>Quyết định</label><select name="decision"><option value="approved">Phê duyệt</option><option value="rejected">Từ chối</option></select></div><div class="field"><label>Ý kiến phê duyệt</label><textarea name="decisionNote" placeholder="Bắt buộc khi từ chối"></textarea></div><button class="btn">Ghi nhận quyết định</button></form>');
    document.getElementById("dueDateDecisionForm").onsubmit=async function(ev){
      ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target));
      if(d.decision==="rejected"&&!String(d.decisionNote||"").trim()){alert("Cần nhập lý do từ chối.");return}
      try{
        if(ctx.syncMode==="normalized"){
          await ctx.apiCommand("action.decideDueDateChange",{requestId:requestId,decision:d.decision,decisionNote:d.decisionNote||""});
        }else{
          if(req.requestedBy===ctx.currentId)throw new Error("SELF_APPROVAL_FORBIDDEN");
          req.status=d.decision;req.decidedBy=ctx.currentId;req.decidedAt=ctx.now();req.decisionNote=d.decisionNote||"";
          if(d.decision==="approved")a.due=req.requestedDueDate;
          localLog(ctx,"due_date_change_"+d.decision,a,d.decisionNote||req.reason,req.currentDueDate,req.requestedDueDate,{requestId:req.id});
          ctx.save();
        }
        document.getElementById("mb")?.remove();ctx.render();
      }catch(e){alert("Không ghi nhận được quyết định: "+e.message)}
    };
  }

  async function createAction(ctx,findingId){
    var f=ctx.S.findings.find(function(x){return x.id===findingId});
    if(!f||f.status!=="final"){ctx.modal('<h3>Chưa thể giao hành động</h3><p>Chỉ Phát hiện chính thức mới được tạo hành động.</p>');return}
    var people=[];
    if(ctx.syncMode==="normalized"){
      try{
        var rr=await fetch("/api/v1/users",{headers:{"Accept":"application/json"}}),dd=await rr.json();
        if(rr.ok&&dd.ok)people=dd.users;
      }catch(e){}
    }
    if(!people.length)people=ctx.ComplianceAccess.personas.map(function(p){return{id:p.id,name:p.label,email:""}});
    var defaultType=f.remediationRequired?"mandatory_remediation":"improvement_action";
    ctx.modal('<h3>Tạo hành động</h3><form id="actionCreateForm"><div class="field"><label>Loại hành động</label><select name="actionType"><option value="mandatory_remediation" '+(defaultType==="mandatory_remediation"?"selected":"")+' '+(!f.remediationRequired?"disabled":"")+'>Khắc phục bắt buộc</option><option value="improvement_action" '+(defaultType==="improvement_action"?"selected":"")+'>Hành động cải thiện</option></select></div>'+(f.remediationRequired?'<div class="note"><b>Yêu cầu khắc phục:</b> '+ctx.esc(f.remediationRequirement||"—")+'</div>':'<div class="note">Finding này không được đánh dấu khắc phục bắt buộc. Có thể tạo hành động cải thiện tự nguyện.</div>')+'<div class="field"><label>Hành động</label><textarea name="text" required></textarea></div><div class="field"><label>Người phụ trách</label><select name="ownerIdentityId" required>'+people.map(function(p){return'<option value="'+p.id+'">'+ctx.esc(p.name+(p.email?" · "+p.email:""))+'</option>'}).join("")+'</select></div><div class="field"><label>Hạn</label><input type="date" name="due"></div><button class="btn">Giao hành động</button></form>');
    document.getElementById("actionCreateForm").onsubmit=async function(ev){
      ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target)),person=people.find(function(x){return x.id===d.ownerIdentityId}),owner=person?person.name:d.ownerIdentityId,actionType=f.remediationRequired?(d.actionType||"mandatory_remediation"):"improvement_action";
      try{
        if(ctx.syncMode==="normalized"){
          await ctx.apiCommand("action.create",{findingId:findingId,actionType:actionType,text:d.text,owner:owner,ownerIdentityId:d.ownerIdentityId,due:d.due||null});
        }else{
          var item={id:ctx.id("act"),findingId:findingId,actionType:actionType,text:d.text,owner:owner,ownerPersonaId:d.ownerIdentityId,due:d.due||null,status:"open",progress:0,createdAt:ctx.now(),createdByPersonaId:ctx.currentId};
          ctx.S.actions.push(item);ctx.save();
        }
        document.getElementById("mb")?.remove();ctx.setView("actions");ctx.render();
      }catch(e){alert("Không giao được hành động: "+e.message)}
    };
  }

  function verifyAction(ctx,actionId){
    var a=ctx.S.actions.find(function(x){return x.id===actionId});if(!a)return;
    var evidenceCount=ctx.actionEvidenceCount(actionId);
    if(a.status!=="submitted_for_verification"||evidenceCount<1){ctx.modal('<h3>Chưa đủ điều kiện xác minh</h3><p>Hành động phải có ít nhất một bằng chứng hoàn thành và được nộp xác minh.</p>');return}
    if(a.ownerPersonaId===ctx.currentId){ctx.modal('<h3>Không được tự xác minh</h3><p>Người chịu trách nhiệm thực hiện hành động không được tự xác minh hiệu lực của chính hành động đó.</p>');return}
    ctx.modal('<h3>Xác minh hành động</h3><form id="actionVerifyForm"><div class="field"><label>Kết quả</label><select name="result"><option value="effective">Đạt/hiệu lực</option><option value="ineffective">Chưa đạt</option></select></div><div class="field"><label>Ghi chú xác minh</label><textarea name="note" required></textarea></div><div class="note">Đã có '+evidenceCount+' bằng chứng hoàn thành. Người xác minh độc lập với người phụ trách hành động.</div><button class="btn">Ghi nhận xác minh</button></form>');
    document.getElementById("actionVerifyForm").onsubmit=async function(ev){
      ev.preventDefault();var d=Object.fromEntries(new FormData(ev.target));
      try{
        if(ctx.syncMode==="normalized"){
          await ctx.apiCommand("action.verify",{actionId:actionId,result:d.result,note:d.note});
        }else{
          ctx.S.verifications.push({id:ctx.id("v"),actionId:actionId,result:d.result,note:d.note,at:ctx.now(),verifierPersonaId:ctx.currentId,evidenceCount:evidenceCount});
          a.status=d.result==="effective"?"closed":"reopened";if(d.result==="ineffective")a.closureSubmittedAt=null;
          var f=ctx.S.findings.find(function(x){return x.id===a.findingId}),all=ctx.S.actions.filter(function(x){return x.findingId===a.findingId});
          if(f&&all.length&&all.every(function(x){return x.status==="closed"}))f.status="closed";
          ctx.save();
        }
        document.getElementById("mb")?.remove();ctx.render();
      }catch(e){alert("Không xác minh được hành động: "+e.message)}
    };
  }

  g.ComplianceActionGovernance={
    updateProgress:updateProgress,
    requestDueDateChange:requestDueDateChange,
    decideDueDateChange:decideDueDateChange,
    createAction:createAction,
    verifyAction:verifyAction
  };
})(window);
