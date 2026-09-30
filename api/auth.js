import { handleAuth } from "../lib/auth-routes.js";
export default async function handler(req,res){
  return handleAuth(req,res,String(req.query?.route||""));
}
