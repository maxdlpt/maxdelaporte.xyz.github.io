# HF Job Tracker — Spec: Matchmaker Tab

Baseline: current `jobtracker/index.html` (post-Universe tab merge — 3 sidebar tabs: Todo, Universe, Pipeline).

---

## Overview

Add a **Matchmaker** tab — a Tinder-style card triage interface for opportunities discovered by the nightly automated job scan. The scan populates a `matchmaker` table in Supabase; this tab lets the user swipe through results: **swipe left / X button → reject**, **swipe right / heart button → accept** (opens pre-filled modal to create a pipeline opportunity). A link button on the card opens the job posting directly.

The `matchmaker` table and the `career_page_url` column on `firms` already exist in the database — no schema changes needed.

---

## 1. New Icon: `IconMatchmaker`

Add a briefcase-with-heart icon. Extract the essential paths from the provided SVG:

```jsx
const IconMatchmaker = () => (
  <svg viewBox="0 0 54 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="12" width="46" height="32" rx="4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="17" y="6" width="20" height="6" rx="2.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    <g transform="translate(17.5, 16.5) scale(0.4)">
      <path d="M23.78 10.37C18.67 5.81 12.64 4.15 8.26 6.68C2.04 10.27 1.48 20.93 7 30.5C10.63 36.79 15.99 41.04 21 42.19" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.26 17.5C12.74 27.07 13.3 37.73 19.52 41.32C25.73 44.91 35.25 40.07 40.77 30.5C46.3 20.93 45.73 10.27 39.52 6.68C33.3 3.09 23.78 7.93 18.26 17.5Z" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
  </svg>
);
```

---

## 2. Sidebar + Tab Routing

### 2a. Update `TABS_ORDER`

```javascript
// Current:
const TABS_ORDER = ['todo','universe','pipeline'];

// New:
const TABS_ORDER = ['todo','universe','pipeline','matchmaker'];
```

### 2b. Update `tabs` array

```javascript
// Current:
const tabs=[
  {k:'todo',label:'Todo',Icon:IconTodo},
  {k:'universe',label:'Universe',Icon:IconUniverse},
  {k:'pipeline',label:'Pipeline',Icon:IconPipeline},
];

// New:
const tabs=[
  {k:'todo',label:'Todo',Icon:IconTodo},
  {k:'universe',label:'Universe',Icon:IconUniverse},
  {k:'pipeline',label:'Pipeline',Icon:IconPipeline},
  {k:'matchmaker',label:'Matchmaker',Icon:IconMatchmaker},
];
```

### 2c. Keyboard shortcut: key `4` maps to matchmaker

In the Dashboard keyboard handler, add:

```javascript
else if(k==='4'){setTab('matchmaker');}
```

### 2d. Update topbar title map

```javascript
// Current:
<h1>{{todo:'Todo',universe:'Universe',pipeline:'Pipeline'}[tab]}</h1>

// New:
<h1>{{todo:'Todo',universe:'Universe',pipeline:'Pipeline',matchmaker:'Matchmaker'}[tab]}</h1>
```

### 2e. `tab-content` render

Add:

```jsx
{tab==='matchmaker'&&<MatchmakerTab/>}
```

### 2f. Guard `R` refresh shortcut

The Dashboard currently maps `R` to "Refresh data". The MatchmakerTab will not use `R`, but to be safe and avoid accidental refreshes while triaging, guard it:

```javascript
// Current:
else if(k==='r'||k==='R'){loadData();toast('Refreshed','s');}

// New:
else if((k==='r'||k==='R') && tab!=='matchmaker'){loadData();toast('Refreshed','s');}
```

### 2g. Keyboard shortcut help overlay

Add to Tab Navigation:
```jsx
<div className="kb-row"><span className="kb-desc">Matchmaker</span><div className="kb-keys"><span className="kb-key">4</span></div></div>
```

Add a new section:
```jsx
<div className="kb-section">
  <div className="kb-section-title">Matchmaker (when active)</div>
  <div className="kb-row"><span className="kb-desc">Reject (swipe left)</span><div className="kb-keys"><span className="kb-key">←</span></div></div>
  <div className="kb-row"><span className="kb-desc">Accept (swipe right)</span><div className="kb-keys"><span className="kb-key">→</span></div></div>
  <div className="kb-row"><span className="kb-desc">Open job posting</span><div className="kb-keys"><span className="kb-key">O</span></div></div>
</div>
```

> **Note:** `←` and `→` normally cycle sidebar tabs. When `tab==='matchmaker'`, intercept them for reject/accept instead. See §2h.

### 2h. Arrow key override for matchmaker

In the Dashboard keyboard handler, the arrow key / `[` `]` / PageUp/PageDown block needs to be skipped when on the matchmaker tab so the MatchmakerTab can use its own arrow key handlers:

```javascript
// Current:
else if((k==='ArrowLeft'||k==='['||k==='PageUp')&&idx>0){e.preventDefault();setTab(TABS_ORDER[idx-1]);}
else if((k==='ArrowRight'||k===']'||k==='PageDown')&&idx<TABS_ORDER.length-1){e.preventDefault();setTab(TABS_ORDER[idx+1]);}

// New:
else if((k==='ArrowLeft'||k==='['||k==='PageUp')&&idx>0&&tab!=='matchmaker'){e.preventDefault();setTab(TABS_ORDER[idx-1]);}
else if((k==='ArrowRight'||k===']'||k==='PageDown')&&idx<TABS_ORDER.length-1&&tab!=='matchmaker'){e.preventDefault();setTab(TABS_ORDER[idx+1]);}
```

The `[` / `]` / PageUp / PageDown keys still work for tab cycling on all other tabs. On matchmaker, arrow keys are reserved for swipe gestures.

---

## 3. Dashboard Data Loading + Context

### 3a. Add matchmaker state

```javascript
const [matchmaker, setMatchmaker] = useState([]);
```

### 3b. Load matchmaker data in `loadData`

```javascript
// Current:
const [f,c,o,td] = await Promise.all([
  dbInstance.get('firms','order=order_position.asc.nullsfirst'),
  dbInstance.get('contacts'),
  dbInstance.get('opportunities'),
  dbInstance.get('todos')
]);

// New:
const [f,c,o,td,mm] = await Promise.all([
  dbInstance.get('firms','order=order_position.asc.nullsfirst'),
  dbInstance.get('contacts'),
  dbInstance.get('opportunities'),
  dbInstance.get('todos'),
  dbInstance.get('matchmaker','order=match_score.desc.nullslast')
]);

// Add after existing setters:
setMatchmaker(Array.isArray(mm)?mm:[]);
```

### 3c. Add to context

Add `matchmaker` to the `ctx` useMemo value object and its dependency array.

---

## 4. New CSS: Matchmaker Tab

Add to the `<style>` block. This is the core of the Tinder feel — swipe animations, circular action buttons, stacked card illusion.

```css
/* ── Matchmaker ── */
.mm-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
  height: 100%;
  user-select: none;
}

.mm-summary {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--muted);
}

.mm-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: var(--r-pill);
  font-weight: 600;
  font-size: 12px;
}

.mm-progress {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 12px;
}

/* ── Card stack illusion: two shadow cards behind ── */
.mm-stack {
  position: relative;
  width: 100%;
  max-width: 400px;
  margin-bottom: 28px;
}

.mm-stack::before,
.mm-stack::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -4px;
  width: 92%;
  height: 100%;
  background: var(--bg2);
  border: 1px solid var(--bdr);
  border-radius: 12px;
  transform: translateX(-50%);
  z-index: 0;
  pointer-events: none;
}

.mm-stack::after {
  bottom: -8px;
  width: 84%;
  opacity: .5;
}

/* ── The card itself ── */
.mm-card {
  position: relative;
  z-index: 1;
  background: var(--card);
  border: 1px solid var(--bdr2);
  border-radius: 12px;
  padding: 28px 28px 20px;
  box-shadow: var(--sh-lg);
  touch-action: pan-y;
  transition: transform .15s ease, opacity .15s ease;
  will-change: transform;
}

.mm-card.swiping {
  transition: none;
}

.mm-card.exit-left {
  animation: mmExitLeft .35s ease-in forwards;
}

.mm-card.exit-right {
  animation: mmExitRight .35s ease-in forwards;
}

@keyframes mmExitLeft {
  to { transform: translateX(-140%) rotate(-15deg); opacity: 0; }
}

@keyframes mmExitRight {
  to { transform: translateX(140%) rotate(15deg); opacity: 0; }
}

@keyframes mmEnter {
  from { opacity: 0; transform: scale(.95) translateY(10px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.mm-card.entering {
  animation: mmEnter .3s ease-out;
}

/* Swipe hint overlays */
.mm-swipe-hint {
  position: absolute;
  top: 20px;
  padding: 8px 18px;
  border-radius: var(--r);
  font-size: 16px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .1em;
  opacity: 0;
  transition: opacity .1s;
  pointer-events: none;
  z-index: 5;
}

.mm-swipe-hint.reject-hint {
  right: 20px;
  border: 3px solid var(--danger);
  color: var(--danger);
  transform: rotate(12deg);
}

.mm-swipe-hint.accept-hint {
  left: 20px;
  border: 3px solid var(--accent);
  color: var(--accent);
  transform: rotate(-12deg);
}

/* ── Card content ── */
.mm-firm {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: .05em;
  margin-bottom: 6px;
}

.mm-title {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 14px;
}

.mm-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}

.mm-score {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 700;
}

.mm-score.high   { background: rgba(16,185,129,.15); color: var(--col-green); }
.mm-score.medium { background: rgba(245,158,11,.15); color: var(--col-amber); }
.mm-score.low    { background: rgba(107,114,128,.15); color: var(--col-neutral); }

.mm-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg);
  border: 1px solid var(--bdr2);
  border-radius: var(--r);
  color: var(--accent);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all .15s;
}

.mm-link-btn:hover {
  border-color: var(--accent);
  background: rgba(129,211,26,.06);
}

/* ── Action buttons (Tinder-style circles) ── */
.mm-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
}

.mm-action-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all .15s;
  font-size: 24px;
  line-height: 1;
}

.mm-btn-reject {
  border-color: var(--danger);
  color: var(--danger);
}

.mm-btn-reject:hover {
  background: rgba(255,99,72,.12);
  transform: scale(1.1);
  box-shadow: 0 0 20px rgba(255,99,72,.25);
}

.mm-btn-accept {
  border-color: var(--accent);
  color: var(--accent);
}

.mm-btn-accept:hover {
  background: rgba(129,211,26,.12);
  transform: scale(1.1);
  box-shadow: 0 0 20px rgba(129,211,26,.25);
}

.mm-keys-hint {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 16px;
  font-size: 11px;
  color: var(--muted);
}

.mm-keys-hint kbd {
  background: var(--bg2);
  border: 1px solid var(--bdr2);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 3px;
}

/* ── History ── */
.mm-history-toggle {
  margin-top: 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  color: var(--muted);
  font-weight: 500;
  transition: color .15s;
}

.mm-history-toggle:hover { color: var(--text); }

.mm-history {
  width: 100%;
  max-width: 400px;
  margin-top: 10px;
  animation: fadeIn .2s ease-out;
}

.mm-history-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--bdr);
  border-radius: var(--r);
  background: var(--card);
  margin-bottom: 4px;
  font-size: 12px;
}

.mm-history-row .h-title {
  flex: 1;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mm-history-row .h-firm {
  color: var(--muted);
  white-space: nowrap;
}
```

---

## 5. New `MatchmakerTab` Component

Place before the `Dashboard` component.

### Key behaviours

- **Swipe gestures:** Track touch/mouse drag on the card. When released past a threshold (80px), trigger reject (left) or accept (right). Below threshold, snap back.
- **During drag:** Show a "NOPE" hint overlay (red, top-right, rotated) when dragging left, and a "LIKE" hint overlay (green, top-left, rotated) when dragging right. Hint opacity scales with drag distance.
- **Exit animation:** After action, the card animates off-screen (`exit-left` or `exit-right`), then the next card enters with `entering` animation.
- **Arrow keys:** `←` rejects, `→` accepts. `O` opens job URL.
- **Stack illusion:** The `.mm-stack` wrapper uses `::before` and `::after` pseudo-elements to show faint card shadows behind the active card, creating the sense of a deck.

### Component code

```jsx
/* ══════════════════ TAB 4: MATCHMAKER ══════════════════ */
function MatchmakerTab(){
  const {firms, matchmaker, db, toast, reload} = useContext(Ctx);
  const [exitDir, setExitDir] = useState(null);     // 'left' | 'right' | null
  const [entering, setEntering] = useState(false);
  const [acceptModal, setAcceptModal] = useState(null);
  const [oppForm, setOppForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newFirmModal, setNewFirmModal] = useState(null);
  const [newFirmForm, setNewFirmForm] = useState({name:'',type:'',career_page_url:'',next_steps:'',notes:''});

  // Swipe state
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const cardRef = useRef(null);

  const SWIPE_THRESHOLD = 80;

  // Split records
  const pending = useMemo(()=>
    matchmaker.filter(s=>s.pipeline_decision==='pending'),
  [matchmaker]);

  const reviewed = useMemo(()=>
    matchmaker.filter(s=>s.pipeline_decision!=='pending')
      .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)),
  [matchmaker]);

  const current = pending[0] || null;

  function firmName(fid){ return firms.find(f=>f.id===fid)?.name || '?'; }
  function scoreClass(s){ return s>=70?'high':s>=50?'medium':'low'; }

  // ── Trigger card exit, then perform action after animation ──

  function animateAndAct(direction, actionFn){
    setExitDir(direction);
    setTimeout(()=>{
      actionFn();
      setExitDir(null);
      setEntering(true);
      setTimeout(()=>setEntering(false), 300);
    }, 350);
  }

  async function doReject(){
    if(!current) return;
    try{
      await db.upd('matchmaker', current.id, {pipeline_decision:'rejected'});
      reload();
    }catch(e){ toast('Error: '+e.message,'e'); }
  }

  function doAcceptStart(){
    if(!current) return;
    setOppForm({
      firm_id: current.firm_id,
      role: current.job_title || '',
      location: current.location || '',
      link: current.job_url || '',
      referral: '',
      notes: current.department ? 'Department: '+current.department : '',
    });
    setAcceptModal(current);
  }

  function reject(){
    animateAndAct('left', doReject);
  }

  function accept(){
    animateAndAct('right', doAcceptStart);
  }

  async function confirmAccept(){
    if(!oppForm.firm_id || !oppForm.role.trim()){
      toast('Company and role required','e'); return;
    }
    setSaving(true);
    try{
      await db.ins('opportunities', {...oppForm, stage:'not_applied', stage_order:0});
      await db.upd('matchmaker', acceptModal.id, {pipeline_decision:'accepted'});
      reload();
      toast('Added to pipeline','s');
      setAcceptModal(null);
    }catch(e){ toast('Error: '+e.message,'e'); }
    setSaving(false);
  }

  async function handleCreateFirm(){
    if(!newFirmForm.name.trim()){toast('Firm name required','e');return;}
    try{
      const f = await db.ins('firms',{...newFirmForm, order_position:firms.length});
      reload();
      setOppForm(prev=>({...prev, firm_id:f.id}));
      setNewFirmModal(null);
      toast('Firm created','s');
    }catch(e){ toast('Error: '+e.message,'e'); }
  }

  // ── Swipe / drag handlers ──

  function onPointerDown(e){
    if(acceptModal || !current) return;
    dragStart.current = e.clientX;
    setDragging(true);
    setDragX(0);
  }

  function onPointerMove(e){
    if(!dragging || dragStart.current===null) return;
    setDragX(e.clientX - dragStart.current);
  }

  function onPointerUp(){
    if(!dragging) return;
    setDragging(false);
    dragStart.current = null;
    if(dragX < -SWIPE_THRESHOLD){
      reject();
    } else if(dragX > SWIPE_THRESHOLD){
      accept();
    }
    setDragX(0);
  }

  // ── Keyboard ──

  useEffect(()=>{
    function handle(e){
      const el = document.activeElement;
      if(el && (el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.tagName==='SELECT')) return;
      if(acceptModal || newFirmModal) return;

      if(e.key==='ArrowLeft'){  e.preventDefault(); reject(); }
      else if(e.key==='ArrowRight'){ e.preventDefault(); accept(); }
      else if(e.key==='o'||e.key==='O'){
        if(current?.job_url){ e.preventDefault(); window.open(current.job_url,'_blank'); }
      }
    }
    window.addEventListener('keydown', handle);
    return ()=> window.removeEventListener('keydown', handle);
  });

  // ── Counts ──
  const acceptedCount = reviewed.filter(s=>s.pipeline_decision==='accepted').length;
  const rejectedCount = reviewed.filter(s=>s.pipeline_decision==='rejected').length;

  // ── Hint opacity (scales with drag distance) ──
  const hintOpacity = Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1);

  // ── Card inline style during drag ──
  const cardDragStyle = dragging ? {
    transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`,
  } : {};

  // ── Card className ──
  let cardClass = 'mm-card';
  if(dragging) cardClass += ' swiping';
  if(exitDir==='left') cardClass += ' exit-left';
  if(exitDir==='right') cardClass += ' exit-right';
  if(entering && !exitDir) cardClass += ' entering';

  return(
    <div className="mm-page">

      {/* Summary */}
      <div className="mm-summary">
        <span className="mm-count" style={{background:'rgba(129,211,26,.12)',color:'var(--accent)'}}>
          {pending.length} pending
        </span>
        <span className="mm-count" style={{background:'rgba(16,185,129,.12)',color:'var(--col-green)'}}>
          {acceptedCount} accepted
        </span>
        <span className="mm-count" style={{background:'rgba(255,99,72,.12)',color:'var(--danger)'}}>
          {rejectedCount} rejected
        </span>
      </div>

      {current && !exitDir ? (
        <>
          <div className="mm-progress">{pending.indexOf(current)+1} of {pending.length}</div>

          <div className="mm-stack">
            <div
              ref={cardRef}
              className={cardClass}
              style={cardDragStyle}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              {/* Swipe hint overlays */}
              <div className="mm-swipe-hint reject-hint" style={{opacity: dragX<0 ? hintOpacity : 0}}>NOPE</div>
              <div className="mm-swipe-hint accept-hint" style={{opacity: dragX>0 ? hintOpacity : 0}}>LIKE</div>

              <div className="mm-firm">{firmName(current.firm_id)}</div>
              <div className="mm-title">{current.job_title}</div>

              <div className="mm-meta">
                <span className={`mm-score ${scoreClass(current.match_score)}`}>
                  {current.match_score}/100
                </span>
                {current.department && <span className="badge b-purple">{current.department}</span>}
                {current.location && <span className="badge b-grey">{current.location}</span>}
                {current.date_posted && (
                  <span className="badge b-blue">
                    Posted {new Date(current.date_posted).toLocaleDateString()}
                  </span>
                )}
              </div>

              {current.job_url && (
                <a className="mm-link-btn" href={current.job_url} target="_blank" rel="noreferrer"
                   onClick={e=>e.stopPropagation()}>
                  ↗ View posting
                </a>
              )}
            </div>
          </div>

          {/* Tinder action buttons */}
          <div className="mm-actions">
            <button className="mm-action-btn mm-btn-reject" onClick={reject} title="Reject">✕</button>
            <button className="mm-action-btn mm-btn-accept" onClick={accept} title="Accept">♥</button>
          </div>

          <div className="mm-keys-hint">
            <span><kbd>←</kbd> reject</span>
            <span><kbd>→</kbd> accept</span>
            <span><kbd>O</kbd> open link</span>
          </div>
        </>
      ) : !exitDir ? (
        <div className="empty-state" style={{paddingTop:60}}>
          {matchmaker.length === 0
            ? 'No matches yet. The nightly scan will populate this.'
            : 'All caught up — no pending matches to review.'}
        </div>
      ) : null}

      {/* History toggle */}
      {reviewed.length > 0 && (
        <>
          <button className="mm-history-toggle" onClick={()=>setShowHistory(!showHistory)}>
            {showHistory ? '▾' : '▸'} Reviewed ({reviewed.length})
          </button>

          {showHistory && (
            <div className="mm-history">
              {reviewed.map(s=>(
                <div key={s.id} className="mm-history-row">
                  <Badge v={s.pipeline_decision} arr={[
                    {v:'accepted',label:'Accepted',cls:'b-green'},
                    {v:'rejected',label:'Rejected',cls:'b-red'},
                  ]}/>
                  <span className="h-firm">{firmName(s.firm_id)}</span>
                  <span className="h-title">{s.job_title}</span>
                  <span className={`mm-score ${scoreClass(s.match_score)}`} style={{fontSize:11,padding:'2px 8px'}}>
                    {s.match_score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Accept modal — pre-filled Add Opportunity */}
      {acceptModal && (
        <Modal title="Add to Pipeline" onClose={()=>setAcceptModal(null)} onSave={confirmAccept}
          saveLabel="Add to Pipeline" saving={saving}>
          <OppFormFields d={oppForm} set={setOppForm} firms={firms}
            onCreateFirm={(name)=>{
              setNewFirmForm({name,type:'',career_page_url:'',next_steps:'',notes:''});
              setNewFirmModal(true);
            }}/>
        </Modal>
      )}

      {newFirmModal && (
        <Modal title="Create Firm" onClose={()=>setNewFirmModal(null)} onSave={handleCreateFirm} saveLabel="Create">
          <FirmForm d={newFirmForm} set={setNewFirmForm}/>
        </Modal>
      )}
    </div>
  );
}
```

### Key implementation notes

**Swipe mechanics:**
- `onPointerDown` captures the start X position. `onPointerMove` tracks `dragX` (offset from start). `onPointerUp` checks if `|dragX| > 80px` (the threshold) and triggers reject or accept.
- During drag, the card transforms with `translateX` + slight `rotate` proportional to drag distance.
- `"NOPE"` / `"LIKE"` overlays fade in proportionally to drag distance (opacity = `|dragX| / threshold`, capped at 1).

**Exit animation flow:**
1. Action triggered (button or swipe) → `setExitDir('left'|'right')` → card gets `exit-left` or `exit-right` class and animates off-screen over 350ms.
2. After 350ms timeout: the actual DB operation runs, `exitDir` is cleared, `entering` is set to `true` → next card enters with scale-up animation.
3. After 300ms: `entering` cleared.

**Always showing first pending item:**
Unlike the previous spec that tracked `currentIdx`, this version always renders `pending[0]`. Since `reload()` re-fetches all data and the actioned item is no longer `pending`, the next card naturally becomes `pending[0]`.

---

## 6. Affected Code Locations Summary

| # | What changes | Where in file |
|---|---|---|
| 1 | Add `IconMatchmaker` component | Near other icon definitions |
| 2 | Add `matchmaker` state + load in `loadData` | `Dashboard` component |
| 3 | Add `matchmaker` to context | `Dashboard` → `ctx` useMemo |
| 4 | Update `TABS_ORDER` (append `'matchmaker'`) | `Dashboard` component |
| 5 | Update `tabs` array (append Matchmaker entry) | `Dashboard` component |
| 6 | Update topbar title map | `Dashboard` JSX, topbar `<h1>` |
| 7 | Add `else if(k==='4'){setTab('matchmaker');}` | Dashboard keyboard handler |
| 8 | Guard `R` refresh: skip when `tab==='matchmaker'` | Dashboard keyboard handler |
| 9 | Guard `ArrowLeft`/`ArrowRight` tab cycling: skip when `tab==='matchmaker'` | Dashboard keyboard handler |
| 10 | Add `{tab==='matchmaker'&&<MatchmakerTab/>}` | Dashboard JSX, tab-content |
| 11 | Add `MatchmakerTab` component | Before `Dashboard` component |
| 12 | Add all `.mm-*` CSS classes + animations | `<style>` block |
| 13 | Update keyboard help overlay | Dashboard JSX, `showHelp` block |

---

## 7. Success Criteria

- [ ] Sidebar shows 4 tabs: Todo, Universe, Pipeline, Matchmaker. Key `4` navigates to Matchmaker.
- [ ] Matchmaker icon is a briefcase with a heart inside.
- [ ] With no data, shows "No matches yet. The nightly scan will populate this."
- [ ] With pending data: summary bar shows pending/accepted/rejected counts. A single card is displayed on a "stack" (shadow cards behind via pseudo-elements).
- [ ] Card shows: firm name (accent, uppercase), job title (large), match score badge (green ≥70, amber ≥50, grey <50), department badge, location badge, date posted badge, and "View posting" link button.
- [ ] **Reject flow:** Clicking the ✕ circle button OR pressing `←` OR swiping the card left past 80px → card animates off-screen left with rotation → item marked `rejected` → next card enters.
- [ ] **Accept flow:** Clicking the ♥ circle button OR pressing `→` OR swiping the card right past 80px → card animates off-screen right → pre-filled "Add to Pipeline" modal opens. On save: creates opportunity (stage `not_applied`) AND marks matchmaker record as `accepted`.
- [ ] During swipe drag: card follows finger/cursor, rotates slightly, and "NOPE" (red) or "LIKE" (green) overlay fades in proportionally. Below threshold, card snaps back.
- [ ] `O` key opens the job posting URL in a new tab.
- [ ] Arrow keys (`←`/`→`) do NOT cycle sidebar tabs when on the Matchmaker tab.
- [ ] `R` key does NOT trigger data refresh when on the Matchmaker tab.
- [ ] "Reviewed (N)" toggle at bottom expands to show history with decision badges.
- [ ] Keyboard shortcut overlay includes the Matchmaker section.
- [ ] No regressions in Todo, Universe, or Pipeline tabs.
