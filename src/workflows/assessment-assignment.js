(function(g){
  "use strict";

  function eligiblePeople(ctx,users,assessment){
    return users.filter(function(u){
      if(!u||u.status&&u.status!=="active")return false;
      var role=ctx.ComplianceAccess.roles[u.role];
      if(!role||role.permissions.indexOf("conduct_fieldwork")<0)return false;
      var orgs=Array.isArray(u.orgIds)?u.orgIds:[];
      return orgs.indexOf("*")>=0||orgs.indexOf(String(assessment.orgId))>=0;
    });
  }

  async function loadPeople(ctx,assessment){
    if(ctx.syncMode==="normalized"){
      var res=await fetch("/api/v1/users",{headers:{"Accept":"application/json"}}),data=await res.json();
      if(!res.ok||!data.ok)throw new Error(data.error||"USER_DIRECTORY_ERROR");
      return eligiblePeople(ctx,data.users||[],assessment);
    }
    return eligiblePeople(ctx,ctx.ComplianceAccess.personas.map(function(p){
      return{id:p.id,name:p.label,email:"",role:p.role,orgIds:p.orgIds,status:"active"};
    }),assessment);
  }

  async function open(ctx,assessmentId){
    var a=ctx.S.assessments.find(function(x){return x.id===assessmentId});if(!a)return;
    if(!["draft","fieldwork"].includes(a.status)){alert("Chỉ phân công khi cuộc đánh giá ở trạng thái Nháp hoặc Đang kiểm tra.");return}
    var rows=ctx.S.ra.filter(function(r){return r.assessmentId===assessmentId});
    if(!rows.length){alert("Cuộc đánh giá chưa có điểm kiểm tra.");return}
    ctx.modal('<h3>Phân công người kiểm tra theo yêu cầu</h3><div id="assignmentBody"><div class="small muted">Đang tải danh sách nhân sự...</div></div>');
    try{
      var people=await loadPeople(ctx,a);
      if(!people.length){document.getElementById("assignmentBody").innerHTML='<div class="note">Không có người dùng đang hoạt động, có quyền kiểm tra và thuộc phạm vi đơn vị của cuộc đánh giá.</div>';return}
      var current=ctx.S.requirementAssignments||[];
      var html='<div class="note"><b>Nguyên tắc:</b> mỗi yêu cầu phải có 01 người kiểm tra chính trước khi bắt đầu Fieldwork. Trưởng đoàn/Quản lý vẫn có quyền can thiệp nghiệp vụ khi cần.</div><form id="requirementAssignmentForm"><div class="table"><table><thead><tr><th>Yêu cầu tuân thủ</th><th>Người kiểm tra chính</th><th>Trạng thái</th></tr></thead><tbody>'+rows.map(function(r){
        var q=ctx.S.requirements.find(function(x){return x.id===r.requirementId}),as=current.find(function(x){return x.raId===r.id&&x.assignmentRole==="primary_assessor"&&x.status==="active"});
        return'<tr><td><b>'+ctx.esc(q&&q.code)+'</b><div class="small">'+ctx.esc(q&&q.title)+'</div></td><td><select name="ra_'+r.id+'" required><option value="">— Chọn người kiểm tra —</option>'+people.map(function(p){return'<option value="'+p.id+'" '+(as&&as.userId===p.id?"selected":"")+'>'+ctx.esc((p.name||p.email)+(p.role?" · "+(ctx.ComplianceAccess.roles[p.role]?.label||p.role):""))+'</option>'}).join("")+'</select></td><td>'+(as?'<span class="tag green">Đã phân công</span>':'<span class="tag amber">Chưa phân công</span>')+'</td></tr>'
      }).join("")+'</tbody></table></div><div class="row" style="margin-top:12px"><button class="btn">Lưu phân công</button></div></form>';
      document.getElementById("assignmentBody").innerHTML=html;
      document.getElementById("requirementAssignmentForm").onsubmit=async function(ev){
        ev.preventDefault();var fd=new FormData(ev.target),assignments=rows.map(function(r){return{raId:r.id,userId:String(fd.get("ra_"+r.id)||"")}}).filter(function(x){return x.userId});
        if(assignments.length!==rows.length){alert("Mỗi yêu cầu phải có một người kiểm tra chính.");return}
        try{
          if(ctx.syncMode==="normalized"){
            await ctx.apiCommand("assessment.assignRequirements",{assessmentId:assessmentId,assignments:assignments});
          }else{
            assignments.forEach(function(item){
              var person=people.find(function(p){return p.id===item.userId});
              (ctx.S.requirementAssignments||[]).forEach(function(x){if(x.raId===item.raId&&x.assignmentRole==="primary_assessor"&&x.status==="active")x.status="inactive"});
              ctx.S.requirementAssignments.push({id:ctx.id("raa"),raId:item.raId,userId:item.userId,displayName:person?person.name:item.userId,assignmentRole:"primary_assessor",assignedBy:ctx.currentId,assignedAt:ctx.now(),status:"active"});
              ctx.S.logs.push({id:ctx.id("log"),type:"assign_primary_assessor",object:"RequirementAssessment",objectId:item.raId,at:ctx.now(),note:person?person.name:item.userId});
            });
            ctx.save();
          }
          document.getElementById("mb")?.remove();ctx.render();
        }catch(e){alert("Không lưu được phân công: "+e.message)}
      };
    }catch(e){
      document.getElementById("assignmentBody").innerHTML='<div class="fail">Không tải được danh sách người kiểm tra.</div><div class="small muted">'+ctx.esc(e.message||String(e))+'</div>';
    }
  }

  g.ComplianceAssessmentAssignment={open:open};
})(window);
