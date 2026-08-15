# Deployment Guide

## Status

`GO-LIVE BLOCKED`

This repository does not contain evidence that production deployment is authorized.

Authoritative references:

- [../release/PHASE_21_FINAL_REPORT.md](../release/PHASE_21_FINAL_REPORT.md)
- [../release/README.md](../release/README.md)
- [../business/PHASE_21_PRODUCTION_RELEASE.md](../business/PHASE_21_PRODUCTION_RELEASE.md)

## What is supported today

- local developer setup
- local Docker Compose infrastructure
- technical runbooks for backup, restore, monitoring, incident response, and security

## What is not authorized today

- production deployment
- production release tag creation based on current evidence
- paper-process decommission
- production claims such as `PRODUCTION READY` or `UAT PASSED`

## Hard blockers called out in release docs

- Phase 20 UAT/pilot not passed
- no production environment recorded
- no approved production configuration recorded
- no production backup custody / RPO / RTO approval
- no production security signoff
- no named support owner

## Handover deployment stance

Use the release package as a blocked gate set, not as an approval to deploy:

- [../release/HARD_PREREQUISITES.md](../release/HARD_PREREQUISITES.md)
- [../release/PRODUCTION_ENVIRONMENT.md](../release/PRODUCTION_ENVIRONMENT.md)
- [../release/DB_CHANGE_AND_SMOKE.md](../release/DB_CHANGE_AND_SMOKE.md)
- [../release/SUPPORT_AND_HANDOVER.md](../release/SUPPORT_AND_HANDOVER.md)

## If a future team prepares deployment

They must first close the evidence gaps in:

- [OPEN_BLOCKERS.md](OPEN_BLOCKERS.md)
- [BUSINESS_EVIDENCE_REQUIRED.md](BUSINESS_EVIDENCE_REQUIRED.md)
- [../governance/APPROVAL_REGISTER.md](../governance/APPROVAL_REGISTER.md)

## Explicit non-instructions

This guide intentionally does not provide production deployment commands, hostnames, or pipeline steps that would imply production authorization.
