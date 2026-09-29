# QA – Production Candidate v1.0-rc1

## Automated checks

- JavaScript syntax.
- 8 màn hình nghiệp vụ.
- Human-in-the-loop AI rule.
- Full-scope default rule.
- Evidence SHA-256.
- Assessment sign-off lock.
- Responsive mobile CSS.
- Vercel health endpoint.
- 22-object PostgreSQL schema.
- Empty/demo state relational integrity.
- Progress vs compliance separation.
- Requirement snapshot on assessment creation.
- Decision log append behavior.
- Demo data labeling.

## Known controlled limitations

- Browser persistence until Neon is provisioned and connected.
- File binary is not persisted; only metadata/hash is retained in browser mode.
- Role selector is UX/RBAC simulation, not identity authentication.
- AI proposal currently uses deterministic rule screening; no LLM is presented as active.

These limitations are intentionally visible in the UI and are release gates, not hidden assumptions.
