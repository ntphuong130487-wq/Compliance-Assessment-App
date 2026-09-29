import { neon } from "@neondatabase/serverless";

function dueState(date){
  if(!date)return null;
  const today=new Date();today.setHours(0,0,0,0);
  const due=new Date(date);due.setHours(0,0,0,0);
  return Math.ceil((due-today)/86400000);
}

function summarize(state){
  const findings=state?.findings||[],actions=state?.actions||[];
  const openFindings=findings.filter(f=>f.status!=="closed"&&f.status!=="dismissed");
  const overdueActions=actions.filter(a=>a.status!=="closed"&&dueState(a.due)!==null&&dueState(a.due)<0);
  const pendingVerification=actions.filter(a=>a.status==="submitted_for_verification");
  const pendingUnitResponse=findings.filter(f=>f.status==="pending_unit_response");
  const pendingFinalReview=findings.filter(f=>f.status==="pending_final_review");
  const highCritical=openFindings.filter(f=>f.severity==="high"||f.severity==="critical");
  return {
    openFindings:openFindings.length,
    highCritical:highCritical.length,
    overdueActions:overdueActions.length,
    pendingVerification:pendingVerification.length,
    pendingUnitResponse:pendingUnitResponse.length,
    pendingFinalReview:pendingFinalReview.length
  };
}

async function postWebhook(summary){
  if(!process.env.NOTIFICATION_WEBHOOK_URL)return {configured:false,sent:false};
  const body={
    title:"AgriS Compliance – Nhắc việc vận hành",
    generatedAt:new Date().toISOString(),
    summary
  };
  const r=await fetch(process.env.NOTIFICATION_WEBHOOK_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  if(!r.ok)throw new Error("WEBHOOK_FAILED_"+r.status);
  return {configured:true,sent:true};
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET"&&req.method!=="POST"){
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }
  const secret=process.env.CRON_SECRET;
  if(!secret||req.headers.authorization!==`Bearer ${secret}`){
    return res.status(401).json({ok:false,error:"UNAUTHORIZED"});
  }
  if(!process.env.DATABASE_URL){
    return res.status(503).json({ok:false,error:"DATABASE_NOT_CONFIGURED"});
  }
  try{
    const sql=neon(process.env.DATABASE_URL);
    const rows=await sql`SELECT state, updated_at FROM compliance_app_state WHERE id='main'`;
    if(!rows.length)return res.status(200).json({ok:true,empty:true,summary:null});
    const summary=summarize(rows[0].state);
    const delivery=await postWebhook(summary);
    return res.status(200).json({ok:true,summary,delivery,stateUpdatedAt:rows[0].updated_at});
  }catch(error){
    console.error("notification run error",error);
    return res.status(500).json({ok:false,error:"NOTIFICATION_RUN_FAILED"});
  }
}
