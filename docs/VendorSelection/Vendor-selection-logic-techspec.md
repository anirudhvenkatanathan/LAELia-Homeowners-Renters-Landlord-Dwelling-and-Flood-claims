# Technical Specification (Tech Spec) – Vendor Selection Logic

## Document Information

| Property | Value |
|----------|--------|
| Module | Claims Orchestration |
| Screen | Vendor Selection Logic |
| Frontend | Next.js |
| Backend | Node.js |
| API Layer | GraphQL |
| Database | MongoDB |
| Grid | AG Grid Enterprise |
| Version | 1.0 |

---

## 1. Architecture Overview

The Vendor Selection Logic module allows users to:

- View the rule library used for automated vendor selection
- Add new rules
- View rule details
- Edit existing rules
- Enable or disable rules
- Delete rules
- Define IF/THEN conditions for each rule

The implementation shall reuse existing Admin module grid, form, API, and database patterns.

---

## 2. Frontend Components

### List Screen

- VendorSelectionLogicPage
- VendorLogicGrid
- NewLogicButton

### Detail / Edit Screen

- VendorLogicDetails
- LogicLibraryPanel
- PreviewLogicPanel
- ConditionsEditor

### Shared Components

- AG Grid
- Toast Notifications
- Confirmation Dialog
- Loading Spinner
- Mode Pill (New / Edit / View)

---

## 3. GraphQL APIs

### Get Logic List

Query:

getVendorSelectionLogicList

Returns:
- RuleId
- Name
- Status
- UpdatedBy
- UpdatedOn

### Get Logic Details

Query:

getVendorSelectionLogicDetails(ruleId)

### Create Logic

Mutation:

createVendorSelectionLogic

Input:
- Name
- Category
- Description
- Status
- Conditions

### Update Logic

Mutation:

updateVendorSelectionLogic

### Delete Logic

Mutation:

deleteVendorSelectionLogic

---

## 4. Database Collections

### vendor_selection_logic

- RuleId
- Name
- Category
- Description
- Status
- Conditions
- CreatedBy
- CreatedOn
- UpdatedBy
- UpdatedOn
- IsDeleted

### vendor_selection_logic_audit

- AuditId
- RuleId
- Action
- User
- Timestamp

---

## 5. AG Grid Configuration

### Vendor Logic Grid

Columns:

- Logic
- Last Updated By
- Last Updated On
- Actions

Actions:

- View
- Delete

Features:

- Sorting
- Filtering
- Search
- Pagination
- Responsive Layout

---

## 6. Logic / Conditions Editor

- Conditions written using IF/THEN syntax
- Category dropdown loaded from existing rule categories
- No hardcoded category values
- Conditions validated before save

---

## 7. Validation Rules

- Logic Name required
- Category required
- Description required
- Conditions required
- Duplicate Logic Name not allowed
- Description min 10 characters, max 500 characters
- Logic Name max 80 characters

---

## 8. Security

- Authentication required
- Authorization required (Admin, Vendor Manager, Auditor)
- Audit logging enabled
- Input validation enabled
- Vendor Manager restricted to editing Status only

---

## 9. Error Codes

- VSL-001 Invalid Condition Syntax
- VSL-002 Duplicate Logic Name
- VSL-003 Required Fields Missing
- VSL-004 Save Failure
- VSL-005 Rule Not Found
- VSL-006 Concurrent Edit Conflict

---

## 10. Performance

- Grid Load < 500 ms for 200 rows
- Save Logic < 3 seconds
- Delete Logic < 2 seconds

---

## 11. User Workflow

1. Open Vendor Selection Logic list
2. View existing rules
3. Click New Logic to add a rule
4. Enter Name, Category, Description, Status, Conditions
5. Save Logic
6. View rule details
7. Edit rule if needed
8. Disable or delete rule if no longer needed
9. Audit information recorded
