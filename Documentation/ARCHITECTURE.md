# BP1P 1.0 Architecture

```text
file:///.../BP1P.html
        |
        | CORS: signed manifest/public key
        v
BP1P Directory
        |
        | approved node list
        v
BP1P.html application selector
        |
        | iframe src = HTTP(S) node session path
        v
/s/<session>/p/<app>/...
        |
        v
Configured upstream application
```

The client is a real single-file application. No hosted client shell is required.

## Session paths

Embedded applications use `/s/<session>/p/<app>/...`. The node rewrites links, redirects, and base paths back into that session namespace. This avoids depending on third-party cookies for BP1P's own upstream cookie jar.

Direct node browsing through `/p/<app>/...` remains supported.
