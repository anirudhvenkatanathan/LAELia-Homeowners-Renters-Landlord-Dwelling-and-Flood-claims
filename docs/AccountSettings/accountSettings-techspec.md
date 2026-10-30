# Universal Account Settings & Password Management – Technical Specification

## 1. Files

```
sourceCode/apps/api/graphQL/loginEntity.ts        — updateProfile/changePassword mutations (extends existing file)

sourceCode/apps/frontEnd/src/
├── context/AuthContext.tsx                        — updateUser() added (extends existing file)
├── models/accountSettings/accountSettingsModel.ts — UpdateProfileResult, ChangePasswordResult
├── services/accountSettings/accountSettingsService.ts — updateProfile(), changePassword()
├── components/accountSettings/
│   ├── AccountSettingsModal.tsx                   — modal chrome + tab switcher
│   ├── ProfileTab.tsx
│   ├── ChangePasswordTab.tsx
│   └── PasswordInput.tsx                          — shared show/hide password field
└── components/layout/SidebarUserFooter.tsx        — shared footer + dropdown, replaces
                                                       3 duplicated copies in:
                                                       Sidebar.tsx, ActiveVendorShell.tsx,
                                                       VendorPortalShell.tsx
```

`skin/css/custom.css` gained new rules for:
- Dropdown menu
- Modal tabs
- Account Settings user-info header
- Read-only field styling
- Password-toggle input

`main.css` was not touched.

## 2. Backend — `graphQL/loginEntity.ts`

### 2.1 Shared password policy

```ts
function validatePasswordPolicy(password: string): string | null {
  if (password.length < 6) return 'Password must be at least 6 characters.';
  if (!/\d/.test(password)) return 'Password must contain at least one number.';
  if (!/[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(password)) return 'Password must contain at least one special character.';
  return null;
}
```

- Extracted from `vendorSignUp`'s previously-inline checks.
- Both `vendorSignUp` and `changePassword` call this single implementation now.

### 2.2 Schema

```graphql
type UpdateProfileResponse { success: Boolean!, message: String!, username: String }
type ChangePasswordResponse { success: Boolean!, message: String! }

extend type Mutation {
  updateProfile(token: String!, username: String!): UpdateProfileResponse!
  changePassword(token: String!, currentPassword: String!, newPassword: String!): ChangePasswordResponse!
}
```

- Follows this file's existing house style (`login`, `vendorSignUp`).
- Business-logic failures return `{success: false, message}` rather than throwing a GraphQL error.

### 2.3 Resolvers

- **`updateProfile(token, username)`**
  - `jwt.verify(token)` for the caller's `loginId`.
  - Trims/validates the new username (non-empty, ≥3 chars).
  - Checks uniqueness via `LoginUserModel.findOne({ username, loginId: { $ne: callerLoginId } })`.
  - `findOneAndUpdate` on the caller's own record only.
  - Returns the persisted `username`.
    - Frontend doesn't need to assume the trim/casing it sent.
- **`changePassword(token, currentPassword, newPassword)`**
  - `jwt.verify(token)`.
  - Loads the caller's own `LoginUserModel` document.
  - `bcrypt.compare` against the stored hash (wrong password → `'Current password is incorrect.'`).
  - Rejects `newPassword === currentPassword`.
  - Runs `validatePasswordPolicy`.
  - Hashes with `bcrypt.hash(newPassword, 10)` and saves.

- Both resolvers identify "whose record" solely from the JWT payload's `loginId`, never a client-supplied id — a caller can only modify their own account.

### 2.4 Known, accepted limitation

- JWT embeds `username` at login time, not reissued on a username change.
  - Reissuing would touch session/token management — out of scope.
- No other resolver trusts a token's embedded `username` for business logic — only `loginId` is trusted.
  - Self-contained — no stale-permissions issue.
- Username change: current token stays valid until expiry or next login.
  - Next login (or expiry) issues a new token carrying the updated value.

## 3. Frontend — session layer

### 3.1 `AuthContext.updateUser(patch)`

```ts
updateUser: (patch: Partial<AuthUser>) => void;
```

- Patches the in-memory `user` state and `localStorage['ct_auth_user']` in place.
- Does not re-fetch or touch the session token (`ct_auth_token` is untouched).
- `login`, `logout`, and `loginAsServiceProvider` are unchanged.
- Makes a profile save reflect immediately in the sidebar/header without a reload.
  - Confirmed via `localStorage.getItem('ct_auth_user')` inspection after a save and after a full page reload.

### 3.2 Service layer

- `services/accountSettings/accountSettingsService.ts` — same shape as `services/claimIntakeMaster/claimIntakeService.ts`.
  - `gql` mutation constants.
  - `getApolloClient().mutate()`.
  - Wrapped in try/catch that calls `logError(err, 'accountSettingsService.<fn>')`.
  - Returns a safe `{success: false, message: '...'}` fallback — doesn't throw into the component.

## 4. Frontend — components

### 4.1 `SidebarUserFooter.tsx`

- Single shared component rendering the avatar/name/email block plus the account-menu dropdown.
- Used identically by `Sidebar.tsx`, `ActiveVendorShell.tsx`, and `VendorPortalShell.tsx`.
  - Previously each had its own near-duplicate footer + a bare Logout button.

```ts
interface SidebarUserFooterProps {
  displayName: string;   // caller resolves its own existing fallback chain
  email?: string;
  isCollapsed?: boolean; // default false
  onLogout: () => void;  // caller's existing handler, incl. Sidebar's window.confirm
}
```

- `displayName` and `onLogout` kept as props, not computed inside.
  - Reason: each of the three call sites keeps its own fallback chain and Sign-Out behavior untouched.
  - Only markup and the new dropdown are shared.

- Click-outside-closes-menu uses the same `ref` + `document.addEventListener('mousedown', ...)` pattern as `components/dashboard/MultiSelect.tsx`.

- **Focus-restore fix.**
  - Kebab trigger button captured via `kebabRef` and passed to `AccountSettingsModal` as `returnFocusRef`, rather than letting the modal snapshot `document.activeElement` on open.
  - Root cause: `openSettings()` calls `setMenuOpen(false)` and `setSettingsOpen(true)` in the same handler.
    - React unmounts the "Account Settings" menu item (the actually-focused element) in the same commit that mounts the modal.
    - Browser moves focus to `<body>` during that DOM removal.
    - Happens before any `useEffect` in the newly-mounted modal can run and observe what was focused.
  - Explicit ref to the persistent kebab button sidesteps the race.
  - Verified via Playwright across all three close paths (Escape, ✕ button, click-outside-overlay) and both entry methods (mouse click, keyboard Enter/Tab).
    - `document.activeElement` correctly reports the kebab button (`aria-label="Account menu"`) after each.

### 4.2 `AccountSettingsModal.tsx`

```ts
interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement>; // preferred focus-restore target
}
```

- Chrome: existing `.modal-overlay` → `.modal` → `.modal__header/__body/__footer` pattern, from `components/claimIntakeMaster/UploadClaimModal.tsx`.
  - Escape-key listener, click-outside-overlay close.
- Every time `isOpen` becomes `true`:
  - Resets to the Profile tab.
  - Re-derives `previouslyFocused` (activeElement fallback, used if `returnFocusRef` isn't supplied).
- Renders the user-info header:
  - Avatar initials via a local `getInitials()`.
  - Name = `user?.roleName ?? user?.username`.
  - Email shown if present.
- Renders a `role="tablist"` tab switcher, then `ProfileTab` or `ChangePasswordTab` depending on the active tab.
- No role branching anywhere in this file.
  - Every difference between roles comes from `user` data alone.
  - E.g. `ProfileTab` only renders the Organization row when `user?.companyName` is set.

### 4.3 `ProfileTab.tsx` / `ChangePasswordTab.tsx` / `PasswordInput.tsx`

- `ProfileTab`
  - Local `username` state seeded from `user?.username`.
  - Save disabled while unchanged, empty, or under 3 characters (`isUnchanged` check).
  - On success: calls `updateUser({ username: result.username ?? trimmedUsername })`, shows `.alert.alert--success`, auto-closes via `setTimeout(onClose, 1400)`.
  - Read-only fields (`Email`, `Role`, conditionally `Organization`) render as `.form-static` divs, not disabled inputs.
- `ChangePasswordTab`
  - Local `validatePasswordPolicy()` mirrors the backend's function exactly (comment flags to keep them in sync).
  - Per-field error state.
  - On a wrong-current-password response, clears and refocuses that field specifically.
  - Does **not** call `updateUser` or touch the session token.
    - Reason: a password change has no effect on `AuthUser` shape.
    - Doesn't require re-login on the current session.
- `PasswordInput`
  - `forwardRef` component wrapping a `type="password"`/`"text"` input with an eye-icon toggle button (`.password-input__toggle`).
  - Adapted from the inline-styled original in `pages/VendorSignup/index.tsx` into a class-based component per the no-inline-styles convention.

## 5. Backend/frontend contract summary

| Mutation | Auth | Success payload | Failure examples |
|---|---|---|---|
| `updateProfile(token, username)` | JWT (own `loginId`) | `{success, message, username}` | empty/short/unchanged/taken username |
| `changePassword(token, currentPassword, newPassword)` | JWT (own `loginId`) | `{success, message}` | wrong current password, weak new password, new === current |

## 6. Verification performed

- `tsc --noEmit` clean (both `apps/api` and `apps/frontEnd`) after every change in this feature.
- `vitest run` — 446/448 passing.
  - The 2 failures are the pre-existing, flaky `claimIntakeMaster.test.tsx` suite, unrelated to this feature.
- **Root cause found and fixed during verification:**
  - API dev server (plain `ts-node server.ts`, no file-watch/auto-reload) still running pre-change schema.
  - `updateProfile`/`changePassword` initially failed with a generic error — not a code defect.
  - Restarting the dev process resolved it.
  - Confirmed via direct GraphQL calls against the running server.
- **Admin role** — end-to-end via Playwright against the running app (API + Mongo, not mocked):
  - Dropdown opens/closes correctly (including outside-click).
  - Modal opens with focus on Username.
  - Organization is correctly absent (no `companyName`).
  - Username change succeeds, shows no error, auto-closes, and persists in `localStorage['ct_auth_user']` across a full page reload.
    - Confirmed by reopening the modal post-reload and reading the field back.
  - Change Password correctly rejects a wrong current password (`"Current password is incorrect."`) and a mismatched confirmation (`"Passwords do not match."`).
  - Zero browser console errors throughout.
- **Vendor User role** — via both direct GraphQL calls and a Playwright session seeded with a real login (same fields `AuthContext.login()` stores, worked around the Login page's pre-existing, unrelated lack of a manual password input):
  - `updateProfile` and `changePassword` both succeed against a live Vendor User account.
  - Full password-change cycle proven end-to-end at the GraphQL layer — old password login fails after the change, new password login succeeds.
  - In the UI: Organization correctly shows the account's company name, Role shows "Vendor User".
  - Sign Out fires with **no** confirmation dialog (matching the vendor shells' unchanged behavior).
  - Visually and structurally identical to the Admin case — confirms no role-specific branching leaked into the shared components.
- **Responsive** — at an 820×1024 (tablet) viewport:
  - Modal stays within the viewport bounds with no horizontal overflow.
  - Both tabs render correctly.
- **Keyboard-only navigation:**
  - Tab to the kebab button → Enter opens the menu → Tab reaches "Account Settings" → Enter opens the modal with focus on Username → Escape closes it and returns focus to the kebab button.
  - Verified for all three close paths (Escape, ✕, outside-click) and both entry methods (mouse, keyboard).

## 7. Explicitly not touched

- `server.ts`
- Routing
- `useMenu`/nav-item rendering
- `login`/`logout`/`loginAsServiceProvider` methods
- JWT signing/verification config
- `ProtectedRoute.tsx`
- `main.css`
