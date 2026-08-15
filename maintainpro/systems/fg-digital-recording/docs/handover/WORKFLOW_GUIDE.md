# Workflow Guide

## Scope

This guide describes the implemented checklist workflow at a high level. It intentionally avoids inventing product limits, pass/fail thresholds, checklist content, or approval rules.

## Core operational sequence

1. A checklist task exists in `scheduling`.
2. An operator records draft responses in `recording`.
3. The operator submits an immutable checklist submission.
4. A supervisor reviews the submission in `reviews`.
5. The supervisor either approves it forward or returns it for correction.
6. If returned, correction and resubmission create new immutable history rather than overwriting prior records.
7. QA performs a manual final in-app disposition in `quality`.

## QA terminal labels

The current technical foundation supports manual:

- `RELEASE`
- `HOLD`
- `REJECT`

Important limits on those labels:

- they are in-app dispositions only
- they do not automatically release stock
- they do not automatically update ERP
- they do not automatically close warehouse or dispatch workflows
- they do not replace written business procedures

## Pre-conditions for real operational use

Before the workflow can be used beyond technical demonstration, the repository still requires:

- approved checklist content, especially FG-QA-001
- approved recorder, supervisor, and QA role mappings
- segregation-of-duties evidence
- approved organization, shift, product, and specification data
- production batch-source and integration evidence

## What is implemented vs blocked

Implemented:

- task orchestration foundations
- draft save and immutable submit
- supervisor review
- correction/resubmission
- manual QA disposition

Blocked for production:

- real batch-driven task generation
- approved business checklist rollout
- production recorder/Supervisor/QA operation
- downstream release-to-ERP/dispatch actions

## Design rules that matter in handover

- submitted records are not edited in place
- corrections preserve the prior state
- evaluation logic is not the same as release disposition
- deterministic, evidence-based business rules are required before enabling stricter operational automation

## Related references

- [../PROJECT_STATUS.md](../PROJECT_STATUS.md)
- [../business/PHASE_07_PRODUCTION_READINESS_GATE.md](../business/PHASE_07_PRODUCTION_READINESS_GATE.md)
- [../business/PHASE_08_RECORDING_READINESS_GATE.md](../business/PHASE_08_RECORDING_READINESS_GATE.md)
- [../business/PHASE_09_SUPERVISOR_REVIEW_READINESS_GATE.md](../business/PHASE_09_SUPERVISOR_REVIEW_READINESS_GATE.md)
- [../business/PHASE_10_QA_REVIEW_READINESS_GATE.md](../business/PHASE_10_QA_REVIEW_READINESS_GATE.md)
- [../business/PHASE_10_POST_QA_WORKFLOW_GATE.md](../business/PHASE_10_POST_QA_WORKFLOW_GATE.md)
