# Device UAT Matrix

**Purpose:** Real-device verification of operator workflows on factory-like clients.
**Classification:** HUMAN UAT REQUIRED — leave human fields blank until executed.
**Do not close Sinhala/device debt without real-device evidence.**

Application baseline SHA: `c08ebec96b8551209bc2228866ceb2fb65031668` (retest if UI changes).

## Matrix

| Device | OS | Browser | Resolution | Touch | Keyboard | Zoom | Sinhala | Network | Tester | Date | Result | Evidence | Defect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Windows laptop | | Chrome | native | N | Y | 100%/125% | | office LAN | | | | | |
| Windows laptop | | Edge | native | N | Y | 100%/125% | | office LAN | | | | | |
| Tablet 10–11 inch | | Chrome/Edge | ~1280×800 | Y | optional | 100% | | factory Wi-Fi | | | | | |
| Tablet / laptop | | | 1024×768 | | | | | | | | | | |
| Narrow viewport | | | 768 width | | | | | | | | | | |
| Mobile-like | | | ~390 width | Y | | | | weak network | | | | | |

## Scenario checks (per device row above)

Mark Pass/Fail only after human execution.

| Scenario | Result | Notes |
| --- | --- | --- |
| Login | | |
| Daily Records navigation | | |
| CL/24 entry + Save Draft | | |
| CL/39 decimal entry | | |
| CL/30 / CL/18 as applicable | | |
| Touch targets usable | | |
| Keyboard tab order usable | | |
| Browser zoom 125–150% readable | | |
| Sinhala labels/content render | | |
| Factory Wi-Fi usable | | |
| Weak network: clear save/error state | | |
| Reconnect after drop: no silent data loss | | |
| Print Preview opens | | |

## Network resilience notes (device)

| Check | Result | Defect |
| --- | --- | --- |
| Failed autosave shows error (not silent) | | |
| Retry after temporary drop | | |
| Duplicate Save safe | | |
| Duplicate Submit safe | | |
| Reload after save retains data | | |
| Stale form handled safely | | |
| Session/CSRF expiry messaging clear | | |

**Offline mode:** Not claimed unless separately implemented and evidenced.

## Sign-off

| Role | Name | Date | Result |
| --- | --- | --- | --- |
| Tester | | | |
| QA witness | | | |
| IT witness | | | |
