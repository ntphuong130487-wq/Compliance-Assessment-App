function norm(v){return String(v||"").trim().toLowerCase()}
function arr(v){return Array.isArray(v)?v.map(norm).filter(Boolean):[]}
function matches(refs,candidates){
  const r=arr(refs);if(!r.length)return true;
  const c=candidates.map(norm).filter(Boolean);
  return r.some(x=>c.some(y=>x===y||x.includes(y)||y.includes(x)));
}
function dateOk(source,scope){
  const from=source.sourceEffectiveFrom?new Date(source.sourceEffectiveFrom):null;
  const to=source.sourceEffectiveTo?new Date(source.sourceEffectiveTo):null;
  const periodFrom=scope.periodFrom?new Date(scope.periodFrom):null;
  const periodTo=scope.periodTo?new Date(scope.periodTo):null;
  if(from&&periodTo&&from>periodTo)return false;
  if(to&&periodFrom&&to<periodFrom)return false;
  return true;
}

export async function assessmentEligibility(sql,assessmentId){
  const aRows=await sql`
    SELECT a.id::text,a.framework_id::text AS "frameworkId",a.name,a.period_from AS "periodFrom",a.period_to AS "periodTo",
           s.org_unit_id::text AS "orgId",o.code AS "orgCode",o.name AS "orgName",
           s.process_ref AS "processRef",s.activity_ref AS "activityRef",s.location_ref AS "locationRef",s.scope_note AS "scopeNote"
    FROM compliance_assessments a
    LEFT JOIN LATERAL (
      SELECT * FROM assessment_scopes s0 WHERE s0.assessment_id=a.id ORDER BY s0.id LIMIT 1
    ) s ON true
    LEFT JOIN org_units o ON o.id=s.org_unit_id
    WHERE a.id=${assessmentId}::uuid
  `;
  const scope=aRows[0];
  if(!scope)return null;

  const linkedSources=await sql`
    SELECT source_id::text AS "sourceId",source_role AS "sourceRole",relevance_status AS "relevanceStatus",
           effectiveness_status AS "effectivenessStatus"
    FROM assessment_sources WHERE assessment_id=${assessmentId}::uuid
  `;
  const basisSourceIds=linkedSources
    .filter(x=>["basis_external","basis_internal"].includes(x.sourceRole)&&x.relevanceStatus==="verified"&&x.effectivenessStatus==="verified")
    .map(x=>x.sourceId);

  const rows=await sql`
    SELECT r.id::text,r.code,r.title,r.status,r.origin_assessment_id::text AS "originAssessmentId",
           r.source_id::text AS "sourceId",r.source_clause AS "sourceClause",
           r.applicable_org_refs AS "applicableOrgRefs",r.applicable_process_refs AS "applicableProcessRefs",
           r.applicable_activity_refs AS "applicableActivityRefs",r.applicable_role_refs AS "applicableRoleRefs",
           r.obligation_key AS "obligationKey",
           cs.effective_from AS "sourceEffectiveFrom",cs.effective_to AS "sourceEffectiveTo",cs.status AS "sourceStatus",
           EXISTS(
             SELECT 1 FROM framework_requirements fr
             WHERE fr.requirement_id=r.id AND fr.framework_id=scope.framework_id
           ) AS "frameworkMatch"
    FROM compliance_requirements r
    LEFT JOIN compliance_sources cs ON cs.id=r.source_id
    WHERE
      r.origin_assessment_id=${assessmentId}::uuid
      OR r.source_id::text = ANY(${basisSourceIds.length?basisSourceIds:["00000000-0000-0000-0000-000000000000"]})
      OR (
        ${scope.frameworkId||null}::uuid IS NOT NULL
        AND EXISTS(SELECT 1 FROM framework_requirements fr WHERE fr.requirement_id=r.id AND fr.framework_id=${scope.frameworkId||null}::uuid)
      )
  `;

  const counts={total:rows.length,approved:0,unitMatch:0,processMatch:0,activityMatch:0,effective:0,eligible:0};
  const items=rows.map(r=>{
    const approved=r.status==="effective";
    const unitMatch=matches(r.applicableOrgRefs,[scope.orgId,scope.orgCode,scope.orgName]);
    const processMatch=matches(r.applicableProcessRefs,[scope.processRef]);
    const activityMatch=matches(r.applicableActivityRefs,[scope.activityRef]);
    const sourceEffective=dateOk(r,scope)&&!["expired","superseded","rejected"].includes(String(r.sourceStatus||"").toLowerCase());
    if(approved)counts.approved++;
    if(approved&&unitMatch)counts.unitMatch++;
    if(approved&&unitMatch&&processMatch)counts.processMatch++;
    if(approved&&unitMatch&&processMatch&&activityMatch)counts.activityMatch++;
    if(approved&&unitMatch&&processMatch&&activityMatch&&sourceEffective)counts.effective++;
    const eligible=approved&&unitMatch&&processMatch&&activityMatch&&sourceEffective;
    if(eligible)counts.eligible++;
    return {...r,approved,unitMatch,processMatch,activityMatch,sourceEffective,eligible};
  });

  return {scope,sourcePlan:{total:linkedSources.length,verifiedBasis:basisSourceIds.length},counts,items,eligible:items.filter(x=>x.eligible)};
}

export function requirementSnapshot(row){
  return {
    id:row.id,code:row.code,title:row.title,sourceId:row.sourceId||null,sourceClause:row.sourceClause||null,
    obligationKey:row.obligationKey||null,applicableOrgRefs:row.applicableOrgRefs||[],
    applicableProcessRefs:row.applicableProcessRefs||[],applicableActivityRefs:row.applicableActivityRefs||[]
  };
}
