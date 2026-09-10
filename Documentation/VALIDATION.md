# BP1P 1.0 Validation

Release checks cover:

- Client inline JavaScript syntax
- Node Console JavaScript syntax
- Directory Console JavaScript syntax
- Node and Directory module syntax
- Signed node registration
- Signed directory manifest generation
- Session-path proxy routing
- gzip-compressed upstream decoding
- removal of stale `Content-Encoding` / `Transfer-Encoding`
- HTML base-path insertion
- root-relative link rewriting into the session path
- default tokens (`1`)
- persistent node/directory Docker volumes

The build environment's managed Chromium instance refuses local `file://` and localhost navigation, so the literal desktop double-click gesture cannot be automated there. The user's earlier browser log confirms that Chrome can issue CORS requests from the file client to localhost; the original failure was the wrong admin port and a frame navigation back to a `file://` URL. The rebuilt client never assigns a local-file URL to the website frame.
