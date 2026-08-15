# Component Catalogue

**Document Status:** Proposed  
**Approval Status:** Pending design review  
**Last Updated:** 2026-08-04  
**Cross-references:** DESIGN_TOKENS.md, COMPONENT_SYSTEM.md, FIGMA_TOKENS_COMPONENTS_SPEC.md, ACCESSIBILITY_AND_USABILITY.md

## Purpose

This catalogue provides a structured inventory of all proposed UI components for the Nelna FG Digital Recording System. Each component includes design specifications, usage guidelines, and implementation considerations.

**Important:** All component specifications are proposed pending stakeholder review. No business rules or operational limits are assumed.

---

## Navigation Components

### Mobile Top Bar

**Purpose:** Primary navigation header for mobile devices, displaying current context and key actions.

**Primary Persona:** Operator (mobile-first factory floor use)

**Anatomy:**
- Left action (back/menu icon)
- Center title (current screen/context)
- Right actions (notifications, account menu - max 2 icons)
- Height: 56px (operator touch optimized)

**Variants:**
- Default (with back)
- Root (with menu)
- With subtitle (location/shift context)

**States:** Default, Scrolled (elevated shadow)

**Responsive:** Mobile only (< 768px), replaced by desktop sidebar on larger screens

**Accessibility:**
- All actions labeled with aria-label
- Title as h1 or aria-label on nav
- Focus visible on all interactive elements
- Touch targets 48×48px minimum

**Content Rules:**
- Title: max 40 characters, truncate with ellipsis
- Sinhala and English support
- Subtitle (if shown): max 60 characters

**Usage Rules:**
- Always present on mobile views
- Back action returns to previous screen or parent context
- Menu action opens account/navigation drawer
- Title reflects current task or screen

**Misuse:**
- Do not stack multiple lines of actions
- Do not use for inline section headers
- Do not hide critical actions in overflow menu

**Design Tokens (Semantic):**
- color.semantic.surface.navigation
- color.semantic.text.on-navigation
- elevation.navigation
- size.touch.operator
- spacing.navigation.horizontal

**Figma Naming:** comp/navigation/mobile-top-bar

**Future Django Partial:** templates/components/navigation/mobile_top_bar.html

**Future Test Considerations:**
- Verify touch target sizes (≥48px)
- Test with long Sinhala titles
- Verify focus order
- Test back navigation flow

---

### Mobile Bottom Navigation

**Purpose:** Persistent bottom navigation for primary operator task access.

**Primary Persona:** Operator (one-handed mobile use)

**Anatomy:**
- 3-4 navigation items
- Each item: Icon (24px), Label (10-12px)
- Selected indicator (color + icon weight change)
- Height: 64px (operator touch optimized)
- Safe area inset at bottom

**Variants:**
- 3-item (preferred)
- 4-item (if justified by workflows)

**States:** Default, Selected, Disabled (rare)

**Responsive:** Mobile only (< 768px), hidden on desktop

**Accessibility:**
- Role="navigation"
- Each item labeled
- aria-current="page" for selected
- Touch targets 48×48px minimum (centered on 64px bar)

**Content Rules:**
- Labels: single word preferred, max 12 characters
- Icons: Lucide (proposed) or equivalent
- Sinhala and English

**Usage Rules:**
- Reserve for primary task flows only
- 3 items strongly preferred (My Tasks, History, More)
- Selected state always visible
- Persist across screens within same flow

**Misuse:**
- Do not use for secondary actions
- Do not hide dynamically
- Do not use on desktop

**Design Tokens (Semantic):**
- color.semantic.surface.navigation
- color.semantic.action.primary (selected)
- color.semantic.text.secondary (unselected)
- size.touch.operator

**Figma Naming:** comp/navigation/mobile-bottom-nav

**Future Django Partial:** templates/components/navigation/mobile_bottom_nav.html

**Future Test Considerations:**
- Verify safe area handling on iOS
- Test one-handed reach zones
- Verify selected state persistence
- Test with gloves (if applicable)

---

### Desktop Sidebar

**Purpose:** Primary navigation panel for desktop/tablet landscape views.

**Primary Persona:** Supervisor, QA, Manager

**Anatomy:**
- Logo/system name (top)
- Primary navigation items (icon + label)
- Account/settings (bottom)
- Width: 240px (expanded), 64px (collapsed)
- Collapsible toggle

**Variants:**
- Expanded (default)
- Collapsed (icon only)

**States:** Default, Collapsed, Item hover, Item selected

**Responsive:** Desktop/tablet landscape (≥ 768px)

**Accessibility:**
- Role="navigation"
- Skip link to main content
- aria-expanded on collapse toggle
- Keyboard navigation (Tab, Enter, Arrow keys)

**Content Rules:**
- Item labels: max 24 characters
- Group labels: max 16 characters
- Icons consistent (Lucide proposed)

**Usage Rules:**
- Selected item persists within section
- Collapse state saved in user preference
- Groups for related items (max 3 groups)

**Misuse:**
- Do not nest beyond one level
- Do not dynamically show/hide items without clear reason
- Do not use for contextual actions

**Design Tokens (Semantic):**
- color.semantic.surface.sidebar
- color.semantic.action.primary
- elevation.sidebar
- spacing.sidebar.item

**Figma Naming:** comp/navigation/desktop-sidebar

**Future Django Partial:** templates/components/navigation/desktop_sidebar.html

**Future Test Considerations:**
- Verify collapse animation
- Test keyboard navigation
- Verify focus remains visible when collapsed
- Test with screen readers

---

### Desktop Top Bar

**Purpose:** Context and utility navigation for desktop views.

**Primary Persona:** Supervisor, QA, Manager

**Anatomy:**
- Breadcrumb trail (left)
- Search (center, if applicable)
- Notifications, account menu (right)
- Height: 64px

**Variants:**
- With breadcrumb
- With search
- Minimal (account only)

**States:** Default, Scrolled (elevated)

**Responsive:** Desktop/tablet (≥ 768px)

**Accessibility:**
- Breadcrumb as nav with aria-label="Breadcrumb"
- Search with label
- Icon buttons labeled
- Focus visible

**Content Rules:**
- Breadcrumb: max 4 levels, truncate middle if needed
- Labels in English (operators use mobile)

**Usage Rules:**
- Always paired with desktop sidebar
- Breadcrumb reflects current location
- Account menu in consistent position

**Misuse:**
- Do not duplicate sidebar items in breadcrumb
- Do not use for primary task navigation

**Design Tokens (Semantic):**
- color.semantic.surface.top-bar
- elevation.top-bar
- spacing.top-bar.horizontal

**Figma Naming:** comp/navigation/desktop-top-bar

**Future Django Partial:** templates/components/navigation/desktop_top_bar.html

**Future Test Considerations:**
- Test breadcrumb truncation logic
- Verify focus order
- Test with long location names

---

### Breadcrumb

**Purpose:** Show hierarchical location and enable quick navigation to parent levels.

**Primary Persona:** Supervisor, QA, Manager (desktop)

**Anatomy:**
- Home icon (optional root)
- Text links separated by "/" or "›"
- Current page (non-link, bold or distinct color)

**Variants:**
- 2-level minimum
- Up to 4-5 levels (truncate middle if more)

**States:** Link hover, Current page

**Responsive:** Desktop (≥ 768px), hidden on mobile

**Accessibility:**
- nav with aria-label="Breadcrumb"
- aria-current="page" on current
- Keyboard navigable

**Content Rules:**
- Labels: concise, max 24 characters per segment
- English only (desktop users)
- Truncate middle segments if 5+ levels

**Usage Rules:**
- Reflects IA hierarchy
- Current page always last, non-interactive
- Each link navigates to that level

**Misuse:**
- Do not use for action history (use back button)
- Do not show on operator mobile views
- Do not link current page

**Design Tokens (Semantic):**
- color.semantic.text.secondary (links)
- color.semantic.text.primary (current)
- spacing.breadcrumb.separator

**Figma Naming:** comp/navigation/breadcrumb

**Future Django Partial:** templates/components/navigation/breadcrumb.html

**Future Test Considerations:**
- Test truncation at various viewport widths
- Verify semantics with screen readers

---

### Tabs

**Purpose:** Switch between related views or sections without navigation.

**Primary Persona:** All (context-dependent)

**Anatomy:**
- Tab items (2-5 items)
- Active indicator (underline or background)
- Optional count badges
- Height: 48px

**Variants:**
- Line (underline indicator)
- Filled (background indicator)
- With badges

**States:** Default, Hover, Active, Disabled

**Responsive:** Stack on narrow mobile if needed, scroll horizontal otherwise

**Accessibility:**
- role="tablist", role="tab", role="tabpanel"
- aria-selected on active tab
- Keyboard: Arrow keys to switch, Tab to enter panel
- Touch targets ≥48px

**Content Rules:**
- Labels: 1-2 words, max 16 characters
- Sinhala and English
- Badge: numeric only, max 999+

**Usage Rules:**
- Use for peer-level content switching
- Active tab always visible
- Content changes without page reload

**Misuse:**
- Do not use for sequential steps (use progress indicator)
- Do not use for primary navigation
- Do not nest tabs

**Design Tokens (Semantic):**
- color.semantic.action.primary (active)
- color.semantic.text.secondary (inactive)
- border.tabs.indicator

**Figma Naming:** comp/navigation/tabs

**Future Django Partial:** templates/components/navigation/tabs.html

**Future Test Considerations:**
- Verify arrow key navigation
- Test with badges
- Verify tabpanel association

---

### Account Menu

**Purpose:** Access user account settings, logout, and profile.

**Primary Persona:** All

**Anatomy:**
- Trigger: Avatar or icon button
- Dropdown panel
- User name, role
- Menu items (Profile, Settings, Logout)
- Panel width: 240-280px

**Variants:**
- With avatar photo
- Icon only (no photo)

**States:** Closed, Open, Item hover

**Responsive:** All viewports (adjust panel position)

**Accessibility:**
- aria-haspopup="menu"
- aria-expanded on trigger
- role="menu", role="menuitem"
- Escape to close, Arrow keys to navigate
- Focus trap when open

**Content Rules:**
- Name: display name or username
- Role: job title or role name
- Menu items: clear action verbs

**Usage Rules:**
- Trigger in consistent location (top right)
- Close on selection, Escape, or outside click
- Logout requires confirmation (if work in progress)

**Misuse:**
- Do not use for primary actions
- Do not overload with many items
- Do not hide critical alerts here

**Design Tokens (Semantic):**
- color.semantic.surface.overlay
- elevation.menu
- spacing.menu.item

**Figma Naming:** comp/navigation/account-menu

**Future Django Partial:** templates/components/navigation/account_menu.html

**Future Test Considerations:**
- Verify focus trap
- Test Escape key
- Test outside click
- Verify logout flow

---

## Action Components

### Primary Button

**Purpose:** Primary call-to-action for each screen or section.

**Primary Persona:** All

**Anatomy:**
- Label text (14-16px)
- Optional leading icon (20px)
- Padding: 12px 24px (min 48px height)
- Border radius: 8px (proposed)

**Variants:**
- Default (with label)
- With icon
- Full width (mobile)

**States:** Default, Hover, Focus, Pressed, Disabled, Loading

**Responsive:** Full width on mobile, auto width on desktop

**Accessibility:**
- Clear label (no icon-only primary buttons)
- Focus visible (2px outline)
- Disabled with aria-disabled
- Loading with aria-busy

**Content Rules:**
- Label: action verb + noun, max 24 characters
- Sinhala and English
- Title case

**Usage Rules:**
- One primary button per screen/section (max 2 if distinct actions)
- Position: bottom right or sticky bottom on mobile
- Use for Submit, Save, Approve, Complete actions

**Misuse:**
- Do not use for destructive actions (use destructive button)
- Do not use multiple primary buttons competing
- Do not use for navigation (use link)

**Design Tokens (Semantic):**
- color.semantic.action.primary
- color.semantic.action.primary-hover
- color.semantic.text.on-action
- size.touch.operator

**Figma Naming:** comp/actions/button-primary

**Future Django Partial:** templates/components/buttons/primary_button.html

**Future Test Considerations:**
- Verify 48px minimum touch target
- Test loading state with spinner
- Test disabled state clearly visible
- Verify focus outline contrast

---

### Secondary Button

**Purpose:** Secondary actions, less prominent than primary.

**Primary Persona:** All

**Anatomy:**
- Label text (14-16px)
- Optional leading icon
- Padding: 12px 24px (min 48px height)
- Border: 1px solid
- Background: transparent or surface

**Variants:**
- Default
- With icon

**States:** Default, Hover, Focus, Pressed, Disabled

**Responsive:** Auto width, full width option for mobile

**Accessibility:**
- Clear label
- Focus visible
- Touch target ≥48px

**Content Rules:**
- Label: action verb, max 24 characters
- Sinhala and English

**Usage Rules:**
- Pair with primary button for alternative action
- Use for Cancel, Back, View Details
- Position: left of primary button (desktop), stacked above primary (mobile)

**Misuse:**
- Do not use multiple secondaries without clear distinction
- Do not use for destructive actions

**Design Tokens (Semantic):**
- color.semantic.action.secondary
- color.semantic.text.secondary
- border.action.secondary

**Figma Naming:** comp/actions/button-secondary

**Future Django Partial:** templates/components/buttons/secondary_button.html

**Future Test Considerations:**
- Verify contrast against background
- Test hover state clear distinction

---

### Tertiary Button

**Purpose:** Low-emphasis actions, minimal visual weight.

**Primary Persona:** All

**Anatomy:**
- Label text (14-16px)
- Optional icon
- Padding: 8px 16px
- No border, no background
- Underline on hover (optional)

**Variants:**
- Text only
- With icon

**States:** Default, Hover, Focus, Pressed, Disabled

**Responsive:** Auto width

**Accessibility:**
- Clear label
- Focus visible
- Sufficient contrast (4.5:1 for text)

**Content Rules:**
- Label: concise, max 20 characters
- Sinhala and English

**Usage Rules:**
- Use for low-priority actions: Learn More, View All, Cancel (low stakes)
- Do not compete with primary/secondary buttons

**Misuse:**
- Do not use as primary call-to-action
- Do not use for critical actions

**Design Tokens (Semantic):**
- color.semantic.action.tertiary
- color.semantic.text.link

**Figma Naming:** comp/actions/button-tertiary

**Future Django Partial:** templates/components/buttons/tertiary_button.html

**Future Test Considerations:**
- Verify contrast in all states
- Test hover underline

---

### Destructive Button

**Purpose:** Actions that delete, reject, or irrevocably change data.

**Primary Persona:** Supervisor, QA, Manager

**Anatomy:**
- Label text (14-16px)
- Optional icon (alert/trash)
- Padding: 12px 24px (min 48px height)
- Red background or border

**Variants:**
- Filled (high emphasis, e.g., Delete)
- Outlined (lower emphasis, e.g., Reject)

**States:** Default, Hover, Focus, Pressed, Disabled

**Responsive:** Auto width, full width option for mobile

**Accessibility:**
- Clear label
- Focus visible
- Requires confirmation (separate pattern)

**Content Rules:**
- Label: explicit action, e.g., "Delete Record", "Reject"
- English (supervisory actions)

**Usage Rules:**
- Always require confirmation dialog
- Position: separated from primary button
- Use sparingly

**Misuse:**
- Do not use for cancel (use secondary)
- Do not place next to primary without separation

**Design Tokens (Semantic):**
- color.semantic.status.critical
- color.semantic.text.on-critical

**Figma Naming:** comp/actions/button-destructive

**Future Django Partial:** templates/components/buttons/destructive_button.html

**Future Test Considerations:**
- Verify confirmation flow
- Test double-confirmation for high-risk actions

---

### Icon Button

**Purpose:** Actions represented by icon only, for compact UI.

**Primary Persona:** All

**Anatomy:**
- Icon (20-24px)
- Padding: 12px (48×48px minimum)
- Circular or square background (optional)

**Variants:**
- Default (transparent)
- Filled (background)
- Badge (with count indicator)

**States:** Default, Hover, Focus, Pressed, Disabled

**Responsive:** All viewports

**Accessibility:**
- aria-label required (describe action)
- Focus visible
- Touch target ≥48px
- Tooltip on hover (desktop)

**Content Rules:**
- Icon: universally recognized or with tooltip
- Tooltip: action verb, max 20 characters

**Usage Rules:**
- Use for common actions: edit, delete, close, menu
- Provide tooltip on desktop
- Do not use for primary actions on mobile (use labeled button)

**Misuse:**
- Do not use obscure icons
- Do not omit aria-label
- Do not use for complex actions

**Design Tokens (Semantic):**
- color.semantic.action.icon
- size.touch.operator

**Figma Naming:** comp/actions/button-icon

**Future Django Partial:** templates/components/buttons/icon_button.html

**Future Test Considerations:**
- Verify touch target size
- Test tooltip display
- Verify aria-label read by screen readers

---

### Scan Action

**Purpose:** Trigger barcode/QR code scanning (operator workflow).

**Primary Persona:** Operator

**Anatomy:**
- Large icon (scan/camera, 32-40px)
- Label "Scan" (Sinhala/English)
- Prominent styling
- Height: 56-64px

**Variants:**
- Floating action button (FAB)
- Inline button (in form)

**States:** Default, Hover, Focus, Pressed, Disabled, Scanning (active)

**Responsive:** Mobile-optimized

**Accessibility:**
- Clear label
- Focus visible
- Touch target ≥56px
- Announce scanning state

**Content Rules:**
- Label: "Scan [Item]", Sinhala required
- Icon: camera or scan symbol

**Usage Rules:**
- Position: prominent, easy one-handed reach
- Trigger device camera or scanner hardware
- Provide manual entry alternative

**Misuse:**
- Do not hide in menu
- Do not require without manual fallback

**Design Tokens (Semantic):**
- color.semantic.action.scan
- size.touch.operator-large

**Figma Naming:** comp/actions/scan-action

**Future Django Partial:** templates/components/buttons/scan_action.html

**Future Test Considerations:**
- Test camera permission flow
- Verify manual entry alternative
- Test scanning success/failure states

---

## Form Components

### Text Input

**Purpose:** Single-line text entry for general alphanumeric input.

**Primary Persona:** All

**Anatomy:**
- Label (above or floating)
- Input field (height 48-56px for operator)
- Optional hint text
- Optional leading/trailing icon
- Border (1px)

**Variants:**
- Default
- With leading icon
- With trailing action (e.g., clear)

**States:** Default, Focus, Filled, Error, Disabled, Read-only

**Responsive:** Full width on mobile, constrained on desktop

**Accessibility:**
- Label associated (for or aria-labelledby)
- Hint with aria-describedby
- Error with aria-invalid and aria-describedby
- Focus visible

**Content Rules:**
- Label: clear noun, max 40 characters
- Hint: usage tip, max 80 characters
- Placeholder: example only (not instruction)
- Sinhala and English

**Usage Rules:**
- Label always visible (not placeholder-only)
- Clear error message below field
- Auto-capitalize/autocorrect as appropriate

**Misuse:**
- Do not use for long text (use textarea)
- Do not use placeholder as label
- Do not hide label

**Design Tokens (Semantic):**
- color.semantic.input.border
- color.semantic.input.background
- color.semantic.input.error
- size.input.height-operator

**Figma Naming:** comp/forms/text-input

**Future Django Partial:** templates/components/forms/text_input.html

**Future Test Considerations:**
- Test with long Sinhala text
- Verify error association
- Test autofill behavior

---

### Employee Code Input

**Purpose:** Specialized input for employee identification codes.

**Primary Persona:** Operator, Supervisor

**Anatomy:**
- Label "Employee Code"
- Input field (height 56px)
- Scan icon (trailing, if scanning supported)
- Format hint (e.g., "E12345")

**Variants:**
- Manual entry
- With scan action

**States:** Default, Focus, Filled, Error, Disabled, Read-only

**Responsive:** Full width on mobile

**Accessibility:**
- Label associated
- Format hint with aria-describedby
- Error message clear
- Scan button labeled

**Content Rules:**
- Label: "Employee Code" or "කාර්ය මණ්ඩල කේතය"
- Hint: format example from actual system (not invented)
- Error: "Invalid format" or "Not found"

**Usage Rules:**
- Uppercase input
- Validate format and existence
- Scan alternative if supported
- Provide lookup if needed

**Misuse:**
- Do not invent code format
- Do not allow arbitrary text

**Design Tokens (Semantic):**
- color.semantic.input.border
- size.input.height-operator

**Figma Naming:** comp/forms/employee-code-input

**Future Django Partial:** templates/components/forms/employee_code_input.html

**Future Test Considerations:**
- Verify format validation
- Test scan integration
- Test lookup flow

---

### Password Input

**Purpose:** Secure password entry with visibility toggle.

**Primary Persona:** All

**Anatomy:**
- Label "Password"
- Input field (type="password", height 48-56px)
- Toggle visibility icon (trailing, eye icon)
- Optional password requirements text

**Variants:**
- Default
- With requirements hint

**States:** Default, Focus, Filled, Error, Disabled, Visible (toggled)

**Responsive:** Full width on mobile

**Accessibility:**
- Label associated
- Toggle button labeled "Show password" / "Hide password"
- Requirements with aria-describedby
- Error message clear

**Content Rules:**
- Label: "Password" or "මුරපදය"
- Requirements: factual system requirements (no invented policy)
- Toggle: clear show/hide labels

**Usage Rules:**
- Default hidden (type="password")
- Toggle reveals temporarily
- Show requirements on first entry or error
- Consider password manager compatibility

**Misuse:**
- Do not permanently show password
- Do not invent password policy rules
- Do not block paste

**Design Tokens (Semantic):**
- color.semantic.input.border
- size.input.height-operator

**Figma Naming:** comp/forms/password-input

**Future Django Partial:** templates/components/forms/password_input.html

**Future Test Considerations:**
- Verify toggle function
- Test password manager integration
- Verify requirements display

---

### Search Input

**Purpose:** Search and filter content.

**Primary Persona:** All

**Anatomy:**
- Leading search icon (20px)
- Input field (height 44-48px)
- Trailing clear icon (when filled)
- Optional dropdown suggestions

**Variants:**
- Standalone
- In toolbar
- With autocomplete

**States:** Default, Focus, Filled, Loading (suggestions)

**Responsive:** Full width on mobile, 240-400px on desktop

**Accessibility:**
- Label (visible or aria-label="Search")
- Clear button labeled
- Autocomplete with aria-autocomplete, role="combobox"
- Keyboard: Escape to clear, Arrow keys for suggestions

**Content Rules:**
- Placeholder: "Search [context]"
- Sinhala and English
- Suggestions: relevant results

**Usage Rules:**
- Search on enter or after pause (debounce)
- Clear button visible when filled
- Show recent searches if applicable

**Misuse:**
- Do not auto-search on every keystroke (use debounce)
- Do not hide clear action

**Design Tokens (Semantic):**
- color.semantic.input.border
- spacing.input.icon

**Figma Naming:** comp/forms/search-input

**Future Django Partial:** templates/components/forms/search_input.html

**Future Test Considerations:**
- Test debounce timing
- Verify autocomplete behavior
- Test clear action

---

### Number Input

**Purpose:** Numeric input for counts, quantities (not measurements with units).

**Primary Persona:** All

**Anatomy:**
- Label
- Input field (type="number" or inputmode="numeric", height 48-56px)
- Optional stepper buttons (+/-)
- Optional unit label (inline or trailing)

**Variants:**
- Default
- With steppers
- With unit

**States:** Default, Focus, Filled, Error, Disabled, Read-only

**Responsive:** Full width on mobile

**Accessibility:**
- Label associated
- Stepper buttons labeled "+1", "-1"
- Error message clear
- aria-valuemin, aria-valuemax if applicable

**Content Rules:**
- Label: clear quantity name
- Unit: from domain context (e.g., "boxes")
- Sinhala and English

**Usage Rules:**
- Use for counts, integers
- Provide stepper for small increments
- Validate min/max if applicable
- Mobile: numeric keyboard

**Misuse:**
- Do not use for measurements with units (use specialized input)
- Do not allow decimal if count must be integer

**Design Tokens (Semantic):**
- color.semantic.input.border
- size.input.height-operator

**Figma Naming:** comp/forms/number-input

**Future Django Partial:** templates/components/forms/number_input.html

**Future Test Considerations:**
- Verify numeric keyboard on mobile
- Test stepper increment/decrement
- Test min/max validation

---

### Temperature Input

**Purpose:** Temperature measurement entry with unit from template.

**Primary Persona:** Operator

**Anatomy:**
- Label: "Temperature" or specific location (from checklist)
- Input field (type="number", inputmode="decimal", height 56px)
- Unit indicator (from template: °C or °F) - read-only
- Optional expected range hint (from template, if provided)

**Variants:**
- Default (numeric entry)
- With scan/probe action (if equipment supported)

**States:** Default, Focus, Filled, Error (format or out-of-range), Disabled, Read-only

**Responsive:** Full width on mobile

**Accessibility:**
- Label associated, includes location context
- Unit announced by screen reader
- Range hint with aria-describedby
- Error: "Value out of expected range" (if range defined in template)

**Content Rules:**
- Label: from checklist template (do not invent)
- Unit: from checklist template (°C or °F)
- Range hint: from checklist template (if specified) - DECISION REQUIRED if not defined
- Decimal precision: typically 1 decimal place
- Sinhala and English

**Usage Rules:**
- Unit fixed per template, not user-selectable
- Display expected range (if defined in template) as hint, not validation limit
- Out-of-range values trigger warning, not hard error (operator may need to record actual value and escalate)
- Provide probe integration if hardware available
- Allow manual override if probe fails

**Misuse:**
- Do NOT invent temperature limits or ranges
- Do NOT hard-validate against limits not defined in checklist template
- Do NOT auto-fail based on value (failure decision is separate step)
- Do NOT assume unit preference (must come from template configuration)

**Design Tokens (Semantic):**
- color.semantic.input.border
- color.semantic.status.warning (out-of-range hint)
- size.input.height-operator

**Figma Naming:** comp/forms/temperature-input

**Future Django Partial:** templates/components/forms/temperature_input.html

**Future Test Considerations:**
- Verify decimal keyboard on mobile
- Test out-of-range warning (not blocking)
- Test with different unit configurations (°C, °F)
- Verify range hint display when defined
- Test probe integration flow if applicable
- Test manual entry when probe unavailable

**Template Integration Notes:**
- Temperature unit and optional expected range come from checklist template configuration
- System must support both °C and °F based on template
- Expected range (if defined) is displayed as guidance, not hard validation
- Operator can record any value; out-of-range triggers workflow (e.g., escalation, failure recording) per business rules (EVIDENCE REQUIRED)

---

### Text Area

**Purpose:** Multi-line text entry for notes, comments, descriptions.

**Primary Persona:** All

**Anatomy:**
- Label (above)
- Text area (min height 96px, auto-grow or scrollable)
- Character count (if limited)
- Optional hint text

**Variants:**
- Default (auto-grow)
- Fixed height (scrollable)
- With character limit

**States:** Default, Focus, Filled, Error, Disabled, Read-only

**Responsive:** Full width, adjust height for viewport

**Accessibility:**
- Label associated
- Hint with aria-describedby
- Character count announced dynamically
- Error message clear

**Content Rules:**
- Label: clear prompt
- Hint: guidance, max 80 characters
- Placeholder: example (optional)
- Sinhala and English

**Usage Rules:**
- Auto-grow preferred (up to max height)
- Show character count if limit exists
- Clear formatting (plain text)

**Misuse:**
- Do not use for single-word input (use text input)
- Do not hide character limit until exceeded

**Design Tokens (Semantic):**
- color.semantic.input.border
- spacing.input.padding

**Figma Naming:** comp/forms/text-area

**Future Django Partial:** templates/components/forms/text_area.html

**Future Test Considerations:**
- Test auto-grow behavior
- Verify character count accuracy
- Test with long Sinhala text

---

### Date Input

**Purpose:** Date selection for forms and filters.

**Primary Persona:** All

**Anatomy:**
- Label
- Input field (with calendar icon)
- Calendar picker overlay
- Display format: DD/MM/YYYY (localized)

**Variants:**
- Single date
- Date range (start and end)

**States:** Default, Focus, Filled, Error, Disabled, Picker open

**Responsive:** Mobile-optimized picker (native or custom)

**Accessibility:**
- Label associated
- Calendar button labeled "Choose date"
- Picker navigable with keyboard
- Selected date announced

**Content Rules:**
- Label: "Date" or specific (e.g., "Inspection Date")
- Format: DD/MM/YYYY or localized
- Sinhala and English labels

**Usage Rules:**
- Provide picker (avoid manual typing)
- Default to today if appropriate
- Validate date range if applicable

**Misuse:**
- Do not require manual format entry without picker
- Do not use for time (use separate time input)

**Design Tokens (Semantic):**
- color.semantic.input.border
- elevation.picker

**Figma Naming:** comp/forms/date-input

**Future Django Partial:** templates/components/forms/date_input.html

**Future Test Considerations:**
- Test date picker keyboard navigation
- Verify format localization
- Test date range validation

---

### Time Input

**Purpose:** Time selection for shift, scheduled tasks.

**Primary Persona:** All

**Anatomy:**
- Label
- Input field (with clock icon)
- Time picker or native input
- Display format: 12-hour or 24-hour (configurable)

**Variants:**
- Single time
- Time range (start and end)

**States:** Default, Focus, Filled, Error, Disabled

**Responsive:** Mobile-optimized (native picker preferred)

**Accessibility:**
- Label associated
- Picker navigable
- Selected time announced

**Content Rules:**
- Label: "Time" or specific (e.g., "Start Time")
- Format: configurable (12h/24h) - DECISION REQUIRED
- Sinhala and English

**Usage Rules:**
- Use native input on mobile if supported
- Provide picker on desktop
- Validate range if applicable

**Misuse:**
- Do not use for duration (use separate inputs or duration picker)

**Design Tokens (Semantic):**
- color.semantic.input.border

**Figma Naming:** comp/forms/time-input

**Future Django Partial:** templates/components/forms/time_input.html

**Future Test Considerations:**
- Test time format preference
- Verify picker behavior
- Test time range validation

---

### Select (Dropdown)

**Purpose:** Choose one option from a list.

**Primary Persona:** All

**Anatomy:**
- Label
- Selected value display (height 48-56px)
- Dropdown arrow icon
- Options panel (overlay)

**Variants:**
- Default
- With search (if many options)
- Multi-level (hierarchical, if needed)

**States:** Default, Focus, Open, Selected, Error, Disabled

**Responsive:** Full width on mobile, constrained on desktop

**Accessibility:**
- Label associated
- role="combobox" or native select
- Options navigable with keyboard (Arrow keys, type-ahead)
- Selected value announced

**Content Rules:**
- Label: clear noun
- Options: clear, distinct labels
- Default: "Select [item]" or pre-selected if obvious
- Sinhala and English

**Usage Rules:**
- Use for 4-15 options (radio for <4, search/autocomplete for >15)
- Close on selection
- Clear selected value if needed

**Misuse:**
- Do not use for binary choice (use radio or toggle)
- Do not overload with 50+ options (use searchable)

**Design Tokens (Semantic):**
- color.semantic.input.border
- elevation.dropdown

**Figma Naming:** comp/forms/select

**Future Django Partial:** templates/components/forms/select.html

**Future Test Considerations:**
- Test keyboard navigation
- Verify search behavior (if applicable)
- Test with long option labels

---

### Checkbox

**Purpose:** Select zero or more options from a list.

**Primary Persona:** All

**Anatomy:**
- Checkbox indicator (20×20px, larger for operator)
- Label (adjacent, left or right)
- Optional hint text

**Variants:**
- Default
- Group (multiple checkboxes)

**States:** Unchecked, Checked, Indeterminate (parent), Focus, Error, Disabled

**Responsive:** Stack vertically on mobile

**Accessibility:**
- Label associated (wrapping or for)
- role="checkbox" if custom
- aria-checked
- Focus visible
- Touch target ≥48px (including label)

**Content Rules:**
- Label: clear option, max 60 characters
- Sinhala and English

**Usage Rules:**
- Use for multiple independent selections
- Group with fieldset/legend if related
- Clear selected state

**Misuse:**
- Do not use for single binary choice (use toggle)
- Do not nest deeply

**Design Tokens (Semantic):**
- color.semantic.action.primary (checked)
- color.semantic.input.border
- size.checkbox.operator

**Figma Naming:** comp/forms/checkbox

**Future Django Partial:** templates/components/forms/checkbox.html

**Future Test Considerations:**
- Verify focus visible on custom checkbox
- Test indeterminate state (if applicable)
- Test with screen reader

---

### Radio Button

**Purpose:** Select exactly one option from a small list.

**Primary Persona:** All

**Anatomy:**
- Radio indicator (20×20px, larger for operator)
- Label (adjacent)
- Optional hint text

**Variants:**
- Default (vertical stack)
- Horizontal (if 2-3 options)

**States:** Unselected, Selected, Focus, Error, Disabled

**Responsive:** Stack vertically on mobile

**Accessibility:**
- Grouped with fieldset/legend
- role="radio" and role="radiogroup" if custom
- aria-checked
- Focus visible
- Touch target ≥48px
- Arrow keys to switch selection

**Content Rules:**
- Legend: clear question
- Labels: clear options, max 60 characters
- Sinhala and English

**Usage Rules:**
- Use for 2-5 mutually exclusive options
- One option always selected (or explicit "None")
- Group clearly related options

**Misuse:**
- Do not use for >5 options (use select)
- Do not use for independent selections (use checkbox)

**Design Tokens (Semantic):**
- color.semantic.action.primary (selected)
- size.radio.operator

**Figma Naming:** comp/forms/radio

**Future Django Partial:** templates/components/forms/radio.html

**Future Test Considerations:**
- Verify arrow key navigation within group
- Test focus visible
- Test with screen reader

---

### Toggle (Switch)

**Purpose:** Binary on/off setting.

**Primary Persona:** All

**Anatomy:**
- Switch track (40-48px wide, 24-28px high)
- Switch thumb (circular)
- Label (adjacent)
- Optional on/off text

**Variants:**
- Default
- With on/off labels

**States:** Off, On, Focus, Disabled

**Responsive:** All viewports

**Accessibility:**
- Label associated
- role="switch"
- aria-checked
- Focus visible
- Touch target ≥48px (including label)

**Content Rules:**
- Label: clear setting name
- On/off text (if shown): brief
- Sinhala and English

**Usage Rules:**
- Use for immediate binary state change
- State clear without color alone (position + text)
- Immediate effect or clear save action

**Misuse:**
- Do not use for radio selection (use radio)
- Do not use if change requires confirmation

**Design Tokens (Semantic):**
- color.semantic.action.primary (on)
- color.semantic.input.border (off)

**Figma Naming:** comp/forms/toggle

**Future Django Partial:** templates/components/forms/toggle.html

**Future Test Considerations:**
- Verify focus visible
- Test state change immediate feedback
- Test non-color state indication

---

### Pass/Fail Segmented Control

**Purpose:** Operator selection for checklist item pass/fail outcome.

**Primary Persona:** Operator

**Anatomy:**
- Two segments: "Pass" (ප්‍රමාණවත්) / "Fail" (අසමත්)
- Equal width segments
- Height: 56px (operator optimized)
- Clear visual distinction (color + icon)
- Selected state prominent

**Variants:**
- Default (both options)

**States:** Unselected, Pass selected, Fail selected, Focus, Disabled

**Responsive:** Full width on mobile

**Accessibility:**
- role="radiogroup"
- Each segment role="radio"
- aria-checked on selected
- Focus visible
- Touch target ≥56px
- Clear labels
- Success/critical icons + text (not color alone)

**Content Rules:**
- Labels: "Pass" / "Fail" (English) or "ප්‍රමාණවත්" / "අසමත්" (Sinhala)
- Icons: checkmark (pass), X or alert (fail)
- Large, readable text (16-18px)

**Usage Rules:**
- Use for binary pass/fail decisions in checklists
- Selected state clear and immediate
- Fail selection triggers failure details entry (separate component)
- Deselect allowed (return to unanswered state)

**Misuse:**
- Do not use for non-binary choices
- Do not use for navigation
- Do not use outside checklist context

**Design Tokens (Semantic):**
- color.semantic.status.success (pass)
- color.semantic.status.critical (fail)
- size.touch.operator-large

**Figma Naming:** comp/forms/pass-fail-control

**Future Django Partial:** templates/components/forms/pass_fail_control.html

**Future Test Considerations:**
- Verify 56px touch target
- Test with gloves (if applicable)
- Verify focus visible
- Test deselect behavior
- Test failure details trigger on Fail selection
- Verify Sinhala label display

---

### Photo/File Upload

**Purpose:** Attach photos or files as evidence.

**Primary Persona:** Operator (photos), All (files)

**Anatomy:**
- Upload trigger button (with camera/file icon)
- Preview thumbnail (if uploaded)
- File name and size
- Remove action
- Progress indicator (during upload)

**Variants:**
- Photo (camera icon, mobile camera)
- File (document icon, file picker)

**States:** Empty, Uploading, Uploaded, Error, Disabled

**Responsive:** Full width on mobile

**Accessibility:**
- Upload button labeled "Upload photo" or "Upload file"
- Preview image with alt text
- Remove button labeled
- Error message clear
- Upload progress announced

**Content Rules:**
- Button label: "Add Photo" / "Attach File"
- Allowed formats: image/* for photo, defined list for files
- Max size: displayed (DECISION REQUIRED for limit)
- Sinhala and English

**Usage Rules:**
- Mobile: trigger camera directly for photo
- Desktop: file picker
- Show preview after upload
- Allow remove before submit
- Validate format and size client-side
- Queue uploads, don't block form

**Misuse:**
- Do not allow unlimited file size
- Do not hide upload progress
- Do not lose file on error (allow retry)

**Design Tokens (Semantic):**
- color.semantic.action.primary (upload button)
- elevation.preview

**Figma Naming:** comp/forms/photo-file-upload

**Future Django Partial:** templates/components/forms/photo_upload.html, templates/components/forms/file_upload.html

**Future Test Considerations:**
- Test camera access on mobile
- Verify file type validation
- Test upload progress display
- Test remove action
- Test retry on failure

---

### QR/Barcode Trigger

**Purpose:** Initiate barcode or QR code scanning.

**Primary Persona:** Operator

**Anatomy:**
- Large button with scan icon
- Label: "Scan Barcode" or "Scan QR Code"
- Height: 56-64px
- Optional: last scanned value display

**Variants:**
- Barcode
- QR Code
- Universal (both)

**States:** Default, Focus, Scanning (active), Success, Error, Disabled

**Responsive:** Mobile-optimized

**Accessibility:**
- Button labeled clearly
- Focus visible
- Touch target ≥56px
- Scanning state announced
- Success/error announced

**Content Rules:**
- Label: "Scan [type]" in Sinhala and English
- Success: "Scanned: [value]"
- Error: "Scan failed. Try again or enter manually."

**Usage Rules:**
- Prominent placement in relevant forms
- Trigger device camera or scanner hardware
- Display scanned value immediately
- Provide manual entry alternative
- Validate scanned value format

**Misuse:**
- Do not require scan without manual fallback
- Do not hide error recovery options

**Design Tokens (Semantic):**
- color.semantic.action.scan
- size.touch.operator-large

**Figma Naming:** comp/forms/scan-trigger

**Future Django Partial:** templates/components/forms/scan_trigger.html

**Future Test Considerations:**
- Test camera permission flow
- Verify scan success feedback
- Test manual entry fallback
- Verify format validation

---

### Validation Summary

**Purpose:** Display all form validation errors in one place.

**Primary Persona:** All

**Anatomy:**
- Alert box (error styling)
- Heading: "Please fix the following errors"
- Bulleted list of errors
- Each error links to field (jump to error)

**Variants:**
- Default (list)
- Single error (simpler display)

**States:** Visible (errors present), Hidden (no errors)

**Responsive:** Full width

**Accessibility:**
- role="alert" to announce on appearance
- Heading: h2 or strong
- Links to fields with focus on click
- Each error references field label

**Content Rules:**
- Heading: clear, imperative
- Errors: field label + specific issue
- Sinhala and English

**Usage Rules:**
- Display at top of form on submit attempt
- Persist until errors resolved
- Update dynamically as errors fixed
- Link to each field for quick navigation

**Misuse:**
- Do not show only summary (also show inline errors)
- Do not scroll past summary on submit
- Do not use for warnings (use separate pattern)

**Design Tokens (Semantic):**
- color.semantic.status.critical
- spacing.alert.padding

**Figma Naming:** comp/forms/validation-summary

**Future Django Partial:** templates/components/forms/validation_summary.html

**Future Test Considerations:**
- Verify role="alert" announcement
- Test links navigate to fields
- Test dynamic updates as errors resolve

---

### Inline Error

**Purpose:** Display field-specific error message.

**Primary Persona:** All

**Anatomy:**
- Error icon (alert, 16px)
- Error text (14px)
- Red color (semantic.status.critical)
- Below field, left-aligned

**Variants:**
- Default (text + icon)

**States:** Visible (error), Hidden (valid)

**Responsive:** Full width below field

**Accessibility:**
- Associated with field via aria-describedby
- aria-invalid="true" on field
- Icon decorative (aria-hidden)
- Error text clear and specific

**Content Rules:**
- Text: specific, actionable
- Avoid jargon
- Max 80 characters
- Sinhala and English

**Usage Rules:**
- Display on field blur or form submit
- Clear immediately when error resolved
- Pair with field border color change
- Include in validation summary

**Misuse:**
- Do not show on every keystroke (only on blur/submit)
- Do not use for hints (use hint text)
- Do not hide field with long error

**Design Tokens (Semantic):**
- color.semantic.status.critical
- color.semantic.input.error-border

**Figma Naming:** comp/forms/inline-error

**Future Django Partial:** templates/components/forms/inline_error.html

**Future Test Considerations:**
- Verify aria-invalid on field
- Test error clearing on valid input
- Test screen reader announcement

---

## Operational Components

### Task Card

**Purpose:** Display individual task for operator to complete.

**Primary Persona:** Operator

**Anatomy:**
- Task title (16-18px, bold)
- Context info (location, product, time)
- Status badge (New, In Progress, Overdue)
- Due time or recurrence
- Thumbnail icon or image
- Height: min 96px, touch optimized
- Tap area: full card

**Variants:**
- Default
- Overdue (visual priority)
- In Progress (with progress indicator)

**States:** Default, Hover (desktop), Pressed, Selected

**Responsive:** Full width on mobile, grid on tablet

**Accessibility:**
- Card is link or button (entire card tappable)
- Heading: task title
- Status announced
- Focus visible on full card

**Content Rules:**
- Title: clear task, max 60 characters
- Context: location, product (from data)
- Status: New / In Progress / Overdue
- Sinhala and English

**Usage Rules:**
- Display in list or grid (My Tasks)
- Sort by due time or priority
- Tap to open task details
- Clear overdue indication

**Misuse:**
- Do not overload with too much info (summary only)
- Do not require precise tap on small area

**Design Tokens (Semantic):**
- color.semantic.surface.card
- elevation.card
- spacing.card.padding
- size.touch.operator

**Figma Naming:** comp/operational/task-card

**Future Django Partial:** templates/components/operational/task_card.html

**Future Test Considerations:**
- Verify full card tappable
- Test with long Sinhala titles
- Verify status badge visibility

---

### Checklist Section

**Purpose:** Group related checklist items under a heading.

**Primary Persona:** Operator

**Anatomy:**
- Section heading (16-18px, bold)
- Completion indicator (X/Y items)
- Collapsible toggle (if long)
- Items list

**Variants:**
- Expanded (default)
- Collapsed (optional)

**States:** Expanded, Collapsed (if enabled)

**Responsive:** Full width

**Accessibility:**
- Heading: h2 or h3 (semantic level)
- Collapsible: button with aria-expanded
- Completion announced

**Content Rules:**
- Heading: from checklist template
- Completion: "X of Y complete"
- Sinhala and English

**Usage Rules:**
- Group logically related items
- Show completion progress
- Allow collapse if >10 items (optional)

**Misuse:**
- Do not over-nest (max 1 level)
- Do not hide critical incomplete items when collapsed

**Design Tokens (Semantic):**
- color.semantic.text.primary (heading)
- spacing.section.margin

**Figma Naming:** comp/operational/checklist-section

**Future Django Partial:** templates/components/operational/checklist_section.html

**Future Test Considerations:**
- Verify collapse toggle behavior
- Test completion count accuracy

---

### Checklist Item

**Purpose:** Individual check, measurement, or observation in checklist.

**Primary Persona:** Operator

**Anatomy:**
- Item label (14-16px)
- Answer control (pass/fail, measurement input, etc.)
- Status indicator (incomplete, pass, fail)
- Optional: expected value hint
- Optional: evidence attachment trigger
- Height: min 64px (depends on control)

**Variants:**
- Pass/Fail
- Measurement (temperature, count, etc.)
- Observation (text)

**States:** Unanswered, Answered (pass), Answered (fail), Error

**Responsive:** Full width

**Accessibility:**
- Label clear and associated
- Answer control accessible (per type)
- Status announced
- Error message clear

**Content Rules:**
- Label: from checklist template (do not invent)
- Hint: expected range or target (from template, if defined)
- Sinhala and English

**Usage Rules:**
- Display in logical order
- Auto-save answers locally (offline support)
- Highlight incomplete or failed items
- Provide evidence attachment for failures

**Misuse:**
- Do not invent checklist items
- Do not hard-block on out-of-range values (warn and allow escalation)
- Do not hide failure details entry

**Design Tokens (Semantic):**
- color.semantic.surface.item
- spacing.item.padding
- size.touch.operator

**Figma Naming:** comp/operational/checklist-item

**Future Django Partial:** templates/components/operational/checklist_item.html

**Future Test Considerations:**
- Verify auto-save behavior
- Test with different answer types
- Verify status indication without color alone

---

### Pass/Fail Answer

**Purpose:** Display answered pass/fail status in checklist item.

**Primary Persona:** Operator, Reviewer

**Anatomy:**
- Pass/Fail segmented control (answered state)
- Icon (checkmark or X)
- Timestamp (when answered)
- Operator name (if reviewing)

**Variants:**
- Pass
- Fail (with failure details link)

**States:** Answered, Read-only (review mode)

**Responsive:** Full width

**Accessibility:**
- Status announced
- Icon decorative (status in text)
- Timestamp and operator readable

**Content Rules:**
- Status: "Pass" / "Fail" with icon
- Timestamp: "Answered at [time]"
- Sinhala and English

**Usage Rules:**
- Display after answer selected
- Link to failure details if Fail
- Read-only in review mode

**Misuse:**
- Do not allow answer change without clear action
- Do not hide failure details

**Design Tokens (Semantic):**
- color.semantic.status.success
- color.semantic.status.critical

**Figma Naming:** comp/operational/pass-fail-answer

**Future Django Partial:** templates/components/operational/pass_fail_answer.html

**Future Test Considerations:**
- Verify read-only state in review
- Test failure details link

---

### Measurement Answer

**Purpose:** Display measured value in checklist item.

**Primary Persona:** Operator, Reviewer

**Anatomy:**
- Measured value with unit
- Timestamp
- Operator name (if reviewing)
- Optional: expected range reference
- Out-of-range indicator (if applicable)

**Variants:**
- In range
- Out of range (warning)

**States:** Answered, Read-only (review mode)

**Responsive:** Full width

**Accessibility:**
- Value and unit announced together
- Out-of-range status announced
- Timestamp readable

**Content Rules:**
- Value: formatted with precision (e.g., 1 decimal)
- Unit: from template
- Range: from template (if defined)
- Sinhala and English labels

**Usage Rules:**
- Display after measurement entered
- Indicate out-of-range with warning (not error)
- Read-only in review mode

**Misuse:**
- Do not invent ranges
- Do not block workflow on out-of-range (warn and escalate)

**Design Tokens (Semantic):**
- color.semantic.text.primary
- color.semantic.status.warning (out-of-range)

**Figma Naming:** comp/operational/measurement-answer

**Future Django Partial:** templates/components/operational/measurement_answer.html

**Future Test Considerations:**
- Verify out-of-range warning display
- Test with different units

---

### Failure Details

**Purpose:** Capture details when checklist item fails.

**Primary Persona:** Operator

**Anatomy:**
- Failure reason (select or text)
- Failure description (text area)
- Evidence attachment (photo)
- Corrective action taken (text area, optional)
- Escalation flag (toggle or auto)

**Variants:**
- Default (reason + description)
- With evidence
- With corrective action

**States:** Empty, Filled, Submitting

**Responsive:** Full width, may be modal or inline

**Accessibility:**
- All fields labeled
- Required fields indicated
- Error messages clear
- Focus on first field when opened

**Content Rules:**
- Reason: from predefined list (DECISION REQUIRED) or free text
- Description: plain text, required
- Sinhala and English

**Usage Rules:**
- Display when checklist item marked Fail
- Require at minimum: description
- Encourage evidence photo
- Auto-escalate critical failures (per business rules - EVIDENCE REQUIRED)

**Misuse:**
- Do not allow skip without capturing details
- Do not pre-fill with generic text

**Design Tokens (Semantic):**
- color.semantic.surface.panel
- spacing.panel.padding

**Figma Naming:** comp/operational/failure-details

**Future Django Partial:** templates/components/operational/failure_details.html

**Future Test Considerations:**
- Verify required field validation
- Test photo attachment
- Test escalation trigger (if applicable)

---

### Evidence Card

**Purpose:** Display attached photo or file evidence.

**Primary Persona:** Operator, Reviewer

**Anatomy:**
- Thumbnail image (if photo)
- File name and size (if file)
- Timestamp and operator
- View/download action
- Remove action (if editable)

**Variants:**
- Photo (image thumbnail)
- File (icon + name)

**States:** Default, Hover (desktop), Uploading, Error

**Responsive:** Full width or grid

**Accessibility:**
- Image alt text with context
- View/download button labeled
- Remove button labeled (if editable)
- Keyboard accessible

**Content Rules:**
- Timestamp: "Uploaded [date time]"
- Operator: name or code
- File name: as uploaded

**Usage Rules:**
- Display in evidence list
- Allow view in lightbox or new tab
- Allow remove if editable (before submit)
- Show upload progress if async

**Misuse:**
- Do not allow delete after submit (data integrity)
- Do not show full-size inline (use thumbnail)

**Design Tokens (Semantic):**
- elevation.card
- spacing.card.padding

**Figma Naming:** comp/operational/evidence-card

**Future Django Partial:** templates/components/operational/evidence_card.html

**Future Test Considerations:**
- Test lightbox view
- Verify remove action (if editable)
- Test with missing image (broken)

---

### Upload Progress

**Purpose:** Show file/photo upload progress.

**Primary Persona:** Operator

**Anatomy:**
- Progress bar (0-100%)
- File name
- Percentage or "Uploading..." label
- Cancel action (optional)

**Variants:**
- Determinate (percentage known)
- Indeterminate (percentage unknown)

**States:** Uploading, Complete, Error, Cancelled

**Responsive:** Full width

**Accessibility:**
- aria-live="polite" for progress updates
- aria-valuenow, aria-valuemin, aria-valuemax
- Complete/error announced

**Content Rules:**
- Label: "Uploading [filename]" or "[X]% complete"
- Sinhala and English

**Usage Rules:**
- Show during upload
- Hide on complete (after brief delay)
- Allow cancel if upload can be aborted
- Show error with retry option

**Misuse:**
- Do not block entire form during upload
- Do not hide errors

**Design Tokens (Semantic):**
- color.semantic.action.primary (progress)
- spacing.progress.padding

**Figma Naming:** comp/operational/upload-progress

**Future Django Partial:** templates/components/operational/upload_progress.html

**Future Test Considerations:**
- Verify progress announcement
- Test cancel action (if applicable)
- Test error and retry

---

### Checklist Progress

**Purpose:** Show overall completion status of checklist.

**Primary Persona:** Operator

**Anatomy:**
- Progress bar or fraction (X/Y items)
- Label: "X of Y complete"
- Optional: failed items count
- Sticky position at top or bottom

**Variants:**
- Bar (visual)
- Text (numeric)
- Combined

**States:** In progress, Complete (all answered), Has failures

**Responsive:** Full width, sticky bottom on mobile

**Accessibility:**
- aria-valuenow, aria-valuemin, aria-valuemax
- Status announced
- Failure count announced

**Content Rules:**
- Label: "X of Y complete" or "X incomplete"
- Failure: "X failed items"
- Sinhala and English

**Usage Rules:**
- Persistent display during checklist
- Update dynamically as items answered
- Highlight failures clearly

**Misuse:**
- Do not hide incomplete items
- Do not allow submit until complete (or explicitly allowed)

**Design Tokens (Semantic):**
- color.semantic.action.primary (progress)
- color.semantic.status.critical (failures)

**Figma Naming:** comp/operational/checklist-progress

**Future Django Partial:** templates/components/operational/checklist_progress.html

**Future Test Considerations:**
- Verify dynamic updates
- Test sticky positioning
- Verify progress announcement

---

### Incomplete Indicator

**Purpose:** Highlight unanswered checklist items.

**Primary Persona:** Operator

**Anatomy:**
- Icon (circle or alert)
- Label: "Incomplete"
- Color: neutral or warning

**Variants:**
- Icon only
- Icon + label

**States:** Visible (incomplete), Hidden (answered)

**Responsive:** Inline with checklist item

**Accessibility:**
- Icon with aria-label or adjacent text
- Status announced

**Content Rules:**
- Label: "Incomplete" or "Not answered"
- Sinhala and English

**Usage Rules:**
- Display on unanswered items
- Clear on answer
- Allow jump to next incomplete

**Misuse:**
- Do not use same indicator for failed items (use different style)

**Design Tokens (Semantic):**
- color.semantic.status.warning
- color.semantic.text.secondary

**Figma Naming:** comp/operational/incomplete-indicator

**Future Django Partial:** templates/components/operational/incomplete_indicator.html

**Future Test Considerations:**
- Verify visibility
- Test jump-to-next behavior

---

### Failed Indicator

**Purpose:** Highlight failed checklist items.

**Primary Persona:** Operator, Reviewer

**Anatomy:**
- Icon (X or alert, critical color)
- Label: "Failed"
- Link to failure details

**Variants:**
- Icon only
- Icon + label

**States:** Visible (failed), Hidden (not failed)

**Responsive:** Inline with checklist item

**Accessibility:**
- Icon with aria-label
- Link to failure details labeled
- Status announced

**Content Rules:**
- Label: "Failed" or "අසමත්"
- Sinhala and English

**Usage Rules:**
- Display on failed items
- Link to failure details
- Allow jump to next failure

**Misuse:**
- Do not hide failure details
- Do not use same indicator as incomplete

**Design Tokens (Semantic):**
- color.semantic.status.critical

**Figma Naming:** comp/operational/failed-indicator

**Future Django Partial:** templates/components/operational/failed_indicator.html

**Future Test Considerations:**
- Verify critical color visibility
- Test link to failure details

---

### Attestation Panel

**Purpose:** Operator attests to accuracy before submission.

**Primary Persona:** Operator

**Anatomy:**
- Attestation statement (read-only text)
- Checkbox: "I confirm..." or signature field
- Submit button (enabled when attested)

**Variants:**
- Checkbox confirmation
- Signature (if required - DECISION REQUIRED)

**States:** Not attested, Attested, Submitting

**Responsive:** Full width

**Accessibility:**
- Statement readable, clear font size
- Checkbox labeled
- Submit button disabled until attested
- Focus on checkbox when panel opens

**Content Rules:**
- Statement: clear, factual, from legal/compliance (EVIDENCE REQUIRED)
- Checkbox label: "I confirm the above information is accurate"
- Sinhala and English

**Usage Rules:**
- Display before final submission
- Require explicit attestation (checkbox or signature)
- Record attestation timestamp and operator

**Misuse:**
- Do not hide statement (must be readable)
- Do not allow submit without attestation
- Do not pre-check checkbox

**Design Tokens (Semantic):**
- color.semantic.surface.panel
- spacing.panel.padding

**Figma Naming:** comp/operational/attestation-panel

**Future Django Partial:** templates/components/operational/attestation_panel.html

**Future Test Considerations:**
- Verify submit disabled until attested
- Test attestation recording
- Verify statement readability

---

### Submission Confirmation

**Purpose:** Confirm successful checklist submission.

**Primary Persona:** Operator

**Anatomy:**
- Success icon (large checkmark)
- Heading: "Submitted Successfully"
- Timestamp and operator
- Reference number (if generated)
- Next actions (buttons: View, New Task, Done)

**Variants:**
- Default
- With reference number

**States:** Displayed after submit success

**Responsive:** Full width, centered content

**Accessibility:**
- role="alert" or focus on heading
- Success announced
- Buttons labeled clearly

**Content Rules:**
- Heading: "Submitted Successfully" or "සාර්ථකව ඉදිරිපත් කරන ලදී"
- Timestamp: "Submitted at [time]"
- Reference: if applicable

**Usage Rules:**
- Display after successful submit
- Provide clear next actions
- Auto-dismiss after timeout (optional) or require user action

**Misuse:**
- Do not show if submit failed
- Do not hide reference number if important

**Design Tokens (Semantic):**
- color.semantic.status.success
- spacing.panel.padding

**Figma Naming:** comp/operational/submission-confirmation

**Future Django Partial:** templates/components/operational/submission_confirmation.html

**Future Test Considerations:**
- Verify success announcement
- Test next action buttons
- Test auto-dismiss (if applicable)

---

### Record Timeline

**Purpose:** Show chronological history of record events (submit, review, approve, etc.).

**Primary Persona:** Supervisor, QA, Manager

**Anatomy:**
- Vertical timeline
- Each event: icon, timestamp, actor, action, optional note
- Reverse chronological order (newest first)

**Variants:**
- Compact (icon + timestamp + action)
- Detailed (with notes)

**States:** Default

**Responsive:** Full width

**Accessibility:**
- Ordered list or timeline role
- Each event readable
- Icons decorative (text describes action)

**Content Rules:**
- Action: "Submitted by [operator]", "Approved by [reviewer]", "Amended by [operator]"
- Timestamp: full date and time
- Note: if applicable
- English (supervisory view)

**Usage Rules:**
- Display on record detail page
- Show all significant events
- Newest first

**Misuse:**
- Do not hide critical events
- Do not show trivial events (e.g., every field change)

**Design Tokens (Semantic):**
- color.semantic.text.secondary (timestamp)
- spacing.timeline.event

**Figma Naming:** comp/operational/record-timeline

**Future Django Partial:** templates/components/operational/record_timeline.html

**Future Test Considerations:**
- Verify chronological order
- Test with many events (pagination if needed)

---

### Amendment Item

**Purpose:** Display before/after values for amended record field.

**Primary Persona:** Supervisor, QA, Manager

**Anatomy:**
- Field label
- Original value (with strikethrough or "was:")
- New value (highlighted or "now:")
- Timestamp and operator
- Reason for amendment

**Variants:**
- Default
- With reason

**States:** Default

**Responsive:** Full width

**Accessibility:**
- Label clear
- Original and new values distinct
- Reason readable

**Content Rules:**
- Label: field name
- Original: "Was: [value]"
- New: "Now: [value]"
- Reason: plain text
- English (supervisory view)

**Usage Rules:**
- Display in amendment history
- Show all changed fields
- Include reason for amendment

**Misuse:**
- Do not hide original value
- Do not allow amendment without reason (per business rules - EVIDENCE REQUIRED)

**Design Tokens (Semantic):**
- color.semantic.text.secondary (original)
- color.semantic.text.primary (new)

**Figma Naming:** comp/operational/amendment-item

**Future Django Partial:** templates/components/operational/amendment_item.html

**Future Test Considerations:**
- Verify distinct styling for original/new
- Test with multiple amendments

---

## Feedback Components

### Status Badge

**Purpose:** Display discrete status values (New, In Progress, Complete, etc.).

**Primary Persona:** All

**Anatomy:**
- Text label (12-14px)
- Background color (semantic)
- Padding: 4px 8px
- Border radius: 4px
- Optional: leading icon

**Variants:**
- Default
- With icon

**States:** Static (not interactive)

**Responsive:** Inline, auto-width

**Accessibility:**
- Status in text (not color alone)
- Optional icon decorative

**Content Rules:**
- Label: concise status, max 16 characters
- Sinhala and English

**Usage Rules:**
- Use for status, priority, category
- Consistent colors per status type
- Non-interactive (not button)

**Misuse:**
- Do not use for actions (use button)
- Do not use too many color variants (max 5-6 semantic)

**Design Tokens (Semantic):**
- color.semantic.status.success
- color.semantic.status.warning
- color.semantic.status.critical
- color.semantic.status.info
- color.semantic.status.neutral

**Figma Naming:** comp/feedback/status-badge

**Future Django Partial:** templates/components/feedback/status_badge.html

**Future Test Considerations:**
- Verify contrast ratios
- Test with icon variants

---

### Success Banner

**Purpose:** Confirm successful action or operation.

**Primary Persona:** All

**Anatomy:**
- Success icon (checkmark)
- Heading (optional)
- Message text
- Dismiss action (×)
- Background: success color (soft)
- Border: success color

**Variants:**
- Default (with heading)
- Simple (message only)

**States:** Visible, Dismissed

**Responsive:** Full width

**Accessibility:**
- role="alert" or aria-live="polite"
- Success announced
- Dismiss button labeled

**Content Rules:**
- Heading: "Success" or specific (e.g., "Record Saved")
- Message: confirmation detail, max 120 characters
- Sinhala and English

**Usage Rules:**
- Display after successful action
- Auto-dismiss after 5-10s or manual dismiss
- Do not block content

**Misuse:**
- Do not use for ongoing status (use different indicator)
- Do not show multiple competing banners

**Design Tokens (Semantic):**
- color.semantic.status.success
- color.semantic.background.success-soft
- spacing.banner.padding

**Figma Naming:** comp/feedback/banner-success

**Future Django Partial:** templates/components/feedback/banner_success.html

**Future Test Considerations:**
- Verify role="alert" announcement
- Test auto-dismiss timing
- Test manual dismiss

---

### Warning Banner

**Purpose:** Warn user of potential issue or caution.

**Primary Persona:** All

**Anatomy:**
- Warning icon (alert triangle)
- Heading: "Warning"
- Message text
- Optional: action button
- Dismiss action (×)
- Background: warning color (soft)
- Border: warning color

**Variants:**
- Default (with action)
- Simple (message only)

**States:** Visible, Dismissed

**Responsive:** Full width

**Accessibility:**
- role="alert" or aria-live="polite"
- Warning announced
- Action button labeled
- Dismiss button labeled

**Content Rules:**
- Heading: "Warning" or specific
- Message: clear issue, max 160 characters
- Action: if applicable (e.g., "Review")
- Sinhala and English

**Usage Rules:**
- Display for non-blocking issues
- Allow dismiss if user can proceed
- Persist if critical until resolved

**Misuse:**
- Do not use for critical errors (use critical banner)
- Do not overuse (only for genuine warnings)

**Design Tokens (Semantic):**
- color.semantic.status.warning
- color.semantic.background.warning-soft
- spacing.banner.padding

**Figma Naming:** comp/feedback/banner-warning

**Future Django Partial:** templates/components/feedback/banner_warning.html

**Future Test Considerations:**
- Verify warning announced
- Test action button (if present)
- Verify contrast (warning color NOT AA for body text - large text only or darken)

---

### Critical Banner

**Purpose:** Display critical error or blocking issue.

**Primary Persona:** All

**Anatomy:**
- Critical icon (X or alert)
- Heading: "Error" or "Critical"
- Message text
- Optional: action button (e.g., "Retry")
- Background: critical color (soft)
- Border: critical color

**Variants:**
- Default (with action)
- Simple (message only)

**States:** Visible, Resolved (dismissed)

**Responsive:** Full width, prominent position (top)

**Accessibility:**
- role="alert"
- Error announced immediately
- Action button labeled
- Focus on action or heading

**Content Rules:**
- Heading: "Error" or specific (e.g., "Submission Failed")
- Message: clear issue and guidance, max 200 characters
- Action: if applicable (e.g., "Retry", "Contact Support")
- Sinhala and English

**Usage Rules:**
- Display for blocking errors
- Do not auto-dismiss (require user action)
- Provide recovery action if possible

**Misuse:**
- Do not use for warnings (use warning banner)
- Do not hide recovery options

**Design Tokens (Semantic):**
- color.semantic.status.critical
- color.semantic.background.critical-soft
- spacing.banner.padding

**Figma Naming:** comp/feedback/banner-critical

**Future Django Partial:** templates/components/feedback/banner_critical.html

**Future Test Considerations:**
- Verify role="alert"
- Test action button (retry, etc.)
- Verify error message clarity

---

### Info Banner

**Purpose:** Provide informational notice.

**Primary Persona:** All

**Anatomy:**
- Info icon (i or circle)
- Heading: "Information" or specific
- Message text
- Dismiss action (×)
- Background: info color (soft)
- Border: info color

**Variants:**
- Default
- Simple

**States:** Visible, Dismissed

**Responsive:** Full width

**Accessibility:**
- aria-live="polite" (not role="alert", less urgent)
- Info announced
- Dismiss button labeled

**Content Rules:**
- Heading: "Information" or specific
- Message: helpful context, max 160 characters
- Sinhala and English

**Usage Rules:**
- Display for helpful but non-urgent info
- Allow dismiss
- Do not overuse

**Misuse:**
- Do not use for errors or warnings
- Do not block critical content

**Design Tokens (Semantic):**
- color.semantic.status.info
- color.semantic.background.info-soft
- spacing.banner.padding

**Figma Naming:** comp/feedback/banner-info

**Future Django Partial:** templates/components/feedback/banner_info.html

**Future Test Considerations:**
- Verify aria-live announcement
- Test dismiss action

---

### Offline Banner

**Purpose:** Indicate offline mode and unsaved changes.

**Primary Persona:** Operator

**Anatomy:**
- Offline icon (cloud with slash)
- Message: "You are offline. Changes will be saved locally and synced when online."
- Background: warning or neutral
- Persistent (do not dismiss until online)

**Variants:**
- Default

**States:** Visible (offline), Hidden (online)

**Responsive:** Full width, sticky top

**Accessibility:**
- role="alert" on appearance
- Offline status announced
- Persistent (no dismiss)

**Content Rules:**
- Message: clear offline status and data safety
- Wording carefully avoids confusion between "saved locally" and "submitted to server"
- Sinhala and English

**Usage Rules:**
- Display when offline detected
- Persist until online
- Update when sync occurs

**Misuse:**
- Do not use generic "error" wording
- Do not allow dismiss while offline
- Do not confuse "local save" with "submitted"

**Design Tokens (Semantic):**
- color.semantic.status.warning
- color.semantic.background.warning-soft
- spacing.banner.padding

**Figma Naming:** comp/feedback/banner-offline

**Future Django Partial:** templates/components/feedback/banner_offline.html

**Future Test Considerations:**
- Verify offline detection
- Test online transition (banner hides)
- Test sync status update

---

### Sync Status

**Purpose:** Indicate sync status between local and server.

**Primary Persona:** Operator

**Anatomy:**
- Icon (syncing, synced, error)
- Text: "Synced", "Syncing...", "Sync Failed"
- Timestamp: "Last synced [time]"
- Retry action (if failed)

**Variants:**
- Synced
- Syncing
- Sync failed

**States:** Synced, Syncing, Failed

**Responsive:** Inline or sticky (e.g., in bottom bar)

**Accessibility:**
- aria-live="polite" for status updates
- Retry button labeled

**Content Rules:**
- Text: "Synced", "Syncing...", "Sync Failed"
- Timestamp: "Last synced [X min ago]"
- Sinhala and English

**Usage Rules:**
- Display during and after sync
- Update dynamically
- Provide retry if failed

**Misuse:**
- Do not confuse "synced" with "submitted" (different concepts)
- Do not hide failed sync

**Design Tokens (Semantic):**
- color.semantic.status.success (synced)
- color.semantic.status.warning (syncing)
- color.semantic.status.critical (failed)

**Figma Naming:** comp/feedback/sync-status

**Future Django Partial:** templates/components/feedback/sync_status.html

**Future Test Considerations:**
- Verify status updates
- Test retry action
- Verify timestamp accuracy

---

### Toast

**Purpose:** Brief notification message, auto-dismissing.

**Primary Persona:** All

**Anatomy:**
- Icon (status-specific)
- Message text (one line preferred)
- Close action (×, optional)
- Position: bottom center or top right
- Auto-dismiss after 3-5s

**Variants:**
- Success
- Warning
- Error
- Info

**States:** Visible, Dismissed

**Responsive:** Fixed width (mobile: ~90% viewport), positioned over content

**Accessibility:**
- role="alert" or aria-live="polite"
- Message announced
- Close button labeled (if present)

**Content Rules:**
- Message: concise, max 80 characters
- Sinhala and English

**Usage Rules:**
- Use for brief confirmations
- Auto-dismiss after 3-5s
- Do not stack many toasts (queue or replace)

**Misuse:**
- Do not use for critical errors (use banner or modal)
- Do not require user action in toast (use modal)

**Design Tokens (Semantic):**
- color.semantic.status.* (per variant)
- elevation.toast
- spacing.toast.padding

**Figma Naming:** comp/feedback/toast

**Future Django Partial:** templates/components/feedback/toast.html

**Future Test Considerations:**
- Verify auto-dismiss timing
- Test multiple toasts (queue behavior)
- Verify announcement

---

### Empty State

**Purpose:** Display when list or content area has no data.

**Primary Persona:** All

**Anatomy:**
- Illustration or icon (large)
- Heading: "No [items] yet"
- Message: explanation or guidance
- Optional: action button (e.g., "Add [item]")

**Variants:**
- Default (with action)
- Simple (no action)

**States:** Displayed when empty

**Responsive:** Centered, responsive sizing

**Accessibility:**
- Heading clear
- Message readable
- Action button labeled (if present)

**Content Rules:**
- Heading: "No tasks yet" (example)
- Message: "Your tasks will appear here."
- Sinhala and English

**Usage Rules:**
- Display when list is empty
- Provide action if user can add items
- Clear, friendly tone

**Misuse:**
- Do not show error when simply empty
- Do not overload with too much text

**Design Tokens (Semantic):**
- color.semantic.text.secondary
- spacing.empty-state.padding

**Figma Naming:** comp/feedback/empty-state

**Future Django Partial:** templates/components/feedback/empty_state.html

**Future Test Considerations:**
- Verify action button (if present)
- Test with no action variant

---

### Error State

**Purpose:** Display when content fails to load or error occurs.

**Primary Persona:** All

**Anatomy:**
- Error icon
- Heading: "Something went wrong"
- Message: explanation
- Action button: "Retry" or "Contact Support"

**Variants:**
- Retry (transient error)
- Contact support (persistent error)

**States:** Displayed on error

**Responsive:** Centered

**Accessibility:**
- role="alert"
- Error announced
- Action button labeled

**Content Rules:**
- Heading: "Something went wrong" or specific
- Message: clear explanation, avoid jargon
- Action: "Retry" or "Contact Support"
- Sinhala and English

**Usage Rules:**
- Display when load fails
- Provide retry action
- Log error details (for support)

**Misuse:**
- Do not use for empty state (use empty state)
- Do not hide error from user

**Design Tokens (Semantic):**
- color.semantic.status.critical
- spacing.error-state.padding

**Figma Naming:** comp/feedback/error-state

**Future Django Partial:** templates/components/feedback/error_state.html

**Future Test Considerations:**
- Verify retry action
- Test error message display

---

### Loading Skeleton

**Purpose:** Placeholder during content load.

**Primary Persona:** All

**Anatomy:**
- Gray rectangles or shapes matching content layout
- Subtle animation (shimmer or pulse)

**Variants:**
- List (repeating rows)
- Card
- Form
- Table

**States:** Loading (animated), Hidden (content loaded)

**Responsive:** Match content layout

**Accessibility:**
- aria-live="polite" or aria-busy on container
- "Loading..." announced once

**Content Rules:**
- No text (visual only)
- Match expected content structure

**Usage Rules:**
- Display during initial load
- Replace with content when loaded
- Match layout to reduce shift

**Misuse:**
- Do not show for instant loads (<200ms)
- Do not show indefinitely (timeout to error state)

**Design Tokens (Semantic):**
- color.semantic.background.skeleton
- motion.skeleton-shimmer

**Figma Naming:** comp/feedback/loading-skeleton

**Future Django Partial:** templates/components/feedback/loading_skeleton.html

**Future Test Considerations:**
- Verify animation performance
- Test content swap (no layout shift)

---

### Retry Panel

**Purpose:** Allow user to retry failed operation.

**Primary Persona:** All

**Anatomy:**
- Error icon
- Message: "Failed to load [content]"
- Retry button
- Optional: error details (expandable)

**Variants:**
- Default
- With error details

**States:** Displayed on error

**Responsive:** Full width or centered

**Accessibility:**
- role="alert"
- Error announced
- Retry button labeled

**Content Rules:**
- Message: clear failure description
- Button: "Retry" or "Try Again"
- Sinhala and English

**Usage Rules:**
- Display when operation fails
- Provide clear retry action
- Log error details

**Misuse:**
- Do not loop retries indefinitely (limit attempts)
- Do not hide error from user

**Design Tokens (Semantic):**
- color.semantic.status.critical
- spacing.panel.padding

**Figma Naming:** comp/feedback/retry-panel

**Future Django Partial:** templates/components/feedback/retry_panel.html

**Future Test Considerations:**
- Verify retry action
- Test error details expand (if applicable)
- Test retry limit logic

---

## Review Components

### Review Queue Item

**Purpose:** Display record in review queue for supervisor/QA.

**Primary Persona:** Supervisor, QA

**Anatomy:**
- Record identifier (number, type)
- Operator name
- Submission timestamp
- Status (Pending Review, Flagged, etc.)
- Priority indicator (if applicable)
- Tap to open detail
- Height: min 80px

**Variants:**
- Default
- Flagged (critical failure)
- Overdue

**States:** Default, Hover, Pressed, Selected

**Responsive:** Full width on mobile, grid on desktop

**Accessibility:**
- Card is link or button
- Heading: record identifier
- Status announced
- Focus visible

**Content Rules:**
- Identifier: from system
- Operator: name or code
- Timestamp: relative (e.g., "2 hours ago") or absolute
- Status: clear label
- English (supervisory view)

**Usage Rules:**
- Display in review queue list
- Sort by priority, timestamp, or status
- Tap to open detail
- Flag critical items visually

**Misuse:**
- Do not overload with too much detail (summary only)
- Do not hide priority or flags

**Design Tokens (Semantic):**
- color.semantic.surface.card
- elevation.card
- spacing.card.padding

**Figma Naming:** comp/review/queue-item

**Future Django Partial:** templates/components/review/queue_item.html

**Future Test Considerations:**
- Verify full card tappable
- Test priority sorting
- Verify flag visibility

---

### Failure Summary

**Purpose:** Summarize failed items in record under review.

**Primary Persona:** Supervisor, QA

**Anatomy:**
- Failure count: "X failed items"
- List of failed items (item label + failure reason)
- Link to each failure for detail

**Variants:**
- Default
- Expandable (if many failures)

**States:** Expanded, Collapsed (if many)

**Responsive:** Full width

**Accessibility:**
- Heading: "Failed Items"
- List readable
- Links to failures labeled

**Content Rules:**
- Count: "X failed items" or "X critical failures"
- Item: label + short reason
- English

**Usage Rules:**
- Display prominently on review detail page
- Link to each failure detail
- Highlight critical failures

**Misuse:**
- Do not hide failures
- Do not summarize without detail link

**Design Tokens (Semantic):**
- color.semantic.status.critical
- spacing.summary.padding

**Figma Naming:** comp/review/failure-summary

**Future Django Partial:** templates/components/review/failure_summary.html

**Future Test Considerations:**
- Verify failure links
- Test expandable behavior (if applicable)

---

### Evidence Preview

**Purpose:** Preview attached evidence (photos, files) during review.

**Primary Persona:** Supervisor, QA

**Anatomy:**
- Thumbnail image (if photo)
- File name and size (if file)
- View/download action
- Timestamp and operator

**Variants:**
- Photo (image thumbnail)
- File (icon + name)

**States:** Default, Hover, Lightbox open

**Responsive:** Grid or list

**Accessibility:**
- Image alt text with context
- View/download button labeled
- Lightbox accessible

**Content Rules:**
- Timestamp: "Uploaded [date time]"
- Operator: name or code
- File name: as uploaded
- English

**Usage Rules:**
- Display in evidence section
- Allow view in lightbox
- Allow download

**Misuse:**
- Do not show full-size inline (use thumbnail)
- Do not allow delete during review (data integrity)

**Design Tokens (Semantic):**
- elevation.card
- spacing.card.padding

**Figma Naming:** comp/review/evidence-preview

**Future Django Partial:** templates/components/review/evidence_preview.html

**Future Test Considerations:**
- Test lightbox view
- Verify download action
- Test with missing image

---

### Approval Actions

**Purpose:** Actions for reviewer to approve or reject record.

**Primary Persona:** Supervisor, QA

**Anatomy:**
- Approve button (primary, success color)
- Return for Correction button (secondary)
- Reject button (destructive, if applicable)
- Optional: comment field
- Sticky position at bottom

**Variants:**
- Default (Approve + Return)
- With Reject

**States:** Default, Submitting, Success, Error

**Responsive:** Full width on mobile, inline on desktop

**Accessibility:**
- All buttons labeled clearly
- Comment field labeled (if present)
- Confirmation required for Reject (per business rules)
- Focus on primary action

**Content Rules:**
- Approve: "Approve" or "Accept"
- Return: "Return for Correction"
- Reject: "Reject" (if allowed)
- English

**Usage Rules:**
- Display after review
- Approve requires all items reviewed (per business rules - EVIDENCE REQUIRED)
- Return requires comment (reason)
- Reject requires confirmation + reason

**Misuse:**
- Do not allow approve without review (enforce per business rules)
- Do not hide rejection reason

**Design Tokens (Semantic):**
- color.semantic.status.success (approve)
- color.semantic.status.critical (reject)
- spacing.actions.padding

**Figma Naming:** comp/review/approval-actions

**Future Django Partial:** templates/components/review/approval_actions.html

**Future Test Considerations:**
- Verify approval flow
- Test return-for-correction with comment
- Test reject confirmation (if applicable)

---

### Return-for-Correction Panel

**Purpose:** Return record to operator with correction instructions.

**Primary Persona:** Supervisor, QA

**Anatomy:**
- Reason/comment field (required)
- List of items to correct (checkboxes)
- Return button
- Cancel button

**Variants:**
- Default

**States:** Default, Submitting

**Responsive:** Full width

**Accessibility:**
- Comment field labeled
- Item checkboxes labeled
- Return button enabled when comment filled
- Focus on comment field

**Content Rules:**
- Label: "Reason for Return"
- Placeholder: "Explain what needs correction"
- English

**Usage Rules:**
- Display when Return action selected
- Require comment
- Optionally select specific items to correct
- Notify operator of return

**Misuse:**
- Do not allow return without reason
- Do not lose reviewer context

**Design Tokens (Semantic):**
- color.semantic.surface.panel
- spacing.panel.padding

**Figma Naming:** comp/review/return-for-correction

**Future Django Partial:** templates/components/review/return_for_correction.html

**Future Test Considerations:**
- Verify comment required
- Test item selection
- Test operator notification

---

### Verification Panel

**Purpose:** Verify specific data points during review.

**Primary Persona:** Supervisor, QA

**Anatomy:**
- Item label
- Operator value
- Verify checkbox or input (if re-checking)
- Comment field (if discrepancy)

**Variants:**
- Checkbox (verify as-is)
- Input (re-enter value)

**States:** Unverified, Verified, Discrepancy

**Responsive:** Full width

**Accessibility:**
- Label clear
- Checkbox labeled
- Comment field labeled (if applicable)

**Content Rules:**
- Label: item name
- Value: operator's entry
- Comment: if discrepancy
- English

**Usage Rules:**
- Display for items requiring verification (per business rules - EVIDENCE REQUIRED)
- Require verification before approval
- Flag discrepancies

**Misuse:**
- Do not skip verification if required
- Do not hide discrepancies

**Design Tokens (Semantic):**
- color.semantic.surface.panel
- spacing.panel.padding

**Figma Naming:** comp/review/verification-panel

**Future Django Partial:** templates/components/review/verification_panel.html

**Future Test Considerations:**
- Verify required verification
- Test discrepancy handling

---

### Hold/Reject Panel

**Purpose:** Place record on hold or reject (if permitted).

**Primary Persona:** QA, Manager

**Anatomy:**
- Reason field (required)
- Category select (optional, e.g., quality issue, safety issue)
- Escalation flag (if applicable)
- Hold/Reject button
- Cancel button

**Variants:**
- Hold
- Reject

**States:** Default, Submitting

**Responsive:** Full width

**Accessibility:**
- Reason field labeled
- Category select labeled
- Hold/Reject button enabled when reason filled
- Focus on reason field

**Content Rules:**
- Label: "Reason for Hold/Reject"
- Placeholder: "Explain the issue"
- English

**Usage Rules:**
- Display when Hold/Reject action selected
- Require reason
- Require confirmation (separate dialog)
- Notify relevant parties

**Misuse:**
- Do not allow without reason
- Do not skip confirmation
- Do not use for minor issues (use Return for Correction)

**Design Tokens (Semantic):**
- color.semantic.status.critical
- spacing.panel.padding

**Figma Naming:** comp/review/hold-reject-panel

**Future Django Partial:** templates/components/review/hold_reject_panel.html

**Future Test Considerations:**
- Verify reason required
- Test confirmation dialog
- Test notification trigger

---

### Separation-of-Duty Warning

**Purpose:** Warn when separation-of-duty rule may be violated.

**Primary Persona:** Supervisor, QA, Manager

**Anatomy:**
- Warning icon
- Message: "You cannot review your own submission" (example)
- Dismiss or alternate action

**Variants:**
- Blocking (cannot proceed)
- Advisory (can override with reason - per business rules)

**States:** Visible (rule triggered), Hidden (rule OK)

**Responsive:** Full width

**Accessibility:**
- role="alert"
- Warning announced
- Clear guidance

**Content Rules:**
- Message: clear rule explanation
- Action: if override allowed
- English

**Usage Rules:**
- Display when rule triggered (per business rules - EVIDENCE REQUIRED)
- Block action if strict rule
- Allow override if permitted (with reason and audit)

**Misuse:**
- Do not allow violation without audit trail
- Do not hide warning

**Design Tokens (Semantic):**
- color.semantic.status.warning
- spacing.warning.padding

**Figma Naming:** comp/review/separation-of-duty-warning

**Future Django Partial:** templates/components/review/separation_of_duty_warning.html

**Future Test Considerations:**
- Verify rule enforcement
- Test override flow (if applicable)
- Verify audit logging

---

### Read-Only Audit Indicator

**Purpose:** Indicate record is read-only for audit purposes.

**Primary Persona:** All (viewing historical records)

**Anatomy:**
- Icon (lock or eye)
- Label: "Read-Only" or "Archived"
- Optional: reason (e.g., "Approved", "Archived")

**Variants:**
- Lock (cannot edit)
- Archive (historical)

**States:** Displayed when read-only

**Responsive:** Inline or banner

**Accessibility:**
- Status announced
- Icon with label

**Content Rules:**
- Label: "Read-Only" or "Archived"
- Reason: if applicable
- Sinhala and English (operator views), English (supervisory views)

**Usage Rules:**
- Display when record is read-only
- Explain reason (approved, archived, etc.)
- Suppress edit actions

**Misuse:**
- Do not show edit actions when read-only
- Do not allow editing historical records

**Design Tokens (Semantic):**
- color.semantic.status.neutral
- spacing.indicator.padding

**Figma Naming:** comp/review/read-only-indicator

**Future Django Partial:** templates/components/review/read_only_indicator.html

**Future Test Considerations:**
- Verify edit actions hidden
- Test with different reasons

---

## Data Display Components

### KPI Card

**Purpose:** Display key performance indicator or summary metric.

**Primary Persona:** Manager, Supervisor

**Anatomy:**
- Value (large, bold)
- Label (metric name)
- Optional: trend indicator (up/down arrow)
- Optional: comparison (vs. target or previous)
- Background: surface color
- Padding: spacious

**Variants:**
- Default
- With trend
- With comparison

**States:** Default, Loading

**Responsive:** Grid (1-4 columns depending on viewport)

**Accessibility:**
- Value announced with label
- Trend announced (e.g., "up 5%")
- Loading state announced

**Content Rules:**
- Value: formatted number (e.g., 123, 98.5%, etc.)
- Label: concise, max 24 characters
- Trend: "↑ 5%" or "↓ 2%"
- English

**Usage Rules:**
- Display on dashboard
- Use semantic colors for trend (green up, red down, or context-specific)
- Update dynamically if real-time

**Misuse:**
- Do not show too many KPIs (max 6-8 per screen)
- Do not use without clear label
- Do not invent metrics (use factual data)

**Design Tokens (Semantic):**
- color.semantic.surface.card
- elevation.card
- spacing.kpi.padding

**Figma Naming:** comp/data-display/kpi-card

**Future Django Partial:** templates/components/data_display/kpi_card.html

**Future Test Considerations:**
- Verify value formatting
- Test trend indicator direction
- Test loading state

---

### Data Table

**Purpose:** Display tabular data with sorting, filtering, pagination.

**Primary Persona:** Supervisor, QA, Manager

**Anatomy:**
- Table headers (sortable)
- Table rows (data cells)
- Optional: row actions (view, edit, delete)
- Optional: selection checkboxes
- Pagination controls
- Filter/search bar (if applicable)

**Variants:**
- Default (read-only)
- Selectable (checkboxes)
- With actions (per row)

**States:** Default, Sorted, Filtered, Loading, Empty

**Responsive:** Horizontal scroll on mobile, or collapse to cards

**Accessibility:**
- role="table" or semantic table
- Headers with scope="col"
- Sortable headers with aria-sort
- Row actions labeled
- Keyboard navigable

**Content Rules:**
- Headers: clear, concise
- Cells: formatted appropriately (date, number, text)
- Actions: icon + label or icon with aria-label
- English

**Usage Rules:**
- Use for structured data
- Allow sorting on key columns
- Provide pagination for >20 rows
- Provide filters/search for large datasets

**Misuse:**
- Do not show too many columns (prioritize, allow column toggle)
- Do not use for simple lists (use list component)

**Design Tokens (Semantic):**
- color.semantic.surface.table
- color.semantic.border.table
- spacing.table.cell

**Figma Naming:** comp/data-display/data-table

**Future Django Partial:** templates/components/data_display/data_table.html

**Future Test Considerations:**
- Verify sorting behavior
- Test pagination
- Test responsive collapse to cards
- Verify keyboard navigation

---

### Responsive List

**Purpose:** Display list of items, optimized for mobile.

**Primary Persona:** All

**Anatomy:**
- List items (each item: heading, subtext, optional icon/thumbnail)
- Optional: dividers between items
- Optional: actions per item (trailing icon or button)

**Variants:**
- Default (simple)
- With thumbnail
- With actions

**States:** Default, Empty, Loading

**Responsive:** Full width, stack vertically

**Accessibility:**
- role="list" and role="listitem" if not using semantic ul/ol
- Each item accessible
- Actions labeled

**Content Rules:**
- Heading: primary info, bold
- Subtext: secondary info
- Sinhala and English

**Usage Rules:**
- Use for simple lists on mobile
- Allow tap on full item (if navigable)
- Provide actions if needed (swipe or trailing icon)

**Misuse:**
- Do not use for tabular data (use data table)
- Do not overload with too much text per item

**Design Tokens (Semantic):**
- color.semantic.surface.list
- spacing.list.item

**Figma Naming:** comp/data-display/responsive-list

**Future Django Partial:** templates/components/data_display/responsive_list.html

**Future Test Considerations:**
- Test item tap behavior
- Verify actions accessible
- Test empty state

---

### Filter Bar

**Purpose:** Provide filters for list or table data.

**Primary Persona:** Supervisor, QA, Manager

**Anatomy:**
- Filter chips or dropdowns
- Search input (optional)
- Clear all filters button
- Applied filters count

**Variants:**
- Horizontal (desktop)
- Vertical or drawer (mobile)

**States:** No filters, Filters applied, Expanded (mobile drawer)

**Responsive:** Collapse to drawer on mobile

**Accessibility:**
- Each filter labeled
- Clear all button labeled
- Keyboard navigable
- Filter changes announced (count)

**Content Rules:**
- Filter labels: clear criteria (e.g., "Status", "Date Range")
- Applied filters: visible chips
- English

**Usage Rules:**
- Display above filtered content
- Show applied filters clearly
- Allow quick clear all
- Update content dynamically

**Misuse:**
- Do not hide applied filters
- Do not overload with too many filter options

**Design Tokens (Semantic):**
- color.semantic.surface.filter-bar
- spacing.filter-bar.padding

**Figma Naming:** comp/data-display/filter-bar

**Future Django Partial:** templates/components/data_display/filter_bar.html

**Future Test Considerations:**
- Verify filter application
- Test clear all
- Test drawer behavior on mobile

---

### Pagination

**Purpose:** Navigate through pages of data.

**Primary Persona:** All

**Anatomy:**
- Previous button
- Page numbers (current + neighbors)
- Next button
- Optional: "Go to page" input
- Optional: page size selector

**Variants:**
- Default (numbered pages)
- Simple (prev/next only)

**States:** First page (prev disabled), Last page (next disabled), Middle page

**Responsive:** Simplify on mobile (fewer page numbers)

**Accessibility:**
- Previous/Next buttons labeled
- Current page indicated (aria-current)
- Page links navigable

**Content Rules:**
- Labels: "Previous", "Next", "Page X of Y"
- English

**Usage Rules:**
- Display below paginated content
- Show current page clearly
- Disable prev/next at boundaries

**Misuse:**
- Do not show too many page numbers (max 7-9, use ellipsis)
- Do not hide total page count

**Design Tokens (Semantic):**
- color.semantic.action.primary (current page)
- spacing.pagination.gap

**Figma Naming:** comp/data-display/pagination

**Future Django Partial:** templates/components/data_display/pagination.html

**Future Test Considerations:**
- Verify page navigation
- Test boundary states (first, last)
- Test ellipsis behavior

---

### Date Range Picker

**Purpose:** Select a date range for filtering or reporting.

**Primary Persona:** Supervisor, Manager

**Anatomy:**
- Start date input
- End date input
- Calendar picker (for each)
- Quick select buttons (Today, Last 7 days, Last 30 days, etc.)
- Apply button

**Variants:**
- Default
- With quick select

**States:** Default, Start selected, End selected, Range selected

**Responsive:** Full width on mobile, inline on desktop

**Accessibility:**
- Each input labeled
- Calendar pickers accessible
- Quick select buttons labeled
- Apply button labeled

**Content Rules:**
- Labels: "Start Date", "End Date"
- Quick select: "Today", "Last 7 Days", etc.
- English

**Usage Rules:**
- Allow manual entry or picker
- Validate start <= end
- Provide quick select for common ranges

**Misuse:**
- Do not apply range until user confirms (use Apply button)
- Do not allow invalid range (start > end)

**Design Tokens (Semantic):**
- color.semantic.input.border
- elevation.picker

**Figma Naming:** comp/data-display/date-range-picker

**Future Django Partial:** templates/components/data_display/date_range_picker.html

**Future Test Considerations:**
- Verify range validation
- Test quick select buttons
- Test apply action

---

### Audit Event Row

**Purpose:** Display single audit event in audit log.

**Primary Persona:** Manager, Auditor

**Anatomy:**
- Timestamp (date and time)
- Actor (user who performed action)
- Action (what was done)
- Target (what was affected)
- Optional: details link

**Variants:**
- Default
- With details

**States:** Default, Expanded (details)

**Responsive:** Full width, collapse details on mobile

**Accessibility:**
- Timestamp readable
- Actor, action, target clear
- Details link labeled

**Content Rules:**
- Timestamp: full date and time
- Actor: user name or code
- Action: verb phrase (e.g., "Approved record", "Amended field")
- English

**Usage Rules:**
- Display in audit log list
- Show key info in row
- Allow expand for details

**Misuse:**
- Do not show too much detail in row (use expansion)
- Do not hide critical events

**Design Tokens (Semantic):**
- color.semantic.text.secondary (timestamp)
- spacing.audit.row

**Figma Naming:** comp/data-display/audit-event-row

**Future Django Partial:** templates/components/data_display/audit_event_row.html

**Future Test Considerations:**
- Verify timestamp formatting
- Test details expansion

---

### Timeline

**Purpose:** Visual chronological display of events.

**Primary Persona:** All

**Anatomy:**
- Vertical line (timeline axis)
- Event nodes (circles or icons)
- Event labels (timestamp, description)
- Connecting lines between nodes

**Variants:**
- Default (vertical)
- Horizontal (if limited events)

**States:** Default

**Responsive:** Vertical on mobile, vertical or horizontal on desktop

**Accessibility:**
- Ordered list or timeline role
- Each event readable
- Icons decorative (text describes event)

**Content Rules:**
- Timestamp: relative or absolute
- Description: concise event summary
- Sinhala and English (context-dependent)

**Usage Rules:**
- Display chronological events
- Newest first or oldest first (label clearly)
- Use icons for event types

**Misuse:**
- Do not show too many events without pagination/scroll
- Do not use for non-sequential data

**Design Tokens (Semantic):**
- color.semantic.border.timeline
- spacing.timeline.event

**Figma Naming:** comp/data-display/timeline

**Future Django Partial:** templates/components/data_display/timeline.html

**Future Test Considerations:**
- Verify chronological order
- Test icon semantics

---

### Details Panel

**Purpose:** Display detailed information for selected item.

**Primary Persona:** All

**Anatomy:**
- Heading (item name or identifier)
- Key-value pairs (label: value)
- Optional: tabs for sections
- Optional: actions (edit, delete, etc.)

**Variants:**
- Default
- With tabs

**States:** Default, Loading, Error

**Responsive:** Full width on mobile, sidebar or modal on desktop

**Accessibility:**
- Heading clear
- Labels and values readable
- Actions labeled
- Keyboard navigable

**Content Rules:**
- Heading: item identifier
- Labels: clear field names
- Values: formatted appropriately
- Sinhala and English (context-dependent)

**Usage Rules:**
- Display when item selected
- Organize info logically
- Provide close action (if modal/drawer)

**Misuse:**
- Do not overload with too much info (use tabs or sections)
- Do not hide critical info

**Design Tokens (Semantic):**
- color.semantic.surface.panel
- spacing.panel.padding

**Figma Naming:** comp/data-display/details-panel

**Future Django Partial:** templates/components/data_display/details_panel.html

**Future Test Considerations:**
- Verify loading state
- Test close action
- Test tab navigation (if applicable)

---

## Overlay Components

### Modal

**Purpose:** Display content in overlay, requiring user interaction before returning to main content.

**Primary Persona:** All

**Anatomy:**
- Backdrop (semi-transparent)
- Modal container (centered)
- Heading (h2)
- Content area
- Actions (buttons, typically Cancel + Primary)
- Close button (×, top right)

**Variants:**
- Default (medium size)
- Small (confirmation)
- Large (complex form or content)

**States:** Open, Closed

**Responsive:** Full screen on mobile, centered overlay on desktop

**Accessibility:**
- role="dialog" or role="alertdialog"
- aria-modal="true"
- Focus trap within modal
- Escape key to close (if non-critical)
- Focus on heading or first input on open
- Backdrop click to close (if non-critical)

**Content Rules:**
- Heading: clear purpose, max 60 characters
- Content: concise, scannable
- Actions: clear labels (verb + noun)
- Sinhala and English

**Usage Rules:**
- Use for focused tasks or confirmations
- Require explicit user action to dismiss
- Close on action completion or cancel
- Do not nest modals

**Misuse:**
- Do not use for large amounts of content (use page)
- Do not trap user without clear exit (provide close action)

**Design Tokens (Semantic):**
- color.semantic.surface.modal
- color.semantic.backdrop
- elevation.modal
- spacing.modal.padding

**Figma Naming:** comp/overlays/modal

**Future Django Partial:** templates/components/overlays/modal.html

**Future Test Considerations:**
- Verify focus trap
- Test Escape key close
- Test backdrop click close
- Verify focus return on close

---

### Confirmation Dialog

**Purpose:** Confirm destructive or significant action.

**Primary Persona:** All

**Anatomy:**
- Icon (warning or question)
- Heading: "Are you sure?"
- Message: explain consequence
- Cancel button (secondary)
- Confirm button (destructive or primary)

**Variants:**
- Warning (destructive action)
- Question (non-destructive but significant)

**States:** Open, Closed

**Responsive:** Full screen on mobile, centered on desktop

**Accessibility:**
- role="alertdialog"
- aria-modal="true"
- Focus trap
- Focus on Cancel button initially (safe default)
- Escape key = Cancel

**Content Rules:**
- Heading: "Are you sure?" or specific
- Message: clear consequence, max 120 characters
- Cancel: "Cancel" or "No"
- Confirm: specific action (e.g., "Delete Record")
- Sinhala and English

**Usage Rules:**
- Use for destructive actions (delete, reject, etc.)
- Require explicit confirmation
- Default focus on safe action (Cancel)
- Close on either action

**Misuse:**
- Do not overuse (only for significant actions)
- Do not make Confirm too easy (default focus on Cancel)

**Design Tokens (Semantic):**
- color.semantic.surface.modal
- color.semantic.status.critical (destructive)
- elevation.modal

**Figma Naming:** comp/overlays/confirmation-dialog

**Future Django Partial:** templates/components/overlays/confirmation_dialog.html

**Future Test Considerations:**
- Verify default focus on Cancel
- Test Escape = Cancel
- Verify confirmation action

---

### Bottom Sheet

**Purpose:** Mobile overlay sliding from bottom for actions or content.

**Primary Persona:** Operator (mobile)

**Anatomy:**
- Handle bar (drag indicator, top)
- Heading
- Content area
- Actions (buttons)
- Backdrop (semi-transparent)

**Variants:**
- Default (partial height)
- Full screen (tall content)

**States:** Open, Closed, Dragging

**Responsive:** Mobile only (< 768px)

**Accessibility:**
- role="dialog"
- aria-modal="true"
- Focus trap when open
- Draggable handle labeled "Close"
- Escape key to close

**Content Rules:**
- Heading: clear purpose
- Content: scannable
- Actions: clear labels
- Sinhala and English

**Usage Rules:**
- Use on mobile for contextual actions or forms
- Allow swipe down to dismiss
- Backdrop click to dismiss (if non-critical)

**Misuse:**
- Do not use on desktop (use modal)
- Do not overload with content (keep concise)

**Design Tokens (Semantic):**
- color.semantic.surface.modal
- elevation.bottom-sheet
- spacing.bottom-sheet.padding

**Figma Naming:** comp/overlays/bottom-sheet

**Future Django Partial:** templates/components/overlays/bottom_sheet.html

**Future Test Considerations:**
- Verify swipe-down dismiss
- Test focus trap
- Test backdrop click dismiss

---

### Side Drawer

**Purpose:** Overlay panel sliding from side for navigation or content.

**Primary Persona:** All

**Anatomy:**
- Drawer panel (left or right)
- Heading
- Content area (navigation, filters, details)
- Close button (×)
- Backdrop (semi-transparent)

**Variants:**
- Left (navigation)
- Right (details, filters)

**States:** Open, Closed

**Responsive:** Full screen on mobile, partial overlay on desktop

**Accessibility:**
- role="dialog" or role="navigation" (if nav drawer)
- aria-modal="true"
- Focus trap when open
- Escape key to close
- Backdrop click to close

**Content Rules:**
- Heading: clear purpose
- Content: organized list or details
- Sinhala and English (context-dependent)

**Usage Rules:**
- Use for off-canvas navigation or secondary content
- Slide in on trigger
- Close on selection (if navigation) or explicit close

**Misuse:**
- Do not use for critical content (use page)
- Do not nest drawers

**Design Tokens (Semantic):**
- color.semantic.surface.drawer
- elevation.drawer
- spacing.drawer.padding

**Figma Naming:** comp/overlays/side-drawer

**Future Django Partial:** templates/components/overlays/side_drawer.html

**Future Test Considerations:**
- Verify focus trap
- Test Escape and backdrop close
- Test slide animation

---

### Popover

**Purpose:** Display contextual information or actions near trigger element.

**Primary Persona:** All

**Anatomy:**
- Trigger element (button, icon, etc.)
- Popover panel (anchored to trigger)
- Arrow pointing to trigger
- Content (text, actions, etc.)
- Optional: close button

**Variants:**
- Info (read-only content)
- Menu (actions)

**States:** Closed, Open

**Responsive:** Adjust position to stay in viewport

**Accessibility:**
- Trigger with aria-haspopup and aria-expanded
- Popover with role="dialog" or role="menu"
- Focus trap when open (if interactive)
- Escape key to close
- Click outside to close

**Content Rules:**
- Content: concise, max 200 characters
- Actions: clear labels
- Sinhala and English

**Usage Rules:**
- Use for contextual help or actions
- Position near trigger
- Auto-position to stay in viewport

**Misuse:**
- Do not overload with content (use modal)
- Do not hide critical info in popover

**Design Tokens (Semantic):**
- color.semantic.surface.popover
- elevation.popover
- spacing.popover.padding

**Figma Naming:** comp/overlays/popover

**Future Django Partial:** templates/components/overlays/popover.html

**Future Test Considerations:**
- Verify positioning near trigger
- Test Escape and outside click close
- Verify focus trap (if interactive)

---

### Tooltip

**Purpose:** Display brief label or help text on hover/focus.

**Primary Persona:** All (desktop), limited on mobile (long press)

**Anatomy:**
- Trigger element (icon, link, etc.)
- Tooltip panel (small, anchored to trigger)
- Arrow pointing to trigger
- Brief text (one line preferred)

**Variants:**
- Default (hover/focus)

**States:** Hidden, Visible

**Responsive:** Desktop primarily (hover), long press on mobile

**Accessibility:**
- Trigger element has aria-describedby pointing to tooltip
- Tooltip appears on hover and focus
- Escape key to hide (if interactive trigger)
- Tooltip text clear, concise

**Content Rules:**
- Text: brief label or hint, max 80 characters
- One line preferred
- English (desktop users)

**Usage Rules:**
- Use for icon buttons, truncated text, or hints
- Show on hover and focus
- Do not use for critical info (must be accessible without hover)

**Misuse:**
- Do not use for long content (use popover)
- Do not hide required info in tooltip
- Do not use on mobile as primary affordance (touch has no hover)

**Design Tokens (Semantic):**
- color.semantic.surface.tooltip
- color.semantic.text.on-tooltip
- elevation.tooltip
- spacing.tooltip.padding

**Figma Naming:** comp/overlays/tooltip

**Future Django Partial:** templates/components/overlays/tooltip.html

**Future Test Considerations:**
- Verify hover and focus triggers
- Test aria-describedby association
- Test Escape key hide

---

## Approval and Governance

All component specifications are **proposed** and subject to review and approval by:

- **Design Owner:** OWNER REQUIRED
- **Development Lead:** OWNER REQUIRED
- **Product Owner:** OWNER REQUIRED
- **Accessibility Reviewer:** OWNER REQUIRED

**Approval Status:** Pending design review and stakeholder approval.

**Evidence Required:**
- Business rules for checklist workflows, approval flows, separation-of-duty, etc.
- Actual Nelna operational data (sites, products, temperatures, shifts, etc.)
- Accessibility audit and WCAG validation
- Usability testing with operators (Sinhala language support)

---

## Cross-References

- **DESIGN_TOKENS.md:** Semantic token definitions for colors, typography, spacing, etc.
- **COMPONENT_SYSTEM.md:** Component architecture and naming conventions
- **ACCESSIBILITY_AND_USABILITY.md:** WCAG requirements and usability guidelines
- **FIGMA_TOKENS_COMPONENTS_SPEC.md:** Figma-specific token and component specifications
- **OPERATOR_COMPONENT_PATTERNS.md:** (to be created) Operator workflow patterns
- **CRITICAL_STATE_PATTERNS.md:** (to be created) Critical failure and error patterns

---

## Document History

| Version | Date       | Author         | Changes                     |
|---------|------------|----------------|-----------------------------|
| 1.0     | 2026-08-04 | System         | Initial catalogue creation  |

---

**End of Component Catalogue**
