# BP1P Production 1.0.0

BP1P is a configured web-proxy network with a single-file client, cryptographically approved backend nodes, and simple Docker-based node operation.

## The simple path (Windows)

1. Install Docker Desktop and make sure it is running.
2. Extract this ZIP.
3. Double-click **SETUP-BP1P.cmd**.
4. The setup builds the stack, pairs `BP1P.html` to the generated directory signing key, opens the client, and opens the Node Console.
5. In the Node Console, enter `bp1p-local-node-admin`, add an HTTPS website, and save it.
6. Re-open/refresh `BP1P.html`. The site appears as a proxy application.

The exact Docker command used by the local stack is:

```powershell
docker compose up -d --build --force-recreate
```

Manual equivalent:

```powershell
cd "C:\path\to\BP1P-Production-1.0.0"
docker compose up -d --build --force-recreate
```

Local interfaces:

- Single-file client: `BP1P.html`
- Directory API: `http://localhost:8080`
- Proxy node: `http://localhost:8081`
- Node Console: `http://localhost:8787`
- Directory Console: `http://localhost:8790`
- Default local node token: `bp1p-local-node-admin`
- Default local directory token: `bp1p-local-directory-admin`

## What changed from BP1P 0.3

The production transport no longer depends on direct browser-to-node WebRTC/ICE. Nodes are ordinary HTTP(S) reverse-proxy services. This removes the biggest NAT/firewall deployment failure mode and makes a node deployable anywhere Docker can expose HTTPS.

`BP1P.html` is the entire end-user client. It contains no private keys or backend credentials. The file is paired to one directory signing public key. The directory publishes a short-lived signed manifest containing approved nodes and their configured applications. The browser verifies that signature before displaying or using the network.

## Trust model

Every node generates an Ed25519 identity on first boot and persists the private key in its Docker volume. Node registration is signed. The directory binds a node ID to that public key.

The directory has its own persistent Ed25519 signing key. `BP1P.html` pins the directory public key and verifies every manifest.

This means DNS or hosting location is discovery, not identity. Redirecting a hostname to a different service does not produce a valid directory signature.

For the bundled localhost profile, a newly created node is automatically approved so setup is click-and-go. For a public directory, new nodes are pending until an administrator approves them.

## Adding proxy applications

Open `http://localhost:8787`, enter the node token, then provide:

- Display name
- Application ID
- HTTPS target URL
- Optional description

The browser cannot supply an arbitrary upstream URL. Only targets explicitly configured by the node operator are proxied. This prevents a BP1P node from becoming an unrestricted anonymous open proxy.

Private/reserved upstream IP ranges are blocked by default. They can be enabled only with `BP1P_ALLOW_PRIVATE_UPSTREAMS=true` for intentional internal-lab use.

## Anyone can run a node

Copy `.env.node.example` to `.env`, set the directory URL, the node's public HTTPS URL, name, and a strong node admin token. Then run:

```bash
docker compose -f docker-compose.node.yml up -d --build --force-recreate
```

The node generates its identity automatically and registers with the directory. A public directory records it as pending. The directory operator opens the Directory Console and approves it.

## Public all-in-one deployment

For a conventional VPS with two DNS records pointing to the server, copy `.env.public.example` to `.env`, set two hostnames and strong tokens, then run:

```bash
docker compose -f docker-compose.public.yml up -d --build --force-recreate
```

Caddy obtains HTTPS certificates automatically when DNS and inbound ports 80/443 are correct.

After the public directory is online, on your Windows build machine run **PAIR-CLIENT.cmd** and enter the public directory URL. It generates the top-level `BP1P.html` with that directory URL and its current Ed25519 public key pinned into the file.

The public Node Console and Directory Console are intentionally bound to localhost. On a remote Linux server, use an SSH tunnel when you need them instead of exposing administration directly to the Internet.

## Updating

Double-click `UPDATE-BP1P.cmd` on Windows. It rebuilds and recreates the running containers using the current package files.

Exact command:

```powershell
docker compose up -d --build --force-recreate
```

For a node-only deployment:

```bash
docker compose -f docker-compose.node.yml up -d --build --force-recreate
```

## Security properties

- Directory manifests are Ed25519 signed.
- Clients pin the directory public key.
- Node registrations are Ed25519 signed.
- Node IDs are derived from their public keys.
- Node identity and directory signing keys persist in Docker volumes.
- Admin services bind to localhost in supplied Compose profiles.
- No secrets are embedded in `BP1P.html`.
- Proxy destinations are operator configured, not visitor supplied.
- Private/reserved upstreams are denied by default.
- Upstream redirects are handled manually instead of blindly following arbitrary redirect destinations.
- Common framing/CSP headers that would prevent proxy rendering are normalized at the proxy boundary.

## Compatibility

A generic HTTP rewriting proxy cannot perfectly reproduce every website. Complex applications may rely on WebSockets, WebTransport, upstream Service Workers, OAuth origin checks, anti-bot systems, signed absolute URLs, cross-origin APIs, browser-bound cookies, streaming protocols, or application-specific CSP assumptions.

BP1P 1.0 focuses on conventional HTTP/HTTPS sites. A site being reachable does not guarantee every feature of that site works through a rewritten proxy path.

## Important availability note

BP1P is designed for authentication, fail-safe trust, easy redeployment, and ordinary high availability. It is not an "unblockable" transport. A network operator that controls a network can block a public service or provider. BP1P does not automatically rotate domains or infrastructure to evade those controls.
