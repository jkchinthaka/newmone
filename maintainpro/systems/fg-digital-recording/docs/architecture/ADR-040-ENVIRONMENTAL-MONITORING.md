# ADR-040 — Environmental monitoring foundation

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 28

## Context

Factories need a generic environmental monitoring foundation for temperature, humidity, water, swabs, and other approved measurements — without assuming which parameters Nelna uses, and without inventing limits.

## Decision

1. Introduce `apps.environmental` with `MonitoringPoint` (site/department/room/line/work area), `MonitoringParameter`, and versioned `MonitoringSpec` / `MonitoringLimitRule` shells.
2. Readings support `MANUAL`, `LAB` (linked `LabResult`), and `SENSOR` (opaque placeholder — IoT not required).
3. Recurring readings reuse `ChecklistSchedule` via `MonitoringScheduleLink`.
4. Limit evaluation yields IN_RANGE / WARN / EXCURSION / NOT_EVALUATED; excursions raise advisory events.
5. Auto-HOLD requires org `EnvironmentalExcursionPolicy.auto_hold_enabled` **and** `ENVIRONMENTAL_AUTO_HOLD_APPROVED` (default OFF).
6. `MonitoringTrendIndex` denormalizes readings for later trend/reporting.
7. Optional `Equipment` link freezes `device_trace_context` on the reading.

## Consequences

- Company EM catalogues, limits, frequencies, and HOLD policy remain **EVIDENCE REQUIRED** (APR-054).
- Missing bounds evaluate as NOT_EVALUATED — never invent thresholds.
