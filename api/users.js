import { handleUsers } from "../lib/user-routes.js";
export default async function handler(req,res){
  return handleUsers(req,res,String(req.query?.route||""));
}
