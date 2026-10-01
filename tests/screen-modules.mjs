import fs from "node:fs";

function read(p){return fs.readFileSync(p,"utf8")}
function assert(ok,msg){if(!ok)throw new Error(msg)}

const index=read("index.html");
const app=read("src/app.js");
const modules=["shared","dashboard","frameworks","assessments","fieldwork","findings","actions","reports","settings"];
for(const name of modules){
  const p="src/screens/"+name+".js";
  assert(fs.existsSync(p),"Missing screen module "+p);
  assert(index.includes("/"+p),"index.html does not load "+p);
}
for(const screen of ["dashboard","frameworks","assessments","fieldwork","findings","actions","reports","settings"]){
  assert(app.includes("Screens."+screen+"(screenContext())"),"app.js does not delegate "+screen);
}
assert(app.length<105000,"app.js v2 modularization guardrail exceeded; current length "+app.length);
const fieldwork=read("src/screens/fieldwork.js"),frameworks=read("src/screens/frameworks.js");
assert(fieldwork.includes("Evidence workspace"),"Evidence workspace missing");
assert(fieldwork.includes("data-evidence-preview")&&fieldwork.includes("data-evidence-download"),"Evidence preview/download controls missing");
assert(read("src/screens/findings.js").includes("finding-timeline"),"Finding timeline missing");
assert(read("src/screens/actions.js").includes("aging-strip"),"Action aging missing");
assert(frameworks.includes("Human review bắt buộc"),"AI human-review UX missing");
assert(frameworks.includes("review-audit")&&frameworks.includes("draftReviewEvents"),"AI human-review audit UI missing");
console.log("PASS - modular screens and product workspaces");
