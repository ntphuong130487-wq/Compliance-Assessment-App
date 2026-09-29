import fs from "node:fs";
const html=fs.readFileSync("index.html","utf8");
const checks=[
  ["7 màn hình",["Điều hành","Khung tuân thủ","Chương trình đánh giá","Kiểm tra hiện trường","Phát hiện","Khắc phục","Báo cáo"].every(x=>html.includes(x))],
  ["human-in-the-loop",html.includes("AI chỉ đề xuất")&&html.includes("Xác nhận Finding")],
  ["full-scope rule",html.includes("Để trống phạm vi requirement = kiểm toàn bộ")||html.includes("Để trống = toàn bộ requirement assessable")],
  ["evidence revision",html.includes("revisions")&&html.includes("version:1")],
  ["finding-action-verification",html.includes("data-actionfor")&&html.includes("data-verify")],
  ["demo disclaimer",html.includes("không phải số liệu tuân thủ thực tế của AgriS")],
  ["cloud sync client",html.includes("/api/state")&&html.includes("Cloud sync")],
  ["safe fallback",html.includes("Offline fallback")&&html.includes("localStorage")]
];
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length) throw new Error("Không tìm thấy script");
for(const s of scripts) new Function(s);
const failed=checks.filter(x=>!x[1]);
for(const [name,ok] of checks) console.log((ok?"PASS":"FAIL")+" - "+name);
if(failed.length) process.exit(1);
console.log("PASS - JavaScript syntax");
