# Vendor Portal – Login, Access Control & Screen Requirements

## Overview

When an **Active Vendor** logs into the application using their Username and Password, the system should validate the credentials, retrieve the vendor details from the `vendor_details` table, and display only vendor-specific menus and screens.

---
Reference Images 

C:\Users\yamuna.m\Documents\Activevendor\MyAssignment.png
C:\Users\yamuna.m\Documents\Activevendor\MyDocuments.png
C:\Users\yamuna.m\Documents\Activevendor\MyPerfomance.png
C:\Users\yamuna.m\Documents\Activevendor\MyProfile.png

# 1. Vendor Login & Access Control

## Authentication

When a vendor enters Username and Password:

1. Validate the credentials against the login tables.
2. Retrieve the vendor information from the `vendor_details` table.
3. Verify that the Vendor Status is **Active**.
4. If Vendor Status is not Active:

   * Deny access.
   * Display an appropriate message.

## Vendor Menu Access

For Active Vendors, create and display only the following menus.

These menus must be inserted into the `triage_menus` table.

### Vendor Menus

1. My Assignments
2. My Performance
3. My Documents
4. My Profile

### Access Restriction

Active Vendors should only have access to the above menus.

All internal menus should be hidden:

* Dashboard
* Claim Intake
* Service Request Role
* Vendor Onboarding
* KPI Metrics
* Administration
* Any other internal menu

---

# 2. My Assignments Screen

Use the provided design reference screenshot.

## Claim Retrieval

When an Active Vendor logs in:

1. Retrieve Vendor Details from `vendor_details`.
2. Retrieve assigned claims from `claim_intake_records`.
3. Display only claims assigned to the logged-in vendor.

---

## Assignment Tabs

Display the following tabs:

* All
* New
* Accepted
* In Progress
* Completed

---

## New Tab

Newly assigned claims should automatically appear in:

```text
New
```

tab.

---

## Claim Grouping

Group claims by:

```text
Company Name
```

---

## Grid Columns

Display:

| Column          | Source               |
| --------------- | -------------------- |
| Claim Reference | Claim Number         |
| Services        | Selected Service     |
| Assigned Date   | Vendor Assigned Date |
| Due Date        | Due Date             |
| Status          | Current Status       |
| Action          | Start / End Button   |

---

## Status Flow

### Initial Status

```text
New
```

---

### Start Button

When Start is clicked:

1. Update Status:

```text
In Progress
```

2. Hide Start button.
3. Display End button.

---

### End Button

When End is clicked:

1. Update Status:

```text
Completed
```

2. Refresh grid.
3. Move record into Completed tab.

---

# 3. My Performance Screen

Use the provided design reference screenshot.

## Performance Metrics

Display Vendor KPIs such as:

* Total Assigned Claims
* Completed Claims
* In Progress Claims
* Average Turnaround Time
* SLA Compliance %
* On-Time Completion %
* Monthly Trend

All performance data should be calculated based on vendor assignments and completed activities.

---

# 4. My Documents Screen

Use the provided design reference screenshot.

## Qualification Section

Display Qualification processing based on:

### Vendor Processing Stage

Source Table:

```text
Vendor_processing_Stage
```

---

### Vendor Confirmation Stage

Mapped Through:

```text
vendor_confirmation_stage
```

---

### Vendor Documents

Mapped Through:

```text
vendor_confirmation_documents
```

---

## Qualification Layout

Display all 4 Qualification Layers.

For each layer show:

* Stage Name
* Required Documents
* Uploaded Documents
* Approval Status
* Upload Date

---

# 5. My Profile Screen

Use the provided design reference screenshot.

## Vendor Details

Display all vendor information from:

```text
vendor_details
```

---

## Initial View

Show:

```text
Edit
```

button only.

---

## Edit Mode

When Edit is clicked:

1. Enable editing.
2. Hide Edit button.
3. Display:

```text
Save Changes
```

button.

---

## Save Changes

When Save Changes is clicked:

1. Save updated vendor information.
2. Audit the changes.
3. Update Vendor Status.

### Status Change

If any vendor information is modified:

Current Status:

```text
Active
```

Updated Status:

```text
Pending for Approval
```

---

## Refresh

After save:

1. Reload vendor profile.
2. Display updated values.
3. Show current vendor status.

---

# Expected Result

1. Active Vendors can log in successfully.
2. Only Vendor menus are displayed.
3. Vendors can view assigned claims in My Assignments.
4. Vendors can start and complete assigned work.
5. Vendors can monitor performance metrics.
6. Vendors can manage qualification documents.
7. Vendors can update profile information.
8. Any profile modification automatically changes Vendor Status from Active to Pending for Approval.
9. Internal application menus remain inaccessible to Vendor users.
