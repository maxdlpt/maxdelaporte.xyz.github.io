# Architecture Review — Job Search Tracker

> **How to use this document:** Every recommended change has a checkbox. **Tick the ones you DO NOT want**, then feed this file back to Claude for one-shot implementation of everything that remains unchecked.
>
> Items marked with **❗** would complicate GitHub Pages hosting (require build steps, env vars, or server-side logic). A GitHub Pages-compatible alternative is noted where applicable.

---

## 1. Security (Critical)

### 1.1 Supabase Credentials

- [x] **Rotate the Supabase anon key and add RLS policies** ❗
  - **Current:** Lines 400-401 hardcode `SUPABASE_URL` and `SUPABASE_KEY` in plaintext. Anyone reading the page source gets the key.
  - **Problem:** Without Row-Level Security (RLS) enabled, that key grants full read/write access to all users' data.
  - **Fix:** On Supabase Dashboard: enable RLS on every table (`firms`, `contacts`, `opportunities`, `todos`, `matchmaker`, `users`). Add policies like:
    ```sql
    CREATE POLICY "Users see own rows" ON firms
      FOR ALL USING (user_id = current_setting('request.jwt.claims')::json->>'sub');
    ```
    Then rotate the anon key (Dashboard → Settings → API → Regenerate). The key can stay in the HTML because RLS ensures it can only access the authenticated user's data.
  - **GitHub Pages note ❗:** You cannot hide the key on static hosting. RLS is the real protection — the key being visible is acceptable *only if* RLS is enforced.

- [ ] **Add auth token expiration** (line 1742)
  - **Current:** `localStorage.setItem('hfcrm_auth', JSON.stringify({userId, username, ts:Date.now()}))` — the `ts` field is stored but never checked.
  - **Fix:** In `getAuth()` (line 505), add:
    ```js
    const auth = JSON.parse(localStorage.getItem('hfcrm_auth'));
    if (auth && Date.now() - auth.ts > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem('hfcrm_auth');
      return null; // force re-login after 7 days
    }
    return auth;
    ```

- [ ] **Sanitize error messages** (line 1590, 1758)
  - **Current:** `toast('Failed to load data: ' + e.message, 'e')` and `setErr('Login error: ' + msg)` expose raw Supabase error text (may leak table names, column names, constraint names).
  - **Fix:** Map known error patterns to user-friendly messages:
    ```js
    function friendlyError(msg) {
      if (msg.includes('duplicate key') || msg.includes('unique')) return 'That already exists.';
      if (msg.includes('violates foreign key')) return 'Related record not found.';
      if (msg.includes('JWT')) return 'Session expired. Please log in again.';
      return 'Something went wrong. Please try again.';
    }
    ```
    Use in all `catch` blocks instead of raw `e.message`.

- [ ] **Remove hardcoded credentials from setup SQL** (line 1800)
  - **Current:** `INSERT INTO users (username, password) VALUES ('max_dlpt', 'Mulasasa1');` is visible in the HTML source to anyone.
  - **Fix:** Remove this INSERT statement from the setup SQL shown in the `<details>` block. Add a comment: `-- Create your first user via the Sign Up screen`.

---

## 2. State Management

- [ ] **Split the monolithic Context into 3 providers** (line 1628)
  - **Current:** One context (`Ctx`) holds everything: `firms, contacts, opps, todos, matchmaker, db, toast, reload, modal, setModal, toasts, shortcutAction, setShortcutAction, setTab, universeSubTab, setUniverseSubTab`. Any state change re-renders every consumer.
  - **Fix:** Split into:
    1. `DataCtx` — `{ firms, contacts, opps, todos, matchmaker, db, reload }`
    2. `UICtx` — `{ tab, setTab, universeSubTab, setUniverseSubTab, modal, setModal, shortcutAction, setShortcutAction }`
    3. `NotifyCtx` — `{ toast, toasts }`
  - **Where:** Wrap `Dashboard` return (line 1642) in nested providers. Update all `useContext(Ctx)` calls in child components.

- [ ] **Replace full-reload `loadData()` with granular update functions** (line 1586-1592)
  - **Current:** Every CRUD operation calls `reload()` which fires `Promise.all([db.get('firms'), db.get('contacts'), db.get('opportunities'), db.get('todos'), db.get('matchmaker')])` — re-fetches ALL 5 tables even if only 1 row changed.
  - **Fix:** Add per-entity reload functions:
    ```js
    const reloadFirms = useCallback(async () => {
      const f = await dbInstance.get('firms', 'order=order_position.asc.nullsfirst');
      setFirms(Array.isArray(f) ? f : []);
    }, [dbInstance]);
    // ... same for contacts, opps, todos, matchmaker
    ```
    Replace `reload()` calls with the specific reload needed (e.g., after adding a contact, only call `reloadContacts()`).

- [ ] **Add optimistic updates for better perceived performance**
  - **Current:** After `db.ins('todos', {...})` (line 1095), the app calls `reload()` and waits for the server response before showing the new item.
  - **Fix:** Immediately add the new item to local state, then sync in background:
    ```js
    // Optimistic: show immediately
    setTodos(prev => [...prev, { ...form, id: 'temp-' + Date.now() }]);
    // Then persist
    const [row] = await db.ins('todos', form);
    // Replace temp with real
    setTodos(prev => prev.map(t => t.id.startsWith('temp-') ? row : t));
    ```

- [ ] **Memoize context values** (line 1628)
  - **Current:** `useMemo` dependency array includes `modal` and `toasts` which change frequently, invalidating the entire context object.
  - **Fix:** With the split context approach above, `NotifyCtx` changes won't trigger re-renders in data-consuming components. Additionally, remove `modal` from the `useMemo` deps by using a ref for the modal state.

---

## 3. Code Organization

- [x] **Extract from single 1845-line file into multi-file structure** ❗
  - **Current:** Everything is in `jobtracker/index.html` — CSS, icons, DB class, auth, all React components.
  - **Fix:** Use Vite to split into:
    ```
    jobtracker/
      index.html
      src/
        main.jsx
        db.js
        auth.js
        context.js
        components/
          Modal.jsx, Badge.jsx, Toast.jsx, CompanyCombo.jsx
        tabs/
          TodoTab.jsx, OverviewTab.jsx, PipelineTab.jsx, ...
        styles/
          theme.css, layout.css, components.css
    ```
  - **GitHub Pages note ❗:** Requires `npm run build` before deploying. You'd deploy the `dist/` folder instead of raw source. A GitHub Action can automate this.
  - **Alternative (no build step):** Keep the single-file architecture but add clear section comments and consistent formatting. This is less ideal but preserves the zero-build GitHub Pages deployment.

- [ ] **Extract reusable components within the single file**
  - **Current:** Repeated patterns are copy-pasted:
    - Toast-on-save: `try { await db.ins(...); toast('Saved','s'); reload(); } catch(e) { toast('Error: '+e.message,'e'); }` appears 10+ times
    - Form fields: `<div className="field"><label>...</label><input value={d.x} onChange={e=>ch('x',e.target.value)}.../>` repeated for every form
    - Drag handlers: `onDragStart/onDragEnd/onDragOver/onDragLeave/onDrop` duplicated in OverviewTab (line 634), PipelineTab (line 722), and TodoTab
  - **Fix:** Extract within the same file:
    ```js
    // Utility: wrap any DB operation with toast feedback
    async function dbOp(db, operation, successMsg, toast, reload) {
      try { const r = await operation(); toast(successMsg, 's'); reload(); return r; }
      catch(e) { toast(friendlyError(e.message), 'e'); }
    }

    // Utility: generic form field
    function Field({label, value, onChange, type='text', placeholder, ...props}) {
      return (
        <div className="field">
          <label>{label}</label>
          {type === 'textarea'
            ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} {...props}/>
            : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} {...props}/>}
        </div>
      );
    }
    ```

- [ ] **Consolidate duplicated drag-and-drop handlers into a shared hook**
  - **Current:** OverviewTab (lines 634-644), PipelineTab (lines 722-760), and TodoTab all implement their own drag logic with the same `dragRef.current`, `classList.add('dragging')`, `e.dataTransfer.effectAllowed='move'` pattern.
  - **Fix:** Create a `useDragReorder(items, onReorder)` hook:
    ```js
    function useDragReorder(onReorder) {
      const dragRef = useRef(null);
      const handlers = (i) => ({
        draggable: true,
        onDragStart: (e) => { dragRef.current = i; e.currentTarget.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; },
        onDragEnd: (e) => { e.currentTarget.classList.remove('dragging'); dragRef.current = null; },
        onDragOver: (e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); },
        onDragLeave: (e) => { e.currentTarget.classList.remove('drag-over'); },
        onDrop: (e) => { e.currentTarget.classList.remove('drag-over'); if (dragRef.current !== null && dragRef.current !== i) onReorder(dragRef.current, i); },
      });
      return handlers;
    }
    ```

---

## 4. Data Validation

- [ ] **Add email format validation for contacts** (line 590)
  - **Current:** `<input value={d.email} ... placeholder="name@firm.com"/>` — no validation, any string accepted.
  - **Fix:** In `ContactFormFields`, before save:
    ```js
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
      toast('Invalid email format', 'e'); return;
    }
    ```

- [ ] **Add URL validation for LinkedIn and job links** (lines 591, 605)
  - **Current:** No validation on LinkedIn URL or job link inputs.
  - **Fix:**
    ```js
    function isValidUrl(s) { try { new URL(s); return true; } catch { return false; } }
    // Before save:
    if (d.linkedin && !isValidUrl(d.linkedin)) { toast('Invalid LinkedIn URL', 'e'); return; }
    if (d.link && !isValidUrl(d.link)) { toast('Invalid job link', 'e'); return; }
    ```

- [ ] **Add phone number format validation** (line 592)
  - **Current:** `<input value={d.phone} ... placeholder="+1 ..."/>` — accepts any text.
  - **Fix:** Light validation (allow digits, spaces, dashes, plus, parens):
    ```js
    if (d.phone && !/^[+\d\s\-()]{7,20}$/.test(d.phone)) {
      toast('Invalid phone number format', 'e'); return;
    }
    ```

- [ ] **Add required field validation for firm name** (line 577)
  - **Current:** `FirmForm` lets you submit with an empty name (the `<input>` has no required check).
  - **Fix:** In the firm save handler inside `GlobalModals`:
    ```js
    if (!form.name.trim()) { toast('Firm name is required', 'e'); return; }
    ```

- [ ] **Add date format validation**
  - **Current:** No date fields appear to have validation (if dates are added in future forms).
  - **Fix:** Add a utility: `function isValidDate(s) { return !isNaN(Date.parse(s)); }` — apply to any date input before DB write.

---

## 5. Error Handling

- [ ] **Add React Error Boundaries around each tab** (line 1659-1663)
  - **Current:** If any component throws during render, the entire app crashes with a white screen (React's default behavior).
  - **Fix:** Add an `ErrorBoundary` class component:
    ```js
    class ErrorBoundary extends React.Component {
      constructor(props) { super(props); this.state = { error: null }; }
      static getDerivedStateFromError(e) { return { error: e }; }
      render() {
        if (this.state.error) return (
          <div className="empty-state">
            <p>Something went wrong in this tab.</p>
            <button className="btn btn-s" onClick={() => this.setState({ error: null })}>Try again</button>
          </div>
        );
        return this.props.children;
      }
    }
    ```
    Wrap each tab: `{tab==='todo' && <ErrorBoundary><TodoTab/></ErrorBoundary>}`

- [ ] **Add retry logic for failed API calls** (line 1586-1591)
  - **Current:** `loadData()` fires once; if it fails, user sees "Failed to load data" toast and nothing else.
  - **Fix:** Add exponential backoff:
    ```js
    async function fetchWithRetry(fn, retries = 2, delay = 1000) {
      for (let i = 0; i <= retries; i++) {
        try { return await fn(); }
        catch(e) { if (i === retries) throw e; await new Promise(r => setTimeout(r, delay * (i + 1))); }
      }
    }
    ```

- [ ] **Add granular error handling for `loadData()`** (line 1588)
  - **Current:** `Promise.all([...5 fetches...])` — if one fails, all are lost. User gets no data at all.
  - **Fix:** Use `Promise.allSettled()`:
    ```js
    const results = await Promise.allSettled([
      dbInstance.get('firms', 'order=order_position.asc.nullsfirst'),
      dbInstance.get('contacts'),
      dbInstance.get('opportunities'),
      dbInstance.get('todos'),
      dbInstance.get('matchmaker', 'order=match_score.desc.nullslast'),
    ]);
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') [setFirms, setContacts, setOpps, setTodos, setMatchmaker][i](Array.isArray(r.value) ? r.value : []);
      else toast(`Failed to load ${['firms','contacts','opportunities','todos','matchmaker'][i]}`, 'e');
    });
    ```

- [ ] **Add rollback mechanism for failed batch drag-reorder** (line 642)
  - **Current:** `Promise.all(arr.map((f,idx) => db.upd('firms', f.id, {order_position:idx})))` — if some succeed and some fail, order is corrupted.
  - **Fix:** Store the previous order before updating, and restore on failure:
    ```js
    const prevOrder = sorted.map(f => ({ id: f.id, order_position: f.order_position }));
    try { await Promise.all(arr.map(...)); reload(); }
    catch(e) {
      toast('Failed to save order, reverting', 'e');
      await Promise.all(prevOrder.map(p => db.upd('firms', p.id, { order_position: p.order_position })));
      reload();
    }
    ```

---

## 6. Performance

- [ ] **Fix `loadData` dependency loop** (line 1579-1592)
  - **Current:** `toast` is defined with `useCallback([], ...)` but it's in the dependency array of `loadData`. Since `toast` calls `setToasts`, and the `useCallback` depends on nothing, this should be stable — but the keyboard handler (line 1598-1626) depends on `[tab, modal, showHelp, loadData, toast, universeSubTab]` which means it's recreated on every tab switch.
  - **Fix:** Use refs for values that the keyboard handler reads but shouldn't trigger re-creation:
    ```js
    const tabRef = useRef(tab);
    useEffect(() => { tabRef.current = tab; }, [tab]);
    // Keyboard handler uses tabRef.current instead of tab — no dependency
    ```

- [ ] **Debounce ResizeObserver in OverviewTab** (line 628-631)
  - **Current:** `const update = () => setColCount(Math.max(1, Math.floor((el.offsetWidth - 40) / 316)));` fires on every pixel of resize.
  - **Fix:**
    ```js
    let timeout;
    const update = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setColCount(Math.max(1, Math.floor((el.offsetWidth - 40) / 316))), 100);
    };
    ```

- [ ] **Add virtualization for long lists** (Contacts/Opportunities tabs)
  - **Current:** All contacts and opportunities render as DOM elements. If you have 200+ contacts, all 200 DOM nodes exist.
  - **Fix:** Since we can't easily add a library in the single-file architecture, implement a simple windowed renderer:
    ```js
    function VirtualList({ items, rowHeight, renderItem }) {
      const [scrollTop, setScrollTop] = useState(0);
      const containerRef = useRef(null);
      const startIdx = Math.floor(scrollTop / rowHeight);
      const endIdx = Math.min(items.length, startIdx + Math.ceil(containerRef.current?.clientHeight / rowHeight || 20) + 2);
      return (
        <div ref={containerRef} onScroll={e => setScrollTop(e.target.scrollTop)} style={{ overflow: 'auto', height: '100%' }}>
          <div style={{ height: items.length * rowHeight, position: 'relative' }}>
            {items.slice(startIdx, endIdx).map((item, i) => (
              <div key={startIdx + i} style={{ position: 'absolute', top: (startIdx + i) * rowHeight, width: '100%' }}>
                {renderItem(item, startIdx + i)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    ```
  - **Note:** Only worth implementing if you expect 100+ rows. Skip if your dataset stays small.

- [ ] **Deduplicate toast creation** (line 1579-1583)
  - **Current:** No dedup. Calling `toast('Refreshed','s')` 5 times in rapid succession creates 5 identical toasts.
  - **Fix:** Track the last toast message and suppress duplicates within 500ms:
    ```js
    const lastToast = useRef({ msg: '', ts: 0 });
    const toast = useCallback((msg, type = 's') => {
      if (msg === lastToast.current.msg && Date.now() - lastToast.current.ts < 500) return;
      lastToast.current = { msg, ts: Date.now() };
      // ... rest of toast logic
    }, []);
    ```

---

## 7. Accessibility

- [ ] **Add ARIA labels to icon-only buttons** (line 82, 525, 660-661, etc.)
  - **Current:** `<button className="btn-icon" onClick={onClose}>✕</button>` — screen readers announce "button, multiplication sign".
  - **Fix:** Add `aria-label` to every `btn-icon`:
    ```js
    <button className="btn-icon" onClick={onClose} aria-label="Close modal">✕</button>
    <button className="btn-icon" onClick={()=>setModal({type:'edit-firm',data:f})} aria-label="Edit firm">✎</button>
    <button className="btn-icon" style={{color:'var(--danger)'}} onClick={()=>setModal({type:'del-firm',data:f})} aria-label="Delete firm">✕</button>
    ```
  - Also add `aria-label="Drag to reorder"` to `.task-drag-handle` elements (line 360).

- [ ] **Add `role="dialog"` and focus management to modals** (line 520-534)
  - **Current:** Modal renders over the page but doesn't trap focus — keyboard users can tab to elements behind the overlay.
  - **Fix:**
    ```js
    function Modal({title, onClose, ...props}) {
      const modalRef = useRef(null);
      useEffect(() => {
        const first = modalRef.current?.querySelector('input, button, select, textarea');
        first?.focus();
      }, []);
      return (
        <div className="modal-ov" onClick={e => e.target === e.currentTarget && onClose()} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={modalRef}>
            <div className="modal-h"><h3 id="modal-title">{title}</h3>...
    ```

- [ ] **Add keyboard support for drag-and-drop**
  - **Current:** Drag-and-drop in OverviewTab, PipelineTab, and TodoTab is mouse-only (`draggable` + HTML5 DnD API). Keyboard users cannot reorder.
  - **Fix:** Add `onKeyDown` handlers that move items with arrow keys when focused:
    ```js
    onKeyDown={(e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); moveItem(index, index - 1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveItem(index, index + 1); }
    }}
    tabIndex={0}
    role="listitem"
    aria-label={`${item.title}, position ${index + 1} of ${total}`}
    ```

- [ ] **Add `<label>` binding to form inputs** (lines 577-609)
  - **Current:** `<label>Firm Name</label><input .../>` — the label is visual only, not programmatically linked.
  - **Fix:** Use `htmlFor` and `id`:
    ```js
    <label htmlFor="firm-name">Firm Name</label>
    <input id="firm-name" value={d.name} onChange={...} />
    ```
    Or wrap input inside label: `<label>Firm Name <input .../></label>`

- [ ] **Add visible focus indicators** (entire CSS)
  - **Current:** No `:focus-visible` styles defined. Browsers default is often invisible on dark backgrounds.
  - **Fix:** Add to CSS:
    ```css
    :focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    button:focus-visible, .btn:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      box-shadow: 0 0 0 4px rgba(129,211,26,.2);
    }
    ```

---

## 8. Responsive / Mobile

- [ ] **Fix sidebar hover on touch devices** (line 88)
  - **Current:** `.sidebar:hover { width:180px; }` — on touch devices, `:hover` behaves unpredictably (stays sticky after tap).
  - **Fix:** Wrap hover expansion in a hover-capable media query:
    ```css
    @media (hover: hover) {
      .sidebar:hover { width:180px; }
      .sidebar:hover .sidebar-label { opacity:1; }
    }
    ```
    On touch devices, the sidebar stays at 60px (icon-only). Users tap icons directly.

- [ ] **Add tablet breakpoint** (line 377)
  - **Current:** Only one breakpoint at `max-width:768px`. On a 768-1024px tablet, the desktop layout with full sidebar is cramped.
  - **Fix:** Add:
    ```css
    @media (max-width:1024px) {
      .overview { padding:16px; gap:12px; }
      .mm-stack { max-width:360px; }
    }
    ```

- [ ] **Make hover-only action buttons always visible on touch** (line 133-134, 368-369)
  - **Current:** `.fc-actions { opacity:0; }` and `.task-actions { opacity:0; }` — only shown on `:hover`. Touch users never see edit/delete buttons.
  - **Fix:**
    ```css
    @media (hover: none) {
      .fc-actions { opacity:1; }
      .task-actions { opacity:1; }
      .pl-card-actions { opacity:1; }
    }
    ```

- [ ] **Adjust font sizes for mobile readability** (lines 364, 167)
  - **Current:** `.task-title { font-size:13px; }`, `.pl-card-firm { font-size:12px; }` — below the 16px minimum recommended for mobile readability.
  - **Fix:** In the `@media (max-width:768px)` block:
    ```css
    .task-title { font-size:15px; }
    .pl-card-firm { font-size:13px; }
    .pl-card-role { font-size:14px; }
    .fc-item { font-size:13px; }
    .field label { font-size:13px; }
    .field input, .field select, .field textarea { font-size:16px; } /* prevents iOS zoom on focus */
    ```

---

## 9. CSS Cleanup

- [ ] **Extract repeated inline color values into CSS variables**
  - **Current:** `rgba(129,211,26,.12)` appears in inline styles at lines 1451, 1454, etc. Same for `rgba(255,99,72,.15)`.
  - **Fix:** Add to `:root`:
    ```css
    --accent-bg: rgba(129,211,26,.12);
    --accent-bg2: rgba(129,211,26,.06);
    --danger-bg: rgba(255,99,72,.15);
    --danger-bg2: rgba(255,99,72,.08);
    ```
    Replace all inline occurrences with `var(--accent-bg)` etc.

- [ ] **Consolidate inline styles that duplicate existing CSS classes**
  - **Current examples:**
    - Line 673: `style={{flex:1,overflow:'hidden',textOverflow:'ellipsis'}}` — this is the same as `.fc-item` overflow behavior
    - Line 905: `style={{display:'flex',alignItems:'center'}}` — could be a `.flex-row` utility class
  - **Fix:** Add utility classes:
    ```css
    .truncate { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .flex-center { display:flex; align-items:center; }
    .flex-between { display:flex; align-items:center; justify-content:space-between; }
    ```
    Replace inline styles with these classes.

- [ ] **Add CSS custom properties for all spacing/sizing magic numbers**
  - **Current:** Hard-coded values like `padding:20px`, `gap:16px`, `max-width:700px`, `min-width:300px`, `min-height:200px` scattered throughout.
  - **Fix:** Add to `:root`:
    ```css
    --sp-sm: 8px;
    --sp-md: 16px;
    --sp-lg: 24px;
    --sp-xl: 40px;
    --content-max: 700px;
    --card-min: 300px;
    ```

---

## Priority Summary

| Priority | Section | Items |
|----------|---------|-------|
| **P0 — Do now** | Security | Remove hardcoded password (1.1), add RLS policies (1.1), add token expiry (1.1), sanitize errors (1.1) |
| **P1 — Soon** | Error Handling | Error boundaries (5), `Promise.allSettled` (5), retry logic (5) |
| **P1 — Soon** | Responsive | Fix sidebar hover (8), show actions on touch (8), mobile font sizes (8) |
| **P2 — When convenient** | State Mgmt | Split context (2), granular reloads (2) |
| **P2 — When convenient** | Code Org | Extract utilities (3), drag hook (3) |
| **P3 — Nice to have** | Accessibility | ARIA labels (7), focus management (7), keyboard DnD (7) |
| **P3 — Nice to have** | Performance | Debounce (6), virtualization (6), toast dedup (6) |
| **P3 — Nice to have** | CSS | Variables (9), utility classes (9) |
