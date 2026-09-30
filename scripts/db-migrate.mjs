import fs from "node:fs";
import { Pool } from "@neondatabase/serverless";

if(!process.env.DATABASE_URL){
  console.error("DATABASE_URL chưa được cấu hình.");
  process.exit(2);
}

const sql=fs.readFileSync("db/schema.sql","utf8");
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();
try{
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("PASS - canonical schema migrated");
}catch(error){
  await client.query("ROLLBACK");
  console.error("Migration failed:",error.message);
  process.exitCode=1;
}finally{
  client.release();
  await pool.end();
}
