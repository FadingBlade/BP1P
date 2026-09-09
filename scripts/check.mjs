import { spawn } from 'node:child_process';
const p=spawn(process.execPath,['directory/server.mjs'],{cwd:new URL('..',import.meta.url).pathname,env:{...process.env,PORT:'18080'}});
await new Promise(r=>setTimeout(r,300));
try{const r=await fetch('http://127.0.0.1:18080/healthz');if(!r.ok)throw new Error('health failed');const j=await r.json();if(!j.ok)throw new Error('bad health');console.log('directory health PASS')}finally{p.kill()}
