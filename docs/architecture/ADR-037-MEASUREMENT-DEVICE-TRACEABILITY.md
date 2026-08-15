# ADR-037 — Measurement device traceability

**Status:** Accepted (technical foundation)  
**Date:** 2026-08-10  
**Phase:** 25  

## Context

Operators record quality measurements that depend on a specific measuring device and its calibration state. Phase 05D delivered Equipment / CalibrationRecord masters without recording enforcement. Historical submissions must retain device identity and calibration status at measurement time.

## Decision

1. Draft and submission responses store `equipment`, `calibration_record`, `measurement_recorded_at`, and frozen `device_trace_context`.
2. Eligibility checks: organization, optional site, active / in-service, optional `required_equipment_type`.
3. Enforcement modes via settings: `OFF` (default), `WARN`, `BLOCK` — do not invent company blocking policy.
4. Manual override of BLOCK requires `INSTRUMENTS_CALIBRATION_OVERRIDE_APPROVED` plus `instruments.override_calibration_gate`, and is audited.
5. Calibration certificates may be linked as evidence kind `CALIBRATION_CERTIFICATE` to a CalibrationRecord.
6. Device fitness never auto-creates QA RELEASE/HOLD/REJECT.

## Consequences

- Company must approve APR-051 before enabling WARN/BLOCK in production.
- Later equipment renames/status changes do not rewrite frozen snapshots.
