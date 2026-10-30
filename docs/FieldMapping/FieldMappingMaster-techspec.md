# Technical Specification — Field Mapping

## Document Information

| Property | Value |
|-----------|---------|
| Module | Claims Management |
| Screen | Field Mapping |
| Frontend | Next.js |
| Backend | Node.js |
| API Layer | GraphQL |
| Database | MongoDB |
| Grid Framework | AG Grid Enterprise |
| Version | 1.0 |
| Date | May 2026 |

---

# 1. Architecture Overview

The Field Mapping module allows users to upload Excel files and configure mappings between source file fields and target system fields.

Components:
- Field Mapping Dashboard
- Upload File Service
- Uploaded Files Grid
- Field Mapping Details Screen
- Mapping Configuration Grid
- Template Download Service
- Audit Tracking

---

# 2. Frontend Design

## Pages

- Field Mapping Dashboard
- Field Mapping Details

## Components

- UploadFileModal
- DownloadTemplateButton
- UploadedFilesGrid
- UploadedRecordsGrid
- MappingConfigurationGrid
- HeaderCard
- ToastNotification

---

# 3. GraphQL APIs

## uploadFieldMappingFile

Input:
- file

Response:
- uploadId
- fileName
- totalRecords
- status

## getUploadedFiles

Returns:
- uploadId
- fileName
- uploadType
- totalRecords
- uploadedBy
- uploadDate
- status

## getFieldMappingDetails

Input:
- uploadId

Returns:
- uploaded file details
- uploaded records
- mapping configuration

## saveFieldMapping

Input:
- uploadId
- mappings

## downloadTemplate

Returns:
- template file

---

# 4. Backend Services

## fieldMapping.service.ts

Responsibilities:
- Upload processing
- Retrieve mappings
- Save mappings
- Audit logging

## excelParser.service.ts

Responsibilities:
- Read Excel files
- Extract headers
- Extract rows
- Validate structure

## templateGenerator.service.ts

Responsibilities:
- Generate Excel template
- Store header metadata

---

# 5. Database Collections

## field_mapping_upload

- uploadId
- fileName
- uploadType
- uploadedBy
- uploadDate
- totalRecords
- status
- headers

## field_mapping_records

- recordId
- uploadId
- recordData

## field_mapping_configuration

- mappingId
- uploadId
- sourceField
- targetField
- dataType
- isMandatory

## template_master

- templateId
- templateName
- excelHeaders
- createdBy
- createdDate

## field_mapping_audit

- auditId
- uploadId
- action
- performedBy
- performedDate

---

# 6. AG Grid Configuration

## Uploaded Files Grid

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
- Pagination
- Search
- Responsive Layout

## Uploaded Records Grid

Dynamic columns generated from uploaded Excel headers.

Features:
- Dynamic Columns
- Sorting
- Filtering
- Search
- Pagination
- Export Excel
- Export CSV

## Mapping Configuration Grid

Columns:
- Source Field
- Target Field
- Data Type
- Mandatory
- Action

Actions:
- Add
- Edit
- Save
- Cancel

---

# 7. Template Generation

Process:

1. User clicks Download Template.
2. System retrieves stored Excel headers.
3. Generate .xlsx file.
4. Return downloadable template.

---

# 8. Validation Rules

Upload Validation:
- File required
- Excel only (.xlsx, .xls)
- Empty file not allowed

Mapping Validation:
- Source Field required
- Target Field required
- Duplicate mappings not allowed

---

# 9. Security

- Authentication required
- Authorization required
- Audit logging enabled
- Input validation enabled

---

# 10. Error Codes

| Code | Description |
|--------|-------------|
| FM-001 | Invalid File Format |
| FM-002 | Empty File |
| FM-003 | Missing Headers |
| FM-004 | Duplicate Mapping |
| FM-005 | Validation Failed |
| FM-006 | Save Failed |
| FM-007 | Template Generation Failed |
| FM-008 | Database Error |

---

# 11. Performance

- Upload < 5 seconds
- Grid Load < 3 seconds
- Save Mapping < 3 seconds
- Template Download < 2 seconds

---

# 12. User Workflow

1. Upload Excel file.
2. Display uploaded file in AG Grid.
3. Click uploaded file.
4. Open Field Mapping Details screen.
5. View uploaded records.
6. Configure mappings.
7. Save mappings.
8. Download template.
