# Universal Account Settings & Password Management – Functional Requirements

## 1. Overview

Every authenticated user — regardless of role (Admin, Claims Supervisor, Claims
Adjuster, Claims Manager, Client Manager, Vendor User, Provider Administrator, or any
future role) — gets a self-service entry point to view/edit their own profile and
change their own password. There is exactly one implementation shared by every role;
no role-specific branching exists anywhere in the feature.

Entry point: the existing bottom-left sidebar profile/settings area (unchanged
placement/styling) now opens a small dropdown instead of triggering Logout directly.

## 2. Entry Point — Account Menu Dropdown

* Trigger: a kebab (⋮) button next to the user's name/avatar in the sidebar footer,
  in the same location the old direct Logout button occupied.
* Opens a 2-item menu, upward (the footer is pinned to the bottom of the viewport):
  * **Account Settings** — opens the Account Settings modal.
  * **Sign Out** — identical behavior to the previous direct Logout button (each
    shell's own existing handler runs unchanged, e.g. the Admin shell's
    `window.confirm` prompt; Vendor shells sign out immediately with no prompt).
* Closes on: clicking outside the menu, or selecting either item.
* Keyboard accessible: the trigger is a real `<button>` (`aria-haspopup="menu"`,
  `aria-expanded`), reachable and operable via Tab/Enter; menu items are
  `role="menuitem"`.

## 3. Account Settings Modal

* Centered modal, title **"Account Settings"**, with a close (✕) button.
* Closes on: the ✕ button, clicking outside the modal, or pressing Escape.
* Focus management: opening the modal moves focus into its first field; closing it
  (by any method) returns focus to the kebab trigger button that opened it.
* **User info header** (top of modal, always visible regardless of tab): avatar
  (initials fallback, e.g. "AD"), display name, email — all sourced from the
  authenticated session, never hardcoded.
* Two tabs: **Profile** and **Change Password**. Switching tabs does not close the
  modal or lose entered data in the tab being left (each tab manages its own local
  form state).

## 4. Profile Tab

Fields shown are limited to what already exists on the user record today — no new
personal-data fields were introduced for this feature:

| Field | Editable | Notes |
|---|---|---|
| Username | Yes | Required, minimum 3 characters, must be unique across all users |
| Email Address | No | Read-only, shown for reference only |
| Role | No | Read-only |
| Organization | No | Read-only. Shown **only** when the account has a company name (Vendor Users) — absent entirely for internal roles (Admin, Claims Adjuster, etc.) |

There is no Full Name or Phone field — neither exists in the current data model, and
adding them was explicitly scoped out (schema changes were declined) in favor of only
exposing fields that already exist.

**Validation:**
* Username required — "Username is required."
* Minimum 3 characters — "Username must be at least 3 characters."
* Must differ from the current value — Save Changes stays disabled until the field is
  actually changed.
* Server also re-validates all of the above, plus uniqueness ("This username is
  already taken.") — client-side checks are a convenience, not the source of truth.

**Actions:**
* **Cancel** — closes the modal without saving.
* **Save Changes** — disabled while unchanged/invalid/in-flight. On success: shows a
  success message, updates the session immediately (sidebar, header, and this same
  modal all reflect the new username without a page reload), and auto-closes after a
  short delay.

## 5. Change Password Tab

| Field | Required | Notes |
|---|---|---|
| Current Password | Yes | Verified against the account's existing password |
| New Password | Yes | Must satisfy the password policy (below) |
| Confirm New Password | Yes | Must exactly match New Password |

**Password policy** (identical on client and server):
* At least 6 characters.
* At least one number.
* At least one special character.
* New password must differ from the current password.

**Behavior:**
* Both password fields have a show/hide toggle; passwords are masked by default and
  never shown in plain text anywhere else in the UI.
* Inline, per-field validation errors (e.g. "Current password is required.",
  "Passwords do not match.").
* Wrong current password → "Current password is incorrect."; the current-password
  field is cleared and refocused so the user can retry without re-typing the new
  password.
* On success: a success message is shown, all three fields clear, and the modal
  auto-closes after a short delay. The user is **not** signed out or required to
  re-authenticate — the change takes effect for future logins (verified: the old
  password stops working and the new one succeeds).
* **Cancel** — closes the modal without changing anything.

## 6. Security

* Email is never editable through this feature.
* Passwords are never displayed in plain text by default (toggle-to-reveal only).
* Changing the password always requires the correct current password.
* All validation is enforced server-side regardless of what the client sends.
* No other user's data is ever exposed — the server identifies "whose profile/password"
  purely from the caller's own session token, never from a client-supplied user id.

## 7. Explicitly Out of Scope

This feature does not modify: the login screen/flow, session/token issuance,
authorization/role-permission logic, the Sign Out action's own per-shell behavior
(confirm dialog or lack thereof), or sidebar navigation/menu structure.

## 8. Expected Result

1. Every authenticated role sees the identical Account Settings experience — same
   fields, same tabs, same validation, same styling — with only data (not UI) varying
   by role (e.g. Organization appears only for accounts that have one).
2. Profile and password changes take effect immediately and persist across reloads
   and future logins.
3. No existing authentication, session, or Sign Out behavior changed for any role.
