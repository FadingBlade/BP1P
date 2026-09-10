# Troubleshooting

## `file:` unique security origin / unsafe frame

Use the current `Client\BP1P.html`. It no longer embeds a proxied site in an iframe. It performs a top-level navigation to the BP1P Directory client, so the proxied page runs under HTTP(S).

## `ERR_CONTENT_DECODING_FAILED`

The current node requests `Accept-Encoding: identity` upstream and removes `Content-Encoding`, `Transfer-Encoding`, and recalculated content-length headers when necessary.

## Client opens but no apps appear

Check:

```text
http://localhost:8080/api/manifest
http://localhost:8787
http://localhost:8790
```

Default local admin token for both consoles: `1`.

## Docker logs

```powershell
docker compose -f .\Host\local.compose.yml logs -f
```
