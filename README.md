# BP1P 1.0

BP1P is a proxy-oriented client + trusted-node stack.

## What the user gets

`Client/BP1P.html` is the complete portable client. It is designed to be opened directly from disk (`file://`). It contains the UI, directory discovery, Ed25519 manifest verification, application selection, settings, reset controls, and the browser frame used to display proxied applications.

The HTML file does **not** redirect to a hosted client and does **not** require a local web server.

## What the host runs

The host runs:

- Directory API — signed trusted-node/app manifest
- Proxy Node — configured upstream applications
- Node Console — local application management
- Directory Console — local trust/approval management

Normal local command:

```powershell
docker compose -f .\Host\local.compose.yml up -d --build --force-recreate
```

Default local endpoints:

- `http://localhost:8080` — Directory API
- `http://localhost:8081` — Proxy node
- `http://localhost:8787` — Node Console
- `http://localhost:8790` — Directory Console

Both default admin tokens are `1`.

## Browser model

The top-level client remains `file://.../BP1P.html`. It fetches the public signed directory manifest through CORS. When an application is opened, BP1P creates a random session ID and loads only an HTTP(S) node URL into its iframe:

`https://node.example/s/<session>/p/<app>/`

The frame is never pointed back at the local HTML file. The node strips proxy-conflicting frame headers and rewrites same-origin application paths so navigation remains on the proxy node.

The session ID lives in the proxy path rather than relying on third-party iframe cookies. This improves session behavior for a file-based parent page.

## Trust

Anyone can operate a node, but only directory-approved nodes appear in the signed manifest. The client verifies the manifest using its paired Ed25519 directory public key.

For a public deployment, use `Tools/PAIR-CLIENT.cmd` to bake the public Directory URL and key into the distributable `BP1P.html`.
