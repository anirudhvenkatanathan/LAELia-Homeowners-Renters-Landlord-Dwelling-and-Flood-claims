# Technical Specification (TechSpec)

# Vendor Onboarding Module

## Project

Claims Triage Platform

## Database

MongoDB

## Database Name

claim_triage

---

# 1. Technical Overview

* Configurable workflow for onboarding vendors through multiple processing stages
* Supports:
  * Document collection
  * Approval workflows
  * Service category assignment
  * Vendor lifecycle management

---

# 2. Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* Material UI

## Backend

* Node.js
* Express.js

## Database

* MongoDB

---

# 3. MongoDB Collections

## Existing Collection: vendor_details

### Additional Fields

```json
{
  "currentProcessingStage": "ObjectId",
  "nextProcessingStage": "ObjectId"
}
```

### Collection Structure

```json
{
  "_id": "ObjectId",
  "companyName": "ABC Medical Review Services",
  "coverage": "National",
  "serviceRequestRoleId": ["ObjectId"],
  "currentProcessingStage": "ObjectId",
  "nextProcessingStage": "ObjectId",
  "vendorStatus": "In Progress",
  "createdAt": "2026-06-01T10:00:00Z"
}
```

---

## New Collection: vendor_processing_stage

```json
{
  "_id": "ObjectId",
  "vendorStageId": "VS001",
  "vendorStageCode": "BACKGROUND_VERIFICATION",
  "vendorStageName": "Background Verification"
}
```

### Data Source

Import initial data from:

```text
D:\\Export\\claim_triage.vendor_Processing_Stage.json
```

---

## New Collection: vendor_confirmation_stage

```json
{
  "_id": "ObjectId",
  "vendorConfirmationId": "VC001",
  "vendorStageId": "VS001",
  "vendorConfirmationName": "Business Registration Document",
  "isMandatory": true
}
```

### Relationship

```text
vendor_confirmation_stage.vendorStageId
```

maps to

```text
vendor_processing_stage.vendorStageId
```

---

## New Collection: vendor_confirmation_documents

```json
{
  "_id": "ObjectId",
  "vendorId": "ObjectId",
  "vendorStageId": "VS001",
  "vendorConfirmationId": "VC001",
  "fileName": "registration.pdf",
  "filePath": "/uploads/vendors/",
  "approvalStatus": "Pending",
  "comments": "",
  "uploadedBy": "admin",
  "uploadedAt": "2026-06-01T10:00:00Z"
}
```

---

# 4. Collection Relationships

## vendor_details

```text
serviceRequestRoleId
```

maps to

```text
service_request_roles._id
```

---

## vendor_details

```text
currentProcessingStage
```

maps to

```text
vendor_processing_stage._id
```

---

## vendor_details

```text
nextProcessingStage
```

maps to

```text
vendor_processing_stage._id
```

---

## vendor_confirmation_stage

```text
vendorStageId
```

maps to

```text
vendor_processing_stage.vendorStageId
```

---

# 5. Vendor Onboarding Search Screen

## API

### Get Vendor List

```http
GET /api/vendors/onboarding
```

### Response

```json
{
  "totalRecords": 120,
  "data": []
}
```

---

## Grid Columns

| UI Column   | Collection Field       |
| ----------- | ---------------------- |
| Vendor      | companyName            |
| Coverage    | coverage               |
| Days In Age | Calculated             |
| Stage       | currentProcessingStage |
| Next Action | nextProcessingStage    |

---

## Days In Age Calculation

```javascript
DaysInAge =
CurrentDate - createdAt
```

---

# 6. Vendor Onboarding Details Screen

## API

### Get Vendor Details

```http
GET /api/vendors/onboarding/{vendorId}
```

### Response Includes

* Vendor Details
* Processing Stages
* Confirmation Requirements
* Uploaded Documents
* Service Categories

---

# 7. Stage Workflow Engine

## Stage Status

### Completed

```text
All mandatory confirmations approved
```

### In Progress

```text
One or more mandatory confirmations pending
```

### Rejected

```text
One or more mandatory confirmations rejected
```

---

# 8. Document Upload Workflow

## Upload Document

```http
POST /api/vendors/onboarding/upload
```

### Request

```json
{
  "vendorId": "ObjectId",
  "vendorStageId": "VS001",
  "vendorConfirmationId": "VC001",
  "file": "multipart/form-data"
}
```

---

## Approve Document

```http
POST /api/vendors/onboarding/approve
```

### Request

```json
{
  "vendorId": "ObjectId",
  "vendorConfirmationId": "VC001",
  "comments": "Approved"
}
```

---

## Reject Document

```http
POST /api/vendors/onboarding/reject
```

### Request

```json
{
  "vendorId": "ObjectId",
  "vendorConfirmationId": "VC001",
  "comments": "Rejected due to missing information"
}
```

---

# 9. Service Category Approval

## Source Collection

```text
service_request_roles
```

## Logic

* Retrieve all active roles
* Preselect:

```text
vendor_details.serviceRequestRoleId
```

* Users may add or remove roles

---

# 10. Vendor Actions

## Approve Vendor

```http
POST /api/vendors/onboarding/final-approve
```

### Validation

All four onboarding stages must have:

```text
Status = Completed
```

---

## Suspend Vendor

```http
POST /api/vendors/onboarding/suspend
```

### Result

```json
{
  "vendorStatus": "Suspended"
}
```

---

## Disqualify Vendor

```http
POST /api/vendors/onboarding/disqualify
```

### Result

```json
{
  "vendorStatus": "Disqualified"
}
```

---

## 10.1 Pending Approval Screen — Q-AI Helper Panel Components

* `VendorOnboardingPendingApproval/index.tsx` — two-column layout; right column renders `VendorIntelligenceCard`
* `components/vendorOnboarding/VendorIntelligenceCard.tsx` — Q-AI Helper card, styled in `skin/css/custom.css` (`.vi-*` classes)
* Panel and findings-count badge: Info-blue-themed (2026-07-23 re-theme), replacing earlier purple styling
  * Findings-count badge color: `var(--color-info)`

---

# 11. Vendor Status Lifecycle

```text
Created
   ↓
In Progress
   ↓
Ready For Approval
   ↓
Approved
```

Alternative Paths:

```text
In Progress → Suspended

In Progress → Disqualified

Ready For Approval → Suspended

Ready For Approval → Disqualified
```

---

# 12. MongoDB Indexes

```javascript
db.vendor_details.createIndex({
  companyName: 1
});

db.vendor_details.createIndex({
  currentProcessingStage: 1
});

db.vendor_details.createIndex({
  nextProcessingStage: 1
});

db.vendor_details.createIndex({
  serviceRequestRoleId: 1
});

db.vendor_confirmation_documents.createIndex({
  vendorId: 1
});

db.vendor_confirmation_documents.createIndex({
  vendorStageId: 1
});
```

---

# 13. Security Requirements

* Authenticated users only.
* Role-based access control.
* Audit trail for uploads, approvals, and rejections.
* File upload validation.
* Virus scanning for uploaded documents.

---

# 14. Performance Requirements

* Vendor Search response time < 2 seconds.
* Pagination required for grids.
* Server-side filtering and sorting.
* Lazy loading for document history.

---

# 15. Acceptance Criteria

* Vendor Onboarding menu is available.
* Vendor Search grid loads successfully.
* Stage workflow is configurable.
* Documents can be uploaded.
* Documents can be approved or rejected.
* Service Categories are displayed correctly.
* Approve button is enabled only after all stages are completed.
* Vendor status transitions follow the configured workflow.
* Audit information is captured for all actions.
