import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

let failed=false;
const htmlFiles=['Client/BP1P.html','Client/BP1P.template.html','Host/node/admin-console.html','Host/directory/admin-console.html'];
for(const f of htmlFiles){
  const s=fs.readFileSync(f,'utf8');
  const m=s.match(/<script>([\s\S]*?)<\/script>/i);
  if(!m){console.error('FAIL no script:',f);failed=true;continue}
  try{new vm.Script(m[1],{filename:f});console.log('PASS JS:',f)}
  catch(e){console.error('FAIL JS:',f,'\n'+e.stack);failed=true}
}

for(const f of ['Host/node/server.mjs','Host/directory/server.mjs']){
  const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(r.status===0) console.log('PASS module parse:',f);
  else {console.error('FAIL module:',f,'\n'+(r.stderr||r.stdout));failed=true}
}

// Check Dockerfile COPY sources against the repository root build context.
for(const f of ['Host/node/Dockerfile','Host/directory/Dockerfile']){
  const lines=fs.readFileSync(f,'utf8').split(/\r?\n/);
  lines.forEach((line,i)=>{
    const t=line.trim();
    if(!/^COPY\s+/i.test(t)) return;
    const parts=t.replace(/^COPY\s+/i,'').trim().split(/\s+/);
    for(const src of parts.slice(0,-1)){
      if(src.startsWith('--')) continue;
      if(!fs.existsSync(src)){
        console.error(`FAIL Docker COPY: ${f}:${i+1} missing ${src}`);
        failed=true;
      }
    }
  });
}
if(!failed) console.log('PASS Docker COPY paths');
if(failed) process.exit(1);
