# UAT Governance Contract

## Evidence categories

| Class | Meaning | Can authorize GO_FOR_CUTOVER? |
| --- | --- | ---: |
| A. AUTOMATED_TECHNICAL_VALIDATION | CI/synthetic | **no** |
| B. CONTROLLED_UAT_REHEARSAL | Pilot-like non-prod | **no** (process only) |
| C. FORMAL_BUSINESS_UAT | Nominated users + signed evidence | required |
| D. PRODUCTION_SMOKE | Phase 8 only | post-deploy only |

Rules: automated tests ≠ business UAT; synthetic signatures ≠ human approval; E2E training ≠ completed training; Phase 7 validates mechanics and may recommend DELAYED/NO_GO; it cannot fabricate GO.