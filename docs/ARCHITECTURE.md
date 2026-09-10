# BP1P/2 production architecture

Client (`BP1P.html`) -> signed Directory Manifest -> approved Proxy Node -> configured Upstream.

Control plane and data plane are deliberately separate. The directory decides which node identities are approved; nodes decide which applications they serve; the client trusts only manifests signed by its pinned directory key.

A node registration contains its public URL, application metadata, Ed25519 public key, and a signature made by the node private key. The directory never receives a node private key.
