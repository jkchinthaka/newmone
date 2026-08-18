# Operator Component Patterns

**Document Status:** Proposed  
**Approval Status:** Pending design review and operator usability testing  
**Last Updated:** 2026-08-04  
**Cross-references:** COMPONENT_CATALOGUE.md, COMPONENT_ANATOMY_AND_STATES.md, ACCESSIBILITY_AND_USABILITY.md

## Purpose

This document describes proposed interaction patterns for operator-facing components in mobile-first checklist workflows. These patterns optimize for:

- **Speed:** Faster than paper in normal use
- **Touch:** Large targets (48-56px), one-handed operation, glove compatibility
- **Minimal typing:** Progressive disclosure, defaults, scan/select over type
- **Bilingual:** Sinhala and English throughout
- **Offline-first:** Local save with server sync
- **Clear status:** Progress, incomplete, failed items always visible

**Important:** All patterns are proposed pending operator usability testing. No business rules, workflows, or data are invented.

---

## Core Operator Workflow Pattern

### Mark All Acceptable → Modify Exceptions → Review → Attest → Submit

This is the proposed primary pattern for operator checklist completion:

1. **Mark All Acceptable (optional fast path):**
   - Operator reviews physical checklist
   - If all items are acceptable, select "Mark All Pass" action
   - System pre-fills all Pass/Fail controls with "Pass"
   - Operator proceeds to Review step
   - **Decision Required:** Confirm this fast-path pattern is acceptable per business rules

2. **Modify Exceptions:**
   - If "Mark All Pass" used, operator jumps to any exceptions and changes to "Fail"
   - If not used, operator proceeds item by item
   - For failed items, capture failure details and evidence
   - For measurements, enter values (keyboard or probe)

3. **Review:**
   - System shows summary of answers: incomplete, passed, failed
   - Operator reviews and confirms all items answered
   - Jump to incomplete or failed items for correction

4. **Attest:**
   - Operator confirms accuracy via attestation panel
   - Checkbox or signature (Decision Required)
   - Cannot proceed without attestation

5. **Submit:**
   - System attempts server submission
   - If offline, saves locally and queues for sync
   - Confirmation shows "Submitted" (online) or "Saved locally, will sync" (offline)

**Key Principle:** Minimize operator friction. Assume normal conditions first (all pass), then handle exceptions.

**Evidence Required:** Validate this workflow matches actual operator habits and regulatory requirements.

---

## Mobile Task Card Pattern

### Purpose
Display individual operator tasks in "My Tasks" list, optimized for quick scanning and selection.

### Pattern Specification

**Visual Layout:**
- Card height: min 96px
- Full-width on mobile
- Large touch target: entire card tappable (≥96px height)
- Clear visual hierarchy: Title (bold, 16-18px) > Context > Status

**Content Priority:**
1. **Task title:** What needs to be done (e.g., "Hourly Cold Storage Check")
2. **Location context:** Where (e.g., "Cold Storage A")
3. **Product context:** What (if applicable, e.g., "Product: Batch #12345")
4. **Time context:** When/overdue (e.g., "Due 10 min ago" in red if overdue)
5. **Status badge:** Visual indicator (New, In Progress, Overdue)

**Interaction:**
- **Tap card:** Opens checklist
- **Swipe (optional):** Quick actions (e.g., swipe left to defer, Decision Required)
- **Sort/Filter:** By due time, location, status
- **Pull to refresh:** Updates task list

**Bilingual:**
- Task title in Sinhala (primary) and English (secondary), or Sinhala only if space constrained
- Location and product names as per system data

**Example:**
```
┌─────────────────────────────────────────┐
│ පැය පැය සීතල ගබඩා පරීක්ෂණය              │ (Title, Sinhala)
│ Hourly Cold Storage Check                │ (Title, English)
│ සීතල ගබඩාව A                             │ (Location, Sinhala)
│ Due: 10 min ago  ⬤ Overdue               │ (Time, Status)
└─────────────────────────────────────────┘
   ← Full card tap opens checklist
```

**Accessibility:**
- Full card is link or button
- Status announced by screen reader
- Focus visible on full card
- Overdue status clear without color alone (text + icon)

---

## Large Touch Target Pattern

### Purpose
Ensure all operator controls meet minimum 48px touch targets, optimized for 48-56px for primary actions.

### Pattern Specification

**Minimum Touch Targets:**
- General controls: 48×48px (WCAG 2.1 AAA)
- Operator primary actions: 48-56px (proposed, larger for factory floor)
- Pass/Fail control: 56px height (large, critical decision)
- Buttons: Min 48px height, full width on mobile
- Icon buttons: 48×48px (icon + padding)

**Spacing:**
- Minimum spacing between adjacent touch targets: 8px
- Preferred spacing: 12-16px to reduce accidental taps

**Visual vs Touch Area:**
- Visual button may be smaller (e.g., 40px)
- Touch area must be ≥48px (use padding or pseudo-element)
- Entire card or list item as touch target (e.g., 96px task card)

**Glove Compatibility (if applicable):**
- Test with gloves if operators wear them (Decision Required: confirm glove use)
- Increase targets to 56-64px if glove use confirmed

**Examples:**
- Primary button: Visual 44px height + 2px padding top/bottom = 48px touch
- Pass/Fail control: 56px height for each segment
- Task card: 96px height, full width, entire card tappable

**Accessibility:**
- Touch targets announced clearly
- Focus visible on entire touch area
- No overlapping touch areas

---

## Sinhala + English Bilingual Pattern

### Purpose
Support Sinhala (primary for operators) and English throughout operator interfaces.

### Pattern Specification

**Language Priority:**
- **Operator-facing content:** Sinhala primary, English secondary or omitted if space constrained
- **Supervisory/admin content:** English primary

**Display Strategies:**

1. **Both languages (spacious views):**
   - Sinhala first (larger or bold)
   - English below (smaller or regular)
   - Example: Task title shows both

2. **Sinhala only (compact views):**
   - Use Sinhala only if space limited
   - English available in detail view or tooltip

3. **Icon + Text:**
   - Icons universal (e.g., checkmark, X)
   - Text labels in Sinhala and English if space allows
   - Tooltip in English for desktop users

**Font Requirements:**
- **Sinhala:** Noto Sans Sinhala (Google Fonts)
- **English:** Inter (Google Fonts)
- Both fonts loaded and specified in font stack
- Test wrapping and line height with Sinhala text

**Examples:**
- Button label: "ඉදිරිපත් කරන්න" (Sinhala) / "Submit" (English)
- Pass/Fail control: "ප්‍රමාණවත්" (Pass) / "අසමත්" (Fail)
- Field label: "උෂ්ණත්වය" (Temperature) with English in hint or omitted

**Accessibility:**
- Screen reader support for Sinhala (test with NVDA/JAWS/TalkBack)
- Language attribute set correctly (lang="si" for Sinhala, lang="en" for English)

**Evidence Required:**
- Operator language preference survey
- Sinhala translations reviewed by Sinhala-speaking operators
- Usability testing with Sinhala interface

---

## Progress Indicator Pattern

### Purpose
Show checklist completion progress clearly and persistently during task completion.

### Pattern Specification

**Visual Design:**
- **Position:** Sticky at top or bottom of checklist (bottom preferred for mobile one-handed reach)
- **Format:** Progress bar + text fraction (e.g., "7 of 10 complete")
- **Height:** 56-64px (touch-optimized for potential interactions)
- **Background:** Distinct color (surface or soft primary tint)

**Progress Calculation:**
- Total items: All checklist items
- Complete items: Items with answers (Pass, Fail, or measurements entered)
- Incomplete items: Unanswered items
- Failed items: Separate count highlighted in critical color

**Content:**
- Primary: "7 of 10 complete" (Sinhala and English)
- Secondary: "2 failed" (if any failures, critical color)
- Visual: Progress bar (0-100%, primary color fill)

**Interaction:**
- **Tap progress bar (optional):** Jump to next incomplete item (Decision Required)
- **Tap "X failed":** Jump to next failed item for review

**Bilingual:**
- Sinhala: "7 න් 10 සම්පූර්ණයි" or similar
- English: "7 of 10 complete"

**Example:**
```
┌─────────────────────────────────────────┐
│ ████████░░░░░░░░ 70%                    │ (Progress bar)
│ 7 of 10 complete  |  2 failed ⚠        │ (Text, critical icon)
└─────────────────────────────────────────┘
   ← Sticky at bottom, persistent
```

**Accessibility:**
- aria-valuenow="7", aria-valuemin="0", aria-valuemax="10"
- Status announced on change
- Failure count announced separately

---

## Jump to Incomplete/Failed Pattern

### Purpose
Allow operator to quickly navigate to next incomplete or failed item without scrolling through entire checklist.

### Pattern Specification

**Entry Points:**
1. **Review screen:** List of incomplete and failed items with jump links
2. **Progress indicator:** Tap "X incomplete" or "X failed" to jump
3. **Floating action button (FAB):** "Next Incomplete" button (optional)

**Jump Behavior:**
- **Scroll to target item:** Smooth scroll, item centered in viewport
- **Focus on control:** Focus moves to the answer control (input or Pass/Fail)
- **Highlight target:** Brief highlight or pulse animation on target item

**Example Interaction:**
1. Operator completes items 1-7
2. Taps progress indicator: "3 incomplete"
3. System scrolls to item 8 (first incomplete), focuses on answer control
4. Operator answers item 8
5. Operator taps "Next Incomplete" (if provided) or continues scrolling
6. System jumps to item 11 (next incomplete)

**Accessibility:**
- Keyboard: Shortcut key or button to jump (e.g., "n" for next)
- Screen reader: Announces jump destination ("Navigated to item 8: Temperature check")

**Bilingual:**
- Button label: "ඊළඟ අසම්පූර්ණ" (Next Incomplete) / "Next Incomplete"

---

## Progressive Disclosure Pattern

### Purpose
Show only essential information by default; reveal details on demand to reduce cognitive load and scrolling.

### Pattern Specification

**Application Areas:**

1. **Checklist Sections:**
   - Default: All sections expanded (or first section expanded, rest collapsed)
   - Collapsed section: Heading + completion count (e.g., "Section A: 5 of 5 complete ✓")
   - Tap to expand/collapse
   - Auto-expand section with incomplete or failed items

2. **Failure Details:**
   - Default: Failure indicator visible, details collapsed
   - Tap to expand details (reason, description, evidence)
   - Auto-expand on edit

3. **Item Hints:**
   - Default: Label visible, hint collapsed (if long)
   - Tap "i" icon or label to show hint
   - Auto-show hint on focus (if short)

4. **Advanced Options:**
   - Default: Simple form (common fields only)
   - "More options" link reveals advanced fields (if applicable)

**Interaction:**
- **Expand/Collapse:** Clear affordance (chevron icon, "Show/Hide" text)
- **Auto-expand:** Sections or items with errors or incomplete answers auto-expand
- **Persistent state:** Collapsed/expanded state maintained during session

**Example:**
```
Collapsed:
┌─────────────────────────────────────────┐
│ ▸ Temperature Checks (3 of 5 complete)  │ ← Tap to expand
└─────────────────────────────────────────┘

Expanded:
┌─────────────────────────────────────────┐
│ ▾ Temperature Checks (3 of 5 complete)  │ ← Tap to collapse
│   1. Cold Storage A ✓                   │
│   2. Cold Storage B ✓                   │
│   3. Freezer A (incomplete)             │
│   4. Freezer B ✓                        │
│   5. Loading Bay (incomplete)           │
└─────────────────────────────────────────┘
```

**Accessibility:**
- aria-expanded on toggle button
- Keyboard: Enter/Space to toggle
- Screen reader announces expanded/collapsed state

---

## Numeric Entry Pattern (Temperature, Count, etc.)

### Purpose
Optimize numeric input for speed and accuracy on mobile.

### Pattern Specification

**Input Type:**
- Type: "number" or inputmode="numeric" (mobile numeric keyboard)
- Decimal: inputmode="decimal" for measurements with decimals (e.g., temperature)
- Integer: inputmode="numeric" for counts

**Input Method:**
1. **Keyboard (default):** Numeric keyboard on mobile
2. **Stepper buttons (optional):** +/− buttons for small adjustments (48px touch targets)
3. **Probe/Scan (if applicable):** Scan value from digital thermometer or equipment

**Formatting:**
- Right-aligned for numbers (optional, for better readability)
- Decimal precision: 1 decimal place for temperature (e.g., [value] [unit from template])
- Thousand separators: Not needed for typical values (< 1000)

**Validation:**
- Format validation: Numeric only, decimal if allowed
- Range validation: If expected range defined in template, show warning if out of range (NOT blocking error)
- Real-time validation: On blur or after pause (debounce)

**Example (Temperature):**
```
┌─────────────────────────────────────────┐
│ උෂ්ණත්වය | Temperature                  │ (Label, bilingual)
│ ┌────────────────────┬─────────────────┐ │
│ │       2.5          │  °C             │ │ (Input, right-aligned + unit)
│ └────────────────────┴─────────────────┘ │
│ Expected: [range — EVIDENCE REQUIRED]                         │ (Hint, from template)
└─────────────────────────────────────────┘
```

**Accessibility:**
- Label associated with input
- Expected range announced as hint
- Out-of-range warning announced (not error)

**Probe Integration (if applicable):**
- Button: "Use Probe" or scan icon (48×48px)
- Trigger: Opens probe interface or Bluetooth connection
- Auto-fill: Value populates input
- Manual override: Operator can edit probe value
- Fallback: If probe fails, operator enters manually

---

## Photo Evidence Pattern

### Purpose
Capture and attach photo evidence quickly and easily on mobile.

### Pattern Specification

**Trigger:**
- **Button:** "Add Photo" button, camera icon, 48-56px height, full width on mobile
- **Position:** Below failure details or as part of checklist item
- **Bilingual:** "ඡායාරූපය එක් කරන්න" / "Add Photo"

**Capture Flow:**
1. Operator taps "Add Photo"
2. System requests camera permission (if not granted)
3. Camera opens (native or in-app)
4. Operator takes photo
5. Photo preview shown with Retake / Use Photo actions
6. Photo added to evidence list
7. Operator can add more photos or continue

**Upload:**
- **Online:** Upload immediately to server (background)
- **Offline:** Save locally, queue for sync when online
- **Progress:** Show upload progress (spinner or progress bar)
- **Error:** Show error + retry action

**Evidence List:**
- Show thumbnails (80×80px) of all attached photos
- Filename or timestamp as label
- Remove action (before submit only)
- View action: Opens full-size preview (lightbox)

**Accessibility:**
- Button labeled clearly
- Camera permission explained
- Photo preview has alt text (e.g., "Evidence photo 1")
- Remove button labeled

**Example:**
```
┌─────────────────────────────────────────┐
│ Evidence                                 │
│ ┌────────┐  ┌────────┐  ┌────────┐     │
│ │ [Img1] │  │ [Img2] │  │  [+]   │     │ (Thumbnails + add)
│ └────────┘  └────────┘  └────────┘     │
│   View        View       Add Photo      │
│                                         │
│ [Add Photo Button - Full Width]        │
└─────────────────────────────────────────┘
```

**Evidence Required:**
- Confirm camera access is acceptable per security policy
- Confirm photo storage and retention requirements

---

## Sticky Bottom Bar Pattern

### Purpose
Keep critical actions (e.g., Submit, Save Draft) visible and accessible while scrolling through long checklist.

### Pattern Specification

**Position:**
- Fixed at bottom of viewport
- Above mobile bottom navigation (if present)
- Z-index: High (above content)

**Content:**
- Primary action button: "Submit" or "Continue" (full width or prominent)
- Secondary action: "Save Draft" (if applicable, secondary button or link)
- Optional: Progress indicator (compact, e.g., "7/10")

**Appearance:**
- Background: Surface color or white
- Border-top: 1px, light gray (visual separation from content)
- Shadow: Subtle top shadow (elevation)
- Padding: 12-16px
- Height: Auto (button height + padding)

**Behavior:**
- Persistent: Always visible while scrolling
- Safe area: Account for iOS bottom safe area (padding-bottom)
- Button state: Enabled when ready (e.g., all items answered), disabled otherwise

**Example:**
```
Scrollable content above
...

┌─────────────────────────────────────────┐  ← Sticky bottom bar
│ 7 of 10 complete                         │
│ [Submit Button - Full Width]            │  ← Primary action
│ Save Draft                               │  ← Secondary action (link)
└─────────────────────────────────────────┘
```

**Accessibility:**
- Focus trap: When keyboard navigating, ensure focus can reach sticky buttons
- Announce: Button state changes announced (enabled/disabled)

**Bilingual:**
- Submit: "ඉදිරිපත් කරන්න" / "Submit"
- Save Draft: "කෙටුම්පත සුරකින්න" / "Save Draft"

---

## Local Save vs Server Submit Wording Pattern

### Purpose
Clearly distinguish between local save (offline) and server submission (online) to avoid operator confusion.

### Pattern Specification

**Critical Principle:**
- **"Save" / "Saved":** Local only, not yet on server, will sync later
- **"Submit" / "Submitted":** Sent to server, confirmed by server
- **Never confuse the two:** Operator must understand the difference

**Wording Guidelines:**

| State | Wording | Explanation |
|-------|---------|-------------|
| **Offline, local save** | "Saved locally. Will sync when online." | Clear that data is only on device |
| **Online, submitting** | "Submitting..." | Action in progress |
| **Online, submitted** | "Submitted successfully." | Confirmed by server |
| **Offline, queued** | "Saved locally. Queued for sync." | Waiting for connection |
| **Syncing** | "Syncing..." | Uploading to server |
| **Synced** | "Synced. Submitted to server." | Both local and server have data |

**UI Indicators:**
- **Offline banner:** Persistent at top, "You are offline. Changes saved locally."
- **Submit button:** 
  - Offline: "Save Locally" or "Save (Offline)"
  - Online: "Submit"
- **Confirmation:**
  - Offline: "Saved locally. Will sync when online."
  - Online: "Submitted successfully."

**Sync Status:**
- Show sync status indicator (checkmark, spinner, alert) separately from submit confirmation
- Update status when sync completes

**Example (Offline):**
```
┌─────────────────────────────────────────┐
│ ☁✗ You are offline. Changes saved       │ ← Banner
│     locally and will sync when online.   │
└─────────────────────────────────────────┘

Operator completes checklist, taps:
[Save Locally]  ← Button label offline

Confirmation:
✓ Saved locally. Will sync when online.
```

**Example (Online):**
```
No offline banner

Operator completes checklist, taps:
[Submit]  ← Button label online

Confirmation:
✓ Submitted successfully.
```

**Bilingual:**
- Save Locally: "දේශීයව සුරකින්න" / "Save Locally"
- Submit: "ඉදිරිපත් කරන්න" / "Submit"
- Saved locally: "දේශීයව සුරකින ලදී" / "Saved locally"
- Submitted: "ඉදිරිපත් කරන ලදී" / "Submitted"

**Evidence Required:**
- Operator usability testing to confirm wording clarity
- Legal/compliance review of wording for audit trail

---

## One-Handed Mobile Operation Pattern

### Purpose
Optimize for one-handed operation on mobile, especially for operators who may hold products or equipment while recording.

### Pattern Specification

**Design Considerations:**

1. **Thumb Zone Optimization:**
   - Primary actions in bottom half of screen (easy thumb reach)
   - Secondary actions in top half (two-handed or shift grip)
   - Avoid critical actions in top corners (hardest to reach)

2. **Bottom Navigation:**
   - Navigation bar at bottom (not top)
   - Primary tabs within thumb reach

3. **Sticky Actions:**
   - Submit button in sticky bottom bar (thumb reach)
   - Floating action button (FAB) at bottom right (thumb reach)

4. **Large Targets:**
   - 48-56px minimum (larger than desktop)
   - Full-width buttons (easier to hit)

5. **Scroll Direction:**
   - Vertical scroll primary (natural thumb swipe)
   - Avoid horizontal scroll (harder one-handed)

**Thumb Reach Zones (Approx for right-handed):**
- **Easy (green zone):** Bottom 1/3 of screen, center to right
- **Moderate (yellow zone):** Middle 1/3 of screen
- **Hard (red zone):** Top 1/3 of screen, top left corner

**Example Layout:**
```
┌─────────────────────────────────────────┐
│ Top Bar (passive info, not actions)     │ ← Hard to reach
│                                         │
│ Scrollable Content                      │ ← Moderate reach
│ (Checklist items)                       │
│                                         │
│                                         │
│ [Submit - Full Width Button]           │ ← Easy reach (thumb)
└─────────────────────────────────────────┘
     └─ Bottom bar: easy thumb reach
```

**Testing:**
- Test with device sizes: small (5.4"), medium (6.1"), large (6.7")
- Test right-handed and left-handed use
- Test with gloves (if applicable)

**Evidence Required:**
- Operator device survey (device sizes, dominant hand)
- Usability testing with one-handed scenarios

---

## Glove Compatibility Pattern (If Applicable)

### Purpose
Ensure UI is usable with gloves if operators wear them on factory floor.

### Pattern Specification

**Decision Required:** Confirm if operators wear gloves during recording. If yes, apply these patterns:

**Touch Target Sizes:**
- Increase minimum from 48px to 56-64px
- Especially for critical actions (Pass/Fail, Submit)

**Gesture Simplification:**
- Avoid complex gestures (multi-touch, pinch, precise swipes)
- Use simple taps and single-finger swipes

**Visual Feedback:**
- Increase hover/press feedback (larger highlight area)
- Longer press duration before action (avoid accidental taps)

**Testing:**
- Test with actual gloves used by operators
- Test in factory floor conditions (lighting, noise, etc.)

**Alternative Input:**
- Provide scan/probe options where possible (reduce typing)
- Voice input (if feasible and accurate)

**Evidence Required:**
- Confirm glove use with operators
- Glove type and thickness
- Usability testing with gloves

---

## Minimal Typing Pattern

### Purpose
Minimize text entry to maximize speed and reduce errors on mobile.

### Pattern Specification

**Strategies:**

1. **Scan Over Type:**
   - Barcode/QR scan for employee codes, product codes, batch numbers
   - Provide manual entry fallback only

2. **Select Over Type:**
   - Dropdowns or radio buttons for predefined options (reason for failure, corrective actions)
   - Avoid free-text fields unless truly necessary

3. **Default Values:**
   - Pre-fill fields where possible (e.g., current date/time, operator from login)
   - Operator confirms or edits

4. **Numeric Keypad:**
   - Use numeric input for numbers (temperature, counts)
   - Mobile numeric keyboard faster than full keyboard

5. **Probe/Equipment Integration:**
   - Auto-populate temperature from digital thermometer
   - Manual override if probe unavailable

6. **Voice Input (Optional):**
   - Voice-to-text for notes/comments (if feasible)
   - Requires testing for accuracy in factory environment

7. **Short Text Fields:**
   - If text required, use short fields with character limits
   - Provide examples or templates

**Example:**
```
Instead of:
┌─────────────────────────────────────────┐
│ Employee Code: [________________]       │ ← Typing
└─────────────────────────────────────────┘

Use:
┌─────────────────────────────────────────┐
│ Employee Code:                          │
│ [Scan Badge]  or  [Enter Manually]     │ ← Scan first
└─────────────────────────────────────────┘

Instead of:
┌─────────────────────────────────────────┐
│ Failure Reason: [__________________]    │ ← Free text
└─────────────────────────────────────────┘

Use:
┌─────────────────────────────────────────┐
│ Failure Reason:                         │
│ ( ) Temperature out of range            │
│ ( ) Equipment malfunction               │ ← Select
│ ( ) Product defect                      │
│ ( ) Other: [____________]               │ ← Type only if Other
└─────────────────────────────────────────┘
```

**Accessibility:**
- Scan buttons labeled clearly
- Select options keyboard navigable
- Voice input (if used) with manual correction

**Evidence Required:**
- Operator feedback on common text entry pain points
- Business rules for failure reasons, corrective actions (do not invent)

---

## Approval and Governance

All operator component patterns are **proposed** and subject to:

- **Operator usability testing:** With actual operators, on factory floor, in Sinhala
- **Business rule validation:** Workflows, attestation, data capture requirements
- **Accessibility review:** WCAG compliance, screen reader support
- **Technical feasibility:** Development, offline sync, device compatibility

**Approval Status:** Pending usability testing and stakeholder approval.

**Evidence Required:**
- Operator usability test results
- Business owner approval of workflows
- Accessibility audit
- Technical architecture review

---

## Cross-References

- **COMPONENT_CATALOGUE.md:** Component specifications
- **COMPONENT_ANATOMY_AND_STATES.md:** Detailed component states
- **ACCESSIBILITY_AND_USABILITY.md:** WCAG requirements
- **CRITICAL_STATE_PATTERNS.md:** (to be created) Critical failure patterns
- **WORKFLOW_STATE_MAP.md:** Business workflow definitions

---

## Document History

| Version | Date       | Author         | Changes                                  |
|---------|------------|----------------|------------------------------------------|
| 1.0     | 2026-08-04 | System         | Initial operator patterns creation       |

---

**End of Operator Component Patterns**

**Note:** This document does NOT implement any patterns. It describes proposed patterns for design and development reference only.
