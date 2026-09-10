import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';

const DATA=process.env.BP1P_DATA_DIR || '/data'; fs.mkdirSync(DATA,{recursive:true});
const cfgPath=path.join(DATA,'apps.json'); const keyPath=path.join(DATA,'node-key.pem'); const pubPath=path.join(DATA,'node-public.pem');
const directoryUrl=process.env.BP1P_DIRECTORY_URL||'http://directory:8080';
const publicUrl=(process.env.BP1P_PUBLIC_URL||'http://localhost:8081').replace(/\/$/,'');
const nodeName=process.env.BP1P_NODE_NAME||'BP1P Node';
const adminToken=process.env.BP1P_ADMIN_TOKEN||'1';
const allowPrivate=String(process.env.BP1P_ALLOW_PRIVATE_UPSTREAMS||'false').toLowerCase()==='true';
const publicPort=Number(process.env.BP1P_NODE_PORT||8081);
const adminPort=Number(process.env.BP1P_NODE_ADMIN_PORT||8787);
if(!fs.existsSync(keyPath)){const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');fs.writeFileSync(keyPath,privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});fs.writeFileSync(pubPath,publicKey.export({type:'spki',format:'pem'}));}
const privateKey=crypto.createPrivateKey(fs.readFileSync(keyPath)); const publicKey=crypto.createPublicKey(fs.readFileSync(pubPath));
const publicDer=publicKey.export({type:'spki',format:'der'}); const publicB64=Buffer.from(publicDer).toString('base64');
const nodeId=crypto.createHash('sha256').update(publicDer).digest('hex').slice(0,24);
let apps=[]; try{apps=JSON.parse(fs.readFileSync(cfgPath,'utf8'));}catch{apps=[{id:'example',name:'Example',description:'Starter proxy application',target:'https://example.com',enabled:true}];fs.writeFileSync(cfgPath,JSON.stringify(apps,null,2));}
const jars=new Map();
function saveApps(){fs.writeFileSync(cfgPath,JSON.stringify(apps,null,2));}
function json(res,status,obj,headers={}){const b=JSON.stringify(obj);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(b),'access-control-allow-origin':'*','cache-control':'no-store',...headers});res.end(b)}
function auth(req){return req.headers.authorization===`Bearer ${adminToken}`}
function sid(req,res){let id=(req.headers.cookie||'').match(/(?:^|;\s*)bp1p_sid=([A-Za-z0-9_-]+)/)?.[1];if(!id){id=crypto.randomBytes(18).toString('base64url');res.setHeader('set-cookie',`bp1p_sid=${id}; Path=/; HttpOnly; SameSite=Lax`)}if(!jars.has(id))jars.set(id,new Map());return id}
function isPrivateIp(ip){if(net.isIP(ip)===4){const p=ip.split('.').map(Number);return p[0]===10||p[0]===127||p[0]===0||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||(p[0]>=224);} if(net.isIP(ip)===6){const x=ip.toLowerCase();return x==='::1'||x.startsWith('fc')||x.startsWith('fd')||x.startsWith('fe80')||x==='::';}return true}
async function validateTarget(url){const u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw Error('Only http/https targets are supported');if(u.username||u.password)throw Error('Credentials in target URLs are not allowed');if(allowPrivate)return;const records=await dns.lookup(u.hostname,{all:true});if(records.some(r=>isPrivateIp(r.address)))throw Error('Private/reserved upstream addresses are blocked');}
function appPublic(a){return {id:a.id,name:a.name,description:a.description||'',targetOrigin:new URL(a.target).origin};}
async function register(){try{const payload={id:nodeId,name:nodeName,url:publicUrl,apps:apps.filter(a=>a.enabled).map(appPublic),timestamp:new Date().toISOString()};const signature=crypto.sign(null,Buffer.from(JSON.stringify(payload)),privateKey).toString('base64');const r=await fetch(directoryUrl+'/api/nodes/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({payload,signature,publicKey:publicB64})});const j=await r.json();if(!r.ok)throw Error(j.error||r.statusText);console.log(`directory registration: ${j.status}`)}catch(e){console.error('directory registration failed:',e.message)}}
function proxyPath(appId, pathname, sessionId=''){const prefix=sessionId?`/s/${encodeURIComponent(sessionId)}/p/${encodeURIComponent(appId)}`:`/p/${encodeURIComponent(appId)}`;return `${prefix}${pathname.startsWith('/')?pathname:'/'+pathname}`}
function rewriteText(text,origin,appId,contentType='',sessionId=''){
  const mount=`${publicUrl}${proxyPath(appId,'/',sessionId).replace(/\/$/,'')}`;
  const originUrl=new URL(origin);
  const escOrigin=origin.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  text=text.replace(new RegExp(escOrigin,'g'),mount);
  // Protocol-relative references to the configured upstream.
  const protoRel='//'+originUrl.host;
  text=text.split(protoRel).join(mount);
  // Root-relative references in HTML/CSS/JS/JSON/SVG.
  text=text.replace(/(["'(=\s])\/(?!\/)([^"'\s)>]*)/g,(m,p,x)=>`${p}${proxyPath(appId,'/'+x,sessionId)}`);
  // A base tag makes ordinary relative links, scripts, forms and assets resolve under the proxy mount.
  if(/text\/html/i.test(contentType) && !/<base\b/i.test(text)){
    const base=`<base href="${mount}/">`;
    if(/<head\b[^>]*>/i.test(text)) text=text.replace(/<head\b([^>]*)>/i,`<head$1>${base}`);
    else text=base+text;
  }
  return text;
}
async function proxy(req,res,u){const sm=u.pathname.match(/^\/s\/([A-Za-z0-9_-]{8,128})\/p\/([^/]+)(\/.*)?$/);const dm=u.pathname.match(/^\/p\/([^/]+)(\/.*)?$/);if(!sm&&!dm)return false;const sessionId=sm?sm[1]:'';const appId=decodeURIComponent(sm?sm[2]:dm[1]);const reqPath=sm?(sm[3]||'/'):(dm[2]||'/');const app=apps.find(a=>a.id===appId&&a.enabled);if(!app){json(res,404,{error:'application not found'});return true;}try{await validateTarget(app.target);const base=new URL(app.target);const target=new URL(reqPath,base);if(target.origin!==base.origin)throw Error('cross-origin target rejected');target.search=u.search;const headers=new Headers();for(const [k,v] of Object.entries(req.headers)){if(['host','cookie','origin','referer','content-length','connection'].includes(k))continue;if(Array.isArray(v))headers.set(k,v.join(', '));else if(v)headers.set(k,v);}headers.set('origin',base.origin);headers.set('referer',base.origin+'/');headers.set('accept-encoding','identity');const id=sessionId||sid(req,res);if(!jars.has(id))jars.set(id,new Map());const jar=jars.get(id);const cookie=jar.get(base.origin);if(cookie)headers.set('cookie',cookie);let body; if(!['GET','HEAD'].includes(req.method)){const chunks=[];for await(const c of req)chunks.push(c);body=Buffer.concat(chunks)}const upstream=await fetch(target,{method:req.method,headers,body,redirect:'manual'});const setCookie=upstream.headers.get('set-cookie');if(setCookie){const simple=setCookie.split(';')[0];if(simple)jar.set(base.origin,(jar.get(base.origin)?jar.get(base.origin)+'; ':'')+simple)}const loc=upstream.headers.get('location');if(loc){const next=new URL(loc,target);if(next.origin===base.origin){res.statusCode=upstream.status;res.setHeader('location',proxyPath(app.id,next.pathname,sessionId)+next.search+next.hash);return res.end();}}
const ct=upstream.headers.get('content-type')||'application/octet-stream';const rewrite=/text\/html|text\/css|javascript|application\/json|image\/svg\+xml/i.test(ct);const strip=new Set(['content-length','content-security-policy','content-security-policy-report-only','x-frame-options','cross-origin-opener-policy','cross-origin-resource-policy','cross-origin-embedder-policy','set-cookie','location','connection','content-encoding','transfer-encoding']);for(const [k,v] of upstream.headers){if(!strip.has(k.toLowerCase()))res.setHeader(k,v)}res.statusCode=upstream.status;res.setHeader('x-bp1p-node',nodeId);if(req.method==='HEAD')return res.end();if(rewrite){let t=await upstream.text();t=rewriteText(t,base.origin,app.id,ct,sessionId);res.setHeader('content-type',ct);return res.end(t)}const ab=await upstream.arrayBuffer();res.end(Buffer.from(ab));}catch(e){json(res,502,{error:'proxy request failed',detail:e.message});}return true;}

const publicServer=http.createServer(async(req,res)=>{const u=new URL(req.url,publicUrl);if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS','access-control-allow-headers':'*'});return res.end()}if(req.method==='GET'&&u.pathname==='/healthz')return json(res,200,{ok:true,service:'bp1p-node',protocol:'BP1P/2',id:nodeId,name:nodeName,apps:apps.filter(a=>a.enabled).length});if(req.method==='GET'&&u.pathname==='/api/apps')return json(res,200,{node:{id:nodeId,name:nodeName,url:publicUrl},apps:apps.filter(a=>a.enabled).map(appPublic)});if(await proxy(req,res,u))return;json(res,404,{error:'not found'});});

const adminHtml=fs.readFileSync(new URL('./admin-console.html',import.meta.url),'utf8');
const adminServer=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost:8787');if(req.method==='GET'&&(u.pathname==='/'||u.pathname==='/index.html')){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end(adminHtml)}if(!auth(req))return json(res,401,{error:'unauthorized'});if(req.method==='GET'&&u.pathname==='/admin/api/state')return json(res,200,{id:nodeId,name:nodeName,publicUrl,directoryUrl,directoryStatus:'registered/heartbeat',publicKey:publicB64,apps});if(req.method==='POST'&&u.pathname==='/admin/api/apps'){try{const a=JSON.parse(Buffer.concat(await (async()=>{const c=[];for await(const x of req)c.push(x);return c})()).toString());if(!/^[a-z0-9][a-z0-9_-]{1,48}$/i.test(a.id||''))return json(res,400,{error:'App ID must be 2-49 letters/numbers/_/-'});await validateTarget(a.target);if(apps.some(x=>x.id===a.id))return json(res,409,{error:'App ID already exists'});apps.push({id:a.id,name:a.name||a.id,description:a.description||'',target:a.target,enabled:a.enabled!==false});saveApps();await register();return json(res,201,{ok:true})}catch(e){return json(res,400,{error:e.message})}}const m=u.pathname.match(/^\/admin\/api\/apps\/([^/]+)$/);if(req.method==='DELETE'&&m){apps=apps.filter(a=>a.id!==decodeURIComponent(m[1]));saveApps();await register();return json(res,200,{ok:true})}json(res,404,{error:'not found'});});
publicServer.listen(publicPort,'0.0.0.0',()=>console.log(`BP1P node ${nodeName} (${nodeId}) listening on :${publicPort}`));adminServer.listen(adminPort,'0.0.0.0',()=>console.log(`BP1P node console listening on :${adminPort}`));register();setInterval(register,30000).unref();
