# ADR-030 — Safe quality AI assistance foundation

**Status:** Accepted (optional advisory foundation)  
**Date:** 2026-08-10  
**Phase:** 18

## Context

Operators and QA may benefit from optional AI help for summaries, search, and narration. Quality dispositions and controlled-document changes must remain human-authorized. The product must work fully with AI off.

## Decision

1. Introduce `apps.ai_assistance` behind `AI_ASSISTANCE_ENABLED` (default **False**) and `use_aiassistance` RBAC.
2. Allow only catalogue use cases: batch history summary, NCR/CAPA summary, report-metric explanation, search assist, trend narration.
3. Prohibit autonomous RELEASE/HOLD/REJECT, checklist publish, specification/role changes, ERP disposition, CAPA close, and declaring root cause as fact.
4. Authorize and org-scope retrieval **before** any provider context is built; cross-org denied.
5. Minimize/redact context; audit high-level usage without storing full prompts/completions by default.
6. Abstract providers (`null` / `mock`; future vendors via interface only).
7. Prompt-injection heuristics, timeouts, and safe fallbacks; advisory anomaly hints never accuse users.

## Consequences

- No production LLM vendor is required for Phase 18.
- Enabling AI in an environment still needs IT/QA acknowledgement and secret management via env/vault.
