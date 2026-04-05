# Changes Spec — Job Search Tracker

> **Instructions for implementer:** Implement every item in this document exactly as described. All changes target the single file `jobtracker/index.html`. Line numbers are approximate — search for the quoted string if the exact line has shifted. No new files are needed except the DB migration SQL noted in §1.3 and §1.5.

---

## Database Schema Changes (run first in Supabase SQL Editor)

```sql
ALTER TABLE todos ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
```

These two new columns power §1.3 (midnight migration) and §1.5 (contact assignment). Everything else is pure frontend.

---

## 1. Todo Tab

### 1.1 — Checkbox Tick Animation

**Goal:** Replacing the abrupt checkbox toggle with a three-phase animation sequence:
1. **Hover** (immediate): checkbox border glows accent
2. **Phase 1 — Tick draw** (0 → 0.5s): SVG checkmark draws itself stroke by stroke
3. **Phase 2 — Strikethrough** (0.5s → 2.0s): a line sweeps left-to-right across the task title, easing out

#### Replace native checkbox with `TaskCheckbox` component

Remove `<input type="checkbox" className="task-checkbox" .../>` from `TaskRow` and replace it with a new `TaskCheckbox` component defined just before `TaskRow`:

```jsx
function TaskCheckbox({ checked, onChange, ticking }) {
  /* ticking = the task is mid-animation (just been checked, not yet settled) */
  return (
    <div
      className={`task-cb${checked ? ' task-cb--checked' : ''}${ticking ? ' task-cb--ticking' : ''}`}
      onClick={e => { e.stopPropagation(); onChange(); }}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onChange()}
    >
      <svg className="task-cb-svg" viewBox="0 0 16 16" fill="none">
        {/* Single polyline — the checkmark path */}
        <polyline
          className="task-cb-check"
          points="3,8.5 6.5,12 13,4"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
```

#### CSS for `TaskCheckbox`

Add after the existing `.task-checkbox` block (around line 374). The existing `.task-checkbox` CSS block can be **fully removed** and replaced with this:

```css
/* ── Custom checkbox ── */
.task-cb {
  width: 18px;
  height: 18px;
  border-radius: 7px;
  background: linear-gradient(180deg, rgba(22,26,35,.98), rgba(14,17,24,.98));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04),
              inset 0 0 0 1.5px rgba(176,179,186,.18),
              0 1px 2px rgba(0,0,0,.22);
  cursor: pointer;
  align-self: center;
  flex-shrink: 0;
  position: relative;
  transition: box-shadow .2s ease, background .2s ease, transform .15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}
.task-cb-svg {
  width: 12px;
  height: 12px;
  display: block;
  overflow: visible;
}
/* The SVG polyline as a "dash" that draws itself */
.task-cb-check {
  stroke-dasharray: 20;       /* total path length — ~20px for the checkmark */
  stroke-dashoffset: 20;      /* fully hidden by default */
  transition: stroke-dashoffset 0s;  /* no transition by default */
}

/* ── Hover state ── */
@media (hover: hover) {
  .task-cb:hover {
    box-shadow: inset 0 1px 0 rgba(255,255,255,.05),
                inset 0 0 0 1.5px var(--accent),
                0 0 0 2px rgba(129,211,26,.12);
  }
}
.task-cb:focus-visible {
  box-shadow: inset 0 0 0 1.5px var(--accent), 0 0 0 3px rgba(129,211,26,.2);
}
.task-cb:active { transform: scale(.93); }

/* ── Ticking state (mid-animation, just been checked) ── */
.task-cb--ticking {
  background: linear-gradient(180deg, rgba(30,41,20,.98), rgba(20,28,14,.98));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.03),
              inset 0 0 0 1.5px var(--accent),
              0 0 0 1px rgba(129,211,26,.1);
}
.task-cb--ticking .task-cb-check {
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 0.5s cubic-bezier(0, 0, 0.2, 1);
}

/* ── Checked state (animation finished) ── */
.task-cb--checked {
  background: linear-gradient(180deg, rgba(30,41,20,.98), rgba(20,28,14,.98));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.03),
              inset 0 0 0 1.5px rgba(129,211,26,.45),
              0 0 0 1px rgba(129,211,26,.08);
}
.task-cb--checked .task-cb-check {
  stroke-dashoffset: 0;
  transition: none; /* already drawn — no transition needed */
}
```

#### Strikethrough animation

The existing rule `.task-row.done-row .task-title { text-decoration: line-through; }` **does not animate** — remove it.

Replace with an animated line drawn by a pseudo-element. Change `.task-title` to wrap its text in a `<span className="task-title-text">` in `TaskRow`'s JSX:

```jsx
<div className="task-title">
  <span className={`task-title-text${tickingId ? ' striking' : ''}${task.done ? ' struck' : ''}`}>
    {task.title}
  </span>
</div>
```

Add CSS:

```css
.task-title-text {
  position: relative;
  display: inline;
}
/* The animated strikethrough line */
.task-title-text::after {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  height: 1.5px;
  width: 0%;
  background: var(--muted);
  border-radius: 1px;
  transform: translateY(-50%);
  /* Starts only after tick-draw finishes (0.5s delay), takes 1.5s, decelerating */
  transition: width 0s;
}
.task-title-text.striking::after {
  width: 100%;
  transition: width 1.5s cubic-bezier(0, 0, 0.2, 1) 0.5s;
}
.task-title-text.struck::after {
  width: 100%;
  transition: none; /* already struck — no animation */
}
/* Text colour dims after fully struck */
.task-row.done-row .task-title-text { color: var(--muted); }
```

#### State tracking in `TodoTab`

`TodoTab` needs a `tickingIds` state — a `Set` of task IDs that are currently mid-animation:

```js
const [tickingIds, setTickingIds] = useState(new Set());
```

Modify `toggleDone` to trigger the animation sequence when checking a task:

```js
async function toggleDone(task) {
  if (!task.done) {
    // Checking: start animation sequence
    setTickingIds(prev => new Set(prev).add(task.id));
    // After full animation (0.5s tick + 1.5s strikethrough + 0.5s settle), clean up
    setTimeout(() => {
      setTickingIds(prev => { const next = new Set(prev); next.delete(task.id); return next; });
    }, 2600);
  }
  // Optimistic update (existing logic)
  setLocalTodos(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done, done_at: !task.done ? new Date().toISOString() : null } : t));
  try {
    await db.upd('todos', task.id, { done: !task.done, done_at: !task.done ? new Date().toISOString() : null });
    reload();
  } catch(e) {
    setLocalTodos(prev => prev.map(t => t.id === task.id ? { ...t, done: task.done, done_at: task.done_at } : t));
    toast(friendlyError(e.message), 'e');
  }
}
```

Pass `ticking={tickingIds.has(task.id)}` to `TaskCheckbox` and `tickingId={tickingIds.has(task.id)}` to the title span logic inside `TaskRow`. `TaskRow` signature gains a `ticking` prop:

```jsx
function TaskRow({ task, firms, contacts, onToggle, onEdit, onDelete, dragHandlers, isDragOver, isDragging, onMoveUp, onMoveDown, isFirst, isLast, ticking }) {
```

---

### 1.2 — Reorder Animations (FLIP)

**Goal:** When a task changes position (drag-drop, touch move buttons, or slide-to-bottom after ticking), it visually flies to its new position: starts fast, decelerates to a stop. Duration 0.5s.

#### Easing curve

```css
/* Used everywhere a task moves position */
--ease-decel: cubic-bezier(0, 0, 0.2, 1);
```

Add `--ease-decel: cubic-bezier(0, 0, 0.2, 1);` to the `:root` block.

#### FLIP implementation in `TodoTab`

Use the FLIP technique (First → Last → Invert → Play):

1. **Before** reorder state change: snapshot the `getBoundingClientRect().top` of every task element.
2. **After** React re-renders with new order: compare positions, apply an instant inverse `transform: translateY(Δpx)` to each element, then immediately transition that transform to `translateY(0)` with `--ease-decel` at 0.5s.

Implementation using refs and `useLayoutEffect`:

```js
const taskRefs = useRef({}); // { [task.id]: HTMLElement }
const pendingFlip = useRef(null); // { [task.id]: number } snapshot of tops before reorder

// Call this BEFORE any state change that reorders tasks
function snapshotPositions() {
  const snap = {};
  Object.entries(taskRefs.current).forEach(([id, el]) => {
    if (el) snap[id] = el.getBoundingClientRect().top;
  });
  pendingFlip.current = snap;
}

useLayoutEffect(() => {
  const snap = pendingFlip.current;
  if (!snap) return;
  pendingFlip.current = null;
  Object.entries(taskRefs.current).forEach(([id, el]) => {
    if (!el || snap[id] == null) return;
    const delta = snap[id] - el.getBoundingClientRect().top;
    if (Math.abs(delta) < 1) return; // no movement
    // Apply inverse transform (snap to old position)
    el.style.transition = 'none';
    el.style.transform = `translateY(${delta}px)`;
    // Force reflow, then animate to new position
    el.getBoundingClientRect();
    el.style.transition = `transform 0.5s var(--ease-decel)`;
    el.style.transform = 'translateY(0)';
    // Cleanup after animation
    const cleanup = () => { el.style.transition = ''; el.style.transform = ''; };
    el.addEventListener('transitionend', cleanup, { once: true });
  });
});
```

Call `snapshotPositions()` immediately before every call that changes task order:
- Inside `moveTask()`: call `snapshotPositions()` before the `arr.splice` calls
- Inside `onDrop()` (drag-drop): call `snapshotPositions()` before the `arr.splice` calls
- Inside the done-slides-to-bottom logic (§1.3): call `snapshotPositions()` before updating `localTodos`

Pass `ref={el => { taskRefs.current[task.id] = el; }}` to the outer `<div>` inside `TaskRow` (wrapping `<>` → change to a `<div>` with ref forwarding, or use `React.forwardRef`).

Alternatively, the simplest approach: give `TaskRow` a `setRef` prop:
```jsx
// In TodoTab render:
<TaskRow ... setRef={el => { taskRefs.current[task.id] = el; }} />

// Inside TaskRow, on the outer wrapper div:
<div ref={setRef} className={`task-row...`} ...>
```

Remove the existing `animation: fadeIn .2s ease-out` from `.task-row` CSS (it conflicts with FLIP — newly created tasks can keep a simple `opacity` fadeIn instead, which is handled separately).

---

### 1.3 — Tick → Slide to Bottom; Midnight Migration to "Past Tasks"

**Goal:**
- Checked tasks stay in the active list (at the bottom) until midnight, displayed with done styling.
- At 00:00, they move to a "Past Tasks" section (renamed from "Completed").
- Ticking a task triggers the animation sequence (§1.1), then the task slides to the bottom of the list (§1.2 FLIP).

#### Data model

The `done_at` column (added in the DB schema section above) records when a task was checked.

- **Active list:** tasks where `done = false`, sorted by `priority ASC`
- **Done-today list:** tasks where `done = true` AND `done_at >= todayMidnight`, sorted by `done_at ASC` (oldest checked task first, at bottom)
- **Past tasks:** tasks where `done = true` AND `done_at < todayMidnight`, sorted by `done_at DESC`

`todayMidnight` is computed once at component mount:
```js
const todayMidnight = useMemo(() => {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}, []);
```

#### New `useMemo` derivations in `TodoTab`

Replace the existing:
```js
const open = useMemo(() => [...localTodos.filter(t => !t.done)].sort((a,b) => a.priority - b.priority), [localTodos]);
const done = useMemo(() => [...localTodos.filter(t => t.done)].sort(...), [localTodos]);
```

With:
```js
const open = useMemo(() =>
  [...localTodos.filter(t => !t.done)].sort((a,b) => a.priority - b.priority),
  [localTodos]
);
const doneToday = useMemo(() =>
  [...localTodos.filter(t => t.done && new Date(t.done_at).getTime() >= todayMidnight)]
    .sort((a,b) => new Date(a.done_at) - new Date(b.done_at)),
  [localTodos, todayMidnight]
);
const pastTasks = useMemo(() =>
  [...localTodos.filter(t => t.done && (!t.done_at || new Date(t.done_at).getTime() < todayMidnight))]
    .sort((a,b) => new Date(b.done_at) - new Date(a.done_at)),
  [localTodos, todayMidnight]
);
```

#### Rendering

The active list renders `[...open, ...doneToday]` — undone tasks first, then tasks ticked today at the bottom.

Tasks in `doneToday` render with `task.done = true` so they use done styling (dimmed, strikethrough). They have no drag handles or move buttons.

The "Past Tasks" section replaces "Completed" section:
- Rename `done-section-header` text from `Completed (${done.length})` → `Past Tasks (${pastTasks.length})`
- Driven by `pastTasks` array instead of old `done` array

#### Slide-to-bottom trigger

After a task is checked (in `toggleDone`), the FLIP animation will fire automatically because `doneToday` updates and `[...open, ...doneToday]` changes order. The FLIP snapshot must be taken **before** `setLocalTodos` is called:

```js
async function toggleDone(task) {
  if (!task.done) {
    setTickingIds(prev => new Set(prev).add(task.id));
    // After tick+strikethrough animations finish, trigger the FLIP slide to bottom
    setTimeout(() => {
      snapshotPositions();
      setLocalTodos(prev => prev); // force re-render to trigger FLIP evaluation
      setTickingIds(prev => { const next = new Set(prev); next.delete(task.id); return next; });
    }, 2100); // 0.5s tick + 1.5s strikethrough + 0.1s buffer
  }
  // ... rest of optimistic update
}
```

The FLIP `useLayoutEffect` will detect the position change and animate accordingly.

---

### 1.4 — "New Task" Panel Expand Animation

**Goal:** Smooth 1.5s animated expand/collapse of the create-task form. The `+` icon morphs into a `−` by the vertical bar disappearing.

#### CSS icon morphing

Replace the current `<span style={{fontSize:18}}>{formOpen?'−':'+'}</span>` in JSX with a dedicated icon component:

```jsx
<span className={`create-card-icon${formOpen ? ' open' : ''}`} aria-hidden="true"/>
```

CSS:
```css
.create-card-icon {
  position: relative;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.create-card-icon::before,
.create-card-icon::after {
  content: '';
  position: absolute;
  background: var(--accent);
  border-radius: 1px;
  left: 50%;
  top: 50%;
  transition: transform 0.35s var(--ease-decel), opacity 0.35s;
}
/* Horizontal bar */
.create-card-icon::before {
  width: 14px;
  height: 2px;
  transform: translate(-50%, -50%);
}
/* Vertical bar — collapses when open */
.create-card-icon::after {
  width: 2px;
  height: 14px;
  transform: translate(-50%, -50%) scaleY(1);
  transform-origin: center;
}
.create-card-icon.open::after {
  transform: translate(-50%, -50%) scaleY(0);
  opacity: 0;
}
```

#### Animated expand

**Change the conditional rendering** from `{formOpen && <div className="create-card-body">...</div>}` to always-rendered with CSS controlling visibility. This is necessary because `max-height` transitions require the element to exist in the DOM:

```jsx
<div className={`create-card-body${formOpen ? ' create-card-body--open' : ''}`}>
  {/* form fields unchanged */}
</div>
```

CSS — **replace** the existing `.create-card-body { padding:16px; border-top:1px solid var(--bdr); }` with:

```css
.create-card-body {
  /* Collapsed state */
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  border-top: 1px solid transparent;
  /* 1.5s expand, decelerating */
  transition:
    max-height 1.5s cubic-bezier(0, 0, 0.2, 1),
    opacity 0.6s cubic-bezier(0, 0, 0.2, 1),
    border-top-color 0.3s ease;
}
.create-card-body--open {
  max-height: 800px;  /* generous upper bound */
  opacity: 1;
  padding: 16px;
  border-top-color: var(--bdr);
}
```

> **Note:** `padding` cannot be transitioned into/from zero with `max-height` cleanly — use an inner wrapper `<div style={{padding:'16px'}}>` inside `.create-card-body` instead of padding on the outer element, so the outer element only has `max-height`/`opacity` animated.

---

### 1.5 — Assign a Contact to a Task

**Goal:** Optional contact assignment on todo items, filtered by the task's assigned firm.

#### DB schema (already listed above)

`contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL` on `todos`.

#### Data context update

`TodoTab` currently destructures `{firms, todos, db, reload}` from `DataCtx`. Add `contacts`:
```js
const { firms, contacts, todos, db, reload } = useContext(DataCtx);
```

#### Create form

Add a contact `<select>` after the existing firm selector in `TodoTab`'s create form. The contact list is filtered to the selected firm (or shows all contacts if no firm selected):

```jsx
<div className="field">
  <label htmlFor="todo-contact">Contact (optional)</label>
  <select
    id="todo-contact"
    value={form.contact_id || ''}
    onChange={e => setForm({ ...form, contact_id: e.target.value || null })}
  >
    <option value="">— none —</option>
    {contacts
      .filter(c => !form.firm_id || c.firm_id === form.firm_id)
      .map(c => <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ''}</option>)
    }
  </select>
</div>
```

Place this field **after** the firm selector and **before** the notes field.

When firm changes and the selected contact no longer belongs to the new firm, reset `contact_id`:
```js
// In the firm selector's onChange:
onChange={e => setForm({ ...form, firm_id: e.target.value, contact_id: '' })}
```

#### Edit modal

Same selector in the edit modal. Add `contact_id: t.contact_id || ''` to `setEditForm(...)` call, and add the filtered contact selector to the edit `Modal`'s body (identical to above, using `editForm`/`setEditForm`).

#### Display in `TaskRow`

`TaskRow` receives a `contacts` prop. In the `.task-meta` div, show a contact tag if `task.contact_id` is set:

```jsx
{contacts && task.contact_id && (() => {
  const c = contacts.find(x => x.id === task.contact_id);
  return c ? <span className="tag" style={{fontSize:10, padding:'1px 7px', color:'var(--accent)'}}>{c.name}</span> : null;
})()}
```

Pass `contacts={contacts}` from `TodoTab` to all `<TaskRow .../>` instances.

#### DB writes

In `createTodo` and `saveEdit`, include `contact_id: form.contact_id || null` in the object passed to `db.ins` / `db.upd`.

In `loadData` in `Dashboard`, `todos` already loads all fields — `contact_id` comes back automatically from Supabase without query changes.

---

## 2. Universe Tab

### 2.1.1 — Flat Table Layout for Contacts and Opportunities

**Goal:** Remove the collapsible section-group accordion. Replace with a single scrollable table (CSS grid) with sticky column headers. Each row still expands to show the detail panel below it (existing `.c-detail` behaviour preserved). No vertical separators — rows separated only by a `border-top`.

---

#### 2.1.1a — Contacts Tab

**Remove** the following:
- `sortBy` state and the `groups` useMemo that builds the section map
- The sort `<select>` in `.filter-bar`
- The entire `Object.entries(groups).map(...)` rendering loop with `section-group` / `section-head`
- The `expanded` state (`toggle()`, `setExpanded`)

**Replace** the `<div className="filter-bar">` / sort-select / group rendering with:

```jsx
{/* Search bar — keep, but remove the sort <select> */}
<div className="filter-bar" style={{marginBottom:0}}>
  <input ref={searchRef} placeholder="Search contacts..." value={search}
    onChange={e => setSearch(e.target.value)} style={{flex:1}}/>
</div>

{/* Column headers */}
<div className="lines-table-header contact-row">
  {[
    { key: 'name',   label: 'Name'         },
    { key: 'status', label: 'Status'        },
    { key: 'firm',   label: 'Firm'          },
    { key: 'role',   label: 'Title'         },
    { key: null,     label: 'Contact Info'  },
    { key: null,     label: ''              }, /* actions */
  ].map(({key, label}) => (
    <div key={label}
      className={`lines-th${key ? ' lines-th--sortable' : ''}${sortCol===key ? ' lines-th--active' : ''}`}
      onClick={() => key && handleSort(key)}
    >
      {label}
      {sortCol === key && <span className="lines-sort-arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>}
    </div>
  ))}
</div>

{/* Rows */}
<div className="lines-table-body">
  {sorted.length ? sorted.map(c => (
    <React.Fragment key={c.id}>
      <div className={`c-row contact-row${detail===c.id?' expanded':''}`}
        onClick={() => setDetail(detail === c.id ? null : c.id)}>
        {/* ... existing row cells unchanged ... */}
      </div>
      {detail === c.id && <div className="c-detail">...</div>}
    </React.Fragment>
  )) : <div className="empty-state">No contacts found</div>}
</div>
```

The `sorted` array (replaces `groups`) is derived by `useMemo` — see §2.1.2 for sort logic.

The existing `contact-row` CSS grid template `grid-template-columns: minmax(132px,1.15fr) 128px minmax(0,1fr) minmax(0,1fr) 100px 64px` is kept **unchanged** for data rows. The header row uses the same template.

---

#### 2.1.1b — Opportunities Tab

**Remove** (same as contacts):
- `sortBy` state, `groups` useMemo, sort `<select>`, `expanded` state, `section-group` / `section-head` rendering

**New columns:** Role | Stage | Firm | Location | Ref | Link | Actions

**New grid template for opportunities:**
```css
.opp-row {
  display: grid;
  grid-template-columns:
    minmax(130px, 2fr)   /* Role */
    110px                /* Stage */
    minmax(90px, 1.4fr)  /* Firm */
    minmax(70px, 1fr)    /* Location */
    70px                 /* Ref */
    44px                 /* Link */
    64px;                /* Actions */
  column-gap: 10px;
  padding: 10px 16px;
  border-top: 1px solid var(--bdr);
  display: flex → change to display:grid; /* override .c-row flex */
  align-items: center;
  cursor: pointer;
  transition: background .15s;
}
.opp-row:hover { background: rgba(255,255,255,.03); }
.opp-row.expanded { background: var(--bg2); border-left: 3px solid var(--accent); }
```

**Row JSX:**
```jsx
<div className={`c-row opp-row${detail===o.id?' expanded':''}`}
  onClick={() => setDetail(detail === o.id ? null : o.id)}>
  <div className="opp-col-role">{o.role}</div>
  <div className="opp-col-stage"><Badge v={o.stage} arr={STAGES}/></div>
  <div className="opp-col-firm" style={{color:'var(--muted)',fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{firmName(o.firm_id)}</div>
  <div className="opp-col-loc"  style={{color:'var(--muted)',fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{o.location||'—'}</div>
  <div className="opp-col-ref">
    {o.referral && o.referral !== 'No' && o.referral !== '' &&
      <span className="tag" style={{fontSize:10}}>{o.referral==='Yes'?'✓ Ref':'⏳'}</span>}
  </div>
  <div className="opp-col-link">
    {o.link
      ? <a className="btn-icon opp-link-btn" href={o.link} target="_blank" rel="noreferrer"
           onClick={e => e.stopPropagation()} aria-label="Open job posting" title="Open job posting">
          <IconExternalLink/>
        </a>
      : <span style={{width:28,display:'block'}}/>}
  </div>
  <div className="opp-col-actions c-row-actions">
    <button className="btn-icon" style={{fontSize:14}}
      onClick={e=>{e.stopPropagation();setModal({type:'edit-opp',data:o})}} aria-label="Edit">✎</button>
    <button className="btn-icon" style={{fontSize:14,color:'var(--danger)'}}
      onClick={e=>{e.stopPropagation();setModal({type:'del-opp',data:o})}} aria-label="Delete">✕</button>
  </div>
</div>
```

**Add `detail` state** to `OppsTab` (currently doesn't have row-expand):
```js
const [detail, setDetail] = useState(null);
```

Add the same `.c-detail` expand panel below each opp row (showing notes, link, referral details) — consistent with contacts.

**Header row for opportunities:**
```jsx
<div className="lines-table-header opp-row" style={{cursor:'default'}}>
  {[
    { key: 'role',     label: 'Role'     },
    { key: 'stage',    label: 'Stage'    },
    { key: 'firm',     label: 'Firm'     },
    { key: 'location', label: 'Location' },
    { key: 'referral', label: 'Ref'      },
    { key: null,       label: 'Link'     },
    { key: null,       label: ''         },
  ].map(...)}  {/* same pattern as contacts */}
</div>
```

---

#### Shared CSS for flat tables

Add to the stylesheet:

```css
/* ── Flat lines table ── */
.lines-table-header {
  background: var(--bg2);
  border: 1px solid var(--bdr);
  border-radius: var(--r) var(--r) 0 0;
  margin-top: 12px;
  /* inherits grid template from .contact-row or .opp-row */
}
.lines-th {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--muted);
  padding: 10px 0;
  user-select: none;
  white-space: nowrap;
}
.lines-th--sortable {
  cursor: pointer;
  transition: color .15s;
}
.lines-th--sortable:hover { color: var(--text); }
.lines-th--active { color: var(--accent); }
.lines-sort-arrow { font-size: 11px; margin-left: 2px; }

.lines-table-body {
  background: var(--card);
  border: 1px solid var(--bdr);
  border-top: none;
  border-radius: 0 0 var(--r) var(--r);
  overflow: hidden;
}
/* Remove first row's top border to avoid double border with header */
.lines-table-body > :first-child { border-top: none; }
```

---

### 2.1.2 — Column Header Click-to-Sort

**State in both `ContactsTab` and `OppsTab`:**
```js
const [sortCol, setSortCol] = useState(null);   // null = no sort / default order
const [sortDir, setSortDir] = useState('asc');  // 'asc' | 'desc'
```

**Handler:**
```js
function handleSort(col) {
  if (sortCol === col) {
    setSortDir(d => d === 'asc' ? 'desc' : 'asc');
  } else {
    setSortCol(col);
    setSortDir('asc');
  }
}
```

**`sorted` useMemo for Contacts:**
```js
const sorted = useMemo(() => {
  let list = [...filtered]; // filtered = search-filtered list (existing logic kept)
  if (!sortCol) return list;

  const STATUS_ORDER = ['not_contacted','contacted','contacted_spoken_to','contacted_cant_help','cold','willing_to_refer'];

  list.sort((a, b) => {
    let va, vb;
    if (sortCol === 'name')   { va = a.name?.toLowerCase() ?? ''; vb = b.name?.toLowerCase() ?? ''; }
    if (sortCol === 'status') {
      va = STATUS_ORDER.indexOf(a.status ?? '');
      vb = STATUS_ORDER.indexOf(b.status ?? '');
      return sortDir === 'asc' ? va - vb : vb - va;
    }
    if (sortCol === 'firm') {
      va = firms.find(f => f.id === a.firm_id)?.name?.toLowerCase() ?? '';
      vb = firms.find(f => f.id === b.firm_id)?.name?.toLowerCase() ?? '';
    }
    if (sortCol === 'role') { va = a.role?.toLowerCase() ?? ''; vb = b.role?.toLowerCase() ?? ''; }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  return list;
}, [filtered, sortCol, sortDir, firms]);
```

**`sorted` useMemo for Opportunities:**
```js
const sorted = useMemo(() => {
  let list = [...filtered];
  if (!sortCol) return list;

  const STAGE_ORDER = STAGES.map(s => s.v); // existing array order = pipeline order

  list.sort((a, b) => {
    let va, vb;
    if (sortCol === 'role')     { va = a.role?.toLowerCase() ?? ''; vb = b.role?.toLowerCase() ?? ''; }
    if (sortCol === 'stage') {
      va = STAGE_ORDER.indexOf(a.stage ?? '');
      vb = STAGE_ORDER.indexOf(b.stage ?? '');
      return sortDir === 'asc' ? va - vb : vb - va;
    }
    if (sortCol === 'firm') {
      va = firms.find(f => f.id === a.firm_id)?.name?.toLowerCase() ?? '';
      vb = firms.find(f => f.id === b.firm_id)?.name?.toLowerCase() ?? '';
    }
    if (sortCol === 'location') { va = a.location?.toLowerCase() ?? ''; vb = b.location?.toLowerCase() ?? ''; }
    if (sortCol === 'referral') { va = a.referral?.toLowerCase() ?? ''; vb = b.referral?.toLowerCase() ?? ''; }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  return list;
}, [filtered, sortCol, sortDir, firms]);
```

**Non-sortable columns:** `Link` and `Contact Info` headers have `key: null` — clicking them calls nothing (the `onClick` guard `key && handleSort(key)` already handles this).

---

### 2.1.3 — Keep Search Functionality

**No changes to search behaviour.** Keep `search` state, `searchRef`, the search `<input>`, and the `filtered` useMemo unchanged in both tabs. The search `<input>` moves to the `.filter-bar` which now only contains the search input (the sort `<select>` is removed).

---

### 2.2 — External Link Button on Overview Tab Opportunity Lines

**Goal:** Each opportunity listed inside a firm card's "Opportunities" section gets a small external-link icon button. Clicking it opens `o.link` in a new tab. The button only appears when `o.link` is non-empty.

In `OverviewTab`'s `renderCard` function, replace the current opportunities map:

```jsx
// Current:
<div key={o.id} className="fc-item" onClick={()=>setModal({type:'edit-opp',data:o})}>
  <Badge v={o.stage} arr={STAGES}/>
  <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis'}}>{o.role}</span>
</div>

// New:
<div key={o.id} className="fc-item" onClick={()=>setModal({type:'edit-opp',data:o})}>
  <Badge v={o.stage} arr={STAGES}/>
  <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis'}}>{o.role}</span>
  {o.link && (
    <a className="fc-link-btn"
       href={o.link}
       target="_blank"
       rel="noreferrer"
       onClick={e => e.stopPropagation()}
       aria-label="Open job posting"
       title="Open job posting">
      <IconExternalLink/>
    </a>
  )}
</div>
```

Add CSS:
```css
.fc-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--muted);
  flex-shrink: 0;
  border-radius: 4px;
  transition: color .15s, background .15s;
  text-decoration: none;
}
.fc-link-btn svg {
  width: 11px;
  height: 11px;
  fill: currentColor;
  display: block;
}
@media (hover: hover) {
  .fc-link-btn:hover { color: var(--accent); background: var(--accent-bg2); }
}
```

---

## New SVG Icon: `IconExternalLink`

Add this constant alongside the other `const IconXxx = () => <svg .../>` definitions (around line 660+):

```jsx
const IconExternalLink = () => (
  <svg viewBox="0 0 32.822 32.822" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(0 0.822)">
      <path d="M24,22v5a1,1,0,0,1-1,1H5a1,1,0,0,1-1-1V9A1,1,0,0,1,5,8h5a2,2,0,0,0,2-2h0a2,2,0,0,0-2-2H3A3,3,0,0,0,0,7V29a3,3,0,0,0,3,3H25a3,3,0,0,0,3-3V22a2,2,0,0,0-2-2h0A2,2,0,0,0,24,22Z"/>
      <rect width="16" height="4" rx="2" transform="translate(16 0)"/>
      <rect width="16" height="4" rx="2" transform="translate(32 0) rotate(90)"/>
      <g><rect width="32.296" height="3.971" rx="1.986" transform="translate(7.178 22.014) rotate(-45)"/></g>
    </g>
  </svg>
);
```

This icon is used in **both** §2.1.1b (Opportunities tab link column) and §2.2 (Overview tab).

---

## Summary of All Touch Points

| Section | File location | Change type |
|---------|--------------|-------------|
| DB migration | Supabase SQL Editor | New `done_at`, `contact_id` columns on `todos` |
| `TaskCheckbox` component | Before `TaskRow` (~line 1381) | New component replaces `<input type="checkbox">` |
| `.task-cb*` CSS | After existing `.task-checkbox` block (~line 374) | Replace existing checkbox CSS |
| `.task-title-text` CSS | After `.task-title` CSS (~line 414) | New strikethrough animation CSS |
| `--ease-decel` CSS variable | `:root` block (~line 27) | New variable |
| `create-card-icon` CSS | After `.create-card-body` CSS (~line 308) | New plus-to-minus morph CSS |
| `.create-card-body` CSS | Line ~308 | Replace with animated max-height version |
| `.lines-table-*` CSS | After `.c-row` CSS block | New flat-table shared CSS |
| `.opp-row` CSS | After `.contact-row` CSS (~line 228) | New grid template |
| `.fc-link-btn` CSS | After `.fc-*` CSS | New small link button |
| `TaskRow` function | ~line 1381 | Add `ticking`, `setRef`, `contacts` props; swap checkbox; add title span |
| `TodoTab` function | ~line 1420 | Add `tickingIds`, `todayMidnight`, `doneToday`, `pastTasks`, FLIP logic, contact field |
| `ContactsTab` function | ~line 1153 | Remove groups/sortBy/expanded; add `sortCol`/`sortDir`/`handleSort`/`sorted`; flat table |
| `OppsTab` function | ~line 1274 | Remove groups/sortBy/expanded; add `sortCol`/`sortDir`/`handleSort`/`sorted`/`detail`; flat table with link col |
| `OverviewTab` `renderCard` | ~line 990 | Add `IconExternalLink` button on opp lines |
| `IconExternalLink` | Near other icon constants (~line 660) | New SVG component |
