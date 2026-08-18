# Analytics Need Assessment — Phase 65

**Document status:** Evidence register (not a go-live approval)  
**Last updated:** 2026-08-10  
**ADR:** [ADR-021](ADR-021-QUALITY-ANALYTICS-DATA-PLATFORM.md)

## Verdict

| Outcome | Value |
| --- | --- |
| External warehouse justified? | **No** |
| Status line | **PHASE 65 DATA WAREHOUSE NOT YET JUSTIFIED** |
| Owner who can reverse | IT Manager / Management Sponsor via **APR-040** after NA-01–NA-05 |

## Measured / attempted measures

| Measure | Result | Notes |
| --- | --- | --- |
| Report workload | **Not measured in production** | No staging/UAT/production deployment recorded (`PROJECT_STATUS.md`) |
| Historical data size | **Not applicable at production scale** | Developer Compose / local datasets only |
| Query latency under BI load | **No baseline** | No heavy BI concurrent load tests recorded |
| Management BI requirements | **EVIDENCE REQUIRED** | No approved grain, SLA, or dashboard catalogue from owners |

## Platform correction

Extract/warehouse design **must not** assume MongoDB is the operational database. PostgreSQL is SoR. MongoDB cutover remains blocked (ADR-018 / DB-02).

## Reassessment triggers (examples — not automatic approval)

- Documented operator/DB incidents caused by analytical queries
- Retention growth approaching approved capacity with measured impact
- Signed BI requirements with refresh SLA and privacy review
- APR-040 written authorization for a named analytics store product

Silence is not approval. Reassessment still requires criteria NA-01–NA-05.
