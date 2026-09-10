# Security model

- The client pins the directory Ed25519 public key.
- Directory manifests are signed and short-lived.
- Nodes generate their own Ed25519 identity and sign registrations.
- Node IDs are derived from node public keys.
- Community nodes are not trusted until approved.
- Admin consoles bind to localhost in supplied profiles.
- No backend secrets are stored in `Client/BP1P.html`.
- Upstream destinations are configured by the node operator; visitors cannot choose arbitrary destinations.
- Private/reserved upstream addresses are blocked by default.

BP1P is designed for fail-safe trust and ordinary availability. It is not designed to evade network policy controls.
