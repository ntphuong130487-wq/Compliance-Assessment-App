import { neon } from "@neondatabase/serverless";

const MAX_BYTES = 4 * 1024 * 1024;

function db() {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
}

async function ensure(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS compliance_app_state (
      id text PRIMARY KEY,
      version bigint NOT NULL DEFAULT 1,
      state jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const sql = db();

  if (!sql) {
    return res.status(200).json({
      ok: true,
      configured: false,
      mode: "local-fallback",
      message: "DATABASE_URL is not configured."
    });
  }

  try {
    await ensure(sql);

    if (req.method === "GET") {
      const rows = await sql`
        SELECT version, state, updated_at
        FROM compliance_app_state
        WHERE id = 'main'
      `;
      if (!rows.length) {
        return res.status(200).json({ ok: true, configured: true, exists: false, version: 0 });
      }
      return res.status(200).json({
        ok: true,
        configured: true,
        exists: true,
        version: Number(rows[0].version),
        state: rows[0].state,
        updatedAt: rows[0].updated_at
      });
    }

    if (req.method === "POST") {
      const raw = JSON.stringify(req.body || {});
      if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) {
        return res.status(413).json({ ok: false, error: "STATE_TOO_LARGE" });
      }

      const state = req.body?.state;
      const expectedVersion = Number(req.body?.version || 0);
      if (!state || typeof state !== "object") {
        return res.status(400).json({ ok: false, error: "INVALID_STATE" });
      }

      const current = await sql`
        SELECT version FROM compliance_app_state WHERE id = 'main'
      `;

      if (!current.length) {
        const inserted = await sql`
          INSERT INTO compliance_app_state (id, version, state)
          VALUES ('main', 1, ${JSON.stringify(state)}::jsonb)
          RETURNING version, updated_at
        `;
        return res.status(200).json({
          ok: true, configured: true,
          version: Number(inserted[0].version),
          updatedAt: inserted[0].updated_at
        });
      }

      const currentVersion = Number(current[0].version);
      if (expectedVersion !== currentVersion) {
        return res.status(409).json({
          ok: false,
          error: "VERSION_CONFLICT",
          currentVersion
        });
      }

      const updated = await sql`
        UPDATE compliance_app_state
        SET state = ${JSON.stringify(state)}::jsonb,
            version = version + 1,
            updated_at = now()
        WHERE id = 'main' AND version = ${currentVersion}
        RETURNING version, updated_at
      `;

      if (!updated.length) {
        return res.status(409).json({ ok: false, error: "VERSION_CONFLICT" });
      }

      return res.status(200).json({
        ok: true, configured: true,
        version: Number(updated[0].version),
        updatedAt: updated[0].updated_at
      });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    console.error("state api error", error);
    return res.status(500).json({ ok: false, error: "STATE_API_ERROR" });
  }
}
