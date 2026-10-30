# Functional Requirements Document (FRD)
## LAElia — Vendor Portal (Pre-Activation State)

**Version:** 1.0
**Date:** June 23, 2026
**Module:** Vendor Portal — Pre-Activation Vendor User Experience

---

## 1. Overview

This document defines the functional requirements for the Vendor Portal experience when a vendor user logs in **before their account has been activated**. The portal must display the onboarding progress dashboard, pre-populate all profile fields from the vendor's initial registration submission, and provide document upload functionality under My Onboarding.

---

## 2. Scope

This FRD covers the following four pages accessible to a pre-activation vendor user:

1. **Overview** — Onboarding progress dashboard
2. **My Onboarding** — Checklist with existing document upload functionality
3. **My Documents** — Uploaded document library
4. **My Profile** — Pre-populated vendor profile from registration data

---

## 3. Global Layout & Navigation

### 3.1 Top Navigation Bar

| Element | Specification |
|---|---|
| Left label | "LAElia — Vendor Portal" |
| Vendor name | Display vendor's registered display name (e.g., "MedReview Solutions") at top right |
| Status badge | "ONBOARDING" badge in amber/orange adjacent to vendor name — visible until account is activated |
| Logout | Icon button at far right |

### 3.2 Left Sidebar — MY ACCOUNT Section

The sidebar must render under a "MY ACCOUNT" group label with the following items:

1. Overview
2. My Onboarding
3. My Documents
4. My Profile

The active page must be visually highlighted (dark filled background, white text). No other navigation items are accessible to a pre-activation vendor.

---

## 4. Overview Page

### 4.1 Page Header

- Breadcrumb: "Vendor Portal"
- Page title: `Welcome, {VendorDisplayName}` (e.g., "Welcome, MedReview Solutions")
- Subtitle: "Complete your qualification checklist to get activated."

### 4.2 Onboarding Progress Grid

Display a **2×2 card grid** showing the four checklist layers. Each card must include:

| Element | Description |
|---|---|
| Layer prefix | L1 / L2 / L3 / L4 |
| Layer name | Human-readable name of the layer |
| Status badge | `IN PROGRESS` (amber) · `NOT STARTED` (gray) · `COMPLETE` (green) |
| Progress bar | Green filled bar proportional to completion percentage |
| Progress text | `{X} of {Y} items · {Z}%` |

**Checklist layers:**

| Layer | Name |
|---|---|
| L1 | Service-Category Specific |
| L2 | Universal (Legal & Insurance) |
| L3 | Technology Readiness |
| L4 | Track Record |

All progress values must be dynamically computed from the vendor's live checklist state.

### 4.3 Next Action Card

Below the progress grid, render a highlighted card with an amber left border/outline:

- Label: `NEXT ACTION` (amber, uppercase, small caps)
- Body: Name of the next incomplete required checklist item (e.g., `L2: Cyber liability insurance ≥ $5M`)
- CTA button: `Go to My Onboarding →` — navigates to the My Onboarding page

Next action logic: first incomplete required item scanned in order L1 → L2 → L3 → L4, then by item sequence within each layer.

---

## 5. My Onboarding Page

### 5.1 Purpose

Allows the vendor to view all qualification checklist items and complete them by uploading required documents. The **existing upload functionality already defined in the codebase must be reused here without modification**.

### 5.2 Checklist Display

- All four layers (L1–L4) and their child items must be listed
- Each item shows its name, requirement description, and current status
- Items requiring document submission must expose the existing upload control

### 5.3 Document Upload (Existing Functionality)

The current upload component already implemented must be embedded per checklist item. No new upload mechanism is to be built. Requirements it must continue to satisfy:

- File attachment per checklist item
- Upload progress feedback
- Uploaded file name and status displayed inline after upload
- Uploaded files reflected in the My Documents page

### 5.4 Item Status States

| Status | Description |
|---|---|
| Not Started | No action taken on this item |
| In Progress | Partially complete or document uploaded but unverified |
| Pending Review | Document submitted, awaiting admin review |
| Complete | Requirement fully satisfied |

---

## 6. My Documents Page

- List all documents uploaded by the vendor across all checklist items
- Each row shows: file name, associated checklist item/layer, upload date, and status
- Vendor may re-upload where the item status permits replacement

---

## 7. My Profile Page

### 7.1 Purpose

Display the vendor's profile details **pre-populated from the data entered during initial vendor registration**. All fields must render with the values submitted at sign-up — no field should appear blank if the data was captured during registration.

### 7.2 Company Section

| Field | Input Type | Source |
|---|---|---|
| Display name | Text input | Vendor registration |
| Legal entity | Text input | Vendor registration |

**Example values:** Display name = "MedReview Solutions", Legal entity = "MedReview Solutions LLC"

### 7.3 Primary Contact Section

| Field | Input Type | Source |
|---|---|---|
| Name | Text input | Vendor registration |
| Email | Email input | Vendor registration |
| Phone | Tel input | Vendor registration |

**Example values:** Name = "MedReview Solutions", Email = "vendor@mahathi.com", Phone = "(555) 555-0100"

### 7.4 Capacity Section

| Field | Input Type | Description |
|---|---|---|
| Max concurrent assignments | Number input | Set by vendor during registration (e.g., 200) |
| Currently open | Read-only number | System-computed from active assignments; always read-only for vendor |

### 7.5 Coverage States Section

- Render all 50 US states as selectable chip/toggle buttons using two-letter abbreviations (AL, AK, AZ, AR, CA … WY)
- States selected during registration must be pre-selected and visually filled (dark background)
- Counter in top-right corner of the section: `{selected} of 50` (e.g., "4 of 50")
- Vendor may add or remove states; changes must be explicitly saved

### 7.6 Save Behaviour

- A Save / Update button must be present on the profile page
- Edits to any field do not persist until the vendor explicitly saves
- On successful save, show a confirmation toast/message

---

## 8. Data Pre-Population Requirements

All fields across Overview and My Profile must be pre-populated from the vendor's initial registration submission. The system must never display empty fields for data already collected.

| Data | Page | Source |
|---|---|---|
| Vendor display name | Overview (welcome heading), My Profile | Registration form |
| Legal entity name | My Profile | Registration form |
| Primary contact name | My Profile | Registration form |
| Contact email | My Profile | Registration form |
| Contact phone | My Profile | Registration form |
| Max concurrent assignments | My Profile | Registration form |
| Coverage states (selected) | My Profile | Registration form |
| Checklist layer progress | Overview | Live onboarding state |
| Next action item | Overview | Live onboarding state |

---

## 9. Access Control

- A pre-activation vendor may only access: Overview, My Onboarding, My Documents, My Profile
- No access to assignment management, billing, reporting, or any admin views
- The "ONBOARDING" badge is removed and access expanded only after an admin activates the vendor account

---

## 10. Non-Functional Requirements

| Requirement | Detail |
|---|---|
| Data persistence | Profile edits and document uploads persist after explicit save/submit |
| Pre-population | All registration data must load on first login with no manual re-entry required |
| Loading states | Cards and form fields show skeleton loaders while data is being fetched |
| Error handling | Upload failures and save errors must display clear, user-friendly error messages |
| Responsiveness | Functional on desktop (1280px+) and tablet (768px+) |

---

## 11. Out of Scope

- Post-activation vendor experience
- Admin-side activation and review workflow
- Email/notification triggers
- New upload component development (existing component must be reused)

---

*End of Document*