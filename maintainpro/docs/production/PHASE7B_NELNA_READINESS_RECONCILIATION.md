# Phase 7B — Nelna HTTP Deployment Authorization and Readiness Reconciliation

**Document type:** documentation / evidence / readiness only  
**Status:** `NELNA_PHASE8_AUTHORIZATION_PACK_PREPARED`  
**Recommendation:** **DELAYED**  
**Phase 8:** not started  
**Production mutation:** none (this pack does not authorize deploy)

## 1. Verified Phase 7A release candidate

| Field | Value |
| --- | --- |
| Branch | `fix/phase7a-release-candidate-stability` |
| **Deployable application SHA** | `5e3c470f3d7bc2fa15d84252db6492b7c4b65522` |
| Evidence / document tip SHA | `99c0be628b2ae254d0fc7e173d35283211730e88` |
| GitHub Actions run | `30740626683` |
| Phase 7A status | **RELEASE_CANDIDATE_TEST_STABILITY_VALIDATED** |
| Focused E2E-AUTH-012 | 20 passed (desktop 10 + mobile 10) |
| Focused retries | 0 |
| Focused failures | 0 |
| Full Playwright suite | 103 passed / 0 failed / 0 skipped / 0 flaky |
| Cleanup | `docker compose ... down --remove-orphans` |
| Volumes removed | **no** |

Do **not** deploy the evidence tip SHA. Deploy only the application SHA above when later authorized.

## 2. Port owner reconciliation

Previous Phase 8 blocker text treated port ownership as undecided. Verified Nelna architecture:

| Item | Verified value |
| --- | --- |
| Server | Existing Nelna Windows Server 2022 |
| Project path | `C:\Apps\newmone\maintainpro` |
| Compose project | `maintainpro` |
| Selected public edge | **Nginx** |
| Selected public port owner | **Nginx** |
| Public binding | `0.0.0.0:80` → `maintainpro-nginx-1:80` |
| MaintainPro Mongo | `127.0.0.1:27018` → container `mongo:27017` |
| Existing company Mongo | `127.0.0.1:27017` (includes `bileeta_db`) — **DO NOT TOUCH** |
| MinIO | `127.0.0.1:9000-9001` |
| Redis | Docker-internal only |
| API | Docker-internal `3000` only |
| Web | Docker-internal `3001` only |
| Airflow | Port `8080` — do not reuse or modify |

Recorded decisions:

```text
PORT_OWNER_DECISION=NGINX
PORT_OWNER_STATUS=CONFIRMED
PUBLIC_HTTP_PORT=80
```

IIS is **not** the MaintainPro edge for this scope unless a later separate authorized architecture change requests it.

## 3. HTTP-only company requirement

| Item | Value |
| --- | --- |
| Public URL | `http://135.171.163.249` |
| Transport | HTTP only |
| Required contract | `ALLOW_INSECURE_HTTP=true`, `COOKIE_SECURE=false` |
| TLS / HTTPS as Phase 8 mandatory prerequisite for this scope | **No** (company-approved HTTP-only scope) |
| Written approval status | **HTTP_ONLY_APPROVAL_PENDING** |

Template: `NELNA_HTTP_ONLY_DECISION_TEMPLATE.md`. Do not fabricate signatures.

## 4. Dependency security

| Item | Value |
| --- | --- |
| CI npm audit summary | 68 total (8 low / 35 moderate / 21 high / 4 critical) |
| Node engine warnings | Cloudflare tooling (`wrangler` / `miniflare` / `@cloudflare/kv-asset-handler`) want Node >=22; CI/app build uses Node 20 |
| Forced upgrades | **not** performed (`npm audit fix --force` forbidden here) |
| Status | **DEPENDENCY_SECURITY_REVIEW_REQUIRED** |

Register: `DEPENDENCY_RISK_REGISTER.md`.

## 5. Authorization pack contents

| File | Purpose |
| --- | --- |
| `PHASE8_AUTHORIZATION_CHECKLIST.md` | Real human/operator gates before Phase 8 |
| `FORMAL_UAT_SIGNOFF_TEMPLATE.md` | Formal business UAT evidence |
| `TRAINING_COMPLETION_TEMPLATE.md` | Training attendance / competency |
| `MANAGEMENT_SIGNOFF_TEMPLATE.md` | Distinct role sign-offs |
| `CUTOVER_APPROVAL_TEMPLATE.md` | Explicit GO_FOR_CUTOVER package |
| `NELNA_HTTP_ONLY_DECISION_TEMPLATE.md` | HTTP risk acceptance |
| `DEPENDENCY_RISK_REGISTER.md` | High/critical disposition |
| `SERVER_BASELINE_REFERENCE.md` | Nelna server-safe deploy constraints |

Private snapshot reference only (do not commit contents):

`C:\Apps\MaintainPro-Private\server-state-20260802-091642`

## 6. Current blocker summary (unchanged recommendation)

| Gate | Status |
| --- | --- |
| Phase 7A RC stability | VALIDATED (application SHA `5e3c470…`) |
| Port owner | **CONFIRMED = NGINX** |
| HTTP-only written approval | **HTTP_ONLY_APPROVAL_PENDING** |
| Formal UAT | **FORMAL_UAT_PENDING** |
| Formal training | **FORMAL_TRAINING_PENDING** |
| Management sign-offs | **MANAGEMENT_SIGNOFF_PENDING** |
| Mongo root rotation | **OPERATOR_OWNED_P0** |
| Off-host backup / restore drill | **OPERATOR_ACTION_REQUIRED** |
| Migration apply authorization | **OPERATOR_ACTION_REQUIRED** |
| Dependency high/critical disposition | **DEPENDENCY_SECURITY_REVIEW_REQUIRED** |
| Explicit GO_FOR_CUTOVER | **absent** |
| Recommendation | **DELAYED** |

This document prepares authorization evidence. It does **not** authorize deployment.