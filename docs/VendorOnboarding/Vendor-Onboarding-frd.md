# Functional Requirements Document (FRD)

# Vendor Onboarding Module

## Project

Claims Triage Platform

## Database

MongoDB

## Database Name

claim_triage

---

# 1. Purpose

* Structured workflow for onboarding, validating, approving, suspending, and disqualifying vendors
* Enables users to:
  * Search vendors undergoing onboarding
  * Track onboarding progress through configurable processing stages
  * Upload and review required onboarding documents
  * Approve or reject onboarding requirements
  * Assign qualified service categories
  * Approve, suspend, or disqualify vendors

---

# 2. Vendor Onboarding Menu

## Navigation

* New menu group: **Vendors**
  * Submenu: **Vendor Onboarding**
    * On select: navigate to Vendor Onboarding Search screen

---

# 3. Vendor Processing Stage Configuration

## Collection

`vendor_processing_stage`

### Fields

| Field Name      | Description             |
| --------------- | ----------------------- |
| vendorStageId   | Unique stage identifier |
| vendorStageCode | Stage code              |
| vendorStageName | Stage name              |

### Data Load

Load the initial records from:

`D:\Export\claim_triage.vendor_Processing_Stage.json`

### Business Rule

* When:

```text
vendorStageCode = Service-Category_Specific
```

* Service Request Roles associated with vendor mapped using:

```text
vendor_details.serviceRequestRoleId
```

---

# 4. Vendor Details Collection Changes

Update collection:

`vendor_details`

### New Fields

| Field Name             | Description              |
| ---------------------- | ------------------------ |
| currentProcessingStage | Current onboarding stage |
| nextProcessingStage    | Next onboarding stage    |

### Mapping

* Both fields reference records from:

```text
vendor_processing_stage
```

---

# 5. Vendor Onboarding Search Screen

## Screen Purpose

* Displays vendors participating in onboarding

### Screen Reference

`D:\Vendor_onboard_screen.png`

### Grid Columns

| Column      | Source Field           |
| ----------- | ---------------------- |
| Vendor      | companyName            |
| Coverage    | coverage               |
| Days In Age | Calculated             |
| Stage       | currentProcessingStage |
| Next Action | nextProcessingStage    |

### Features

* Search
* Sorting
* Filtering
* Pagination
* Row Selection

### Navigation

* Row selection navigates to Vendor Onboarding Details screen

---

# 6. Vendor Onboarding Details Screen

### Screen Reference

`D:\Vendor_Onboard_Details_Screen.png`

### Navigation

* Opens when vendor selected from Vendor Onboarding Search screen

### Header

* Page title displays:

```text
companyName
```

---

# 7. Processing Stage Display

* Four onboarding stage cards at top of screen
* Stages retrieved from:

```text
vendor_processing_stage
```

* Each stage displays:
  * Stage Name
  * Stage Status
  * Completion Progress

---

# 8. Vendor Confirmation Stage Configuration

## Collection

`vendor_confirmation_stage`

### Fields

| Field Name             | Description                |
| ---------------------- | -------------------------- |
| vendorConfirmationId   | Unique identifier          |
| vendorStageId          | Processing stage reference |
| vendorConfirmationName | Confirmation requirement   |
| isMandatory            | Boolean flag               |

### Mapping

```text
vendor_confirmation_stage.vendorStageId
```

maps to

```text
vendor_processing_stage.vendorStageId
```

---

# 9. Confirmation Workflow

Each confirmation requirement should display:

* File Upload Control
* Approve Button
* Reject Button

### Approval Rules

When approved:

```text
Status = Approved
```

When rejected:

```text
Status = Rejected
```

---

# 10. Stage Completion Rules

A stage is considered:

### Completed

* All confirmation requirements within the stage approved

### In Progress

* One or more confirmation requirements pending or rejected

* Stage header displays the corresponding status

---

# 11. Service Category Approval

Display all Service Request Roles from:

```text
service_request_roles
```

### Requirements

* Show all available roles
* Qualified roles selected by default
* Selected roles are user-editable

---

# 12. Vendor Actions

Display the following buttons at the top of the page:

* Approve
* Suspend
* Disqualify

## Approve Button Rule

* Approve button enabled only when:

```text
All four onboarding stages = Completed
```

Otherwise:

```text
Approve Button = Disabled
```

---

# 12.1 Pending Approval Screen — Q-AI Helper Panel

- Pending Approval screen: two-column layout
  - Left column: onboarding details
  - Right column: always-visible **Q-AI Helper** panel
    - AI company summary
    - Service insights
    - Red flags
- Q-AI Helper panel: Info-blue-tinted (2026-07-23 re-theme; previously purple-tinted)
  - Purpose: stands out as an AI panel, distinct from the teal primary and green vendor-card tint used elsewhere
- Findings-count badge next to "Red Flags & Adverse Findings"
  - Color: blue (`var(--color-info)`)
  - Matches rest of panel

---

# 13. Vendor Status Workflow

| Event                | Status             |
| -------------------- | ------------------ |
| Vendor Created       | In Progress        |
| Documents Uploaded   | In Progress        |
| Stage Approved       | In Progress        |
| All Stages Completed | Ready For Approval |
| Approve Clicked      | Approved           |
| Suspend Clicked      | Suspended          |
| Disqualify Clicked   | Disqualified       |

---

# 14. File Upload Requirements

For every confirmation item:

* Support file uploads.
* Store uploaded document metadata.
* Associate documents with the vendor and onboarding stage.

### Audit Information

Capture:

* Uploaded By
* Uploaded Date
* Approved By
* Approved Date
* Rejected By
* Rejected Date
* Comments

---

# 15. Business Rules

1. A vendor cannot be approved until all mandatory confirmations are approved.
2. A suspended vendor cannot receive assignments.
3. A disqualified vendor cannot participate in onboarding workflows.
4. Service Category Approval must use records from `service_request_roles`.
5. Processing stages must be configurable through the `vendor_processing_stage` collection.
6. Confirmation requirements must be configurable through the `vendor_confirmation_stage` collection.

---

# 16. Acceptance Criteria

* Vendor Onboarding menu is available under Vendors.
* Vendor Onboarding Search screen displays vendor records correctly.
* Stage and Next Action fields display current workflow status.
* Vendor Details screen displays onboarding stages.
* File uploads function correctly.
* Approve and Reject actions function correctly.
* Stage status updates dynamically.
* Service Category Approval displays available roles.
* Approve button is enabled only when all stages are completed.
* Vendor status transitions follow the defined workflow.
