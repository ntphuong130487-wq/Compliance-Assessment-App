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
assert(app.length<90000,"app.js refactor target not met; current length "+app.length);
assert(read("src/screens/fieldwork.js").includes("Evidence workspace"),"Evidence workspace missing");
assert(read("src/screens/findings.js").includes("finding-timeline"),"Finding timeline missing");
assert(read("src/screens/actions.js").includes("aging-strip"),"Action aging missing");
assert(read("src/screens/frameworks.js").includes("Human review bắt buộc"),"AI human-review UX missing");
console.log("PASS - modular screens and product workspaces");
