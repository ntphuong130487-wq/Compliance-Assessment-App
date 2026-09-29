export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    service: "AgriS Compliance Assessment",
    version: "0.2.0",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    authConfigured: Boolean(process.env.AUTH_MODE),
    evidenceStorageConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    timestamp: new Date().toISOString()
  });
}
