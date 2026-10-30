# Functional Requirements Document (FRD)

## Feature: Vendor Self Registration and Onboarding

### Step 1: Vendor Sign Up and Request Creation

#### Login Screen Changes

-   Add a new link on the Login screen:
    -   **New Vendor? Sign Up to Join**

#### Create Account Screen

-   Click **Sign Up to Join** → new screen
-   Heading: **Create Account**

Fields:

-   Email (Mandatory)
-   Password (Mandatory)
-   Confirm Password (Mandatory)

Validation Rules:

-   Password must contain:
    -   At least 6 characters
    -   At least one numeric character
    -   At least one special character
-   Password and Confirm Password must match

#### Vendor Request Details

-   Below Create Account section: display all fields from **New Vendor Request** screen

Changes:

-   Remove **Email** and **Phone Number** from Company Details for this flow

Buttons:

-   Submit Request
-   Cancel

#### Visual Theme

-   Create Account screen: darker, more professional teal than Login screen's default
    -   Page background: deeper teal (`teal400`)
    -   "Sign In" link: deeper teal (`tealDark`)
    -   Buttons unchanged

#### Submit Behavior

On clicking **Submit Request**:

-   Display review/summary popup with all entered details
-   Closing popup → redirect to Login screen
-   Create new Vendor Request via existing workflow
-   Request must appear under **Vendor Onboarding \> Pending Approval**

### Database Changes

#### login_user Collection

-   Save Create Account info in `login_user` collection

Fields:

-   email
-   password (encrypted/hashed)
-   createdDate
-   status

#### login_user_access Collection

-   Create entry in `login_user_access` with:
    -   loginId = Vendor Login ID
    -   roleId = Vendor User Role ID from `login_role`

### Step 2: Vendor Login Experience

-   After registration: vendor logs in using Email and Password

#### Vendor Landing Page

-   After login: display same Vendor Details screen used in Vendor Onboarding (admin click-through view)

#### Upload Control Rules

-   Vendor Status = Pending Approval: disable all Upload buttons
-   Vendor Status = In Progress: enable Upload buttons
-   All other details remain visible in read-only mode

### Workflow

1.  Vendor clicks Sign Up
2.  Vendor creates account
3.  Vendor submits request
4.  Request appears in Pending Approval
5.  Vendor logs in, views details
6.  Uploads disabled while Pending Approval
7.  Status → In Progress: uploads enabled
