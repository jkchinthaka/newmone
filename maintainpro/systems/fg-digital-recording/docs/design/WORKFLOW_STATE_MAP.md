# Workflow State Map

**Document status:** Proposed states — unapproved business transitions marked  
**Phase:** 01A  
**Last updated:** 2026-08-04

Do not treat state names as approved Nelna SOP language until QA signs off.

---

## Authentication

```mermaid
stateDiagram-v2
  [*] --> Anonymous
  Anonymous --> Authenticating: submit credentials
  Authenticating --> Authenticated: success
  Authenticating --> Anonymous: invalid (generic)
  Authenticating --> Locked: lockout threshold [DECISION REQUIRED]
  Locked --> Anonymous: admin unlock [OWNER REQUIRED]
  Authenticated --> PasswordChangeRequired: policy forces change
  PasswordChangeRequired --> Authenticated: password updated
  Authenticated --> Denied: authorized route fails
  Authenticated --> SessionExpired: timeout [EVIDENCE REQUIRED]
  SessionExpired --> Anonymous: re-login
  Denied --> Authenticated: navigate away
```

---

## Task

```mermaid
stateDiagram-v2
  [*] --> Scheduled
  Scheduled --> Assigned: assignment
  Assigned --> InProgress: operator opens/starts
  InProgress --> ReadyToSubmit: completeness met
  ReadyToSubmit --> InProgress: edits
  InProgress --> Cancelled: cancelled [DECISION REQUIRED]
  Assigned --> Overdue: past due [DECISION REQUIRED]
  Overdue --> InProgress: started late
  ReadyToSubmit --> Closed: record submitted (server ACK)
```

---

## Record

```mermaid
stateDiagram-v2
  [*] --> DraftLocal: optional offline draft [Later]
  DraftLocal --> DraftLocal: save on device
  DraftLocal --> Submitting: sync/submit attempt
  [*] --> Submitting: online submit
  Submitting --> Submitted: server ACK
  Submitting --> DraftLocal: sync failed (not submitted)
  Submitted --> ReturnedForCorrection: supervisor return
  ReturnedForCorrection --> Submitting: resubmit
  Submitted --> SupervisorApproved: supervisor approve
  SupervisorApproved --> QAVerified: QA verify
  SupervisorApproved --> QARejected: QA reject
  SupervisorApproved --> OnHold: QA hold
  OnHold --> SupervisorApproved: hold released [DECISION REQUIRED]
  QARejected --> ReturnedForCorrection: path [DECISION REQUIRED]
  QAVerified --> Closed: terminal for MVP path
```

**Rule:** Local draft ≠ Submitted.

---

## Supervisor review

```mermaid
stateDiagram-v2
  [*] --> PendingReview: record submitted
  PendingReview --> InReview: supervisor opens
  InReview --> PendingReview: leave without action
  InReview --> Approved: approve (SoD ok)
  InReview --> ReturnRequested: return with reason
  ReturnRequested --> PendingReview: after resubmit
  InReview --> BlockedBySoD: policy deny
  BlockedBySoD --> PendingReview: another reviewer
```

---

## QA verification

```mermaid
stateDiagram-v2
  [*] --> PendingVerification: supervisor approved
  PendingVerification --> InVerification: QA opens
  InVerification --> Verified: verify
  InVerification --> Rejected: reject + reason
  InVerification --> Hold: hold + reason
  InVerification --> ReinspectionRequested: request reinspection
  Hold --> InVerification: resume [DECISION REQUIRED]
  ReinspectionRequested --> PendingVerification: after new approval chain [DECISION REQUIRED]
  Verified --> [*]
```

NC creation is a **Later** branch from Hold/Reject as approved by QA scope.

---

## Loading block (Later phase)

```mermaid
stateDiagram-v2
  [*] --> InspectionInProgress
  InspectionInProgress --> InspectionPassed: no critical fail
  InspectionInProgress --> LoadingBlocked: critical failure
  LoadingBlocked --> ReinspectionPending: request reinspection
  ReinspectionPending --> InspectionInProgress: new inspection
  LoadingBlocked --> OverrideRequested: request override
  OverrideRequested --> OverrideAuthorized: dual auth [DECISION REQUIRED]
  OverrideRequested --> LoadingBlocked: denied
  OverrideAuthorized --> LoadingCleared: audited override
  InspectionPassed --> LoadingCleared
  LoadingCleared --> [*]
```

No temperature thresholds encoded here.

---

## Offline synchronization (design / Later implement)

```mermaid
stateDiagram-v2
  [*] --> Online
  Online --> OfflineWorking: connectivity lost
  OfflineWorking --> SavedOnDevice: local persist
  SavedOnDevice --> WaitingToSync: reconnect
  WaitingToSync --> Syncing: worker starts
  Syncing --> EvidenceUploading: files pending
  EvidenceUploading --> Syncing: files done
  Syncing --> Synchronized: server ACK
  Syncing --> SyncFailed: error
  SyncFailed --> WaitingToSync: retry
  Syncing --> Conflict: divergence detected
  Conflict --> WaitingToSync: resolved by policy [DECISION REQUIRED]
  Synchronized --> Online
```

**Critical wording:** Only `Synchronized` with server ACK may be described as submitted/saved on server.

---

## Open state decisions

| Topic | Status |
| --- | --- |
| Lockout threshold / duration | [DECISION REQUIRED] |
| Task cancel/overdue rules | [DECISION REQUIRED] |
| Hold release authority | [OWNER REQUIRED] |
| Dual authorization for loading override | [DECISION REQUIRED] |
| Conflict resolution policy | [DECISION REQUIRED] |
| Whether QA reject returns to operator or supervisor | [DECISION REQUIRED] |
