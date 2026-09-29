# AgriS Compliance Assessment App

Production Candidate for end-to-end compliance assessment operations.

**Business flow:** Compliance Source → Framework → Requirement → Assessment → Fieldwork/Evidence → Human-confirmed Finding → Unit Response → Remediation Action → Verification → Close → Dashboard.

## Run locally
Open `index.html` through a static web server. Example:

```bash
python -m http.server 3000
```

## QA

```bash
npm test
```

## Architecture
- `domain.js`: domain rules and invariants.
- `store.js`: browser persistence / import-export adapter.
- `app.js`: UI and workflow orchestration.
- `db/schema.sql`: normalized PostgreSQL/Neon schema for the 22 domain objects.
- `api/health.js`: Vercel runtime health/config endpoint.

See `docs/PRODUCTION-v1.md` and `docs/domain-model-v0.1.md`.
