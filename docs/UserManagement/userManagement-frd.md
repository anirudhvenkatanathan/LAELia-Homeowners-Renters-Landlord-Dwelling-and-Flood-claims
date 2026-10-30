# User Management (Claims Supervisor only) – Functional Requirements

## 1. Overview

- Self-service adjuster management for Claims Supervisors
  - View, edit, reset password, remove adjuster accounts
- New sub-roles: **Senior Adjuster**, **Junior Adjuster**
  - Same permissions as **Claims Adjuster** — only the displayed name differs

## 2. Entry Point — Account Menu

- Account-menu (kebab/⋮, sidebar footer) gains **User Management**
  - Between Account Settings and Sign Out
  - Claims Supervisor only

```
Account Settings
User Management   ← Claims Supervisor only
Sign Out
```

- Other roles: unchanged 2-item menu

## 3. User Management Screen

- Dark, split-panel dialog (no grid), titled **Adjustors**
  - Live list: Claims / Senior / Junior Adjuster accounts

**Layout:**

- **Left panel** — name list
  - Click: highlights row, loads that user's access toggles into right panel
  - First user selected by default
- **Right panel** — selected user's Edit Access (§5a), inline, not a modal
  - Switching names re-populates instantly; unsaved edits discarded
- **Search** — filters left list live, client-side; never touches the right-panel selection
- **X** — closes dialog
- Email, Level, Status: still returned by `listAdjusterUsers`, just not shown

## 4. Row Actions — Removed

- Old per-row ⋮ menu and the data grid: removed
- Edit Access (§5a): now reached via left-list selection
- Edit User, Change Password, Delete User: unreachable from the UI
  - Mutations (`adminUpdateUser`, `adminResetPassword`, `adminDeleteUser`) still exist server-side (§10)

## 5. Edit User — Currently Unreachable from the UI

*(Kept for reference — mutation still exists server-side; see §4.)*

Previously opened a modal with:

| Field | Editable |
|---|---|
| Full Name | Yes |
| Username | Yes (≥3 characters, unique) |
| Role | Senior/Junior Adjuster only — no "Claims Adjuster" option; leveling is one-way, can't return to plain Claims Adjuster |
| Status | Yes — Active / Inactive |
| Email Address | No (read-only) |
| User ID | No (read-only) |
| Created Date | No (read-only) |

- Buttons: **Cancel** / **Update User**
- Save: updates DB, refreshes grid, success notification
- Leveling doesn't change menu access — only the displayed level

## 5a. Edit Access

- Renders inline in the right panel (§3), not a modal
- 4 permission toggles:

| Permission | Description | Status |
|---|---|---|
| Access Service Provider Rating | See FitIQ %, star ratings, scoring breakdown. Disabled: only "Recommended" badge shows. | Fully functional |
| Override Service | Override the recommendation engine's selected service. | Fully functional |
| Override Provider | Pick a different provider than recommended. | Fully functional |
| View Reserve / Financial Exposure | See indemnity/medical exposure and reserve figures. | UI-only — saved but not yet read by any logic. Future work. |

**Defaults** (untouched users): Rating hidden for adjuster-type roles, visible for others. Override Service/Provider allowed for everyone until a Supervisor disables one.

- Button: **Save**
- Save: validates, persists to MongoDB, refreshes cached permissions, success notification
  - Panel stays open; switching users without saving discards the edit
- Applies to the selected user only
- Takes effect at next login — not pushed live to an active session

## 5b. Authority Level (RBAC)

- Read-only "Authority Level" field above the toggles
  - Colored status pill, same style as other status badges

| Condition (Override Provider / Override Service) | Authority Level shown |
|---|---|
| Both disabled | **Adjuster – Review Required** *(Test env: Junior Adjustor)* |
| Exactly one enabled | **Adjuster – Limited Authority** *(Prod env: Adjustor)* |
| Both enabled | **Adjuster – Independent Authority** *(Prod env: Senior Adjustor)* |

- Fed only by Override Provider / Override Service — Rating and Reserve toggles don't affect it
- Recalculates instantly, no Save needed
- Derived/display-only — not persisted to MongoDB
- Adjuster-type accounts only; Claims Supervisors unaffected

## 6. Change Password — Currently Unreachable from the UI

*(Kept for reference — mutation still exists server-side; see §4.)*

- Modal: **New Password** / **Confirm New Password** only — no "current password" field
- Policy: ≥6 characters, ≥1 number, ≥1 special character
- Must match; hashed, plain text never stored
- Buttons: **Cancel** / **Update Password**

## 7. Delete User — Currently Unreachable from the UI

*(Kept for reference — mutation still exists server-side; see §4.)*

```
Are you sure you want to delete this user?

This action cannot be undone.
```

- Buttons: **Cancel** / **Delete**
- Confirm: removes `login_user` and all `login_user_access` records, refreshes grid

## 8. Role Access — Senior Adjuster / Junior Adjuster

- Identical to Claims Adjuster in menus, permissions, dashboard, routes, APIs — only the displayed name differs
- No new permission set created

## 9. Sample Data

| Name | Username | Email | Role | Status |
|---|---|---|---|---|
| Sarah Mitchell | sarah.mitchell | sarah.mitchell@laelia.com | Senior Adjuster | Active |
| James Okoro | james.okoro | james.okoro@laelia.com | Senior Adjuster | Active |
| Priya Nair | priya.nair | priya.nair@laelia.com | Junior Adjuster | Active |
| Derek Chan | derek.chan | derek.chan@laelia.com | Junior Adjuster | Active |

## 10. Security

- Every action requires Claims Supervisor auth, enforced server-side
- Every action also verifies the target is an adjuster-type role — Admin, Vendor, and other Supervisor accounts are off-limits

## 11. UI/UX

- Existing LAElia design language — no new visual language
- Grid refreshes after every Update, Password Change, or Delete
- Inline-banner success/error notifications (no toast library)
- Responsive at tablet widths

## 12. Explicitly Out of Scope / Preserved Unchanged

- Unmodified: login flow, session management, Claims Adjuster's own permissions, other authorization logic, dashboard, sidebar nav, role mappings
- No "Team" field/column found repo-wide — nothing to remove
