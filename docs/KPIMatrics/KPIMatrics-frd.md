# Functional Requirements Document (FRD)

# Project

Claims Triage Platform

# Module

KPI Metrics

## 1. Overview

The KPI Metrics module enables administrators to configure, manage, and maintain KPI measurement criteria for each Service Request Role. The module allows users to define KPI Groups, KPI Suggestions, Thresholds, and Formula Conditions used to evaluate claim processing performance.

The solution shall use the collections defined in:

* KPI_Matrics
* KPI_Matrics_Group_Tracking
* KPI_Matrics_Field_And_Sections
* KPI_Matrics_Field_And_Condition

The MongoDB schema definition is available in:

* KPIMatrics_MongoDB_Definition.md

---

# 2. Navigation

## Menu Structure

A new group menu shall be created:

### ADMIN

Under the ADMIN group, create a new menu:

* KPI Metrics

### Icon

```text
lucide lucide-sigma
```

### Navigation

When the user clicks KPI Metrics, navigate to:

```text
/admin/kpi-matrics
```

---

# 3. Screen Design

## KPI Metrics Screen

The screen layout, styling, spacing, typography, tabs, cards, colors, icons, and interactions shall exactly match the reference design:

```text
D:\KPI_Matrics_Design.png
```

No deviations from the reference design are permitted.

---

# 4. Service Tabs

## Data Source

Service tabs shall be dynamically loaded from:

```text
service_request_roles
```

### Display

Each Service Request Role shall be displayed as a selectable tab.

Example:

* Property Inspection
* Water Mitigation
* Roofing Assessment
* Contents Evaluation

---

# 5. KPI Metrics Display

When a Service tab is selected:

### System Behavior

Retrieve KPI data from:

```text
KPI_Matrics
```

using:

```text
serviceRequestRoleId
```

### Display

Display all KPI Groups associated with the selected Service on the right side of the screen.

---

# 6. KPI Group Status

Each KPI Group shall support:

* Active
* Inactive

### Active

The KPI Group is fully editable.

### Inactive

The KPI Group shall:

* Appear disabled
* Be visually greyed out
* Prevent edits
* Prevent KPI calculations

---

# 7. Formula Editor

Each KPI Metric shall contain a Formula section.

### User Actions

The user may:

* Edit existing conditions
* Modify operators
* Modify values
* Modify condition types
* Change sort order

### Data Source

Updates shall be saved to:

```text
KPI_Matrics_Field_And_Condition
```

---

# 8. Add New Metric

The user shall be able to create a new KPI Metric.

### Add Metric Button

Provide:

```text
+ New Metric
```

### User Inputs

* KPI Group Tracking
* KPI Group Tracking Suggestion
* Thresholds Good
* Thresholds Moderate
* Thresholds Poor
* Better When
* Formula Conditions

### Save Action

Create records in:

* KPI_Matrics
* KPI_Matrics_Group_Tracking
* KPI_Matrics_Field_And_Sections
* KPI_Matrics_Field_And_Condition

---

# 9. KPI Condition Management

Users shall be able to:

* Add Condition
* Edit Condition
* Delete Condition
* Reorder Condition

### Condition Fields

* fieldName
* operator
* value
* conditionType
* sortOrder

---

# 10. Validation Rules

### Service Selection

A Service tab must be selected before KPI data can be displayed.

### Mandatory Fields

Required fields:

* KPI Group Tracking
* KPI Group Tracking Suggestion
* Better When

### Threshold Validation

Good, Moderate, and Poor thresholds must contain valid values.

### Formula Validation

At least one condition must exist before a KPI Metric can be saved.

---

# 11. Audit Fields

The following fields shall be maintained automatically:

* CreatedBy
* CreatedAt
* UpdatedBy
* UpdatedAt

---

# 12. Security

Only authorized administrative users may:

* Create KPI Metrics
* Edit KPI Metrics
* Activate KPI Groups
* Inactivate KPI Groups
* Modify Formula Conditions

---

# 13. Non-Functional Requirements

* Responsive design
* Real-time UI updates
* MongoDB persistence
* Consistent performance across browsers
* Exact visual alignment with KPI_Matrics_Design.png
* Support future KPI expansion without schema changes

---

# 14. Success Criteria

The implementation will be considered complete when:

1. KPI Metrics menu is available under ADMIN.
2. Service tabs load from service_request_roles.
3. KPI Groups load dynamically based on Service selection.
4. KPI Groups support Active and Inactive states.
5. Formula conditions are editable.
6. Users can create new KPI Metrics.
7. Data persists correctly in MongoDB.
8. The screen matches the provided design exactly.
