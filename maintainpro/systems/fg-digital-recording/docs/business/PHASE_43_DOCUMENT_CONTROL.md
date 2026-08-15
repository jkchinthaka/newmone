# Phase 43 — Quality Document Control

**Status:** Technical foundation delivered  
**ADR:** [ADR-054](../architecture/ADR-054-QUALITY-DOCUMENT-CONTROL.md)  
**Approval:** APR-068 EVIDENCE REQUIRED  

## Delivered

- `apps.document_control` — `QualityDocument`, `QualityDocumentVersion`,
  append-only events, optional acknowledgement, historical record links
- Lifecycle: DRAFT, UNDER_REVIEW, APPROVED, EFFECTIVE, RETIRED
- Immutability after approval; new revision required for changes
- Operator selector returns only currently effective documents
- As-of effective lookup using effective windows after retirement
- Phase 11 file kind `QUALITY_DOCUMENT_VERSION`
- Permissions: view effective / edit / approve / publish / acknowledge / link
- Approver cannot be the version author

## Not claimed

- No Nelna SOP/WI/specification codes or titles
- Acknowledgement is not competency training
- Document control SOP, numbering scheme, and role mapping remain owner-required

## STATUS: PHASE 43 DOCUMENT CONTROL COMPLETE
