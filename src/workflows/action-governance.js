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

  g.ComplianceActionGovernance={
    updateProgress:updateProgress,
    requestDueDateChange:requestDueDateChange,
    decideDueDateChange:decideDueDateChange
  };
})(window);
