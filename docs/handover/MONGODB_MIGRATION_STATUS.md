# MongoDB Migration Status

## Executive status

```text
STARTING_BRANCH=feature/mongodb-same-maintainpro-db
STARTING_SHA=ea128ae
FINAL_SHA=bd4252f (+ uncommitted test skips for PG-only assertions)
MAIN_SHA=d5a4460
MAIN_MERGED=NO
REAL_COMPANY_MONGO_WRITTEN_TO=NO
```

```text
CONTINUATION REQUIRED — FINAL SERVER-HOSTING VERIFICATION CHECKPOINT CREATED
```

PostgreSQL remains authoritative on `main`. Isolated Mongo POC proves runtime for migrated paths.

---

## Production target (unchanged)

```text
Logical database: mgintginpro_prod
FG namespace: fg_
Isolated POC: fg_same_db_poc @ compose.mongo-poc.yaml (127.0.0.1:27027 / nelnaPocRs)
```

---

## Checkpoint progress (this pass)

| Item | Status |
| --- | --- |
| Working-tree safety | Restored **104** accidental emptied/EOL files; preserved unrelated WIP |
| Isolated POC migrate | **Green** — 232 `fg_*`; NON_FG=0 |
| Mongo POC SECRET_KEY / health tests | **Fixed** — committed `bd4252f` |
| Runtime `Lower()` annotate | **Rewritten** — `proposal_loader` uses `code__iexact` |
| Full Mongo pytest | **Partial** — **788 passed / 154 failed / 2 skipped** (944 collected; ~63 min) |
| Mongo coverage ≥80% | Not measured on green suite (prior incomplete run ~29%) |
| Unique / IntegrityError parity | Still failing on some case-insensitive / partial unique paths |
| `select_related` on list returns | Still failing in some recording calculated-field paths |
| PG-only test assertions under Mongo | Partial skips added (settings/persistence/namespace) — uncommitted |
| Decimal BSON / cross-org / spikes | Prior pass green (needs re-confirm after fixes) |
| FG dump/restore / Celery / health | Prior pass green (needs re-confirm after fixes) |
| Browser Mongo smoke | Not complete |
| Full PG regression + quality/security | Not complete |
| Final release package | Not rebuilt from this SHA |

### Focused Mongo evidence this pass

```text
FULL_MONGO_COLLECTED: 944
FULL_MONGO_PASSED: 788
FULL_MONGO_FAILED: 154
FULL_MONGO_SKIPPED: 2
EVIDENCE_FILE: .gate_mongo_full12.txt
UI_RECHECK_AFTER_TRUNCATION_CLEAR: test_home_page_renders + login UI = 2 passed
```

---

## Inventory (recalculated on HEAD)

```text
FUNCTION_INVENTORY_TOTAL≈92 (Lower≈90 mostly model Constraints; Upper=2 schema-compat)
RUNTIME_LOWER_UNRESOLVED: 0 after iexact rewrite (model Constraints rewritten by mongo_schema_compat)
TRANSACTION production raw django.atomic: facade migrated (atomic_fn / with atomic)
NESTED_MONGO_SAVEPOINT_DEPENDENCY: 0 (facade nested atomic is Mongo no-op)
select_for_update production: facade only
```

---

## Next exact action

1. Fix remaining unique-index / IntegrityError Mongo parity for org/assignment codes
2. Fix `'list' object has no attribute 'select_related'` recording paths
3. Re-run full `pytest --ds=config.settings.mongo_same_db_poc --ignore=apps/mongo_poc` to **FAILED=0**
4. Mongo coverage ≥80% from that green suite
5. Re-confirm concurrency + Decimal + cross-org + FG dump/restore + Celery worker/beat + health
6. Playwright/browser smoke on isolated Mongo runtime
7. Full PostgreSQL regression + quality/security gates
8. Rebuild release package from final green SHA
9. Company cutover remains authorization-blocked

---

## Safety

- Do not use the OneDrive clone
- Do not merge `main` automatically
- Do not write to `mgintginpro_prod` / MaintainPro
- Watch for accidental zero-byte truncation of source files (restore from HEAD only after proving)
