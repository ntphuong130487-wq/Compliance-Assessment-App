 document.querySelectorAll('[data-proposalaccept]').forEach(b=>b.onclick=()=>proposalDecision(b.dataset.proposalaccept,true));
  document.querySelectorAll('[data-proposalreject]').forEach(b=>b.onclick=()=>proposalDecision(b.dataset.proposalreject,false));
  document.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>setResult(b.dataset.result));
  document.querySelectorAll('[data-unitresponse]').forEach(b=>b.onclick=()=>unitResponse(b.dataset.unitresponse));
  document.querySelectorAll('[data-actionfor]').forEach(b=>b.onclick=()=>assignAction(b.dataset.actionfor));
  document.querySelectorAll('[data-actionupdate]').forEach(b=>b.onclick=()=>updateAction(b.dataset.actionupdate));
  document.querySelectorAll('[data-verify]').forEach(b=>b.onclick=()=>verifyAction(b.dataset.verify));
  document.querySelectorAll('[data-transition]').forEach(b=>b.onclick=()=>{if(b.disabled)return;const [idValue,next]=b.dataset.transition.split('|');transition(idValue,next);});
  const sel=document.getElementById('assessmentSelect');if(sel)sel.onchange=()=>{selectedAssessment=sel.value;selectedRA=null;render();};
}

importInput.onchange=async()=>{const f=importInput.files?.[0];if(!f)return;try{const imported=await importState(f);const q=validateState(imported);if(q.errors.length){alert(`Không import: dữ liệu có ${q.errors.length} lỗi toàn vẹn.`);return;}state=imported;appendDecision(state,{objectType:'System',objectId:'import',decisionType:'restore',reason:`Restore từ ${f.name}`,actor:currentRole});persist();selectedAssessment=state.assessments[0]?.id||null;selectedRA=state.requirementAssessments[0]?.id||null;render();}catch(e){alert('Import thất bại: '+e.message);}finally{importInput.value='';}};

render();
