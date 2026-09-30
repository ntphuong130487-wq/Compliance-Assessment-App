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

    if(command==="draftRequirement.review"){
      assertPermission(user,"manage_framework");
      const status=["accepted","rejected","draft"].includes(p.status)?p.status:"draft";
      await sql`
        UPDATE draft_requirements SET review_status=${status},reviewed_by=${user.id},
            reviewed_at=CASE WHEN ${status}='draft' THEN NULL ELSE now() END,updated_at=now()
        WHERE id=${p.id}::uuid
      `;
      return res.status(200).json({ok:true,status});
    }

    return res.status(400).json({ok:false,error:"UNKNOWN_COMMAND"});
  }catch(error){
    const status=Number(error?.status||500);
    console.error("normalized command error",error);
    return res.status(status).json({ok:false,error:error?.code||publicError(error,"NORMALIZED_COMMAND_ERROR")});
  }
}
