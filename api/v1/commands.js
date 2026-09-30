import crypto from "node:crypto";
import { sqlClient, normalizedMode, normalizedReady, publicError } from "../../lib/db.js";
import { requireUser, assertPermission, assertOrgScope } from "../../lib/server-authz.js";

async function assessmentOrg(sql,assessmentId){
  const rows=await sql`
    SELECT s.org_unit_id::text AS "orgId"
    FROM assessment_scopes s
    WHERE s.assessment_id=${assessmentId}::uuid
    ORDER BY s.id LIMIT 1
  `;
  return rows[0]?.orgId||null;
}

async function findingContext(sql,findingId){
  const rows=await sql`
    SELECT f.id::text,ra.assessment_id::text AS "assessmentId",s.org_unit_id::text AS "orgId"
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

async function actionContext(sql,actionId){
  const rows=await sql`
    SELECT a.id::text,a.owner_identity_id AS "ownerIdentityId",a.finding_id::text AS "findingId",
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

    if(command==="requirementAssessment.update"){
      assertPermission(user,"conduct_fieldwork");
      const orgId=await assessmentOrg(sql,p.assessmentId);assertOrgScope(user,orgId);
      const rows=await sql`
        UPDATE requirement_assessments
        SET workflow_status=${p.workflow||"in_review"},
            compliance_result=${p.result||"not_assessed"},
            observation=${p.observation||null},
            assessed_by=${user.id},
            assessed_at=now()
        WHERE id=${p.id}::uuid AND assessment_id=${p.assessmentId}::uuid
        RETURNING id::text,workflow_status AS workflow,compliance_result AS result,observation,assessed_at AS "assessedAt"
      `;
      return res.status(200).json({ok:true,record:rows[0]||null});
    }

    if(command==="finding.create"){
      assertPermission(user,"confirm_finding");
      const orgId=await assessmentOrg(sql,p.assessmentId);assertOrgScope(user,orgId);
      const id=crypto.randomUUID();
      const rows=await sql`
        INSERT INTO findings
          (id,requirement_assessment_id,title,fact,criteria,gap,risk_impact,severity,priority,status,recommendation,created_at)
        VALUES
          (${id}::uuid,${p.raId}::uuid,${p.title},${p.fact},${p.criteria},${p.gap},
           ${p.impact||null},${p.severity||"medium"},${p.priority||null},'pending_unit_response',${p.rec||null},now())
        RETURNING id::text,status,created_at AS "createdAt"
      `;
      await sql`UPDATE requirement_assessments SET workflow_status='in_review' WHERE id=${p.raId}::uuid`;
      return res.status(201).json({ok:true,record:rows[0]});
    }

    if(command==="finding.respond"){
      assertPermission(user,"respond_finding");
      const ctx=await findingContext(sql,p.findingId);if(!ctx) return res.status(404).json({ok:false,error:"FINDING_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
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
      const status=p.disposition==="dismiss"?"dismissed":"final";
      await sql`
        UPDATE findings SET
          title=COALESCE(${p.title||null},title),gap=COALESCE(${p.gap||null},gap),
          recommendation=COALESCE(${p.rec||null},recommendation),
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
      const id=crypto.randomUUID();
      const rows=await sql`
        INSERT INTO remediation_actions
          (id,finding_id,action_text,owner,owner_identity_id,due_date,status,progress,created_by,created_at,updated_at)
        VALUES
          (${id}::uuid,${p.findingId}::uuid,${p.text},${p.owner},${p.ownerIdentityId||null},
           ${p.due||null}::date,'open',0,${user.id},now(),now())
        RETURNING id::text,status,created_at AS "createdAt"
      `;
      return res.status(201).json({ok:true,record:rows[0]});
    }

    if(command==="action.submitForVerification"){
      const ctx=await actionContext(sql,p.actionId);if(!ctx) return res.status(404).json({ok:false,error:"ACTION_NOT_FOUND"});
      assertOrgScope(user,ctx.orgId);
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
      const id=crypto.randomUUID();
      await sql`
        INSERT INTO verifications(id,action_id,verifier,verification_date,result,note)
        VALUES(${id}::uuid,${p.actionId}::uuid,${user.id},now(),${p.result},${p.note||null})
      `;
      const nextStatus=p.result==="effective"?"closed":"reopened";
      await sql`
        UPDATE remediation_actions SET status=${nextStatus},verification_status=${p.result},updated_at=now()
        WHERE id=${p.actionId}::uuid
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
