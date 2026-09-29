# Business Decisions – 2026-09-29

## Decisions confirmed by business owner

1. **Finding workflow**
   - Adopt: Draft Finding → Unit Response → Assessor/Reviewer Final Disposition → Final Finding.
   - Action plan can only be created after Final Finding.

2. **Assessment Scope**
   - Adopt model C: Org Unit + Process + Activity + Location determine applicable Requirements automatically.
   - Requirements without specific applicability are treated as generally applicable.
   - Override capability can be added after the auto-scope baseline is stable.

3. **Framework / Requirement Approval**
   - One approval level.
   - Requirements created from source extraction or manual interpretation enter pending_approval.
   - Only users with approve_framework can approve/reject.
   - Only effective requirements are eligible for new assessments.

4. **Verification Independence**
   - Action owner cannot verify their own action.
   - Verification is performed by an independent authorized role/persona.

## Business QA fixes implemented with these decisions
- Removed Reset demo from normal UI.
- Reports now respect visible/scoped Requirement Assessments.
- Added assessment period / process / activity / location / lead / reviewer / unit representative.
- Added one-level framework approval.
- Added independent action verification control.
