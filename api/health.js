export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({
    ok:true,
    service:'agris-compliance-assessment',
    release:'1.0-rc1',
    databaseConfigured:Boolean(process.env.DATABASE_URL),
    persistence:process.env.DATABASE_URL?'neon-configured':'browser-local',
    timestamp:new Date().toISOString()
  });
}
