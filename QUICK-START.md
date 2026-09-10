# BP1P 1.0 — Quick Start

## Normal user

A normal user only needs **`Client\BP1P.html`**.

1. Double-click `BP1P.html`.
2. Wait for the signed network manifest to verify.
3. Click an application.
4. The proxied website opens **inside BP1P.html**.

The client does **not** redirect to another client website and does **not** require a localhost client server.

## Local host / developer

Double-click `START-HERE.cmd`, or run:

```powershell
docker compose -f .\Host\local.compose.yml up -d --build --force-recreate
```

Defaults:

- Directory API: `http://localhost:8080`
- Proxy node: `http://localhost:8081`
- Node Console: `http://localhost:8787`
- Directory Console: `http://localhost:8790`
- Node token: `1`
- Directory token: `1`

`START-HERE.cmd` pairs the local `Client\BP1P.html` with the current local directory key automatically.

## Add a proxy application

Open `http://localhost:8787`, use token `1`, and add the HTTPS/HTTP origin you want the node operator to expose.

## Reset the client

Use **Revert defaults** in BP1P.html. This restores its baked-in directory URL/key and clears user-saved overrides.
