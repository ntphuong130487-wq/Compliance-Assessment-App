import { chromium } from "playwright";

function assert(ok,msg){if(!ok)throw new Error(msg)}
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const consoleErrors=[];
page.on("console",m=>{if(m.type()==="error")consoleErrors.push(m.text())});
page.on("pageerror",e=>consoleErrors.push("PAGEERROR: "+e.message));

await page.goto("http://127.0.0.1:4173",{waitUntil:"networkidle"});
await page.waitForSelector("[data-nav='dashboard']");
assert((await page.locator("[data-nav]").count())>=8,"Expected 8 navigation screens");

const screens=[
  ["dashboard","Điều hành tuân thủ","COMPLIANCE CONTROL TOWER"],
  ["frameworks","Nguồn & Khung tuân thủ","SOURCE & OBLIGATION WORKSPACE"],
  ["assessments","Chương trình đánh giá","ASSESSMENT PLANNING"],
  ["fieldwork","Kiểm tra hiện trường","FIELDWORK & EVIDENCE"],
  ["findings","Phát hiện tuân thủ","FINDING LIFECYCLE"],
  ["actions","Khắc phục & xác minh","REMEDIATION & VERIFICATION"],
  ["reports","Báo cáo & giám sát","MANAGEMENT REPORTING"],
  ["settings","Cấu hình vận hành","ADMIN & OPERATIONS"]
];
for(const [nav,title,eyebrow] of screens){
  await page.locator("[data-nav='"+nav+"']").click();
  await page.waitForTimeout(40);
  const body=await page.locator("body").innerText();
  assert(body.includes(title),"Screen "+nav+" missing title: "+title);
  assert(body.includes(eyebrow),"Screen "+nav+" missing eyebrow: "+eyebrow);
  assert(await page.locator("[data-nav='"+nav+"'].on").count()===1,"Screen "+nav+" nav state not active");
}

// Product hardening checks on rendered DOM.
await page.locator("[data-nav='fieldwork']").click();
assert(await page.locator(".fieldwork-layout").count()===1,"Fieldwork layout missing");
assert((await page.locator("body").innerText()).includes("Evidence workspace"),"Evidence workspace missing");

await page.locator("[data-nav='findings']").click();
assert(await page.locator(".finding-timeline").count()>=1,"Finding timeline missing");

await page.locator("[data-nav='actions']").click();
assert(await page.locator(".aging-strip").count()===1,"Action aging strip missing");

await page.locator("[data-nav='frameworks']").click();
assert((await page.locator("body").innerText()).includes("Human review"),"Human-review language missing");

const fatal=consoleErrors.filter(x=>!/404|TEST_API_NOT_AVAILABLE|favicon/i.test(x));
assert(fatal.length===0,"Unexpected browser errors: "+fatal.join(" | "));

await browser.close();
console.log("PASS - browser-level regression across 8 product screens");
