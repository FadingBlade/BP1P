import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '../client');
const port = Number(process.env.PORT || 8080);
const leaseMs = Number(process.env.BP1P_NODE_LEASE_MS || 45000);
const sessionMs = Number(process.env.BP1P_SESSION_TTL_MS || 120000);
const adminToken = process.env.BP1P_DIRECTORY_ADMIN_TOKEN || '';

const nodes = new Map();
const sessions = new Map();

const json = (res, status, value) => {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS'
  });
  res.end(body);
};

const readJson = async (req, limit = 2 * 1024 * 1024) => {
  const parts = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw new Error('body too large');
    parts.push(chunk);
  }
  if (!parts.length) return {};
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
};

const clean = () => {
  const now = Date.now();
  for (const [id, n] of nodes) if (now - n.lastSeen > leaseMs) nodes.delete(id);
  for (const [id, s] of sessions) if (now - s.createdAt > sessionMs) sessions.delete(id);
};
setInterval(clean, 10000).unref();

function publicNode(n) {
  return {
    id: n.id,
    name: n.name,
    region: n.region,
    protocol: n.protocol,
    apps: n.apps,
    lastSeen: n.lastSeen
  };
}

async function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  rel = path.posix.normalize('/' + rel).replace(/^\/+/, '');
  const file = path.resolve(clientRoot, rel);
  if (!file.startsWith(clientRoot + path.sep) && file !== clientRoot) return false;
  try {
    const st = await stat(file);
    if (!st.isFile()) return false;
    const ext = path.extname(file).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
    };
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': types[ext] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=300'
    });
    if (req.method === 'HEAD') res.end(); else res.end(body);
    return true;
  } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const p = u.pathname;
    if (req.method === 'OPTIONS') return json(res, 204, {});
    if (req.method === 'GET' && p === '/healthz') return json(res, 200, { ok: true, service: 'bp1p-directory' });

    if (req.method === 'GET' && p === '/api/nodes') {
      clean();
      return json(res, 200, { protocol: 'BP1P/1', nodes: [...nodes.values()].map(publicNode) });
    }

    if (req.method === 'POST' && p === '/api/nodes/register') {
      const b = await readJson(req);
      if (!b.id || !b.name || !Array.isArray(b.apps) || !b.nodeToken) return json(res, 400, { error: 'bad_registration' });
      if (adminToken && req.headers.authorization !== `Bearer ${adminToken}`) return json(res, 403, { error: 'registration_disabled' });
      const old = nodes.get(b.id);
      if (old && old.nodeToken !== b.nodeToken) return json(res, 403, { error: 'node_token_mismatch' });
      const safeApps = b.apps.slice(0, 64).map(a => ({ id: String(a.id || ''), name: String(a.name || a.id || ''), description: String(a.description || '') })).filter(a => a.id);
      nodes.set(b.id, {
        id: String(b.id), name: String(b.name).slice(0, 100), region: String(b.region || 'unknown').slice(0, 64),
        protocol: 'BP1P/1', apps: safeApps, nodeToken: String(b.nodeToken), lastSeen: Date.now()
      });
      return json(res, 200, { ok: true, leaseMs });
    }

    if (req.method === 'POST' && p === '/api/sessions') {
      clean();
      const b = await readJson(req);
      const node = nodes.get(String(b.nodeId || ''));
      if (!node) return json(res, 404, { error: 'node_not_found' });
      if (!node.apps.some(a => a.id === b.appId)) return json(res, 404, { error: 'app_not_found' });
      if (!b.offer?.type || !b.offer?.sdp) return json(res, 400, { error: 'bad_offer' });
      const id = crypto.randomBytes(18).toString('base64url');
      sessions.set(id, { id, nodeId: node.id, appId: String(b.appId), offer: b.offer, answer: null, createdAt: Date.now(), delivered: false });
      return json(res, 201, { id });
    }

    const offerMatch = p.match(/^\/api\/nodes\/([^/]+)\/offers$/);
    if (req.method === 'GET' && offerMatch) {
      clean();
      const nodeId = decodeURIComponent(offerMatch[1]);
      const node = nodes.get(nodeId);
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
      if (!node || token !== node.nodeToken) return json(res, 403, { error: 'unauthorized_node' });
      const offers = [...sessions.values()].filter(s => s.nodeId === nodeId && !s.delivered && !s.answer).slice(0, 16);
      for (const s of offers) s.delivered = true;
      return json(res, 200, { offers: offers.map(s => ({ id: s.id, appId: s.appId, offer: s.offer })) });
    }

    const answerPost = p.match(/^\/api\/sessions\/([^/]+)\/answer$/);
    if (req.method === 'POST' && answerPost) {
      const id = decodeURIComponent(answerPost[1]);
      const s = sessions.get(id);
      if (!s) return json(res, 404, { error: 'session_not_found' });
      const node = nodes.get(s.nodeId);
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
      if (!node || token !== node.nodeToken) return json(res, 403, { error: 'unauthorized_node' });
      const b = await readJson(req);
      if (!b.answer?.type || !b.answer?.sdp) return json(res, 400, { error: 'bad_answer' });
      s.answer = b.answer;
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && answerPost) {
      clean();
      const s = sessions.get(decodeURIComponent(answerPost[1]));
      if (!s) return json(res, 404, { error: 'session_not_found' });
      if (!s.answer) return json(res, 202, { ready: false });
      return json(res, 200, { ready: true, answer: s.answer });
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && await serveStatic(req, res, p)) return;
    return json(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: 'internal_error' });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`BP1P directory/client listening on :${port}`));
