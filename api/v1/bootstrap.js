import { sqlClient, normalizedMode, normalizedReady } from "../../lib/db.js";
import { requireUser, hasPermission, visibleOrgIds } from "../../lib/server-authz.js";

function rowsToMap(rows,key="id"){return new Map(rows.map(r=>[String(r[key]),r]))}
function iso(v){return v?new Date(v).toISOString():null}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET"){
    res.setHeader("Allow","GET");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }
  if(!normalizedMode()) return res.status(409).json({ok:false,error:"NORMALIZED_MODE_DISABLED"});
  const auth=await requireUser(req);
  if(!auth.ok) return res.status(auth.status).json({ok:false,error:auth.error});
  const user=auth.user;
  const sql=sqlClient();

  try{
    if(!await normalizedReady(sql)) return res.status(503).json({ok:false,error:"NORMALIZED_SCHEMA_NOT_READY"});

    const scope=visibleOrgIds(user);
    const allScope=scope===null;
    const scopeIds=scope||[];

    const org=allScope
      ? await sql`SELECT id::text, code, name, unit_type AS "unitType", parent_id::text AS "parentId", status FROM org_units WHERE status='active' ORDER BY name`
      : await sql`SELECT id::text, code, name, unit_type AS "unitType", parent_id::text AS "parentId", status FROM org_units WHERE status='active' AND id::text = ANY(${scopeIds}) ORDER BY name`;

    const assessments=allScope
      ? await sql`
          SELECT a.id::text, a.program_id::text AS "programId", a.framework_id::text AS "frameworkId",
                 a.name,a.objective,a.period_from AS "periodFrom",a.period_to AS "periodTo",a.status,
                 a.lead_assessor AS "leadAssessor",a.reviewer,a.unit_representative AS "unitRepresentative",
                 a.locked_at AS "lockedAt",
                 s.org_unit_id::text AS "orgId",s.process_ref AS "processRef",s.activity_ref AS "activityRef",
                 s.location_ref AS "locationRef",s.scope_note AS "scopeNote"
          FROM compliance_assessments a
          LEFT JOIN LATERAL (
            SELECT * FROM assessment_scopes s0 WHERE s0.assessment_id=a.id ORDER BY s0.id LIMIT 1
          ) s ON true
          ORDER BY a.created_at DESC
        `
      : await sql`
          SELECT a.id::text, a.program_id::text AS "programId", a.framework_id::text AS "frameworkId",
                 a.name,a.objective,a.period_from AS "periodFrom",a.period_to AS "periodTo",a.status,
                 a.lead_assessor AS "leadAssessor",a.reviewer,a.unit_representative AS "unitRepresentative",
                 a.locked_at AS "lockedAt",
                 s.org_unit_id::text AS "orgId",s.process_ref AS "processRef",s.activity_ref AS "activityRef",
                 s.location_ref AS "locationRef",s.scope_note AS "scopeNote"
          FROM compliance_assessments a
          JOIN assessment_scopes s ON s.assessment_id=a.id
          WHERE s.org_unit_id::text = ANY(${scopeIds})
          GROUP BY a.id,s.org_unit_id,s.process_ref,s.activity_ref,s.location_ref,s.scope_note
          ORDER BY a.created_at DESC
        `;

    const assessmentIds=assessments.map(x=>x.id);

    const ra=assessmentIds.length
      ? await sql`
          SELECT id::text, assessment_id::text AS "assessmentId", requirement_id::text AS "requirementId",
                 workflow_status AS workflow, compliance_result AS result, finding_type AS "findingType",
                 observation, assessed_by AS "assessedBy", assessed_at AS "assessedAt"
          FROM requirement_assessments
          WHERE assessment_id::text = ANY(${assessmentIds})
          ORDER BY created_at NULLS LAST, id
        `
      : [];

    const raIds=ra.map(x=>x.id);
    const findings=raIds.length
      ? await sql`
          SELECT id::text, requirement_assessment_id::text AS "raId",title,fact,criteria,gap,
                 root_cause AS "rootCause",risk_impact AS impact,severity,priority,status,
                 recommendation AS rec,remediation_required AS "remediationRequired",
                 remediation_requirement AS "remediationRequirement",
                 disposition,disposition_note AS "dispositionNote",
                 finalized_by AS "finalizedBy",finalized_at AS "finalizedAt",created_at AS "createdAt"
          FROM findings WHERE requirement_assessment_id::text = ANY(${raIds})
          ORDER BY created_at DESC
        `
      : [];

    const findingIds=findings.map(x=>x.id);
    const responses=findingIds.length
      ? await sql`
          SELECT id::text, finding_id::text AS "findingId",response_type AS type,response_text AS text,
                 responded_by AS persona,responded_at AS at
          FROM unit_responses WHERE finding_id::text = ANY(${findingIds})
          ORDER BY responded_at
        `
      : [];

    const actions=findingIds.length
      ? await sql`
          SELECT id::text,finding_id::text AS "findingId",action_type AS "actionType",action_text AS text,owner,
                 owner_identity_id AS "ownerPersonaId",due_date AS due,status,progress,
                 closure_submitted_at AS "closureSubmittedAt",created_by AS "createdByPersonaId",
                 created_at AS "createdAt",verification_status AS "verificationStatus"
          FROM remediation_actions WHERE finding_id::text = ANY(${findingIds})
          ORDER BY created_at DESC
        `
      : [];

    const actionIds=actions.map(x=>x.id);
    const verifications=actionIds.length
      ? await sql`
          SELECT id::text,action_id::text AS "actionId",verifier AS "verifierPersonaId",
                 verification_date AS at,result,note,next_review_date AS "nextReviewDate"
          FROM verifications WHERE action_id::text = ANY(${actionIds})
          ORDER BY verification_date DESC
        `
      : [];

    const frameworks=await sql`
      SELECT id::text,code,name,version,status,owner,effective_from AS "effectiveFrom",
             approved_by AS "approvedBy",approved_at AS "approvedAt"
      FROM compliance_frameworks
      WHERE ${hasPermission(user,"manage_framework")} OR status='effective'
      ORDER BY code
    `;

    const requirements=await sql`
      SELECT id::text,code,title,description,source_id::text AS "sourceId",source_clause AS "sourceClause",
             parent_id::text AS "parentId",assessable,mandatory_level AS "mandatoryLevel",
             test_procedure AS test,expected_evidence AS expected,applicability,obligation_type AS "obligationType",
             status,approved_by AS "approvedBy",approved_at AS "approvedAt"
      FROM compliance_requirements
      WHERE ${hasPermission(user,"manage_framework")} OR status='effective'
      ORDER BY code
    `;

    const fr=await sql`SELECT framework_id::text AS "frameworkId",requirement_id::text AS "requirementId" FROM framework_requirements`;
    const reqIdsByFramework=new Map();
    for(const x of fr){
      if(!reqIdsByFramework.has(x.frameworkId))reqIdsByFramework.set(x.frameworkId,[]);
      reqIdsByFramework.get(x.frameworkId).push(x.requirementId);
    }
    for(const f of frameworks)f.reqIds=reqIdsByFramework.get(f.id)||[];

    const sources=await sql`
      SELECT id::text,title,source_type AS "sourceType",code AS "sourceCode",issuer,issue_date AS "issueDate",
             version,effective_from AS "effectiveFrom",effective_to AS "effectiveTo",owner,status,
             supersedes_ref AS "supersedesRef",original_filename AS "fileName",file_uri AS "fileUri",
             mime_type AS "mimeType",created_at AS "createdAt",updated_at AS "updatedAt"
      FROM compliance_sources
      WHERE ${hasPermission(user,"manage_framework")} OR status IN ('published','effective')
      ORDER BY updated_at DESC
    `;

    const draftRequirements=hasPermission(user,"manage_framework")
      ? await sql`
          SELECT id::text,source_id::text AS "sourceId",source_clause AS "sourceClause",original_text AS "originalText",
                 obligation,applicability,obligation_type AS "obligationType",mandatory_level AS "mandatoryLevel",
                 expected_evidence AS "expectedEvidence",test_procedure AS "testProcedure",
                 review_status AS "reviewStatus",reviewed_by AS "reviewedBy",reviewed_at AS "reviewedAt",
                 ai_generated AS "aiGenerated",ai_confidence AS "aiConfidence",ai_engine AS "aiEngine",
                 ai_schema_version AS "aiSchemaVersion",ai_field_confidence AS "fieldConfidence",
                 ai_review_reasons AS "aiReviewReasons",ai_uncertainties AS uncertainties
          FROM draft_requirements ORDER BY created_at DESC
        `
      : [];

    const draftIds=draftRequirements.map(x=>x.id);
    const draftReviewEvents=draftIds.length
      ? await sql`
          SELECT d.id::text,d.object_id::text AS "objectId",d.decision_type AS "decisionType",
                 d.from_state AS "fromState",d.to_state AS "toState",d.reason,d.decided_by AS "decidedBy",
                 d.decided_at AS "decidedAt",to_jsonb(d)->'metadata' AS metadata,
                 to_jsonb(d)->>'source' AS source
          FROM decision_logs d
          WHERE d.object_type='DraftRequirement' AND d.object_id::text = ANY(${draftIds})
          ORDER BY d.decided_at DESC
          LIMIT 500
        `
      : [];

    const evidenceLinks=await sql`
      SELECT id::text,evidence_revision_id::text AS "revId",target_type AS "targetType",target_id::text AS "targetId",purpose
      FROM evidence_links
      WHERE (target_type='RequirementAssessment' AND target_id::text = ANY(${raIds.length?raIds:["00000000-0000-0000-0000-000000000000"]}))
         OR (target_type='RemediationAction' AND target_id::text = ANY(${actionIds.length?actionIds:["00000000-0000-0000-0000-000000000000"]}))
    `;
    const revisionIds=evidenceLinks.map(x=>x.revId);
    const revisions=revisionIds.length
      ? await sql`
          SELECT id::text,evidence_id::text AS "evidenceId",version,file_uri AS "fileUri",
                 original_filename AS "originalFilename",mime_type AS mime,file_size AS size,
                 captured_at AS "capturedAt",sha256,storage_provider AS "storageProvider"
          FROM evidence_revisions WHERE id::text = ANY(${revisionIds})
        `
      : [];
    const evidenceIds=[...new Set(revisions.map(x=>x.evidenceId))];
    const evidence=evidenceIds.length
      ? await sql`
          SELECT id::text,name,evidence_type AS type,source_system AS "sourceSystem",
                 confidentiality,status,created_at AS "createdAt"
          FROM evidence WHERE id::text = ANY(${evidenceIds})
        `
      : [];

    const proposals=raIds.length
      ? await sql`
          SELECT id::text,assessment_id::text AS "assessmentId",proposed_requirement_id::text AS "requirementId",
                 proposed_result AS result,proposed_finding AS "proposedFinding",confidence,rationale AS text,
                 status,reviewed_by AS "reviewedBy",reviewed_at AS "reviewedAt",created_at AS "createdAt"
          FROM ai_analysis_proposals
          WHERE assessment_id::text = ANY(${assessmentIds})
          ORDER BY created_at DESC
        `
      : [];

    const assessmentLogs=assessmentIds.length
      ? await sql`
          SELECT id::text,decision_type AS type,'Assessment'::text AS object,
                 decided_at AS at,reason AS note,object_id::text AS "objectId",
                 from_state AS "fromState",to_state AS "toState",decided_by AS "decidedBy",metadata
          FROM decision_logs
          WHERE object_type='ComplianceAssessment' AND object_id::text = ANY(${assessmentIds})
          ORDER BY decided_at DESC
          LIMIT 500
        `
      : [];

    const notifications=await sql`
      SELECT n.id,n.notification_type AS type,n.severity AS level,n.object_type AS "objectType",
             n.object_id AS "objectId",n.title,n.message AS text,n.created_at AS "createdAt",
             r.read_at AS "readAt"
      FROM notifications n
      LEFT JOIN user_notification_reads r ON r.notification_id=n.id AND r.user_id=${user.id}
      WHERE n.resolved_at IS NULL
      ORDER BY n.created_at DESC
      LIMIT 200
    `;

    return res.status(200).json({
      ok:true,mode:"normalized",user,
      state:{
        meta:{demo:false,version:"1.0",dataMode:"normalized"},
        org,frameworks,requirements,sources,draftRequirements,draftReviewEvents,assessments,ra,
        evidence,revisions,links:evidenceLinks,proposals,findings,responses,actions,verifications,
        notifications,notificationSettings:{inApp:true,overdueEscalation:true},logs:assessmentLogs
      }
    });
  }catch(error){
    console.error("normalized bootstrap error",error);
    return res.status(500).json({ok:false,error:"NORMALIZED_BOOTSTRAP_ERROR"});
  }
}
