# Phase 01B Decisions

**Document status:** Decision log for Phase 01B design system  
**Phase:** 01B — Approved with conditions  
**Last updated:** 2026-08-05

| ID | Decision | Status | Owner | Reason | Consequence | Evidence | Review trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1B-001 | Approved palette: primary `#216E39` / hover `#18572C` / soft `#E8F4EB`; gold `#C7A94B` / soft `#F8F2DD`; bg `#F6F8F6`; surface `#FFFFFF`; text `#17211A` / `#5C685F`; border `#DDE4DF`; success `#237A45`; warning `#B76E00`; critical `#C93434`; info `#2563A8` | Accepted (palette direction) | Project owner / design | Owner-directed industrial palette | Supersedes earlier teal draft tokens | DESIGN_SYSTEM_FOUNDATIONS; this prompt | Brand book change |
| P1B-002 | Typography: Inter + Noto Sans Sinhala | Proposed | UX / IT | Latin UI + Sinhala coverage | Font hosting required | Foundations | Font license/hosting |
| P1B-003 | 4px spacing base | Accepted (design direction) | UX | Predictable scale | All space tokens multiples of 4 | DESIGN_TOKENS | Density mode request |
| P1B-004 | Minimum touch target 48px | Accepted (design direction) | UX | A11y + gloves | Component min sizes | ACCESSIBILITY | Pilot feedback |
| P1B-005 | Preferred operational targets 48–56px | Accepted (design direction) | UX | Operator speed/accuracy | Operator primary buttons 56px | ACCESSIBILITY | Device pilot |
| P1B-006 | Lucide icon proposal | Proposed | UX | Consistent open stroke set | Bundle/license confirmation needed | Foundations | Icon pack approval |
| P1B-007 | One light/default mode only | Accepted (MVP) | UX | Scope control | No dark variables in MVP | FIGMA_VARIABLES_SPEC | A11y dark-mode request |
| P1B-008 | No dark mode in MVP | Accepted (MVP) | Project owner | Reduce delivery risk | Dark deferred | P1B-007 | Post-pilot |
| P1B-009 | One Figma file initially: “Nelna FG Digital Recording System — Product Design” | Accepted (process) | Project owner | Single source of truth | All pages in one file | FIGMA_COMPONENT_BUILD_GUIDE | Split library later |
| P1B-010 | Branch-name deviation: planned `design/figma-design-system`; actual `design/figma-tokens-components` | Accepted (harmless) | Project owner | Existing branch/PR #3 already in use | Do not rename mid-flight | Git / PR #3 | None |
| P1B-011 | Figma connector status | **Verified** — email chinthakajayaweera1@gmail.com; handle chinthaka; plan CHINTHAKA JAYAWEERA's team; Full seat; MCP + browser auth verified; file owner chinthaka | Project owner | whoami + owner confirmation 2026-08-05 | Editing access confirmed; no account-mismatch limitation | FIGMA_IMPLEMENTATION_LOG | Auth change |
| P1B-012 | High-fidelity screens deferred to Phase 01C | Accepted | Project owner | Phase boundary | Pages 06–12 in 01C while carrying 01B conditions | ROADMAP | 01B approval |
| P1B-013 | Manual Phase 01B approval required before 01C | **Satisfied with conditions** | Project owner | Governance | PHASE_01B form signed Approved with conditions 2026-08-05 | Approvals | — |
| P1B-014 | Warning `#B76E00` not approved for normal body text on white without adjustment | Required by contrast | UX | AA fail 4.00:1 | Large text only or darken | CONTRAST_VALIDATION | Token revise |
| P1B-015 | Gold `#C7A94B` decorative only — never body text | Required by contrast | UX | AA fail 2.28:1 | Accent/icon chrome only | CONTRAST_VALIDATION | — |
| P1B-016 | Phase 01B design system Approved with conditions | Accepted | Chinthaka Jayaweera (Project Owner / Developer) | Owner review 2026-08-05 | 01C may proceed after PR #3 merge; conditions must not be omitted; no library publish yet; no app dev until required screens reviewed | PHASE_01B_DESIGN_APPROVAL | Condition closure |
| P1B-017 | Remaining Figma variable/component/a11y work continues into Phase 01C | Accepted | Project owner | Incomplete library work documented | Conditions 1–3 carried forward | FIGMA_IMPLEMENTATION_LOG | Final design-system review |
| P1B-018 | No Figma component library publication yet | Accepted | Project owner | Condition 5 | Specimens remain draft | FIGMA_IMPLEMENTATION_LOG | Final design-system review |
