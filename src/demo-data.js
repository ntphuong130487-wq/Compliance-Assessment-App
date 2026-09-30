(function(g){
  "use strict";
  g.AgriSComplianceDemoState=function(){
    var org=[
      {id:"agric",name:"AgriC"},{id:"proc",name:"ProC"},{id:"comc",name:"ComC"},
      {id:"tayninh",name:"Tây Ninh"},{id:"ninhhoa",name:"Ninh Hòa"},{id:"gialai",name:"Gia Lai"}
    ];
    var sources=[
      {id:"src_env",title:"Luật Bảo vệ môi trường 2020",sourceType:"Quy định nhà nước",sourceCode:"72/2020/QH14",issuer:"Quốc hội",effectiveFrom:"2022-01-01",status:"published",version:"2020",owner:"Compliance",createdAt:"2026-07-01T00:00:00Z"},
      {id:"src_lab",title:"Quy định an toàn lao động nội bộ",sourceType:"Quy định nội bộ",sourceCode:"ATLĐ-01",issuer:"AgriS",effectiveFrom:"2026-07-01",status:"published",version:"1.0",owner:"Compliance",createdAt:"2026-07-02T00:00:00Z"},
      {id:"src_vendor",title:"Quy trình đánh giá nhà cung cấp",sourceType:"Quy trình",sourceCode:"PROC-VDR-02",issuer:"AgriS",effectiveFrom:"2026-07-01",status:"pending_approval",version:"2.0",owner:"Compliance",createdAt:"2026-07-03T00:00:00Z"}
    ];
    var requirements=[
      {id:"r_env_01",code:"ENV-001",title:"Giấy phép môi trường còn hiệu lực",description:"Dữ liệu minh họa.",sourceId:"src_env",sourceClause:"Điều minh họa",assessable:true,test:"Đối chiếu giấy phép và phạm vi hoạt động.",expected:"Giấy phép môi trường.",status:"effective",applicability:""},
      {id:"r_env_02",code:"ENV-002",title:"Vận hành hệ thống xử lý nước thải đúng quy định",description:"Dữ liệu minh họa.",sourceId:"src_env",assessable:true,test:"Kiểm tra nhật ký vận hành và quan trắc.",expected:"Nhật ký vận hành, kết quả quan trắc.",status:"effective",applicability:""},
      {id:"r_env_03",code:"ENV-003",title:"Quản lý chất thải nguy hại đúng quy định",description:"Dữ liệu minh họa.",sourceId:"src_env",assessable:true,test:"Kiểm tra khu lưu giữ và chứng từ.",expected:"Chứng từ CTNH, hình ảnh khu lưu giữ.",status:"effective",applicability:""},
      {id:"r_lab_01",code:"LAB-001",title:"Đào tạo an toàn định kỳ cho người lao động",description:"Dữ liệu minh họa.",sourceId:"src_lab",assessable:true,test:"Đối chiếu hồ sơ đào tạo.",expected:"Danh sách đào tạo và chứng nhận.",status:"effective",applicability:""},
      {id:"r_lab_02",code:"LAB-002",title:"Trang bị và sử dụng phương tiện bảo hộ lao động",description:"Dữ liệu minh họa.",sourceId:"src_lab",assessable:true,test:"Kiểm tra hiện trường và cấp phát BHLĐ.",expected:"Biên bản cấp phát, hình ảnh.",status:"effective",applicability:""},
      {id:"r_lab_03",code:"LAB-003",title:"Hệ thống PCCC được bảo trì định kỳ",description:"Dữ liệu minh họa.",sourceId:"src_lab",assessable:true,test:"Đối chiếu biên bản bảo trì.",expected:"Biên bản bảo trì/kiểm định.",status:"effective",applicability:""},
      {id:"r_vdr_01",code:"VDR-001",title:"Nhà cung cấp được thẩm định trước khi phê duyệt",description:"Dữ liệu minh họa.",sourceId:"src_vendor",assessable:true,test:"Đối chiếu hồ sơ thẩm định.",expected:"Hồ sơ đánh giá NCC.",status:"pending_approval",applicability:""}
    ];
    var frameworks=[
      {id:"fw_env",code:"ENV",name:"Khung tuân thủ Môi trường",version:"1.0",status:"effective",reqIds:["r_env_01","r_env_02","r_env_03"]},
      {id:"fw_lab",code:"LAB",name:"Khung tuân thủ An toàn lao động",version:"1.0",status:"effective",reqIds:["r_lab_01","r_lab_02","r_lab_03"]},
      {id:"fw_vdr",code:"VDR",name:"Khung tuân thủ Nhà cung cấp",version:"0.9",status:"pending_approval",reqIds:["r_vdr_01"]}
    ];
    var assessments=[
      {id:"as_agric",name:"Đánh giá môi trường – AgriC",frameworkId:"fw_env",orgId:"agric",objective:"Đánh giá định kỳ.",processRef:"Sản xuất",activityRef:"Môi trường",locationRef:"AgriC",periodFrom:"2026-09-01",periodTo:"2026-10-15",leadAssessor:"Nguyễn Văn Minh",reviewer:"Trần Thị Lan",unitRepresentative:"Đại diện AgriC",status:"fieldwork",locked:false},
      {id:"as_tn",name:"Đánh giá môi trường – Tây Ninh",frameworkId:"fw_env",orgId:"tayninh",objective:"Đánh giá định kỳ.",processRef:"Sản xuất",activityRef:"Môi trường",locationRef:"Tây Ninh",periodFrom:"2026-09-05",periodTo:"2026-10-20",leadAssessor:"Lê Minh Tuấn",reviewer:"Nguyễn Thị Lan",unitRepresentative:"Đại diện Tây Ninh",status:"fieldwork",locked:false},
      {id:"as_nh",name:"Đánh giá ATLĐ – Ninh Hòa",frameworkId:"fw_lab",orgId:"ninhhoa",objective:"Đánh giá định kỳ.",processRef:"Sản xuất",activityRef:"An toàn lao động",locationRef:"Ninh Hòa",periodFrom:"2026-09-10",periodTo:"2026-11-15",leadAssessor:"Trần Quốc Huy",reviewer:"Phạm Thị Hà",unitRepresentative:"Đại diện Ninh Hòa",status:"review",locked:false},
      {id:"as_gl",name:"Đánh giá ATLĐ – Gia Lai",frameworkId:"fw_lab",orgId:"gialai",objective:"Đánh giá định kỳ.",processRef:"Sản xuất",activityRef:"An toàn lao động",locationRef:"Gia Lai",periodFrom:"2026-09-15",periodTo:"2026-12-01",leadAssessor:"Vũ Thị Hương",reviewer:"Lê Văn Dũng",unitRepresentative:"Đại diện Gia Lai",status:"draft",locked:false}
    ];
    var ra=[
      {id:"ra_a1",assessmentId:"as_agric",requirementId:"r_env_01",workflow:"done",result:"compliant",observation:"Giấy phép còn hiệu lực.",evidenceIds:["ev_1"]},
      {id:"ra_a2",assessmentId:"as_agric",requirementId:"r_env_02",workflow:"done",result:"non_compliant",observation:"Thiếu nhật ký vận hành một số ngày.",evidenceIds:["ev_2"]},
      {id:"ra_a3",assessmentId:"as_agric",requirementId:"r_env_03",workflow:"in_review",result:"partially_compliant",observation:"Khu lưu giữ cần bổ sung biển cảnh báo.",evidenceIds:[]},
      {id:"ra_t1",assessmentId:"as_tn",requirementId:"r_env_01",workflow:"done",result:"non_compliant",observation:"Hồ sơ gia hạn chưa hoàn tất.",evidenceIds:[]},
      {id:"ra_t2",assessmentId:"as_tn",requirementId:"r_env_02",workflow:"done",result:"compliant",observation:"Đạt.",evidenceIds:[]},
      {id:"ra_t3",assessmentId:"as_tn",requirementId:"r_env_03",workflow:"in_review",result:"insufficient_evidence",observation:"Chưa đủ chứng từ.",evidenceIds:[]},
      {id:"ra_n1",assessmentId:"as_nh",requirementId:"r_lab_01",workflow:"done",result:"non_compliant",observation:"Còn nhân sự chưa đào tạo.",evidenceIds:[]},
      {id:"ra_n2",assessmentId:"as_nh",requirementId:"r_lab_02",workflow:"done",result:"compliant",observation:"Đạt.",evidenceIds:[]},
      {id:"ra_n3",assessmentId:"as_nh",requirementId:"r_lab_03",workflow:"done",result:"compliant",observation:"Đạt.",evidenceIds:[]},
      {id:"ra_g1",assessmentId:"as_gl",requirementId:"r_lab_01",workflow:"to_do",result:"not_assessed",observation:"",evidenceIds:[]},
      {id:"ra_g2",assessmentId:"as_gl",requirementId:"r_lab_02",workflow:"to_do",result:"not_assessed",observation:"",evidenceIds:[]},
      {id:"ra_g3",assessmentId:"as_gl",requirementId:"r_lab_03",workflow:"to_do",result:"not_assessed",observation:"",evidenceIds:[]}
    ];
    var findings=[
      {id:"fd_1",raId:"ra_a2",title:"Nhật ký vận hành hệ thống xử lý nước thải chưa đầy đủ",fact:"Thiếu ghi nhận tại một số ngày kiểm tra.",criteria:"ENV-002",gap:"Chưa đáp ứng yêu cầu ghi nhận vận hành.",impact:"Nguy cơ không chứng minh được tuân thủ vận hành.",severity:"high",status:"final",rec:"Bổ sung và chuẩn hóa nhật ký vận hành.",createdAt:"2026-09-18T08:00:00Z"},
      {id:"fd_2",raId:"ra_a3",title:"Khu lưu giữ CTNH thiếu biển cảnh báo",fact:"Một vị trí chưa có biển cảnh báo.",criteria:"ENV-003",gap:"Thiếu nhận diện tại khu lưu giữ.",impact:"Rủi ro thao tác không phù hợp.",severity:"medium",status:"pending_unit_response",rec:"Bổ sung biển cảnh báo.",createdAt:"2026-09-20T08:00:00Z"},
      {id:"fd_3",raId:"ra_t1",title:"Hồ sơ gia hạn giấy phép môi trường chưa hoàn tất",fact:"Hồ sơ đang hoàn thiện.",criteria:"ENV-001",gap:"Chưa có hồ sơ gia hạn hoàn chỉnh.",impact:"Rủi ro gián đoạn hiệu lực giấy phép.",severity:"critical",status:"final",rec:"Hoàn thiện hồ sơ và theo dõi cấp phép.",createdAt:"2026-09-12T08:00:00Z"},
      {id:"fd_4",raId:"ra_n1",title:"Chưa hoàn thành đào tạo ATLĐ cho toàn bộ nhân sự",fact:"Một nhóm nhân sự chưa có hồ sơ đào tạo.",criteria:"LAB-001",gap:"Thiếu bằng chứng đào tạo.",impact:"Rủi ro an toàn và tuân thủ.",severity:"high",status:"pending_final_review",rec:"Hoàn tất đào tạo bổ sung.",createdAt:"2026-09-16T08:00:00Z"}
    ];
    var responses=[
      {id:"resp_1",findingId:"fd_4",type:"Đồng ý",text:"Đơn vị đã lập kế hoạch đào tạo bổ sung.",at:"2026-09-25T07:30:00Z",persona:"unit_owner"}
    ];
    var actions=[
      {id:"act_1",findingId:"fd_1",text:"Chuẩn hóa và bổ sung nhật ký vận hành",owner:"Đại diện AgriC",ownerPersonaId:"p_unit",due:"2026-10-05",status:"open",createdAt:"2026-09-19T08:00:00Z",closureEvidenceIds:[]},
      {id:"act_2",findingId:"fd_3",text:"Hoàn thiện hồ sơ gia hạn giấy phép",owner:"Đại diện Tây Ninh",ownerPersonaId:"p_unit",due:"2026-09-28",status:"submitted_for_verification",createdAt:"2026-09-13T08:00:00Z",closureSubmittedAt:"2026-09-27T08:00:00Z",closureEvidenceIds:["ev_3"]}
    ];
    var evidence=[
      {id:"ev_1",name:"Giay_phep_moi_truong.pdf",type:"application/pdf",storage:"local-metadata"},
      {id:"ev_2",name:"Nhat_ky_van_hanh.pdf",type:"application/pdf",storage:"local-metadata"},
      {id:"ev_3",name:"Ho_so_gia_han.pdf",type:"application/pdf",storage:"local-metadata"}
    ];
    var revisions=[
      {id:"rv_1",evidenceId:"ev_1",version:1,size:120000,mime:"application/pdf",capturedAt:"2026-09-10T00:00:00Z"},
      {id:"rv_2",evidenceId:"ev_2",version:1,size:98000,mime:"application/pdf",capturedAt:"2026-09-18T00:00:00Z"},
      {id:"rv_3",evidenceId:"ev_3",version:1,size:140000,mime:"application/pdf",capturedAt:"2026-09-27T00:00:00Z"}
    ];
    var links=[
      {id:"ln_1",revId:"rv_1",targetId:"ra_a1",targetType:"RequirementAssessment"},
      {id:"ln_2",revId:"rv_2",targetId:"ra_a2",targetType:"RequirementAssessment"},
      {id:"ln_3",revId:"rv_3",targetId:"act_2",targetType:"RemediationAction",purpose:"closure_evidence"}
    ];
    return{
      meta:{demo:true,version:"0.8-demo",label:"Dữ liệu minh họa"},
      org:org,sources:sources,draftRequirements:[],frameworks:frameworks,requirements:requirements,
      assessments:assessments,ra:ra,evidence:evidence,revisions:revisions,links:links,proposals:[],
      findings:findings,responses:responses,actions:actions,verifications:[],notifications:[],
      notificationSettings:{inApp:true,overdueEscalation:true,reminderBeforeDueDays:3},
      logs:[{id:"log_demo",type:"seed_demo",object:"System",at:"2026-09-30T00:00:00Z",note:"Dữ liệu minh họa phục vụ demo, không phải dữ liệu thực tế của AgriS."}]
    };
  };
})(window);
