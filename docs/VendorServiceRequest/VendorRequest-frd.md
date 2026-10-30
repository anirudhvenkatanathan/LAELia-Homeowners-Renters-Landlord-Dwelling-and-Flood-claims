# Functional Requirements Document (FRD)
## Vendor Service Request — Claims Workbench Interactive

**Version:** 1.0  
**Module:** Services > Vendor Service Request  
**Application:** ClaimFlow — Workers' Comp Claim Orchestration  

---

## 1. Overview

The Vendor Service Request module allows administrators to submit, track, and manage vendor onboarding requests. Each request links a vendor company to one or more service categories and geographic coverage areas. Requests progress through a defined lifecycle (Draft → Submitted → In Review → Approved / Rejected).

---

## 2. Screens

### 2.1 Vendor Service Requests List (`/services/vendor-request`)

#### Purpose
Central dashboard listing all vendor service requests with status filtering and search.

#### Elements

| Element | Description |
|---|---|
| Page title | "Vendor Service Requests" with subtitle "Track and submit vendor onboarding requests." |
| `+ Request New Vendor` button | Opens the New Vendor Request form |
| Status filter tabs | All · Draft · Submitted · In Review · Approved · Rejected |
| Search box | Filters by vendor name (client-side or server-side) |
| Requests table | See columns below |

#### Table Columns

| Column | Description |
|---|---|
| Vendor Name | Company display name |
| Services Requested | Badge tags showing service codes (e.g., S-06, S-05) |
| Coverage | State abbreviation badges; overflow shown as `+N` |
| Submitted By | User who created the request |
| Date | Submission/creation date (YYYY-MM-DD) |
| Status | Pill badge: Draft (grey) · Submitted (blue) · In Review (amber) · Approved (green) · Rejected (red) |
| Action | "View" link — opens detail/edit view for that request |

#### Behaviors
- Default tab is **All**.
- Clicking a status tab filters the table to only rows with that status.
- Search filters vendor name in real time.
- Clicking **View** navigates to the detail view for that record.
- Clicking **+ Request New Vendor** navigates to the New Vendor Request form.

---

### 2.2 View / Edit Vendor Request (`/services/vendor-request/:id`)

#### Purpose
Read-only detail view of an existing vendor service request. Shows all submitted data.

#### Sections

| Section | Fields |
|---|---|
| Header | Vendor name as page title, "Request details" subtitle, status badge (top-right), "← Back to Requests" link |
| Company | Company Name, Email Address, Phone Number |
| Service Categories | Card grid of selected services — each card shows service name, code (S-XX), and category tag |
| Geographic Coverage | State badge list |
| (Additional sections if applicable) | Notes, attachments, audit trail |

#### Behaviors
- Page is view-only when status is **In Review**, **Approved**, or **Rejected**.
- **Back to Requests** returns to the list view without changes.
- Status badge reflects the current workflow state.

---

### 2.3 New Vendor Request Form (`/services/vendor-request/new`)

#### Purpose
Form to create a new vendor service request. Only Company Name and Services are required.

#### Sections

**Company**

| Field | Type | Required | Notes |
|---|---|---|---|
| Company Name | Text input | Yes | Placeholder: "e.g. Verity Field Services LLC" |
| Email Address | Email input | No | Placeholder: "Primary contact email" |
| Phone Number | Tel input | No | Placeholder: "Primary contact phone" |

**Service Categories**

- Grid of service cards (3 columns), each with a checkbox.
- Shows service name, code (S-XX), and a category tag (Legal, Investigation, Medical Management, etc.).
- Count indicator: "X of 15 selected".
- **Select All** and **Clear All** quick actions.
- At least one service must be selected before submission.

**Full list of 15 services (sourced from `service_request_roles`):**

| Code | Name | Category |
|---|---|---|
| S-01 | Records — Defense | Legal |
| S-02 | Records — Adverse Party | Legal |
| S-03 | Medical Canvassing | Investigation |
| S-04 | IME / Peer Review | Medical Management |
| S-05 | Desk Investigations | Investigation |
| S-06 | Field Investigations | Investigation |
| S-07 | (to be defined) | — |
| S-08 | (to be defined) | — |
| S-09 | (to be defined) | — |
| S-10 | (to be defined) | — |
| S-11 | (to be defined) | — |
| S-12 | (to be defined) | — |
| S-13 | (to be defined) | — |
| S-14 | (to be defined) | — |
| S-15 | (to be defined) | — |

> **Note:** Full service definitions for S-07 through S-15 to be confirmed by product team and populated into `service_request_roles` collection.

**Geographic Coverage**

- Multi-select of US state badges.
- At least one state is recommended (not hard-required).

**Form Actions**

| Button | Behavior |
|---|---|
| Save as Draft | Saves the record with status = `draft`; navigates back to list |
| Submit | Validates required fields, saves with status = `submitted`; navigates back to list |
| Cancel / Back | Discards unsaved changes; returns to list |

---

## 3. Status Lifecycle

```
[Draft] → [Submitted] → [In Review] → [Approved]
                                     ↘ [Rejected]
```

| Status | Who sets it | Description |
|---|---|---|
| Draft | System (on Save as Draft) | Incomplete/saved for later |
| Submitted | System (on Submit) | Sent for review |
| In Review | Admin / Reviewer | Under active review |
| Approved | Admin / Reviewer | Vendor approved |
| Rejected | Admin / Reviewer | Vendor not approved |

---

## 4. Roles & Permissions

| Role | List View | Create | View Detail | Change Status |
|---|---|---|---|---|
| Admin | ✅ All records | ✅ | ✅ | ✅ |
| Reviewer | ✅ Assigned | ❌ | ✅ | ✅ (In Review → Approved/Rejected) |
| Submitter | ✅ Own records | ✅ | ✅ Own | ❌ |

---

## 5. Notifications (Future)

- Email to submitter when status changes to Approved or Rejected.
- In-app badge count on "Vendor Service Request" nav item reflects pending/unread requests.

---

## 6. Out of Scope (v1)

- Vendor portal (external facing).
- Document/attachment upload.
- E-signature.
- Bulk import of vendor requests.
