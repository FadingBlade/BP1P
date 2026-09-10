# Hosting

## Local development
Use `Host/local.compose.yml`. This starts one directory and one node.

```powershell
docker compose -f .\Host\local.compose.yml up -d --build --force-recreate
```

## Public all-in-one host
Copy `Host/public.env.example` to `Host/.env` or provide the variables to Compose, then use `Host/public.compose.yml`. Caddy provides HTTPS for the directory and node hostnames.

```bash
docker compose --env-file Host/.env -f Host/public.compose.yml up -d --build --force-recreate
```

## Community node only
Use `Host/node-only.compose.yml` with the node-only environment values.

```bash
docker compose --env-file Host/.env -f Host/node-only.compose.yml up -d --build --force-recreate
```

A community node generates its Ed25519 identity automatically and registers as pending until the directory administrator approves it.
