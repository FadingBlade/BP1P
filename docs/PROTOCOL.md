# BP1P/1 Wire Protocol

BP1P/1 is an application relay protocol carried over a reliable, ordered WebRTC DataChannel named `bp1p`.

The signaling directory is transport coordination only. Application request/response bytes are exchanged directly between client and node over WebRTC.

## Request

`{"t":"req","id":"UUID","app":"demo","method":"GET","path":"/index.html","headers":{},"body":"BASE64"}`

The `app` field MUST identify an application explicitly configured by the node operator. The client cannot supply an upstream origin or arbitrary destination URL.

## Response

1. `res_start` with status and headers.
2. Zero or more `res_chunk` frames containing base64 data.
3. `res_end`.

Errors use `{"t":"error","id":"UUID","message":"..."}`.

## Safety boundary

BP1P/1 is a configured application/reverse-relay protocol. Nodes MUST resolve requests only against configured static roots or configured route targets. An implementation MUST NOT treat a client-provided URL as an unrestricted upstream destination.
