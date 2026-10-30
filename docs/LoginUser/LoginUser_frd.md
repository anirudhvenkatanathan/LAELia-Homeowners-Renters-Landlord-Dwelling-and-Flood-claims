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

## 1.1 Login Screen UI — LAElia Teal Theme

Reference : C:\Users\yamuna.m\Downloads\login.png

* Login screen UI redesigned to match the reference above.
* Authentication API and backend logic unchanged — presentation-layer requirements only.

### Branding

* Product logo is the LAElia wordmark artwork (solid white), rendered by the shared `LaeliaLogo` component at its natural aspect ratio.
* Logo has no card, background, border, or shadow — sits directly on the brand-teal fill behind it.
* Quick Login role tabs sit in their own bar at the top of the page; the logo sits inside the teal left panel of the hero section below it (not a separate header bar).
* Color theme is teal app-wide.
  - Buttons, links, focus states, active tabs, the sidebar, and the Login screen's hero panel all use the same teal family.
  - Sign In button uses a coral accent, not teal.
  - Hero panel background is a teal gradient (light teal to near-black teal); all other surfaces are flat fills.
* Same LAElia logo used on the Login screen, main app sidebar, and Active/Vendor Portal shell sidebars.

### Layout

1. **Quick Login bar** (top of page) — role tabs on a dark-teal strip, see below.
2. **Hero section** — one joined two-tone panel:
   * Left (teal gradient): logo, marketing headline ("The Patented AI-Powered 3rd Party
     Claims Service Orchestration Platform", serif font) + bullet list, white text.
   * Right (white): login card — title, Email/Phone id tabs, form fields, Remember-me
     checkbox, coral Sign In button, terms links.
3. Responsive:
   * Hero panel collapses to a single stacked column below ~860px.
   * Quick Login tabs scroll horizontally on narrow viewports.

### Quick Login Selector

A role-based quick login selector appears as an unlabeled tab strip at the top of the
page (no "Quick Login" caption), one tab per role:

* Admin
* Claims Adjuster
* Claims Supervisor
* Service Provider Onboarding
* Active Service Provider

Behavior:

* Selecting a role tab:
  - Prefills the **Email/Username** and **Password** fields with that role's demo credentials.
  - Marks the tab active (white background).
* Selecting a role does **not** submit the form or log the user in automatically.
* User must click **Sign In** to authenticate.
  - Goes through the same validation and API flow as a manually typed login.

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
