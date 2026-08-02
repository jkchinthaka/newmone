# Port Ownership and Reverse-Proxy Decision

**Status:** PORT_OWNER_DECISION_REQUIRED

Until an operator formally selects OPTION A or OPTION B, production readiness remains **blocked**.

## OPTION A — Recommended long-term (Linux / Docker Engine)

- Nginx owns 80/443
- API/Web internal only
- Mongo/MinIO operator ports loopback only
- Redis internal only

## OPTION B — Windows Server with IIS edge

- IIS owns 80/443
- Nginx binds loopback alternate port or is removed from edge ownership
- Forwarded headers + WebSocket support required
- Certificate in Windows certificate store
- Docker services remain internal/loopback

## Validator rules

- Fixture `EDGE_PROXY_OWNER=UNDECIDED` until decision.
- Reject simultaneous IIS+Nginx public ownership claims.
- Do not auto-select.