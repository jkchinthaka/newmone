# Critical State Patterns

**Document Status:** Proposed  
**Approval Status:** Pending design review, business rule validation, and compliance review  
**Last Updated:** 2026-08-04  
**Cross-references:** COMPONENT_CATALOGUE.md, COMPONENT_ANATOMY_AND_STATES.md, OPERATOR_COMPONENT_PATTERNS.md, SECURITY_BASELINE.md

## Purpose

This document defines proposed patterns for displaying and handling critical states, errors, and exceptions that require operator or supervisor attention. These patterns ensure:

- **Clear visibility:** Critical states cannot be missed
- **Clear guidance:** Operator knows what to do next
- **No confusion:** Distinguish between warnings, errors, and blocking conditions
- **Audit trail:** All critical decisions and actions are logged
- **No invented business rules:** Patterns are generic; actual business rules require evidence

**Important:** All patterns are proposed. Actual business rules, escalation procedures, and approval workflows require business owner approval and evidence.

---

## Critical Checklist Failure Pattern

### Purpose
Display and handle critical failures in checklist items (e.g., temperature out of safe range, product defect detected).

### Pattern Specification

**Trigger:**
- Operator marks checklist item as "Fail"
- System detects critical failure based on business rules (EVIDENCE REQUIRED)
- Example: Temperature measurement exceeds defined critical limit (if defined in template)

**Visual Indicators:**
- **Item border:** Critical red (2px)
- **Background:** Very light red tint (optional)
- **Icon:** Large alert icon (critical red, 24-32px)
- **Status badge:** "Critical Failure" or "Failed" (critical red)
- **Text:** Bold, "Critical Failure" heading

**Required Information Capture:**
1. **Failure reason:** Select from list (from business rules) or free text if "Other"
2. **Failure description:** Mandatory text area, clear description
3. **Evidence:** Photo evidence encouraged (may be mandatory per business rules - EVIDENCE REQUIRED)
4. **Immediate action taken:** Text area, what operator did immediately (e.g., "Product removed from line")
5. **Timestamp:** Auto-captured
6. **Operator:** Auto-captured from login

**Escalation (Business Rules - EVIDENCE REQUIRED):**
- Critical failures may trigger auto-escalation (e.g., notify supervisor immediately)
- Operator may be prompted to escalate manually
- Escalation workflow per business rules (not invented)

**Loading Blocked Condition:**
- If failure blocks further progress (e.g., "Cannot proceed to loading until resolved"), display "Loading Blocked" state (see separate pattern below)

**Example:**
```
┌─────────────────────────────────────────┐
│ ⚠ Critical Failure                      │ ← Heading (critical red)
├─────────────────────────────────────────┤
│ Temperature Check: Cold Storage A       │ ← Item label
│ Measured: [value] [unit]  (Expected: [range — EVIDENCE REQUIRED])   │ ← Measurement and range
│                                         │
│ Failure Reason: *                       │ ← Required
│ ( ) Temperature out of range            │
│ ( ) Equipment malfunction               │
│ (•) Other: [Compressor not running]    │ ← Selected
│                                         │
│ Description: *                          │ ← Required
│ [Compressor appeared to be off.        │
│  Storage temperature [value][unit] — limits EVIDENCE REQUIRED.]           │
│                                         │
│ Immediate Action Taken:                 │
│ [Moved product to backup storage.      │
│  Notified maintenance.]                │
│                                         │
│ Evidence (Photo):                       │
│ ┌────────┐  [Add Photo]                │ ← Encouraged or required
│ │ [Img1] │                             │
│ └────────┘                             │
│                                         │
│ [Escalate to Supervisor]               │ ← Action (if required)
└─────────────────────────────────────────┘
```

**Accessibility:**
- role="alert" on failure indicator
- Critical status announced
- All fields labeled
- Required fields indicated
- Focus on first required field

**Bilingual:**
- All labels in Sinhala and English
- Pre-defined reasons in both languages
- Free text in operator's language

**Business Rules Required:**
- Define what constitutes "critical failure" vs. "failure"
- Define escalation triggers and workflows
- Define mandatory fields (evidence photo, immediate action, etc.)
- Define who must approve resolution

**Evidence Required:**
- Business owner approval of failure categories and workflows
- Compliance/safety team approval of critical thresholds
- Escalation contact list and procedures

---

## Loading Blocked State Pattern

### Purpose
Display when a critical condition prevents product loading or release until resolved.

### Pattern Specification

**Trigger:**
- Critical checklist failure detected (per business rules)
- Product hold placed by QA
- Approval required but not yet granted
- Other blocking condition (per business rules - EVIDENCE REQUIRED)

**Visual Specification:**

**MUST Include:**
1. **Critical Icon:** Large (32-40px), critical red, alert/block symbol
2. **Heading:** "LOADING BLOCKED" (bold, large, critical red, all caps for visibility)
3. **Plain Explanation:** Clear, non-jargon explanation of why loading is blocked
4. **Failed Item:** Reference to specific failed item or condition
5. **Measurement (if applicable):** Show actual measured value (do NOT invent limits - use PLACEHOLDER if limit not defined)
6. **Evidence Preview:** Show attached evidence (photo, etc.) if available
7. **Permitted Actions:** Clear list of what operator CAN do (e.g., "Reinspect", "Request Override", "Escalate")
8. **Prohibited Actions:** Clear statement that normal loading cannot proceed
9. **Override Request Concept (if applicable):** If override is possible per business rules, show action (e.g., "Request Supervisor Override")
10. **Audit Notice:** Statement that all actions are logged

**Must NOT Include:**
- Normal "Approve for Loading" button (this is the key - operator cannot proceed normally)
- Any action that bypasses the block without proper authority

**Example:**
```
┌─────────────────────────────────────────┐
│          🛑 LOADING BLOCKED              │ ← Large, critical, bold
├─────────────────────────────────────────┤
│ This product cannot be loaded until     │
│ the critical failure is resolved.       │
│                                         │
│ Failed Item:                            │
│ Temperature Check: Cold Storage A       │
│                                         │
│ Measured Temperature:                   │
│ [measured value] [unit]                                  │
│                                         │
│ Expected Range:                         │
│ [RANGE NOT DEFINED - PENDING APPROVAL]  │ ← PLACEHOLDER if limit not defined
│ OR                                      │
│ [expected range — EVIDENCE REQUIRED]                                  │ ← Actual range if defined
│                                         │
│ Evidence:                               │
│ ┌────────┐                              │
│ │ [Img1] │  View Evidence               │ ← Preview available evidence
│ └────────┘                              │
│                                         │
│ Permitted Actions:                      │
│ • Reinspect (take new measurement)      │
│ • Escalate to Supervisor                │
│ • Request Override (supervisor only)    │ ← If allowed per business rules
│                                         │
│ ⚠ All actions are logged for audit.    │ ← Audit notice
│                                         │
│ [Reinspect]  [Escalate]                │ ← Action buttons
└─────────────────────────────────────────┘
```

**Interactive Elements:**
- **Reinspect:** Returns operator to checklist item for re-measurement or re-check
- **Escalate:** Notifies supervisor or QA (per business rules)
- **Request Override:** Triggers override request workflow (if permitted per business rules - EVIDENCE REQUIRED)

**No Normal Loading Approval:**
- Standard "Approve for Loading" button is NOT displayed
- Operator cannot proceed with loading through normal flow
- Override requires proper authority (supervisor, QA, etc.)

**Accessibility:**
- role="alertdialog" or role="alert"
- All text announced
- Focus on heading or first action
- Keyboard navigable

**Bilingual:**
- All text in Sinhala and English
- Critical headings in both languages, large and visible

**Business Rules Required:**
- Define what conditions trigger "Loading Blocked"
- Define who can override and under what circumstances
- Define escalation and resolution workflows
- Define audit logging requirements

**Evidence Required:**
- Business owner approval of blocking conditions
- Compliance/safety approval of override procedures
- Legal review of audit trail requirements

---

## Access Denied Pattern

### Purpose
Display when user attempts to access a feature or record they are not authorized for.

### Pattern Specification

**Trigger:**
- User attempts to access unauthorized page, record, or action
- Session expired or token invalid
- Insufficient permissions

**Visual Design:**
- **Icon:** Lock or alert (32px, critical or warning color)
- **Heading:** "Access Denied" (18-20px, bold)
- **Message:** Clear explanation ("You do not have permission to view this record")
- **Guidance:** What to do next ("Contact your supervisor if you need access")
- **Action:** "Go Back" or "Return to Home"

**Example:**
```
┌─────────────────────────────────────────┐
│         🔒 Access Denied                 │
│                                         │
│ You do not have permission to view      │
│ this record.                            │
│                                         │
│ If you believe this is an error,        │
│ contact your supervisor.                │
│                                         │
│ [Go Back]  [Home]                       │
└─────────────────────────────────────────┘
```

**Logging:**
- Log access attempt (user, resource, timestamp) for security audit

**Accessibility:**
- role="alert"
- Focus on heading
- Actions keyboard navigable

**Business Rules Required:**
- Define authorization model (roles, permissions)
- Define who can grant access
- Define audit logging for access denials

---

## Account Locked Pattern

### Purpose
Display when user account is locked due to failed login attempts or administrative action.

### Pattern Specification

**Trigger:**
- Multiple failed login attempts (per security policy)
- Admin locks account manually
- Other security trigger (per policy - EVIDENCE REQUIRED)

**Visual Design:**
- **Icon:** Lock (32px, critical color)
- **Heading:** "Account Locked" (18-20px, bold, critical)
- **Message:** Clear explanation ("Your account has been locked due to multiple failed login attempts")
- **Guidance:** How to unlock ("Contact IT support at [contact] to unlock your account")
- **No retry:** Do not allow further login attempts until unlocked

**Example:**
```
┌─────────────────────────────────────────┐
│         🔒 Account Locked                │
│                                         │
│ Your account has been locked due to     │
│ multiple failed login attempts.         │
│                                         │
│ To unlock your account, contact:        │
│ IT Support: [CONTACT INFO]              │ ← Actual contact (EVIDENCE REQUIRED)
│                                         │
│ [Return to Login]                       │
└─────────────────────────────────────────┘
```

**Security:**
- Do not reveal why account was locked (avoid information disclosure to attacker)
- Generic message: "Account locked. Contact support."
- Log lockout event for security audit

**Accessibility:**
- role="alert"
- Focus on heading
- Contact info readable and copyable

**Business Rules Required:**
- Define lockout policy (threshold, duration, unlock procedure)
- Define contact for unlock requests
- Define admin override procedure

**Evidence Required:**
- Security policy approval
- IT support contact information

---

## Submission Failure Pattern

### Purpose
Display when checklist or form submission fails.

### Pattern Specification

**Trigger:**
- Server error (500, 503, etc.)
- Network timeout
- Validation error (server-side)
- Conflict (e.g., record already submitted)

**Visual Design:**
- **Icon:** Alert (32px, critical red)
- **Heading:** "Submission Failed" (18-20px, bold, critical)
- **Message:** Clear explanation of error (avoid technical jargon)
- **Guidance:** What to do next
- **Actions:** "Retry" (primary), "Save Draft" (secondary), "Contact Support" (tertiary)

**Example:**
```
┌─────────────────────────────────────────┐
│         ⚠ Submission Failed              │
│                                         │
│ Your checklist could not be submitted   │
│ due to a server error.                  │
│                                         │
│ Your data has been saved locally.       │
│                                         │
│ [Retry]  [Save Draft]  [Contact Support]│
└─────────────────────────────────────────┘
```

**Data Safety:**
- **Auto-save:** Data saved locally (offline storage) before retry
- **No data loss:** User does not lose work on failure
- **Clear wording:** "Your data has been saved locally" (not "lost")

**Retry Logic:**
- Allow manual retry
- Consider auto-retry with exponential backoff (max 3 attempts)
- If all retries fail, prompt user to save draft and contact support

**Accessibility:**
- role="alert"
- Error announced
- Focus on Retry button (primary action)

**Bilingual:**
- All text in Sinhala and English

**Business Rules Required:**
- Define retry policy
- Define support contact
- Define data retention for failed submissions

---

## Sync Conflict Pattern

### Purpose
Display when offline data conflicts with server data during sync.

### Pattern Specification

**Trigger:**
- Operator edits record offline
- Meanwhile, supervisor or another user edits same record online
- Sync attempt detects conflict

**Visual Design:**
- **Icon:** Alert (32px, warning color)
- **Heading:** "Sync Conflict" (18-20px, bold, warning)
- **Message:** Clear explanation ("This record was edited by another user while you were offline")
- **Options:**
  - "Keep My Changes" (overwrite server)
  - "Use Server Version" (discard local)
  - "Review Both" (show side-by-side comparison)
- **Default:** No auto-resolution; require user choice

**Example:**
```
┌─────────────────────────────────────────┐
│         ⚠ Sync Conflict                  │
│                                         │
│ This record was edited by [User] while  │
│ you were offline.                       │
│                                         │
│ Choose which version to keep:           │
│                                         │
│ Your Version:                           │
│ • Submitted: 2 hours ago                │
│ • 10 items complete                     │
│                                         │
│ Server Version:                         │
│ • Edited by: Supervisor Jane            │
│ • Edited: 1 hour ago                    │
│ • 10 items complete, 1 amended          │
│                                         │
│ [Keep My Changes]  [Use Server Version] │
│ [Review Both]                           │
└─────────────────────────────────────────┘
```

**Resolution:**
- **Keep My Changes:** Overwrites server (requires confirmation and audit log)
- **Use Server Version:** Discards local changes (requires confirmation)
- **Review Both:** Shows side-by-side comparison, user chooses field-by-field (if feasible)

**Logging:**
- Log conflict event and resolution choice for audit

**Accessibility:**
- role="alert"
- Conflict details readable
- All options keyboard navigable

**Business Rules Required:**
- Define conflict resolution policy
- Define who can resolve conflicts (operator, supervisor, admin)
- Define audit logging for conflict resolution

**Evidence Required:**
- Business owner approval of conflict resolution rules

---

## Evidence Upload Failure Pattern

### Purpose
Display when photo or file upload fails.

### Pattern Specification

**Trigger:**
- Network error during upload
- Server rejects file (too large, wrong format, etc.)
- Timeout

**Visual Design:**
- **Icon:** Alert (24px, critical)
- **File name:** Display failed file
- **Message:** Clear error ("Upload failed: Network error")
- **Action:** "Retry" (primary), "Remove" (secondary)

**Example:**
```
┌─────────────────────────────────────────┐
│ Evidence Upload                         │
│ ┌────────┐  Evidence-001.jpg            │
│ │   ⚠    │  Upload failed: Network error│
│ │ [Err]  │  [Retry]  [Remove]           │
│ └────────┘                              │
└─────────────────────────────────────────┘
```

**Behavior:**
- **Retry:** Re-attempts upload
- **Remove:** Removes file from queue (requires confirmation if evidence is mandatory)
- **Auto-retry:** Consider auto-retry (1-2 attempts) before showing error

**Data Retention:**
- Keep file in local storage until successfully uploaded or explicitly removed
- Do not lose file on failure

**Accessibility:**
- Error announced
- Focus on Retry button

**Bilingual:**
- Error messages in Sinhala and English

---

## Session Expired Pattern

### Purpose
Display when user session expires due to inactivity or timeout.

### Pattern Specification

**Trigger:**
- Session timeout (per security policy)
- User inactive for extended period
- Token expires

**Visual Design:**
- **Icon:** Clock or alert (32px, warning)
- **Heading:** "Session Expired" (18-20px, bold)
- **Message:** "Your session has expired due to inactivity. Please log in again."
- **Action:** "Log In" (primary)

**Example:**
```
┌─────────────────────────────────────────┐
│         ⏱ Session Expired                │
│                                         │
│ Your session has expired due to         │
│ inactivity. Please log in again.        │
│                                         │
│ Any unsaved changes have been saved     │
│ locally and will be restored when you   │
│ log back in.                            │
│                                         │
│ [Log In]                                │
└─────────────────────────────────────────┘
```

**Data Safety:**
- **Auto-save:** Save draft locally before session expires (if possible)
- **Restore:** Restore draft when user logs back in
- **Clear message:** "Unsaved changes saved locally"

**Security:**
- Do not allow any actions without re-authentication
- Clear sensitive data from memory on session expiry
- Log session expiry event

**Accessibility:**
- role="alert"
- Focus on Log In button

**Business Rules Required:**
- Define session timeout duration
- Define auto-save behavior before expiry

**Evidence Required:**
- Security policy approval of timeout duration

---

## Offline Mode Entry Pattern

### Purpose
Notify operator when going offline and explain implications.

### Pattern Specification

**Trigger:**
- Network connection lost (detected by browser or app)
- Server unreachable

**Visual Design:**
- **Banner:** Full-width, sticky top, warning color background
- **Icon:** Cloud with slash (20-24px, warning)
- **Message:** "You are offline. Changes will be saved locally and synced when you are back online."
- **No dismiss:** Persistent until online

**Example:**
```
┌─────────────────────────────────────────┐
│ ☁✗ You are offline. Changes will be     │ ← Sticky banner (warning color)
│    saved locally and synced when online. │
└─────────────────────────────────────────┘

[Rest of page below]
```

**Behavior:**
- **Auto-save:** All changes saved to local storage (IndexedDB or similar)
- **Queue:** Submissions queued for sync when online
- **Clear wording:** Distinguish "saved locally" from "submitted to server"

**Online Transition:**
- **Banner:** Changes to "Coming online... syncing"
- **Sync:** Auto-sync queued data
- **Confirmation:** "Synced. Data submitted to server."
- **Banner:** Hides after sync complete

**Accessibility:**
- role="alert" on appearance
- Offline status announced once
- Persistent (cannot be dismissed)

**Bilingual:**
- Message in Sinhala and English

**Evidence Required:**
- Technical architecture approval of offline sync mechanism

---

## Maintenance Mode Pattern

### Purpose
Display when system is under maintenance and unavailable.

### Pattern Specification

**Trigger:**
- Scheduled maintenance window
- Emergency maintenance
- Server returns 503 status

**Visual Design:**
- **Full-page overlay:** Cannot access application
- **Icon:** Wrench or tools (64px, info color)
- **Heading:** "System Maintenance" (24px, bold)
- **Message:** "The system is currently undergoing maintenance. Please try again later."
- **Time estimate:** "Expected completion: [time]" (if known)
- **Contact:** "For urgent issues, contact: [contact]"

**Example:**
```
┌─────────────────────────────────────────┐
│                                         │
│         🔧 System Maintenance            │
│                                         │
│ The system is currently undergoing      │
│ maintenance. Please try again later.    │
│                                         │
│ Expected completion: 3:00 PM            │ ← If known
│                                         │
│ For urgent issues, contact:             │
│ [SUPPORT CONTACT]                       │
│                                         │
│ [Retry]  [Close]                        │
└─────────────────────────────────────────┘
```

**Behavior:**
- **Retry:** Checks if maintenance is complete
- **Auto-retry:** Optional auto-retry every 5-10 minutes (with clear indicator)

**Accessibility:**
- role="alert"
- Message announced
- Focus on Retry button

**Bilingual:**
- All text in Sinhala and English

**Business Rules Required:**
- Define maintenance notification procedure
- Define support contact for urgent issues

---

## Approval and Governance

All critical state patterns are **proposed** and subject to:

- **Business rule validation:** Blocking conditions, escalation workflows, override procedures
- **Compliance review:** Food safety, quality assurance, legal requirements
- **Security review:** Access control, session management, audit logging
- **Usability testing:** Operator comprehension of critical messages

**Approval Status:** Pending business owner, compliance, and security approval.

**Evidence Required:**
- Business owner approval of all blocking conditions and workflows
- Compliance/safety team approval of critical thresholds and escalation
- Security policy approval of session timeout, account lockout, audit logging
- Legal review of audit trail and conflict resolution

---

## Cross-References

- **COMPONENT_CATALOGUE.md:** Component specifications
- **COMPONENT_ANATOMY_AND_STATES.md:** Detailed component states
- **OPERATOR_COMPONENT_PATTERNS.md:** Operator workflow patterns
- **SECURITY_BASELINE.md:** Security requirements
- **AI_SAFETY_POLICY.md:** AI assistance constraints (no AI final decisions for critical states)

---

## Document History

| Version | Date       | Author         | Changes                                  |
|---------|------------|----------------|------------------------------------------|
| 1.0     | 2026-08-04 | System         | Initial critical state patterns creation |

---

**End of Critical State Patterns**

**Note:** This document describes proposed patterns only. Actual implementation requires business rule approval, compliance review, and security validation. Do NOT implement without approval.
