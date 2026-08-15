# ADR-003 — Responsive Progressive Web Application

**Status:** Accepted (technical direction)  
**Date:** 2026-08-04  
**Phase:** 00 — Discovery and governance

## Context

Users include operators (mobile), supervisors (mobile/tablet), QA (tablet/desktop), administrators (desktop), management (dashboard), and auditors (read-only). Building separate web and native applications before a pilot would increase cost and slow delivery for a solo/small team.

## Decision

Deliver **one responsive, installable Progressive Web Application**. Do not create Flutter, React Native, or native mobile applications during initial phases.

## One responsive web application

The same Django Templates + HTMX + Tailwind application serves all roles with responsive layouts and role-appropriate navigation.

## Mobile-first operator UI

Operator journeys prioritize large controls, minimal typing, fast task completion, and Sinhala-capable content. The first viewport and primary flows are designed for handheld use.

## Tablet/desktop QA and administration

QA verification, administration, and richer tables use larger breakpoints without requiring a separate codebase.

## Installable PWA

The application will be installable to home screens where browser support allows, improving access under factory conditions while remaining a web application.

## Future offline design

IndexedDB may later hold offline drafts and sync queues (Phase 14). MVP recording remains online. Offline enablement requires explicit sync, duplicate-prevention, and QA-approved procedures.

## Lower maintenance than separate web and native apps

One UI stack reduces duplicated business rules, inconsistent authorization, and parallel release trains.

## Conditions that may justify a native app later

Native development may be reconsidered only after a pilot shows that required functionality cannot be delivered reliably through the PWA — for example persistent OS-level constraints around background sync, device peripherals, or offline durability that cannot be mitigated acceptably.

## Consequences

- Must invest in responsive design quality and device testing
- Some device APIs may be limited versus native
- App-store distribution is not the primary delivery channel

## References

- [FIGMA_PLAN.md](../design/FIGMA_PLAN.md)
- [DECISION_REGISTER.md](../decisions/DECISION_REGISTER.md) DEC-004, DEC-005
- [MVP_SCOPE.md](../requirements/MVP_SCOPE.md)
