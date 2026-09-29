import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});

function concatDir(dir,prefix){
  return fs.readdirSync(dir).filter(x=>x.startsWith(prefix)&&x.endsWith('.frag')).sort().map(x=>fs.readFileSync(path.join(dir,x),'utf8')).join('');
}
fs.writeFileSync(path.join(dist,'app.js'),concatDir(path.join(root,'src/app'),'app-'));
fs.writeFileSync(path.join(dist,'domain.js'),concatDir(path.join(root,'src/domain'),'domain-'));
for(const f of ['index.html','styles.css','store.js']) fs.copyFileSync(path.join(root,'src',f),path.join(dist,f));
console.log('Built dist:',fs.readdirSync(dist));
