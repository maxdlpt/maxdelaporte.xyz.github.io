# Mobile App Plan — Job Search Tracker

> **How to use this document:** Every change has a checkbox. **Tick the ones you DO NOT want**, then feed this file back to Claude for one-shot implementation of everything that remains unchecked.
>
> All changes work with static GitHub Pages hosting (no build step, no server required) unless marked with **❗**.

---

## 1. Why PWA (and Why Not the Alternatives)

### The honest comparison

| Approach | Native feel | Effort | Works from Windows? | Cost | iPhone install without $99 fee? |
|----------|-------------|--------|--------------------|----|------|
| **PWA** (recommended) | 7/10 | Low — additive changes to existing code | Yes | Free | Yes — "Add to Home Screen" from Safari |
| **Capacitor** | 8/10 | Medium — need build system + native project | No — requires Mac for iOS builds (or $14/mo cloud) | $0-$14/mo | Only via AltStore (7-day expiry) |
| **React Native / Expo** | 9.5/10 | High — full rewrite of all UI | Partially — Expo Go for dev, but builds need Mac/cloud | $0-$29/mo | Only via AltStore (7-day expiry) |
| **AltStore sideload** | 8-9/10 | Varies | Yes (AltServer runs on Windows) | Free | Yes, but apps expire every 7 days — must reconnect to PC to refresh |

### Why PWA wins for your situation

1. **You're on Windows** — Capacitor and React Native both need Xcode (Mac-only) to produce an iOS `.ipa` file. Cloud build services exist but cost money.
2. **No developer fee** — TestFlight requires a $99/year Apple Developer Program membership. AltStore is free but your app expires every 7 days and you must refresh it from your PC.
3. **Your code already works** — A PWA wraps your existing app with a manifest and service worker. No rewrite needed.
4. **GitHub Pages compatible** — A PWA is just static files (`manifest.json`, `sw.js`, icon PNGs). Push to GitHub and it works.

### What PWA gives you
- **App icon** on your home screen (custom icon, not a Safari shortcut icon)
- **Splash screen** when launching (your logo on dark background, like a native app)
- **Fullscreen** — no Safari URL bar, no browser chrome, no tabs. Looks like a standalone app.
- **Offline support** — cached assets load instantly, queued mutations sync when back online
- **iOS 16.4+** — push notifications supported (optional)

### What PWA does NOT give you
- Not listed in the App Store (but you're the only user, so this doesn't matter)
- Safari's rendering engine under the hood (scrolling physics slightly different from native)
- If you don't open the app for ~7 days, iOS may clear its cached data (you'd need to re-login, but Supabase data is safe)
- No native haptics, no access to HealthKit/Contacts/etc. (not relevant for a job tracker)

### Future upgrade path
If you later get a Mac (even a $500 Mac Mini), you can wrap this exact PWA in **Capacitor** for a true native binary. All the PWA work carries over — Capacitor literally loads your web app in a native WebView. You'd then install via Xcode's free signing (7-day expiry) or pay $99/year for permanent installs + TestFlight.

---

## 2. PWA Infrastructure

- [ ] **Create `jobtracker/manifest.json`**
  - This tells the browser how to install the app (name, icon, colors, display mode).
  - **File to create:** `jobtracker/manifest.json`
    ```json
    {
      "name": "Job Search Tracker",
      "short_name": "JobTracker",
      "description": "Track firms, contacts, opportunities, and tasks for your job search",
      "start_url": "/jobtracker/index.html",
      "scope": "/jobtracker/",
      "display": "standalone",
      "orientation": "portrait",
      "background_color": "#1a1d27",
      "theme_color": "#1a1d27",
      "icons": [
        { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
        { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
        { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
      ]
    }
    ```

- [ ] **Create `jobtracker/sw.js` (service worker)**
  - Caches the HTML and CDN scripts for offline use. Uses network-first for Supabase API calls.
  - **File to create:** `jobtracker/sw.js`
    ```js
    const CACHE = 'jt-v1';
    const ASSETS = [
      '/jobtracker/index.html',
      '/logo3.svg',
      'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js',
    ];

    self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
    self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))));

    self.addEventListener('fetch', e => {
      const url = new URL(e.request.url);
      // Network-first for Supabase API
      if (url.hostname.includes('supabase.co')) {
        e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
        return;
      }
      // Cache-first for static assets
      e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })));
    });
    ```

- [ ] **Add PWA meta tags to `index.html` `<head>`** (after line 7)
  - These tell iOS Safari how to display the app when installed to home screen.
  - **Add after line 7:**
    ```html
    <!-- PWA -->
    <link rel="manifest" href="manifest.json">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="JobTracker">
    <link rel="apple-touch-icon" href="icons/icon-180.png">
    <meta name="theme-color" content="#1a1d27">
    ```
  - **Register the service worker** — add at the end of `<head>` before `<style>`:
    ```html
    <script>
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
      }
    </script>
    ```

- [ ] **Generate app icon set from `logo3.svg`**
  - **Files to create** in `jobtracker/icons/`:
    - `icon-180.png` — Apple touch icon (180x180, no padding)
    - `icon-192.png` — Android/PWA icon (192x192)
    - `icon-512.png` — High-res PWA icon (512x512)
    - `icon-maskable-512.png` — Maskable icon with 20% safe zone padding (512x512, logo centered in inner 60% area)
  - **Method:** Use the existing green briefcase SVG (`logo3.svg`), render on `#1a1d27` dark background, export as PNG at each size.
  - Claude will generate these as inline SVG-to-canvas-to-PNG, or you can use any image editor.

- [ ] **Generate Apple splash screens**
  - iOS requires specific splash images for each device resolution, otherwise you get a white flash on launch.
  - **Add to `<head>`:**
    ```html
    <!-- iPhone 15 Pro Max / 16 Pro Max (1290x2796) -->
    <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" href="icons/splash-1290x2796.png">
    <!-- iPhone 15 Pro / 16 Pro (1179x2556) -->
    <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="icons/splash-1179x2556.png">
    <!-- iPhone 15 / 16 (1170x2532) -->
    <link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" href="icons/splash-1170x2532.png">
    <!-- iPhone SE 3rd gen (750x1334) -->
    <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="icons/splash-750x1334.png">
    ```
  - **Each splash image:** Dark background (`#1a1d27`), centered `logo3.svg` at ~20% of screen width, "JobTracker" text below in white.
  - Claude will generate these programmatically (canvas-based script or static PNGs).

---

## 3. Mobile Navigation

- [ ] **Replace sidebar with bottom tab bar on mobile** (lines 86-108 CSS, lines 1644-1656 JSX)
  - **Current:** Left sidebar (60px collapsed, 180px on hover) with vertical icon+label navigation. Works great on desktop, unusable on mobile.
  - **Fix — CSS:** Add bottom tab bar styles and hide sidebar on mobile:
    ```css
    .bottom-nav { display:none; }

    @media (max-width:768px) {
      .sidebar { display:none; }
      .bottom-nav {
        display:flex;
        position:fixed;
        bottom:0; left:0; right:0;
        background:var(--card);
        border-top:1px solid var(--bdr);
        z-index:50;
        padding-bottom:env(safe-area-inset-bottom);
      }
      .bottom-nav-item {
        flex:1;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:2px;
        padding:8px 0 6px;
        color:var(--muted);
        font-size:10px;
        font-weight:600;
        cursor:pointer;
        transition:color .15s;
        -webkit-tap-highlight-color:transparent;
      }
      .bottom-nav-item.active { color:var(--accent); }
      .bottom-nav-item svg { width:22px; height:22px; }
      .main-area { padding-bottom:64px; } /* space for bottom nav */
    }
    ```
  - **Fix — JSX:** Add bottom nav element in Dashboard return, after `</div>` closing `.main-area` (line 1665):
    ```jsx
    <div className="bottom-nav">
      {tabs.map(({k, label, Icon}) => (
        <div key={k} className={`bottom-nav-item ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
          <Icon/><span>{label}</span>
        </div>
      ))}
    </div>
    ```

- [ ] **Add safe-area padding for notch/Dynamic Island** (lines 14-37 CSS)
  - **Current:** No safe-area awareness. Content renders under the notch and home indicator.
  - **Fix — Update viewport meta** (line 5):
    ```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    ```
  - **Fix — CSS:**
    ```css
    .topbar { padding-top: max(12px, env(safe-area-inset-top)); }
    .bottom-nav { padding-bottom: env(safe-area-inset-bottom); }
    body { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
    ```

- [ ] **Add tab transition animations**
  - **Current:** Tabs switch instantly with no visual feedback.
  - **Fix:** Add a subtle slide transition:
    ```css
    .tab-content { position:relative; overflow:hidden; }
    .tab-enter { animation: tabSlideIn .2s ease-out; }
    @keyframes tabSlideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    ```
    Apply `.tab-enter` class to each tab's wrapper div, keyed by tab name so React re-triggers the animation.

---

## 4. Touch-Friendly Interactions

- [ ] **Replace HTML5 drag-and-drop with pointer events on mobile**
  - **Current:** OverviewTab (line 634), PipelineTab (line 722), TodoTab all use `draggable` + `onDragStart/onDragOver/onDrop`. These events **do not fire on mobile Safari or iOS WebViews**.
  - **Fix:** Detect touch capability and use alternative UX on mobile:
    ```js
    const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    ```
    Then conditionally render touch-friendly alternatives (see below).

- [ ] **Pipeline: tap card to change stage (instead of drag between columns)**
  - **Current:** Drag an opportunity card from one column to another to change its stage.
  - **Mobile fix:** Tap a card → open a quick-action sheet where you pick the target stage:
    ```jsx
    // On mobile, tap opens stage picker instead of edit modal
    function PipelineCardMobile({opp, stages, onStageChange}) {
      const [showPicker, setShowPicker] = useState(false);
      return (
        <>
          <div className="pl-card" onClick={() => setShowPicker(true)}>
            {/* ... existing card content ... */}
          </div>
          {showPicker && (
            <Modal title="Move to stage" onClose={() => setShowPicker(false)} saveLabel="Move"
              onSave={() => { onStageChange(opp.id, selectedStage); setShowPicker(false); }}>
              <div style={{display:'flex', flexDirection:'column', gap:6}}>
                {stages.map(s => (
                  <button key={s.v} className={`btn ${opp.stage === s.v ? 'btn-p' : 'btn-s'}`}
                    style={{width:'100%', justifyContent:'center'}}
                    onClick={() => onStageChange(opp.id, s.v)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </Modal>
          )}
        </>
      );
    }
    ```
  - Desktop keeps drag-and-drop. Mobile shows tap-to-pick. Switch based on `isTouchDevice()`.

- [ ] **Todo: add up/down arrow buttons on mobile (instead of drag handles)**
  - **Current:** Drag handle `⠿` character (line 360) for reordering tasks.
  - **Mobile fix:** Replace drag handle with up/down buttons on touch devices:
    ```jsx
    {isTouchDevice() ? (
      <div className="task-move-btns">
        <button className="btn-icon" aria-label="Move up" onClick={() => moveTask(i, i-1)} disabled={i === 0}>▲</button>
        <button className="btn-icon" aria-label="Move down" onClick={() => moveTask(i, i+1)} disabled={i === total-1}>▼</button>
      </div>
    ) : (
      <span className="task-drag-handle" title="Drag to reorder">⠿</span>
    )}
    ```
    ```css
    .task-move-btns { display:flex; flex-direction:column; gap:2px; }
    .task-move-btns .btn-icon { padding:2px 4px; font-size:12px; }
    ```

- [ ] **Overview: disable firm card reordering on mobile**
  - **Current:** Firm cards are draggable to reorder (line 655).
  - **Mobile fix:** Remove `draggable` attribute and drag handlers on touch devices. Firms display in priority order (ones with tasks first) which is the natural order anyway.
    ```jsx
    <div key={f.id} className="firm-col"
      {...(!isTouchDevice() ? {
        draggable: true,
        onDragStart: e => onDragStart(e, i),
        onDragEnd, onDragOver: e => onDragOver(e, i),
        onDragLeave, onDrop: e => onDrop(e, i)
      } : {})}>
    ```

- [ ] **Add pull-to-refresh**
  - **Current:** Desktop users press `R` to refresh data. No mobile equivalent.
  - **Fix:** Custom pull-to-refresh at the top of `.tab-content`:
    ```js
    function usePullToRefresh(onRefresh) {
      const [pulling, setPulling] = useState(false);
      const [pullDist, setPullDist] = useState(0);
      const startY = useRef(0);
      const THRESHOLD = 80;

      function onTouchStart(e) {
        if (e.currentTarget.scrollTop === 0) startY.current = e.touches[0].clientY;
      }
      function onTouchMove(e) {
        if (!startY.current) return;
        const dy = e.touches[0].clientY - startY.current;
        if (dy > 0 && dy < 150) { setPullDist(dy); setPulling(dy > THRESHOLD); }
      }
      async function onTouchEnd() {
        if (pulling) await onRefresh();
        setPullDist(0); setPulling(false); startY.current = 0;
      }
      return { onTouchStart, onTouchMove, onTouchEnd, pullDist, pulling };
    }
    ```
    Add a pull indicator div that shows a spinner when `pullDist > THRESHOLD`.

---

## 5. Mobile CSS Overhaul

- [ ] **Full-screen modals on mobile** (line 274)
  - **Current:** `.modal { max-width:500px; max-height:90vh; }` — centered popup that may be cramped on small screens.
  - **Fix:**
    ```css
    @media (max-width:768px) {
      .modal {
        max-width:100%;
        max-height:100%;
        height:100%;
        border-radius:0;
        animation:slideUp .3s ease-out;
      }
      .modal-ov { align-items:flex-end; padding:0; }
      @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
    }
    ```

- [ ] **Larger tap targets (44px minimum)**
  - **Current:** `.btn-sm { padding:6px 12px; }` (line 80) — ~28px tall. `.btn-icon { padding:6px; }` (line 82) — ~28px. Below Apple's 44px minimum.
  - **Fix:**
    ```css
    @media (max-width:768px) {
      .btn { padding:12px 20px; min-height:44px; }
      .btn-sm { padding:10px 14px; min-height:44px; }
      .btn-icon { padding:10px; min-width:44px; min-height:44px; }
      .sidebar-item { padding:14px 0; }
      .combo-opt { padding:12px 14px; min-height:44px; }
      .task-checkbox { width:20px; height:20px; }
    }
    ```

- [ ] **Remove hover effects on touch devices** (lines 75, 83, 94, 125, 165, etc.)
  - **Current:** Many `:hover` pseudo-classes for visual feedback. On touch, these "stick" after tapping.
  - **Fix:** Wrap ALL hover rules in a hover-capable media query:
    ```css
    @media (hover: hover) {
      .btn-p:hover { background:var(--accent-h); box-shadow:0 4px 16px rgba(129,211,26,.3); }
      .btn-s:hover { color:var(--text); border-color:var(--muted); }
      .btn-icon:hover { color:var(--accent); background:rgba(129,211,26,.08); }
      .sidebar-item:hover { color:var(--text); background:rgba(255,255,255,.04); }
      .firm-col:hover { border-color:rgba(129,211,26,.4); box-shadow:var(--sh-sm); }
      .firm-col:hover .fc-actions { opacity:1; }
      .pl-card:hover { border-color:rgba(129,211,26,.4); transform:translateY(-1px); box-shadow:var(--sh-sm); }
      .fc-item:hover { background:rgba(255,255,255,.03); color:var(--text); }
      .task-row:hover { border-color:rgba(129,211,26,.3); box-shadow:var(--sh-sm); }
      .task-row:hover .task-actions { opacity:1; }
      .mm-btn-reject:hover { background:rgba(255,99,72,.12); transform:scale(1.1); }
      .mm-btn-accept:hover { background:rgba(129,211,26,.12); transform:scale(1.1); }
    }
    ```
    Add `:active` states for touch feedback instead (see section 6).

- [ ] **Single-column layouts on small screens**
  - **Current:** OverviewTab uses `Math.floor((el.offsetWidth - 40) / 316)` columns (line 628). On a 375px phone, this gives 1 column with cramped 316px cards.
  - **Fix:**
    ```css
    @media (max-width:768px) {
      .overview { flex-direction:column; }
      .overview-col { width:100%; }
      .firm-col { max-width:100%; }
      .add-firm-col { min-width:unset; max-width:100%; min-height:80px; }
      .pipeline { flex-direction:column; overflow-x:visible; }
      .pl-col { min-width:100%; flex:none; }
    }
    ```
    **Alternative for Pipeline:** Keep horizontal scroll with snap:
    ```css
    @media (max-width:768px) {
      .pipeline { overflow-x:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; }
      .pl-col { min-width:85vw; scroll-snap-align:start; flex:none; }
    }
    ```

- [ ] **Disable web-specific behaviors**
  - **Current:** Default Safari behaviors (long-press callout, elastic bounce, text selection on nav elements) break the native illusion.
  - **Fix:** Add to CSS:
    ```css
    /* Disable callout on long-press (e.g., on links, images) */
    body { -webkit-touch-callout:none; }
    /* Allow callout only on actual content (notes, text areas) */
    .field textarea, .field input { -webkit-touch-callout:default; }

    /* Prevent elastic overscroll bounce */
    html, body { overscroll-behavior:none; }

    /* Prevent text selection on interactive elements */
    .sidebar, .bottom-nav, .btn, .task-drag-handle, .mm-card, .pl-card, .firm-col {
      -webkit-user-select:none;
      user-select:none;
    }
    ```

---

## 6. Native Feel Polish

- [ ] **Add active/pressed states for touch feedback**
  - **Current:** No `:active` styles. Tapping a button gives no visual response on mobile.
  - **Fix:**
    ```css
    .btn:active { transform:scale(0.97); opacity:0.8; }
    .btn-icon:active { transform:scale(0.9); opacity:0.7; }
    .sidebar-item:active, .bottom-nav-item:active { opacity:0.7; }
    .task-row:active { background:rgba(129,211,26,.05); }
    .pl-card:active { transform:scale(0.98); }
    .firm-col:active { transform:scale(0.99); }
    .mm-action-btn:active { transform:scale(0.9); }
    ```

- [ ] **Smooth tab transition animations**
  - **Current:** Tabs switch with no animation, which feels jarring on mobile.
  - **Fix:** Wrap each tab's content in a div with an animation class:
    ```css
    .tab-slide { animation: tabFadeIn .15s ease-out; }
    @keyframes tabFadeIn { from { opacity:0; } to { opacity:1; } }
    ```
    ```jsx
    // In Dashboard, key forces React to re-mount and trigger animation
    <div className="tab-content">
      <div key={tab} className="tab-slide">
        {tab === 'todo' && <TodoTab/>}
        {/* ... */}
      </div>
    </div>
    ```

- [ ] **Custom pull-to-refresh spinner**
  - **Current:** If `overscroll-behavior:none` is set, the default Safari pull-to-refresh is disabled (which is what we want — it would reload the entire app).
  - **Fix:** The custom pull-to-refresh from Section 4 needs a visual indicator:
    ```jsx
    <div className="pull-indicator" style={{
      height: Math.min(pullDist, 60),
      opacity: pullDist / 80,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: pulling ? 'var(--accent)' : 'var(--muted)',
      fontSize: 12, fontWeight: 600, transition: 'color .15s'
    }}>
      {pulling ? '↻ Release to refresh' : '↓ Pull to refresh'}
    </div>
    ```

- [ ] **Prevent iOS zoom on input focus**
  - **Current:** iOS Safari auto-zooms the page when focusing on `<input>` fields with `font-size < 16px`.
  - **Fix:** Set all input font sizes to 16px on mobile:
    ```css
    @media (max-width:768px) {
      input, select, textarea { font-size:16px !important; }
    }
    ```

---

## 7. Installation Guide

### How to install the PWA on your iPhone

Once all the above changes are deployed to GitHub Pages:

1. Open Safari on your iPhone (must be Safari — Chrome/Firefox on iOS don't support PWA install)
2. Navigate to `maxdelaporte.xyz/jobtracker/index.html`
3. Tap the **Share** button (square with arrow, bottom of screen)
4. Scroll down and tap **"Add to Home Screen"**
5. You'll see the app name ("JobTracker") and icon — tap **"Add"**
6. The app now appears on your home screen with a proper icon
7. Launching it opens in fullscreen standalone mode — no URL bar, no Safari UI

### On Android (if needed)
1. Open Chrome on your Android phone
2. Navigate to `maxdelaporte.xyz/jobtracker/index.html`
3. Chrome will show an automatic **"Add to Home Screen"** banner
4. Tap it, or use Menu → "Add to Home Screen" / "Install app"

---

## 8. Limitations & Future Upgrade Path

### What this PWA cannot do
| Limitation | Impact | Workaround |
|------------|--------|------------|
| Not a "real" native app | Scrolling physics slightly different from native iOS apps | Unnoticeable for most users |
| No App Store listing | Can't share via App Store | You're the only user — install via Safari |
| No push notifications (iOS <16.4) | Can't send reminders | Works on iOS 16.4+ (Sep 2023 onwards) |
| Safari may clear data after ~7 days unused | Lose localStorage auth, must re-login | All data safe in Supabase — just re-login |
| No background sync | Offline changes don't auto-sync | Data syncs on next app open |
| No native Share Sheet integration | Can't share jobs to other apps | Copy-paste works fine |

### Upgrade to Capacitor (if you ever want more)
1. Get a Mac (Mac Mini ~$500, or use MacInCloud ~$5/day)
2. Run `npm init -y && npm install @capacitor/core @capacitor/cli @capacitor/ios`
3. Run `npx cap init "JobTracker" com.maxdelaporte.jobtracker`
4. Run `npx cap add ios`
5. Copy your web files to the `www/` folder
6. Run `npx cap sync && npx cap open ios`
7. In Xcode: sign with your Apple ID (free) → Build → Run on your iPhone
8. Apps signed with free Apple ID expire after 7 days. Pay $99/year for permanent + TestFlight.

All PWA work (manifest, mobile CSS, touch interactions) carries over to Capacitor with zero changes.

---

## Implementation Order

| Phase | Items | Priority |
|-------|-------|----------|
| **Phase 1 — PWA core** | `manifest.json`, `sw.js`, meta tags, icons | Must-have |
| **Phase 2 — Mobile nav** | Bottom tab bar, safe-area padding, viewport-fit | Must-have |
| **Phase 3 — Touch** | Replace DnD with tap-to-action, pull-to-refresh | Must-have |
| **Phase 4 — CSS** | Full-screen modals, tap targets, hover fixes, column layouts | Must-have |
| **Phase 5 — Polish** | Active states, tab transitions, input zoom fix, disable web behaviors | Nice-to-have |
| **Phase 6 — Splash** | Generate splash screen images for each iPhone size | Nice-to-have |

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `jobtracker/index.html` | **Modify** | Add meta tags, bottom nav JSX, mobile CSS, touch interaction logic |
| `jobtracker/manifest.json` | **Create** | PWA manifest (app name, icons, display mode) |
| `jobtracker/sw.js` | **Create** | Service worker (offline caching) |
| `jobtracker/icons/icon-180.png` | **Create** | Apple touch icon |
| `jobtracker/icons/icon-192.png` | **Create** | PWA icon (standard) |
| `jobtracker/icons/icon-512.png` | **Create** | PWA icon (high-res) |
| `jobtracker/icons/icon-maskable-512.png` | **Create** | Maskable icon for Android |
| `jobtracker/icons/splash-*.png` | **Create** | Splash screens per iPhone size |
