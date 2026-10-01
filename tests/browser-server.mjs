import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd(),port=4173;
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon"};

function send(res,status,body,type="text/plain; charset=utf-8"){
  res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store"});
  res.end(body);
}
const readiness={
  auth:{configured:false,mode:null,provider:null},
  database:{configured:false,normalizedReady:false},
  storage:{configured:false},
  documentIntelligence:{ocrConfigured:false},
  ai:{configured:false},
  productionReady:false,
  missing:["browser-regression-demo-mode"]
};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://127.0.0.1:"+port);
  if(url.pathname==="/api/readiness")return send(res,200,JSON.stringify(readiness),"application/json");
  if(url.pathname.startsWith("/api/"))return send(res,404,JSON.stringify({ok:false,error:"TEST_API_NOT_AVAILABLE"}),"application/json");
  let p=url.pathname==="/"?"index.html":url.pathname.replace(/^\/+/, "");
  p=path.normalize(p).replace(/^(\.\.(\/|\\|$))+/, "");
  const file=path.join(root,p);
  if(!file.startsWith(root))return send(res,403,"Forbidden");
  fs.stat(file,(err,st)=>{
    if(err||!st.isFile())return send(res,404,"Not found");
    res.writeHead(200,{"Content-Type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store"});
    fs.createReadStream(file).pipe(res);
  });
});
server.listen(port,"127.0.0.1",()=>console.log("BROWSER_TEST_SERVER_READY http://127.0.0.1:"+port));
process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
process.on("SIGINT",()=>server.close(()=>process.exit(0)));
