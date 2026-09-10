import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const required=['VERSION','BP1P.html','docker-compose.yml','docker-compose.public.yml','docker-compose.node.yml','directory/server.mjs','node/server.mjs','client/BP1P.html'];
let bad=0;
for(const rel of required){const p=path.join(root,rel);if(fs.existsSync(p))console.log('PASS',rel);else{console.error('FAIL missing',rel);bad++;}}
const client=fs.readFileSync(path.join(root,'client/BP1P.html'),'utf8');
for(const needle of ['Ed25519','/api/manifest','/p/','__BP1P_DIRECTORY_URL__','__BP1P_DIRECTORY_KEY__']){if(client.includes(needle))console.log('PASS client',needle);else{console.error('FAIL client missing',needle);bad++;}}
process.exitCode=bad?1:0;
