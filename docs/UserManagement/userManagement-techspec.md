# User Management (Claims Supervisor only) – Technical Specification

## 1. Files

```
sourceCode/apps/api/graphQL/loginEntity.ts             — schema fields + query/mutations (extends existing file)
sourceCode/apps/api/scripts/migrateDemoUsersToTable.ts — ADJUSTER_MENU_IDS exported + require.main guard (extends existing file)
sourceCode/apps/api/scripts/seedUserManagementDemoData.ts — new seed script

sourceCode/apps/frontEnd/src/
├── utils/passwordPolicy.ts                   — new: shared client-side policy (extracted from ChangePasswordTab.tsx)
├── utils/permissions.ts                      — new: adjuster-type role list + Edit Access default-resolution helpers
├── utils/authorityLevel.ts                   — new (§8b): pure Authority Level calculation from the 2 override toggles
├── models/userManagement/userManagementModel.ts
├── services/userManagement/userManagementService.ts
├── hooks/userManagement/useAdjusterUsers.ts
├── components/userManagement/
│   ├── UserManagementModal.tsx
│   ├── UserRowActionsMenu.tsx
│   ├── EditUserModal.tsx
│   ├── ResetPasswordModal.tsx
│   ├── EditAccessModal.tsx                   — new (§7)
│   ├── PermissionToggle.tsx                  — new (§7)
│   └── DeleteUserConfirmModal.tsx
├── context/AuthContext.tsx                   — extended (§7) to load Edit Access permissions at login
└── components/layout/SidebarUserFooter.tsx   — conditional 3rd menu item (extends existing file)
```

- `skin/css/custom.css` gained:
  - `.modal--wide`
  - `.um-row-menu__*`
  - `.um-grid-wrap`
  - (§7) `.perm-toggle-row`/`.perm-toggle`/`.perm-toggle__track`
  - (§4.3, 2026-07-21 redesign) `.um-panel__*`
  - `main.css` was not touched

**Post-launch UI refinements** (small follow-up requests, kept here rather than as separate doc churn):
- Sidebar's account-menu trigger and the row action-menu trigger both changed from a three-dot kebab icon to:
  - Sidebar trigger: gear/settings icon (same icon already used for the "Account Settings" menu item)
  - Row action-menu trigger: pencil/edit icon (matching `VendorMaster`'s existing Edit icon)
  - Purely cosmetic, no behavior change
- Grid's search box was removed
  - No replacement — the grid is small enough not to need one
- Grid switched from a fixed 480px height to `domLayout="autoHeight"` via a new `.um-grid-wrap` class
  - `.ag-grid-in-card` class deliberately left untouched
    - Other full-page grids rely on its fixed height
  - Modal now sizes to its actual row count
    - No empty space left below a short list
- Grid is also filtered, display-only, excluding the plain "Claims Adjuster" role — only Senior/Junior Adjuster accounts shown
  - `listAdjusterUsers` itself and its authorization/data-loading logic are unchanged
  - Filter is applied in `UserManagementModal.tsx` at render time

**Post-launch simplification (2026-07-21):**
- Grid was cut down to two columns, **User Name** and **Access**
  - Access column renders a short chip per granted permission via a local `AccessCellRenderer`, e.g. "Rating", "Override Service"
- Removed from this screen:
  - Email/Level/Status columns
  - Pencil-triggered `UserRowActionsMenu` dropdown
  - Its "Edit User"/"Change Password"/"Delete User" items
  - `UserManagementModal.tsx` no longer imports `UserRowActionsMenu.tsx`, `ResetPasswordModal.tsx`, or `DeleteUserConfirmModal.tsx`
  - Component files and their backing mutations (§2.4) left in place, unwired
    - Restoring them later needs no backend work
- **Clicking anywhere on a row now opens Edit Access directly** via `AgGridReact`'s `onRowClicked`
  - Replaces the old `onEditAccess` menu-item callback
- Previously-removed search box (above) was reintroduced as a `.cim-search-bar` textbox ("Search User") in the top-right of the modal body
  - Filters `rowData` by `fullName` client-side
  - Same pattern as `VendorSearch/index.tsx`
- None of this touched `listAdjusterUsers`, `EditAccessModal.tsx`, `PermissionToggle.tsx`, or any backend resolver

**Post-launch redesign (2026-07-21, mockup-driven):**
- `UserManagementModal.tsx` was rewritten from an AG Grid + popup-modal pattern to a dark-themed split-panel layout (`.um-panel`), matching a supplied UI mockup
  - AG Grid dropped from this screen
  - Left side: plain scrollable list of clickable name rows (`.um-panel__row`), active row highlighted via `.um-panel__row--active` using `--color-primary`
  - Right side (`.um-panel__access`): renders the 4 `PermissionToggle` rows **inline** for whichever user is selected, reseeded via a `useEffect` keyed on `selectedUser?.loginId`
- `EditAccessModal.tsx` is no longer imported or rendered anywhere
  - Left in the tree unused, following this codebase's established pattern (see `UserRowActionsMenu.tsx`/`ResetPasswordModal.tsx`/`DeleteUserConfirmModal.tsx` in §4.4/§4.5) of not deleting orphaned now-unwired files
  - Restoring the popup flow later needs no rebuild
- `PermissionToggle.tsx` was **not** modified
  - Dark-panel text-color overrides (`.um-panel__access .perm-toggle-row__label { color: #fff; }`, etc.) are scoped via the parent `.um-panel__access` selector in `custom.css`
  - Keeps `PermissionToggle` visually neutral/reusable on both light and dark backgrounds
- Mockup shows only 3 toggles
  - All 4 existing permissions kept, including "View Reserve / Financial Exposure"
  - Dropping the 4th would silently remove working functionality — not requested for removal by the FRD
  - Mockup treated as a layout/interaction reference, not a literal enumeration of permissions to keep
- Search behavior (`searchQuery` filters `filteredUsers` for the left list) is unchanged from the prior grid's search box, just restyled
  - The *selection* (`selectedLoginId`) is derived from the full `users` array, not the filtered one
  - Narrowing the search never clears or changes the right-panel's current user

## 2. Backend — `graphQL/loginEntity.ts`

### 2.1 Schema

- `ILoginUser`/`LoginUserSchema` gained three additive fields
  - Mongoose applies `default:` when hydrating existing documents that lack a field
  - No migration was needed for pre-existing accounts

```ts
fullName: { type: String,  default: '' },
status:   { type: String,  default: 'Active' },   // 'Active' | 'Inactive'
isActive: { type: Boolean, default: true },        // kept in sync with status
```

- `LoginRoleModel`/`LoginUserAccessModel` are unchanged
  - Role assignment already lives in `LoginUserAccessModel.roleId` (one row per granted `menuId`; all of a user's rows share a single `roleId`)

### 2.2 Authorization helpers

- Called at the top of every new resolver
  - Defense-in-depth — this is the first feature where one user's action mutates another user's records

```ts
const ADJUSTER_ROLE_NAMES = ['Claims Adjuster', 'Senior Adjuster', 'Junior Adjuster'];
const ASSIGNABLE_ADJUSTER_ROLES = ['Senior Adjuster', 'Junior Adjuster'];

async function requireSupervisor(token): payload | null   // jwt.verify + roleName === 'Claims Supervisor'
async function getCurrentRoleName(loginId): string | null // reads any one login_user_access row's roleId -> LoginRoleModel.roleName
```

### 2.3 Schema (GraphQL)

```graphql
type AdjusterUser { loginId, fullName, username, email, roleId, roleName, status, isActive, createdTime }
type AdjusterUserListResponse { success, message, users: [AdjusterUser!]!, count }
type AdminUserMutationResponse { success, message, user: AdjusterUser }
type AdminPasswordResetResponse { success, message }
type AdminDeleteUserResponse { success, message }

extend type Query {
  listAdjusterUsers(token: String!): AdjusterUserListResponse!
}
extend type Mutation {
  adminUpdateUser(token, loginId, fullName, username, roleName, status): AdminUserMutationResponse!
  adminResetPassword(token, loginId, newPassword): AdminPasswordResetResponse!
  adminDeleteUser(token, loginId): AdminDeleteUserResponse!
}
```

- Follows this file's house style
  - Business-logic failures return `{success:false, message}` rather than throwing a GraphQL error

### 2.4 Resolvers

- **`listAdjusterUsers`**
  - `requireSupervisor` guard
  - Finds the 3 adjuster roles → their `login_user_access` rows (deduped to one `loginId → roleId`) → matching `LoginUserModel` docs → mapped to `AdjusterUser`
- **`adminUpdateUser`**
  - `requireSupervisor` guard
  - `getCurrentRoleName` must be adjuster-type
    - Blocks targeting Admin/Vendor/other Supervisor accounts
    - Transitively blocks self-targeting — a Supervisor's own role isn't adjuster-type
  - `roleName` arg must be Senior/Junior Adjuster
  - Validates fullName/username(≥3 chars)/status
  - Username-uniqueness check excluding self
  - Updates `LoginUserModel`
  - If the target role differs from the current one, `LoginUserAccessModel.updateMany({loginId}, {roleId: new})`
    - `menuIds` untouched — all three adjuster roles grant the identical set
- **`adminResetPassword`**
  - `requireSupervisor` + adjuster-type guard
  - `validatePasswordPolicy`
  - `bcrypt.hash` + save
  - No current-password check (admin-initiated reset, distinct from the self-service `changePassword` mutation added by the Account Settings feature)
- **`adminDeleteUser`**
  - `requireSupervisor` + adjuster-type guard
  - `LoginUserModel.deleteOne` + `LoginUserAccessModel.deleteMany`

- All four wrapped in try/catch → `logError` + generic failure message

## 3. Seed script — `scripts/seedUserManagementDemoData.ts`

- Standalone, idempotent (upsert-if-missing, never overwrites)
  - Follows the same shape as `seedLoginData.ts`/`migrateDemoUsersToTable.ts`
- Imports `ADJUSTER_MENU_IDS` from `migrateDemoUsersToTable.ts` (exported for this purpose) rather than re-declaring the menu grant
  - Single source of truth
- Creates:
  - The 2 roles
  - 4 users (bcrypt-hashed default password `adjuster@123`, consistent with the existing `admin@123`/`client@123` convention)
  - Their `login_user_access` grants
- Deliberately does **not** touch `demo_users`/`seedLoginData.ts`
  - That collection is specifically for the Login page's Quick Login buttons (still exactly 3: Admin/Claims Adjuster/Claims Supervisor)
  - A separate concern

**Bug found and fixed during implementation:**
- `migrateDemoUsersToTable.ts` had a top-level `migrate().catch(...)` call that executed as an import side effect
  - `import { ADJUSTER_MENU_IDS } from './migrateDemoUsersToTable'` triggered that entire script to run concurrently with the new seed script
  - Its `mongoose.disconnect()` call killed the shared connection mid-run, crashing the new script
- Fixed by guarding the self-invocation with `if (require.main === module) { migrate().catch(...) }`
  - Direct invocation (`ts-node scripts/migrateDemoUsersToTable.ts`) is unaffected
  - Importing it as a module no longer runs it
  - Verified both behaviors

- Invocation: `cd sourceCode/apps/api && npx ts-node scripts/seedUserManagementDemoData.ts`

## 4. Frontend

### 4.1 `utils/passwordPolicy.ts`

- Extracted from a duplicated copy inside `ChangePasswordTab.tsx` (had a "keep in sync with the backend" comment)
  - New `ResetPasswordModal.tsx` reuses one shared copy instead of adding a third duplicate
- `ChangePasswordTab.tsx` now imports from here
- Covered by a small Vitest suite (`utils/__tests__/passwordPolicy.test.ts`) — now has two call sites

### 4.2 Service/model/hook layer

- `services/userManagement/userManagementService.ts` follows the shape of `accountSettingsService.ts`
  - `gql` operations, try/catch + `logError`, safe fallback return values
- `hooks/userManagement/useAdjusterUsers.ts` mirrors `hooks/vendor/useVendor.ts` (`{users, loading, error, refresh}`)
  - Sources the JWT from `useAuth()`
  - Only fetches when the modal `isOpen` (passed in as an `enabled` flag)

### 4.3 `UserManagementModal.tsx` (current: dark split-panel, §1)

- Retains overlay/focus-management conventions
  - `role="dialog"`, Escape-to-close, click-outside-overlay-to-close, `returnFocusRef` handling
  - Exact focus-restore-race fix built for Account Settings — opener is the same shared kebab dropdown
- Inner chrome is now `.um-panel` instead of `.modal`/`.modal--wide`
  - Fixed-max-width (760px) dark card (`background: var(--color-sidebar-bg-dark)`) rather than the app's default white modal
  - Mockup called for a dark theme specific to this one screen
- Header: "Adjustors" title, `.um-panel__search` input (`Search:` placeholder), circular white `.um-panel__close` (X) button
- Body is a flex row:
  - `.um-panel__list` (left, `role="listbox"`, one `role="option"` button per filtered user)
  - `.um-panel__access` (right, renders `PermissionToggle` × 4 + a single `Save` button for `selectedUser`)
- `notification`/`saveError` local state follow the same alert-banner convention as every other screen (no toast library)
- Status/Email/Level columns and the AG Grid dependency were dropped from this component
  - `listAdjusterUsers`'s response shape is unchanged, those fields are no longer rendered here (§3 of the FRD)

### 4.4 `UserRowActionsMenu.tsx`

- FRD calls for a three-dot (⋮) per-row menu "maintaining the existing contextual popup styling"
  - Only existing kebab/popup precedent in this codebase: `SidebarUserFooter.tsx`'s `.sidebar-user__menu` — footer-scoped, `position:absolute`
- That positioning technique can't be reused verbatim inside an AG Grid cell
  - AG Grid clips row-cell overflow for row virtualization
  - A `position:absolute` dropdown would be clipped/mispositioned as soon as the grid scrolls
- Reuses an existing pattern: `pages/Vendor/VendorSearch/index.tsx`'s `CategoryCellRenderer` "+N" tray
  - Solves the identical problem via `createPortal(..., document.body)` + `getBoundingClientRect()`-computed fixed positioning
- `UserRowActionsMenu` is click-triggered (the VendorSearch tray is hover-triggered)
  - `mousedown`-outside-close listener (same pattern as `SidebarUserFooter`'s `menuRef` listener)
  - Plus `scroll`/`resize` listeners that close the menu
    - Prevents a stale-positioned floating panel persisting while the grid scrolls
- Panel classes (`.um-row-menu__panel`/`.um-row-menu__item`/`--danger`) visually match `.sidebar-user__menu-item` (padding/hover/font) without its `position:absolute` rule
  - Positioning here is JS-computed

### 4.5 `EditUserModal.tsx` / `ResetPasswordModal.tsx` / `DeleteUserConfirmModal.tsx`

- `EditUserModal` — standard 480px `.modal`
  - Editable Full Name/Username (`.form-input`), Role/Status (`.form-select`, same class already used in `pages/Admin/KpiMetrics/index.tsx`)
  - Read-only Email/User ID/Created Date as `.form-static` divs — the same class `ProfileTab.tsx` already established for its own read-only fields
- `ResetPasswordModal` — reuses `components/accountSettings/PasswordInput.tsx` directly, unmodified
  - New Password / Confirm New Password, no current-password field — this is an admin-initiated reset
  - Validates via the shared `utils/passwordPolicy.ts`
- `DeleteUserConfirmModal` — copies `ServiceRequestRoleMaster`'s inline delete-confirmation structure
  - `.modal-overlay`/`.modal`/`btn--ghost` Cancel / `btn--danger` Delete with spinner + "Deleting…"
  - Uses the FRD's exact copy

### 4.6 `SidebarUserFooter.tsx`

- Added `const { user } = useAuth()`
  - New — component previously only took `displayName`/`email` as props
    - Gating needs `roleName`, only available via `AuthContext`
- Added `isSupervisor = user?.roleName === 'Claims Supervisor'`
- Third menu item renders conditionally between Account Settings and Sign Out
- `<UserManagementModal>` is also gated behind `isSupervisor`
  - Defense-in-depth on the frontend, mirroring the backend's independent check
  - Reuses the same `kebabRef` as `<AccountSettingsModal>` for focus restoration
- `ActiveVendorShell.tsx`/`VendorPortalShell.tsx` needed **no** changes
  - `useAuth()` runs inside the shared component
  - Vendor users can never satisfy the Supervisor check

## 5. Verification performed

- `tsc --noEmit` clean in both `apps/api` and `apps/frontEnd`
- `vitest run` — 450/452 passing
  - The 2 failures are the pre-existing, already-flaky `claimIntakeMaster.test.tsx` suite, unrelated to this feature
  - +4 new tests for `utils/passwordPolicy.ts`
- Seed script run twice
  - Second run created zero duplicate documents
  - Confirmed via console output: `Role exists`/`User exists`/`Access already granted` for every record on the second pass
- Direct GraphQL verification (curl) of every new query/mutation:
  - `listAdjusterUsers` returns the correct 5 seeded/existing adjuster-type accounts for a Supervisor
  - `listAdjusterUsers` returns `{success:false, message:'Unauthorized.'}` for a plain Claims Adjuster's own token
  - `adminUpdateUser` promotes/demotes a user's role and other fields correctly (round-tripped and reverted)
  - `adminResetPassword` rejects a weak password inline
  - `adminResetPassword` on a valid password: **old** password subsequently fails login, **new** one succeeds (full end-to-end proof, not just a success response)
  - `adminDeleteUser` removes both `login_user` and `login_user_access` records
    - Confirmed via a follow-up `listAdjusterUsers` count drop and a failed login attempt
    - Record was cleanly restored via a re-run of the idempotent seed script
  - Security boundary checks:
    - `adminDeleteUser`/`adminUpdateUser` called with a plain Claims Adjuster's own token both return `Unauthorized.` with no DB change
    - A **valid** Supervisor token targeting the Admin account's `loginId` is rejected with "Target user is not an adjuster-type account." for both `adminUpdateUser` and `adminDeleteUser`, with no DB change
- Playwright-driven walkthrough against the live running app (API + Mongo, not mocked):
  - Confirmed the 3rd menu item appears only for Claims Supervisor (absent for both Claims Adjuster and Admin, other two items unchanged)
  - Opened User Management, grid showed exactly 5 users, header count matched row count
  - Edit User round-trip: change Full Name → success banner → grid reflects the change → reverted
  - Change Password: weak password rejected inline with the exact policy message, valid password accepted, success banner shown
  - Delete User: confirmation copy verified, confirm → row disappears from grid, success banner shown
    - Deleted account restored afterward via the idempotent seed script
  - Zero browser console errors throughout

## 7. Edit Access Permissions (4th row action)

### 7.1 Backend schema

- `ILoginUser`/`LoginUserSchema` gained an optional `permissions` sub-document
  - Deliberately **no schema-level default**
  - Stays `undefined` on every existing document until a Supervisor's first Edit Access save

```ts
interface IUserPermissions {
  canAccessServiceProviderRating?: boolean;
  canOverrideService?:             boolean;
  canOverrideProvider?:            boolean;
  canViewReserveExposure?:         boolean;
}
// LoginUserSchema: permissions: { type: UserPermissionsSchema }   — no default
```

- `login_user_access` is unchanged
  - It's a menu-grant join table, the wrong shape for 4 unrelated per-user booleans

### 7.2 GraphQL

```graphql
type UserPermissions { canAccessServiceProviderRating: Boolean, canOverrideService: Boolean, canOverrideProvider: Boolean, canViewReserveExposure: Boolean }
input UserPermissionsInput { canAccessServiceProviderRating: Boolean!, canOverrideService: Boolean!, canOverrideProvider: Boolean!, canViewReserveExposure: Boolean! }
type UpdateUserAccessResponse { success: Boolean!, message: String!, permissions: UserPermissions }
# AdjusterUser gained: permissions: UserPermissions

extend type Query { getUserPermissions(token: String!): UserPermissions }
extend type Mutation { updateUserAccess(token: String!, loginId: String!, permissions: UserPermissionsInput!): UpdateUserAccessResponse! }
```

- **`getUserPermissions`**
  - Self-service — no Supervisor check, any user reads only their own record via their own token
  - Returns `user.permissions ?? null` — `null` means "never configured," never a fabricated default
- **`updateUserAccess`**
  - Reuses `requireSupervisor`/`getCurrentRoleName`/`ADJUSTER_ROLE_NAMES` exactly like `adminUpdateUser`/`adminResetPassword`/`adminDeleteUser`
  - Writes all 4 fields at once (the modal is a fully-controlled 4-toggle form)
  - After any save the sub-document is always fully populated
- **`listAdjusterUsers`** gained one field in its existing map: `permissions: u.permissions ?? null`

### 7.3 Default-value semantics (the crux of this feature)

- Mongoose schema defaults can't be role-conditional
  - All default resolution happens in the frontend (`src/utils/permissions.ts`)
  - Designed to reproduce **today's exact pre-feature behavior** for anyone never touched via Edit Access

```ts
export const ADJUSTER_ROLE_NAMES = ['Claims Adjuster', 'Senior Adjuster', 'Junior Adjuster'] as const;
export function resolveHideVendorRating(roleName, permissions): boolean {
  return isAdjusterTypeRole(roleName) && !(permissions?.canAccessServiceProviderRating ?? false);
}
export function resolveCanOverrideService(permissions): boolean  { return permissions?.canOverrideService  ?? true; }
export function resolveCanOverrideProvider(permissions): boolean { return permissions?.canOverrideProvider ?? true; }
```

- **Rating**: before this feature, `claimIntakeDetails/index.tsx` hid rating data via a hardcoded `user?.roleName === 'Claims Adjuster'` check
  - New default (`isAdjusterTypeRole && !canAccessServiceProviderRating`) reproduces this exactly, generalized to all 3 adjuster-type roles
  - Hidden by default for adjuster-type users, always visible for everyone else, regardless of whether `permissions` is present
- **Override Service / Override Provider**: before this feature, both were **unrestricted for every user** (no gating existed)
  - Default (`?? true`) reproduces this
  - Every user stays able to override until a Supervisor explicitly disables it for them
- **Reserve/Financial Exposure**: UI-only
  - No file outside `EditAccessModal.tsx`/the GraphQL layer reads this field

### 7.4 `AuthContext.tsx`

- `AuthUser` gained `permissions?: UserPermissions`
- New `GET_USER_PERMISSIONS` query fires inside `login()`, right after the existing vendor-profile fetch
  - **Conditioned on adjuster-type role** (`ADJUSTER_ROLE_NAMES.includes(data.roleName)`) rather than unconditionally
  - Avoids a wasted round trip on every Admin/Supervisor/Vendor login — only adjuster-type accounts can have permissions configured today
- Wrapped in try/catch so a lookup failure never blocks login
- Persists to `localStorage['ct_auth_user']` — just another field on the already-persisted `authUser` object (same mechanism as `vendorId`)
- `login` mutation string, JWT signing, `logout`, `updateUser`, and `loginAsServiceProvider` are all unchanged

**Accepted limitation, matching existing precedent**:
- Permissions load once at login, same as `menuIds`/`roleId`
- A user sees a Supervisor's change at their *next* login, not live within an already-open session

### 7.5 `PermissionToggle.tsx` + `EditAccessModal.tsx`

- `PermissionToggle` is this app's first `role="switch"` element
  - A real `<button role="switch" aria-checked>`
  - The only prior toggle, `.cid-vendor-toggle` in `claimIntakeDetails`, is a non-interactive div-with-onClick wrapper, not reusable/accessible
- New CSS (`.perm-toggle-row`, `.perm-toggle`, `.perm-toggle__track`) is a pill switch themed to `--color-primary`, with a label + description line per row

- `EditAccessModal.tsx` follows `EditUserModal.tsx`'s chrome (480px `.modal`, Escape/click-outside close) and `ResetPasswordModal.tsx`'s dynamic-title pattern (`Edit Access — {user.fullName}`)
- Local toggle state seeds from `user.permissions?.<field> ?? <adjuster-type default>`
  - Modal only opens for adjuster-type rows — adjuster-type defaults apply
- Save calls `updateUserAccess`
  - Success shows `.alert.alert--success` (no toast library anywhere in this app)
  - Hands control back to `UserManagementModal.tsx`
    - Closes the modal
    - `refresh()`s the grid (keeps cached `permissions` fresh for next open)
    - Shows its own success banner
  - Identical flow to the other 3 sub-modals

- `UserRowActionsMenu.tsx` gained an `onEditAccess` prop
- Gained an "Edit Access" menu item between "Change Password" and "Delete User" (danger item stays last)

### 7.6 `claimIntakeDetails/index.tsx` — exact, minimal edits

- Three changes, all additive/narrowing
  - No existing conditional's *positive* case was broadened, only restricted by ANDing in a permission
- **Rating derivation** (was a single hardcoded line): now delegates to `resolveHideVendorRating`/`resolveCanOverrideService`/`resolveCanOverrideProvider`
  - None of the ~5 existing `{!hideVendorRating && ...}` call sites (the FitIQ% suffix, trigger chip, per-item chip, breakdown eye-icon button) were touched — only the derivation
- **Override Service** — the role-header row's `onClick` gained `&& canOverrideService`, and its padlock-icon condition gained `|| !canOverrideService`
  - Reuses the file's own existing "locked" padlock pattern (already used for `isConfirmedLocked`/`vendorsForRole`) rather than inventing a new disabled visual
- **Override Provider** — the vendor-picker dropdown's render condition gained `&& canOverrideProvider`
  - When false, the dropdown doesn't render
  - Recommended/confirmed vendor name (always renders above it regardless) becomes the only thing shown — exactly the required non-interactive fallback, no new markup needed

- `VendorSwitchModal`, `ReasonModal`, `handleRoleToggle`, and `handleVendorDropdownChange` internals are all unchanged
  - Only their *reachability* is gated

## 8. Verification performed (Edit Access)

- `tsc --noEmit` clean in both apps
- `vitest run` unaffected (450/452, same 2 pre-existing unrelated failures)
- Direct-GraphQL security checks:
  - `updateUserAccess` with a plain adjuster's own token → `Unauthorized.`
  - With a valid Supervisor token targeting the Supervisor's own (non-adjuster-type) `loginId` → `Target user is not an adjuster-type account.`
  - `getUserPermissions` for a never-configured user → `null` (not a fabricated default)
- Direct-GraphQL success path:
  - `updateUserAccess` persists all 4 fields
  - `getUserPermissions` and `listAdjusterUsers` both immediately reflect the saved values
  - The 4 other seeded users remain `null` — no cross-user leakage at the data layer
- Playwright, live app:
  - "Edit Access" appears as the 3rd row-menu item with the correct dynamic title and correct default toggle states (rating OFF, both overrides ON, reserve ON) for a never-configured user
  - After toggling rating ON and Override Service OFF for James Okoro and saving:
    - Logging in as James and opening a claim's full details screen showed FitIQ percentages (rating gating confirmed working)
    - Every one of 14 service rows showed a padlock icon with zero interactive toggles (Override Service gating confirmed working)
  - Logging in as Derek Chan (never configured) on the *same* claim:
    - Showed 0 FitIQ occurrences (rating still hidden, matching pre-feature behavior exactly)
    - Showed only 2 padlocks (pre-existing already-confirmed locks unrelated to the new permission, not 14)
    - Proves the gating is per-user and that an untouched user's experience is byte-for-byte unchanged from before this feature existed
  - Zero browser console errors throughout

## 8b. Authority Level (RBAC) — frontend-only, derived value

- Implements FRD §5b
- No MongoDB schema, GraphQL, or resolver changes
  - Value is calculated purely from the two `canOverrideProvider`/`canOverrideService` toggle states already loaded into `UserManagementModal.tsx`'s local state (§4.3)
  - Needed nothing new from the backend to stay in sync

**`utils/authorityLevel.ts`** (new) — one pure function, no side effects:

```ts
export type AuthorityLevel =
  | 'Adjuster – Review Required'
  | 'Adjuster – Limited Authority'
  | 'Adjuster – Independent Authority';

export function calculateAuthorityLevel(
  canOverrideProvider: boolean,
  canOverrideService: boolean,
): AuthorityLevel {
  if (canOverrideProvider && canOverrideService) return 'Adjuster – Independent Authority';
  if (!canOverrideProvider && !canOverrideService) return 'Adjuster – Review Required';
  return 'Adjuster – Limited Authority';
}
```

- Covered by `utils/__tests__/authorityLevel.test.ts` (all 4 truth-table combinations of the two controlling booleans)

- **`UserManagementModal.tsx`** — `authorityLevel` and a CSS-variant string (`authorityVariant`: `'review' | 'limited' | 'independent'`) are computed inline on every render from `canOverrideProvider`/`canOverrideService` state
  - No `useEffect`/extra state, so edits to either toggle re-render the value immediately, before Save
  - Rendered as a single-line bar (`.um-panel__authority`) at the top of `.um-panel__access`, above the save-error banner and the Access Permissions toggles
    - Uppercase gray label (`.um-panel__authority-label`, same look as `.um-panel__access-section-label`) on the left
    - Calculated level as a colored status pill (`.um-panel__authority-value--{variant}`, sized/shaped like this app's other status badges, e.g. `.cim-status-badge`) on the right
  - `canAccessServiceProviderRating`/`canViewReserveExposure` are intentionally excluded from the calculation's inputs, matching FRD §5b

- `skin/css/custom.css` gained `.um-panel__authority`, `.um-panel__authority-label`, and `.um-panel__authority-value`
  - Plus `--review`/`--limited`/`--independent` color variants using the warning/info/success tokens respectively
  - No changes to any existing `.um-panel__*` rule

## 9. Explicitly not touched

- Login flow
- Session management
- JWT signing
- `getMe`/`LoginUser` GQL type
- `updateProfile`/`changePassword` (self-service, from the Account Settings feature)
- Existing Claims Adjuster role's own permission grant
- `ProtectedRoute.tsx`
- Sidebar navigation
- `main.css`
- `ActiveVendorShell.tsx`/`VendorPortalShell.tsx`
- `demo_users`/`seedLoginData.ts`
- `VendorSwitchModal`/`ReasonModal` internals
- `login_user_access`
