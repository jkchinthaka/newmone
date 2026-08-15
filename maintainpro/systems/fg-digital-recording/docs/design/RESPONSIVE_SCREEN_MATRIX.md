# Responsive Screen Matrix (01C-R)

**Document status:** Draft pending owner review  
**Updated:** 2026-08-05  
**Figma:** https://www.figma.com/design/jnn8Xhsg1zFEHxYShCUb4M

Reference widths: 360 / 430 / 768 / 1024 / 1440 (not hard-coded app breakpoints).

| Category | 360 | 430 | 768 | 1024 | 1440 | Node IDs | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Login | `06/auth/AUTH-LOGIN/360` | — | — | `06/auth/AUTH-LOGIN/1024` | — | `18:2`, `67:2` | Bottom CTA; no squeeze |
| Operator Home | `OP-HOME/360` | `OP-HOME/430` | — | — | — | `16:39`, `39:13` | Bottom nav |
| Operator checklist | `OP-CHK/normal/360` | `OP-CHK/430` | — | — | — | `16:82`, `43:72` | Sticky actions; Mark All annotated |
| Supervisor queue | — | — | `SV-QUEUE/768` | `SV-QUEUE/1024` | — | `53:2`, `53:51` | Failures first; list not table |
| Supervisor review | — | — | `SV-REVIEW/768` | — | `SV-REVIEW/1440` | `54:133`, `54:191` | Desktop side space |
| QA queue | — | — | `QA-QUEUE/768` | `QA-QUEUE/1024` | — | `57:66`, `57:116` | List triage |
| QA verification | — | — | — | `QA-VERIFY/1024` | `QA-VERIFY/1440` | `58:2`, `58:69` | Evidence + actions |
| Loading blocked | `LB-BLOCKED/360` | — | `LB-BLOCKED/768` | `LB-BLOCKED/1024` | — | `20:17`, `57:3`, `57:30` | Approve unavailable |
| Admin list/form | — | — | — | `AD-USERS/1024`, `AD-FORM/1024` | `AD-USERS/1440`, `AD-FORM/1440` | `54:2`, `60:155`, `20:62`, `62:70` | Sidebar shell |
| Management dashboard | — | — | — | `MG-DASH/1024` | `MG-DASH/1440` | `56:2`, `20:91` | ≤6 proposed KPIs |
| Auditor record pack | — | — | — | `AU-PRINT/1024` | `AU-PRINT/1440` | `24:19`, `66:122` | Read-only |

## Checks applied

- No horizontal scroll intended on phone frames  
- Mobile lists instead of squeezed tables  
- Sticky actions on operator flows  
- Overlay choice documented (modal desktop / sheet mobile components on page 05)  
- Sinhala wrapping interim samples at 360 (`31:33`); Noto owner verification pending  

Full row-level IDs: [FIGMA_01C_COVERAGE_MATRIX.md](FIGMA_01C_COVERAGE_MATRIX.md)
