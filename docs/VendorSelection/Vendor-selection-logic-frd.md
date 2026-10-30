# Functional Requirements Document

## Vendor Selection Logic Module
**Claim Orchestration Platform — Admin / Vendor**

| Field | Value |
|---|---|
| Document Title | FRD — Vendor Selection Logic |
| Module | Admin › Vendor › Vendor Selection Logic |
| Version | 1.0 |
| Date | 16-Jun-2026 |
| Status | Approved for Build |
| Owner | Product — Claims Orchestration |

---

## 1. Purpose & Scope

The Vendor Selection Logic screen allows administrators to manage the rule library that drives automated vendor selection during claim orchestration. Each logic entry encapsulates an eligibility, capacity, ranking or financial rule expressed in an IF/THEN condition that the orchestration engine evaluates at runtime to filter and rank vendors for a service request.

This FRD covers the three sub-screens that form the module:

- **List View** — `/admin/vendor-selection-logic`
- **View Detail** — `/admin/vendor-selection-logic/{ruleId}`
- **Edit Logic** — `/admin/vendor-selection-logic/{ruleId}/edit`

---

## 2. Actors & Roles

| Actor | Permissions |
|---|---|
| Admin | View, create, edit, enable/disable, delete any logic entry. |
| Vendor Manager | View list and detail. Edit Status only. |
| Auditor / Read-only | View list and detail. No write actions. |

---

## 3. Screen 1 — Vendor Selection Logic (List)

**Breadcrumb:** Home / Vendor Selection Logic
**Page title:** Vendor Selection Logic
**Sub-title:** "Defines logic for automated vendor selection logic."

### 3.1 Data Grid — Columns

| Column | Source field | Description |
|---|---|---|
| Logic | `name` | Display name of the rule (e.g. Conflict Check, KPI Sort). |
| Last Updated By | `updatedBy` | User who last modified the logic. |
| Last Updated On | `updatedOn` | Date of last modification (DD-MMM-YY). |
| Actions | — | Row-level action icons (see 3.3). |

**Reference data (as built):**

| Logic | Last Updated By | Last Updated On |
|---|---|---|
| Conflict Check | Admin | 16-Jun-26 |
| Geographic Eligibility | Admin | 16-Jun-26 |
| Capacity Limit | Admin | 16-Jun-26 |
| KPI Sort | Admin | 16-Jun-26 |
| ROI Threshold | Admin | 16-Jun-26 |

### 3.2 Page-level Buttons

| Button | Location | Action | Behaviour & Validation |
|---|---|---|---|
| New Logic | Header, right-aligned | Opens a blank logic editor. | Visible only to Admin. Creates a new draft entry; mandatory fields: Name, Category, Description, Condition. On save, appends to list with current user as `updatedBy` and today as `updatedOn`. |

### 3.3 Row Action Buttons

| Icon | Label / Tooltip | Action | Behaviour |
|---|---|---|---|
| Eye | View | Navigates to `/admin/vendor-selection-logic/{ruleId}`. | Opens read-only detail screen for the selected rule. |
| Trash | Delete | Removes the logic entry. | Shows confirm dialog "Delete this logic?". On confirm, removes row from state and refreshes grid. Available to Admin only. |

---

## 4. Screen 2 — View Vendor Selection Logic

**Breadcrumb:** Home / View Vendor Selection Logic
**Page title:** View Vendor Selection Logic
**Sub-title:** "Defines logic for automated vendor selection logic."

### 4.1 Layout

Two-column layout: left panel "Rule Library" (logic metadata), right panel "Preview Logic" (the IF/THEN condition).

Status pill "View Mode" displayed beside the Logic Details label.

### 4.2 Displayed Fields (read-only)

| Field | Description |
|---|---|
| Category Name | Logical grouping (Compliance, Coverage, Capacity, Ranking, Financial). |
| Description | Plain-language explanation of what the logic enforces. |
| Status | Active or Inactive — governs runtime activation. |
| Conditions | IF/THEN expression rendered in monospaced preview box. |

### 4.3 Buttons

| Button | Style | Action | Behaviour & Validation |
|---|---|---|---|
| Back | Secondary (outline, chevron-left) | Navigates to `/admin/vendor-selection-logic`. | Returns to the list without state change. Always enabled. |
| Edit Logic | Primary (orange, pencil icon) | Navigates to `/admin/vendor-selection-logic/{ruleId}/edit`. | Visible only to roles with edit permission (Admin, Vendor Manager). Opens the same logic in Edit Mode. |

---

## 5. Screen 3 — New / Edit Vendor Selection Logic

**Breadcrumb:** Home / New Vendor Selection Logic *(create)* or Home / Edit Vendor Selection Logic *(edit)*
**Page title:** New Vendor Selection Logic *(create)* or Edit Vendor Selection Logic *(edit)*
**Sub-title:** "Create a new logic for automated vendor selection." *(create)*

### 5.1 Layout

Two-column layout, consistent with the View screen:

- **Left panel — "Logic Library":** form fields for rule metadata, under section heading "Logic Details" with a mode pill ("New Mode" amber, when creating; "Edit Mode" amber, when editing an existing entry).
- **Right panel — "Preview Logic":** the Conditions textarea, with helper text below it: "Define the rule logic using IF/THEN syntax."

### 5.2 Editable Fields

| Field | Type | Required | Validation |
|---|---|---|---|
| Logic Name | Text input | Yes | Max 80 chars. Unique within library. |
| Category Name | Text input | Yes | Free text; suggested list of existing categories. |
| Description | Textarea (3 rows) | Yes | Min 10, max 500 chars. |
| Status | Select (Active / Inactive) | Yes | Defaults to Active for new entries. |
| Conditions | Textarea (8 rows, monospaced), placeholder "Type your condition here" | Yes | IF/THEN/ORDER BY syntax; parsed and validated server-side before persistence. |

### 5.3 Buttons

| Button | Style | Action | Behaviour & Validation |
|---|---|---|---|
| Cancel | Secondary (outline, chevron-left) | Create: navigates back to `/admin/vendor-selection-logic`. Edit: navigates back to `/admin/vendor-selection-logic/{ruleId}`. | Discards unsaved edits. If form is dirty, prompts "Discard changes?" confirmation. Always enabled. |
| Save Logic *(create)* / Save Changes *(edit)* | Primary (green) | Persists the form via `createRule()` / `updateRule()`. | Validates required fields (Logic Name, Category, Description, Conditions). On failure, shows inline error: "Category, Description and Conditions are required." On success: for create, stamps `createdBy` / `createdAt`, `updatedBy` = current user, `updatedOn` = today (DD-MMM-YY), and routes to the new rule's View screen; for edit, stamps `updatedBy` = current user, `updatedOn` = today, updates context state and returns user to View screen. |

### 5.4 Status Indicator

A pill labelled "New Mode" (amber) appears on the create screen; "Edit Mode" (amber) appears on the edit screen — both next to the "Logic Details" heading, to make the mode obvious vs. the View screen.

---

## 6. Functional Rules

- **FR-1:** Only logic entries with Status = Active are evaluated by the orchestration engine.
- **FR-2:** Conditions are evaluated in the order: eligibility → capacity → ranking → financial.
- **FR-3:** Delete is a soft action in production — entries are archived, not purged, for audit traceability.
- **FR-4:** Every save creates an immutable audit log record (user, timestamp, before/after JSON).
- **FR-5:** Updated On is system-generated; Updated By is derived from the authenticated session.
- **FR-6:** On create, Created By and Created On are system-generated from the authenticated session and creation timestamp, and are not editable thereafter.

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | List screen renders ≤ 500 ms for up to 200 rows. |
| Accessibility | WCAG 2.1 AA. Every icon-button exposes title / aria-label. |
| Security | Role-based access enforced server-side; client UI hides unauthorised buttons. |
| Audit | All create / update / delete events written to `vendor_logic_audit` table/collection. |
| Responsiveness | Layout collapses to single column below 1024 px viewport. |

---

## 8. Error Handling

| Scenario | Behaviour |
|---|---|
| Invalid logic ID in URL | Renders "Rule not found" with a link back to the list. |
| Save fails (network) | Toast "Could not save changes. Retry."; form remains dirty. |
| Condition syntax invalid | Inline error under Conditions textarea; Save disabled until resolved. |
| Concurrent edit conflict | Warning banner "This logic was updated by {user}. Reload to see latest." |
| Duplicate Logic Name on create | Inline error under Logic Name: "A rule with this name already exists." Save disabled until resolved. |

---

## 9. Open Questions

- Should categories be a managed reference list rather than free text?
- Do we need versioning / rollback of logic conditions?
- Should Inactive rules be hidden by default with a "Show inactive" toggle?
