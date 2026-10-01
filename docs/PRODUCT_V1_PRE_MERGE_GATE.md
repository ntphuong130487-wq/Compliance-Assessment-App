# Product v1 — Pre-Merge Release Gate

Branch: `feature/product-v1-ui-ai`  
Target: `main`

## Gate A — Code & regression
- [x] Latest merge-candidate built successfully on Vercel staging
  - Commit: `fb4ead221c5f968276d213a036f9dbc7cec100cc`
  - Deployment: `dpl_4AdD8vRpGu4owqg4kuUKXv4qPkCm` — READY/STAGED
  - Vercel runtime: Node 24.x, 11 serverless functions
- [x] Static QA
- [x] RBAC / org-scope regression
- [x] Product workflow regression
- [x] Browser regression across 8 screens
- [x] PDF/DOCX/scan OCR routing regression
- [x] Evidence authorization + atomicity regression
- [x] Migration 005–009 dry-run on PostgreSQL baseline
- [x] Migration 005–009 idempotence verification

## Gate B — Security controls
- [x] Evidence read requires authenticated, provisioned user
- [x] Evidence read enforces org scope before private Blob read
- [x] Evidence upload authorizes target/org before body read and Blob write
- [x] Evidence DB records are written transactionally
- [x] Blob cleanup executes if DB persistence fails
- [x] Action Owner cannot self-verify
- [x] Closure evidence required before verification
- [x] AI output remains draft/proposal; human review required
- [x] Human review decisions are audit logged

## Gate C — Production baseline
- [x] Main production deployment is READY/PROMOTED
  - Re-deployed 2026-10-01 from `main` commit `dcdbcf8d1fb8492e8cd939c4109b7c7ecb66e36b`
  - Deployment: `dpl_4WduUcKhfiv5B5sLGx8qKN2Dir5E`
  - Production alias assigned: `compliance-assessment-app-ashen.vercel.app`
- [x] `DATA_MODE=normalized`
- [x] `AUTH_MODE=clerk`
- [x] Clerk production keys configured
- [x] Vercel Blob store connected
- [ ] Production readiness endpoint checked after final merge candidate deployment
- [ ] Private Blob upload/read smoke test with authenticated production user

## Gate D — Database
- [x] Production Neon project positively identified
  - Project: `falling-river-32945726` — Compliance Assessment App Prod SG
  - Region: `aws-ap-southeast-1`
  - Production/default branch: `br-noisy-hill-b39cbexd` (`production`)
- [x] Clone created from actual production branch
  - Clone: `br-nameless-cell-b33aqvnr`
  - Name: `dryrun-migration-005-009-20261001`
- [x] Migration 005–009 dry-run completed successfully on production clone
- [x] Migrated columns/indexes/check constraints verified on clone
- [x] Migration 005–009 re-run successfully to verify idempotence
- [x] Schema drift found and fixed in migration 007
  - Existing `remediation_actions.action_type` column could bypass intended default/NOT NULL because `ADD COLUMN IF NOT EXISTS` does not repair existing column attributes.
  - Fix committed on feature branch: `f4a035f37816a6271db99b2bb7b66e3db335bf12`.
  - Verified on clone: `action_type text NOT NULL DEFAULT 'mandatory_remediation'`.
- [ ] Apply migration 005–009 to production only after remaining Gate C smoke checks pass

## Merge rule
Do not merge while any unchecked Gate C/D item remains. Use **Squash merge** after final verification.
