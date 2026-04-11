# Supabase Auth Migration — Technical Spec

**Project:** Job Search Tracker (`maxdelaporte.xyz/jobtracker`)
**Author:** Claude (for Max Delaporte)
**Date:** 2026-04-11
**Status:** Draft

---

## 1. Problem Statement

The app currently uses a custom authentication system that is **not suitable for a commercial product**. Three critical issues must be resolved before the app can be sold:

### 1.1 Row-Level Security (RLS) is disabled on every table

All six tables (`users`, `firms`, `contacts`, `opportunities`, `matchmaker`, `todos`) are marked **UNRESTRICTED** in Supabase. Anyone with the anon key can read, write, and delete any user's data — including contacts, opportunities, and personal notes.

### 1.2 The Supabase anon key is exposed in the frontend

The anon key is hardcoded at line 580 of `index.html`:
```js
const SUPABASE_KEY = 'eyJhbGciOiJI...';
```
This key is visible to anyone who opens DevTools. Combined with disabled RLS, this means **any visitor can query the entire database**.

### 1.3 Authentication is hand-rolled and fragile

The current system:
- Stores passwords as bcrypt hashes in a custom `users` table
- Uses two Supabase RPC functions (`check_password`, `create_user`) to handle login/signup
- Stores sessions in `localStorage` as `{ userId, username, ts }` with a 7-day expiry
- Filters data client-side by appending `user_id=eq.{id}` to every query — **this is cosmetic, not security** (any user can remove the filter)

There is no JWT, no refresh token, no email verification, no password reset flow, and no protection against API-level data access.

---

## 2. Target Architecture

Replace the custom system with **Supabase Auth** (built-in, battle-tested) + **Row-Level Security** on every table.

### 2.1 How Supabase Auth works

Supabase Auth manages user signup, login, sessions, and JWT tokens out of the box. When a user signs in:

1. Supabase returns an **access token** (JWT) containing the user's `auth.uid()`
2. The Supabase client automatically attaches this JWT to every API request
3. RLS policies on each table check `auth.uid()` against the row's `user_id`
4. Users can **only see their own rows** — enforced at the database level

The anon key remains public (this is by design). Security comes from RLS, not from hiding the key.

### 2.2 Auth flows supported

| Flow | Method |
|------|--------|
| Email + password signup | `supabase.auth.signUp()` |
| Email + password login | `supabase.auth.signInWithPassword()` |
| Magic link (passwordless) | `supabase.auth.signInWithOtp()` |
| OAuth (Google, GitHub, etc.) | `supabase.auth.signInWithOAuth()` |
| Password reset | `supabase.auth.resetPasswordForEmail()` |
| Logout | `supabase.auth.signOut()` |

For launch, implement **email + password** only. Magic links and OAuth can be added later without code changes to the data layer.

---

## 3. Database Changes

### 3.1 Add `user_id` foreign key to all tables (if missing)

Every data table must have a `user_id` column that references `auth.users(id)`. Currently, `firms`, `contacts`, `opportunities`, `matchmaker`, and `todos` already have a `user_id UUID` column — but it references the custom `users` table, not `auth.users`.

**Migration SQL:**

```sql
-- Step 1: Create a mapping from old user IDs to new Supabase Auth user IDs
-- (Run AFTER existing users have been re-registered via Supabase Auth)
-- This will be a manual/scripted step per user — see Section 6.

-- Step 2: Update foreign key references (run after migration)
-- No structural change needed if user_id remains UUID type.
-- The column values will be updated to match auth.users(id) UUIDs.
```

### 3.2 Enable RLS on every table

```sql
-- Enable RLS
ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaker ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Drop the custom users table after migration (it's replaced by auth.users)
-- DROP TABLE users;  -- only after all user_id references are migrated
```

### 3.3 Create RLS policies

Each table gets the same four policies (SELECT, INSERT, UPDATE, DELETE):

```sql
-- Template (repeat for each table: firms, contacts, opportunities, matchmaker, todos)

CREATE POLICY "Users can view own rows"
  ON firms FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own rows"
  ON firms FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own rows"
  ON firms FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own rows"
  ON firms FOR DELETE
  USING (user_id = auth.uid());
```

Repeat for: `contacts`, `opportunities`, `matchmaker`, `todos`.

### 3.4 Drop custom auth RPC functions

```sql
DROP FUNCTION IF EXISTS check_password(text, text);
DROP FUNCTION IF EXISTS create_user(text, text);
```

---

## 4. Frontend Changes

### 4.1 Add the Supabase JS client

Replace the raw `fetch`-based `DB` class with the official Supabase client library, which handles auth tokens automatically.

**Add to `<head>`:**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

### 4.2 Initialize the Supabase client

**Replace** the current `DB` class (lines 789–797) and config functions (lines 798–811):

```js
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
```

That's it. The client automatically handles JWT tokens, session refresh, and auth state.

### 4.3 Replace the DB class methods

| Current method | Supabase equivalent |
|---|---|
| `db.get('firms', 'limit=10')` | `supabase.from('firms').select('*').limit(10)` |
| `db.ins('firms', data)` | `supabase.from('firms').insert(data).select().single()` |
| `db.upd('firms', id, data)` | `supabase.from('firms').update(data).eq('id', id).select().single()` |
| `db.del('firms', id)` | `supabase.from('firms').delete().eq('id', id)` |
| `db.rpc('check_password', params)` | **Removed** — use `supabase.auth.signInWithPassword()` |
| `db.rpc('create_user', params)` | **Removed** — use `supabase.auth.signUp()` |

**Critical change:** Remove all manual `user_id=eq.{id}` filtering from queries. RLS handles this automatically. The client no longer needs to know the user's ID to filter — the database does it.

### 4.4 Replace the SignInScreen component

**Current flow:**
1. User enters username + password
2. App calls `db.rpc('check_password', ...)` which runs a Postgres function
3. If match, stores `{ userId, username, ts }` in localStorage

**New flow:**
1. User enters email + password
2. App calls `supabase.auth.signInWithPassword({ email, password })`
3. Supabase returns a session with JWT — stored automatically by the client
4. On page load, `supabase.auth.getSession()` checks if a session exists

```jsx
// Sign In
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password,
});

// Sign Up
const { data, error } = await supabase.auth.signUp({
  email: email,
  password: password,
});

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') { /* reload data */ }
  if (event === 'SIGNED_OUT') { /* show login */ }
});

// Logout
await supabase.auth.signOut();
```

### 4.5 Replace the App component entry point

**Current** (lines 2512–2516):
```js
function App(){
  const cfg = getDbConfig();
  if (!cfg) return <SetupScreen/>;
  const auth = getAuth();
  if (!auth || !auth.userId) return <SignInScreen/>;
  return <Dashboard db={new DB(cfg.url, cfg.key, auth.userId)}/>;
}
```

**New:**
```js
function App(){
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <LoadingScreen/>;
  if (!session) return <SignInScreen/>;
  return <Dashboard/>;
}
```

### 4.6 Remove the SetupScreen component

The `SetupScreen` (lines 2456–2510) prompts users to enter a Supabase URL and anon key. This is no longer needed — the credentials are hardcoded (and safe, because RLS protects the data). Delete the entire component.

### 4.7 Remove `getAuth()`, `getDbConfig()`, and `localStorage` auth logic

These functions (lines 798–811) and all references to `hfcrm_auth` and `hfcrm_config` in localStorage are replaced by Supabase's built-in session management.

---

## 5. Files Changed

| File | Change |
|---|---|
| `jobtracker/index.html` | Replace DB class, SignInScreen, SetupScreen, App component. Add Supabase JS client CDN. Remove `getAuth()`, `getDbConfig()`, and all `localStorage` auth logic. |
| `jobtracker/sw.js` | Add `cdn.jsdelivr.net` to CDN cache list (already done for other CDN assets). |
| Supabase SQL Editor | Enable RLS, create policies, drop custom RPC functions, migrate user IDs. |

---

## 6. User Migration Plan

Existing users (`max_dlpt`, `viktoria`, `demo`, `carlatabarie`) need to be migrated from the custom `users` table to Supabase Auth.

### Option A: Invite-based migration (recommended)

1. For each existing user, create a Supabase Auth account via the Supabase dashboard (Authentication → Users → Invite User)
2. Record the mapping: `old_user_id → new_auth_uid`
3. Run an UPDATE on each data table to replace old `user_id` values with the new `auth.uid()` values
4. Send each user a password reset link so they can set their own password

```sql
-- Example: migrate max_dlpt's data
UPDATE firms SET user_id = '<new_auth_uid>' WHERE user_id = '2d91046d-8434-4ef3-8c91-3a12e94b20f3';
UPDATE contacts SET user_id = '<new_auth_uid>' WHERE user_id = '2d91046d-8434-4ef3-8c91-3a12e94b20f3';
UPDATE opportunities SET user_id = '<new_auth_uid>' WHERE user_id = '2d91046d-8434-4ef3-8c91-3a12e94b20f3';
UPDATE matchmaker SET user_id = '<new_auth_uid>' WHERE user_id = '2d91046d-8434-4ef3-8c91-3a12e94b20f3';
UPDATE todos SET user_id = '<new_auth_uid>' WHERE user_id = '2d91046d-8434-4ef3-8c91-3a12e94b20f3';
-- Repeat for each user
```

### Option B: Self-serve re-registration

1. Deploy the new auth system
2. Existing users create new accounts (new email + password)
3. Run a one-time migration script that maps old usernames to new auth IDs
4. Drop the old `users` table

Option A is cleaner for a small user base. Option B scales better.

---

## 7. Security Checklist

After migration, verify:

- [ ] RLS is enabled on `firms`, `contacts`, `opportunities`, `matchmaker`, `todos`
- [ ] Each table has SELECT, INSERT, UPDATE, DELETE policies scoped to `auth.uid()`
- [ ] The custom `users` table is dropped (or at minimum, has RLS enabled)
- [ ] The `check_password` and `create_user` RPC functions are dropped
- [ ] No client-side code references `hfcrm_auth` or `hfcrm_config` in localStorage
- [ ] The `DB` class no longer exists — all queries go through the Supabase client
- [ ] A non-authenticated request to `/rest/v1/firms` returns zero rows (RLS blocks it)
- [ ] User A cannot see User B's data (test with two accounts)
- [ ] Password reset flow works end-to-end
- [ ] Session persists across page reloads (Supabase handles this via `localStorage` internally with proper token refresh)

---

## 8. Implementation Order

| Step | Effort | Risk |
|---|---|---|
| 1. Enable RLS + create policies (SQL only) | 15 min | Low — can be done immediately, no code change needed. Existing app continues to work because the anon key bypasses RLS by default (we fix this in step 3). |
| 2. Add Supabase JS client CDN to index.html | 5 min | None |
| 3. Replace DB class with Supabase client calls | 1–2 hrs | Medium — every data operation changes. Test thoroughly. |
| 4. Replace SignInScreen with Supabase Auth flow | 1 hr | Medium — new UI for email-based login. |
| 5. Remove SetupScreen, getAuth, getDbConfig | 15 min | Low — just deletion. |
| 6. Migrate existing users (Option A) | 30 min | Low — 4 users, manual process. |
| 7. Drop old users table + RPC functions | 5 min | Low — cleanup. |
| 8. End-to-end security test | 30 min | — |

**Total estimated effort: 4–5 hours**

---

## 9. Future Enhancements (post-launch)

These are not required for launch but add value for a paid product:

- **Magic link login** — passwordless sign-in via email link (`supabase.auth.signInWithOtp()`)
- **OAuth** — "Sign in with Google" (`supabase.auth.signInWithOAuth({ provider: 'google' })`)
- **Email verification** — require users to confirm their email before accessing data
- **Role-based access** — admin vs. regular user (use Supabase custom claims or a `profiles` table)
- **Rate limiting** — Supabase has built-in rate limiting on auth endpoints
- **Audit logging** — track login events for compliance