const secret=process.env.CLERK_SECRET_KEY;
const env=process.env.VERCEL_ENV;
const proxyUrl=process.env.CLERK_PROXY_URL||"https://compliance-assessment-app-ashen.vercel.app/__clerk";

if(env!=="production"){
  console.log("Clerk proxy configuration skipped: VERCEL_ENV="+String(env||"unknown"));
  process.exit(0);
}
if(!secret){
  throw new Error("CLERK_SECRET_KEY is required for production Clerk proxy configuration");
}

const headers={
  Authorization:"Bearer "+secret,
  "Content-Type":"application/json"
};

const list=await fetch("https://api.clerk.com/v1/domains",{headers});
if(!list.ok){
  throw new Error("Clerk domains list failed: HTTP "+list.status+" "+(await list.text()));
}
const payload=await list.json();
const domains=Array.isArray(payload)?payload:(payload.data||[]);
if(!domains.length){
  throw new Error("No Clerk domains returned for production instance");
}

console.log("Clerk domains:",domains.map(d=>({id:d.id,name:d.name,is_satellite:d.is_satellite,proxy_url:d.proxy_url||null})));

const primary=domains.find(d=>!d.is_satellite)||domains[0];
if(primary.proxy_url===proxyUrl){
  console.log("Clerk proxy already configured:",proxyUrl);
  process.exit(0);
}

const update=await fetch("https://api.clerk.com/v1/domains/"+encodeURIComponent(primary.id),{
  method:"PATCH",
  headers,
  body:JSON.stringify({proxy_url:proxyUrl})
});
const body=await update.text();
if(!update.ok){
  throw new Error("Clerk proxy update failed: HTTP "+update.status+" "+body);
}
console.log("Clerk proxy configured:",proxyUrl);
