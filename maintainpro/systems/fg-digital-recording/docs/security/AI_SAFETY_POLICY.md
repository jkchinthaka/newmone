# AI Safety Policy

**Document status:** Draft policy — requires QA and IT acknowledgement before AI features ship  
**Phase:** 00 — Discovery and governance  
**Last updated:** 2026-08-04

## Purpose

Define how optional AI assistance may be used without undermining food-safety accountability or access control.

## Allowed AI assistance

- Drafting helper text or operator guidance suggestions
- Anomaly hints that a human must interpret
- Non-binding summaries for human reviewers
- Local-model experimentation in non-production first
- Phase 18 technical catalogue: summarize batch history / NCR-CAPA, explain report metrics, assist search, trend narration (all advisory)

AI features remain **optional**. `AI_ASSISTANCE_ENABLED` defaults **OFF**. Core recording, review, and release must work with AI disabled.

## Prohibited AI decisions

AI must **never** make final decisions for:

- Food-safety disposition
- QA verification outcome (RELEASE / HOLD / REJECT)
- Loading release
- CAPA closure
- Access control grant/deny/escalate
- Checklist publish / specification change / ERP disposition writes
- Declaring root cause as fact

Deterministic configured rules and human approvals remain authoritative.

## Local-model architecture

Preferred approach: local models (for example via Ollama) invoked from Python services inside the modular monolith or adjacent worker processes. No paid external AI API is required for core delivery.

## Human review requirements

Any AI output that appears in an operational workflow must be clearly labeled as assistance and require human confirmation before it affects a record state.

## Sensitive-data handling

Minimize personal and proprietary data sent to AI components. Prefer redaction. Do not send secrets. Retention of prompts/outputs follows approved policy when AI is enabled (**EVIDENCE REQUIRED**).

## Prompt/output audit requirements

Where AI touches regulated or quality workflows, store sufficient prompt/output metadata (model identity, timestamp, user, subject reference) for investigation, without claiming completeness until the design is approved.

## Model versioning

Assistance features must record which model/version produced a suggestion when results are retained.

## AI failure fallback

If AI is unavailable or errors, core recording, review, and release workflows continue using non-AI paths. AI outage must not block the factory floor.

## No dependency of core workflows on AI availability

Architecture and tests must prove critical paths work with AI disabled.

## References

- [REQUIREMENTS_CATALOGUE.md](../requirements/REQUIREMENTS_CATALOGUE.md) AI-*  
- Cursor rule `10-ai-safety.mdc`
