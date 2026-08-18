# Contrast Validation — Phase 01B

**Document status:** Calculated ratios — failing pairs are **not approved** for that use  
**Phase:** 01B-R  
**Method:** WCAG 2.x relative luminance contrast  
**Last updated:** 2026-08-04

Pass thresholds: **AA normal text ≥ 4.5:1** · **AA large text/UI (≥18px regular or ≥14px bold) ≥ 3:1**.

| Combination | Foreground | Background | Ratio | Intended use | WCAG AA | Required adjustment |
| --- | --- | --- | --- | --- | --- | --- |
| Primary text on app background | `#17211A` | `#F6F8F6` | **15.51:1** | Body | **Pass** | None |
| Primary text on white | `#17211A` | `#FFFFFF` | **16.55:1** | Body | **Pass** | None |
| Secondary text on white | `#5C685F` | `#FFFFFF` | **5.83:1** | Body/meta | **Pass** | None |
| Secondary text on app background | `#5C685F` | `#F6F8F6` | **5.46:1** | Meta | **Pass** | None |
| White text on primary green | `#FFFFFF` | `#216E39` | **6.26:1** | Primary button label | **Pass** | None |
| White text on primary hover | `#FFFFFF` | `#18572C` | **8.61:1** | Pressed primary | **Pass** | None |
| Primary green text on primary soft | `#216E39` | `#E8F4EB` | **5.54:1** | Selected/soft labels | **Pass** | None |
| White text on critical red | `#FFFFFF` | `#C93434` | **5.22:1** | Critical button/banner title on fill | **Pass** | None |
| Critical text on white | `#C93434` | `#FFFFFF` | **5.22:1** | Critical inline text | **Pass** | None |
| Success on white | `#237A45` | `#FFFFFF` | **5.33:1** | Success text | **Pass** | None |
| Information on white | `#2563A8` | `#FFFFFF` | **6.12:1** | Info text | **Pass** | None |
| Warning on white | `#B76E00` | `#FFFFFF` | **4.00:1** | Body warning text | **Fail AA normal** | Use as **large/bold only**, or darken warning text (e.g. toward `#8A5200`) for normal body — **DECISION REQUIRED** |
| Warning on gold soft | `#B76E00` | `#F8F2DD` | **3.57:1** | Warning on soft panel | **Fail AA normal** / large-only borderline | Do not use for normal body; darken text or add dark text + icon |
| Secondary gold on white | `#C7A94B` | `#FFFFFF` | **2.28:1** | Accent | **Fail** | **Decorative only** — never body text |
| Primary text on gold soft | `#17211A` | `#F8F2DD` | **14.77:1** | Text on gold soft panels | **Pass** | Prefer this over gold-as-text |
| Secondary on border (disabled approx) | `#5C685F` | `#DDE4DF` | **4.51:1** | Disabled-ish | **Pass** (marginal) | Prefer explicit disabled token with tested pair |
| Focus ring (primary) on white | `#216E39` | `#FFFFFF` | **6.26:1** | Focus indicator | **Pass** (non-text UI) | Keep 2px+ visible ring |
| Focus ring (primary) on app background | `#216E39` | `#F6F8F6` | **5.87:1** | Focus indicator | **Pass** | None |

## Rules derived

1. Do not use `#C7A94B` for text.
2. `#B76E00` is **not approved** for normal-size body text on white or gold-soft until darkened or restricted to large text + icon + pattern.
3. Critical/success/info/primary combinations tested above are acceptable for stated uses.
4. Failing combinations must not be marked approved in Figma without adjustment.

## Approval status

Contrast validation documented for review — **not a completed accessibility audit certification**.
