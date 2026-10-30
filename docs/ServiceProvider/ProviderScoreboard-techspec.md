# Tech Spec — Provider Scoreboard

**Module:** Service Provider
**Screen:** Provider Scoreboard
**Version:** 1.2
**Date:** July 2026

---

## 1. Component

`ServiceProviderAnalytics` — `sourceCode/apps/frontEnd/src/pages/ServiceProvider/ServiceProviderAnalytics/index.tsx`. Data from `useVendorSearch()`.

## 2. Data shape

- `groupedByCategory: Map<string, ProviderPpiRow[]>` — built from each active vendor's `serviceRequestRoleNames` (fallback: `serviceRequestRoleName`)
  - One row per (vendor, service type) pair
  - Vendor with N service types → appears in N groups
- `ProviderPpiRow.ppi` = `vendorRoleScorecard(companyName, roleName).aggregate` (`utils/kpiScoring.ts`)
  - Same computation/precision (`toFixed(2)`) as `VendorPerformanceMetrics`'s "View Performance" for this vendor+role
  - Screens never disagree on a provider's score for a given service
  - Each group sorted by `ppi` descending
- `filteredGroups` — groups filtered by search text
  - Matches group/category name, or narrows to matching providers within a group
  - Sorted alphabetically by category name

## 3. Revision (replaced prior implementation)

-   Previously:
    -   `ServiceProviderAnalytics` rendered a single AG Grid, one row per vendor
    -   `overallRatingMap` averaged `vendorRatingForRole` across **all** of that vendor's roles into one blended score
    -   Shown as a 5-star `StarCellRenderer`
-   Removed:
    -   `AgGridReact` + `ag-grid-community` styles/imports
    -   `VendorRow`
    -   `overallRatingMap`
    -   `StarCellRenderer`
    -   `EyeCellRenderer`
    -   `ProviderCellRenderer`
    -   `GridContext`
    -   `columnDefs`/`defaultColDef`
    -   Pagination (no longer applicable — content is grouped, not a flat paginated list)
-   Added:
    -   `ProviderPpiRow`
    -   `groupedByCategory`/`filteredGroups` memos
    -   `PpiBadge` component
    -   Collapsible group sections (`collapsedGroups` state)
    -   New CSS (`custom.css`): `.ppi-groups`, `.ppi-group(__header/__title/__count/__chevron/__body/__rows)`, `.ppi-row(--head)`, `.ppi-provider(__name/__legal)`, `.ppi-badge(--good/--fair/--low)`, `.ppi-view-btn`

## 4. Rating-source fix

-   `PpiBadge` renders only the numeric value, rounded to one decimal place, formatted as `"X.X/5"` — no "PPI" text per row
-   Group header row's middle column is labeled "Provider Performance Index" (the one and only place the full term appears)
-   `ppi` switched from `vendorRatingForRole` to `vendorRoleScorecard(...).aggregate` to match `VendorPerformanceMetrics`'s "View Performance" computation

## 5. Verified

-   `tsc --noEmit` clean
-   No existing tests for this page
-   Full frontend suite (444 tests) still passing — nothing else imports this page's internals
