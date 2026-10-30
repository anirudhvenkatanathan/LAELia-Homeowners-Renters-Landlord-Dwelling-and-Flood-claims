# Functional Specification — Field Mapping

**Module:** Claims Management
**Screen:** Field Mapping
**Version:** 1.0
**Date:** May 2026

## 1. Overview

The Field Mapping screen allows users to upload source files and configure field mappings between uploaded file fields and target system fields.

The screen should follow the same design pattern, layout, theme, responsiveness,upload and download popup, and user experience as the Claim Intake screen.

Users can upload Excel files. After upload, the uploaded file records will be displayed in an AG Grid. Selecting a record from the AG Grid will navigate the user to the Field Mapping Details screen where the uploaded file contents can be viewed and managed.

The downloadable template pick from local system. 

## 2. Navigation

- Menu Name: Field Mapping
- Navigation Path: Claims → Field Mapping

---
## 3. Upload Field Mapping

Supported Upload Types:
- Excel (.xlsx, .xls)

Requirements:
- File Upload Only
- No Copy/Paste
- Upload Button
- Cancel Button


## Download Template

- Download Template button.
- Excel values stored in database.

---

## 4. Uploaded Mapping Files Grid

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
- Responsive Design

## 5. Field Mapping Details Screen

When a user clicks a record from the Uploaded Mapping Files Grid:

- Navigate to a separate screen.
- Display all records contained within the uploaded file.
- Display records in an editable AG Grid.

Header Information:
- Upload ID
- File Name
- Upload Type
- Uploaded By
- Upload Date
- Status
- Total Records

## 6. Grid Actions

Available Actions:
- Add
- Edit
- Save
- Cancel

Users should be able to:
- Add new mapping rows
- Edit existing mappings
- Save changes
- Cancel unsaved changes

## 7. Validation Rules

- File is required.
- Unsupported file types are rejected.
- Source Field is required.
- Target Field is required.
- Duplicate mappings are not allowed.

## 8. Success & Error Handling

- Upload Success
- Upload Failure
- Validation Errors
- Save Success
- Save Failure

## 9. Audit Information

Store:
- Upload ID
- File Name
- Upload Type
- Uploaded By
- Upload Date
- Mapping Changes
- Saved By
- Saved Date
