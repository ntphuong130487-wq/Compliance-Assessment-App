# Compliance Assessment App – Delivery Status v0.6

**Business QA:** P0/P1 closed at application-foundation level; core P2 operational features implemented.

## Implemented
- Management dashboard with actionable indicators.
- In-app notification/escalation center.
- Configurable pre-due reminder threshold; no invented default threshold.
- Global search plus page-level filters.
- CSV, JSON and print/PDF exports.
- Microsoft Entra ID OAuth/OIDC production foundation.
- Signed server session and authenticated shared-state/evidence gates.
- PostgreSQL/Neon normalized target schema + P2 migration + readiness check.
- Private evidence storage foundation.
- Secure server-side notification runner foundation.
- Production activation checklist in Admin settings.

## External activation dependencies not available in current connected environment
- Microsoft Entra app registration credentials: not available.
- Neon project ID / DATABASE_URL: not available; Neon connector is unscoped.
- Vercel environment variables: connector cannot enumerate the project.
- Vercel deploy quota currently rate-limited; latest code is on main but production deployment is pending quota availability.

## Controls
- No database shared data is exposed without verified Auth.
- Action owner cannot self-verify.
- Action closure requires evidence.
- Draft Finding requires unit response before final disposition.
- Requirements require one-level approval before becoming effective.
- Report/search data uses scoped views where applicable.

## Latest acceptance gate
GitHub Actions Compliance MVP QA must be green before any release is considered deployable.
