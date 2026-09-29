export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const configured=Boolean(process.env.REGULATION_SEARCH_PROVIDER);
  if(req.method==="GET"){
    return res.status(200).json({
      ok:true,
      configured,
      provider:configured?process.env.REGULATION_SEARCH_PROVIDER:null,
      message:configured?"Search provider configured.":"Chưa cấu hình nguồn tìm kiếm quy định nhà nước."
    });
  }
  if(req.method!=="POST"){
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({ok:false,error:"METHOD_NOT_ALLOWED"});
  }
  if(!configured){
    return res.status(501).json({
      ok:false,error:"SEARCH_PROVIDER_NOT_CONFIGURED",
      message:"Chưa cấu hình nguồn pháp lý công khai. Không tạo kết quả giả."
    });
  }
  return res.status(501).json({ok:false,error:"PROVIDER_ADAPTER_NOT_IMPLEMENTED"});
}
