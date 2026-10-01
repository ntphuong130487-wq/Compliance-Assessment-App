(function(){
  var root=window.ComplianceScreens=window.ComplianceScreens||{};
  root.util={
    formatBytes:function(n){n=Number(n||0);if(!n)return"—";if(n<1024)return n+" B";if(n<1048576)return Math.round(n/1024)+" KB";return (n/1048576).toFixed(n<10485760?1:0)+" MB"},
    fmtDate:function(v){if(!v)return"—";try{return new Date(v).toLocaleString("vi-VN")}catch(e){return String(v)}},
    confidence:function(v){var n=Number(v);if(!Number.isFinite(n))return{label:"Chưa chấm",tone:"neutral",pct:null};var pct=Math.round(Math.max(0,Math.min(1,n))*100);return{label:pct>=85?"Cao":pct>=65?"Trung bình":"Thấp",tone:pct>=85?"positive":pct>=65?"warning":"danger",pct:pct}},
    aging:function(d){if(d===null||d===undefined)return{label:"Chưa có hạn",tone:"neutral",bucket:"no_due"};if(d<0)return{label:"Quá hạn "+Math.abs(d)+" ngày",tone:"danger",bucket:"overdue"};if(d<=7)return{label:"Còn "+d+" ngày",tone:"warning",bucket:"due_7"};if(d<=30)return{label:"Còn "+d+" ngày",tone:"info",bucket:"due_30"};return{label:"Còn "+d+" ngày",tone:"neutral",bucket:"later"}}
  };
})();