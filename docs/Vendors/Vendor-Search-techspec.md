# Technical Specification (Tech Spec) - Vendor Search Screen

## Project Information
- Project: Claims Triage Platform
- Database: claim_triage
- Collection: vendor_details

## Overview
The Vendor Search screen provides a centralized view of vendor records stored in the `vendor_details` collection. Users can search, filter, monitor compliance status, and navigate to vendor profiles.

## Data Source
### MongoDB Collection
`vendor_details`

### Fields
| Field | Description |
|---------|-------------|
| companyName | Vendor company name |
| emailId | Vendor email address |
| rating | Vendor rating |
| address | Vendor address |
| city | City |
| state | State |
| Status | Status |
| country | Country |
| phoneNumber | Contact number |
| turnaroundTime | Vendor turnaround time |
| serviceRequestRoleId | Reference to service_request_roles |
| serviceRequestRoleName | Service Request Role Name |
| createdBy | Record creator |
| createdAt | Creation timestamp |
| uploadedBy | Upload user |
| uploadedAt | Upload timestamp |

## Functional Requirements

### Vendor Search
- Display vendors from the `vendor_details` collection.
- Support vendor search by company name, service request role, city, state,Status, and country.
- Support Active and Suspended vendor filtering.
- Display requalification alerts.
- Allow navigation to Vendor Profile.

### Filters
#### Status Filters
- All
- Active
- Suspended

#### Search Filters
- Vendor Name
- Legal Entity
- Coverage Area
- Categories

## Navigation
- Sidebar → Vendors → Vendor Search
- Clicking a row opens Vendor Profile.

## Business Rules
1. Vendors are retrieved from the `vendor_details` collection.
2. `serviceRequestRoleId` is mapped to the `service_request_roles` collection.
3. Suspended vendors cannot receive new assignments.
4. Vendors due for requalification must be highlighted.
5. Search results should be filtered in real time.

## Acceptance Criteria
- User can search vendors.
- User can filter vendors by status.
- User can open vendor profiles.
- Vendor data is loaded from MongoDB collection `vendor_details`.
