# Risk Register

**Document status:** Canonical living risk register (provisional ratings until owner review)
**Created / refreshed:** 2026-08-09
**Companion:** [docs/risks/PROJECT_RISK_REGISTER.md](../risks/PROJECT_RISK_REGISTER.md) (Phase 00 origins — retain; prefer this file for current tracking)
**Scoring:** Probability and Impact 1–5; Exposure = P × I. All ratings **provisional**.

| Status | Meaning |
| --- | --- |
| Open | Active |
| Monitoring | Controls exist; watch triggers |
| Mitigated | Residual accepted with controls |
| Closed | No longer applicable |

---

## Risks

| ID | Risk | Category | Probability | Impact | Exposure | Owner | Mitigation | Trigger | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RSK-G-001 | MongoDB architecture uncertainty (company request vs ADR-002 PostgreSQL) | Architecture | 4 | 5 | 20 | IT Manager (OWNER TO BE CONFIRMED) | ADR-018 POC REQUIRED; matrix + POC plan + migration strategy; forbid blind URI swap; keep PG on `main` until POC + APR-020 | Pressure to cut over without POC / `select_for_update` redesign | Open |
| RSK-G-002 | Business approval delays block production config and UAT | Delivery / Governance | 5 | 4 | 20 | Management Sponsor / Project Manager (TBC) | Maintain APPROVAL_REGISTER; separate IMPLEMENTED from BUSINESS APPROVED; escalate blockers weekly | Gates remain OPEN past planned pilot window | Open |
| RSK-G-003 | Bileeta API dependency / unavailability | Integration | 4 | 4 | 16 | IT Manager / Bileeta Vendor (TBC) | Keep recording independent of ERP; contract-only until sandbox exists; no invented endpoints | Connector work starts without API evidence | Open |
| RSK-G-004 | Bus factor / single-developer dependency | Continuity | 4 | 5 | 20 | Management Sponsor (TBC) | Continuity plan; modular docs; governance baseline; second-person access plan | Developer unavailable mid-delivery | Open |
| RSK-G-005 | Real master-data unavailable (org/shift/product/forms) | Data / Business | 5 | 5 | 25 | QA / Production / IT (TBC) | Unseeded foundations only; evidence intakes; never invent Nelna values | Pressure to hard-code sample catalogues | Open |
| RSK-G-006 | Checklist/spec approval lag (FG-QA-001 / limits) | Food safety / QA | 5 | 5 | 25 | QA Manager (TBC) | Draft marked NOT APPROVED; loader never publishes; readiness gates | Draft treated as production content | Open |
| RSK-G-007 | Docker / local environment reliability | Platform | 3 | 3 | 9 | Developer / Platform (TBC) | Document Docker requirements; host vs Compose test paths; re-validate after engine recovery | Daemon HTTP 500 / engine down blocks validation | Open |
| RSK-G-008 | Production Wi-Fi / device uncertainty | Operations | 3 | 4 | 12 | IT / Production (TBC) | Coverage survey (ASM-010); device policy (ASM-009); paper fallback draft | Pilot submit failures / device gaps | Open |
| RSK-G-009 | Offline requirement uncertainty | Product / Architecture | 3 | 4 | 12 | IT / Production / QA (TBC) | Keep Phase 14 gated; online MVP honesty; APR-022 | Late offline mandate without sync controls | Open |
| RSK-G-010 | Production support ownership unclear | Operations | 4 | 4 | 16 | IT Manager / System Administrator (TBC) | RACI + continuity plan; OWNER TO BE CONFIRMED until named | Go-live without support roster | Open |
| RSK-G-011 | Backup / DR ownership and untested restore | Operations / Security | 3 | 5 | 15 | IT Manager (TBC) | ASM-016; Phase 19 restore drill before production claims | Production claim without restore evidence | Open |
| RSK-G-012 | Regulatory / food-safety interpretation risk | Compliance / QA | 3 | 5 | 15 | QA Manager (TBC) | No unsupported compliance claims; human decisions only; evidence gates for CCP/limits | System marketed as certified without evidence | Open |
| RSK-G-013 | Incorrect business assumptions encoded as rules | Quality | 4 | 5 | 20 | QA / Business (TBC) | Constitution; assumption register; code review | Unverified limits/roles in code | Open |
| RSK-G-014 | Shared accounts undermine accountability | Security | 3 | 5 | 15 | IT / QA (TBC) | Named accounts; tests; audit | Shared login detected | Open |
| RSK-G-015 | Operator workflow slower than paper | UX / Adoption | 3 | 4 | 12 | Business / UX (TBC) | Operator-first UI; UAT time trials | Cycle time worse than paper | Open |
| RSK-G-016 | ERP outage wrongly coupled to recording | Integration | 2 | 5 | 10 | IT / Business (TBC) | Constitution: ERP not required for floor recording | Recording fails when ERP down | Open |
| RSK-G-017 | Missing audit evidence for important actions | Audit / Security | 3 | 5 | 15 | QA / IT (TBC) | Security event catalogue; mandatory events; tests | Audit gap found | Open |
| RSK-G-018 | Scope creep beyond approved MVP | Delivery | 4 | 3 | 12 | Project Owner (TBC) | CHANGE_CONTROL; roadmap phases | Unplanned features in commits | Open |
| RSK-G-019 | Security incident (account takeover / data leak) | Security | 2 | 5 | 10 | IT (TBC) | Security baseline; CSRF; lockout; reviews | Suspected incident | Open |
| RSK-G-020 | AI treated as final decision authority | Safety / AI | 3 | 5 | 15 | QA / IT (TBC) | AI safety policy; no final AI decisions | AI output used as approval | Open |
| RSK-G-021 | Sinhala typography/UAT blocked (DEBT-01C-R-NOTO) | UX / Localization | 4 | 4 | 16 | Design / Business (TBC) | Keep debt open until evidenced; no false Sinhala claims | Operator UAT starts without Noto evidence | Open |
| RSK-G-022 | Post-QA RELEASE/HOLD/REJECT labels misunderstood as ERP actions | Process / Safety | 4 | 5 | 20 | QA / Warehouse / Dispatch (TBC) | ADR-017; post-QA gate; training | Warehouse acts on label without SOP | Open |
| RSK-G-023 | Secret sprawl / vault ownership gap | Security | 3 | 5 | 15 | IT / System Administrator (TBC) | No secrets in git; APR-026; env strategy | Production secrets in chat/repo | Open |
| RSK-G-024 | Repository / IP ownership ambiguity | Legal / Continuity | 3 | 4 | 12 | Management Sponsor (TBC) | Written company clarification; continuity plan — no legal conclusion here | Handover without ownership clarity | Open |
| RSK-G-025 | Compliance mapping treated as certification or legal compliance | Compliance / QA / Legal | 3 | 5 | 15 | QMS / Food Safety / Governance (TBC) | ADR-057; no COMPLIANT status; APR-071; no seeded ISO/FSSC/HACCP/SLS applicability | Marketing or audit pack claims certified because mappings exist | Open |
| RSK-G-026 | Invented quality-risk scoring treated as company method | Quality Risk / Food Safety / QA | 4 | 5 | 20 | Quality Risk / QA / Governance (TBC) | ADR-058; scoring default OFF; no 1–5/RAG/acceptance matrix; APR-072 | Dashboard or audit pack presents hardcoded scores as Nelna policy | Open |
| RSK-G-027 | Invented PFMEA RPN or Action Priority treated as company method | Process Quality / FMEA / Risk / QA | 4 | 5 | 20 | Process Quality / QA / Governance (TBC) | ADR-059; scoring default OFF; RPN math-only after citation; no AP table; APR-073 | Worksheet or audit pack presents hardcoded RPN bands as Nelna policy | Open |
| RSK-G-028 | AI or software auto-confirms a root cause | Investigation / CAPA / Safety | 4 | 5 | 20 | QA Investigation / CAPA (TBC) | ADR-060; confirm_rca separate; AI = POSSIBLE_CAUSE only; APR-074 | CAPA or customer response cites unconfirmed AI hypothesis as root cause | Open |

---

## Owner review

Owner review of ratings and named owners: **Not completed**.

Update this register when risks change; cross-link mitigations to APPROVAL_REGISTER and Continuity plan where applicable.
