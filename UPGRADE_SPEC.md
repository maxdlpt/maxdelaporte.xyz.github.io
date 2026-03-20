# HF Job Tracker Upgrade Specification

## Overview
Complete upgrade of the job tracker with sidebar navigation, enhanced pipeline visualization, improved UX for reordering, and better company management. All changes must be implemented with correct interactions and smooth animations.

---

## 1. Navigation: Horizontal Tabs → Sidebar

**Current State:** Horizontal tab bar at top with 4 tabs (Overview, Pipeline, Contacts, Opportunities)

**Target State:**
- Left sidebar (60px wide, always visible)
- 4 nav items with icons only: 📊 Overview, 📈 Pipeline, 👤 Contacts, 🎯 Opportunities
- On hover: sidebar expands to 180px, showing icon + label
- Active tab shows accent color and stays expanded even without hover
- Logout button at bottom
- Smooth transitions between states

**Implementation Details:**
- Sidebar is flex column, fixed width
- Each nav item has icon div and label div
- Label hidden by default, shows on hover or active state
- Navigation state managed by existing `tab` state variable
- Top bar remains for title and user actions

---

## 2. Pipeline Stage Grouping & Coloring

**Current State:** All 10 stages shown horizontally as equal-width columns

**Target State:**

### Stage Organization:
- **Column 1:** "Not Applied" (neutral gray)
- **Column 2:** "Applied" (neutral gray)
- **Grouped Section:** "Interview Rounds" header with vertical mini-columns:
  - Phone Screen (neutral gray)
  - First Round (neutral gray)
  - HireVue (neutral gray)
  - Case Study (neutral gray)
  - Final Round (neutral gray)
- **Column 3:** "Waiting" (amber/orange)
- **Column 4:** "Rejected" (red)
- **Column 5:** "Offer" (green)

### Color Scheme:
- Neutral gray: `#6b7280` (not_applied, applied, interview stages)
- Amber: `#f59e0b` (waiting)
- Red: `#ef4444` (rejected)
- Green: `#10b981` (offer)

### Visual Implementation:
- Interview Rounds is a grouped container with:
  - Header label "Interview Rounds" (11px, uppercase, muted)
  - Flex row of 5 narrow stage columns inside
  - Columns are narrower than non-interview columns to fit
- Stage column header has colored bottom border matching stage color (not text color change)
- Column count indicator badge remains

---

## 3. Drag-and-Drop Within Pipeline Stages

**Current State:** Drag opportunity card between stage columns only (updates `stage` field)

**Target State:**
- Users can drag and drop opportunities WITHIN the same stage to reorder
- Reordering updates `stage_order` field (INTEGER, added to opportunities table)
- `stage_order` starts at 0 for each opportunity
- When opportunities are fetched, sort by `stage_order` ASC within each stage
- When dragging to a NEW stage, set `stage_order: 0` (goes to top of new stage)

**Database:**
- Add column: `ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS stage_order INTEGER DEFAULT 0;`
- Update logic: On reorder within stage, batch update `stage_order` values to maintain sort order

**Visual Feedback:**
- When dragging card within stage:
  - Card becomes semi-transparent (opacity 0.4) while dragging
  - Card scales down slightly (0.95)
  - Target position shows accent border and glow (no dashed border)
- Card slides back into place smoothly when dropped

---

## 4. Remove Dotted Borders, Smooth Animations

**Current State:**
- Dashed borders appear on drag-over (`.drag-over` class)
- Cards jump/snap into place

**Target State:**
- NO dashed borders anywhere (remove the `border-style: dashed` completely)
- On drag-over: only show a solid accent border + subtle glow shadow (no dashed line)
- Cards animate in with smooth slideIn animation (already exists, ensure used)
- When opportunities appear in pipeline: slide in from left with opacity fade
- When firm cards reorder: smooth transition, not instant
- Transitions should be 200-300ms for naturalness

**CSS:**
- Keep the `.drag-over` styling but REMOVE dashing
- Use `box-shadow` for glow instead of dashed border
- Ensure all card insertions use `animation: slideIn`

---

## 5. Contacts Section: Closed by Default

**Current State:** All company/status sections open by default

**Target State:**
- All sections start collapsed (chevron points right ▶)
- Click section header to expand/collapse
- Expanded state shows all contacts in that section with expandable detail rows
- No sections are pre-expanded on initial load

**Implementation:**
- Initialize `expanded` state object as empty `{}`
- Check `expanded[key] === true` for open state (not `!== false`)
- All sections render with closed chevron initially

---

## 6. Opportunities Section: Collapsible Sections Like Contacts

**Current State:** Opportunities shown in a grid with "Sort by Company/Stage/Role" dropdown

**Target State:**
- Same collapsible section structure as Contacts tab
- Sort dropdown with 3 options:
  - "Sort by Company" (groups by firm name, each firm a collapsed section)
  - "Sort by Stage" (groups by pipeline stage, each stage a collapsed section)
  - "Sort by Role" (all in one "All Opportunities" section)
- Search bar to filter across all opportunities
- Each section starts collapsed
- When expanded, show opportunities as rows (like contact rows)
- Each row shows: role name, location, stage badge, edit/delete icons
- Remove the grid layout entirely

---

## 7. Auto-Create Company Combobox

**Current State:**
- Contact/Opportunity forms have `<select>` dropdown of existing firms
- User must select from existing firms only

**Target State:**
- Replace select with combobox input
- Type to filter existing firms
- Show matching firms as dropdown options
- If typed text doesn't match any firm: show "Create: [typed text]" option
- Clicking "Create" opens a modal to fill firm details:
  - Name field (pre-filled with typed text)
  - Type dropdown
  - Next Steps input
  - Notes textarea
  - Priority checkbox
  - Save button
- After saving new firm:
  - New firm gets added to firms list
  - Form auto-selects the new firm's ID in the company field
  - User continues filling contact/opportunity form
- Modal closes after save, focus returns to contact form

**Implementation:**
- New `CompanyCombobox` component handles input + dropdown logic
- Modal state for new firm creation
- Call `db.ins('firms', firmData)` and get returned firm with ID
- Set selected firm in parent form

---

## 8. Company Name Changes Replicate Everywhere

**Current State:** Should already work via foreign keys, but verify

**Target State:**
- When user edits a firm's name (in the add/edit firm modal)
- That name change automatically appears in:
  - Overview tab firm cards
  - Pipeline tab firm names on opportunity cards
  - Contacts tab group headers (if sorted by company)
  - Opportunities tab group headers (if sorted by company)
- This works because firms, contacts, and opportunities all reference `firm_id`

**Verification:**
- Edit a firm name
- Check that it updates in all views after reload
- No additional code needed if foreign keys are set up correctly

---

## 9. Database Migration

**New Column Required:**
```sql
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS stage_order INTEGER DEFAULT 0;
```

Include this SQL in the setup screen's collapsible details section so users can run it during initial setup or upgrade.

---

## 10. State Management & Interaction Flow

### Overview Tab (unchanged but styled for sidebar):
- Drag firm cards left/right to reorder (urgent ← → least urgent)
- Updates `order_position` field
- Rest of functionality same

### Pipeline Tab (major changes):
- Interview Rounds shown as grouped vertical columns
- Drag opportunity within stage to reorder (updates `stage_order`)
- Drag opportunity between stages to change status (updates `stage`, sets `stage_order: 0`)
- No dotted borders, smooth animations
- Stages color-coded by status

### Contacts Tab (changes):
- All sections start closed
- Create contact form at top
- Sort dropdown + search
- Click section to expand
- Click row to expand detail
- Edit/delete icons

### Opportunities Tab (major refactor):
- Create opportunity form at top
- Sort dropdown + search
- Collapsible sections by company/stage/role
- Opportunity rows inside sections
- Edit/delete icons

---

## 11. Visual Polish

- All borders: solid lines only, no dashed
- Drag feedback: opacity + scale + accent border + glow
- Card animations: slideIn on insert, smooth transitions on reorder
- Sidebar: smooth width expansion on hover, 300ms transition
- Modals: popIn animation (already exists)
- Color scheme: dark theme, accent green, status colors for stages

---

## Build Order

1. **Database:** Add `stage_order` column (via SQL provided in setup screen)
2. **Navigation:** Sidebar + icon expansion
3. **Pipeline:** Stage grouping, coloring, within-stage reordering
4. **Remove dashed borders:** Update drag-over styling
5. **Contacts:** Closed by default
6. **Opportunities:** Collapsible sections refactor
7. **Company Combobox:** New component + modal flow
8. **Testing:** All features work end-to-end

---

## Success Criteria

- [ ] Sidebar navigation works with hover expansion
- [ ] Interview Rounds displayed as compact grouped columns
- [ ] Pipeline stages color-coded correctly
- [ ] Drag-and-drop within stage reorders (no dashed borders, smooth animation)
- [ ] Drag-and-drop between stages updates stage (no dashed borders)
- [ ] Contacts all sections start closed
- [ ] Opportunities show as collapsible sections (not grid)
- [ ] Auto-create company combobox works (dropdown, create option, modal flow)
- [ ] Company name changes appear everywhere
- [ ] No visual glitches or layout breaks
- [ ] All animations smooth and performant
