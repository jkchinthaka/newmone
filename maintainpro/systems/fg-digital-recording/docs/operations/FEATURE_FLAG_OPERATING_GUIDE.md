# Feature Flag Operating Guide — Phase 90

**Document status:** Technical operating guide  
**Last updated:** 2026-08-10  
**Module:** `apps.feature_flags`

## Purpose

Governed feature flags support staged rollout of optional advanced modules. They do **not** replace RBAC, SoD, or security controls.

## Hard security rule

```
# PROHIBITED
if is_feature_enabled(...):
    # skip require_permission / policies
    ...

# REQUIRED ORDER
1. Authenticate
2. Authorize (RBAC / policies) — fail closed
3. Optionally require feature flag for optional modules
```

Frontend hiding is UX only. Backend must call `assert_feature_enabled_for_request` (or equivalent) after permission checks.

## Catalogue (closed)

| Key | Intent |
| --- | --- |
| `ai_assistant` | Optional AI assistance surfaces |
| `offline_mode` | Offline sync features |
| `mobile_qa_disposition` | Mobile QA final disposition (high risk) |
| `iot_integrations` | Device/IoT adapters |
| `customer_portal` | External customer portal |
| `supplier_portal` | External supplier portal |
| `advanced_analytics` | Advanced / NL analytics |

Do not add per-button UI flags. Extend the catalogue via code review only.

## Defaults

- New flags default **`enabled=False`**
- Missing flag row ⇒ **OFF**
- Unknown key ⇒ **OFF**
- Temporary flags require `review_by`; past review date ⇒ treated inactive

## Scopes

Evaluation specificity: **SITE > ORGANIZATION > GLOBAL**.

## Administration

- Permission: `feature_flags.manage_featureflag` (privileged)
- Audited events: create / enable / disable / scope-or-metadata change
- Soft retention: no hard delete in admin

## Cleanup

Run / review `list_overdue_temporary_flags()` during ops reviews. Disable or convert with owner justification — do not leave forgotten permanent toggles.

## Non-claims

Flags do not authorize production go-live, invent Nelna business rules, or enable QA RELEASE/HOLD/REJECT by themselves.
