import { handleSystem } from "../lib/system-routes.js";
export default async function handler(req,res){
  return handleSystem(req,res,String(req.query?.route||""));
}
