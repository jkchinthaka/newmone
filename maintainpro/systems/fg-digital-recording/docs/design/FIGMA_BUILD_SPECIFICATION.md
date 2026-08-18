# Figma Build Specification — Phase 01A

**Document status:** Instruction for creating the Figma file — **this phase does not create the Figma file itself**  
**Phase:** 01A  
**Last updated:** 2026-08-04

Project owners may create the Figma Professional file manually or with Figma-assisted tools using this specification. Do not claim a Figma file was created by this documentation phase. Do not generate image assets here. Do not copy unrelated design systems or unlicensed brand assets.

## File purpose

Capture project brief, journeys, IA, and low-fidelity wireframes sufficient for review before tokens (01B) and high-fidelity screens (01C).

## Required pages

| Page | Phase 01A deliverable |
| --- | --- |
| 00 Project Brief | **Yes** — frames |
| 01 User Journeys | **Yes** — frames |
| 02 Information Architecture | **Yes** — frames |
| 03 Low-Fidelity Wireframes | **Yes** — frames |
| 04 Design Tokens | Stub page only; content in **Phase 01B** |
| 05 Components | Stub page only; content in **Phase 01B** |
| 06 Operator Mobile | Stub / link to lo-fi; hi-fi in **01C** |
| 07 Supervisor Mobile and Tablet | Stub; hi-fi **01C** |
| 08 QA Console | Stub; hi-fi **01C** |
| 09 Administration | Stub; hi-fi **01C** |
| 10 Management Dashboard | Stub; hi-fi **01C** |
| 11 Offline and Error States | Lo-fi frames for sync wording **Yes** |
| 12 Interactive Prototypes | Stub; **01C** |
| 13 Developer Handoff | Stub notes linking to repo docs **Yes** light |
| 99 Archive | Empty ready |

## Phase 01A must specify / include in Figma

1. Project brief frames (goals, personas list, MVP non-goals, constraints)
2. Journey frames (J1–J8 step boards)
3. IA frames (nav per role + sitemap)
4. Low-fidelity wireframes for MVP screens in [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md)
5. Annotation components (note, rule, risk)
6. **Decision-required** labels on open items

## Naming conventions

### Pages

`NN Name` as in the table above (zero-padded).

### Frames

`[page]/[persona|shared]/screen-id]/state]`  
Examples: `03/operator/OP-CHK/default`, `03/operator/OP-RES/server-ack`, `11/shared/sync/waiting-to-sync`

### Components (when introduced in 01B)

`comp/[category]/[name]/[variant]`  
Examples: `comp/button/primary/default`, `comp/status/critical/text-icon`

### Annotation components (01A)

- `ann/note`
- `ann/business-rule`
- `ann/decision-required`
- `ann/evidence-required`
- `ann/assumption`
- `ann/mvp`
- `ann/later`

## Auto-layout expectations

- All lo-fi frames use auto-layout vertical stacks.
- Touch target spacers ≥48px for primary controls.
- Resizing: hug contents for annotations; fill container for main columns.

## Variables strategy (later phases)

- 01B: colour, space, radius, type variables.
- 01A: use grayscale lo-fi only; semantic status via text/icons, not final tokens.

## Annotation format

```
[TYPE] short title
Body: explanation
Repo: path/to/doc#section
Owner: role TBC
Status: Proposed | Decision required | …
```

## Links to repository documents

| Figma page | Repo doc |
| --- | --- |
| 00 | README, PROJECT_CHARTER, MVP_SCOPE |
| 01 | USER_JOURNEYS.md, PERSONAS.md |
| 02 | INFORMATION_ARCHITECTURE.md |
| 03 | LOW_FIDELITY_WIREFRAMES.md, SCREEN_INVENTORY.md |
| 11 | USER_JOURNEYS.md J6, CONTENT_AND_LANGUAGE_GUIDE.md |
| 13 | FIGMA_BUILD_SPECIFICATION.md, VALIDATION_STRATEGY.md |

## Review status labels

Frame badge variants: `Draft` · `In review` · `Approved with conditions` · `Approved` · `Rejected`  
**Do not mark Approved in 01A without signed approval form.**

## Version history approach

- Figma file versions named: `v0.1-01A-lofi`, `v0.2-01A-review`, …
- Pair with git tag/PR for matching doc revision.
- Breaking IA changes bump minor version and note in DESIGN_DECISION_REGISTER.

## Out of scope for 01A Figma build

- Final visual styling / brand illustration
- Production components library completion
- High-fidelity interactive prototype
- Real Sinhala regulatory translations without review
