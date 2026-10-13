export async function assessmentSourceContext(sql,{sourceId,assessmentId}){
  const rows=await sql`
    SELECT
      l.id::text AS "linkId",l.assessment_id::text AS "assessmentId",l.source_id::text AS "sourceId",
      l.source_role AS "sourceRole",l.extraction_eligible AS "extractionEligible",
      l.relevance_status AS "relevanceStatus",l.effectiveness_status AS "effectivenessStatus",
      a.name AS "assessmentName",a.objective,a.period_from AS "periodFrom",a.period_to AS "periodTo",
      s.org_unit_id::text AS "orgId",o.code AS "orgCode",o.name AS "orgName",
      s.process_ref AS "processRef",s.activity_ref AS "activityRef",s.location_ref AS "locationRef",
      s.scope_note AS "scopeNote",
      cs.title AS "sourceTitle",cs.version AS "sourceVersion",cs.effective_from AS "sourceEffectiveFrom",
      cs.effective_to AS "sourceEffectiveTo",cs.status AS "sourceStatus"
    FROM assessment_sources l
    JOIN compliance_assessments a ON a.id=l.assessment_id
    JOIN compliance_sources cs ON cs.id=l.source_id
    LEFT JOIN LATERAL (
      SELECT * FROM assessment_scopes s0 WHERE s0.assessment_id=a.id ORDER BY s0.id LIMIT 1
    ) s ON true
    LEFT JOIN org_units o ON o.id=s.org_unit_id
    WHERE l.source_id=${sourceId}::uuid AND l.assessment_id=${assessmentId}::uuid
    LIMIT 1
  `;
  return rows[0]||null;
}

export function assertExtractableSourceContext(ctx){
  if(!ctx){
    const e=new Error("ASSESSMENT_SOURCE_LINK_REQUIRED");e.code="ASSESSMENT_SOURCE_LINK_REQUIRED";e.status=409;throw e;
  }
  if(!["basis_external","basis_internal"].includes(ctx.sourceRole)||!ctx.extractionEligible){
    const e=new Error("SOURCE_ROLE_NOT_EXTRACTABLE");e.code="SOURCE_ROLE_NOT_EXTRACTABLE";e.status=409;throw e;
  }
  if(ctx.relevanceStatus!=="verified"){
    const e=new Error("SOURCE_RELEVANCE_NOT_VERIFIED");e.code="SOURCE_RELEVANCE_NOT_VERIFIED";e.status=409;throw e;
  }
  if(ctx.effectivenessStatus!=="verified"){
    const e=new Error("SOURCE_EFFECTIVENESS_NOT_VERIFIED");e.code="SOURCE_EFFECTIVENESS_NOT_VERIFIED";e.status=409;throw e;
  }
}

export function scopeContextFromAssessmentSource(ctx){
  return {
    assessmentId:ctx.assessmentId,
    assessmentName:ctx.assessmentName||"",
    objective:ctx.objective||"",
    org:{id:ctx.orgId||"",code:ctx.orgCode||"",name:ctx.orgName||""},
    processRef:ctx.processRef||"",
    activityRef:ctx.activityRef||"",
    locationRef:ctx.locationRef||"",
    scopeNote:ctx.scopeNote||"",
    periodFrom:ctx.periodFrom||null,
    periodTo:ctx.periodTo||null,
    source:{title:ctx.sourceTitle||"",version:ctx.sourceVersion||"",effectiveFrom:ctx.sourceEffectiveFrom||null,effectiveTo:ctx.sourceEffectiveTo||null}
  };
}
