# BP1P — Blade Protocol 1 Proxy

BP1P is a plug-and-play WebRTC application relay derived from the BP1 browser-runtime model. A browser Service Worker turns virtual application requests into BP1P request frames. A remote BP1P node serves configured files or explicitly configured reverse routes and returns the response over an encrypted WebRTC DataChannel.

This release intentionally does **not** implement an unrestricted arbitrary-URL/open proxy. Node operators publish named applications and optional fixed upstream routes.

## Components

- `client/` — browser client + Service Worker bridge
- `directory/` — public node directory and HTTP signaling coordinator
- `node/` — Go/Pion WebRTC content node
- `example-site/` — test application
- `docs/PROTOCOL.md` — BP1P/1 wire format

## Local test

Requirements: Docker + Docker Compose, and a browser with WebRTC/Service Worker support.

```bash
docker compose up --build
```

Open `http://localhost:8080`, select the demo node/app, and press **Connect**.

For local Docker testing, leaving `publicIp` empty is normally correct. For a VPS/container behind 1:1 NAT, set `publicIp` in `node/config.json` to the server's public IPv4 address and allow inbound UDP 8443.

## Add an app

Add an entry to `node/config.json`:

```json
{
  "id": "docs",
  "name": "My Docs",
  "root": "/srv/bp1p/docs",
  "routes": []
}
```

Mount that directory into the node container. It then appears automatically in the public directory while the node is online.

## Fixed backend routes

A configured app may relay a path prefix to a fixed backend controlled by the node operator:

```json
"routes": [
  { "prefix": "/api/", "target": "http://my-api:3000/" }
]
```

The browser can request `/api/users`, but it cannot select or override the backend destination.

## Public deployment

1. Put the directory/client behind HTTPS (Cloudflare, Caddy, nginx, etc.). HTTPS is required for Service Workers outside localhost.
2. Set each node's `directoryUrl` to that directory URL.
3. Open/forward the configured UDP port (default 8443) on every node.
4. If the node is behind 1:1 NAT, set `publicIp`.
5. Start the node. Registration and heartbeats are automatic.

The directory expires nodes that stop checking in. Each node has a private node token used to authenticate its signaling poll/answer operations.

## Current limitations

- BP1P 0.1 uses non-trickle ICE and HTTP polling for signaling to keep deployment dependency-free.
- Response chunks are base64-framed JSON. This is correct and simple, but less efficient than binary multiplexed frames.
- No TURN server is bundled. Symmetric NAT/firewall cases can therefore fail; a public VPS node with UDP 8443 exposed is the easiest deployment.
- The directory's state is in memory in this first build.
- Range headers are forwarded to configured upstreams, but the static-file handler does not yet implement partial-file Range responses.
- WebSocket upgrade tunneling is not implemented in this first build.

## Naming

Protocol: `BP1P/1`
Project: **Blade Protocol 1 Proxy (BP1P)**
