# HF Job Tracker — Upgrade Spec v2

Baseline: current `jobtracker/index.html` (post-sidebar/pipeline upgrade).

---

## 0. AUTHENTICATION REFACTOR: Database-backed sign-in + persistent Supabase connection

**Current:** Every time you open the app on a new device, you hit a Setup screen asking for Supabase URL, API key, and password. Once configured, it stores `hfcrm_config` and `hfcrm_auth` in localStorage.

**Change:**
- **Backend:** Hard-code the Supabase URL and API key into the app itself (not exposed in UI). Create a new `users` table in Supabase to store username/password pairs.
- **Frontend:** Replace the Setup/Login two-screen flow with a single **Sign-in screen** that only asks for username and password (no Supabase setup needed).
- **User credentials:** Stored in Supabase `users` table with columns: `id`, `username`, `password_hash` (or plaintext if you prefer simplicity), `created_at`.
- **Persistence:** On successful sign-in, store an auth token or session flag in localStorage (e.g., `{username, ts}` or a simple `{loggedIn: true}`). On load, check localStorage; if missing/invalid, show the sign-in screen. If valid, jump to Dashboard.
- **Result:** Any device, any browser — user opens the app, sees sign-in screen, enters username (`max_dlpt`) and password (`Mulasasa1`), and immediately accesses the tracker. The app always connects to the same Supabase backend automatically.

**Implementation details:**

1. **Create `users` table in Supabase SQL Editor:**
   ```sql
   CREATE TABLE users (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     username TEXT NOT NULL UNIQUE,
     password TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Insert your user
   INSERT INTO users (username, password) VALUES ('max_dlpt', 'Mulasasa1');
   ```
   (Optional: hash the password using a library, but plaintext is fine for simplicity on a personal app.)

2. **Hard-code Supabase credentials at the top of the script:**
   ```javascript
   const SUPABASE_URL = '...'; // e.g., 'https://xxxx.supabase.co'
   const SUPABASE_KEY = '...'; // anon/legacy key
   ```
   Do NOT ask the user to provide these.

3. **Create a `SignInScreen` component (replaces `SetupScreen` + `LoginScreen`):**
   - Two input fields: username and password.
   - On submit, call a simple async function `verifyCredentials(username, password)` that queries the `users` table.
   - If match found, set `localStorage.setItem('hfcrm_auth', JSON.stringify({username, ts: Date.now()}))` and navigate to `App()`.
   - If no match, show an error message.

4. **Update `App()` function:**
   ```javascript
   function App() {
     const auth = getAuth(); // reads localStorage
     if (!auth) return <SignInScreen />;

     // Auth exists, create DB with hard-coded credentials
     const db = new DB(SUPABASE_URL, SUPABASE_KEY);
     return <Dashboard db={db} />;
   }
   ```

5. **Logout:** Clear localStorage auth and return to sign-in screen.

**Security note:** Storing credentials in localStorage means anyone with browser access can see them. For a personal app behind the sign-in screen, this is acceptable. If you need stronger security, consider token-based auth (JWT) or session management.

---

## 1. BUG FIX: Pipeline stage changes not persisting

**Problem:** Dragging a card from one pipeline column to another does not update the opportunity's `stage` in Supabase.

**Root cause to investigate:** In `PipelineTab`, the `onCardDragOver` handler calls `e.stopPropagation()`, which prevents the parent `.pl-col`'s `dragover` from firing when hovering over an existing card. While the card-level `dragover` does call `e.preventDefault()`, the `drop` event may not reliably bubble to the column's `onDrop` handler across all browsers. Additionally, when dragging between stages, `onCardDragOver` only handles same-stage reordering logic — there is no cross-stage drop handler at the card level.

**Fix:** Add an `onDrop` handler directly on each `.pl-card` element that handles cross-stage moves (delegates to `colDrop`). Ensure `e.preventDefault()` is called in all relevant `dragover` handlers. Remove `e.stopPropagation()` from `onCardDragOver` or restructure so that column-level drop always works regardless of whether the cursor is over a card or empty space.

---

## 2. Interview Rounds columns: same width as main columns

**Current:** `.itv-grid` uses `grid-template-columns: 1fr 1fr 1fr` and `.itv-grid .pl-col` overrides `min-width:0; max-width:none`. Main columns use fixed `min-width:220px; max-width:220px`.

**Change:** Make all pipeline columns (main and interview) the same width. The interview grid columns should each be the same width as "Not Applied", "Waiting", "Rejected", "Offer".

---

## 3. Pipeline columns fill full available width

**Current:** All columns have fixed `min-width:220px; max-width:220px` with horizontal scroll.

**Change:** Switch the pipeline layout from fixed-width scrollable columns to a responsive flex/grid layout where columns expand to fill the full width of `.tab-content`. The `.pipeline` container should use `display:flex` with columns set to `flex:1; min-width:0` (no `max-width`). The `.itv-group` should also `flex` proportionally (taking ~5/9 of total width since it contains 5 of the 9 stages). Remove `overflow-x:auto` from `.pipeline`. Each column inside `.itv-grid` also flexes to fill its container.

On small screens (<768px), revert to scrollable fixed-width columns.

---

## 4. Hide rejected opportunity cards from Pipeline tab (recycling bin column)

**Current:** The "Rejected" column is rendered like all other stages with cards displayed.

**Change:** The Rejected column still renders on the pipeline, but acts as a visual "recycling bin" where cards disappear. When a card is dragged into the Rejected column, its `stage` is updated to `rejected` in Supabase, but the card no longer appears in the column — it vanishes from the pipeline view. The Rejected column displays a centered recycling bin SVG icon (muted, semi-transparent) to indicate it's a disposal zone.

Rejected opportunities remain visible and editable in the Opportunities tab. The pipeline now shows: Not Applied | Waiting | [Interview Rounds] | Rejected (recycling bin icon, no cards) | Offer (5 main zones + 5 interview = 9 total columns).

**Implementation:**
- In `renderCol`, detect if `stg.v === 'rejected'`.
- If rejected and no cards to show, render the recycling bin SVG centered in the `.pl-drop` area.
- Filter displayed items: `{items.length && stg.v !== 'rejected' ? items.map(...) : (stg.v === 'rejected' ? <RecyclingBinIcon/> : <div className="pl-empty">Drop here</div>)}`
- The column still accepts drops and updates the stage in the DB.

**Recycling bin SVG component (add near other icon definitions):**
```javascript
const IconRecyclingBin = () => <svg fill="var(--muted)" opacity="0.4" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" style={{width:'60px', height:'60px', margin:'0 auto'}}>
  <g transform="translate(0.000000,511.000000) scale(0.100000,-0.100000)">
    <path d="M860,4761.7c-341.1-83.7-643.4-379.9-731.2-716.9c-34.7-138.9-38.8-386-8.2-520.8c53.1-234.9,232.8-480,451.4-620.9c112.3-71.5,273.7-134.8,345.2-134.8c22.5,0,44.9-12.3,49-24.5c6.1-22.5,279.8-2175.3,716.9-5653.7c61.3-488.2,124.6-933.4,143-990.6c87.8-283.9,381.9-553.5,690.4-635.2c85.8-22.5,537.2-28.6,2506.2-28.6c2614.4,0,2481.7-6.1,2714.5,112.3c206.3,104.2,410.5,343.1,478,553.5c18.4,55.2,212.4,1525.8,431,3266c220.6,1742.3,406.5,3214.9,414.6,3276.2l14.3,108.3l112.3,34.7c328.8,102.1,602.5,388.1,686.3,719c44.9,175.7,30.6,473.9-30.6,635.2c-96,251.2-332.9,488.2-590.3,592.3l-116.4,47l-4085.1,4.1C1828.2,4786.2,943.8,4782.1,860,4761.7z M9144.5,4140.7c112.3-59.2,145-145,145-371.7s-32.7-312.5-145-371.7c-65.4-34.7-236.9-36.8-4140.2-36.8c-3995.2,0-4072.8,0-4148.4,40.8c-112.3,57.2-145,138.9-145,371.7c0,222.6,32.7,308.4,145,367.7c65.4,34.7,236.9,36.8,4144.3,36.8C8907.6,4177.5,9079.2,4175.4,9144.5,4140.7z M4242.5,2672.1c-36.8-42.9-300.2-328.8-586.2-635.2l-520.8-557.6l-55.2,57.2c-30.6,30.6-228.8,241-439.1,465.7c-212.4,224.7-459.6,484.1-549.4,578l-165.4,167.5h1192.8h1190.8L4242.5,2672.1z M8051.8,2702.8c-20.4-24.5-290-310.5-594.4-633.2l-557.6-586.2l-545.4,586.2c-302.3,322.7-565.8,608.7-586.2,633.2l-38.8,44.9H6910h1180.6L8051.8,2702.8z M5753.9,1822.5c396.2-424.9,716.9-780.3,712.8-790.5C6456.6,1005.4,5035-489.7,5018.6-489.7c-26.5,0-1448.2,1511.5-1444.1,1533.9c8.2,28.6,1431.8,1560.5,1448.2,1554.4C5028.8,2596.6,5357.7,2247.3,5753.9,1822.5z M2210.2,1573.3c275.7-292.1,500.4-537.2,498.4-545.4c-8.2-18.4-780.2-849.7-792.5-851.7c-6.1-2-65.4,426.9-130.7,953.9c-65.4,524.9-122.6,972.2-128.7,994.7C1644.4,2175.8,1595.3,2224.8,2210.2,1573.3z M8262.2,1158.6c-69.5-541.3-130.7-982.5-140.9-980.4c-20.4,8.2-792.5,841.5-792.5,857.9c0,16.3,1045.8,1123.4,1053.9,1115.2C8384.7,2147.2,8331.6,1701.9,8262.2,1158.6z M3874.8-183.3c394.2-414.6,716.9-759.8,716.9-765.9c-2-14.3-1409.4-1499.2-1429.8-1507.4c-12.3-4.1-224.7,216.5-966.1,1009l-96,104.2l-40.8,304.3c-22.5,167.5-40.8,332.9-40.8,365.6c0,53.1,79.7,149.1,555.6,659.7c304.3,328.8,561.7,594.4,569.9,592.3C3151.8,574.5,3482.7,233.4,3874.8-183.3z M7469.7-19.9c633.2-680.2,573.9-561.7,514.7-1029.4c-38.8-292.1-38.8-292.1-118.5-377.9c-44.9-44.9-281.9-298.2-527-559.6c-245.1-261.5-451.4-471.8-461.6-469.8c-20.4,8.2-1427.7,1493.1-1427.7,1509.4c0,22.5,1435.9,1531.9,1452.2,1525.8C6910,574.5,7165.3,306.9,7469.7-19.9z M5753.9-2162.5l714.9-755.7l-149.1-157.3c-81.7-85.8-298.2-318.7-484.1-516.8l-335-359.5h-480l-480,2l-475.9,508.6c-261.4,279.8-475.9,514.7-478,522.9c-2,20.4,1419.6,1521.7,1437.9,1515.6C5032.9-1406.8,5359.7-1747.9,5753.9-2162.5z M2485.9-2644.6l251.2-265.5l-190-204.2c-104.2-112.3-192-202.2-194-198.1c-4.1,2.1-30.6,194-59.2,422.8c-28.6,230.8-57.2,439.1-61.3,465.7c-6.1,24.5-8.2,44.9-4.1,44.9C2232.6-2379,2349-2497.5,2485.9-2644.6z M7755.6-2838.6c-32.7-247.1-61.3-457.5-65.4-465.7c-2.1-10.2-89.9,75.6-196.1,187.9l-190,206.3l251.2,265.5c138.9,145,253.3,261.4,255.3,259.4C7812.8-2387.2,7788.3-2591.5,7755.6-2838.6z M3693-3935.4c0-10.2-245.1-16.3-543.3-16.3c-426.9,0-539.2,6.1-527,26.6c8.2,12.3,130.7,147.1,271.7,296.2l257.4,269.6l269.6-279.8C3570.5-3794.5,3691-3927.3,3693-3935.4z M7416.6-3923.2c14.3-24.5-73.5-28.6-527-28.6c-428.9,0-541.3,6.1-529,26.6c8.2,12.3,130.7,147.1,271.7,294.1l255.3,271.7l255.3-269.6C7283.8-3776.1,7408.4-3908.9,7416.6-3923.2z"/>
  </g>
</svg>;
```

---

## 5. Pipeline drop zones: minimum height for one card

**Current:** `.pl-drop` has `min-height:80px`.

**Change:** Increase `.pl-drop` min-height to `120px` so that empty columns visually accommodate at least one card height (a card is ~70-80px with padding). This makes it clear to the user that the card will fit.

---

## 6. Pipeline columns expand vertically on drag-hover

**Current:** Columns get a border/glow on drag-over but don't change size.

**Change:** When a card is being dragged over a column (`.pl-col.drag-over`), add a CSS transition that increases the column's `min-height` or adds extra `padding-bottom` to the `.pl-drop` area (e.g., `padding-bottom: 80px`) with a smooth transition. This creates a visual "opening up" effect showing where the card will land. The transition should use the same duration as other animations (see #7). Remove the extra space when drag leaves.

**Implementation:** Add/remove a `drag-over` class on the `.pl-col` (already done). Then in CSS:
```css
.pl-drop { transition: padding-bottom 0.3s ease; }
.pl-col.drag-over .pl-drop { padding-bottom: 80px; }
```

---

## 7. Slightly slower animations

**Current transition durations:**
- `.pl-card` transform/opacity: `0.2s`
- `.pl-card:hover` transform: `0.2s`
- `slideIn` animation: `0.25s`
- `.pl-col` border/shadow transition: `0.2s`
- `.sidebar` width: `0.25s`
- `.firm-col` transform/opacity: `0.25s`

**Change:** Increase all animation/transition durations by ~40%:
- `.pl-card` transitions: `0.2s` → `0.28s`
- `slideIn`: `0.25s` → `0.35s`
- `.pl-col` transitions: `0.2s` → `0.28s`
- `.sidebar` width: `0.25s` → `0.35s`
- `.firm-col` transitions: `0.25s` → `0.35s`
- `fadeIn` animation: `0.4s` → `0.5s`
- `popIn` animation: `0.25s` → `0.35s`

Do NOT make anything sluggish — this is a subtle increase.

---

## 8. Pipeline card color matches stage color

**Current:** All pipeline cards use the same `var(--card)` background with `var(--bdr)` border. The stage color only appears on the column header's bottom border.

**Change:** Each `.pl-card` should have a left border (3px solid) colored to match its stage:
- Not Applied → `var(--col-neutral)` (gray)
- Waiting → `var(--col-amber)` (amber)
- Interview stages (hirevue, phone_itv, interview, test, case_study) → `var(--col-lgreen)` (light green)
- Offer → `var(--col-green)` (green)
- Rejected → `var(--col-red)` (red, though won't be visible in column)

**Implementation:** In `renderCol`, pass the stage's color variable to each card. Add an inline `style={{ borderLeft: '3px solid var(--col-X)' }}` on each `.pl-card`, where X is derived from the stage's `color` property.

---

## 9. Overview: remove Priority toggle

**Current:** `FirmForm` has a priority checkbox. Firm cards show a "Priority" tag. The `firms` table has a `priority BOOLEAN` column.

**Change:** Remove the priority checkbox from `FirmForm` entirely. Remove the `{f.priority && <span className="tag tag-p">Priority</span>}` display from firm cards. The `priority` field stays in the DB (no migration needed) but is no longer exposed in the UI.

Priority is now implicit: the first 5 firms by `order_position` are the priorities. No visual indicator needed — the user knows the order is what matters since they can drag to reorder.

---

## 10. Overview: remove contact/opportunity count text, move count to section headers

**Current:** Each firm card's `.fc-meta` shows `{firmContacts(f.id).length}c · {firmOpps(f.id).length}o` (e.g., "3c · 2o").

**Change:** Remove that `<span>` entirely from `.fc-meta`. Instead, move the count next to the section headers ("CONTACTS" and "OPPORTUNITIES"). The headers should read like "CONTACTS (3)" and "OPPORTUNITIES (2)".

**Implementation:** In the `.fc-section-head`, add the count: `<span>Contacts {firmContacts(f.id).length && `(${firmContacts(f.id).length})`}</span>` and similarly for Opportunities.

---

## Summary of affected code sections

| # | Section | Type |
|---|---------|------|
| 0 | Setup/Login screens, DB init, App | Auth refactor |
| 1 | `PipelineTab` drag handlers | Bug fix |
| 2 | `.itv-grid` CSS, `.pl-col` CSS | Style |
| 3 | `.pipeline` CSS, `.pl-col` CSS, `.itv-group` CSS | Layout |
| 4 | `PipelineTab` render, new `IconRecyclingBin`, `.pl-drop` logic | Logic + icon |
| 5 | `.pl-drop` CSS | Style |
| 6 | `.pl-drop` / `.pl-col.drag-over` CSS | Style + interaction |
| 7 | Multiple CSS transitions/animations | Style |
| 8 | `renderCol` JSX, new CSS classes | Style + JSX |
| 9 | `FirmForm`, `OverviewTab` JSX | Remove code |
| 10 | `OverviewTab` `.fc-section-head` JSX | Restructure code |

---

## Success criteria

- Opening the app on any device shows a sign-in screen (no Setup needed). Username `max_dlpt` / password `Mulasasa1` logs in.
- After sign-in, stored credentials work across devices automatically.
- Dragging a card between pipeline stages persists the new stage to Supabase and reflects on reload.
- All pipeline columns are the same width and collectively fill the viewport width.
- Interview Rounds columns are visually identical in width to main columns.
- Rejected column is visible but displays a recycling bin icon; dropped cards disappear from view but update in the DB.
- Empty columns are tall enough to clearly accept a card drop.
- Columns visually expand when a card hovers over them.
- Animations are slightly slower but still snappy.
- Pipeline cards have a colored left border matching their stage.
- No priority checkbox in firm forms. No "Priority" tag on firm cards.
- No "Xc · Yo" text on firm cards. Counts appear next to "CONTACTS" and "OPPORTUNITIES" headers instead.
