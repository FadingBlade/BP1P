# BP1P 1.0 — Current Build

This remains product version **1.0.0** while the release is being stabilized.

## Current fixes

- `Client/BP1P.html` is again the complete client, not a redirector.
- Normal users can double-click the HTML file; they do not run Docker.
- Removed the hosted `/client/` dependency from the Directory.
- Proxied applications are displayed in an HTTP(S) node iframe inside the file client.
- Added path-based proxy sessions: `/s/<session>/p/<app>/...`.
- Session paths preserve the node-side upstream cookie jar without depending on third-party iframe cookies.
- Retains the gzip/Brotli decoding fix: upstream requests use `Accept-Encoding: identity` and stale compression/transfer headers are not forwarded.
- Retains safe admin-console event listeners; no broken nested inline `onclick` generation.
- Default Node and Directory admin tokens remain `1`.
- Added/retained **Revert defaults** in the client.
- Local setup automatically pairs `Client/BP1P.html` with the local Directory URL and Ed25519 public key.
- Public pairing tool correctly bakes the chosen Directory URL and key into the distributable single-file client.
