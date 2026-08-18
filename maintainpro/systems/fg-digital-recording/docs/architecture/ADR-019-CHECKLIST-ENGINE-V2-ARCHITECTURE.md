# ADR-019 — Checklist Engine v2 Architecture (Phase 06G)

**Status:** Accepted (architecture design only — **no schema implementation in 06G**)  
**Date:** 2026-08-09  
**Phase:** 06G  
**Depends on:** ADR-010 (definition/versioning), ADR-013/014 (draft/submit), ADR-015/016/017 (Supervisor/correction/QA), ADR-002 (current PostgreSQL SoR)  
**MongoDB note:** Company-requested MongoDB/Atlas remains **POC REQUIRED** (APR-020; DB-01 assessment draft may exist as ADR-018 locally — **not** an accepted SoR cutover on `main`). Engine v2 must stay portable and must **not** assume Mongo cutover.  
**Related:** Phase 06F [form-discovery](../business/form-discovery/README.md), ASM-001/002/003, APR-001/006/027/028/036/037/038  

## Context

### Current engine (what already works on `main`)

| Area | Implementation | Status |
| --- | --- | --- |
| Template identity | `ChecklistTemplate` org-scoped; optional Product FK; CI-unique code | Works |
| Versioning | `ChecklistVersion` DRAFT → PUBLISHED → RETIRED; immutable published/retired | Works |
| Structure | `ChecklistSection` / `ChecklistItem` / `ChecklistItemOption` with positions | Works |
| Response primitives | `YES_NO`, `YES_NO_NA`, `NUMBER`, `TEXT`, `SELECT` | Works (definition + recording) |
| Numeric definition | Optional `unit`, `minimum_value`, `maximum_value` as `Decimal` | Works; values evidence-gated |
| Clone / publish | Service-centralized clone; publish integrity checks | Works |
| Tasks | `ChecklistTask` pins exact `ChecklistVersion` | Works |
| Draft recording | `ChecklistRecord` + typed `ChecklistResponse` (1:1 task; keyed by item + `sample_index`) | Works |
| Immutable submit | `ChecklistSubmission` + typed `ChecklistSubmissionResponse` snapshots (incl. `sample_index`) | Works |
| Correction | New submission N+1; source immutable; sample rows restored | Works |
| Supervisor | One review per exact submission; APPROVED/RETURNED immutable | Works |
| QA | One `QAReview` per eligible submission; RELEASE/HOLD/REJECT labels only | Works |
| Audit | Append-oriented events; answer text omitted from audit payloads | Works |
| Repeating / sample rows (06H) | `item_kind` SIMPLE/REPEATING_GROUP; optional `repeat_min/max/default`; child SIMPLE items | Works (technical foundation; no invented AQL) |
| Calculated fields (06I) | Closed operators SUM/AVERAGE/MIN/MAX/COUNT/RANGE; Decimal-safe; frozen `calculation_context` | Works (technical; no business formulas seeded) |
| Conditional rules (06J) | Closed VISIBLE_IF / REQUIRED_IF / EVIDENCE_REQUIRED_IF; frozen `condition_context` | Works (technical; no seeded predicates) |
| Item evaluation (06K) | Explicit `ChecklistItemEvaluationRule`; PASS/FAIL/WARN/NOT_EVALUATED; frozen `evaluation_*` | Works (technical; **not** QA disposition; no seeded limits) |
| Control-point metadata (06L) | `control_point_class` NONE/CCP/OPRP/PRP/GMP/QUALITY + optional criticality; frozen `control_point_context` | Works (technical schema; **EVIDENCE REQUIRED** for production non-NONE; metadata ≠ disposition) |
| Measurement semantics (06M) | `decimal_precision` / `rounding_mode` / unit catalog / inclusivity; frozen `measurement_context` | Works (technical; **no seeded product limits**; bounds ≠ disposition) |

**Not present today:** DATE/TIME response type, equipment references.

### Evidence

| Source | Class | Finding |
| --- | --- | --- |
| 06F form inventory | Company evidence path | **Empty** — all categories NOT RECEIVED |
| FG-QA-001 draft | Project proposal | Uses only current SIMPLE primitives; **NOT APPROVED** |
| ASM-001 / APR-006 | Limits | EVIDENCE REQUIRED — do not invent |
| ASM-002 / APR-027 | CCP/OPRP | EVIDENCE REQUIRED — do not invent |
| Claude/Gemini reports | INDUSTRY RESEARCH / PROPOSED DESIGN INPUT | May suggest grids, calculations, conditions, JSON Schema, expression languages — **not** company facts |

### Goal

Design **Checklist Engine v2** as an **extension** of the existing versioned checklist domain **before** schema-shaping implementation. Do **not** rewrite the engine. Do **not** create a parallel engine app.

## Decision

### 1. Extension strategy

1. Keep bounded context `apps/checklists` for definitions; `apps/recording` for answers/snapshots; `apps/reviews` / `apps/quality` unchanged in authority model.
2. Extend `ChecklistItem` (and related version-owned rows) additively.
3. Existing items remain valid as `item_kind=SIMPLE` (default).
4. No destructive historical backfill; no mutation of PUBLISHED/RETIRED versions.
5. Historical submissions continue to reference exact definition rows + typed snapshot values; future definition changes never reinterpret history.

### 2. Item structure (`item_kind`)

| Kind | Meaning | Has operator answer? |
| --- | --- | --- |
| `SIMPLE` | Leaf prompt with `response_type` (current model) | Yes |
| `REPEATING_GROUP` | Structural parent defining a repeatable sample/row set | No (container) |
| `CALCULATED` | Derived value from sibling/child operands via safe operator | System-computed (not free-typed by operator, except override policy if later approved) |

**Relationships (proposed):**

- Optional `parent_item` (nullable FK to `ChecklistItem`, same section/version graph).
- Top-level items: `parent_item IS NULL`.
- Children of a `REPEATING_GROUP` are definition templates for each sample row instance.
- Ordering: retain `position` within section for top-level; within a group, child `position` orders columns/fields.
- Runtime sample instances: recording stores **instance index** (`sample_index` starting at 1) on draft/snapshot response rows for children of repeating groups — **not** unbounded arrays embedded in the definition document.
- Repeat definition fields (design): `repeat_min`, `repeat_max`, optional `repeat_default` — all nullable pending evidence; never invent AQL/sample size as Nelna facts.

**Depth rule (v2 initial):** one level of repeating group (group → SIMPLE/CALCULATED children). Nested repeating groups deferred until evidenced.

### 3. Response types (additive)

Retain current five primitives for `SIMPLE` items.

**Candidates for later units (not auto-required by AI reports):**

| Type | Unit | Gate |
| --- | --- | --- |
| `DATE` / `DATETIME` | 06H+ or dedicated small unit | Evidence or strong UX need |
| Equipment reference | Prefer `instruments` module link, not free text as SoR | Module exists + evidence |
| Attachment/photo | Prefer `evidence` module | Module exists + evidence |

Do **not** add PHOTO/SIGNATURE as silent defaults in 06G.

### 4. Numeric design (Decimal-safe)

**Status:** Phase **06M implemented** (technical schema + Decimal-safe recording; no Nelna product limits seeded).

Storage remains `Decimal` (never binary float for measurements).

**Additive definition fields (values empty/pending evidence):**

| Field | Purpose |
| --- | --- |
| `unit` | Already exists |
| `decimal_precision` | Display/storage scale (nullable → **no forced quantize**; do not invent business default) |
| `rounding_mode` | Enum: `HALF_UP`, `HALF_EVEN`, `FLOOR`, `CEILING`, `DOWN` (blank = no rounding; applied only with precision) |
| `minimum_value` / `maximum_value` | Already exist |
| `min_inclusive` / `max_inclusive` | Boolean defaults `true` (inclusive bounds) |

Business Min/Max remain unset until APR-006 / product-spec evidence.

### 5. Calculation design (no `eval()`)

`CALCULATED` items declare:

- `calculation_operator`: closed enum — initial set: `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `RANGE` (`max−min`)
- `calculation_operands`: ordered references to other items (same version; typically children of the same group or named SIMPLE siblings)

**Rules:**

- Server computes on draft save / submit validation paths.
- Reject unknown operators; reject cycles; reject cross-version refs.
- No JavaScript/`eval`/expression strings as authority.
- Add operators only when evidenced or clearly required for generic architecture (initial six above).

### 6. Conditional rules (server-authoritative)

Version-owned rule rows (name illustrative): `ChecklistItemRule` with kinds:

| Kind | Effect |
| --- | --- |
| `VISIBLE_IF` | Item participates in UI/completeness only when predicate true |
| `REQUIRED_IF` | Requiredness when predicate true (overrides static `is_required` when active) |
| `EVIDENCE_REQUIRED_IF` | Requires linked evidence artifact when predicate true (depends on future `evidence` module) |

**Predicate model (v2):** closed, structured predicates — e.g. `operand_item`, `comparator` (`EQ`, `NE`, `IN`, `GT`, `GTE`, `LT`, `LTE`, `IS_ANSWERED`), `expected_*` typed values. **No free-form expression language** in v2.

Client UI may mirror for UX; **server re-evaluates on every save/submit**. Hidden-field bypass must fail server completeness.

### 7. Evaluation vs QA disposition

Optional item evaluation result (Phase **06K** implemented):

`PASS` | `FAIL` | `WARN` | `NOT_EVALUATED`

**Hard invariant:**

> Item evaluation result ≠ QA disposition (`RELEASE` / `HOLD` / `REJECT`).

- Measurement / checklist evaluation **IS NOT** QA RELEASE / HOLD / REJECT.
- FAIL must **not** auto-create HOLD/REJECT, CAPA, NCR, ERP, stock movements, or `QAReview`.
- Completeness submit may remain allowed for FAIL/WARN until an **approved deterministic policy** says otherwise (APR / future ADR).
- Supervisor/QA workflows stay human-authoritative per ADR-015/017.
- Rules are explicit definition rows (`ChecklistItemEvaluationRule`); missing rule ⇒ `NOT_EVALUATED`.
- Inclusivity and warning bands are never invented — they must be configured on the rule.
- Submission/correction snapshots freeze `evaluation_result` + `evaluation_context`; historical rows are not recomputed when future versions change rules.

### 8. Food-safety metadata (extensibility only)

**Implementation status (06L):** `ChecklistItem.control_point_class` and `criticality` exist with default `NONE` / blank. Submission snapshots freeze `control_point_context`. Schema only — **no Nelna CCP/OPRP values invented**; production non-NONE still **EVIDENCE REQUIRED** (ASM-002 / APR-027). AI-generated reports are **not** approval evidence.

Additive nullable/defaulted classification on items:

`NONE` | `CCP` | `OPRP` | `PRP` | `GMP` | `QUALITY`

Optional criticality: blank | `MINOR` | `MAJOR` | `CRITICAL`.

Default `NONE`. Populating non-NONE requires ASM-002 / APR-027 evidence. Metadata does **not** by itself HOLD/REJECT/RELEASE, create NCR, or block dispatch. Item evaluation PASS/FAIL ≠ QA disposition; control-point metadata ≠ disposition.

### 9. Immutability & historical interpretation

1. PUBLISHED/RETIRED versions remain structurally immutable (ADR-010).
2. Snapshots stay typed rows (ADR-014), extended additively for `sample_index`, calculated snapshot values, and frozen rule/evaluation context as needed.
3. Prefer **freezing definition FKs + snapshot of evaluated outputs** over rewriting history when rules change in a new version.
4. New rule semantics require a **new DRAFT version**, never in-place published edits.

### 10. MongoDB implications (portability — not cutover)

**Current SoR:** PostgreSQL (ADR-002).  
**Company target:** MongoDB/Atlas under ADR-018 (**POC REQUIRED**). DB-02/DB-03 not passed.

v2 design constraints for future Mongo portability:

| Topic | Guidance |
| --- | --- |
| Backend | Official Django MongoDB Backend only if/when POC passes — no Djongo/MongoEngine/Mongoose |
| Definitions | Keep normalized version-owned entities; avoid packing entire mutable template trees into one unbounded document as SoR |
| Repeating answers | Prefer separate response/snapshot documents/rows keyed by `(submission, item, sample_index)` — **do not** grow unbounded arrays inside a single submission document as the only truth |
| Snapshots | Hybrid OK later: reference definition version + embed **immutable response snapshot payload** sized with explicit limits; watch 16MB document ceiling |
| Concurrency | Do not rely on new `select_for_update` patterns for v2 features; prefer unique indexes + idempotency + atomic single-doc updates + explicit optimistic version fields where needed (Django/Python — **not** Mongoose `__v`) |
| Transactions | Multi-doc workflows must remain expressible with Mongo transactions (replica set) **or** redesigned single-doc atomicity proven in POC |

06G does **not** migrate the database.

### 11. Migration approach (when implementation units run)

1. Additive migrations only.
2. Default `item_kind=SIMPLE` for all existing rows.
3. Default control-point `NONE`; inclusive bounds `true`; empty calculation/condition tables.
4. No rewrite of historical `ChecklistSubmissionResponse` rows unless a non-destructive additive column is required (e.g. `sample_index=1` default for legacy one-row answers).
5. Publish/clone services extended to copy new child rows/rules.
6. Recording uniqueness evolves from `(record, item)` to `(record, item, sample_index)` where repeating applies — with careful constraint migration and tests.

### 12. UX / frontend

- Remain Django Templates + HTMX (+ Alpine only if needed).
- No new SPA framework for Engine v2.
- Progressive disclosure for repeating rows; server-rendered validation errors for hidden/required bypass attempts.

### 13. Security

| Risk | Control |
| --- | --- |
| Formula injection | Closed operator enum; no `eval` |
| Conditional-rule injection | Structured predicates only; admin/manage permission + org scope |
| Hidden-field bypass | Server re-eval on save/submit |
| Cross-item reference abuse | Same-version, same-org graph validation; deny cross-template refs |
| Cross-org access | Existing org-scoped RBAC; selectors deny leakage |
| XSS | Escape labels/help/options; never mark AI/research text safe |
| Audit | Do not log free-text answers/measurements unnecessarily |

### 14. Performance

| Risk | Mitigation |
| --- | --- |
| Large repeating groups | Cap `repeat_max` per definition (technical ceiling + evidence); paginate UI if needed |
| Snapshot size | Row-per-answer (+ sample_index); avoid monolithic JSON blobs as SoR |
| Query count | Prefetch section→items→options→rules; redesign if Mongo drops `prefetch_related` |
| Mongo document size | Enforce max samples × fields budget in publish validation |
| Indexes | `(organization, …)`, `(submission, item, sample_index)`, version/status queues unchanged in intent |

### 15. Rejected alternatives

| Alternative | Why rejected (for v2) |
| --- | --- |
| Parallel Checklist Engine v2 app | Splits domain; duplicates versioning/RBAC/audit |
| Full rewrite of current models | Unnecessary risk; SIMPLE path already production-shaped technically |
| JSON Schema as definition SoR | Over-fit to AI reports; weak relational integrity with current Django services |
| Free-form expression / `eval` language | Injection + nondeterminism risk |
| New frontend framework | Violates approved HTMX/PWA direction |
| Auto FAIL → HOLD/REJECT | Violates ADR-017 / food-safety human authority until policy evidence |
| Invented CCP/limits from AI | Violates constitution + ASM/APR gates |
| Mongoose-style `__v` as concurrency | Wrong stack; use explicit Django/Python fields if needed |

## Consequences

- Unblocks sequenced implementation units **06H–06M** without pretending company forms are approved.
- Checklist Engine v2 features remain **evidence-gated** for business values and for enabling form-specific structures.
- PostgreSQL remains SoR until Mongo POC + APR-020.
- FG-QA-001 draft stays proposal-only; 06F inventory remains the path to real forms.

## Implementation split (no feature code in 06G)

See [PHASE_06G_ENGINE_V2_IMPLEMENTATION_SPLIT.md](../business/PHASE_06G_ENGINE_V2_IMPLEMENTATION_SPLIT.md).

| Unit | Scope |
| --- | --- |
| **06H** | Repeating/sample foundation (`REPEATING_GROUP`, sample_index, uniqueness) |
| **06I** | Calculated fields (safe operators) |
| **06J** | Conditional logic (visible/required/evidence-required-if) |
| **06K** | Deterministic item evaluation (PASS/FAIL/WARN ≠ QA disposition) |
| **06L** | Control-point metadata (NONE/CCP/OPRP/PRP/GMP/QUALITY) |
| **06M** | Precision / units / inclusive bounds hardening — **IMPLEMENTED** |

## References

- [ADR-010-CHECKLIST-DEFINITION-VERSIONING.md](ADR-010-CHECKLIST-DEFINITION-VERSIONING.md)
- [ADR-014-CHECKLIST-SUBMISSION-SNAPSHOT.md](ADR-014-CHECKLIST-SUBMISSION-SNAPSHOT.md)
- [ADR-017-QA-FINAL-REVIEW-DISPOSITION.md](ADR-017-QA-FINAL-REVIEW-DISPOSITION.md)
- [ADR-002-POSTGRESQL-PRIMARY-DATABASE.md](ADR-002-POSTGRESQL-PRIMARY-DATABASE.md) (current SoR)
- APR-020 (MongoDB/Atlas company request — POC / approval pending)
- [form-discovery/RESPONSE_ENGINE_GAP_MAP.md](../business/form-discovery/RESPONSE_ENGINE_GAP_MAP.md)
- [form-discovery/FORM_EVIDENCE_REGISTER.md](../business/form-discovery/FORM_EVIDENCE_REGISTER.md)
- [PHASE_06G_ENGINE_V2_IMPLEMENTATION_SPLIT.md](../business/PHASE_06G_ENGINE_V2_IMPLEMENTATION_SPLIT.md)
