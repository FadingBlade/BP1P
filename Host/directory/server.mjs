import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA = process.env.BP1P_DATA_DIR || '/data';
fs.mkdirSync(DATA, { recursive: true });
const statePath = path.join(DATA, 'directory-state.json');
const keyPath = path.join(DATA, 'directory-key.pem');
const pubPath = path.join(DATA, 'directory-public.pem');
const publicBaseUrl = process.env.BP1P_PUBLIC_BASE_URL || 'http://localhost:8080';
const adminToken = process.env.BP1P_ADMIN_TOKEN || '1';
const publicPort = Number(process.env.BP1P_DIRECTORY_PORT || 8080);
const adminPort = Number(process.env.BP1P_DIRECTORY_ADMIN_PORT || 8790);
const autoApproveLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(publicBaseUrl);

if (!fs.existsSync(keyPath)) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));
}
const directoryPrivateKey = crypto.createPrivateKey(fs.readFileSync(keyPath));
const directoryPublicPem = fs.readFileSync(pubPath, 'utf8');
const directoryPublicDer = crypto.createPublicKey(directoryPublicPem).export({ type: 'spki', format: 'der' });
const directoryKeyId = crypto.createHash('sha256').update(directoryPublicDer).digest('hex').slice(0, 24);

let state = { version: 1, nodes: {} };
try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch {}
function save() { fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); }
function json(res, status, body, extra={}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type':'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'access-control-allow-origin':'*',
    'access-control-allow-methods':'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers':'content-type,authorization',
    'cache-control':'no-store', ...extra
  });
  res.end(data);
}
function readBody(req, limit=1024*1024) { return new Promise((resolve,reject)=>{ const chunks=[]; let n=0; req.on('data',c=>{ n+=c.length; if(n>limit){reject(new Error('body too large')); req.destroy(); return;} chunks.push(c);}); req.on('end',()=>resolve(Buffer.concat(chunks))); req.on('error',reject); }); }
function canonical(obj) { return JSON.stringify(obj, Object.keys(obj).sort()); }
function pemFromB64Der(b64) {
  const der = Buffer.from(b64, 'base64');
  return crypto.createPublicKey({ key: der, type:'spki', format:'der' });
}
function publicKeyB64() { return Buffer.from(directoryPublicDer).toString('base64'); }
function manifestObject() {
  const now = Date.now();
  const nodes = Object.values(state.nodes).filter(n => n.status==='approved' && now-(n.lastSeen||0)<120000).map(n => ({
    id:n.id, name:n.name, url:n.url, publicKey:n.publicKey, apps:n.apps || [], lastSeen:n.lastSeen
  })).sort((a,b)=>a.id.localeCompare(b.id));
  return { protocol:'BP1P/2', manifestVersion: state.version, issuedAt:new Date().toISOString(), expiresAt:new Date(Date.now()+5*60*1000).toISOString(), directoryKeyId, nodes };
}
function signedManifest() {
  const manifest = manifestObject();
  const bytes = Buffer.from(JSON.stringify(manifest));
  const signature = crypto.sign(null, bytes, directoryPrivateKey).toString('base64');
  return { manifest, signature, publicKey: publicKeyB64(), algorithm:'Ed25519' };
}
function auth(req){ return req.headers.authorization === `Bearer ${adminToken}`; }

const publicServer = http.createServer(async (req,res)=>{
  const u = new URL(req.url, publicBaseUrl);
  if(req.method==='OPTIONS'){ res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':'content-type,authorization'}); return res.end(); }
  if(req.method==='GET' && u.pathname==='/healthz') return json(res,200,{ok:true,service:'bp1p-directory',protocol:'BP1P/2',keyId:directoryKeyId,nodes:Object.keys(state.nodes).length});
  if(req.method==='GET' && u.pathname==='/api/public-key') return json(res,200,{algorithm:'Ed25519',keyId:directoryKeyId,publicKey:publicKeyB64()});
  if(req.method==='GET' && u.pathname==='/api/manifest') return json(res,200,signedManifest());
  if(req.method==='POST' && u.pathname==='/api/nodes/register') {
    try {
      const body=JSON.parse((await readBody(req)).toString('utf8'));
      const {payload, signature, publicKey}=body;
      if(!payload || !signature || !publicKey) return json(res,400,{error:'missing registration fields'});
      const key = pemFromB64Der(publicKey);
      const ok = crypto.verify(null, Buffer.from(JSON.stringify(payload)), key, Buffer.from(signature,'base64'));
      if(!ok) return json(res,403,{error:'invalid node signature'});
      if(!payload.id || !payload.url || !/^https?:\/\//i.test(payload.url)) return json(res,400,{error:'invalid node identity or url'});
      const existing=state.nodes[payload.id];
      if(existing && existing.publicKey !== publicKey) return json(res,409,{error:'node id already bound to another key'});
      const status = existing?.status || (autoApproveLocal ? 'approved' : 'pending');
      state.nodes[payload.id]={...existing,...payload,publicKey,status,lastSeen:Date.now()};
      state.version++; save();
      return json(res,200,{ok:true,status});
    } catch(e){ return json(res,400,{error:e.message}); }
  }
  json(res,404,{error:'not found'});
});

const adminHtml=fs.readFileSync(new URL('./admin-console.html',import.meta.url),'utf8');

const adminServer=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost:8790');
  if(req.method==='GET' && (u.pathname==='/'||u.pathname==='/index.html')){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end(adminHtml)}
  if(!auth(req)) return json(res,401,{error:'unauthorized'});
  if(req.method==='GET' && u.pathname==='/admin/api/nodes') return json(res,200,{keyId:directoryKeyId,publicKey:publicKeyB64(),nodes:Object.values(state.nodes).sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0))});
  const m=u.pathname.match(/^\/admin\/api\/nodes\/([^/]+)\/(approve|revoke)$/);
  if(req.method==='POST' && m){const id=decodeURIComponent(m[1]); const n=state.nodes[id]; if(!n)return json(res,404,{error:'node not found'}); n.status=m[2]==='approve'?'approved':'revoked'; state.version++; save(); return json(res,200,{ok:true,status:n.status});}
  json(res,404,{error:'not found'});
});

publicServer.listen(publicPort,'0.0.0.0',()=>console.log(`BP1P directory public API listening on :${publicPort} (${directoryKeyId})`));
adminServer.listen(adminPort,'0.0.0.0',()=>console.log(`BP1P directory admin console listening on :${adminPort}`));
