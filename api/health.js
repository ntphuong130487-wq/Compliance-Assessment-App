export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  res.status(200).json({
    ok: true,
    service: "AgriS Compliance Assessment",
    release: "1.0.0-rc.2",
    databaseConfigured,
    persistence: databaseConfigured ? "neon-shared-state" : "browser-local",
    normalizedSchemaReady: true,
    humanConfirmationGate: true,
    timestamp: new Date().toISOString()
  });
}
