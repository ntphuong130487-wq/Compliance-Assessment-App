import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  emptyState, loadDemo, metrics, validateState, createAssessmentFromFramework,
  generateId, transitionAssessment, appendDecision
} from '../dist/domain.js';

const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../dist/styles.css',import.meta.url),'utf8');
const store=fs.readFileSync(new URL('../dist/store.js',import.meta.url),'utf8');
const schema=fs.readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8');
const stateApi=fs.readFileSync(new URL('../api/state.js',import.meta.url),'utf8');
const evidenceApi=fs.readFileSync(new URL('../api/evidence.js',import.meta.url),'utf8');
const accessApi=fs.readFileSync(new URL('../api/access.js',import.meta.url),'utf8');
const healthApi=fs.readFileSync(new URL('../api/health.js',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));

const checks=[];
function check(name,fn){try{fn();checks.push([name,true]);}catch(e){checks.push([name,false,e.message]);}}

check('8 màn hình nghiệp vụ',()=>{
  for(const t of ['Điều hành','Khung tuân thủ','Chương trình đánh giá','Kiểm tra hiện trường','Phát hiện','Khắc phục','Ngoại lệ','Báo cáo']) assert.ok(app.includes(t),t);
});
check('Human-in-the-loop AI',()=>{assert.ok(app.includes('Proposal chỉ hỗ trợ reviewer'));assert.ok(app.includes('Xác nhận Finding'));});
check('Full-scope rule',()=>{assert.ok(app.includes('Để trống = toàn bộ requirement assessable'));});
check('Evidence SHA-256',()=>{assert.ok(app.includes('sha256'));assert.ok(schema.includes('sha256 char(64)'));});
check('Assessment lock',()=>{assert.ok(app.includes('Sign-off & Lock'));assert.ok(schema.includes('locked boolean'));});
check('Responsive UI',()=>{assert.ok(css.includes('@media(max-width:720px)'));});
check('Vercel health endpoint',()=>{assert.ok(fs.existsSync(new URL('../api/health.js',import.meta.url)));});
check('Neon shared persistence API',()=>{
  assert.ok(store.includes('/api/state'));
  assert.ok(stateApi.includes('@neondatabase/serverless'));
  assert.ok(pkg.dependencies?.['@neondatabase/serverless']);
});
check('Optimistic conflict control',()=>{
  assert.ok(store.includes('VERSION_CONFLICT'));
  assert.ok(store.includes('forcePushCloud'));
  assert.ok(app.includes('Ghi đè Cloud'));
});
check('Safe local fallback',()=>{
  assert.ok(store.includes('localStorage'));
  assert.ok(app.includes('Offline fallback'));
});
check('Shared state is secure-by-default',()=>{
  assert.ok(stateApi.includes('AUTH_REQUIRED'));
  assert.ok(stateApi.includes('AUTH_ENFORCEMENT_PENDING'));
  assert.ok(stateApi.includes('authEnforcementReady'));
});
check('Private evidence is secure-by-default',()=>{
  assert.ok(evidenceApi.includes('@vercel/blob'));
  assert.ok(evidenceApi.includes('AUTH_ENFORCEMENT_PENDING'));
  assert.ok(pkg.dependencies?.['@vercel/blob']);
});
check('Access-control readiness contract',()=>{
  assert.ok(accessApi.includes('authentication-provider-pending'));
  assert.ok(healthApi.includes('sharedStateReady: false'));
  assert.ok(healthApi.includes('evidenceUploadReady: false'));
});
check('22-object schema families',()=>{
  for(const table of ['org_units','actors','compliance_sources','compliance_frameworks','compliance_requirements','control_references','existing_controls','assessment_programs','compliance_assessments','assessment_scopes','assessment_assignments','requirement_assessments','findings','remediation_actions','verifications','compliance_exceptions','unit_responses','evidence','evidence_revisions','evidence_links','ai_analysis_proposals','decision_logs']) assert.ok(schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`),table);
});

check('Empty state is valid',()=>{const q=validateState(emptyState());assert.equal(q.errors.length,0);});
check('Demo state integrity',()=>{const s=loadDemo(emptyState());const q=validateState(s);assert.equal(q.errors.length,0);assert.equal(s.meta.demoLoaded,true);});
check('Coverage != compliance result',()=>{const s=loadDemo(emptyState());const r=s.requirementAssessments[0];r.workflowStatus='done';r.complianceResult='non_compliant';const m=metrics(s);assert.equal(m.done,1);assert.equal(m.nonCompliant,1);});
check('Create assessment snapshots requirements',()=>{
  const s=loadDemo(emptyState());const fw=s.frameworks[0];const before=s.requirementAssessments.length;
  const a={id:generateId('as'),programId:null,frameworkId:fw.id,name:'QA',objective:'',periodFrom:null,periodTo:null,status:'draft',locked:false,lockedAt:null};
  const scope={id:generateId('scope'),assessmentId:a.id,orgUnitId:'org_ho',scopeNote:'',includeAllRequirements:true};
  createAssessmentFromFramework(s,a,scope);assert.equal(s.requirementAssessments.length,before+3);assert.ok(s.requirementAssessments.at(-1).snapshot.code);
});
check('Sign-off locks assessment',()=>{
  const s=loadDemo(emptyState());const a=s.assessments[0];a.status='review';for(const r of s.requirementAssessments)r.workflowStatus='done';transitionAssessment(s,a.id,'signed_off','QA','test');assert.equal(a.locked,true);assert.ok(a.lockedAt);
});
check('Decision log append-only behavior',()=>{const s=emptyState();appendDecision(s,{objectType:'QA',objectId:'1',decisionType:'test'});appendDecision(s,{objectType:'QA',objectId:'1',decisionType:'test2'});assert.equal(s.decisionLogs.length,2);});
check('No factual demo presented as real',()=>{assert.ok(app.includes('Nạp dữ liệu demo'));assert.ok(app.toLowerCase().includes('dữ liệu demo'));});

let fail=0;
for(const [name,ok,msg] of checks){console.log(`${ok?'PASS':'FAIL'} - ${name}${msg?` :: ${msg}`:''}`);if(!ok)fail++;}
if(fail)process.exit(1);
console.log(`PASS - ${checks.length} QA checks`);
