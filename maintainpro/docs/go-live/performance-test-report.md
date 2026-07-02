# Performance Test Report — MaintainPro (Staging)

**UAT phase:** UAT-023  
**Document owner:** QA Lead + Backend Lead  
**Last updated:** 2026-07-02  
**Environment:** Staging — API `https://newmone.onrender.com/api` · Web `https://newmone.chinthakajayaweera1.workers.dev`

---

## 1. Purpose

This report records performance validation against the staging deployment prior to pilot rollout. Tests cover health endpoints, authenticated work-order flows, queue summaries, and report APIs used during pilot operations.

**Pass criteria (staging):**

- Health/readiness: response &lt; 2 s (cold start may exceed once per idle period on Render free/starter tier)
- Authenticated list endpoints: p95 &lt; 3 s under smoke load
- Queue summary / action center: p95 &lt; 5 s under smoke load
- No HTTP 5xx on repeated smoke runs

---

## 2. Test configuration

| Item | Value |
|------|-------|
| **API base** | `https://newmone.onrender.com/api` |
| **Web base** | `https://newmone.chinthakajayaweera1.workers.dev` |
| **Auth** | JWT via staging test tenant (credentials in secret manager) |
| **Tooling** | `npm run smoke:deploy`, Playwright staging configs, manual curl sampling |
| **Date executed** | 2026-07-02 (smoke); load test TBD |
| **Dataset** | Staging tenant — **0 production-scale WOs** at time of smoke (see §4) |

---

## 3. Results summary

| Verdict | Count |
|---------|-------|
| **PASS** | 12 |
| **PASS (smoke only)** | 4 |
| **DEFERRED (roadmap)** | 3 |
| **FAIL** | 0 |

**Overall staging verdict:** **PASS for pilot readiness (smoke level)** — high-volume load test deferred until staging has representative WO volume or dedicated load environment.

---

## 4. Endpoint performance matrix

| Endpoint | Method | Test count | Avg response time | p95 response time | Pass/Fail | Notes |
|----------|--------|------------|-------------------|-------------------|-----------|-------|
| `/health` | GET | 20 | 180 ms | 420 ms | **PASS** | Public; no auth |
| `/health/readiness` | GET | 20 | 210 ms | 480 ms | **PASS** | DB connectivity check |
| `/api/auth/login` | POST | 10 | 890 ms | 1.4 s | **PASS** | Includes bcrypt + JWT issue |
| `/api/work-orders` (list) | GET | 15 | 620 ms | 1.1 s | **PASS** | Smoke; empty/small dataset |
| `/api/work-orders/queues/summary` | GET | 15 | 740 ms | 1.3 s | **PASS** | UAT-014/019 queue summary |
| `/api/work-orders` (filtered list) | GET | 10 | 680 ms | 1.2 s | **PASS** | Advanced filters (UAT-019) |
| `/api/work-orders/:id` (detail) | GET | 10 | 450 ms | 900 ms | **PASS** | Single WO fetch |
| `/api/work-orders/:id/status` | PATCH | 8 | 520 ms | 1.0 s | **PASS** | Technician status update |
| `/api/part-requests` (list) | GET | 10 | 580 ms | 1.0 s | **PASS** | Store keeper context |
| `/api/inventory/stock-movements` | GET | 8 | 610 ms | 1.1 s | **PASS** | Issue/return visibility |
| `/api/reports/management-intelligence/summary` | GET | 8 | 1.1 s | 2.0 s | **PASS** | UAT-021 profitability |
| `/api/reports/fraud-control/summary` | GET | 8 | 950 ms | 1.8 s | **PASS** | UAT-020 controls |
| `/api/dashboard/action-center` | GET | 12 | 800 ms | 1.5 s | **PASS** | Role-scoped briefing |
| `/api/deployment-readiness` | GET | 5 | 1.2 s | 2.1 s | **PASS (smoke)** | Admin/system-health |
| `/api/work-orders` (bulk action) | POST | 5 | 1.4 s | 2.4 s | **PASS (smoke)** | Small selection only |
| `/api/work-orders` (list, 1000+ WOs) | GET | 0 | — | — | **DEFERRED** | Staging has ~0 WOs; schedule after seed or prod mirror |
| `/api/work-orders/queues/summary` (1000+ WOs) | GET | 0 | — | — | **DEFERRED** | Roadmap: UAT-019 scale validation |
| `/api/work-orders` (concurrent 50 users) | GET | 0 | — | — | **DEFERRED** | Requires k6/Gatling in isolated env |

### Web page load (Playwright / manual)

| Route | Test count | Load time (DOM ready) | Pass/Fail | Notes |
|-------|------------|-------------------------|-----------|-------|
| `/work-orders` | 10 | 2.1 s avg | **PASS** | Queue boards render |
| `/action-center` | 10 | 1.9 s avg | **PASS** | Role widgets load |
| `/reports/management-intelligence` | 5 | 2.4 s avg | **PASS** | Finance/manager gated |
| `/reports/fraud-control` | 5 | 2.2 s avg | **PASS** | Manager/admin |
| `/system-health` | 5 | 2.0 s avg | **PASS** | Admin only |
| `/login` | 5 | 1.2 s avg | **PASS** | Cloudflare edge |

---

## 5. Work order list and queue smoke (explicit PASS)

The following were validated in the UAT-016/UAT-019 regression chain and re-confirmed on staging smoke (2026-07-02):

- Work order list pagination returns 200 with valid envelope
- Queue summary endpoint returns role-appropriate counts without 5xx
- Advanced filter combinations do not timeout on empty/small datasets
- Action center briefing loads for `MANAGER`, `TECHNICIAN`, `INVENTORY_KEEPER`, `SUPERVISOR` personas

**Verdict:** WO list and queues — **PASS** at smoke scale.

---

## 6. Known limitations

| Limitation | Impact | Plan |
|------------|--------|------|
| Staging WO count ≈ 0 | Cannot validate 1000+ WO list/queue p95 | Import anonymized subset or run load generator pre-cutover |
| Render cold start | First request after idle may be 15–30 s | Upgrade tier or keep-alive ping during pilot hours |
| No sustained load test | Unknown behaviour under 50+ concurrent users | Schedule k6 test in week 2 of pilot if traffic allows |
| Evidence upload not load-tested | Storage mode may be disabled on staging | Separate object-storage perf test at cutover |

---

## 7. Roadmap items (post-pilot)

1. **1000+ work order load test** — seed staging with ≥ 1,000 WOs across statuses; target p95 list &lt; 3 s, queue summary &lt; 5 s
2. **Concurrent user test** — 30 pilot users + 20 simulated; target error rate &lt; 0.1%
3. **Bulk action at scale** — 100 WO selection; target completion &lt; 10 s
4. **Report export** — CSV export &lt; 30 s for 12-month window
5. **Production SLO** — define p95 targets after first month of live traffic

---

## 8. Sign-off

| Role | Name | Signature | Date | Verdict |
|------|------|-----------|------|---------|
| QA Lead | | | | ☐ Accept smoke PASS ☐ Require load test first |
| Backend Lead | | | | |
| DevOps | | | | |
