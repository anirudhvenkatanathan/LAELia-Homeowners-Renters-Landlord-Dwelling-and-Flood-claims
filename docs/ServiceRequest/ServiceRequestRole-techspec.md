# Technical Specification (Tech Spec) – Service Request Role

## Document Information

| Property | Value |
|----------|--------|
| Module | Claims Management |
| Screen | Service Request Role |
| Frontend | Next.js |
| Backend | Node.js |
| API Layer | GraphQL |
| Database | MongoDB |
| Grid | AG Grid Enterprise |
| Version | 1.0 |

---

## 1. Architecture Overview

The Service Request Role module allows users to:

- Upload Service Request Roles from Excel
- Download predefined templates
- Manage Roles
- Configure Role Conditions
- Save Assignment Rules
- Reuse Field Mapping values

The implementation shall reuse Claim Intake upload, download, AG Grid, API, and database patterns.

---

## 2. Frontend Components

### Dashboard

- ServiceRequestRolePage
- UploadRoleModal
- DownloadTemplateButton
- UploadedFilesGrid

### Details Screen

- ServiceRequestRoleDetails
- RoleLibraryGrid
- RoleConditionGrid
- PreviewLogicPanel
- ConditionSummaryPanel

### Shared Components

- AG Grid
- Toast Notifications
- Confirmation Dialog
- Loading Spinner

---

## 3. GraphQL APIs

### Upload Service Request Role

Mutation:

uploadServiceRequestRole

Input:
- Excel File

Response:
- UploadId
- Status
- Message

### Get Uploaded Files

Query:

getServiceRequestRoleUploads

Returns:
- UploadId
- FileName
- TotalRecords
- UploadedBy
- UploadDate
- Status

### Get Role Details

Query:

getServiceRequestRoleDetails(uploadId)

### Save Role

Mutation:

saveServiceRequestRole

### Save Conditions

Mutation:

saveRoleConditions

### Download Template

Query:

downloadServiceRequestRoleTemplate

---

## 4. Database Collections

### service_request_role_upload

- UploadId
- FileName
- UploadType
- TotalRecords
- UploadedBy
- UploadDate
- Status

### service_request_role

- RoleId
- RoleName
- Description
- Status
- LineOfBusiness (`line_of_business`) — required, array of one or more of: WCM, Auto, General Liability, Property (Mongoose `[String]`, `enum` per element). A role can serve multiple LOBs (e.g. a shared General Liability + Property rule) instead of needing a duplicate row per LOB. Defaults to `['WCM']`. Records created before this field existed, or that still hold it in the pre-array single-string shape, are backfilled/migrated to an array automatically on every server startup (`ensureServiceRequestRoleLOB()`, see §8a) and via `scripts/backfillServiceRequestRoleLOB.ts` (run once: `npx ts-node scripts/backfillServiceRequestRoleLOB.ts`); read resolvers also fall back to `['WCM']` defensively for any record the backfill hasn't reached.

### service_request_role_conditions

- ConditionId
- RoleId
- FieldName
- Operator
- Value
- ConditionType

### service_request_role_audit

- AuditId
- RoleId
- Action
- User
- Timestamp

---

## 5. AG Grid Configuration

### Uploaded Files Grid

Columns:

- Upload ID
- File Name
- Total Records
- Uploaded By
- Upload Date
- Status

Features:

- Sorting
- Filtering
- Search
- Pagination
- Responsive Layout

### Role Library Grid

Columns:

- Role Name
- Description
- Line of Business
- Status
- Actions

Actions:

- Add
- Edit
- Save
- Cancel
- Delete

### Role Conditions Grid

Columns:

- Field
- Operator
- Value
- Condition

Actions:

- Add Condition
- Remove Condition
- Add Condition Group

---

## 6. Field Mapping Integration

Field dropdown values shall be loaded from the Field Mapping module.

Examples:

- Claim Amount
- Loss Type
- State
- Fraud Indicator
- Number Of Prior Claims

No hardcoded values allowed.

---

## 7. Template Download

Template Location:

D:\Claim Tracker\Template\service-request-role-template.xlsx

Requirements:

- Download existing file
- No dynamic generation
- Reuse existing download service

---

## 8. Validation Rules

- File required
- Excel only (.xlsx, .xls)
- Role Name required
- Description required
- Line of Business required, at least one value (`createServiceRequestRole`/`updateServiceRequestRole` mutations take `lineOfBusiness: [String!]!` — Excel bulk upload path is unaffected and continues to default to `['WCM']`)
- Duplicate Roles not allowed
- Duplicate Conditions not allowed

---

## 8a. Line of Business (LOB) — Implementation

`sourceCode/apps/api/utils/lineOfBusiness.ts` (mirrored on the frontend at `sourceCode/apps/frontEnd/src/utils/lineOfBusiness.ts`) is the single source of truth for:

- `LINE_OF_BUSINESS_OPTIONS`: `['WCM', 'Auto', 'General Liability', 'Property']`
- `mapClaimTypeToLOB(claimType)`: exact case-insensitive match to one of the four values first, then fuzzy synonym matching (`workers comp*`/`wc` → WCM, `auto*`/`vehicle` → Auto, `general liability`/`gl` → General Liability, `propert*` → Property), defaulting to `WCM` for anything unrecognized (backward-compatible with pre-LOB data, which is all WCM). This always resolves to a **single** LOB — a claim belongs to exactly one — even though a rule's `lineOfBusiness` is now an array of the LOBs it applies to.

This function is used by `sourceCode/apps/api/graphQL/claimIntakeEntity.ts` in two places:

- `matchRolesForRecord()` — skips any Active role whose `lineOfBusiness` array doesn't `include()` the claim record's derived LOB, so the rule engine's auto-suggested `planServices` only ever contain rules configured for that LOB.
- `validateRolesMatchClaimLOB()` — called from `savePlanServices`, `saveDraftPlanServices`, and `saveVendorServices` before persisting a user's selected roleIds; rejects the save with an error message if any selected role's `lineOfBusiness` array doesn't include the claim's LOB.

### Array migration (`sourceCode/apps/api/services/serviceRequestRoleLOBBackfill.ts`)

`ensureServiceRequestRoleLOB()` runs on every server startup (`server.ts`, matching the `seedActiveVendorMenus()` pattern) and is fully idempotent:

1. Backfills any record missing `lineOfBusiness` (or holding `''`) to `['WCM']`.
2. Migrates any record still holding `lineOfBusiness` as a single string (the pre-array shape, e.g. `"Auto"`) into a one-element array (`["Auto"]`). Uses `$expr: { $eq: [{ $type: '$lineOfBusiness' }, 'string'] }` rather than the query-language `{ $type: 'string' }` — the latter also matches an *array* field that merely contains a string element (i.e. every already-migrated `["WCM"]` record), which would incorrectly re-wrap it into `[["WCM"]]`.
3. Self-heals any record left double-nested (`[["WCM"]]`) by an earlier version of this migration, flattening one level of array nesting. No-op once the database is clean.
4. Normalizes any element that isn't one of the exact four canonical enum values — e.g. hand-edited/imported records holding `"AUTO"`, `"GL"`, `"PROPERTY"`, or lowercase `"wcm"` — to its canonical form via `mapClaimTypeToLOB()` (case-insensitive exact match, then `gl`/`propert*`/`auto` synonyms), and de-duplicates the array. Only rewrites records that actually contain a non-canonical value.

`scripts/backfillServiceRequestRoleLOB.ts` is the manual, ad-hoc equivalent for environments where running a one-off script is preferred over restarting the API server.

See `docs/ClaimIntake/claimIntakeMaster-techspec.md` for how the Claim Command Center consumes this on the display side.

---

## 9. Security

- Authentication required
- Authorization required
- Audit logging enabled
- Input validation enabled

---

## 10. Error Codes

- SRR-001 Invalid File Format
- SRR-002 Empty File
- SRR-003 Duplicate Role
- SRR-004 Invalid Condition
- SRR-005 Save Failure
- SRR-006 Download Failure

---

## 11. Performance

- Upload < 5 seconds
- Grid Load < 3 seconds
- Save Role < 3 seconds
- Download Template < 2 seconds

---

## 12. User Workflow

1. Download Template
2. Upload Excel File
3. View Uploaded Files
4. Open Details Screen
5. Manage Roles
6. Configure Conditions
7. Review Preview Logic
8. Save Changes
9. Audit Information Recorded
