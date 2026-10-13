import crypto from "node:crypto";

export async function persistDraftObligations(sql,{sourceId,assessmentId,hybrid,obligations}){
  await sql`
    DELETE FROM draft_requirements
    WHERE source_id=${sourceId}::uuid
      AND origin_assessment_id=${assessmentId}::uuid
      AND review_status<>'published'
  `;

  const officialKeys=(await sql`
    SELECT obligation_key FROM compliance_requirements
    WHERE obligation_key IS NOT NULL AND obligation_key = ANY(${obligations.map(x=>x.obligationKey).filter(Boolean)})
  `).map(x=>x.obligation_key);
  const officialSet=new Set(officialKeys);

  const persisted=[];
  for(const o of obligations){
    const id=crypto.randomUUID();
    const reviewReasons=[...(Array.isArray(o.reviewReasons)?o.reviewReasons:[])];
    if(o.obligationKey&&officialSet.has(o.obligationKey)&&!reviewReasons.includes("Có nghĩa vụ chính thức trùng khóa chuẩn hóa")){
      reviewReasons.push("Có nghĩa vụ chính thức trùng khóa chuẩn hóa");
    }
    await sql`
      INSERT INTO draft_requirements
        (id,source_id,origin_assessment_id,source_clause,original_text,obligation,applicability,obligation_type,
         mandatory_level,expected_evidence,test_procedure,review_status,
         actor_text,action_text,object_text,condition_text,exception_text,timing_text,frequency_text,
         control_point,control_objective,verification_method,
         applicable_org_refs,applicable_process_refs,applicable_activity_refs,applicable_role_refs,
         obligation_key,
         ai_generated,ai_confidence,ai_engine,ai_schema_version,ai_field_confidence,
         ai_review_reasons,ai_uncertainties,ai_payload,created_at,updated_at)
      VALUES
        (${id}::uuid,${sourceId}::uuid,${assessmentId}::uuid,${o.sourceClause||null},${o.originalText||null},${o.obligation},
         ${o.applicability||null},${o.obligationType||"general"},${o.mandatoryLevel||"review"},
         ${o.expectedEvidence||null},${o.testProcedure||null},'draft',
         ${o.actorText||null},${o.actionText||null},${o.objectText||null},${o.conditionText||null},${o.exceptionText||null},
         ${o.timingText||null},${o.frequencyText||null},${o.controlPoint||null},${o.controlObjective||null},
         ${o.verificationMethod||o.testProcedure||null},
         ${JSON.stringify(o.applicableOrgRefs||[])}::jsonb,${JSON.stringify(o.applicableProcessRefs||[])}::jsonb,
         ${JSON.stringify(o.applicableActivityRefs||[])}::jsonb,${JSON.stringify(o.applicableRoleRefs||[])}::jsonb,
         ${o.obligationKey||null},
         ${Boolean(o.aiGenerated)},${o.confidence??null},${hybrid.engine},${o.schemaVersion||hybrid.schemaVersion||"v2"},
         ${JSON.stringify(o.fieldConfidence||{})}::jsonb,${JSON.stringify(reviewReasons.slice(0,15))}::jsonb,
         ${JSON.stringify(o.uncertainties||[])}::jsonb,${JSON.stringify({...o,reviewReasons})}::jsonb,now(),now())
    `;
    persisted.push({...o,id,sourceId,assessmentId,reviewReasons});
  }
  return persisted;
}
