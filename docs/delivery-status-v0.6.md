# Compliance Assessment App – Delivery Status v0.7

**Business QA:** P0/P1 closed at application-foundation level; P2 operational features implemented.

## Implemented
- Management dashboard with actionable indicators.
- In-app notification/escalation center.
- Configurable pre-due reminder threshold.
- Global search plus page-level filters.
- CSV, JSON and print/PDF exports.
- Clerk email authentication frontend/backend foundation.
- Admin email invitation endpoint with role + Org scope metadata.
- Provisioning gate: uninvited/unprovisioned Clerk users cannot access shared state/evidence.
- PostgreSQL/Neon normalized target schema + Clerk migration + readiness check.
- Private evidence storage foundation.
- Secure server-side notification runner foundation.
- Production activation checklist in Admin settings.

## External activation dependencies not available in current connected environment
- Clerk application keys: not available.
- Neon project ID / DATABASE_URL: not available; Neon connector remains unscoped.
- Vercel environment variables: connector cannot enumerate the project.
- Latest production deploy may remain blocked by Vercel rate limits until quota reopens.

## Controls
- Shared database data is not exposed without verified and provisioned Clerk user.
- Action owner cannot self-verify.
- Action closure requires evidence.
- Draft Phát hiện requires unit response before final disposition.
- Yêu cầu tuân thủ require one-level approval before becoming effective.
- Report/search data uses scoped views where applicable.
- Direct public Clerk signup without provisioning metadata does not grant shared-data access.

## Remaining production gate
- Move business CRUD APIs from compliance_app_state JSONB to normalized tables.
- Enforce server-side row-level authorization by app_users + user_org_scopes.
