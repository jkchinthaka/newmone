# Security Guide

## Current security posture

Security controls and runbooks exist as technical foundations. Production security attestation is still outstanding.

## Key security characteristics

- named-account model only
- employee-code authentication
- password hashing via Django
- session-based browser authentication
- CSRF enabled
- secure cookies and HTTPS controls in production settings
- brute-force protections through lockout and rate limiting
- deny-by-default authorization
- audit events for important actions
- secrets kept out of source control
- no direct ERP database writes

## Technical role separation

The repository technically separates:

- recording
- supervisor review
- QA review
- administrative management
- audit access

Those separations exist even though final business role mappings remain `EVIDENCE REQUIRED`.

## Security references

- [../security/AUTHENTICATION_AND_ACCESS_CONTROL.md](../security/AUTHENTICATION_AND_ACCESS_CONTROL.md)
- [../security/SECURITY_BASELINE.md](../security/SECURITY_BASELINE.md)
- [../security/PERMISSION_MATRIX.md](../security/PERMISSION_MATRIX.md)
- [../security/SECURITY_EVENT_CATALOGUE.md](../security/SECURITY_EVENT_CATALOGUE.md)
- [../operations/SECURITY_RUNBOOK.md](../operations/SECURITY_RUNBOOK.md)
- [../operations/INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md)

## What remains open

- production security signoff
- privileged access review cadence
- named security incident owners
- production vault custody and operational ownership
- final SoD approval evidence

## Handover rule

Do not describe the system as security-approved for production. The accurate statement is that technical hardening exists and production signoff remains outstanding.
