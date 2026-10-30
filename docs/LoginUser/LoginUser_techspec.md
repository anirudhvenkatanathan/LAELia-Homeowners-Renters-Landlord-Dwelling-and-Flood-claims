# Login & Role-Based Access Control (RBAC) – Functional Requirements

## 1. Login Screen

Create a Login screen based on the provided design reference screenshot.
Reference : C:\Users\yamuna.m\Downloads\Loginuser.png

### Login Fields

* Email / Username
* Password
* Login Button
* Forgot Password (Optional)

---

## 1.1 Login Screen — Technical Implementation

Reference : C:\Users\yamuna.m\Downloads\login.png

### Files

```
sourceCode/apps/frontEnd/src/pages/Login/
├── index.tsx   — component markup, form state, Quick Login handler, auth call
├── styles.ts   — `loginTheme` teal color tokens (shared with VendorSignup)
└── types.ts    — `QuickLoginOption` interface
```

* No changes to `context/AuthContext.tsx`, GraphQL login mutation, or `apps/api`.
  - Presentation-layer-only change on top of the `login(identifier, password)` flow.

### Styling approach

* All Login page styling lives in `skin/css/custom.css` as `.login-*` classes — the same class-based convention used app-wide. No inline styles, no injected `<style>` tags.
* `styles.ts` exports only `loginTheme`: teal hex tokens (`tealDarkest`, `tealDark`, `teal700/500/400/300`, `accent`, `accentHover`, `accentLight`, `textMuted`, `textMutedLt`, `border`), kept here only because `VendorSignup` also imports them. Values must mirror `custom.css`'s `:root` variables if the palette changes.

### Components

* `LaeliaLogo` (`components/layout/LaeliaLogo.tsx` — shared, not page-local):
  - Renders a single `<img>` of `src/assets/brand/laelia-logo.svg` (solid white artwork) at a given `size` (height in px); width follows the SVG's fixed aspect ratio (`1920 / 539.98`).
  - No card, background, border, or shadow — sits directly on whatever fill is behind it.
  - `variant: 'on-dark' | 'on-light'` kept on the prop signature for call-site compatibility — a no-op.
  - Used on the Login screen, `Sidebar.tsx`, `ActiveVendorShell.tsx`, and `VendorPortalShell.tsx`.

### Quick Login

* Tab strip has no "Quick Login" caption — just the role tabs.

```ts
interface QuickLoginOption {
  key: string;
  label: string;
  email: string;
  password: string;
}
```

* `QUICK_LOGINS: QuickLoginOption[]` in `index.tsx` holds 3 demo roles: Admin, Claims Adjuster, Claims Authority Reviewer.

`handleQuickLogin(option)`:
1. Sets `activeQuickLogin` (drives the active-tab white-pill background via `login-quicklogin-tab--active`).
2. Resets `idMethod` to `'email'`, then calls `setEmailIdentifier(option.email)` / `setPassword(option.password)`.
3. Clears any error.
4. **Does not call `doLogin`** — submission only happens via the form's `onSubmit` (`handleSubmit` → `doLogin`); the user must click **Sign In**.

### Current color tokens (teal)

Defined in `skin/css/custom.css`'s `:root` (brand refresh dated 2026-07-23, replacing the earlier purple theme):

| Token | Hex | Used for |
|---|---|---|
| `--color-primary` | `#0B807B` | buttons, links, active nav, focus rings |
| `--color-primary-hover` | `#0B7A75` | primary hover state |
| `--color-primary-lt` | `#E6F5F4` | light primary tint (focus glow) |
| `--color-sidebar-bg` | `#0E9A94` | sidebar/nav background; Login hero gradient start |
| `--color-sidebar-bg-dark` | `#1F726A` | Quick Login bar; Login hero gradient end; sidebar header/footer strips |
| `--color-coral` | `#E8624A` | Login Sign In button (CTA accent, distinct from primary teal) |
| `--color-coral-hover` | `#D14F38` | Sign In button hover |

* `.login-panel-left`'s background: `linear-gradient(160deg, var(--color-sidebar-bg) 0%, #16867F 55%, var(--color-sidebar-bg-dark) 100%)` — a 3-stop teal gradient, no purple, no texture overlay.

### Screen structure (`.login-*` classes in `skin/css/custom.css`)

* `.login-page` — full-viewport flex column, `background: var(--color-bg)` (`#F7F9F9`); Inter (`var(--font)`) for all text except `.login-hero-heading`, the app's one Noto Serif element.
* `.login-quicklogin-bar` — top strip, `background: var(--color-sidebar-bg-dark)`; unselected tabs are translucent white text, the active tab gets a white pill with `var(--color-primary)` text.
* `.login-hero` — centers `.login-panel` within the remaining viewport height.
* `.login-panel` — the joined two-tone card (rounded corners, `max-width: 860px`, `box-shadow: 0 20px 50px rgba(18,74,68,0.22)`):
  - `.login-panel-left` — teal gradient side; holds the logo, the serif marketing heading, and `.login-hero-bullets` (3 bullet items), white text throughout.
  - `.login-card` — white sign-in side; `.login-card-body` holds the title, `.login-id-tabs-row` (Email/Phone tabs), `.login-input` fields, `.login-remember-row` checkbox, and `.login-submit-btn` (coral).
* `.login-footer-links-row` / `.login-copyright` — legal links and copyright line below the panel, on the light page background.
* Responsive: `.login-panel-left` (`flex: 1 1 400px`) and `.login-card` (`flex: 1 1 380px`) wrap to a single stacked column via `flex-wrap: wrap` on narrow viewports (no separate media query); `.login-quicklogin-bar` scrolls horizontally (`overflow-x: auto`) when tabs don't fit.

---

## 2. Database Table – login_user

Create a collection/table named **login_user** with the following fields:

| Field Name  | Type               |
| ----------- | ------------------ |
| login_Id    | UUID/String        |
| Email       | String             |
| username    | String             |
| Password    | String (Encrypted) |
| CreatedBy   | String             |
| UpdatedBy   | String             |
| CreatedTime | DateTime           |
| UpdatedTime | DateTime           |

### Notes

* Email must be unique.
* Username must be unique.
* Password should be stored in encrypted/hashed format.
* CreatedBy and UpdatedBy should store the Login User ID.

---

## 2.1 Database Table – demo_users

Create a collection/table named **demo_users** holding the source definitions
for the Quick Login demo accounts (mirrors `QUICK_LOGINS` in
`frontEnd/src/pages/Login/index.tsx`), with the following fields:

| Field Name  | Type               |
| ----------- | ------------------ |
| login_Id    | UUID/String        |
| Email       | String             |
| username    | String             |
| Password    | String             |
| Role_Name   | String             |
| Menu_IDs    | [String]           |
| CreatedBy   | String             |
| UpdatedBy   | String             |
| CreatedTime | DateTime           |
| UpdatedTime | DateTime           |

### Notes

* `login_Id`, `Email`, and `username` must each be unique.
* `Menu_IDs` is the list of menu IDs to grant this demo account access to.
* Unlike **login_user**, `Password` here is the plaintext demo credential
  (the value shown to demo users), not a hash — it is hashed only when copied
  into **login_user**.

### Populating demo_users (`apps/api/scripts/migrateDemoUsersToTable.ts`)

A separate, one-time migration script holds the three demo account
definitions (Admin, Claims Adjuster, Claims Supervisor, with their per-role
menu grants) that used to be hardcoded in `seedLoginData.ts`, and upserts
them into **demo_users** by `login_Id` using `$setOnInsert`. This is
idempotent and never overwrites a record that already exists (including one
edited directly in the database after the initial migration). Run this
script once, before running `seedLoginData.ts`, to populate the table.

### Seeding behavior (`apps/api/scripts/seedLoginData.ts`)

The seed script contains no hardcoded user data. `DEMO_USERS` is populated
via a `find()` against **demo_users**. For each user returned, the
script creates the corresponding **login_user** record (hashing the demo
password) if one doesn't already exist, then re-grants that user's
**login_user_access** records for their role's menu set. If **demo_users**
is empty, the script logs a warning and does nothing — run
`migrateDemoUsersToTable.ts` first.

---

## 3. Database Table – login_role

Create a collection/table named **login_role** with the following fields:

| Field Name       | Type        |
| ---------------- | ----------- |
| Role_ID          | UUID/String |
| Role_Name        | String      |
| Role_Description | String      |
| CreatedBy        | String      |
| UpdatedBy        | String      |
| CreatedTime      | DateTime    |
| UpdatedTime      | DateTime    |

### Sample Roles

* Admin
* Claims Manager
* Claims Adjuster
* Vendor Manager
* Vendor User
* Read Only User

---

## 4. Database Table – login_user_access

Create a collection/table named **login_user_access** with the following fields:

| Field Name           | Type                              |
| -------------------- | --------------------------------- |
| Login_user_Access_Id | UUID/String                       |
| Login_Id             | Foreign Key → login_user.login_Id |
| Role_ID              | Foreign Key → login_role.Role_ID  |
| Menu_ID              | Foreign Key → triage_menus._id    |
| CreatedBy            | String                            |
| UpdatedBy            | String                            |
| CreatedTime          | DateTime                          |
| UpdatedTime          | DateTime                          |

---

## 5. Authentication Process

### Login Validation

When the user clicks **Login**:

1. Validate Email/Username and Password against the **login_user** table.
2. If credentials are invalid:

   * Display:

```text
Invalid Username or Password
```

3. If credentials are valid:

   * Retrieve the Login User record.
   * Retrieve the assigned Role from **login_user_access**.
   * Retrieve the allowed menus from **login_user_access**.

---

## 6. Authorization Process

### Example

#### Login User

```text
Email: admin@gmail.com
Username: admin
Password: admin@123
```

#### Role

```text
Admin
```

### System Flow

1. Authenticate the user from **login_user**.
2. Retrieve the assigned Role from **login_role**.
3. Retrieve the accessible menus from **login_user_access**.
4. Load only the menus assigned to the user.
5. Hide all unauthorized menus.
6. Redirect the user to the default authorized screen.

---

## 7. Menu Access Control

The application should dynamically build the navigation menu based on records in **login_user_access**.

### Example

#### Accessible Menus

```text
Dashboard
Claim Intake
Service Request Role
Vendor Onboarding
KPI Metrics
Administration
```

Only these menus should be visible.

### Restricted Menus

Menus without access permissions must:

* Not be displayed.
* Not be accessible via URL navigation.
* Return an Unauthorized message if accessed directly.

---

## 8. Session Management

After successful login:

* Store Login User ID in session/token.
* Store Role ID in session/token.
* Store permitted Menu IDs in session/token.

### Logout

When Logout is clicked:

* Clear session/token.
* Redirect user to Login screen.

---

## 9. Audit Fields

For all newly created or updated records across the application:

### CreatedBy

```text
Current Logged-In User Login_Id
```

### UpdatedBy

```text
Current Logged-In User Login_Id
```

### CreatedTime

```text
Current System Timestamp
```

### UpdatedTime

```text
Current System Timestamp
```

---

## 10. Expected Result

1. Users can authenticate using Email/Username and Password.
2. Roles are managed through the **login_role** table.
3. Menu access is controlled through the **login_user_access** table.
4. Only authorized menus and screens are displayed.
5. Unauthorized users cannot access restricted screens.
6. All audit fields (CreatedBy, UpdatedBy, CreatedTime, UpdatedTime) are populated using the logged-in user.
