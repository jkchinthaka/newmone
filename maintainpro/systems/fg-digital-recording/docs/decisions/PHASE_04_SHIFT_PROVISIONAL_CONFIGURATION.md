# Phase 04 — Configurable Shift Provisional Configuration

**Document status:** Owner-directed provisional technical decision — not real-data approval
**Created:** 2026-08-07
**Owner:** Chinthaka Jayaweera
**Decision date:** 2026-08-07

## Facts

- Official ASM-004 / ASM-005 / ASM-006 business values were **not** supplied.
- The project owner directed development to proceed with a **configurable technical foundation**.
- This is **not** evidence that real Shift data was approved.
- No real organization, site, department, shift name, code, or time may be invented.
- No default “Day Shift”, “Night Shift”, or similar rows may be seeded.
- Existing Organization, Site, and Department records remain the hierarchy source.
- Authorized users will configure actual Shift values later.
- Production use remains prohibited until real data and UAT are confirmed.

## Provisional technical rules

1. Shift names and codes are administrator-configured.
2. No business Shift rows are automatically seeded.
3. A Shift is scoped to an Organization and may optionally be narrowed to a Site and Department.
4. A Department cannot be selected without a Site.
5. Site and Department must belong to the selected Organization.
6. Department must belong to the selected Site when both are present.
7. Start time and end time are required.
8. A Shift is considered overnight when end time is less than or equal to start time.
9. Effective-from is required.
10. Effective-to is optional.
11. Effective-to cannot be earlier than effective-from.
12. Historical Shift definitions must not be hard-deleted.
13. Deactivation is used instead of destructive deletion.
14. Application timezone uses the repository’s configured authoritative timezone (`Asia/Colombo` by default via `DJANGO_TIME_ZONE`).
15. If the repository timezone is not Asia/Colombo, treat that as a blocking discrepancy before changing global settings. **Current default is Asia/Colombo — no discrepancy.**
16. This decision does **not** authorize deployment, pilot use, or production use.

## Field limits (selected)

| Field | Limit |
| --- | --- |
| `code` | 64 characters (normalized uppercase) |
| `name` | 255 characters (trimmed only) |

## Versioning limitation (Phase 04A)

- One stable Shift definition per normalized code and scope.
- Effective dates describe the validity window of that definition.
- Multiple overlapping versions are **not** implemented in Phase 04A.
- Timing changes are explicit updates recorded through audit events.
- Future operational records must preserve historical meaning through immutable references or snapshots in a later phase.

## ASM status

| Assumption | Status after this decision |
| --- | --- |
| ASM-004 | Remains unresolved for official org/site/department names and codes |
| ASM-005 | Remains unresolved for official Shift names and codes |
| ASM-006 | Remains unresolved for official timings and operational overnight policy |
| Technical foundation | Provisionally unblocked for a configurable, **unseeded** foundation only |
| Real-data configuration / operational use | Remains blocked |

## Related

- [ADR-008-CONFIGURABLE-SHIFT-FOUNDATION.md](../architecture/ADR-008-CONFIGURABLE-SHIFT-FOUNDATION.md)
- [ASSUMPTION_REGISTER.md](../business/ASSUMPTION_REGISTER.md)
- [ROADMAP.md](../ROADMAP.md)
