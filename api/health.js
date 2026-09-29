export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const authConfigurationPresent = Boolean(process.env.AUTH_MODE);
  const evidenceStorageConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  res.status(200).json({
    ok: true,
    service: "AgriS Compliance Assessment",
    release: "1.0.0-rc.2",
    databaseConfigured,
    authConfigurationPresent,
    evidenceStorageConfigured,
    persistence: databaseConfigured ? "neon-plumbing-ready" : "browser-local",
    sharedStateReady: false,
    evidenceUploadReady: false,
    normalizedSchemaReady: true,
    humanConfirmationGate: true,
    securityNote: "Shared state and private evidence remain locked until server-side identity and scope enforcement is implemented.",
    timestamp: new Date().toISOString()
  });
}
