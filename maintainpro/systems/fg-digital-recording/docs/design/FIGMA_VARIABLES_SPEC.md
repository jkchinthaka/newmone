# Figma Variables Specification

**Document Status:** Proposed  
**Approval Status:** Pending design review and Figma implementation  
**Last Updated:** 2026-08-04  
**Cross-references:** DESIGN_TOKENS.md, FIGMA_TOKENS_COMPONENTS_SPEC.md, FIGMA_COMPONENT_BUILD_GUIDE.md

## Purpose

This document specifies the exact proposed Figma variable collections, variables, and values for the Nelna FG Digital Recording System design file. These variables enable:

- **Consistency:** Reusable values across all designs
- **Maintainability:** Change once, update everywhere
- **Semantic naming:** Purpose-based naming (not appearance-based)
- **Light mode only:** Single mode (no dark mode in initial scope)

**Important:** All variables are proposed pending design review and approval. Values are based on approved color palette and typography specifications.

---

## Figma Variable Collections

Figma variables are organized into **collections**. Each collection groups related variables.

### Proposed Collections

1. **Colour Primitives**
2. **Colour Semantic**
3. **Typography**
4. **Spacing and Sizing**
5. **Radius and Border**
6. **Elevation**
7. **Motion**
8. **Component Dimensions**

---

## Collection 1: Colour Primitives

**Purpose:** Base color values (hex codes) that do not change. Primitives are referenced by semantic variables.

**Type:** Color

| Variable Name | Value | Description | Approval Status |
|---------------|-------|-------------|-----------------|
| `colour/primitive/green/900` | #18572C | Primary green hover (darkest) | Approved |
| `colour/primitive/green/700` | #216E39 | Primary green (approved) | Approved |
| `colour/primitive/green/100` | #E8F4EB | Primary green soft (approved) | Approved |
| `colour/primitive/gold/700` | #C7A94B | Gold decorative (approved) | Approved |
| `colour/primitive/gold/100` | #F8F2DD | Gold soft (approved) | Approved |
| `colour/primitive/gray/900` | #17211A | Text primary (approved) | Approved |
| `colour/primitive/gray/700` | #5C685F | Text secondary (approved) | Approved |
| `colour/primitive/gray/300` | #DDE4DF | Border light (approved) | Approved |
| `colour/primitive/gray/100` | #F6F8F6 | App background (approved) | Approved |
| `colour/primitive/white` | #FFFFFF | Surface white (approved) | Approved |
| `colour/primitive/success/700` | #237A45 | Success green (approved) | Approved |
| `colour/primitive/success/100` | #E8F7ED | Success soft | Proposed |
| `colour/primitive/warning/700` | #B76E00 | Warning orange (approved, NOT AA for body text) | Approved |
| `colour/primitive/warning/100` | #FFF4E5 | Warning soft | Proposed |
| `colour/primitive/critical/700` | #C93434 | Critical red (approved) | Approved |
| `colour/primitive/critical/100` | #FDEAEA | Critical soft | Proposed |
| `colour/primitive/info/700` | #2563A8 | Info blue (approved) | Approved |
| `colour/primitive/info/100` | #E8F1F9 | Info soft | Proposed |

**Notes:**
- Soft tints (100 values) are proposed for backgrounds; confirm with design team.
- Warning color #B76E00 is NOT AA compliant for normal body text on white; use for large text only or darken if needed for body text.

**Naming Convention:**
- `colour/primitive/[family]/[weight]`
- Weight: 100 (lightest), 300, 700, 900 (darkest)

---

## Collection 2: Colour Semantic

**Purpose:** Purpose-based color variables that reference primitives. Semantic variables define meaning (e.g., "action primary"), not appearance.

**Type:** Color

### Action Colors

| Variable Name | Value (References Primitive) | Description | Approval Status |
|---------------|------------------------------|-------------|-----------------|
| `colour/semantic/action/primary` | `colour/primitive/green/700` | Primary action buttons, links, selected states | Approved |
| `colour/semantic/action/primary-hover` | `colour/primitive/green/900` | Primary action hover state | Approved |
| `colour/semantic/action/primary-soft` | `colour/primitive/green/100` | Primary action backgrounds (soft) | Approved |
| `colour/semantic/action/secondary` | `colour/primitive/gray/700` | Secondary action buttons | Proposed |
| `colour/semantic/action/tertiary` | `colour/primitive/green/700` | Tertiary action (text links) | Proposed |
| `colour/semantic/action/disabled` | `colour/primitive/gray/300` | Disabled action background | Proposed |
| `colour/semantic/action/icon` | `colour/primitive/gray/700` | Icon buttons default | Proposed |
| `colour/semantic/action/scan` | `colour/primitive/green/700` | Scan action buttons | Proposed |

### Surface Colors

| Variable Name | Value | Description | Approval Status |
|---------------|-------|-------------|-----------------|
| `colour/semantic/surface/app-background` | `colour/primitive/gray/100` | Main app background | Approved |
| `colour/semantic/surface/card` | `colour/primitive/white` | Card backgrounds | Approved |
| `colour/semantic/surface/modal` | `colour/primitive/white` | Modal/dialog backgrounds | Approved |
| `colour/semantic/surface/navigation` | `colour/primitive/white` | Top bar, sidebar backgrounds | Proposed |
| `colour/semantic/surface/input` | `colour/primitive/white` | Input field backgrounds | Proposed |
| `colour/semantic/surface/overlay` | rgba(0, 0, 0, 0.5) | Backdrop overlays | Proposed |

### Text Colors

| Variable Name | Value | Description | Approval Status |
|---------------|-------|-------------|-----------------|
| `colour/semantic/text/primary` | `colour/primitive/gray/900` | Primary body text | Approved |
| `colour/semantic/text/secondary` | `colour/primitive/gray/700` | Secondary text, hints | Approved |
| `colour/semantic/text/on-action` | `colour/primitive/white` | Text on primary buttons | Proposed |
| `colour/semantic/text/on-success` | `colour/primitive/white` | Text on success backgrounds | Proposed |
| `colour/semantic/text/on-critical` | `colour/primitive/white` | Text on critical backgrounds | Proposed |
| `colour/semantic/text/disabled` | `colour/primitive/gray/300` | Disabled text | Proposed |
| `colour/semantic/text/link` | `colour/primitive/green/700` | Hyperlinks | Proposed |
| `colour/semantic/text/placeholder` | `colour/primitive/gray/700` | Placeholder text in inputs | Proposed |

### Status Colors

| Variable Name | Value | Description | Approval Status |
|---------------|-------|-------------|-----------------|
| `colour/semantic/status/success` | `colour/primitive/success/700` | Success badges, alerts | Approved |
| `colour/semantic/status/success-soft` | `colour/primitive/success/100` | Success backgrounds (soft) | Proposed |
| `colour/semantic/status/warning` | `colour/primitive/warning/700` | Warning badges, alerts (NOT AA for body) | Approved |
| `colour/semantic/status/warning-soft` | `colour/primitive/warning/100` | Warning backgrounds (soft) | Proposed |
| `colour/semantic/status/critical` | `colour/primitive/critical/700` | Error badges, alerts | Approved |
| `colour/semantic/status/critical-soft` | `colour/primitive/critical/100` | Error backgrounds (soft) | Proposed |
| `colour/semantic/status/info` | `colour/primitive/info/700` | Info badges, alerts | Approved |
| `colour/semantic/status/info-soft` | `colour/primitive/info/100` | Info backgrounds (soft) | Proposed |
| `colour/semantic/status/neutral` | `colour/primitive/gray/700` | Neutral badges | Proposed |

### Border Colors

| Variable Name | Value | Description | Approval Status |
|---------------|-------|-------------|-----------------|
| `colour/semantic/border/default` | `colour/primitive/gray/300` | Default borders | Approved |
| `colour/semantic/border/focus` | `colour/primitive/green/700` | Focus state borders | Proposed |
| `colour/semantic/border/error` | `colour/primitive/critical/700` | Error state borders | Proposed |
| `colour/semantic/border/warning` | `colour/primitive/warning/700` | Warning state borders | Proposed |

### Input Colors

| Variable Name | Value | Description | Approval Status |
|---------------|-------|-------------|-----------------|
| `colour/semantic/input/background` | `colour/primitive/white` | Input field background | Proposed |
| `colour/semantic/input/border` | `colour/primitive/gray/300` | Input field border | Proposed |
| `colour/semantic/input/border-focus` | `colour/primitive/green/700` | Input field focus border | Proposed |
| `colour/semantic/input/border-error` | `colour/primitive/critical/700` | Input field error border | Proposed |
| `colour/semantic/input/disabled` | `colour/primitive/gray/100` | Disabled input background | Proposed |

---

## Collection 3: Typography

**Purpose:** Font families, sizes, weights, line heights.

**Type:** String (font family), Number (sizes, weights, line heights)

### Font Families

| Variable Name | Value | Description | Approval Status |
|---------------|-------|-------------|-----------------|
| `typography/font-family/primary` | Inter | Primary font (English) | Approved |
| `typography/font-family/sinhala` | Noto Sans Sinhala | Sinhala font | Approved |
| `typography/font-family/monospace` | 'Courier New', monospace | Monospace (if needed for codes) | Proposed |

### Font Sizes

| Variable Name | Value (px) | Description | Approval Status |
|---------------|------------|-------------|-----------------|
| `typography/size/10` | 10 | Smallest (captions, badges) | Proposed |
| `typography/size/12` | 12 | Small (hints, secondary info) | Proposed |
| `typography/size/14` | 14 | Body regular (desktop), labels | Proposed |
| `typography/size/16` | 16 | Body large (mobile operator), inputs | Proposed |
| `typography/size/18` | 18 | Heading small, large buttons | Proposed |
| `typography/size/20` | 20 | Heading medium | Proposed |
| `typography/size/24` | 24 | Heading large | Proposed |
| `typography/size/32` | 32 | Display heading | Proposed |

### Font Weights

| Variable Name | Value | Description | Approval Status |
|---------------|-------|-------------|-----------------|
| `typography/weight/regular` | 400 | Regular body text | Proposed |
| `typography/weight/medium` | 500 | Medium emphasis (labels) | Proposed |
| `typography/weight/semibold` | 600 | Semibold (buttons, headings) | Proposed |
| `typography/weight/bold` | 700 | Bold (headings) | Proposed |

### Line Heights

| Variable Name | Value (unitless or %) | Description | Approval Status |
|---------------|----------------------|-------------|-----------------|
| `typography/line-height/tight` | 1.2 | Tight (headings) | Proposed |
| `typography/line-height/normal` | 1.5 | Normal (body text) | Proposed |
| `typography/line-height/relaxed` | 1.75 | Relaxed (long-form content) | Proposed |

---

## Collection 4: Spacing and Sizing

**Purpose:** Spacing values for margins, padding, gaps. Sizing values for widths, heights.

**Type:** Number (px)

### Spacing (Margin, Padding, Gap)

| Variable Name | Value (px) | Description | Approval Status |
|---------------|------------|-------------|-----------------|
| `spacing/2` | 2 | Smallest (focus offset) | Proposed |
| `spacing/4` | 4 | Extra small | Proposed |
| `spacing/8` | 8 | Small | Proposed |
| `spacing/12` | 12 | Medium | Proposed |
| `spacing/16` | 16 | Default (cards, sections) | Proposed |
| `spacing/20` | 20 | Medium-large | Proposed |
| `spacing/24` | 24 | Large (modals, panels) | Proposed |
| `spacing/32` | 32 | Extra large | Proposed |
| `spacing/48` | 48 | XXL (section separation) | Proposed |

### Sizing (Width, Height, Touch Targets)

| Variable Name | Value (px) | Description | Approval Status |
|---------------|------------|-------------|-----------------|
| `size/touch/minimum` | 48 | Minimum touch target (WCAG AAA) | Approved |
| `size/touch/operator` | 56 | Operator touch target (factory floor) | Proposed |
| `size/touch/operator-large` | 64 | Large operator touch target (critical actions) | Proposed |
| `size/icon/small` | 16 | Small icon | Proposed |
| `size/icon/medium` | 20 | Medium icon (inline) | Proposed |
| `size/icon/large` | 24 | Large icon (standalone) | Proposed |
| `size/icon/xlarge` | 32 | Extra large icon (alerts) | Proposed |
| `size/input/height-default` | 48 | Default input height | Proposed |
| `size/input/height-operator` | 56 | Operator input height (mobile) | Proposed |
| `size/button/height-default` | 48 | Default button height | Proposed |
| `size/button/height-operator` | 56 | Operator button height | Proposed |

---

## Collection 5: Radius and Border

**Purpose:** Border radius and border width values.

**Type:** Number (px)

### Border Radius

| Variable Name | Value (px) | Description | Approval Status |
|---------------|------------|-------------|-----------------|
| `radius/small` | 4 | Small (badges, small elements) | Proposed |
| `radius/medium` | 8 | Medium (buttons, cards) | Proposed |
| `radius/large` | 12 | Large (modals, panels) | Proposed |
| `radius/xlarge` | 16 | Extra large (bottom sheets, top corners) | Proposed |
| `radius/full` | 999 | Fully rounded (pills, circles) | Proposed |

### Border Width

| Variable Name | Value (px) | Description | Approval Status |
|---------------|------------|-------------|-----------------|
| `border/width/thin` | 1 | Default borders | Proposed |
| `border/width/medium` | 2 | Emphasis borders (focus, error) | Proposed |
| `border/width/thick` | 4 | Strong borders (loading blocked) | Proposed |

---

## Collection 6: Elevation (Shadow)

**Purpose:** Shadow values for elevation (depth).

**Type:** String (CSS box-shadow)

| Variable Name | Value | Description | Approval Status |
|---------------|-------|-------------|-----------------|
| `elevation/none` | none | No shadow | Proposed |
| `elevation/subtle` | 0 1px 2px rgba(0,0,0,0.05) | Subtle (cards at rest) | Proposed |
| `elevation/low` | 0 2px 4px rgba(0,0,0,0.08) | Low (cards hover) | Proposed |
| `elevation/medium` | 0 4px 8px rgba(0,0,0,0.12) | Medium (dropdowns, popovers) | Proposed |
| `elevation/high` | 0 8px 16px rgba(0,0,0,0.16) | High (modals, bottom sheets) | Proposed |
| `elevation/extreme` | 0 16px 32px rgba(0,0,0,0.20) | Extreme (rarely used) | Proposed |

**Note:** These are CSS-style shadow values. In Figma, create effect styles with equivalent blur, spread, and opacity.

---

## Collection 7: Motion (Animation)

**Purpose:** Animation durations and easing functions.

**Type:** Number (milliseconds), String (easing)

### Duration

| Variable Name | Value (ms) | Description | Approval Status |
|---------------|------------|-------------|-----------------|
| `motion/duration/instant` | 0 | No animation | Proposed |
| `motion/duration/fast` | 150 | Fast transitions (hover, focus) | Proposed |
| `motion/duration/normal` | 250 | Normal transitions (modals open) | Proposed |
| `motion/duration/slow` | 400 | Slow transitions (page transitions) | Proposed |

### Easing

| Variable Name | Value | Description | Approval Status |
|---------------|-------|-------------|-----------------|
| `motion/easing/ease-out` | ease-out | Ease out (opening, entering) | Proposed |
| `motion/easing/ease-in` | ease-in | Ease in (closing, exiting) | Proposed |
| `motion/easing/ease-in-out` | ease-in-out | Ease in and out (smooth) | Proposed |

---

## Collection 8: Component Dimensions

**Purpose:** Specific dimensions for components (max widths, heights, etc.).

**Type:** Number (px or %)

| Variable Name | Value | Description | Approval Status |
|---------------|-------|-------------|-----------------|
| `component/modal/max-width-small` | 400 | Small modal (confirmations) | Proposed |
| `component/modal/max-width-medium` | 600 | Medium modal (forms) | Proposed |
| `component/modal/max-width-large` | 800 | Large modal (complex content) | Proposed |
| `component/sidebar/width-expanded` | 240 | Desktop sidebar expanded | Proposed |
| `component/sidebar/width-collapsed` | 64 | Desktop sidebar collapsed | Proposed |
| `component/top-bar/height` | 64 | Top bar height (desktop) | Proposed |
| `component/mobile-top-bar/height` | 56 | Mobile top bar height | Proposed |
| `component/mobile-bottom-nav/height` | 64 | Mobile bottom nav height | Proposed |
| `component/task-card/min-height` | 96 | Task card minimum height | Proposed |
| `component/checklist-item/min-height` | 64 | Checklist item minimum height | Proposed |

---

## Responsive Breakpoints (Reference)

**Purpose:** Breakpoint values for responsive design (not Figma variables, but reference for frames).

**Type:** Number (px)

| Breakpoint Name | Value (px) | Description |
|-----------------|------------|-------------|
| `breakpoint/phone-small` | 360 | Small phone (reference frame) |
| `breakpoint/phone-medium` | 390 | Medium phone (reference frame) |
| `breakpoint/phone-large` | 430 | Large phone (reference frame) |
| `breakpoint/tablet` | 768 | Tablet (min-width for desktop sidebar) |
| `breakpoint/desktop` | 1280 | Desktop (reference frame) |
| `breakpoint/desktop-large` | 1920 | Large desktop (reference frame) |

**Note:** These are not Figma variables, but reference values for creating Figma frames.

---

## Figma Variable Naming Conventions

**Collection Names:**
- Use Title Case with Spaces (e.g., "Colour Semantic")

**Variable Names:**
- Use lowercase with forward slashes for hierarchy (e.g., `colour/semantic/action/primary`)
- Consistent structure: `[category]/[subcategory]/[property]`

**Variable Types:**
- Color: For all color values
- Number: For sizes, spacing, duration (px or ms)
- String: For font families, easing functions

---

## Implementation in Figma

### Step 1: Create Collections
1. Open Figma file
2. Go to Design Panel → Local Variables (or click 🔑 icon)
3. Create each collection listed above

### Step 2: Create Variables
1. Within each collection, create variables as listed
2. Set variable type (Color, Number, String)
3. Set variable value

### Step 3: Create Modes (Light Mode Only)
1. For each collection, ensure only "Light" mode exists (default)
2. Do not create "Dark" mode (not in initial scope)

### Step 4: Link Semantic to Primitives
1. For semantic color variables, set value as reference to primitive variable (not hard-coded hex)
2. Example: `colour/semantic/action/primary` → `colour/primitive/green/700`

### Step 5: Apply to Components
1. Use variables in component properties (fill, stroke, padding, corner radius, etc.)
2. Do not use hard-coded values in components; always use variables

---

## Approval and Governance

All Figma variables are **proposed** and subject to:

- **Design Owner Approval:** OWNER REQUIRED
- **Development Review:** Ensure variable structure is compatible with design tokens for implementation
- **Accessibility Review:** Verify all color variables meet WCAG 2.1 AA contrast requirements (note: warning color #B76E00 NOT AA for body text)

**Approval Status:** Pending design review and Figma implementation.

**Evidence Required:**
- Design owner approval of all values
- WCAG contrast validation for all color combinations
- Development feasibility review (token naming alignment)

---

## Cross-References

- **DESIGN_TOKENS.md:** Detailed token specifications (CSS/JSON format)
- **FIGMA_TOKENS_COMPONENTS_SPEC.md:** Figma-specific token and component guide
- **FIGMA_COMPONENT_BUILD_GUIDE.md:** Step-by-step Figma component build instructions
- **design/tokens/nelna-fg.tokens.json:** Design tokens JSON file

---

## Document History

| Version | Date       | Author         | Changes                                  |
|---------|------------|----------------|------------------------------------------|
| 1.0     | 2026-08-04 | System         | Initial Figma variables specification    |

---

**End of Figma Variables Specification**
