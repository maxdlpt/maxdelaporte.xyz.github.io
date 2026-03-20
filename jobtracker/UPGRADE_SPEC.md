# HF Job Tracker Upgrade Specification

## Overview
Complete upgrade of the job tracker with sidebar navigation, enhanced pipeline visualization, improved UX for reordering, and better company management. All changes must be implemented with correct interactions and smooth animations.

---

## 1. Navigation: Horizontal Tabs → Sidebar

**Current State:** Horizontal tab bar at top with 4 tabs (Overview, Pipeline, Contacts, Opportunities)

**Target State:**
- Left sidebar (60px wide, always visible)
- 4 nav items with icons only:
  -  overview: 
    <svg width="128" height="128" viewBox="0 0 1024 1024" class="icon" version="1.1" xmlns="http://www.w3.org/2000/svg" data-iconid="486285" data-svgname="Data center asset overview"><path d="M352.329143 79.286857c35.474286 0 64.146286 28.525714 64.146286 63.853714v190.902858a64 64 0 0 1-64.146286 63.853714H180.955429a63.926857 63.926857 0 0 1-64.073143-63.853714v-190.902858c0-35.254857 28.672-63.853714 64.073143-63.853714h171.373714z m0 510.244572c35.474286 0 64.146286 28.525714 64.146286 63.853714v190.902857a64 64 0 0 1-64.146286 63.853714H180.955429a63.926857 63.926857 0 0 1-64.073143-63.853714v-190.902857c0-35.328 28.672-63.853714 64.073143-63.853714h171.373714z m490.715428-510.244572c35.401143 0 64.073143 28.525714 64.073143 63.853714v190.902858a64 64 0 0 1-64.073143 63.853714H671.670857a63.926857 63.926857 0 0 1-64.146286-63.853714v-190.902858c0-35.254857 28.745143-63.853714 64.146286-63.853714h171.373714z m-669.988571 379.611429h187.172571c64.512 0 116.736-51.931429 116.736-116.077715v-208.457142A116.297143 116.297143 0 0 0 360.228571 18.285714H173.129143C108.617143 18.285714 56.32 70.217143 56.32 134.436571v208.384a116.297143 116.297143 0 0 0 116.736 116.077715z m0 510.244571h187.172571c64.512 0 116.736-51.931429 116.736-116.150857V644.608a116.297143 116.297143 0 0 0-116.736-116.077714H173.129143c-64.512 0-116.736 51.931429-116.736 116.077714v208.457143a116.297143 116.297143 0 0 0 116.736 116.077714z m490.788571-510.244571h187.026286c64.512 0 116.736-51.931429 116.736-116.077715v-208.457142A116.297143 116.297143 0 0 0 850.870857 18.285714H663.771429C599.259429 18.285714 547.108571 70.217143 547.108571 134.436571v208.384a116.297143 116.297143 0 0 0 116.736 116.077715z m178.980572 448.877714H663.698286c-38.619429 0-55.296-16.091429-55.296-54.784V644.608c0-38.546286 16.749714-55.369143 55.369143-55.369143h187.099428c38.765714 0 56.173714 16.749714 56.173714 55.296V853.138286c0 12.8 13.677714 27.501714 31.524572 27.501714s29.037714-14.701714 29.037714-27.501714V644.534857a116.297143 116.297143 0 0 0-116.736-116.004571H663.771429c-64.512 0-116.736 51.931429-116.736 116.077714v208.457143a116.297143 116.297143 0 0 0 116.662857 116.077714H850.285714c13.458286 0 30.72-10.971429 30.72-30.793143a30.72 30.72 0 0 0-30.134857-30.573714h-7.972571z" fill="#000000"></path></svg>
  - Pipeline: 
  <?xml version="1.0" encoding="utf-8"?><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools --> 
  <svg width="800px" height="800px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="none"><path fill="#000000" fill-rule="evenodd" d="M2.75 2.5A1.75 1.75 0 001 4.25v1C1 6.216 1.784 7 2.75 7h1a1.75 1.75 0 001.732-1.5H6.5a.75.75 0 01.75.75v3.5A2.25 2.25 0 009.5 12h1.018c.121.848.85 1.5 1.732 1.5h1A1.75 1.75 0 0015 11.75v-1A1.75 1.75 0 0013.25 9h-1a1.75 1.75 0 00-1.732 1.5H9.5a.75.75 0 01-.75-.75v-3.5A2.25 2.25 0 006.5 4H5.482A1.75 1.75 0 003.75 2.5h-1zM2.5 4.25A.25.25 0 012.75 4h1a.25.25 0 01.25.25v1a.25.25 0 01-.25.25h-1a.25.25 0 01-.25-.25v-1zm9.75 6.25a.25.25 0 00-.25.25v1c0 .138.112.25.25.25h1a.25.25 0 00.25-.25v-1a.25.25 0 00-.25-.25h-1z" clip-rule="evenodd"/></svg>
  - Contacts: 
    <?xml version="1.0" encoding="utf-8"?>

<!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->
  <svg width="800px" height="800px" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <title>contacts-solid</title>
  <g id="Layer_2" data-name="Layer 2">
    <g id="invisible_box" data-name="invisible box">
      <rect width="48" height="48" fill="none"/>
    </g>
    <g id="Q3_icons" data-name="Q3 icons">
      <g>
        <path d="M14,31.7V34H28V31.7a15.3,15.3,0,0,0-14,0Z"/>
        <circle cx="21" cy="17" r="3"/>
        <path d="M36,3H6A2,2,0,0,0,4,5V43a2,2,0,0,0,2,2H36a2,2,0,0,0,2-2V5A2,2,0,0,0,36,3ZM21,10a7,7,0,1,1-7,7A7,7,0,0,1,21,10ZM32,36a2,2,0,0,1-2,2H12a2,2,0,0,1-2-2V29.4l.9-.6a19.6,19.6,0,0,1,20.2,0l.9.6Z"/>
        <path d="M42,19H40V29h2a2,2,0,0,0,2-2V21A2,2,0,0,0,42,19Z"/>
        <path d="M42,31H40V41h2a2,2,0,0,0,2-2V33A2,2,0,0,0,42,31Z"/>
        <path d="M42,7H40V17h2a2,2,0,0,0,2-2V9A2,2,0,0,0,42,7Z"/>
      </g>
    </g>
  </g>
</svg>
  -  Opportunities:
    <?xml version="1.0" encoding="utf-8"?><!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->
    <svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 7H5C3.89543 7 3 7.89543 3 9V18C3 19.1046 3.89543 20 5 20H19C20.1046 20 21 19.1046 21 18V9C21 7.89543 20.1046 7 19 7H15M9 7V5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7M9 7H15" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
- On hover: sidebar expands to 180px, showing icon + label
- Active tab shows accent color
- Logout button at bottom
- Smooth transitions between states

**Implementation Details:**
- Sidebar is flex column, fixed width
- Each nav item has icon div and label div
- Label hidden by default, shows on hover
- Navigation state managed by existing `tab` state variable
- Top bar remains for title and user actions

---

## 2. Pipeline Stage Grouping & Coloring

**Current State:** All 10 stages shown horizontally as equal-width columns

**Target State:**

### Stage Organization:
- **Column 1:** "Not Applied" (neutral gray)
- **Column 2:** "Waiting" (amber/orange)
- **Grouped Section:** "Interview Rounds" header with vertical mini-columns:
  - Phone interview (light green)
  - First Round (light green)
  - HireVue (light green)
  - Case Study (light green)
  - Final Round (light green)
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
  - Flex grid of 5 stage zones inside
  - Zones are shorter than others to fit 2 rows 
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
  - when moved ahead of another card (even before the move is confirmed aka the mouse button is released), the other cards slide into the position they would go into if the move was confirmed.
- When dropped, the card slides to smoothly to its exact position.

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
- [ ] Interview Rounds displayed as grid with a neutral colour dotted line encircling it and Interview rounds as a header
- [ ] Pipeline stages color-coded correctly
- [ ] Drag-and-drop within stage reorders (no dashed borders, smooth animation)
- [ ] Drag-and-drop between stages updates stage (no dashed borders)
- [ ] Contacts all sections start closed
- [ ] Opportunities show as collapsible sections (not grid)
- [ ] Auto-create company combobox works (dropdown, create option, modal flow)
- [ ] Company name changes appear everywhere
- [ ] No visual glitches or layout breaks
- [ ] All animations smooth and performant