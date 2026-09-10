# Validation report — BP1P Production 1.0.0

Validated in the build environment:

- Directory server JavaScript syntax: PASS
- Node server JavaScript syntax: PASS
- Single-file client inline JavaScript syntax: PASS
- Local package consistency check: PASS
- Local/public/node-only Compose YAML parsing: PASS
- Directory startup and health API on configurable ports: PASS
- Node startup and health API on configurable ports: PASS
- Node Ed25519 signed registration: PASS
- Local development auto-approval: PASS
- Signed directory manifest includes approved node: PASS
- Node Console API application creation: PASS
- App change re-registration into directory manifest: PASS
- HTTP proxy request against a local integration upstream: PASS
- Root-relative HTML link rewrite into `/p/<app>/...`: PASS

Docker itself is not installed in this artifact build environment, so the exact Docker Compose build cannot be executed here. The Dockerfiles and Compose files were syntax/structure checked, and the same server programs were run directly for the integration checks above.
