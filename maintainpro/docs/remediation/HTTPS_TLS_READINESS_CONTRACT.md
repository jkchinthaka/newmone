# HTTPS / TLS Readiness Contract

| Item | Status |
| --- | --- |
| Approved domain | OPERATOR_ACTION_REQUIRED |
| Certificate owner / issuer | OPERATOR_ACTION_REQUIRED |
| SAN match / renewal | OPERATOR_ACTION_REQUIRED |
| TLS termination | Edge proxy (Nginx OPTION A or IIS OPTION B) |
| HTTP→HTTPS redirect | OPERATOR_ACTION_REQUIRED |
| HSTS | HTTPS only — OPERATOR |
| Secure cookies | Fixture: COOKIE_SECURE=true with https origins |
| Forwarded proto | Nginx `X-Forwarded-Proto` |
| BFF same-origin | Required |
| WebSocket upgrade | Supported on `/socket.io/` |
| Body-size limits | nginx `client_max_body_size 25m` |
| TLS version / ciphers | OPERATOR-owned at terminator |
| Certificate backup/rotation | OPERATOR_ACTION_REQUIRED |

Do **not** generate or install real certificates in this phase.