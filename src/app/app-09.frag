dTo||null,status:'draft',locked:false,lockedAt:null,createdAt:nowIso()},scope={id:generateId('scope'),assessmentId:a.id,orgUnitId:d.orgUnitId,processRef:null,locationRef:null,activityRef:null,scopeNote:d.scopeNote,includeAllRequirements:!d.scopeNote.trim()};state.assessmentPrograms.push(program);createAssessmentFromFramework(state,a,scope);persist();selectedAssessment=a.id;selectedRA=null;closeModal();view='assessments';render();};
}

async function uploadEvidence(){
  const a=assessment(selectedAssessment);if(!a||a.locked||!roleCan('fieldwork'))return;
  fileInput.value='';
  fileInput.onchange=async()=>{
    for(const file of [...fileInput.files]){
      const hash=await sha256(file),ev={id:generateId('ev'),name:file.name,evidenceType:file.type||'file',ownerActorId:null,sourceSystem:'manual_upload',confidentiality:'internal',validFrom:null,validTo:null,status:'active'},rev={id:generateId('rev'),evidenceId:ev.id,version:1,fileUri:null,originalFilename:file.name,mimeType:file.type||'application/octet-stream',size:file.size,sha256:hash,capturedAt:nowIso(),uploadedBy:currentRole,observation:'Metadata only; binary file chưa lưu server.'},link={id:generateId('el'),evidenceRevisionId:rev.id,targetType:'RequirementAssessment',targetId:selectedRA,purpose:'assessment_evidence',linkedBy:currentRole,linkedAt:nowIso()};state.evidence.push(ev);state.evidenceRevisions.push(rev);state.evidenceLinks.push(link);appendDecision(state,{objectType:'EvidenceRevision',objectId:rev.id,decisionType:'link',reason:`${file.name} → RequirementAssessment ${selectedRA}`,actor:currentRole});
    }
    persist();render();
  };
  fileInput.click();
}

function saveObservation(){const ra=raById(selectedRA),el=document.getElementById('observation');if(!ra||!el||isLocked(ra.assessmentId))return;ra.observation=el.value.trim();if(ra.workflowStatus==='to_do')ra.workflowStatus='in_progress';appendDecision(state,{objectType:'RequirementAssessment',objectId:ra.id,decisionType:'observation_update',reason:'Cập nhật ghi nhận fieldwork',actor:currentRole});persist();render();}

function analyze(){
  const ra=raById(selectedRA),q=ra&&requirement(ra.requirementId);if(!ra||!q||isLocked(ra.assessmentId))return;
  const observation=(document.getElementById('observation')?.value||ra.observation||'').trim();ra.observation=observation;
  const text=observation.toLowerCase(),neg=['không','thiếu','chưa','sai','quá hạn','vượt thẩm quyền','không có','không đủ'].some(k=>text.includes(k));
  const evidenceCount=state.evidenceLinks.filter(l=>l.targetType==='RequirementAssessment'&&l.targetId===ra.id).length;
  const p={id:generateId('ai'),evidenceRevisionId:null,assessmentId:ra.assessmentId,requirementAssessmentId:ra.id,proposedRequirementId:q.id,proposedResult:neg?'non_compliant':'insufficient_evidence',proposedFinding:neg?`Có dấu hiệu không phù hợp với ${q.code}`:null,confidence:null,rationale:neg?`Ghi nhận chứa dấu hiệu cần kiểm tra thêm; đã có ${evidenceCount} evidence link. Đây là screening theo rule, chưa phải kết luận AI/LLM.`:`Chưa có dấu hiệu đủ mạnh để kết luận. Cần bổ sung/đối chiếu bằng chứng. Đây là screening theo rule.`,status:'proposed',reviewedBy:null,reviewedAt:null};
  state.aiProposals.push(p);appendDecision(state,{objectType:'AIAnalysisProposal',objectId:p.id,decisionType:'propose',reason:p.rationale,actor:'Rule engine'});persist();render();
}

function proposalDecision(idValue,accept){const p=state.aiProposals.find(x=>x.id===idValue);if(!p)return;p.status=accept?'accepted':'rejected';p.reviewedBy=currentRole;p.reviewedAt=nowIso();if(accept){const ra=raById(p.requirementAsse