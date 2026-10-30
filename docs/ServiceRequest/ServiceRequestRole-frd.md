# Functional Requirements Document (FRD) – Service Request Role

## Document Information

| Property | Value |
|----------|--------|
| Module | Claims Management |
| Screen | Service Request Role |
| Version | 1.0 |
| Status | Draft |
| Date | May 2026 |

---

# 1. Overview

The Service Request Role module allows administrators to upload, configure, maintain, and manage Service Request Role definitions and assignment conditions.

The screen design, layout, user experience, upload functionality, AG Grid styling, navigation flow, and responsive behavior shall follow the existing Claim Intake module.

The solution consists of:

1. Service Request Role Upload Screen
2. Service Request Role Details Screen
3. Service Request Role Maintenance Screen

---

# 2. Navigation

Menu Name:
- Service Request Role

Navigation Path:
- Claims → Service Request Role

---

# 3. Upload Service Request Role Screen

## Actions

- Upload Service Request Role
- Download Template

### Upload Requirements

Supported File Types:

- Excel (.xlsx)
- Excel (.xls)

Validation:

- File is required
- Supported file types only
- Empty file not allowed

### Download Template

Template Location:

- Template\service-request-role-template.xlsx - downloable template

Requirements:

- Download existing template
- Reuse existing download service
- No dynamic template generation

---

# 4. Uploaded Files AG Grid

After upload, uploaded files shall be displayed in AG Grid.

Columns:

- Upload ID
- File Name
- Upload Type
- Total Records
- Uploaded By
- Upload Date
- Status

Features:

- Sorting
- Filtering
- Search
- Pagination
- Responsive Design
- Row Selection

---

# 5. Navigation to Details Screen

When a user selects a record from the AG Grid:

- Navigate to Service Request Role Details Screen
- Display all records contained in the uploaded file

---

# 6. Service Request Role Details Screen

Header Information:

- Upload ID
- File Name
- Upload Date
- Uploaded By
- Status
- Total Records

Display uploaded role records in AG Grid.

Actions:

- Add
- Edit
- Save
- Cancel

Users can:

- Add new role records
- Modify role records
- Save changes
- Cancel unsaved changes

---

# 7. Service Request Role Maintenance Screen

Apart from upload functionality, users must be able to manually maintain roles.

Role Library Grid:

Columns:

- Role Name
- Description
- Line of Business
- Status
- Actions

Actions:

- Add Role
- Edit Role
- Save Role
- Cancel Changes
- Delete Role

---

# 8. Role Conditions

Users can configure assignment conditions.

Columns:

- Field
- Operator
- Value
- Condition

Supported Conditions:

- AND
- OR

Supported Actions:

- Add Condition
- Remove Condition
- Add Condition Group

---

# 9. Preview Logic

The system shall display generated rule logic dynamically.

Example:

(Claim Amount > 10000 AND Loss Type = Medical Only)
OR
(State IN (CA, TX, FL))

---

# 10. Condition Summary

Display a human-readable summary of configured conditions.

The summary shall update automatically when conditions are modified.

---

# 11. Role Details Section

Fields:

- Role Name
- Description
- Status
- Line of Business

Validation:

- Role Name required
- Description required
- Line of Business required (at least one selection)
- Duplicate Role Names not allowed

---

# 11a. Line of Business (LOB)

Every Service Request Role belongs to one or more Lines of Business. This determines which claims the rule is eligible to apply to. Supporting multiple LOBs on a single rule lets a shared rule (e.g. a General Liability rule that also applies to Property) be configured once instead of duplicated per LOB.

Supported Values:

- WCM
- Auto
- General Liability
- Property

Requirements:

- Line of Business is a mandatory, multi-select checkbox group on the Service Request Role Maintenance screen (manual create/edit) — at least one value must be selected.
- Selection is persisted on the role record as an array (`line_of_business`).
- Roles created via Excel upload (Section 3) have no Line of Business column in the template and continue to default to `[WCM]`, matching the module's existing WCM-only upload flow.
- All Service Request Role records that existed before this feature was introduced are treated as `[WCM]` (backfilled), so no existing WCM rule changes behavior.
- The Claim Command Center (see `docs/ClaimIntake/claimIntakeMaster-frd.md`) uses this value to show a claim only the rules whose Line of Business list includes the claim's own Line of Business.

---

# 12. Field Mapping Integration

Field dropdown values shall come from the Field Mapping module.

Requirements:

- Retrieve fields from Field Mapping configuration
- No hardcoded field values
- Dynamically populate Field dropdown

Example:

- Claim Amount
- Loss Type
- State
- Fraud Indicator
- Number of Prior Claims

---

# 13. Business Rules

- Duplicate roles not allowed
- Duplicate conditions not allowed
- Mandatory fields required
- Conditions must be valid before save
- Audit records must be stored

---

# 14. Success and Error Handling

Success:

- Upload Success
- Save Success
- Role Created
- Role Updated
- Template Download Success

Errors:

- Invalid File Format
- Upload Failure
- Validation Failure
- Save Failure
- Download Failure

---

# 15. Audit Requirements

Store:

- Upload ID
- File Name
- Uploaded By
- Upload Date
- Role Changes
- Condition Changes
- Saved By
- Saved Date

---

# 16. Reuse Existing Components

The implementation shall reuse:

- Claim Intake Upload Components
- Existing Download Template Service
- Existing AG Grid Components
- Existing APIs
- Existing Database Patterns
- Existing UI Components
- Existing Audit Framework

---

# 17. User Flow

1. Open Service Request Role screen.
2. Download template if required.
3. Upload Excel file.
4. Uploaded file appears in AG Grid.
5. Select uploaded file.
6. Open details screen.
7. Review uploaded records.
8. Create or edit roles.
9. Configure conditions.
10. Review Preview Logic.
11. Review Condition Summary.
12. Save changes.
13. System stores audit information.
