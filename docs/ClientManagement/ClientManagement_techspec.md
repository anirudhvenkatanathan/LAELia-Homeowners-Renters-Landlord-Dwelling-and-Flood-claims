# Function Specification

## Feature: Client Management for Active Vendor Login

### Scope

Update **only** the **Active Vendor Login → My Performance** area. Do
**not** modify any other existing screen.

### Requirements

1.  Rename Screen

-   Replace the page title **"My Performance"** with **"Client
    Management"**.
-   Update this value in the **database only**.
-   **Do not** modify the seed data.

2.  Client Management UI

-   Redesign the Client Management screen to match the provided
    reference layout.
-   Display a table with:
    -   Client
    -   Active
    -   Completed
    -   Total
    -   View action

3.  View Action

-   When the user clicks **View** for a client, display the **existing
    My Performance** screen.
-   Reuse the current My Performance UI and functionality.

4.  Aggregate Metrics

-   On the Client Management screen, metrics must be calculated **per
    client** (aggregate values).
-   Aggregate values should include existing metrics such as:
    -   Score
    -   Weightage
    -   Other current performance metrics
-   Do not display metrics for a single vendor on the Client Management
    screen.

5.  Existing Screens

-   Do not change or modify any other existing screen.
-   Existing My Performance behavior should remain unchanged when
    accessed through View.

## Acceptance Criteria

-   Client Management replaces My Performance only for Active Vendor
    login.
-   Layout matches the provided design.
-   View opens the existing My Performance page.
-   Metrics shown against each client are aggregated.
-   Title update is stored in the database only.
-   No seed data changes.
-   No impact on other modules or screens.
