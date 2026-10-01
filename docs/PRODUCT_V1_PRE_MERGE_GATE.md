# Product v1 — Release Gate

Status: **RELEASED TO MAIN — 2026-10-01**  
Merged PR: **#2**  
Release commit: `f7d5609ac22ced5e878f57ca1e3532a23931bbc3`

## Gate A — Code & regression
- [x] Static QA
- [x] RBAC / org-scope regression
- [x] Product workflow regression
- [x] Browser regression across 8 screens
- [x] PDF/DOCX/scan OCR routing regression
- [x] Evidence authorization + atomicity regression
- [x] Migration 005–009 dry-run
- [x] Migration 005–009 idempotence verification
- [x] Final merged-head QA workflow PASS
- [x] Vercel release deployment SUCCESS

## Gate B — Security controls
- [x] Evidence read requires authenticated, provisioned user
- [x] Evidence read enforces org scope
- [x] Evidence upload authorizes target/org before Blob persistence
- [x] Evidence DB persistence controls regression PASS
- [x] Private Blob write/read/hash control smoke PASS
- [x] Direct unauthenticated Blob access denied in smoke
- [x] Evidence / revision / link persistence verification PASS
- [x] Audit decision-log verification PASS
- [x] Smoke fixture and Blob cleanup PASS
- [x] Action Owner cannot self-verify
- [x] Closure evidence required before verification
- [x] AI output remains draft/proposal; human review required
- [x] Human review decisions are audit logged

## Gate C — Production authentication & runtime
- [x] Clerk production keys configured
- [x] Clerk same-origin proxy configured at `/__clerk`
- [x] Clerk primary production domain verified:
  `compliance-assessment-app-ntphuong130487.vercel.app`
- [x] Real production user login observed
- [x] User provisioned as active `compliance_admin` with enterprise scope
- [x] `DATA_MODE=normalized`
- [x] Vercel Blob connected
- [x] Final Vercel deployment status SUCCESS

## Gate D — Neon production database
- [x] Production project: `falling-river-32945726`
- [x] Production branch: `br-noisy-hill-b39cbexd`
- [x] Dry-run clone: `br-nameless-cell-b33aqvnr`
- [x] Migration 005–009 verified on clone
- [x] Migration 007 schema drift fixed
- [x] Migration 005–009 applied to production
- [x] Production verification:
  - `remediation_actions.action_type` = `text NOT NULL DEFAULT 'mandatory_remediation'`
  - `remediation_action_change_requests` exists
  - `requirement_assessment_assignments` exists
  - migration check constraints exist
- [x] Post-smoke residue verification: zero smoke org/evidence/audit records

## Merge / release
- [x] Main production hotfixes merged into feature branch
- [x] Merge conflict resolved
- [x] PR #2 marked ready
- [x] PR #2 squash merged
- [x] Main post-merge QA PASS
- [x] Main post-merge Vercel deployment SUCCESS

## Release conclusion
Product v1 release gates covered code regression, database migration, authentication, evidence security, private Blob controls, org-scope enforcement, audit persistence and cleanup. Temporary smoke-test hooks were removed after verification.
