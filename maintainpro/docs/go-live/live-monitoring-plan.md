# Live Monitoring Plan — MaintainPro

**UAT phase:** UAT-023  
**Document owner:** DevOps + Operations Manager  
**Last updated:** 2026-07-02  
**Applies to:** Pilot period and first **30 days** post-production cutover

**Environments:**

| Layer | Staging / pilot | Production |
|-------|-----------------|------------|
| Web | `https://newmone.chinthakajayaweera1.workers.dev` | **TBD** custom domain |
| API | `https://newmone.onrender.com/api` | **TBD** Render production URL |
| Health | `https://newmone.onrender.com/health` | Production health URL |

---

## 1. Objectives

- Detect outages and degradation before users flood support
- Verify backup and replication health
- Track pilot adoption and fraud-control signals
- Provide daily evidence for [management-sign-off.md](management-sign-off.md) and hypercare reviews

---

## 2. Daily monitoring checklist

Complete **every business day** during pilot and hypercare. Record results in the ops log (spreadsheet or ticket — not git).

### 2.1 Infrastructure (DevOps — by 09:00)

| ☐ | Check | How | Pass criteria |
|---|-------|-----|---------------|
| ☐ | API `/health` | HTTP GET | 200, `success: true` |
| ☐ | API `/health/readiness` | HTTP GET | 200, database connected |
| ☐ | Web login page | Browser | Loads &lt; 5 s |
| ☐ | Render service status | Render dashboard | Not suspended / failed deploy |
| ☐ | Cloudflare Workers status | CF dashboard | Active deployment, no spike in 5xx |
| ☐ | MongoDB Atlas alerts | Atlas console | No critical alerts overnight |
| ☐ | Atlas backup snapshot | Atlas backup tab | Latest snapshot &lt; 24 h |
| ☐ | `db:backup:verify` (prod post-cutover) | Operator script | No critical lag/errors |
| ☐ | Redis (if enabled) | Health / logs | Connected or graceful degrade |
| ☐ | Error rate in Render logs | Last 24 h | No sustained 5xx spike |

### 2.2 Application functional smoke (QA or Admin — by 10:00)

| ☐ | Check | Role used | Pass criteria |
|---|-------|-----------|---------------|
| ☐ | Login | Test user per role | JWT issued |
| ☐ | `/work-orders` list | MANAGER | 200, data envelope |
| ☐ | `/action-center` | TECHNICIAN | Widgets load |
| ☐ | Queue summary API | MANAGER | Counts return without timeout |
| ☐ | Create test WO (or use sandbox) | MANAGER | 201/200 |
| ☐ | Part request list | INVENTORY_KEEPER | Accessible |
| ☐ | `/system-health` | ADMIN | Deployment readiness visible |
| ☐ | `/reports/fraud-control` | MANAGER | Summary loads |

### 2.3 Business operations (Maintenance Manager — by 16:00)

| ☐ | Check | Source | Pass criteria |
|---|-------|--------|---------------|
| ☐ | Open P0/P1 support tickets | Support log | Zero P0; P1 on track |
| ☐ | WO created today vs expected volume | Action center / report | Within ±30% of plan |
| ☐ | Stuck WOs (awaiting verification &gt; 48 h) | Supervisor queue | Reviewed / assigned |
| ☐ | Pending part issues blocking jobs | Store queue | Trending down |
| ☐ | Fraud control: new overrides | `/reports/fraud-control` | Reviewed; no abuse pattern |
| ☐ | Off-system work reports | Manager spot-check | Zero unofficial actions |
| ☐ | Pilot feedback received this week | QA | ≥ 70% cohort response |

### 2.4 Security (Security / Admin — weekly minimum)

| ☐ | Check | Pass criteria |
|---|-------|---------------|
| ☐ | Failed login spike | No brute-force pattern |
| ☐ | New admin users created | Expected only |
| ☐ | Role changes | Change ticket exists |
| ☐ | RBAC audit TODO routes | No pilot exposure |

---

## 3. Automated monitoring (recommended)

| Signal | Tool | Alert threshold |
|--------|------|-----------------|
| API down | Uptime monitor (Render / external) | 2 consecutive failures |
| p95 latency | Render metrics or APM | &gt; 5 s for 15 min |
| 5xx rate | Render logs | &gt; 1% of requests |
| Atlas disk / connections | Atlas alerts | Per Atlas defaults |
| CF Workers errors | Cloudflare analytics | Spike vs 7-day baseline |

Configure alert recipients via secret manager distribution list.

---

## 4. Weekly monitoring (every Monday)

| Item | Owner |
|------|-------|
| Review [performance-test-report.md](performance-test-report.md) trends | QA |
| Replication lag summary (`db:backup:verify`) | DevOps |
| Support metrics per [pilot-support-process.md](pilot-support-process.md) | Ops Manager |
| Fraud & management intelligence report walkthrough | Manager + Finance |
| Update known issues in support KB | Admin |
| Pilot feedback aggregation | QA Lead |

---

## 5. Monthly monitoring (post-hypercare)

| Item | Owner |
|------|-------|
| Restore drill or `db:backup:resync --dry-run` | DBA |
| Permission matrix vs new features | Security |
| Review override trends | Compliance |
| Capacity review (Render tier, Atlas tier) | DevOps |

---

## 6. Dashboards and routes

| Purpose | Route / endpoint |
|---------|------------------|
| Operator health UI | `/system-health` |
| Deployment readiness API | `/api/deployment-readiness` |
| Management KPIs | `/reports/management-intelligence` |
| Control violations | `/reports/fraud-control` |
| Morning briefing | `/action-center` |

---

## 7. Incident triggers

Escalate per [pilot-support-process.md](pilot-support-process.md) when:

- Any daily infrastructure check fails twice consecutively
- Functional smoke fails for core WO list or login
- Atlas backup missing &gt; 24 h
- Fraud report shows &gt; 5 overrides by same user in 7 days without review

---

## 8. Reporting template (daily log)

```
Date: YYYY-MM-DD
Environment: Staging pilot / Production
Checked by: [Name]

Infrastructure: PASS / FAIL — [notes]
Functional smoke: PASS / FAIL — [notes]
Business ops: PASS / FAIL — [notes]
Open P0/P1: [count]
Actions taken: [list]
```

---

## 9. Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| DevOps Lead | | | |
| Operations Manager | | | |
| QA Lead | | | |
