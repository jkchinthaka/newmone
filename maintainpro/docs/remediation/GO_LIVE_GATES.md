# Go-Live Gates

**Current documented verdict (prior pack):** **NO-GO**  
**This analysis:** Reinforces NO-GO until P0 gates below pass with evidence.

## Gate 0 — Safety baseline (entry to any prod change)

| ID | Gate | Pass criteria |
| --- | --- | --- |
| G0.1 | Credential incident | MongoDB root rotated; old credential invalidated; incident record filed (**operator task** — no secrets in Git) |
| G0.2 | No secret in images | `.dockerignore` excludes env/keys; images rebuilt; spot-check no `.env` in layers |
| G0.3 | Env strategy | Production does not boot on CI placeholder JWT/DB URLs |
| G0.4 | Port exposure | Public TCP 80 only (HTTP phase); 27018/6379/9000/9001/3000/3001 not internet-reachable |

## Gate 1 — Authentication on declared access mode

| ID | Gate | Pass criteria |
| --- | --- | --- |
| G1.1 | Routing | `/api/backend/*` → Next; `/api/*` (non-backend) → Nest; proven with request traces |
| G1.2 | BFF upstream | `API_INTERNAL_URL=http://api:3000/api` (or equivalent) works inside Docker |
| G1.3 | Cookies | Login creates HttpOnly access+refresh; CSRF present; **no** JWT in localStorage |
| G1.4 | HTTP mode | If public HTTP required: explicit `ALLOW_INSECURE_HTTP=true` + `COOKIE_SECURE=false`; Secure absent; business risk accepted in writing |
| G1.5 | HTTPS default | Without HTTP opt-in, Secure cookies remain required |

## Gate 2 — Traceability and rollback

| ID | Gate | Pass criteria |
| --- | --- | --- |
| G2.1 | SHA | `/api/build-info` or health metadata shows real Git SHA ≠ `unknown`/`ci-placeholder` |
| G2.2 | Source | Running config diff vs tagged release documented |
| G2.3 | Rollback | Prior image/tag redeploy tested once on staging or pilot |

## Gate 3 — Quality

| ID | Gate | Pass criteria |
| --- | --- | --- |
| G3.1 | CI | PR validation green on release SHA |
| G3.2 | Auth e2e | Cookie/BFF tests green; localStorage token assertions removed |
| G3.3 | Real-stack smoke | Disposable stack: login → one WO → one stock movement |
| G3.4 | Tenant/RBAC | Isolation + rbac audits PASS |

## Gate 4 — Business controls (pilot)

| ID | Gate | Pass criteria |
| --- | --- | --- |
| G4.1 | Negative stock | Cannot issue below zero |
| G4.2 | Approvals | PO dual approval path demonstrated |
| G4.3 | Audit | Sensitive actions leave audit rows |
| G4.4 | ERP | Sync failure visible; no silent data loss |

## Gate 5 — Operability

| ID | Gate | Pass criteria |
| --- | --- | --- |
| G5.1 | Backup | Timestamped Mongo backup off-server; restore drill counts match |
| G5.2 | Reboot | After Windows reboot, stack healthy without manual rediscovery |
| G5.3 | Disk/logs | Log rotation + disk alert defined |
| G5.4 | On-call | Incident owner named for auth/DB/outage |

## Go / No-Go decision rule

- **GO (controlled pilot):** All G0 + G1 + G2 + G3.1–G3.4 + G4.1 + G5.1–G5.2 pass with attached evidence; HTTP residual risk accepted if applicable.
- **NO-GO:** Any P0 open (R-01…R-07, R-19 unaccepted), or login session cannot be established in the real access mode, or backups unrestorable.

## Pilot definition of done

- Limited tenant(s) and named pilot users.
- Daily health check + error review for pilot window (recommend ≥ 5 business days).
- No expansion to full user base until Gate 4–5 complete.
---

## Phase 1 gate progress (2026-07-31)

| Gate | Status |
| --- | --- |
| G0.1 Credential incident / rotation | **BLOCKED** — runbook ready; operator evidence pending |
| G0.2 No secret in images | Repo controls VALIDATED; server rebuild still required |
| G0.3 Env strategy | VALIDATED in source (prod compose separation) |
| G0.4 Port exposure | VALIDATED in source compose; host firewall still operator |
---

## Phase 2 gate progress (2026-07-21)

| Gate | Status |
| --- | --- |
| G1.1 Routing | SOURCE_DONE (static nginx validation); live traces OPERATOR |
| G1.2 BFF upstream | SOURCE_DONE (compose requires API_INTERNAL_URL); runtime OPERATOR |
| G1.3 Cookies | SOURCE_DONE (BFF HttpOnly + CSRF); live browser evidence OPERATOR |
| G1.4 HTTP mode | SOURCE_DONE (fail-closed dual opt-in); business risk acceptance still required |
| G1.5 HTTPS default | SOURCE_DONE (Secure remains default) |
| G3.2 Auth e2e | SOURCE_UPDATED (cookie architecture); full Playwright run not claimed here |
| Live HTTP login validated | **NO** � smoke table empty |
| G0.1 Mongo rotation | Still BLOCKED / OPERATOR |

---

## Phase 2 closeout gate note

| Gate | Status |
| --- | --- |
| G1.3 Cookies | SOURCE_VALIDATED (BFF-only browser cookies; Nest Option A) |
| G1.1–G1.5 | SOURCE_VALIDATED; live traces OPERATOR_RUNTIME_VALIDATION_REQUIRED |
| Live HTTP login | Not marked complete |
