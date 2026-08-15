# Component Anatomy and States

**Document Status:** Proposed  
**Approval Status:** Pending design review  
**Last Updated:** 2026-08-04  
**Cross-references:** COMPONENT_CATALOGUE.md, DESIGN_TOKENS.md, FIGMA_TOKENS_COMPONENTS_SPEC.md

## Purpose

This document provides detailed anatomical breakdowns and comprehensive state matrices for key UI components. Each component includes:

- **Anatomy Diagram:** Visual or textual breakdown of component structure
- **State Matrix:** All possible states with visual and behavioral specifications
- **Token Mapping:** Specific design tokens used in each state

**Important:** All specifications are proposed pending stakeholder review. No business rules or operational limits are assumed.

---

## Button

### Anatomy

```
┌─────────────────────────────────────────┐
│  ┌───┐                                   │
│  │   │  Label Text                       │  ← Container
│  │ i │  (14-16px, Inter, semibold)      │
│  └───┘                                   │
│  Icon  Padding: 12px horizontal          │
│ (20px) Padding: 12px vertical            │
│         Min height: 48px                 │
└─────────────────────────────────────────┘
   ← Border radius: 8px (proposed)
```

**Parts:**
1. Container: Full clickable area (≥48px height)
2. Icon (optional): Leading, 20px, aligned center
3. Label: Text, 14-16px, semibold
4. Focus ring: 2px offset outline (keyboard focus)

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Default** | Background: primary green<br>Text: white<br>Border: none | Cursor: pointer<br>Interactive | `color.semantic.action.primary`<br>`color.semantic.text.on-action`<br>`radius.medium`<br>`size.touch.operator` |
| **Hover** | Background: darker green<br>Text: white<br>Subtle shadow increase | Cursor: pointer<br>Indicates interactivity | `color.semantic.action.primary-hover`<br>`elevation.hover` |
| **Focus** | Background: primary green<br>Focus ring: 2px primary color, 2px offset<br>Text: white | Keyboard navigable<br>Visible focus | `color.semantic.focus-ring`<br>`border.focus.width`<br>`border.focus.offset` |
| **Pressed/Active** | Background: darker green (same as hover)<br>Subtle shadow decrease<br>Text: white | Visual feedback on click | `color.semantic.action.primary-hover`<br>`elevation.pressed` |
| **Disabled** | Background: gray<br>Text: gray (lower contrast)<br>Opacity: 0.5-0.6 | Cursor: not-allowed<br>Non-interactive<br>Not focusable | `color.semantic.action.disabled`<br>`color.semantic.text.disabled`<br>`opacity.disabled` |
| **Loading** | Background: primary green<br>Text: white (or hidden)<br>Spinner: white, centered | Cursor: wait<br>Non-interactive while loading<br>aria-busy="true" | `color.semantic.action.primary`<br>`motion.spinner` |

### Variants

**Primary Button:** As above

**Secondary Button:**
- Default: Background transparent or light gray, Border 1px solid, Text primary green
- Hover: Background soft green, Border primary green
- Focus: Focus ring + border
- Disabled: Border gray, Text gray

**Tertiary Button:**
- Default: Background transparent, Text primary green or text secondary color
- Hover: Text underline (optional), Background very soft green
- Focus: Focus ring only
- Disabled: Text gray

**Destructive Button:**
- Default: Background critical red, Text white
- Hover: Background darker red
- Focus: Focus ring red
- Disabled: Same as primary disabled

**Icon Button:**
- Container: 48×48px minimum
- Icon: 24px (larger than inline icon)
- Background: optional (transparent or surface)
- Hover: Background soft color or shadow
- Focus: Focus ring
- Disabled: Icon gray, opacity reduced

---

## Text Input

### Anatomy

```
┌─────────────────────────────────────────┐
│ Label (14px, medium)                     │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │  Input text (16px, regular)          │ │
│ │  Placeholder (16px, lighter gray)    │ │  ← Input container
│ └──────────────────────────────────────┘ │     Height: 48-56px
│   ↑ Border: 1px solid                    │     Padding: 12px
│                                          │
│ Hint text (12px, gray)                   │
└─────────────────────────────────────────┘
```

**Parts:**
1. Label: Above or floating, 14px, medium weight
2. Input container: Border 1px, height 48-56px (operator-optimized)
3. Input text: 16px, regular, primary text color
4. Placeholder: 16px, light gray (example text only)
5. Hint text: Below, 12px, secondary text color
6. Optional icons: Leading or trailing (20px), inside container
7. Error message: Replaces hint when error state

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Default (Empty)** | Border: light gray<br>Background: white<br>Placeholder: visible, light gray | Cursor: text<br>Not focused | `color.semantic.input.border`<br>`color.semantic.input.background`<br>`color.semantic.text.placeholder`<br>`size.input.height-operator` |
| **Focus** | Border: primary green (2px)<br>Background: white<br>Placeholder: hidden or lighter<br>Focus ring: optional outer glow | Cursor: text<br>Keyboard input active | `color.semantic.input.border-focus`<br>`border.input.focus-width`<br>`color.semantic.focus-ring` |
| **Filled** | Border: light gray<br>Background: white<br>Text: primary color | Cursor: text<br>Value present | `color.semantic.text.primary`<br>`color.semantic.input.background` |
| **Error** | Border: critical red (2px)<br>Background: white or very light red tint<br>Error message: red text below field<br>Error icon: red, trailing or inline | Cursor: text<br>aria-invalid="true"<br>Error announced | `color.semantic.input.error-border`<br>`color.semantic.status.critical`<br>`border.input.error-width` |
| **Disabled** | Border: light gray (dashed or lighter)<br>Background: light gray<br>Text: gray<br>Placeholder: gray | Cursor: not-allowed<br>Not focusable<br>Not editable | `color.semantic.input.disabled-background`<br>`color.semantic.text.disabled`<br>`opacity.disabled` |
| **Read-only** | Border: light gray or none<br>Background: very light gray or white<br>Text: primary color<br>No focus ring | Cursor: default or text (for copy)<br>Not editable<br>Focusable for reading | `color.semantic.input.readonly-background`<br>`color.semantic.text.primary` |

### Variants

**Password Input:**
- Trailing icon: Eye icon (show/hide toggle)
- Toggle button: 48×48px touch target
- Show state: Input type changes to text
- Hide state: Input type password, dots visible

**Employee Code Input:**
- Trailing icon: Scan icon (if scanning supported)
- Format: Uppercase, alphanumeric
- Validation: Format and existence check

**Search Input:**
- Leading icon: Search icon (20px)
- Trailing icon: Clear X (when filled)
- No border (or subtle), often in toolbar

**Number Input:**
- Type: number or inputmode="numeric"
- Optional steppers: +/− buttons, 48px touch targets
- Alignment: Right-aligned for numeric values (optional)

---

## Temperature Input

### Anatomy

```
┌─────────────────────────────────────────┐
│ Label: "Temperature" / "උෂ්ණත්වය"       │
│ (from checklist template)                │
│                                          │
│ ┌──────────────────────┬───────────────┐ │
│ │  Input value         │  °C (or °F)   │ │  ← Input + Unit
│ │  (16px, right-align) │  (read-only)  │ │     Height: 56px
│ └──────────────────────┴───────────────┘ │
│   ↑ Border: 1px solid                    │
│                                          │
│ Hint: "Expected: [range — EVIDENCE REQUIRED]" (if defined)    │
│ (from template, DECISION REQUIRED)       │
└─────────────────────────────────────────┘
```

**Parts:**
1. Label: From checklist template, includes location/item context
2. Input container: Height 56px (operator-optimized)
3. Value input: Numeric, 16px, right-aligned, inputmode="decimal"
4. Unit indicator: °C or °F, read-only, from template, 14px, gray background
5. Hint text: Expected range (if defined in template), 12px, secondary color
6. Optional: Probe/scan icon (if equipment supported)
7. Warning indicator: If out-of-range (from template), warning color

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Default (Empty)** | Border: light gray<br>Background: white<br>Unit: visible, gray background<br>Placeholder: "0.0" (example) | Cursor: text<br>Numeric keyboard (mobile)<br>Not focused | `color.semantic.input.border`<br>`color.semantic.input.background`<br>`size.input.height-operator`<br>`color.semantic.text.secondary` (unit) |
| **Focus** | Border: primary green (2px)<br>Background: white<br>Unit: visible<br>Focus ring: optional outer glow | Cursor: text<br>Numeric keyboard active<br>Decimal allowed | `color.semantic.input.border-focus`<br>`border.input.focus-width` |
| **Filled (In Range)** | Border: light gray<br>Background: white<br>Value: primary color, right-aligned<br>Unit: visible<br>Hint: expected range shown (if defined) | Cursor: text<br>Value present<br>Within expected range | `color.semantic.text.primary`<br>`color.semantic.text.secondary` (hint) |
| **Filled (Out of Range)** | Border: warning orange (NOT critical red)<br>Background: very light orange tint<br>Value: primary color<br>Warning icon: orange, trailing<br>Warning message: "Outside expected range" (if range defined) | Cursor: text<br>Value present but out of range<br>Warning announced<br>NOT blocking (operator can proceed) | `color.semantic.status.warning`<br>`color.semantic.input.warning-border`<br>`color.semantic.background.warning-soft`<br>**Note:** Warning color NOT AA for body text; use large text or darken if needed |
| **Error (Invalid Format)** | Border: critical red (2px)<br>Background: white or light red tint<br>Error message: "Invalid format" | Cursor: text<br>aria-invalid="true"<br>Cannot submit until corrected | `color.semantic.input.error-border`<br>`color.semantic.status.critical` |
| **Disabled** | Border: light gray (lighter)<br>Background: light gray<br>Value and unit: gray | Cursor: not-allowed<br>Not focusable<br>Not editable | `color.semantic.input.disabled-background`<br>`color.semantic.text.disabled`<br>`opacity.disabled` |
| **Read-only** | Border: light gray or none<br>Background: very light gray<br>Value and unit: primary color | Cursor: default<br>Not editable<br>Focusable for reading | `color.semantic.input.readonly-background`<br>`color.semantic.text.primary` |

### Important Notes

- **Unit from template:** Unit (°C or °F) is fixed per checklist template configuration, not user-selectable in this input.
- **Expected range from template:** If range is defined in template (e.g., "[range — EVIDENCE REQUIRED]"), display as hint. If not defined, show no range (DECISION REQUIRED for each checklist item).
- **Out-of-range is warning, not error:** Operator can record any value. Out-of-range triggers workflow (escalation, failure recording) per business rules (EVIDENCE REQUIRED), but does NOT block input submission.
- **Do NOT invent ranges:** Display only ranges provided by checklist template configuration.
- **Decimal precision:** Typically 1 decimal place (0.0), but configurable per template.

### Variants

**With Probe/Scan:**
- Trailing icon: Thermometer or scan icon (48×48px touch target)
- Trigger: Opens probe/scanner interface
- Auto-fill: Value auto-populates from probe
- Manual override: Operator can edit probe value if needed

**With Multiple Locations:**
- Each location has separate temperature input
- Labels distinguish locations (e.g., "Product Core Temp", "Storage Temp")
- Each input has own expected range (if defined)

---

## Pass/Fail Control

### Anatomy

```
┌─────────────────────────────────────────┐
│         Pass/Fail Segmented Control      │
├─────────────────────┬───────────────────┤
│    ✓  Pass          │    ✗  Fail        │  ← Two segments
│    ප්‍රමාණවත්        │    අසමත්          │     Height: 56px
│    (Green bg)       │    (Red bg)       │     Equal width
└─────────────────────┴───────────────────┘
      Selected              Unselected
```

**Parts:**
1. Container: Full width, height 56px (operator-optimized)
2. Pass segment: Left, icon (checkmark) + text, green when selected
3. Fail segment: Right, icon (X) + text, red when selected
4. Border: 2px, between segments and outer
5. Icons: 20-24px, inline with text
6. Text: 16-18px, semibold, Sinhala and English

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Unselected (Both)** | Both segments: Background light gray<br>Both segments: Text gray<br>Both segments: Icons gray outline<br>Border: light gray | Cursor: pointer<br>Touch target ≥56px<br>No selection | `color.semantic.input.border`<br>`color.semantic.background.control-unselected`<br>`color.semantic.text.secondary` |
| **Pass Selected** | Pass segment: Background success green<br>Pass segment: Text white<br>Pass segment: Icon white checkmark (filled)<br>Fail segment: Background light gray, Text gray | Cursor: pointer<br>Pass selected, announced<br>Fail deselected<br>Can deselect to return to unanswered | `color.semantic.status.success`<br>`color.semantic.text.on-success`<br>`size.touch.operator-large` |
| **Fail Selected** | Fail segment: Background critical red<br>Fail segment: Text white<br>Fail segment: Icon white X (filled)<br>Pass segment: Background light gray, Text gray | Cursor: pointer<br>Fail selected, announced<br>Pass deselected<br>Triggers failure details entry | `color.semantic.status.critical`<br>`color.semantic.text.on-critical`<br>`size.touch.operator-large` |
| **Focus (Keyboard)** | Focused segment: Focus ring 2px<br>Background unchanged | Keyboard navigable<br>Arrow keys to toggle<br>Space/Enter to select | `color.semantic.focus-ring`<br>`border.focus.width` |
| **Disabled** | Both segments: Background very light gray<br>Both segments: Text gray<br>Both segments: Icons gray<br>Opacity: 0.5 | Cursor: not-allowed<br>Not focusable<br>Not interactive | `color.semantic.input.disabled-background`<br>`color.semantic.text.disabled`<br>`opacity.disabled` |

### Interaction Notes

- **Selection:** Tap/click segment to select
- **Deselection:** Tap selected segment again to deselect (return to unanswered state) - DECISION REQUIRED for this behavior
- **Fail selection triggers failure details:** When Fail selected, system prompts for failure details (separate component)
- **Keyboard:** Tab to focus, Arrow keys to switch between segments, Space/Enter to select/deselect
- **Touch target:** Full 56px height, full half-width for each segment (≥56px in all cases)
- **Status without color:** Icons (checkmark, X) and text provide non-color indication

---

## Task Card

### Anatomy

```
┌─────────────────────────────────────────┐
│ ┌─────┐  Task Title (16-18px, bold)     │  ← Container
│ │     │  Context: Location, Product      │     Min height: 96px
│ │ [i] │  Due: 2 hours ago                │     Padding: 16px
│ │     │  Status: Overdue ⬤              │     Full card tappable
│ └─────┘                                  │
│  Icon                                    │
└─────────────────────────────────────────┘
   ← Border: 1px, rounded corners
   ← Shadow: subtle elevation
```

**Parts:**
1. Container: Full card, tappable, min height 96px
2. Icon/Thumbnail: Left, 48×48px, task type or product image
3. Title: 16-18px, bold, primary color, max 2 lines with ellipsis
4. Context info: 14px, secondary color, location/product/time
5. Status badge: Inline, colored dot + text (New, In Progress, Overdue)
6. Due time: Relative or absolute time
7. Border and shadow: 1px border, subtle elevation

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Default** | Border: light gray<br>Background: white<br>Shadow: subtle elevation<br>Title: primary color<br>Context: secondary color | Cursor: pointer<br>Full card tappable<br>Tap to open task detail | `color.semantic.surface.card`<br>`elevation.card`<br>`spacing.card.padding`<br>`color.semantic.text.primary`<br>`color.semantic.text.secondary` |
| **Hover (Desktop)** | Border: primary green (optional)<br>Shadow: slightly increased<br>Background: very light tint (optional) | Cursor: pointer<br>Indicates interactivity | `elevation.card-hover`<br>`color.semantic.action.primary` (border) |
| **Pressed (Mobile)** | Background: light gray tint<br>Shadow: slightly decreased<br>Border: unchanged | Visual feedback on tap<br>Momentary | `color.semantic.background.pressed`<br>`elevation.pressed` |
| **Selected** | Border: primary green (2px)<br>Background: very light green tint<br>Shadow: unchanged or increased | Card selected (if multi-select)<br>Checkmark or indicator visible | `color.semantic.action.primary`<br>`color.semantic.background.selected` |
| **Overdue** | Border: warning orange or critical red (depending on severity)<br>Status badge: Overdue, red or orange<br>Due time: red or orange<br>Background: white or very light warning tint | Cursor: pointer<br>Visual priority<br>Tap to open | `color.semantic.status.warning` or `color.semantic.status.critical`<br>`color.semantic.background.warning-soft` |
| **In Progress** | Status badge: In Progress, blue or primary<br>Optional: Progress bar at bottom (if quantifiable) | Cursor: pointer<br>Indicates active work | `color.semantic.status.info`<br>`color.semantic.action.primary` |

### Variants

**New Task:**
- Status badge: "New", neutral or info color
- No special border or background

**Overdue Task:**
- Border and status: Warning or critical color
- Due time: Bold and colored

**In Progress Task:**
- Status badge: "In Progress", info or primary color
- Optional progress indicator (e.g., "3/10 items complete")

**Completed Task (if shown in history):**
- Status badge: "Complete", success color
- Border: light gray
- Background: white or very light gray (less prominent)

---

## Checklist Item

### Anatomy

```
┌─────────────────────────────────────────┐
│ Item Label (14-16px, medium)             │  ← Container
│ Expected: [hint from template]           │     Min height: 64px
│                                          │     Padding: 12px
│ ┌───────────────────────────────────┐   │     Full width
│ │  Answer Control (input/control)   │   │
│ │  (Pass/Fail, Input, etc.)         │   │
│ └───────────────────────────────────┘   │
│                                          │
│ ⚠ Status: Incomplete / ✓ Pass / ✗ Fail  │
└─────────────────────────────────────────┘
```

**Parts:**
1. Container: Full width, min height 64px (depends on control)
2. Item label: From checklist template, 14-16px, medium weight
3. Hint text: Expected value or range (if defined in template), 12px, secondary color
4. Answer control: Pass/Fail control, input field, etc. (varies by item type)
5. Status indicator: Icon + text, inline or trailing (Incomplete, Pass, Fail)
6. Optional: Evidence attachment trigger (if failure or evidence required)

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Unanswered** | Border: light gray (subtle)<br>Background: white<br>Status: Incomplete icon (circle or warning), gray or orange<br>Label: primary color<br>Answer control: default state | Cursor: pointer on control<br>Status announced: "Incomplete"<br>Scrollable to jump to next incomplete | `color.semantic.surface.item`<br>`color.semantic.text.primary`<br>`color.semantic.status.warning` (incomplete indicator)<br>`spacing.item.padding` |
| **Answered (Pass)** | Border: light gray<br>Background: white or very light green tint<br>Status: Pass icon (checkmark), success green<br>Label: primary color<br>Answer control: filled, pass selected | Cursor: default or pointer (if editable)<br>Status announced: "Pass"<br>Answer recorded | `color.semantic.status.success`<br>`color.semantic.background.success-soft` (optional tint) |
| **Answered (Fail)** | Border: critical red or warning<br>Background: white or very light red tint<br>Status: Fail icon (X), critical red<br>Label: primary color<br>Answer control: filled, fail selected<br>Failure details: visible or expandable<br>Evidence: prompt or attached | Cursor: pointer (expand details)<br>Status announced: "Fail"<br>Failure details required<br>Evidence encouraged | `color.semantic.status.critical`<br>`color.semantic.background.critical-soft` (optional tint)<br>`border.item.fail` |
| **Error (Invalid)** | Border: critical red<br>Background: white or light red tint<br>Error message: below control, red text | Cursor: pointer on control<br>Error announced<br>Cannot proceed until corrected | `color.semantic.input.error-border`<br>`color.semantic.status.critical` |
| **Disabled** | Border: light gray (lighter)<br>Background: light gray<br>Label: gray<br>Answer control: disabled | Cursor: not-allowed<br>Not focusable<br>Not editable | `color.semantic.input.disabled-background`<br>`color.semantic.text.disabled`<br>`opacity.disabled` |
| **Read-only (Review)** | Border: light gray or none<br>Background: white or very light gray<br>Label: primary color<br>Answer control: read-only, value visible<br>Status: visible<br>Timestamp and operator: visible | Cursor: default<br>Not editable<br>Focusable for reading<br>Answer value displayed | `color.semantic.input.readonly-background`<br>`color.semantic.text.primary`<br>`color.semantic.text.secondary` (metadata) |

### Item Type Variants

**Pass/Fail Item:**
- Answer control: Pass/Fail segmented control (56px height)
- States: Unanswered, Pass, Fail

**Measurement Item (e.g., Temperature):**
- Answer control: Temperature input (56px height)
- States: Unanswered, Filled (in range), Filled (out of range warning), Error (invalid)

**Observation Item (Text):**
- Answer control: Text area
- States: Unanswered, Filled

---

## Status Badge

### Anatomy

```
┌──────────────────┐
│  ⬤  Status Text  │  ← Container: inline-block
│                  │     Height: auto (padding)
└──────────────────┘     Padding: 4px 8px
   ↑   ↑                 Border radius: 4px
   │   └─ Text (12-14px, medium)
   └─ Optional icon (8-10px dot or 16px icon)
```

**Parts:**
1. Container: Inline-block, padding 4px 8px, border radius 4px
2. Optional icon: Dot (8-10px) or icon (16px), left of text
3. Text: 12-14px, medium weight, uppercase or title case
4. Background: Semantic color, soft tint
5. Border: Optional, 1px, same semantic color (slightly darker)

### State Matrix

Status badges are typically static (non-interactive), but may have hover states if clickable.

| Variant | Visual Specification | Tokens |
|---------|---------------------|---------|
| **Success** | Background: light green tint<br>Text: success green (dark enough for contrast)<br>Border: success green (optional)<br>Icon: checkmark or dot, success green | `color.semantic.status.success`<br>`color.semantic.background.success-soft`<br>`color.semantic.border.success` |
| **Warning** | Background: light orange tint<br>Text: warning orange (VERIFY AA contrast - may need to darken)<br>Border: warning orange (optional)<br>Icon: alert or dot, warning orange | `color.semantic.status.warning`<br>`color.semantic.background.warning-soft`<br>**Note:** Warning color #B76E00 NOT AA for body text - use large text or darken |
| **Critical/Error** | Background: light red tint<br>Text: critical red (dark enough for contrast)<br>Border: critical red (optional)<br>Icon: X or alert, critical red | `color.semantic.status.critical`<br>`color.semantic.background.critical-soft`<br>`color.semantic.border.critical` |
| **Info** | Background: light blue tint<br>Text: info blue (dark enough for contrast)<br>Border: info blue (optional)<br>Icon: i or dot, info blue | `color.semantic.status.info`<br>`color.semantic.background.info-soft`<br>`color.semantic.border.info` |
| **Neutral** | Background: light gray tint<br>Text: text secondary color<br>Border: light gray (optional)<br>Icon: dot or icon, gray | `color.semantic.status.neutral`<br>`color.semantic.background.neutral-soft`<br>`color.semantic.text.secondary` |

### Interactive Badge (if clickable)

If badge is clickable (e.g., to filter or view details):

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Default** | As per variant above | Non-interactive | (Variant tokens) |
| **Hover** | Background: slightly darker tint<br>Border: darker (if present)<br>Cursor: pointer | Indicates interactivity | `elevation.hover` (optional shadow) |
| **Focus** | Focus ring: 2px, semantic color<br>Background: unchanged | Keyboard navigable | `color.semantic.focus-ring` |
| **Pressed** | Background: darker tint<br>Shadow: none or subtle | Visual feedback | (Variant tokens, darkened) |

---

## Critical Alert Banner

### Anatomy

```
┌─────────────────────────────────────────┐
│  ⚠  Critical / Error                     │  ← Container
│                                          │     Full width
│  Message text explaining the issue.      │     Padding: 16px
│  Guidance on what to do next.           │     Border: 4px left
│                                          │
│  [Retry]  [Contact Support]              │  ← Action buttons
└─────────────────────────────────────────┘
```

**Parts:**
1. Container: Full width, padding 16px, border-left 4px critical color
2. Icon: Large alert icon (24-32px), critical color, left aligned
3. Heading: "Error" or specific heading, 16-18px, bold, critical color
4. Message: 14-16px, primary text, clear explanation and guidance
5. Action buttons: Primary and/or secondary buttons (Retry, Contact Support, Dismiss)
6. Close button: × icon, top right (optional, if dismissible)
7. Background: Light red tint or white

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Visible** | Background: very light red tint or white<br>Border-left: 4px critical red<br>Icon: critical red<br>Heading: critical red<br>Message: primary text<br>Buttons: visible and enabled | role="alert" announced<br>Focus on heading or first action<br>Not dismissible until action taken (typically) | `color.semantic.status.critical`<br>`color.semantic.background.critical-soft`<br>`border.alert.width`<br>`spacing.banner.padding` |
| **Action Hover** | Action button: hover state (per button specs) | Cursor: pointer on buttons | (Button tokens) |
| **Dismissed** | Banner hidden<br>Removed from DOM or display:none | No longer visible<br>Alert condition resolved or acknowledged | N/A |

### Variants

**Blocking Error (No Dismiss):**
- No close button
- User must take action (Retry, Cancel, Contact Support)
- Persistent until resolved

**Dismissible Error:**
- Close button (×) in top right
- User can dismiss (at their own risk)
- May reappear if condition persists

**With Action:**
- Retry button: primary or secondary
- Contact Support button: secondary or tertiary
- Cancel button: tertiary

**Simple (No Action):**
- Message only, no buttons
- May have close button

---

## Offline Banner

### Anatomy

```
┌─────────────────────────────────────────┐
│  ☁✗  You are offline                     │  ← Container
│                                          │     Full width
│  Changes will be saved locally and       │     Padding: 12px
│  synced when you are back online.       │     Sticky top
│                                          │     No dismiss
└─────────────────────────────────────────┘
```

**Parts:**
1. Container: Full width, padding 12px, sticky top position
2. Icon: Cloud with slash or offline icon (20-24px), warning color
3. Message: 14px, clear explanation of offline status and data safety
4. Background: Light orange or yellow tint (warning soft)
5. Border: Optional, 1px top and bottom, warning color
6. No dismiss button: Persistent until online

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Offline** | Background: light orange/yellow tint<br>Icon: cloud with slash, warning color<br>Message: "You are offline. Changes will be saved locally and synced when online."<br>Border: warning color (optional) | role="alert" on appearance<br>Announced once<br>Persistent (no dismiss)<br>Sticky at top<br>Visible until online | `color.semantic.status.warning`<br>`color.semantic.background.warning-soft`<br>`spacing.banner.padding`<br>**Note:** Warning color NOT AA for body text - ensure message text is primary or darkened |
| **Syncing (coming online)** | Icon changes to syncing spinner<br>Message: "Coming online... syncing changes" | Indicates sync in progress<br>Announced | `motion.spinner`<br>`color.semantic.status.info` (optional) |
| **Online** | Banner hidden<br>Removed from view | No longer visible<br>User is online | N/A |

### Important Notes

- **Persistent:** Cannot be dismissed while offline
- **Data safety wording:** Carefully worded to avoid confusion between "saved locally" (not yet on server) and "submitted" (on server)
- **Sticky:** Remains visible at top of viewport while offline
- **Offline detection:** Triggered by navigator.onLine API or network request failure

---

## Sync Status Indicator

### Anatomy

```
┌──────────────────────┐
│  ↻  Syncing...       │  ← Inline indicator
└──────────────────────┘     Or in status bar

┌──────────────────────┐
│  ✓  Synced           │  ← Synced state
│  Last: 2 min ago     │
└──────────────────────┘

┌──────────────────────┐
│  ⚠  Sync Failed      │  ← Failed state
│  [Retry]             │
└──────────────────────┘
```

**Parts:**
1. Icon: Syncing (spinner), Synced (checkmark), Failed (alert)
2. Text: "Syncing...", "Synced", "Sync Failed"
3. Timestamp: "Last synced [time ago]" (for Synced state)
4. Retry button: For Failed state
5. Container: Inline or in bottom/top bar

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Synced** | Icon: checkmark, success green<br>Text: "Synced", success green<br>Timestamp: "Last synced X min ago", secondary color | aria-live="polite" announced<br>Indicates data is up-to-date | `color.semantic.status.success`<br>`color.semantic.text.secondary` (timestamp) |
| **Syncing** | Icon: spinner, rotating, warning orange or info blue<br>Text: "Syncing...", warning or info<br>Timestamp: hidden | aria-live="polite" announced<br>Indicates sync in progress<br>Spinner animates | `color.semantic.status.warning` or `color.semantic.status.info`<br>`motion.spinner` |
| **Sync Failed** | Icon: alert, critical red<br>Text: "Sync Failed", critical red<br>Retry button: visible, secondary or primary<br>Timestamp: "Last attempted X min ago" | aria-live="polite" announced<br>Indicates sync error<br>Retry action available | `color.semantic.status.critical`<br>`color.semantic.text.secondary` (timestamp) |

### Placement

- **Bottom bar (mobile):** Inline with other status indicators
- **Top bar (desktop):** Inline or as badge
- **Form footer:** Below form, above submit button

---

## Modal

### Anatomy

```
┌─────────────────────────────────────────┐  ← Backdrop
│                                          │     (semi-transparent)
│   ┌──────────────────────────────────┐  │
│   │  Heading             [×]         │  │  ← Modal container
│   │                                  │  │     Max-width: 600px
│   │  Content area                    │  │     Padding: 24px
│   │  ...                             │  │     Centered
│   │                                  │  │     Elevation: high
│   │  [Cancel]    [Primary Action]   │  │
│   └──────────────────────────────────┘  │
│                                          │
└─────────────────────────────────────────┘
```

**Parts:**
1. Backdrop: Full viewport, semi-transparent dark gray, behind modal
2. Modal container: Centered, max-width 600px (medium), padding 24px
3. Heading: 18-20px, bold, top of modal
4. Close button: × icon, top right, 48×48px touch target
5. Content area: Scrollable if long, padding
6. Action buttons: Bottom, right-aligned (desktop) or stacked full-width (mobile)
7. Border radius: 8-12px
8. Elevation: High shadow

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Open** | Backdrop: visible, rgba(0,0,0,0.5)<br>Modal: visible, centered, elevated<br>Focus: on heading or first interactive element | role="dialog" or role="alertdialog"<br>aria-modal="true"<br>Focus trap active<br>Escape key closes (if non-critical)<br>Backdrop click closes (if non-critical) | `color.semantic.backdrop`<br>`color.semantic.surface.modal`<br>`elevation.modal`<br>`spacing.modal.padding`<br>`radius.large` |
| **Closed** | Backdrop: hidden<br>Modal: hidden<br>Focus: returned to trigger element | Not visible<br>Focus restored to element that opened modal | N/A |
| **Opening (animation)** | Backdrop: fades in (0.2s)<br>Modal: scales up from 95% to 100% (0.2s) | Animation in progress<br>Not interactive until open | `motion.fade-in`<br>`motion.scale-up` |
| **Closing (animation)** | Backdrop: fades out (0.15s)<br>Modal: scales down to 95% (0.15s) | Animation in progress<br>Not interactive | `motion.fade-out`<br>`motion.scale-down` |

### Variants

**Small Modal (Confirmation):**
- Max-width: 400px
- Content: Brief message
- Actions: Cancel + Confirm

**Medium Modal (Default):**
- Max-width: 600px
- Content: Form or details
- Actions: Cancel + Primary

**Large Modal:**
- Max-width: 800px or 90vw
- Content: Complex form or multi-section
- May have tabs or sections

**Full-screen (Mobile):**
- Width: 100vw, Height: 100vh
- Padding adjusted for mobile
- Close button top left or right
- Actions sticky at bottom

---

## Bottom Sheet (Mobile)

### Anatomy

```
Mobile viewport
┌─────────────────────────────────────────┐
│  Main content (dimmed)                   │  ← Backdrop
│                                          │
│  ╭────────────────────────────────────╮ │  ← Handle bar
│  │  ──  (drag handle)                  │ │  ← Bottom sheet
│  │                                      │ │     Slides from bottom
│  │  Heading                             │ │     Padding: 24px
│  │                                      │ │     Rounded top corners
│  │  Content area                        │ │
│  │  ...                                 │ │
│  │                                      │ │
│  │  [Cancel]    [Primary Action]       │ │
│  ╰────────────────────────────────────╯ │
└─────────────────────────────────────────┘
```

**Parts:**
1. Backdrop: Main content visible but dimmed
2. Bottom sheet container: Slides from bottom, rounded top corners (16px radius)
3. Handle bar: Centered, draggable indicator (40px wide, 4px tall), top 8px margin
4. Heading: 18px, bold, below handle
5. Content area: Scrollable if tall, padding 24px
6. Action buttons: Bottom, full width stacked or inline
7. Initial height: Partial (50-70% viewport) or full-screen

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Closed** | Bottom sheet: below viewport<br>Backdrop: hidden<br>Main content: not dimmed | Not visible<br>Focus on main content | N/A |
| **Opening (animation)** | Bottom sheet: slides up from bottom (0.3s ease-out)<br>Backdrop: fades in (0.3s) | Animation in progress<br>Not interactive until open | `motion.slide-up`<br>`motion.fade-in` |
| **Open (partial)** | Bottom sheet: visible at 50-70% viewport height<br>Backdrop: visible, dimmed<br>Handle bar: visible<br>Focus: on heading or first interactive element | role="dialog"<br>aria-modal="true"<br>Focus trap active<br>Swipe down to close<br>Backdrop tap to close | `color.semantic.backdrop`<br>`color.semantic.surface.modal`<br>`elevation.bottom-sheet`<br>`radius.top-large` |
| **Open (full)** | Bottom sheet: full viewport height<br>Backdrop: visible, dimmed<br>Handle bar: visible | Same as Open (partial)<br>Can swipe down to partial or close | (Same tokens) |
| **Dragging** | Bottom sheet: follows finger/cursor<br>Can drag up to expand or down to dismiss | Interactive dragging<br>Threshold to dismiss (e.g., 50% down) | (Same tokens) |
| **Closing (animation)** | Bottom sheet: slides down out of view (0.25s ease-in)<br>Backdrop: fades out (0.25s) | Animation in progress<br>Not interactive | `motion.slide-down`<br>`motion.fade-out` |

### Important Notes

- **Mobile only:** Bottom sheet is mobile-optimized (< 768px); use modal on desktop
- **Draggable:** Handle bar and entire sheet can be dragged down to dismiss
- **Partial vs Full:** Initial height depends on content; can be expanded by user
- **Safe area:** Account for iOS safe area at bottom (padding-bottom)

---

## Evidence Card

### Anatomy

```
┌────────────────────────────────────────┐
│  ┌──────────────┐  Evidence-001.jpg    │  ← Container
│  │              │  Uploaded: 2h ago     │     Padding: 12px
│  │   [Image]    │  By: Operator Name    │     Border: 1px
│  │  Thumbnail   │                       │     Elevation: subtle
│  │              │  [View]  [Remove]     │
│  └──────────────┘                       │
└────────────────────────────────────────┘
```

**Parts:**
1. Container: Border 1px, padding 12px, subtle elevation
2. Thumbnail: Left, 80×80px (photo) or icon (file), rounded corners
3. File name: 14px, bold, top right
4. Timestamp: 12px, secondary color, "Uploaded [time ago]"
5. Operator: 12px, secondary color, "By: [name]"
6. View button: Secondary or tertiary, opens lightbox or new tab
7. Remove button: Tertiary or icon (if editable), destructive confirmation required

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Default** | Border: light gray<br>Background: white<br>Thumbnail: visible<br>Actions: View and Remove (if editable) | Cursor: default<br>View action opens full image/file<br>Remove action deletes (with confirmation) | `color.semantic.surface.card`<br>`elevation.card`<br>`spacing.card.padding`<br>`radius.medium` |
| **Hover (Desktop)** | Border: primary green (optional)<br>Shadow: slightly increased<br>Actions: highlighted on hover | Cursor: pointer on actions<br>Indicates interactivity | `elevation.card-hover` |
| **Uploading** | Thumbnail: placeholder or spinner<br>File name: grayed or "Uploading..."<br>Progress bar: below thumbnail<br>Actions: disabled or hidden | Upload in progress<br>Not interactive<br>aria-busy="true" | `motion.spinner`<br>`color.semantic.action.primary` (progress) |
| **Error** | Border: critical red<br>Thumbnail: error icon<br>File name: "Upload failed"<br>Retry button: visible | Upload failed<br>Retry action available | `color.semantic.status.critical`<br>`color.semantic.input.error-border` |
| **Read-only** | Border: light gray<br>Background: white or very light gray<br>Actions: View only (no Remove) | Cursor: default<br>Cannot delete (data integrity)<br>View action available | `color.semantic.input.readonly-background` |

### Variants

**Photo Evidence:**
- Thumbnail: Actual photo preview (80×80px)
- View action: Opens lightbox with full image
- Remove action: Available before submit only

**File Evidence:**
- Thumbnail: File icon (PDF, DOC, etc.) with file extension
- View action: Opens file in new tab or downloads
- Remove action: Available before submit only

---

## Review Queue Item

### Anatomy

```
┌────────────────────────────────────────┐
│  FG-2024-001234  ⬤ Pending Review      │  ← Container
│  Operator: John Doe                     │     Min height: 80px
│  Submitted: 3 hours ago                 │     Padding: 16px
│  Priority: Normal                       │     Full card tappable
│                                         │     Border: 1px
└────────────────────────────────────────┘
```

**Parts:**
1. Container: Full card, tappable, min height 80px, border 1px
2. Record identifier: Top left, 16px, bold, primary color
3. Status badge: Top right, inline, colored (Pending Review, Flagged, etc.)
4. Operator: 14px, secondary color, "Operator: [name]"
5. Timestamp: 14px, secondary color, "Submitted: [time ago]"
6. Priority: 14px, optional, "Priority: [High/Normal/Low]"
7. Optional: Flag icon (if flagged/critical)

### State Matrix

| State | Visual Changes | Behavior | Tokens |
|-------|---------------|----------|---------|
| **Default** | Border: light gray<br>Background: white<br>Identifier: primary color<br>Status: neutral or info badge | Cursor: pointer<br>Full card tappable<br>Tap to open review detail | `color.semantic.surface.card`<br>`elevation.card`<br>`spacing.card.padding`<br>`color.semantic.text.primary`<br>`color.semantic.text.secondary` |
| **Hover (Desktop)** | Border: primary green (optional)<br>Shadow: slightly increased | Cursor: pointer<br>Indicates interactivity | `elevation.card-hover` |
| **Pressed (Mobile)** | Background: light gray tint<br>Shadow: slightly decreased | Visual feedback on tap<br>Momentary | `color.semantic.background.pressed` |
| **Flagged/Critical** | Border: critical red or warning orange (2px)<br>Flag icon: visible, critical or warning color<br>Status badge: "Flagged" or "Critical", critical color<br>Background: white or very light red/orange tint | Cursor: pointer<br>Visual priority<br>Indicates requires urgent review | `color.semantic.status.critical` or `color.semantic.status.warning`<br>`color.semantic.background.critical-soft` (optional tint) |
| **Selected** | Border: primary green (2px)<br>Background: very light green tint<br>Checkmark: visible (if multi-select) | Selected for batch action (if applicable)<br>Checkmark indicator | `color.semantic.action.primary`<br>`color.semantic.background.selected` |

### Variants

**Pending Review:**
- Status badge: "Pending Review", info or neutral
- No special border

**Flagged/Critical:**
- Border: Critical or warning color
- Flag icon visible
- Status badge: "Flagged" or "Critical"

**Overdue:**
- Border: Warning color
- Timestamp: Bold and warning color
- Status badge: "Overdue"

---

## Approval and Governance

All component anatomy and state specifications are **proposed** and subject to review and approval by:

- **Design Owner:** OWNER REQUIRED
- **Development Lead:** OWNER REQUIRED
- **Accessibility Reviewer:** OWNER REQUIRED
- **Operator Usability Tester:** OWNER REQUIRED

**Approval Status:** Pending design review, stakeholder approval, and usability testing.

**Evidence Required:**
- WCAG 2.1 AA compliance validation (especially contrast ratios)
- Operator usability testing (Sinhala language, gloves, touch targets, etc.)
- Development feasibility review
- Token system validation

---

## Cross-References

- **COMPONENT_CATALOGUE.md:** Full component descriptions and usage guidelines
- **DESIGN_TOKENS.md:** Semantic token definitions
- **ACCESSIBILITY_AND_USABILITY.md:** WCAG requirements and usability guidelines
- **FIGMA_TOKENS_COMPONENTS_SPEC.md:** Figma-specific implementation
- **OPERATOR_COMPONENT_PATTERNS.md:** (to be created) Operator workflow patterns
- **CRITICAL_STATE_PATTERNS.md:** (to be created) Critical failure and error patterns

---

## Document History

| Version | Date       | Author         | Changes                               |
|---------|------------|----------------|---------------------------------------|
| 1.0     | 2026-08-04 | System         | Initial anatomy and states creation   |

---

**End of Component Anatomy and States**
