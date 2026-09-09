const pending = new Map();
let bridgeClientId = null;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('message', e => {
  const m=e.data||{};
  if(m.type==='BP1P_BRIDGE_READY') bridgeClientId=e.source?.id||null;
  if(m.type==='BP1P_FETCH_RESULT'){
    const p=pending.get(m.id); if(!p)return; pending.delete(m.id); m.ok?p.resolve(m.result):p.reject(new Error(m.error||'BP1P bridge error'));
  }
});
function headersObject(h){const o={};for(const [k,v] of h)o[k]=v;return o}
async function bridge(req){
  let client = bridgeClientId ? await self.clients.get(bridgeClientId) : null;
  if(!client){const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true});client=cs.find(c=>!new URL(c.url).pathname.startsWith('/__bp1p__/'));if(client)bridgeClientId=client.id}
  if(!client)throw new Error('BP1P bridge page is unavailable.');
  const id=crypto.randomUUID();
  const promise=new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});setTimeout(()=>{if(pending.delete(id))reject(new Error('BP1P bridge timeout'))},35000)});
  client.postMessage({type:'BP1P_FETCH',id,request:req},req.body?[req.body]:[]);
  return promise;
}
self.addEventListener('fetch', e=>{
  const u=new URL(e.request.url); if(!u.pathname.startsWith('/__bp1p__/'))return;
  e.respondWith((async()=>{
    try{
      const rest=u.pathname.slice('/__bp1p__/'.length); const slash=rest.indexOf('/');
      if(slash<0)return new Response('Bad BP1P path',{status:400});
      const app=decodeURIComponent(rest.slice(0,slash)); let p='/' + rest.slice(slash+1); if(p.endsWith('/'))p+='index.html'; p+=u.search;
      let body=null;if(!['GET','HEAD'].includes(e.request.method))body=await e.request.clone().arrayBuffer();
      const result=await bridge({app,method:e.request.method,path:p,headers:headersObject(e.request.headers),body});
      const headers=new Headers(result.headers||{}); headers.set('x-bp1p','1');
      return new Response(e.request.method==='HEAD'?null:result.body,{status:result.status||200,headers});
    }catch(err){return new Response('BP1P: '+(err.message||err),{status:502,headers:{'content-type':'text/plain; charset=utf-8'}})}
  })());
});
