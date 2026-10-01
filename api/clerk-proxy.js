const TARGET_ORIGIN="https://frontend-api.clerk.dev";

export const config={api:{bodyParser:false}};

function firstIp(req){
  const vercel=String(req.headers["x-vercel-forwarded-for"]||"").split(",")[0].trim();
  if(vercel)return vercel;
  const xff=String(req.headers["x-forwarded-for"]||"").split(",")[0].trim();
  return xff||"127.0.0.1";
}

async function readBody(req){
  const chunks=[];
  for await (const chunk of req)chunks.push(chunk);
  return chunks.length?Buffer.concat(chunks):undefined;
}

export default async function handler(req,res){
  if(!process.env.CLERK_SECRET_KEY){
    return res.status(503).json({ok:false,error:"CLERK_SECRET_KEY_NOT_CONFIGURED"});
  }

  const rawPath=String(req.query?.path||"").replace(/^\/+/, "");
  const rawSearch=String(req.url||"").split("?")[1]||"";
  const params=new URLSearchParams(rawSearch);
  params.delete("path");
  const target=TARGET_ORIGIN+"/"+rawPath+(params.toString()?"?"+params.toString():"");

  const headers=new Headers();
  for(const [key,value] of Object.entries(req.headers||{})){
    const k=key.toLowerCase();
    if(["host","connection","content-length","x-forwarded-for","x-forwarded-host","x-forwarded-proto"].includes(k))continue;
    if(Array.isArray(value))headers.set(key,value.join(", "));
    else if(value!=null)headers.set(key,String(value));
  }

  const proto=String(req.headers["x-forwarded-proto"]||"https").split(",")[0].trim();
  const host=String(req.headers["x-forwarded-host"]||req.headers.host||"").split(",")[0].trim();
  const proxyUrl=proto+"://"+host+"/__clerk";

  headers.set("Clerk-Proxy-Url",proxyUrl);
  headers.set("Clerk-Secret-Key",process.env.CLERK_SECRET_KEY);
  headers.set("X-Forwarded-For",firstIp(req));

  const init={method:req.method,headers,redirect:"manual"};
  if(!["GET","HEAD"].includes(req.method||"GET"))init.body=await readBody(req);

  try{
    const upstream=await fetch(target,init);
    res.statusCode=upstream.status;
    upstream.headers.forEach((value,key)=>{
      const k=key.toLowerCase();
      if(["content-length","content-encoding","transfer-encoding","connection"].includes(k))return;
      if(k==="location"){
        try{
          const u=new URL(value);
          if(u.origin===TARGET_ORIGIN){
            res.setHeader("Location",proxyUrl+u.pathname+u.search);
            return;
          }
        }catch{}
      }
      res.setHeader(key,value);
    });
    const ab=await upstream.arrayBuffer();
    return res.end(Buffer.from(ab));
  }catch(error){
    console.error("Clerk frontend proxy error",error);
    return res.status(502).json({ok:false,error:"CLERK_PROXY_UPSTREAM_ERROR"});
  }
}
