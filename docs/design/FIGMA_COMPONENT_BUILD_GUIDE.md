# Figma Component Build Guide

**Document Status:** Proposed  
**Approval Status:** Pending design review and Figma file approval  
**Last Updated:** 2026-08-04  
**Cross-references:** FIGMA_VARIABLES_SPEC.md, COMPONENT_CATALOGUE.md, COMPONENT_ANATOMY_AND_STATES.md

## Purpose

This guide provides step-by-step instructions for building the Nelna FG Digital Recording System design file in Figma. It covers:

- File structure and naming
- Page organization
- Variable setup
- Text and effect styles
- Component building with variants and auto layout
- Accessibility annotations
- Review labels and status tracking

**Important:** This guide is for manual design file creation OR for future Figma connector integration. Do not build until approved.

---

## Figma File Structure

### File Name
**"Nelna FG Digital Recording System — Product Design"**

### File Organization
- **One Figma file** for entire design system and product screens
- **Multiple pages** for organization (see below)

---

## Page Structure

Create the following pages in order:

### Page 00: 📚 README
- **Purpose:** File overview, change log, approval status
- **Content:**
  - Project name and description
  - Link to documentation (GitHub repo or Notion)
  - Change log (major updates)
  - Approval status banner
  - Contact information for design owner

### Page 01: 🎨 Colour Variables
- **Purpose:** Visual reference of all color variables
- **Content:**
  - Primitive colors: Swatches with variable names and hex codes
  - Semantic colors: Swatches with variable names and references
  - Organized in frames by category (Actions, Surfaces, Text, Status, Borders, etc.)

### Page 02: 📝 Typography Variables
- **Purpose:** Visual reference of typography variables and text styles
- **Content:**
  - Font families: Inter, Noto Sans Sinhala samples
  - Font sizes: Scale from 10px to 32px
  - Font weights: Regular, Medium, Semibold, Bold
  - Line heights: Tight, Normal, Relaxed
  - Text styles (created later, displayed here)

### Page 03: 📏 Spacing & Sizing Variables
- **Purpose:** Visual reference of spacing and sizing scales
- **Content:**
  - Spacing scale: 2px to 48px (visual bars)
  - Touch target sizes: 48px, 56px, 64px (visual frames)
  - Icon sizes: 16px, 20px, 24px, 32px (visual circles)
  - Component dimensions: Modal widths, sidebar widths, etc.

### Page 04: 🟢 Foundation (Radius, Borders, Elevation, Motion)
- **Purpose:** Visual reference of radius, border, elevation, and motion variables
- **Content:**
  - Border radius: Small to Full (visual rounded rectangles)
  - Border widths: Thin, Medium, Thick (visual lines)
  - Elevation levels: None to Extreme (visual cards with shadows)
  - Motion durations: Fast, Normal, Slow (animation timeline reference)

### Page 05: 🧱 Base Components
- **Purpose:** Atomic components (buttons, inputs, badges, etc.)
- **Content:**
  - All components from Component Catalogue (Actions, Forms, Feedback categories)
  - Organized in sections with labels
  - Each component with all variants
  - Component properties configured
  - Auto layout applied

### Page 06: 🏗️ Operational Components
- **Purpose:** Operator-specific components (task cards, checklist items, etc.)
- **Content:**
  - Task Card, Checklist Item, Pass/Fail Control, Evidence Card, etc.
  - All variants and states
  - Mobile-optimized (56px touch targets)

### Page 07: 📊 Data & Review Components
- **Purpose:** Data display and review components
- **Content:**
  - KPI Card, Data Table, Review Queue Item, Approval Actions, etc.
  - All variants and states

### Page 08: 🔲 Overlay Components
- **Purpose:** Modals, bottom sheets, drawers, popovers, tooltips
- **Content:**
  - Modal (small, medium, large)
  - Bottom Sheet (mobile)
  - Side Drawer (left, right)
  - Popover, Tooltip
  - All states (open, closed)

### Page 09: 📱 Mobile Operator Screens
- **Purpose:** Full mobile screens for operator workflows
- **Content:**
  - Login
  - My Tasks (list)
  - Checklist (in progress)
  - Checklist (review before submit)
  - Attestation
  - Submission confirmation
  - Offline mode
  - Critical failure
  - Loading blocked
  - Organized in flows

### Page 10: 🖥️ Desktop Supervisor Screens
- **Purpose:** Full desktop screens for supervisor/QA workflows
- **Content:**
  - Dashboard
  - Review Queue (list)
  - Record Review Detail
  - Approval Actions
  - Return for Correction
  - Hold/Reject
  - Audit Log
  - Organized in flows

### Page 11: 🌐 Responsive Breakpoints
- **Purpose:** Demonstrate responsive behavior at different breakpoints
- **Content:**
  - Key screens at: 360px (phone small), 390px (phone medium), 768px (tablet), 1280px (desktop)
  - Show layout changes (bottom nav → sidebar, single column → multi-column, etc.)

### Page 12: ♿ Accessibility Annotations
- **Purpose:** Document accessibility requirements for each component
- **Content:**
  - Focus states (all interactive elements)
  - ARIA labels (icon buttons, form fields)
  - Touch target sizes (highlighted and measured)
  - Color contrast ratios (noted per component)
  - Keyboard navigation order (numbered)
  - Screen reader announcements (noted)

### Page 13: 🔍 Design QA & Review
- **Purpose:** Design review checklist and approval tracking
- **Content:**
  - QA checklist (from DESIGN_QA_CHECKLIST.md)
  - Review status per page/section
  - Approval signatures (design owner, dev lead, accessibility reviewer)
  - Open issues list

### Page 99: 🗑️ Archive / Scratchpad
- **Purpose:** Discarded explorations, work in progress, experiments
- **Content:**
  - Do not publish to dev
  - For internal design team only

---

## Step-by-Step Build Instructions

### Step 1: Create Figma File
1. Create new Figma design file
2. Name: "Nelna FG Digital Recording System — Product Design"
3. Set default team/project (if applicable)

### Step 2: Create Pages
1. Create all pages listed above (00-13, 99)
2. Name pages exactly as specified (emoji + title)
3. Reorder pages if needed (drag in sidebar)

### Step 3: Create Variable Collections
1. Go to Page 01 (Colour Variables)
2. Open Design Panel → Local Variables (or click 🔑 icon)
3. Create all variable collections from FIGMA_VARIABLES_SPEC.md:
   - Colour Primitives
   - Colour Semantic
   - Typography
   - Spacing and Sizing
   - Radius and Border
   - Elevation
   - Motion
   - Component Dimensions
4. For each collection, create all variables with correct name, type, and value
5. For Colour Semantic, link variables to Colour Primitives (do not hard-code hex)

**Reference:** FIGMA_VARIABLES_SPEC.md for complete variable list

### Step 4: Create Text Styles
1. Go to Page 02 (Typography Variables)
2. Create text styles for common text uses:
   - **Heading/Display:** 32px, Bold, Tight line height
   - **Heading/Large:** 24px, Bold, Tight
   - **Heading/Medium:** 20px, Semibold, Tight
   - **Heading/Small:** 18px, Semibold, Normal
   - **Body/Large:** 16px, Regular, Normal (operator mobile)
   - **Body/Regular:** 14px, Regular, Normal (desktop)
   - **Body/Small:** 12px, Regular, Normal (hints)
   - **Button/Default:** 16px, Semibold, Normal
   - **Button/Operator:** 18px, Semibold, Normal
   - **Caption:** 12px, Regular, Normal
   - **Badge:** 12px, Medium, Normal
3. Set font family: Inter for English, Noto Sans Sinhala for Sinhala
4. Link text color to semantic variables (e.g., `colour/semantic/text/primary`)

### Step 5: Create Effect Styles (Shadows)
1. Go to Page 04 (Foundation)
2. Create effect styles for elevation:
   - **Elevation/Subtle:** Drop shadow, 0 1px 2px, rgba(0,0,0,0.05), blur 2
   - **Elevation/Low:** Drop shadow, 0 2px 4px, rgba(0,0,0,0.08), blur 4
   - **Elevation/Medium:** Drop shadow, 0 4px 8px, rgba(0,0,0,0.12), blur 8
   - **Elevation/High:** Drop shadow, 0 8px 16px, rgba(0,0,0,0.16), blur 16
   - **Elevation/Extreme:** Drop shadow, 0 16px 32px, rgba(0,0,0,0.20), blur 32
3. Name styles clearly (Elevation/[Level])

### Step 6: Build Base Components
1. Go to Page 05 (Base Components)
2. For each component in COMPONENT_CATALOGUE.md (Actions, Forms, Feedback):
   a. Create component frame
   b. Name component: comp/[category]/[component-name]
   c. Build component anatomy per COMPONENT_ANATOMY_AND_STATES.md
   d. Use auto layout for flexible sizing
   e. Use variables for colors, spacing, sizing, radius
   f. Create variants for different states (default, hover, focus, disabled, etc.)
   g. Configure component properties (text, icons, boolean for states)
   h. Set constraints for responsive behavior
   i. Test component by changing property values
3. Organize components in sections with clear labels

**Example: Button Component**
- Component name: comp/actions/button-primary
- Variants:
  - Default (state=default)
  - Hover (state=hover)
  - Focus (state=focus)
  - Pressed (state=pressed)
  - Disabled (state=disabled)
  - Loading (state=loading)
- Properties:
  - Label (text)
  - Icon (boolean, show/hide)
  - Full Width (boolean)
- Auto Layout: Horizontal, padding 12px 24px, gap 8px, hug contents (or fill container if full width)
- Variables:
  - Fill: `colour/semantic/action/primary` (default), `colour/semantic/action/primary-hover` (hover), etc.
  - Text color: `colour/semantic/text/on-action`
  - Corner radius: `radius/medium`
  - Padding: `spacing/12` (vertical), `spacing/24` (horizontal)
  - Min height: `size/button/height-default` or `size/button/height-operator`

### Step 7: Build Operational Components
1. Go to Page 06 (Operational Components)
2. Build Task Card, Checklist Item, Pass/Fail Control, Evidence Card, etc.
3. Use 56px touch targets for operator components
4. Use Sinhala and English text (placeholder text in both languages)
5. Create variants for states (unanswered, pass, fail, etc.)

### Step 8: Build Data & Review Components
1. Go to Page 07 (Data & Review Components)
2. Build KPI Card, Data Table, Review Queue Item, Approval Actions, etc.
3. Optimize for desktop and tablet views

### Step 9: Build Overlay Components
1. Go to Page 08 (Overlay Components)
2. Build Modal (with backdrop), Bottom Sheet, Side Drawer, Popover, Tooltip
3. Show open and closed states
4. Use elevation styles for shadows

### Step 10: Build Mobile Operator Screens
1. Go to Page 09 (Mobile Operator Screens)
2. Create frames for mobile screens (390px width recommended, medium phone)
3. Build full screens using components from Pages 05-08
4. Organize in flows (e.g., Task → Checklist → Review → Attest → Submit)
5. Show critical states (offline banner, loading blocked, critical failure)
6. Use Sinhala labels for operator-facing content

### Step 11: Build Desktop Supervisor Screens
1. Go to Page 10 (Desktop Supervisor Screens)
2. Create frames for desktop screens (1280px width recommended)
3. Build full screens using components
4. Show desktop sidebar, top bar, and content area
5. Organize in flows (Dashboard → Review Queue → Record Detail → Approve/Reject)
6. Use English labels for supervisory content

### Step 12: Demonstrate Responsive Behavior
1. Go to Page 11 (Responsive Breakpoints)
2. Duplicate key screens at different breakpoints: 360px, 390px, 768px, 1280px
3. Show layout changes:
   - Mobile (< 768px): Bottom nav, full width, stacked layout
   - Tablet (768px): Desktop sidebar appears, multi-column layout begins
   - Desktop (1280px): Full multi-column layout, wider content area
4. Annotate changes (e.g., "Bottom nav → Sidebar at 768px")

### Step 13: Add Accessibility Annotations
1. Go to Page 12 (Accessibility Annotations)
2. For each component and screen:
   a. Highlight focus states (draw focus rings in annotation layer)
   b. Note ARIA labels (text annotations: "aria-label='Submit form'")
   c. Measure and label touch targets (48px, 56px, 64px)
   d. Note color contrast ratios (e.g., "4.5:1 AA pass")
   e. Number keyboard navigation order (1, 2, 3, ...)
   f. Note screen reader announcements (text annotations: "Announces 'Loading blocked'")
3. Use annotation layer (not editable layer) for all notes
4. Use consistent annotation style (color, font, size)

### Step 14: Create Design QA Checklist
1. Go to Page 13 (Design QA & Review)
2. Create visual checklist from DESIGN_QA_CHECKLIST.md
3. Use checkboxes (boolean components) for each item
4. Organize by section (Tokens, Components, Accessibility, Content, etc.)
5. Add approval signature area:
   - Design Owner: [Name, Date]
   - Development Lead: [Name, Date]
   - Accessibility Reviewer: [Name, Date]
   - Product Owner: [Name, Date]
6. Add open issues list (table: Issue, Priority, Owner, Status)

### Step 15: Set Up Archive Page
1. Go to Page 99 (Archive / Scratchpad)
2. Create section for discarded explorations
3. Create section for work in progress (clearly labeled "WIP - Do not use")
4. Note: This page is NOT published to developers

### Step 16: Publish and Share
1. Review all pages for completeness and accuracy
2. Run through QA checklist (Page 13)
3. Fix any issues found
4. Once approved, publish components to team library (if using Figma team)
5. Share file with developers (view-only link or dev mode access)
6. Record Figma file URL in project documentation

---

## Component Building Best Practices

### Use Auto Layout Everywhere
- All components should use auto layout for flexible, responsive sizing
- Set direction (horizontal or vertical)
- Set padding, gap, and alignment
- Set sizing: Hug contents or Fill container

### Use Variables for All Values
- Do NOT hard-code colors, sizes, spacing, radius
- Always link to variables
- This ensures consistency and easy updates

### Create Variants for States
- Use variant properties (state, size, type, etc.)
- Organize variants in a logical grid
- Name variants clearly (state=default, state=hover, etc.)

### Configure Component Properties
- Text properties for labels
- Boolean properties for show/hide (icon, badge, etc.)
- Instance swap properties for nested components (e.g., icon choice)

### Set Constraints for Responsive Behavior
- Top, Left for fixed position
- Scale for proportional scaling
- Center for centered alignment

### Name Layers Clearly
- Use descriptive names (not "Rectangle 1")
- Group related layers (use frames)
- Use consistent naming (Icon, Label, Container, etc.)

### Add Internal Documentation
- Use comments in Figma (bubble icon) to explain complex components
- Note any special considerations (e.g., "Warning color NOT AA compliant for body text")

### Test Components
- Change property values to test all states
- Resize component to test auto layout
- Place component in different contexts (light bg, dark bg) to test contrast

---

## Accessibility in Figma

### Focus States
- Draw focus ring (2px stroke, primary color, 2px offset)
- Apply to all interactive elements
- Use annotation layer to note "Focus state"

### Touch Targets
- Measure all interactive elements (use built-in measurement tool)
- Ensure ≥48px for general, ≥56px for operator
- Use annotation layer to label "Touch target: 56px"

### Color Contrast
- Test all text/background combinations with contrast plugin (e.g., "Stark" or "Contrast")
- Note ratios in annotations: "4.5:1 AA pass" or "3.8:1 FAIL - needs adjustment"
- Flag warning color (#B76E00) as "NOT AA for body text - large text only"

### ARIA Labels
- For icon-only buttons, note required aria-label in annotation
- Example: "aria-label='Close dialog'"

### Keyboard Navigation
- Number all interactive elements in tab order (1, 2, 3, ...)
- Show navigation flow with arrows (optional)

### Screen Reader Announcements
- Note what screen reader should announce
- Example: "Announces: 'Error. Submission failed. Retry.'"

---

## Review and Approval

### Internal Review (Before Approval)
1. Designer self-review using QA checklist
2. Peer review by another designer (if available)
3. Fix issues found

### Stakeholder Review
1. Present to Design Owner for approval
2. Present to Development Lead for feasibility review
3. Present to Accessibility Reviewer for WCAG compliance
4. Present to Product Owner for business rule validation

### Approval
1. All reviewers sign off on Page 13 (Design QA & Review)
2. Record approval date and names
3. Mark file as "Approved for Development"

### Post-Approval
1. Publish components to team library (if applicable)
2. Share file with developers (dev mode access)
3. Record Figma file URL in project documentation
4. Lock approved pages (prevent accidental edits)

---

## Maintenance and Updates

### Versioning
- Use Figma's branching feature for major updates
- Create branch: "Version 1.1 Updates"
- Merge branch back to main after approval

### Change Log
- Update Page 00 (README) with all changes
- Note date, author, and description of change

### Deprecation
- Mark deprecated components clearly (annotation: "Deprecated - use [new component] instead")
- Do not delete immediately (allow transition period)
- Move to Archive page (Page 99) after transition

---

## Approval and Governance

This build guide is **proposed** and subject to:

- **Design Owner Approval:** OWNER REQUIRED
- **Development Review:** Ensure Figma structure aligns with development needs
- **Accessibility Review:** Ensure annotations and documentation support WCAG compliance

**Approval Status:** Pending design review and Figma file creation approval.

**Evidence Required:**
- Design owner approval to proceed with Figma file creation
- Development lead approval of file structure and component organization
- Accessibility reviewer approval of annotation approach

---

## Cross-References

- **FIGMA_VARIABLES_SPEC.md:** Complete variable list
- **COMPONENT_CATALOGUE.md:** All components to build
- **COMPONENT_ANATOMY_AND_STATES.md:** Detailed component specifications
- **DESIGN_QA_CHECKLIST.md:** QA checklist for review
- **ACCESSIBILITY_AND_USABILITY.md:** WCAG requirements

---

## Document History

| Version | Date       | Author         | Changes                                  |
|---------|------------|----------------|------------------------------------------|
| 1.0     | 2026-08-04 | System         | Initial Figma build guide creation       |

---

**End of Figma Component Build Guide**

**Note:** Do NOT build Figma file until this guide and all referenced specifications are approved by stakeholders.
