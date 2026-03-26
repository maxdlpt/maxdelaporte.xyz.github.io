# HF Job Tracker — Spec: Universe Tab

Baseline: current `jobtracker/index.html` (post-sidebar/pipeline upgrade, post-auth refactor).

---

## Overview

Merge the **Contacts** and **Opportunities** sidebar tabs into a single **Universe** sidebar tab. Inside the Universe tab, a horizontal sub-tab bar (styled like the screenshot reference — dark background, accent-coloured active underline, icon + label per sub-tab) lets the user switch between Contacts and Opportunities. The underlying tab components (`ContactsTab`, `OppsTab`) are unchanged in behaviour and layout.

---

## 1. New icon: `IconUniverse`

Add a new SVG icon component. Use **only** the paths from the second non-empty `<g>` block of the provided SVG (the orbital/solar-system shape — all coordinates fall within 0–512). Replace the existing `IconContacts` and `IconOpps` references in the sidebar with `IconUniverse`.

```javascript
const IconUniverse = () => (
  <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="254.99" cy="251.983" r="41.177"
      stroke="currentColor" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="92.682" cy="314.043" r="27.492"
      stroke="currentColor" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="172.307" cy="81.813" r="27.492"
      stroke="currentColor" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M255.464,167.051C388.32,167.051,496,205.558,496,253.09c0,47.503-107.68,86.04-240.536,86.04c-50.946,0-98.18-5.67-137.072-15.35c1.128-3.027,1.781-6.294,1.781-9.737c0-15.171-12.32-27.493-27.492-27.493c-12.499,0-23.008,8.313-26.393,19.684c-32.183-14.607-51.391-33.073-51.391-53.144C14.898,205.558,122.608,167.051,255.464,167.051z"
      stroke="currentColor" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M199.412,86.386c40.525,12.647,90.877,57.359,130.48,120.449c56.765,90.375,70.006,184.222,29.6,209.577c-40.405,25.384-119.199-27.314-175.934-117.688c-53.588-85.297-68.372-173.682-35.893-204.678c4.513,9.056,13.834,15.261,24.641,15.261C185.904,109.306,197.215,99.389,199.412,86.386z"
      stroke="currentColor" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
```

> **Note:** The existing `IconContacts` and `IconOpps` components stay in the file — they are re-used inside the Universe sub-tab bar (see §3). Only their use in the sidebar `tabs` array is removed.

---

## 2. Sidebar tab list (`Dashboard` → `tabs` array + `TABS_ORDER`)

**Current `TABS_ORDER`:**
```javascript
const TABS_ORDER = ['todo','overview','pipeline','contacts','opportunities'];
```

**New `TABS_ORDER`:**
```javascript
const TABS_ORDER = ['todo','overview','pipeline','universe'];
```

**Current `tabs` array:**
```javascript
const tabs = [
  {k:'todo',      label:'Todo',          Icon:IconTodo},
  {k:'overview',  label:'Overview',      Icon:IconOverview},
  {k:'pipeline',  label:'Pipeline',      Icon:IconPipeline},
  {k:'contacts',  label:'Contacts',      Icon:IconContacts},
  {k:'opportunities', label:'Opportunities', Icon:IconOpps},
];
```

**New `tabs` array:**
```javascript
const tabs = [
  {k:'todo',      label:'Todo',          Icon:IconTodo},
  {k:'overview',  label:'Overview',      Icon:IconOverview},
  {k:'pipeline',  label:'Pipeline',      Icon:IconPipeline},
  {k:'universe',  label:'Universe',      Icon:IconUniverse},
];
```

---

## 3. New state in `Dashboard`: `universeSubTab`

Add to `Dashboard` component:

```javascript
const [universeSubTab, setUniverseSubTab] = useState('contacts');
```

Add `universeSubTab` and `setUniverseSubTab` to the context value (`ctx` useMemo):

```javascript
const ctx = useMemo(()=>({
  .../* existing fields */,
  universeSubTab,
  setUniverseSubTab,
}), [.../* existing deps */, universeSubTab, setUniverseSubTab]);
```

---

## 4. Keyboard shortcut handler (`Dashboard` → `handle` function)

### Tab number keys
Replace `4` → contacts and `5` → opportunities with `4` → universe:

```javascript
// Old:
else if(k==='4'){setTab('contacts');}
else if(k==='5'){setTab('opportunities');}

// New:
else if(k==='4'){setTab('universe');}
```

Remove the `k==='5'` branch entirely.

### `N` key — context-sensitive new item
```javascript
// Old:
else if(k==='n'||k==='N'){
  if(tab==='todo') setShortcutAction({type:'new-todo',ts:Date.now()});
  else if(tab==='overview') setModal({type:'add-firm'});
  else if(tab==='contacts') setShortcutAction({type:'new-contact',ts:Date.now()});
  else if(tab==='opportunities') setShortcutAction({type:'new-opp',ts:Date.now()});
}

// New:
else if(k==='n'||k==='N'){
  if(tab==='todo') setShortcutAction({type:'new-todo',ts:Date.now()});
  else if(tab==='overview') setModal({type:'add-firm'});
  else if(tab==='universe'){
    if(universeSubTab==='contacts') setShortcutAction({type:'new-contact',ts:Date.now()});
    else setShortcutAction({type:'new-opp',ts:Date.now()});
  }
}
```

### `/` search shortcut
The existing `focus-search` shortcut is already dispatched generically:
```javascript
else if(k==='/'){ e.preventDefault(); setShortcutAction({type:'focus-search',ts:Date.now()}); }
```
No change needed — `ContactsTab` and `OppsTab` already respond to `focus-search` via `shortcutAction` from context.

---

## 5. `tab-content` render block in `Dashboard`

```jsx
// Old:
{tab==='contacts'&&<ContactsTab/>}
{tab==='opportunities'&&<OppsTab/>}

// New:
{tab==='universe'&&<UniverseTab/>}
```

Remove the `contacts` and `opportunities` render lines. Add the `universe` line.

---

## 6. New `UniverseTab` component

Insert this new component in the file, near `ContactsTab` and `OppsTab` (e.g., directly before the `Dashboard` component).

```jsx
/* ══════════════════ TAB: UNIVERSE (Contacts + Opportunities) ══════════════════ */
function UniverseTab(){
  const {universeSubTab, setUniverseSubTab} = useContext(Ctx);

  return(
    <div style={{display:'flex', flexDirection:'column', height:'100%'}}>
      {/* Horizontal sub-tab bar */}
      <div className="universe-tabbar">
        <button
          className={`universe-tab-btn ${universeSubTab==='contacts'?'active':''}`}
          onClick={()=>setUniverseSubTab('contacts')}
        >
          <IconContacts/>
          <span>Contacts</span>
        </button>
        <button
          className={`universe-tab-btn ${universeSubTab==='opportunities'?'active':''}`}
          onClick={()=>setUniverseSubTab('opportunities')}
        >
          <IconOpps/>
          <span>Opportunities</span>
        </button>
      </div>

      {/* Sub-tab content */}
      <div style={{flex:1, overflowY:'auto'}}>
        {universeSubTab==='contacts' && <ContactsTab/>}
        {universeSubTab==='opportunities' && <OppsTab/>}
      </div>
    </div>
  );
}
```

---

## 7. New CSS: universe sub-tab bar

Add these rules to the `<style>` block (alongside the existing tab/sidebar styles):

```css
/* ── Universe sub-tab bar ── */
.universe-tabbar {
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--card);
  border-bottom: 1px solid var(--bdr);
  padding: 0 20px;
  flex-shrink: 0;
}

.universe-tab-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 11px 18px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  font-family: inherit;
  transition: color .15s, border-color .15s;
  margin-bottom: -1px; /* overlap the container border-bottom */
  text-transform: uppercase;
  letter-spacing: .05em;
}

.universe-tab-btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.universe-tab-btn svg path,
.universe-tab-btn svg circle {
  stroke: currentColor;
}

.universe-tab-btn:hover {
  color: var(--text);
}

.universe-tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
```

---

## 8. Remove stale keyboard shortcut help text (`showHelp` overlay)

In the keyboard shortcuts overlay (`<div className="kb-modal">`), update the **Tab Navigation** section:

```jsx
// Old:
<div className="kb-row"><span className="kb-desc">Contacts</span><div className="kb-keys"><span className="kb-key">4</span></div></div>
<div className="kb-row"><span className="kb-desc">Opportunities</span><div className="kb-keys"><span className="kb-key">5</span></div></div>

// New:
<div className="kb-row"><span className="kb-desc">Universe</span><div className="kb-keys"><span className="kb-key">4</span></div></div>
```

Remove the `5` row entirely.

Also update the **Context-Sensitive Actions** description for the `N` key:

```jsx
// Old:
<span className="kb-desc">New task (Todo) / new firm (Overview) / new contact (Contacts) / new opp (Opportunities)</span>

// New:
<span className="kb-desc">New task (Todo) / new firm (Overview) / new contact or opp (Universe, based on active sub-tab)</span>
```

---

## 9. `ContactsTab` and `OppsTab` — no changes required

Both components are used as-is inside `UniverseTab`. They already read `shortcutAction` from context and respond correctly to `new-contact`, `new-opp`, and `focus-search`. No internal modifications needed.

---

## Affected code locations summary

| # | What changes | Where in file |
|---|---|---|
| 1 | Add `IconUniverse` component | Near other icon definitions (~line 359) |
| 2 | Update `TABS_ORDER` and `tabs` array | Inside `Dashboard` component |
| 3 | Add `universeSubTab` + `setUniverseSubTab` state & context | Inside `Dashboard` component |
| 4 | Update keyboard shortcut handler | Inside `Dashboard` → `useEffect` → `handle` |
| 5 | Update `tab-content` render | Inside `Dashboard` JSX return |
| 6 | Add `UniverseTab` component | Before `Dashboard` component |
| 7 | Add `.universe-tabbar` and `.universe-tab-btn` CSS | Inside `<style>` block |
| 8 | Update keyboard help overlay text | Inside `Dashboard` JSX return, `showHelp` block |

---

## Success criteria

- The sidebar shows **4 tabs**: Todo, Overview, Pipeline, Universe.
- Clicking Universe shows a horizontal sub-tab bar with "Contacts" and "Opportunities" buttons, each with their existing icon.
- The active sub-tab has an accent-coloured bottom border; inactive sub-tabs are muted.
- Clicking Contacts sub-tab renders the full Contacts page (search, grouping, create form, modals) exactly as before.
- Clicking Opportunities sub-tab renders the full Opportunities page exactly as before.
- Keyboard shortcut `4` navigates to Universe. Shortcut `5` no longer exists.
- `N` on Universe opens the new-contact form if Contacts sub-tab is active, or new-opp form if Opportunities sub-tab is active.
- `/` focuses the search bar in whichever sub-tab is active.
- Arrow key / `[` `]` / PageUp/PageDown tab cycling works correctly across 4 tabs (no `contacts` or `opportunities` as independent tabs).
- The keyboard shortcuts overlay reflects the updated tab list and N key description.
- No regressions in Overview, Pipeline, or Todo tabs.
