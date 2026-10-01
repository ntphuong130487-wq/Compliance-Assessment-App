import crypto from "node:crypto";
import { sqlClient, normalizedMode, normalizedReady, publicError } from "../../lib/db.js";
import { requireUser, assertPermission, assertOrgScope, hasPermission } from "../../lib/server-authz.js";

function dateOnly(v){if(!v)return null;if(v instanceof Date)return v.toISOString().slice(0,10);const s=String(v);return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):null;}

async function assessmentOrg(sql,assessmentId){
  const rows=await sql`
    SELECT s.org_unit_id::text AS "orgId"
    FROM assessment_scopes s
    WHERE s.assessment_id=${assessmentId}::uuid
    ORDER BY s.id LIMIT 1
  `;
  return rows[0]?.orgId||null;
}

async function assessmentContext(sql,assessmentId){
  const rows=await sql`
    SELECT a.id::text,a.status,a.locked_at AS "lockedAt",a.reviewer,
           s.org_unit_id::text AS "orgId"
    FROM compliance_assessments a
    LEFT JOIN LATERAL (
      SELECT org_unit_id FROM assessment_scopes s0 WHERE s0.assessment_id=a.id ORDER BY s0.id LIMIT 1
    ) s ON true
    WHERE a.id=${assessmentId}::uuid
  `;
  return rows[0]||null;
}

async function assessmentGate(sql,assessmentId){
  const ra=await sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE workflow_status='done' AND compliance_result<>'not_assessed')::int AS done
    FROM requirement_assessments
    WHERE assessment_id=${assessmentId}::uuid
  `;
  const findings=await sql`
    SELECT
      count(*) FILTER (WHERE f.status IN ('pending_unit_response','pending_final_review','draft'))::int AS pending,
      count(*) FILTER (WHERE f.status='final')::int AS final_count,
      count(*) FILTER (
        WHERE f.status='final' AND f.remediation_required=true
          AND NOT EXISTS (
            SELECT 1 FROM remediation_actions a
            WHERE a.finding_id=f.id AND a.action_type='mandatory_remediation'
          )
      )::int AS mandatory_without_action
    FROM findings f
    JOIN requirement_assessments r ON r.id=f.requirement_assessment_id
    WHERE r.assessment_id=${assessmentId}::uuid
  `;
  const assignments=await sql`
    SELECT count(*)::int AS unassigned
    FROM requirement_assessments r
    WHERE r.assessment_id=${assessmentId}::uuid
      AND NOT EXISTS (
        SELECT 1 FROM requirement_assessment_assignments x
        WHERE x.requirement_assessment_id=r.id
          AND x.assignment_role='primary_assessor'
          AND x.status='active'
      )
  `;
  return {
    total:Number(ra[0]?.total||0),
    done:Number(ra[0]?.done||0),
    pendingFindings:Number(findings[0]?.pending||0),
    finalFindings:Number(findings[0]?.final_count||0),
    mandatoryFindingsWithoutAction:Number(findings[0]?.mandatory_without_action||0),
    unassignedRequirements:Number(assignments[0]?.unassigned||0)
  };
}

async function recordAssessmentDecision(sql,user,assessmentId,decisionType,fromState,toState,metadata={}){
  await sql`
    INSERT INTO decision_logs
      (id,object_type,object_id,decision_type,from_state,to_state,decided_by,decided_at,metadata,source)
    VALUES
      (${crypto.randomUUID()}::uuid,'ComplianceAssessment',${assessmentId}::uuid,${decisionType},
       ${fromState||null},${toState||null},${user.id},now(),${JSON.stringify(metadata)}::jsonb,'compliance-app')
  `;
}

async function findingContext(sql,findingId){
  const rows=await sql`
    SELECT f.id::text,f.status,ra.assessment_id::text AS "assessmentId",s.org_unit_id::text AS "orgId"
    FROM findings f
    JOIN requirement_assessments ra ON ra.id=f.requirement_assessment_id
    LEFT JOIN LATERAL (
      SELECT org_unit_id FROM assessment_scopes s0 WHERE s0.assessment_id=ra.assessment_id ORDER BY s0.id LIMIT 1
    ) s ON true
    WHERE f.id=${findingId}::uuid
  `;
  return rows[0]||null;
}

async function draftAuditRow(sql,id){
  const rows=await sql`
    SELECT id::text,review_status AS "reviewStatus",ai_generated AS "aiGenerated",
           ai_confidence AS "aiConfidence",ai_engine AS "aiEngine",ai_schema_version AS "aiSchemaVersion",
           ai_review_reasons AS "aiReviewReasons",ai_uncertainties AS uncertainties
    FROM draft_requirements
    WHERE id=${id}::uuid
  `;
  return rows[0]||null;
}

async function recordDraftDecision(sql,user,row,decisionType,fromState,toState,reason=null,extra={}){
  if(!row?.id)return;
  const metadata={
    aiGenerated:Boolean(row.aiGenerated),
    aiConfidence:row.aiConfidence==null?null:Number(row.aiConfidence),
    aiEngine:row.aiEngine||null,
    aiSchemaVersion:row.aiSchemaVersion||null,
    aiReviewReasons:Array.isArray(row.aiReviewReasons)?row.aiReviewReasons:[],
    uncertainties:Array.isArray(row.uncertainties)?row.uncertainties:[],
    ...extra
  };
  try{
    await sql`
      INSERT INTO decision_logs
        (id,object_type,object_id,decision_type,from_state,to_state,reason,decided_by,decided_at,metadata,source)
      VALUES
        (${crypto.randomUUID()}::uuid,'DraftRequirement',${row.id}::uuid,${decisionType},
         ${fromState||null},${toState||null},${reason||null},${user.id},now(),${JSON.stringify(metadata)}::jsonb,'compliance-app')
    `;
  }catch(error){
    if(error?.code!=="42703")throw error;
    await sql`
      INSERT INTO decision_logs
        (id,object_type,object_id,decision_type,from_state,to_state,reason,decided_by,decided_at,approval_ref)
      VALUES
        (${crypto.randomUUID()}::uuid,'DraftRequirement',${row.id}::uuid,${decisionType},
         ${fromState||null},${toState||null},${reason||null},${user.id},now(),'audit-metadata-pending-migration')
    `;
  }
}

async function requirementAssignmentContext(sql,raId){
  const rows=await sql`
    SELECT r.id::text,r.assessment_id::text AS "assessmentId",a.status AS "assessmentStatus",
           s.org_unit_id::text AS "orgId"
    FROM requirement_assessments r
    JOIN compliance_assessments a ON a.id=r.assessment_id
    LEFT JOIN LATERAL (
      SELECT org_unit_id FROM assessment_scopes s0 WHERE s0.assessment_id=a.id ORDER BY s0.id LIMIT 1
    ) s ON true
    WHERE r.id=${raId}::uuid
  `;
  return rows[0]||null;
}

async function userAssignedToRequirement(sql,raId,userId){
  const rows=await sql`
    SELECT 1 FROM requirement_assessment_assignments
    WHERE requirement_assessment_id=${raId}::uuid
      AND user_id=${userId}
      AND status='active'
    LIMIT 1
  `;
  return rows.length>0;
}

async function assertRequirementWorkAccess(sql,user,raId){
  if(hasPermission(user,"assign_assessment_work"))return true;
  if(await userAssignedToRequirement(sql,raId,user.id))return true;
  const e=new Error("REQUIREMENT_NOT_ASSIGNED_TO_USER");
  e.status=403;e.code="REQUIREMENT_NOT_ASSIGNED_TO_USER";
  throw e;
}

async function actionContext(sql,actionId){
  const rows=await sql`
    SELECT a.id::text,a.status,a.owner_identity_id AS "ownerIdentityId",a.finding_id::text AS "findingId",
           ra.assessment_id::text AS "assessmentId",s.org_unit_id::text AS "orgId"
    FROM remediation_actions a
    JOIN findings f ON f.id=a.finding_id
    JOIN requirement_assessments ra ON ra.id=f.requirement_assessment_id
    LEFT JOIN LATERAL (
      SELECT org_unit_id FROM assessment_scopes s0 WHERE s0.assessment_id=ra.assessment_id ORDER BY s0.id LIMIT 1
    ) s ON true
    WHERE a.id=${actionId}::uuid
  `;
  return rows[0]||null;
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST"){
    res.setHeader("Allow","POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }
  if(!normalizedMode()) return res.status(409).json({ok:false,error:"NORMALIZED_MODE_DISABLED"});
  const auth=await requireUser(req);
  if(!auth.ok) return res.status(auth.status).json({ok:false,error:auth.error});
  const user=auth.user,sql=sqlClient();

  try{
    if(!await normalizedReady(sql)) return res.status(503).json({ok:false,error:"NORMALIZED_SCHEMA_NOT_READY"});
    const command=String(req.body?.command||"");
    const p=req.body?.payload||{};

    if(command==="source.create"){
      assertPermission(user,"manage_framework");
      const id=crypto.randomUUID();
      const rows=await sql`
        INSERT INTO compliance_sources
          (id,source_type,code,title,version,effective_from,effective_to,owner,issuer,issue_date,status,
           supersedes_ref,original_filename,mime_type,created_at,updated_at)
        VALUES
          (${id}::uuid,${p.sourceType||"Tệp đính kèm"},${p.sourceCode||null},${p.title},
           ${p.version||null},${p.effectiveFrom||null}::date,${p.effectiveTo||null}::date,
           ${p.owner||null},${p.issuer||null},${p.issueDate||null}::date,'draft',
           ${p.supersedesRef||null},${p.fileName||null},${p.mimeType||null},now(),now())
        RETURNING id::text,title,status
      `;
      return res.status(201).json({ok:true,record:rows[0]});
    }

    if(command==="source.update"){
      assertPermission(user,"manage_framework");
      const rows=await sql`
        UPDATE compliance_sources SET
          title=COALESCE(${p.title||null},title),
          source_type=COALESCE(${p.sourceType||null},source_type),
          code=${p.sourceCode||null},issuer=${p.issuer||null},issue_date=${p.issueDate||null}::date,
          version=${p.version||null},effective_from=${p.effectiveFrom||null}::date,
          effective_to=${p.effectiveTo||null}::date,owner=${p.owner||null},
          supersedes_ref=${p.supersedesRef||null},
          status=CASE WHEN ${p.status||null} IN ('draft','extracted','needs_ocr','error','pending_approval','published','effective') THEN ${p.status||null} ELSE status END,
          updated_at=now()
        WHERE id=${p.id}::uuid
        RETURNING id::text,title,status
      `;
      if(!rows.length)return res.status(404).json({ok:false,error:"SOURCE_NOT_FOUND"});
      return res.status(200).json({ok:true,record:rows[0]});
    }

    if(command==="framework.createManual"){
      assertPermission(user,"manage_framework");
      const code=String(p.code||"").trim().toUpperCase();
      const items=Array.isArray(p.requirements)?p.requirements.map(x=>String(x||"").trim()).filter(Boolean):[];
      if(!code||!p.name||!p.basis||!items.length)return res.status(400).json({ok:false,error:"MANUAL_FRAMEWORK_FIELDS_REQUIRED"});
      const existing=await sql`SELECT 1 FROM compliance_frameworks WHERE code=${code}`;
      if(existing.length)return res.status(409).json({ok:false,error:"FRAMEWORK_CODE_EXISTS"});
      const sourceId=crypto.randomUUID(),frameworkId=crypto.randomUUID();
      await sql`
        INSERT INTO compliance_sources(id,source_type,code,title,status,owner,created_at,updated_at)
        VALUES(${sourceId}::uuid,'Manual/Internal Interpretation',${code+"-SRC"},${"Manual/Internal Interpretation · "+p.name},'pending_approval',${user.id},now(),now())
      `;
      await sql`
        INSERT INTO compliance_frameworks(id,code,name,version,status,owner,created_at,updated_at)
        VALUES(${frameworkId}::uuid,${code},${p.name},'0.1','pending_approval',${user.id},now(),now())
      `;
      const created=[];
      for(let i=0;i<items.length;i++){
        const rid=crypto.randomUUID(),reqCode=code+"-"+String(i+1).padStart(3,"0");
        await sql`
          INSERT INTO compliance_requirements
            (id,code,title,description,source_id,assessable,mandatory_level,test_procedure,expected_evidence,status,created_at)
          VALUES
            (${rid}::uuid,${reqCode},${items[i]},${p.basis},${sourceId}::uuid,true,'review','Cần xác định','Cần xác định','pending_approval',now())
        `;
        await sql`INSERT INTO framework_requirements(framework_id,requirement_id) VALUES(${frameworkId}::uuid,${rid}::uuid)`;
        created.push({id:rid,code:reqCode});
      }
      return res.status(201).json({ok:true,record:{id:frameworkId,code,name:p.name,status:"pending_approval"},requirements:created});
    }

    if(command==="assessment.create"){
      assertPermission(user,"manage_assessment");
      assertOrgScope(user,p.orgId);
      const assessmentId=crypto.randomUUID(),scopeId=crypto.randomUUID();
      const reqIds=Array.isArray(p.requirementIds)?p.requirementIds.filter(Boolean):[];
      if(!reqIds.length) return res.status(400).json({ok:false,error:"NO_APPLICABLE_REQUIREMENTS"});

      const framework=await sql`SELECT id::text,status FROM compliance_frameworks WHERE id=${p.frameworkId}::uuid`;
      if(!framework.length) return res.status(404).json({ok:false,error:"FRAMEWORK_NOT_FOUND"});

      const eligible=await sql`
        SELECT r.id::text
        FROM compliance_requirements r
        JOIN framework_requirements fr ON fr.requirement_id=r.id
        WHERE fr.framework_id=${p.frameworkId}::uuid
          AND r.status='effective'
          AND r.id::text = ANY(${reqIds})
      `;
      if(eligible.length!==reqIds.length) return res.status(409).json({ok:false,error:"REQUIREMENT_SET_INVALID"});

      await sql`
        INSERT INTO compliance_assessments
          (id,framework_id,name,objective,period_from,period_to,status,lead_assessor,reviewer,unit_representative,created_at,updated_at)
        VALUES
          (${assessmentId}::uuid,${p.frameworkId}::uuid,${p.name},${p.objective||null},
           ${p.periodFrom||null}::date,${p.periodTo||null}::date,'draft',
           ${p.leadAssessor||null},${p.reviewer||null},${p.unitRepresentative||null},now(),now())
      `;
      await sql`
        INSERT INTO assessment_scopes
          (id,assessment_id,org_unit_id,process_ref,activity_ref,location_ref,scope_note,include_all_requirements)
        VALUES
          (${scopeId}::uuid,${assessmentId}::uuid,${p.orgId}::uuid,${p.processRef||null},
           ${p.activityRef||null},${p.locationRef||null},${p.scopeNote||null},false)
      `;
      for(const r of eligible){
        await sql`
          INSERT INTO requirement_assessments
            (id,assessment_id,requirement_id,workflow_status,compliance_result)
          VALUES(${crypto.randomUUID()}::uuid,${assessmentId}::uuid,${r.id}::uuid,'to_do','not_assessed')
        `;
      }
      return res.status(201).json({ok:true,record:{id:assessmentId,status:"draft",requirementCount:eligible.length}});
    }

    if(command==="assessment.assignRequirements"){
      assertPermission(user,"assign_assessment_work");
      const ctx=await assessmentContext(sql,p.assessmentId);
      if(!ctx)return res.status(404).json({ok:false,error:"ASSESSMENT_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
      if(!["draft","fieldwork"].includes(ctx.status)){
        return res.status(409).json({ok:false,error:"ASSESSMENT_ASSIGNMENT_LOCKED"});
      }
      const items=Array.isArray(p.assignments)?p.assignments:[];
      if(!items.length)return res.status(400).json({ok:false,error:"NO_ASSIGNMENTS"});
      const raIds=[...new Set(items.map(x=>String(x.raId||"")).filter(Boolean))];
      const validRa=await sql`
        SELECT id::text FROM requirement_assessments
        WHERE assessment_id=${p.assessmentId}::uuid AND id::text = ANY(${raIds})
      `;
      if(validRa.length!==raIds.length)return res.status(409).json({ok:false,error:"ASSIGNMENT_REQUIREMENT_SCOPE_MISMATCH"});
      const userIds=[...new Set(items.map(x=>String(x.userId||"")).filter(Boolean))];
      const users=userIds.length?await sql`
        SELECT id,display_name AS name,email,role_code AS role,status,public_metadata AS "publicMetadata"
        FROM app_users WHERE id = ANY(${userIds}) AND status='active'
      `:[];
      if(users.length!==userIds.length)return res.status(409).json({ok:false,error:"ASSIGNEE_NOT_ACTIVE"});
      const byId=new Map(users.map(x=>[String(x.id),x]));
      const currentAssignments=await sql`
        SELECT requirement_assessment_id::text AS "raId",user_id AS "userId"
        FROM requirement_assessment_assignments
        WHERE requirement_assessment_id::text = ANY(${raIds})
          AND assignment_role='primary_assessor' AND status='active'
      `;
      const currentByRa=new Map(currentAssignments.map(x=>[String(x.raId),String(x.userId)]));
      for(const item of items){
        const assignee=byId.get(String(item.userId||""));
        if(!assignee||!hasPermission({role:assignee.role},"conduct_fieldwork")){
          return res.status(409).json({ok:false,error:"ASSIGNEE_CANNOT_CONDUCT_FIELDWORK"});
        }
        const orgs=Array.isArray(assignee.publicMetadata?.orgIds)?assignee.publicMetadata.orgIds.map(String):[];
        if(!orgs.includes("*")&&!orgs.includes(String(ctx.orgId))){
          return res.status(409).json({ok:false,error:"ASSIGNEE_OUTSIDE_ORG_SCOPE"});
        }
      }
      const statements=[];
      for(const item of items){
        const assignee=byId.get(String(item.userId));
        statements.push(sql`
          UPDATE requirement_assessment_assignments
          SET status='inactive'
          WHERE requirement_assessment_id=${item.raId}::uuid
            AND assignment_role='primary_assessor'
            AND status='active'
            AND user_id<>${item.userId}
        `);
        statements.push(sql`
          INSERT INTO requirement_assessment_assignments
            (id,requirement_assessment_id,user_id,display_name,assignment_role,assigned_by,assigned_at,status)
          VALUES
            (${crypto.randomUUID()}::uuid,${item.raId}::uuid,${item.userId},
             ${assignee.name||assignee.email||item.userId},'primary_assessor',${user.id},now(),'active')
          ON CONFLICT DO NOTHING
        `);
        statements.push(sql`
          INSERT INTO decision_logs
            (id,object_type,object_id,decision_type,from_state,to_state,decided_by,decided_at,metadata,source)
          VALUES
            (${crypto.randomUUID()}::uuid,'RequirementAssessment',${item.raId}::uuid,'assign_primary_assessor',
             ${currentByRa.get(String(item.raId))||null},${item.userId},${user.id},now(),
             ${JSON.stringify({assessmentId:p.assessmentId,assigneeName:assignee.name||assignee.email||item.userId})}::jsonb,'compliance-app')
        `);
      }
      await sql.transaction(statements);
      return res.status(200).json({ok:true,count:items.length});
    }

    if(command==="assessment.startFieldwork"){
      assertPermission(user,"manage_assessment");
      const ctx=await assessmentContext(sql,p.assessmentId);
      if(!ctx)return res.status(404).json({ok:false,error:"ASSESSMENT_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
      if(ctx.status!=="draft")return res.status(409).json({ok:false,error:"ASSESSMENT_NOT_DRAFT"});
      const gate=await assessmentGate(sql,p.assessmentId);
      if(gate.total<1)return res.status(409).json({ok:false,error:"ASSESSMENT_REQUIREMENTS_REQUIRED"});
      if(gate.unassignedRequirements>0)return res.status(409).json({ok:false,error:"ASSESSMENT_ASSIGNMENTS_INCOMPLETE",gate});
      await sql.transaction([
        sql`
          UPDATE compliance_assessments
          SET status='fieldwork',locked_at=COALESCE(locked_at,now()),updated_at=now()
          WHERE id=${p.assessmentId}::uuid AND status='draft'
        `,
        sql`
          INSERT INTO decision_logs
            (id,object_type,object_id,decision_type,from_state,to_state,decided_by,decided_at,metadata,source)
          VALUES
            (${crypto.randomUUID()}::uuid,'ComplianceAssessment',${p.assessmentId}::uuid,'start_fieldwork',
             'draft','fieldwork',${user.id},now(),${JSON.stringify({scopeFrozen:true,requirementCount:gate.total})}::jsonb,'compliance-app')
        `
      ]);
      return res.status(200).json({ok:true,status:"fieldwork",scopeFrozen:true,gate});
    }

    if(command==="assessment.submitForReview"){
      const ctx=await assessmentContext(sql,p.assessmentId);
      if(!ctx)return res.status(404).json({ok:false,error:"ASSESSMENT_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
      if(!hasPermission(user,"manage_assessment")&&!hasPermission(user,"conduct_fieldwork")){
        return res.status(403).json({ok:false,error:"FORBIDDEN"});
      }
      if(ctx.status!=="fieldwork")return res.status(409).json({ok:false,error:"ASSESSMENT_NOT_IN_FIELDWORK"});
      const gate=await assessmentGate(sql,p.assessmentId);
      if(gate.total<1||gate.done!==gate.total){
        return res.status(409).json({ok:false,error:"ASSESSMENT_REQUIREMENTS_INCOMPLETE",gate});
      }
      if(gate.pendingFindings>0){
        return res.status(409).json({ok:false,error:"ASSESSMENT_FINDINGS_PENDING",gate});
      }
      if(gate.mandatoryFindingsWithoutAction>0){
        return res.status(409).json({ok:false,error:"MANDATORY_REMEDIATION_ACTION_REQUIRED",gate});
      }
      await sql.transaction([
        sql`UPDATE compliance_assessments SET status='review',updated_at=now() WHERE id=${p.assessmentId}::uuid AND status='fieldwork'`,
        sql`
          INSERT INTO decision_logs
            (id,object_type,object_id,decision_type,from_state,to_state,decided_by,decided_at,metadata,source)
          VALUES
            (${crypto.randomUUID()}::uuid,'ComplianceAssessment',${p.assessmentId}::uuid,'submit_for_review',
             'fieldwork','review',${user.id},now(),${JSON.stringify(gate)}::jsonb,'compliance-app')
        `
      ]);
      return res.status(200).json({ok:true,status:"review",gate});
    }

    if(command==="assessment.close"){
      assertPermission(user,"review_assessment");
      const ctx=await assessmentContext(sql,p.assessmentId);
      if(!ctx)return res.status(404).json({ok:false,error:"ASSESSMENT_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
      if(ctx.status!=="review")return res.status(409).json({ok:false,error:"ASSESSMENT_NOT_IN_REVIEW"});
      const gate=await assessmentGate(sql,p.assessmentId);
      if(gate.total<1||gate.done!==gate.total){
        return res.status(409).json({ok:false,error:"ASSESSMENT_REQUIREMENTS_INCOMPLETE",gate});
      }
      if(gate.pendingFindings>0){
        return res.status(409).json({ok:false,error:"ASSESSMENT_FINDINGS_PENDING",gate});
      }
      if(gate.mandatoryFindingsWithoutAction>0){
        return res.status(409).json({ok:false,error:"MANDATORY_REMEDIATION_ACTION_REQUIRED",gate});
      }
      await sql.transaction([
        sql`UPDATE compliance_assessments SET status='closed',updated_at=now() WHERE id=${p.assessmentId}::uuid AND status='review'`,
        sql`
          INSERT INTO decision_logs
            (id,object_type,object_id,decision_type,from_state,to_state,reason,decided_by,decided_at,metadata,source)
          VALUES
            (${crypto.randomUUID()}::uuid,'ComplianceAssessment',${p.assessmentId}::uuid,'close_assessment',
             'review','closed',${p.note||null},${user.id},now(),${JSON.stringify({...gate,actionsMayRemainOpen:true})}::jsonb,'compliance-app')
        `
      ]);
      return res.status(200).json({ok:true,status:"closed",gate,actionsMayRemainOpen:true});
    }

    if(command==="requirementAssessment.update"){
      assertPermission(user,"conduct_fieldwork");
      const assessment=await assessmentContext(sql,p.assessmentId);
      if(!assessment)return res.status(404).json({ok:false,error:"ASSESSMENT_NOT_FOUND"});
      assertOrgScope(user,assessment.orgId);
      if(assessment.status!=="fieldwork")return res.status(409).json({ok:false,error:"ASSESSMENT_FIELDWORK_NOT_ACTIVE"});
      await assertRequirementWorkAccess(sql,user,p.id);
      const result=String(p.result||"not_assessed");
      const workflow=String(p.workflow||"in_review");
      if(!["not_assessed","compliant","partially_compliant","non_compliant","not_applicable","insufficient_evidence"].includes(result)){
        return res.status(400).json({ok:false,error:"INVALID_COMPLIANCE_RESULT"});
      }
      if(!["to_do","in_review","done"].includes(workflow)){
        return res.status(400).json({ok:false,error:"INVALID_REQUIREMENT_WORKFLOW"});
      }
      const rows=await sql`
        UPDATE requirement_assessments
        SET workflow_status=${workflow},
            compliance_result=${result},
            observation=${p.observation||null},
            assessed_by=${user.id},
            assessed_at=now()
        WHERE id=${p.id}::uuid AND assessment_id=${p.assessmentId}::uuid
        RETURNING id::text,workflow_status AS workflow,compliance_result AS result,observation,assessed_at AS "assessedAt"
      `;
      if(!rows.length)return res.status(404).json({ok:false,error:"REQUIREMENT_ASSESSMENT_NOT_FOUND"});
      return res.status(200).json({ok:true,record:rows[0]});
    }

    if(command==="finding.create"){
      assertPermission(user,"confirm_finding");
      const assessment=await assessmentContext(sql,p.assessmentId);
      if(!assessment)return res.status(404).json({ok:false,error:"ASSESSMENT_NOT_FOUND"});
      assertOrgScope(user,assessment.orgId);
      if(assessment.status!=="fieldwork")return res.status(409).json({ok:false,error:"ASSESSMENT_FIELDWORK_NOT_ACTIVE"});
      await assertRequirementWorkAccess(sql,user,p.raId);
      const ra=await sql`
        SELECT id::text FROM requirement_assessments
        WHERE id=${p.raId}::uuid AND assessment_id=${p.assessmentId}::uuid
      `;
      if(!ra.length)return res.status(409).json({ok:false,error:"REQUIREMENT_ASSESSMENT_SCOPE_MISMATCH"});
      const id=crypto.randomUUID();
      const rows=await sql`
        INSERT INTO findings
          (id,requirement_assessment_id,title,fact,criteria,gap,risk_impact,severity,priority,status,recommendation,created_at)
        VALUES
          (${id}::uuid,${p.raId}::uuid,${p.title},${p.fact},${p.criteria},${p.gap},
           ${p.impact||null},${p.severity||"medium"},${p.priority||null},'pending_unit_response',${p.rec||null},now())
        RETURNING id::text,status,created_at AS "createdAt"
      `;
      await sql`UPDATE requirement_assessments SET workflow_status='in_review' WHERE id=${p.raId}::uuid AND assessment_id=${p.assessmentId}::uuid`;
      return res.status(201).json({ok:true,record:rows[0]});
    }

    if(command==="finding.respond"){
      assertPermission(user,"respond_finding");
      const ctx=await findingContext(sql,p.findingId);if(!ctx) return res.status(404).json({ok:false,error:"FINDING_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
      if(ctx.status!=="pending_unit_response")return res.status(409).json({ok:false,error:"FINDING_NOT_AWAITING_UNIT_RESPONSE"});
      const id=crypto.randomUUID();
      await sql`
        INSERT INTO unit_responses(id,finding_id,response_type,response_text,responded_by,responded_at)
        VALUES(${id}::uuid,${p.findingId}::uuid,${p.type},${p.text},${user.id},now())
      `;
      await sql`UPDATE findings SET status='pending_final_review',updated_at=now() WHERE id=${p.findingId}::uuid`;
      return res.status(201).json({ok:true,id,status:"pending_final_review"});
    }

    if(command==="finding.finalize"){
      assertPermission(user,"confirm_finding");
      const ctx=await findingContext(sql,p.findingId);if(!ctx) return res.status(404).json({ok:false,error:"FINDING_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
      if(ctx.status!=="pending_final_review")return res.status(409).json({ok:false,error:"FINDING_NOT_READY_FOR_FINAL_REVIEW"});
      if(!["keep","adjust","dismiss"].includes(String(p.disposition||"keep"))){
        return res.status(400).json({ok:false,error:"INVALID_FINDING_DISPOSITION"});
      }
      const status=p.disposition==="dismiss"?"dismissed":"final";
      const remediationRequired=status==="final"&&Boolean(p.remediationRequired);
      const remediationRequirement=String(p.remediationRequirement||"").trim();
      if(remediationRequired&&!remediationRequirement){
        return res.status(400).json({ok:false,error:"REMEDIATION_REQUIREMENT_REQUIRED"});
      }
      await sql`
        UPDATE findings SET
          title=COALESCE(${p.title||null},title),gap=COALESCE(${p.gap||null},gap),
          recommendation=${p.rec||null},
          remediation_required=${remediationRequired},
          remediation_requirement=${remediationRequired?remediationRequirement:null},
          disposition=${p.disposition||"keep"},disposition_note=${p.dispositionNote},
          finalized_by=${user.id},finalized_at=now(),status=${status},updated_at=now()
        WHERE id=${p.findingId}::uuid
      `;
      await sql`
        UPDATE requirement_assessments SET compliance_result=${p.result||"non_compliant"},workflow_status='done',
            assessed_by=${user.id},assessed_at=now()
        WHERE id=(SELECT requirement_assessment_id FROM findings WHERE id=${p.findingId}::uuid)
      `;
      return res.status(200).json({ok:true,status});
    }

    if(command==="action.create"){
      assertPermission(user,"assign_action");
      const ctx=await findingContext(sql,p.findingId);if(!ctx) return res.status(404).json({ok:false,error:"FINDING_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
      if(ctx.status!=="final")return res.status(409).json({ok:false,error:"FINAL_FINDING_REQUIRED"});
      if(!String(p.text||"").trim()||!String(p.ownerIdentityId||"").trim()){
        return res.status(400).json({ok:false,error:"ACTION_OWNER_AND_TEXT_REQUIRED"});
      }
      const actionType=["mandatory_remediation","improvement_action"].includes(String(p.actionType))?String(p.actionType):"mandatory_remediation";
      const findingPolicy=await sql`
        SELECT remediation_required AS "remediationRequired"
        FROM findings WHERE id=${p.findingId}::uuid
      `;
      if(actionType==="mandatory_remediation"&&!findingPolicy[0]?.remediationRequired){
        return res.status(409).json({ok:false,error:"MANDATORY_ACTION_NOT_REQUIRED"});
      }
      const id=crypto.randomUUID();
      const rows=await sql`
        INSERT INTO remediation_actions
          (id,finding_id,action_type,action_text,owner,owner_identity_id,due_date,status,progress,created_by,created_at,updated_at)
        VALUES
          (${id}::uuid,${p.findingId}::uuid,${actionType},${p.text},${p.owner},${p.ownerIdentityId||null},
           ${p.due||null}::date,'open',0,${user.id},now(),now())
        RETURNING id::text,status,created_at AS "createdAt"
      `;
      return res.status(201).json({ok:true,record:rows[0]});
    }

    if(command==="action.updateProgress"){
      const ctx=await actionContext(sql,p.actionId);if(!ctx)return res.status(404).json({ok:false,error:"ACTION_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
      if(!["open","reopened"].includes(ctx.status))return res.status(409).json({ok:false,error:"ACTION_PROGRESS_NOT_EDITABLE"});
      const isOwner=ctx.ownerIdentityId===user.id;
      if(!isOwner&&!hasPermission(user,"update_assigned_action")&&!hasPermission(user,"assign_action")){
        return res.status(403).json({ok:false,error:"FORBIDDEN"});
      }
      const progress=Number(p.progress);
      const note=String(p.note||"").trim();
      if(!Number.isInteger(progress)||progress<0||progress>100)return res.status(400).json({ok:false,error:"INVALID_ACTION_PROGRESS"});
      if(!note)return res.status(400).json({ok:false,error:"ACTION_PROGRESS_NOTE_REQUIRED"});
      const before=await sql`SELECT progress FROM remediation_actions WHERE id=${p.actionId}::uuid`;
      const previous=Number(before[0]?.progress||0);
      await sql.transaction([
        sql`UPDATE remediation_actions SET progress=${progress},updated_at=now() WHERE id=${p.actionId}::uuid`,
        sql`
          INSERT INTO decision_logs
            (id,object_type,object_id,decision_type,from_state,to_state,reason,decided_by,decided_at,metadata,source)
          VALUES
            (${crypto.randomUUID()}::uuid,'RemediationAction',${p.actionId}::uuid,'progress_update',
             ${String(previous)},${String(progress)},${note},${user.id},now(),
             ${JSON.stringify({previousProgress:previous,newProgress:progress})}::jsonb,'compliance-app')
        `
      ]);
      return res.status(200).json({ok:true,progress,previousProgress:previous});
    }

    if(command==="action.requestDueDateChange"){
      const ctx=await actionContext(sql,p.actionId);if(!ctx)return res.status(404).json({ok:false,error:"ACTION_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
      if(!["open","reopened"].includes(ctx.status))return res.status(409).json({ok:false,error:"ACTION_DUE_DATE_NOT_EDITABLE"});
      const isOwner=ctx.ownerIdentityId===user.id;
      if(!isOwner&&!hasPermission(user,"update_assigned_action")&&!hasPermission(user,"assign_action")){
        return res.status(403).json({ok:false,error:"FORBIDDEN"});
      }
      const requestedDueDate=String(p.requestedDueDate||"").trim();
      const reason=String(p.reason||"").trim();
      if(!/^\d{4}-\d{2}-\d{2}$/.test(requestedDueDate))return res.status(400).json({ok:false,error:"VALID_REQUESTED_DUE_DATE_REQUIRED"});
      if(!reason)return res.status(400).json({ok:false,error:"DUE_DATE_CHANGE_REASON_REQUIRED"});
      const action=await sql`SELECT due_date AS "dueDate" FROM remediation_actions WHERE id=${p.actionId}::uuid`;
      const currentDue=dateOnly(action[0]?.dueDate);
      if(currentDue===requestedDueDate)return res.status(409).json({ok:false,error:"DUE_DATE_UNCHANGED"});
      const pending=await sql`
        SELECT id::text FROM remediation_action_change_requests
        WHERE action_id=${p.actionId}::uuid AND request_type='due_date_change' AND status='pending'
      `;
      if(pending.length)return res.status(409).json({ok:false,error:"DUE_DATE_CHANGE_ALREADY_PENDING"});
      const id=crypto.randomUUID();
      await sql`
        INSERT INTO remediation_action_change_requests
          (id,action_id,request_type,current_due_date,requested_due_date,reason,requested_by,requested_at,status)
        VALUES
          (${id}::uuid,${p.actionId}::uuid,'due_date_change',${currentDue}::date,${requestedDueDate}::date,
           ${reason},${user.id},now(),'pending')
      `;
      await sql`
        INSERT INTO decision_logs
          (id,object_type,object_id,decision_type,from_state,to_state,reason,decided_by,decided_at,metadata,source)
        VALUES
          (${crypto.randomUUID()}::uuid,'RemediationAction',${p.actionId}::uuid,'due_date_change_requested',
           ${currentDue},${requestedDueDate},${reason},${user.id},now(),
           ${JSON.stringify({requestId:id})}::jsonb,'compliance-app')
      `;
      return res.status(201).json({ok:true,requestId:id,status:"pending",currentDueDate:currentDue,requestedDueDate});
    }

    if(command==="action.decideDueDateChange"){
      assertPermission(user,"approve_action_change");
      const requestId=String(p.requestId||"").trim();
      const decision=String(p.decision||"");
      const decisionNote=String(p.decisionNote||"").trim();
      if(!["approved","rejected"].includes(decision))return res.status(400).json({ok:false,error:"INVALID_DUE_DATE_DECISION"});
      if(decision==="rejected"&&!decisionNote)return res.status(400).json({ok:false,error:"DUE_DATE_DECISION_NOTE_REQUIRED"});
      const reqRows=await sql`
        SELECT id::text,action_id::text AS "actionId",current_due_date AS "currentDueDate",
               requested_due_date AS "requestedDueDate",reason,requested_by AS "requestedBy",status
        FROM remediation_action_change_requests WHERE id=${requestId}::uuid
      `;
      const change=reqRows[0];if(!change)return res.status(404).json({ok:false,error:"ACTION_CHANGE_REQUEST_NOT_FOUND"});
      if(change.status!=="pending")return res.status(409).json({ok:false,error:"ACTION_CHANGE_REQUEST_NOT_PENDING"});
      const ctx=await actionContext(sql,change.actionId);if(!ctx)return res.status(404).json({ok:false,error:"ACTION_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
      if(change.requestedBy===user.id)return res.status(409).json({ok:false,error:"SELF_APPROVAL_FORBIDDEN"});
      if(!["open","reopened"].includes(ctx.status))return res.status(409).json({ok:false,error:"ACTION_DUE_DATE_NOT_EDITABLE"});
      const metadata=JSON.stringify({requestId,requestedBy:change.requestedBy,requestReason:change.reason});
      const decisionType="due_date_change_"+decision;
      const requestedDue=dateOnly(change.requestedDueDate);
      const priorDue=dateOnly(change.currentDueDate);
      const statements=[
        sql`
          UPDATE remediation_action_change_requests
          SET status=${decision},decided_by=${user.id},decided_at=now(),decision_note=${decisionNote||null}
          WHERE id=${requestId}::uuid AND status='pending'
        `,
        sql`
          INSERT INTO decision_logs
            (id,object_type,object_id,decision_type,from_state,to_state,reason,decided_by,decided_at,metadata,source)
          VALUES
            (${crypto.randomUUID()}::uuid,'RemediationAction',${change.actionId}::uuid,${decisionType},
             ${priorDue},
             ${requestedDue},
             ${decisionNote||change.reason},${user.id},now(),${metadata}::jsonb,'compliance-app')
        `
      ];
      if(decision==="approved"){
        statements.unshift(sql`
          UPDATE remediation_actions
          SET due_date=${requestedDue}::date,updated_at=now()
          WHERE id=${change.actionId}::uuid
        `);
      }
      await sql.transaction(statements);
      return res.status(200).json({ok:true,status:decision,actionId:change.actionId,
        dueDate:decision==="approved"?requestedDue:undefined});
    }

    if(command==="action.submitForVerification"){
      const ctx=await actionContext(sql,p.actionId);if(!ctx) return res.status(404).json({ok:false,error:"ACTION_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
      if(!["open","reopened"].includes(ctx.status))return res.status(409).json({ok:false,error:"ACTION_NOT_SUBMITTABLE"});
      const isOwner=ctx.ownerIdentityId===user.id;
      if(!isOwner){
        try{assertPermission(user,"update_assigned_action")}catch{assertPermission(user,"assign_action")}
      }
      const count=await sql`
        SELECT count(*)::int AS n FROM evidence_links
        WHERE target_type='RemediationAction' AND target_id=${p.actionId}::uuid AND purpose='closure_evidence'
      `;
      if(Number(count[0]?.n||0)<1) return res.status(409).json({ok:false,error:"CLOSURE_EVIDENCE_REQUIRED"});
      await sql`
        UPDATE remediation_actions
        SET status='submitted_for_verification',closure_submitted_at=now(),verification_status='pending',updated_at=now()
        WHERE id=${p.actionId}::uuid
      `;
      return res.status(200).json({ok:true,status:"submitted_for_verification",evidenceCount:Number(count[0].n)});
    }

    if(command==="action.verify"){
      assertPermission(user,"verify_action");
      const ctx=await actionContext(sql,p.actionId);if(!ctx) return res.status(404).json({ok:false,error:"ACTION_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
      if(ctx.ownerIdentityId===user.id) return res.status(409).json({ok:false,error:"SELF_VERIFICATION_FORBIDDEN"});
      const state=await sql`
        SELECT status FROM remediation_actions WHERE id=${p.actionId}::uuid
      `;
      if(state[0]?.status!=="submitted_for_verification"){
        return res.status(409).json({ok:false,error:"ACTION_NOT_READY_FOR_VERIFICATION"});
      }
      const evidence=await sql`
        SELECT count(*)::int AS n FROM evidence_links
        WHERE target_type='RemediationAction' AND target_id=${p.actionId}::uuid AND purpose='closure_evidence'
      `;
      if(Number(evidence[0]?.n||0)<1){
        return res.status(409).json({ok:false,error:"CLOSURE_EVIDENCE_REQUIRED"});
      }
      const result=String(p.result||"");
      if(!["effective","ineffective"].includes(result)){
        return res.status(400).json({ok:false,error:"INVALID_VERIFICATION_RESULT"});
      }
      const id=crypto.randomUUID();
      await sql`
        INSERT INTO verifications(id,action_id,verifier,verification_date,result,note)
        VALUES(${id}::uuid,${p.actionId}::uuid,${user.id},now(),${result},${p.note||null})
      `;
      const nextStatus=result==="effective"?"closed":"reopened";
      await sql`
        UPDATE remediation_actions SET status=${nextStatus},verification_status=${result},updated_at=now()
        WHERE id=${p.actionId}::uuid AND status='submitted_for_verification'
      `;
      if(nextStatus==="closed"){
        await sql`
          UPDATE findings f SET status='closed',updated_at=now()
          WHERE f.id=${ctx.findingId}::uuid
            AND NOT EXISTS (SELECT 1 FROM remediation_actions a WHERE a.finding_id=f.id AND a.status<>'closed')
        `;
      }
      return res.status(200).json({ok:true,status:nextStatus,verificationId:id});
    }

    if(command==="requirement.approve"){
      assertPermission(user,"approve_framework");
      await sql`
        UPDATE compliance_requirements SET status=${p.approve===false?"rejected":"effective"},
            approved_by=${user.id},approved_at=now()
        WHERE id=${p.requirementId}::uuid
      `;
      return res.status(200).json({ok:true,status:p.approve===false?"rejected":"effective"});
    }

    if(command==="draftRequirement.update"){
      assertPermission(user,"manage_framework");
      const before=await draftAuditRow(sql,p.id);
      if(!before||before.reviewStatus==="published")return res.status(404).json({ok:false,error:"DRAFT_REQUIREMENT_NOT_EDITABLE"});
      const rows=await sql`
        UPDATE draft_requirements SET
          obligation=COALESCE(${p.obligation||null},obligation),
          source_clause=${p.sourceClause||null},
          applicability=${p.applicability||null},
          obligation_type=COALESCE(${p.obligationType||null},obligation_type),
          expected_evidence=${p.expectedEvidence||null},
          test_procedure=${p.testProcedure||null},
          updated_at=now()
        WHERE id=${p.id}::uuid AND review_status<>'published'
        RETURNING id::text,review_status AS "reviewStatus"
      `;
      if(!rows.length)return res.status(404).json({ok:false,error:"DRAFT_REQUIREMENT_NOT_EDITABLE"});
      const changedFields=["obligation","sourceClause","applicability","obligationType","expectedEvidence","testProcedure"].filter(k=>p[k]!==undefined);
      await recordDraftDecision(sql,user,before,before.aiGenerated?"human_edit_ai_draft":"edit_draft",
        before.reviewStatus,before.reviewStatus,p.reviewNote||null,{changedFields});
      return res.status(200).json({ok:true,record:rows[0]});
    }

    if(command==="draftRequirement.reviewBatch"){
      assertPermission(user,"manage_framework");
      const ids=Array.isArray(p.ids)?p.ids.filter(Boolean):[];
      const status=["accepted","rejected","draft"].includes(p.status)?p.status:"draft";
      if(!ids.length)return res.status(400).json({ok:false,error:"NO_DRAFT_REQUIREMENTS"});
      const beforeRows=await sql`
        SELECT id::text,review_status AS "reviewStatus",ai_generated AS "aiGenerated",
               ai_confidence AS "aiConfidence",ai_engine AS "aiEngine",ai_schema_version AS "aiSchemaVersion",
               ai_review_reasons AS "aiReviewReasons",ai_uncertainties AS uncertainties
        FROM draft_requirements WHERE id::text = ANY(${ids}) AND review_status<>'published'
      `;
      await sql`
        UPDATE draft_requirements
        SET review_status=${status},reviewed_by=${user.id},
            reviewed_at=CASE WHEN ${status}='draft' THEN NULL ELSE now() END,updated_at=now()
        WHERE id::text = ANY(${ids}) AND review_status<>'published'
      `;
      for(const row of beforeRows){
        await recordDraftDecision(sql,user,row,row.aiGenerated?"human_review_ai_draft":"review_draft",
          row.reviewStatus,status,p.reviewNote||null,{batch:ids.length>1});
      }
      return res.status(200).json({ok:true,status,count:beforeRows.length});
    }

    if(command==="draftRequirement.publishBatch"){
      assertPermission(user,"manage_framework");
      const ids=Array.isArray(p.ids)?p.ids.filter(Boolean):[];
      if(!ids.length)return res.status(400).json({ok:false,error:"NO_DRAFT_REQUIREMENTS"});
      const fwRows=await sql`SELECT id::text,code,status FROM compliance_frameworks WHERE id=${p.frameworkId}::uuid`;
      if(!fwRows.length)return res.status(404).json({ok:false,error:"FRAMEWORK_NOT_FOUND"});
      const fw=fwRows[0];
      const drafts=await sql`
        SELECT id::text,source_id::text AS "sourceId",source_clause AS "sourceClause",original_text AS "originalText",
               obligation,applicability,obligation_type AS "obligationType",mandatory_level AS "mandatoryLevel",
               expected_evidence AS "expectedEvidence",test_procedure AS "testProcedure",
               review_status AS "reviewStatus",ai_generated AS "aiGenerated",ai_confidence AS "aiConfidence",
               ai_engine AS "aiEngine",ai_schema_version AS "aiSchemaVersion",
               ai_review_reasons AS "aiReviewReasons",ai_uncertainties AS uncertainties
        FROM draft_requirements
        WHERE id::text = ANY(${ids}) AND review_status='accepted'
        ORDER BY created_at,id
      `;
      if(drafts.length!==ids.length)return res.status(409).json({ok:false,error:"DRAFT_SET_NOT_ACCEPTED"});
      const existing=await sql`
        SELECT code FROM compliance_requirements
        WHERE code LIKE ${fw.code+"-%"}
      `;
      let max=0;
      for(const row of existing){
        const m=String(row.code||"").match(/-(\d+)$/);if(m)max=Math.max(max,Number(m[1]));
      }
      const created=[];
      for(let i=0;i<drafts.length;i++){
        const d=drafts[i],rid=crypto.randomUUID(),code=fw.code+"-"+String(max+i+1).padStart(3,"0");
        await sql`
          INSERT INTO compliance_requirements
            (id,code,title,description,source_id,source_clause,assessable,mandatory_level,test_procedure,
             expected_evidence,applicability,obligation_type,status,created_at)
          VALUES
            (${rid}::uuid,${code},${d.obligation},${d.originalText||null},${d.sourceId}::uuid,
             ${d.sourceClause||null},true,${d.mandatoryLevel||"review"},${d.testProcedure||"Cần xác định"},
             ${d.expectedEvidence||"Cần xác định"},${d.applicability||null},${d.obligationType||"general"},
             'pending_approval',now())
        `;
        await sql`INSERT INTO framework_requirements(framework_id,requirement_id) VALUES(${p.frameworkId}::uuid,${rid}::uuid)`;
        await sql`UPDATE draft_requirements SET review_status='published',reviewed_by=${user.id},reviewed_at=now(),updated_at=now() WHERE id=${d.id}::uuid`;
        await recordDraftDecision(sql,user,d,"publish_reviewed_obligation","accepted","published",p.reviewNote||null,{requirementId:rid,code});
        created.push({id:rid,code});
      }
      await sql`UPDATE compliance_frameworks SET status='pending_approval',updated_at=now() WHERE id=${p.frameworkId}::uuid`;
      return res.status(201).json({ok:true,created,count:created.length,status:"pending_approval"});
    }

    if(command==="draftRequirement.review"){
      assertPermission(user,"manage_framework");
      const status=["accepted","rejected","draft"].includes(p.status)?p.status:"draft";
      const before=await draftAuditRow(sql,p.id);
      if(!before||before.reviewStatus==="published")return res.status(404).json({ok:false,error:"DRAFT_REQUIREMENT_NOT_EDITABLE"});
      await sql`
        UPDATE draft_requirements SET review_status=${status},reviewed_by=${user.id},
            reviewed_at=CASE WHEN ${status}='draft' THEN NULL ELSE now() END,updated_at=now()
        WHERE id=${p.id}::uuid AND review_status<>'published'
      `;
      await recordDraftDecision(sql,user,before,before.aiGenerated?"human_review_ai_draft":"review_draft",
        before.reviewStatus,status,p.reviewNote||null,{batch:false});
      return res.status(200).json({ok:true,status});
    }

    return res.status(400).json({ok:false,error:"UNKNOWN_COMMAND"});
  }catch(error){
    const status=Number(error?.status||500);
    console.error("normalized command error",error);
    return res.status(status).json({ok:false,error:error?.code||publicError(error,"NORMALIZED_COMMAND_ERROR")});
  }
}
