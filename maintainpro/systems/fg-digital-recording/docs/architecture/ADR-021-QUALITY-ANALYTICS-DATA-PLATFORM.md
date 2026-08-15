# ADR-021 — Quality Analytics Data Platform (Warehouse / BI Foundation)

**Status:** Accepted (assessment outcome) — **external data warehouse NOT YET JUSTIFIED**  
**Date:** 2026-08-10  
**Phase:** 65 — Analytics / BI foundation  
**Supersedes:** Nothing. Complements ADR-002 (PostgreSQL SoR) and ADR-018 (MongoDB assessment).

## Context

Heavy analytical / BI workloads are sometimes separated from operational databases via ETL/ELT into a warehouse. The phase prompt referenced “operational MongoDB”; that premise is **incorrect for this repository**:

| Store | Role today (evidence) |
| --- | --- |
| **PostgreSQL** | Authoritative operational system of record (ADR-002 / DEC-003) |
| **MongoDB / Atlas** | Company-requested; ADR-018 assessment; DB-02 POC **CUTOVER BLOCKED** — **not** SoR |
| **Redis** | Cache / Celery broker only |

Standing up warehouse infrastructure “because it looks enterprise” is prohibited by project constitution and this ADR.

## Decision

1. **Do not deploy** an external analytics warehouse, lakehouse, or BI-specific database in this phase.
2. Record a **need assessment** with measurable criteria. Until criteria are evidenced and owner-approved (APR-040), status remains:

   > **PHASE 65 DATA WAREHOUSE NOT YET JUSTIFIED**

3. Provide a **technical foundation** inside the modular monolith:
   - Justification gate (deny warehouse deployment by default)
   - Field **lineage** catalogue (analytical field → operational source)
   - Proposed star-schema design (documentation only; no invented Nelna KPIs)
   - **Idempotent incremental extract** into optional **staging** tables in PostgreSQL (foundation only)
   - Data-quality finding records (missing source, duplicate load, late arrival, mapping error, reconciliation)
   - Privacy defaults: no employee display names / free-text notes in staging facts
4. When (and only when) justified, target path is:

   ```
   PostgreSQL (operational SoR)
        → ETL/ELT (idempotent, watermarked)
        → Analytics store / warehouse (product OWNER REQUIRED)
        → BI tool (generic; Power BI or other only if company-selected — OWNER REQUIRED)
   ```

   MongoDB is **not** the extract source unless a future accepted ADR makes it SoR.

## Need-assessment criteria (all required to justify warehouse)

| ID | Criterion | Current evidence |
| --- | --- | --- |
| NA-01 | Sustained report/query latency harming operators or DB | **MISSING** — no production metrics |
| NA-02 | Historical data volume exceeding operational PG capacity plan | **MISSING** — local/dev only; no production retention load |
| NA-03 | Documented management BI requirements (owners, grain, refresh SLA) | **EVIDENCE REQUIRED** |
| NA-04 | Written approval to operate a separate analytics store (APR-040) | **NOT REQUESTED** |
| NA-05 | Privacy review for analytical extracts | **EVIDENCE REQUIRED** |

Any missing criterion → warehouse deployment **blocked**.

## Non-goals

- No Snowflake / BigQuery / Redshift / Databricks / Synapse provisioning
- No machine-invented dashboards, scorecards, or temperature/CCP KPIs
- No copy of full User / auth tables into analytics
- No claim that staging tables are a production warehouse
- No MongoDB-as-SoR analytics path

## Consequences

- Operational reporting continues on PostgreSQL (and future `reports` module) until justified
- Foundation code and docs reduce future lead time when evidence arrives
- BI tool remains generic until company selection is recorded

## References

- [ANALYTICS_NEED_ASSESSMENT.md](ANALYTICS_NEED_ASSESSMENT.md)
- [ANALYTICS_LINEAGE_CATALOGUE.md](ANALYTICS_LINEAGE_CATALOGUE.md)
- [ANALYTICS_STAR_SCHEMA_PROPOSAL.md](ANALYTICS_STAR_SCHEMA_PROPOSAL.md)
- [PHASE_65_ANALYTICS_DATA_PLATFORM.md](../business/PHASE_65_ANALYTICS_DATA_PLATFORM.md)
- ADR-002, ADR-018, MODULE_MAP `analytics`
