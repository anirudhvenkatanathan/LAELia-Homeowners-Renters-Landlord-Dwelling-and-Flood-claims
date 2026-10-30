# Technical Specification — Claim Intake

## Document Information

| Property | Value |
|-----------|---------|
| Module | Claims Management |
| Screen | Claim Intake |
| Frontend | Next.js |
| Backend | Node.js |
| API Layer | GraphQL |
| Database | MongoDB |
| Version | 2.5 |
| Date | July 2026 |

---

# 1. Architecture Overview

- Claim Intake module enables users to upload claim data through:
  - Excel File (.xlsx, .xls)
  - JSON Payload
  - XML Data
- Uploaded data validated, processed, stored in MongoDB
- Displayed in the Uploaded Claims Grid
- Users can review uploaded records and view detailed claim information

---

# 1.1 Role-Based Module Title (UI-only) — Implementation

**Requirement:**
- When logged in as **Claims Adjuster**: "Claims Orchestrator" module should display as **"Claims Command Center"** in:
  - Page header
  - Subtitle
  - Sidebar nav
  - Browser tab title
- For every other role: keep "Claims Orchestrator"
- Route, API, and DB unchanged

**Files touched:**

- `sourceCode/apps/frontEnd/src/pages/ClaimIntake/claimIntakeMaster/index.tsx`
  - Added `const isClaimsAdjuster = user?.roleName === 'Claims Adjuster';` (via `useAuth()`)
  - Added `pageTitle` variable (`'Claims Command Center'` vs `'Claims Orchestrator'`)
    - Used for both the `<h1 className="page-title">` and the subtitle (`Upload and review {pageTitle} records`)
    - Replaces the two hardcoded strings
  - `useEffect` sets `document.title = 'Claims Command Center'` only when `isClaimsAdjuster` is true
    - Restores whatever `document.title` was beforehand on unmount/role-change
    - Other roles and other screens never see a title change
- `sourceCode/apps/frontEnd/src/components/layout/Sidebar.tsx`
  - Nav label comes from MongoDB via `useMenu()` (label "Claims Orchestrator", path `/claim-intake`, seeded in `apps/api/scripts/seedMenu.ts`)
  - DB/route must stay untouched — override happens at render time instead
  - New `resolveNavLabel(item, isClaimsAdjuster)` helper checks `item.path === '/claim-intake'` and substitutes `'Claims Command Center'` for Claims Adjusters only
  - `isClaimsAdjuster` (`user?.roleName === 'Claims Adjuster'`) computed once in `Sidebar`
  - Threaded through as a prop to `NavGroup`, `NavSubGroup`, and `TopLevelLink` (all three label-rendering call sites, including collapsed-icon `title` tooltips)
    - DB item could render via any of them
- No breadcrumb exists anywhere in this app
  - `AGENTS.md`: "Do NOT add breadcrumbs to any screen"
  - Nothing to update
- `ActiveVendorShell.tsx` / `VendorPortalShell.tsx` (the vendor-facing shells)
  - Don't reference this module at all — confirmed via grep
  - Nothing to change

**Tests:** `claimIntakeMaster.test.tsx`
- Gained a `vi.mock` for `AuthContext`'s `useAuth` (default `{ user: null }`, matching the unauthenticated-context behavior the existing title/subtitle tests already relied on)
- Two new tests:
  - Asserts "Claims Command Center" renders (and `document.title` matches) when `user.roleName === 'Claims Adjuster'`
  - Asserts "Claims Orchestrator" still renders for another role (`'Admin'`)

**Verified:**
- `tsc --noEmit` clean
- Full suite 446/446 passing (444 pre-existing + 2 new)
- Playwright end-to-end pass:
  - Logged in via Quick Login as Claims Adjuster: page header, subtitle, sidebar label, and `document.title` all show "Claims Command Center"
  - As Admin on the same `/claim-intake` route: all four show "Claims Orchestrator" / the default static app title
  - No console errors from the app itself

---

# 1.2 List View + Kanban Toggle — Implementation

**Requirement:**
- Add a second, modern List View alongside the existing Kanban/Swimlane view
- Toggle to switch between them without a reload
- Session-scoped view memory
- Teal/LAElia-consistent look
- No backend/DB/route changes

**File touched:** `sourceCode/apps/frontEnd/src/pages/ClaimIntake/claimIntakeMaster/index.tsx`
- No new page files — one screen with two render branches, not two separate routes

**View mode state**
```ts
type ViewMode = 'kanban' | 'list';
const VIEW_MODE_KEY = 'cim-view-mode'; // sessionStorage — session-only, not localStorage
```
- `getInitialViewMode()` reads `sessionStorage.getItem(VIEW_MODE_KEY)` at mount
  - Defaults to `'kanban'` if unset or if `sessionStorage` throws (e.g. in a locked-down browser context)
- `handleViewModeChange` updates state and writes back to `sessionStorage` in the same call
  - No debounce needed — only fires on an explicit toggle click

**Shared filtering**
- `stageFilter` (new state, driven by the status filter pills) and the pre-existing `quickFilter` (search text) combined into one `filteredRecords` `useMemo` that both views consume
- `boardColumns` (Kanban) groups `filteredRecords` by `stageKey(planServiceStatus)`
- AG Grid's `rowData` is `filteredRecords` directly
  - No separate quick-filter mechanism inside the grid
  - One filtered array feeds both views
  - Behavior identical regardless of which view is active when a filter changes

**List View grid** — follows the AG Grid convention used elsewhere in this app (e.g. `pages/Vendor/VendorSearch/index.tsx`):
- `ColDef[]` with `sortable: true` per column
- `defaultColDef = { resizable: true }`
- `onRowClicked` navigating to `/claim-intake/details/:uploadId` (same handler the Kanban `BoardCard` already used)
- `ag-theme-alpine cim-ag-grid` wrapper class
  - `.cim-ag-grid` CSS rule pre-dates this change, unused until now
- Pagination (`paginationPageSize={10}`, size selector `[10, 20, 50]`)
- Two cell renderers:
  - `ClaimNumberCellRenderer` — blue link styling, matching the Kanban card's claim-number color
  - `StatusCellRenderer` — colored pill using the exact same `STAGE_COLUMNS` / `OTHER_COLUMN` palette (`fill`/`header`) the Kanban column headers use, via a shared `columnFor()` helper
    - Status coloring visually identical between the two views

**New CSS** (`sourceCode/skin/css/custom.css`, appended after the existing `.cim-ag-grid`
rules):
- `.cim-status-badge` — pill shape for the List View's Status cell (colors applied inline
  per-row from `STAGE_COLUMNS`, not hardcoded in CSS).
- `.cim-view-toggle` / `.cim-view-toggle__btn` / `.cim-view-toggle__btn--active` — the
  List/Kanban segmented-control toggle
  - Active state uses `var(--color-primary)`
  - Automatically tracks the brand primary color (teal, post-2026-07-23 rebrand)

**Reused, no new CSS needed:**
- `.dash-metric-row` / `.dash-metric-card*` (from the Dashboard's KPI tiles) for the four
  stat tiles — same classes, same responsive breakpoints (4-col → 3-col at 1200px → 2-col at
  700px), just plain markup here (no visibility-toggle checkbox, that's Dashboard-specific).
- `.vs-filter-pills` / `.vs-filter-pill` / `.vs-filter-pill--active` (from `VendorSearch`) for
  the status filter pills — already teal via `var(--color-primary)`
  - Applied `style={{ margin: 0 }}` inline on our usage to cancel that component's own
    `margin: 20px`
  - That default was tuned for `VendorSearch`'s standalone layout, not this shared toolbar row
- `.cim-search-bar` (used by this page and `VendorSearch`) — unchanged, shared
  by both view modes as the single search input.

**Sidebar / branding:** re-verified, not re-implemented
- Shared `LaeliaLogo` component and the app-wide brand theme (sidebar, `--color-primary` — teal post-rebrand) from earlier work apply here
  - This page renders inside the same `AppShell` → `Sidebar`
- No changes needed for this request's branding-consistency bullets
- Confirmed via screenshot

**Tests:** `claimIntakeMaster.test.tsx`
- Fixed two pre-existing assertions that became ambiguous (`getByText('Completed')` etc. now also matches a filter pill, not just the Kanban column header) by switching to `getAllByText(...).length > 0`
- Added `beforeEach`/`afterEach` `sessionStorage.clear()`
- Two new tests:
  - View toggle switches between Kanban/List (asserting `aria-pressed` and the `sessionStorage` write)
  - Clicking a status filter pill narrows the visible claims in both the count and the rendered rows

**Verified:**
- `tsc --noEmit` clean
- Full suite 448/448 passing (446 prior + 2 new)
- Playwright pass logged in as Claims Adjuster:
  - Kanban view (default at the time)
  - List view (via toggle, sortable columns, colored status badges, pagination)
  - Status-filter-pill narrowing
  - 390px mobile viewport (stat tiles 2-up, pills wrap, table scrolls horizontally) all render correctly
- No AG Grid or jsdom issues encountered in tests, despite this being the first test file in the repo to mount a real `AgGridReact` grid

### Follow-up: drop the value tile, default to List View

Two small corrections:
- `getInitialViewMode()` now returns `'list'` unless `sessionStorage.getItem('cim-view-mode') === 'kanban'` (inverted from the original default-Kanban-unless-'list' logic)
  - List is now the landing view on a fresh session
  - Kanban remains one click away via the toggle, still remembered per-session either way
- Fourth stat tile ("Total Claim Value", summed `claimAmount` formatted as currency) removed
  - Leaving 3 tiles in the shared `.dash-metric-row`'s 4-column desktop grid would look unbalanced/incomplete
  - Replaced with a **Completed** tile (`stats.completed`, already computed for the Kanban "Completed" column count)
  - Keeps the tile row a full, symmetric set of the four claim statuses
  - Now-unused `totalValue` reduction in the `stats` `useMemo` removed too (`formatCurrency` is still used by the List View's `AmountCellRenderer`, so it stays)

**Tests:**
- Toggle test (`'defaults to Kanban view and switches to List view...'`) renamed and inverted (`'defaults to List view and switches to Kanban view...'`) to match the new default
- Asserts `aria-pressed` starts `true` on List / `false` on Kanban
- Asserts clicking Kanban flips both the `aria-pressed` state and the `sessionStorage` value

**Verified:**
- `tsc --noEmit` clean
- Full suite still 448/448
- Fresh (no `sessionStorage`) Playwright load of `/claim-intake` confirms:
  - List toggle reads `aria-pressed="true"` on first render, table visible immediately
  - Fourth tile now reads "Completed" instead of a dollar amount

---

# 2. Frontend Design (Next.js)

## Components

- ClaimIntakePage
- UploadTypeSelector
- ExcelUploader
- JsonEditor
- XmlEditor
- UploadButton
- UploadedClaimsGrid (replaced — see §15)
- UploadedClaimDetailsModal
- ClaimIntakeDetails (Claim Orchestrator claim details screen — `claimIntakeDetails/index.tsx`)

## Folder Structure

/pages/claims/intake
/components/claims/intake
/services/claims/intake
/graphql/claims/intake

---

# 3. GraphQL APIs

## Mutation: uploadClaim

### Inputs

- uploadType
- uploadedFile
- jsonPayload
- xmlPayload

### Response

- uploadId
- claimNumber
- status
- validationResult
- message

---

## Query: uploadedClaims

### Returns

- uploadId
- fileName
- uploadType
- claimNumber
- uploadedBy
- uploadDate
- status

---

## Query: uploadedClaimDetails

### Input

- uploadId

### Returns

- upload information
- claim information
- payload information
- validation results
- processing messages

---

# 4. Backend Design (Node.js)

## Services

### claimIntake.service.ts

Responsibilities:

- Upload processing
- Claim creation
- Validation orchestration
- Grid retrieval

### excelParser.service.ts

Responsibilities:

- Parse Excel files
- Validate required columns
- Extract claim data

### jsonValidator.service.ts

Responsibilities:

- Validate JSON structure
- Validate required claim attributes

### xmlValidator.service.ts

Responsibilities:

- Validate XML structure
- Extract claim data from XML

### claimDetails.service.ts

Responsibilities:

- Retrieve uploaded claim details
- Return claim payload information

---

# 5. MongoDB Collections

## claim_intake

Fields:

- uploadId
- fileName
- uploadType
- claimNumber
- uploadedBy
- uploadDate
- status
- payload
- validationResults
- processingMessages
- createdAt
- updatedAt

---

## claim_intake_audit

Fields:

- uploadId
- action
- user
- timestamp
- status
- remarks

---

# 6. Validation Rules

## Excel Upload

- File must be .xlsx or .xls
- File cannot be empty
- Required columns must exist
- Maximum file size validation

## JSON Upload

- Must be valid JSON
- Required fields validation
- Payload cannot be empty

## XML Upload

- Must be valid XML
- Required nodes validation
- Payload cannot be empty

---

# 7. Security

- Authentication required
- Authorization required
- Audit logging enabled
- Maximum upload size: 10 MB
- Allowed file types: xlsx, xls, json, xml

---

# 8. Error Codes

| Code | Description |
|------|-------------|
| CI-001 | Invalid file format |
| CI-002 | Empty upload |
| CI-003 | Missing required columns |
| CI-004 | Invalid JSON |
| CI-005 | Invalid XML |
| CI-006 | Validation failure |
| CI-007 | Database error |
| CI-008 | Upload processing failure |

---

# 9. Performance

- Upload Response < 5 Seconds
- Grid Load < 3 Seconds
- Claim Details Load < 2 Seconds

---

# 10. Required Packages

graphql
apollo-server
mongoose
graphql-upload
xlsx
xml2js
joi
uuid

---

# 11. Processing Workflow

1. User selects Upload Type
2. User uploads Excel file or enters JSON/XML payload
3. User clicks Upload Claim
4. System validates input
5. System parses claim data
6. System stores claim intake record
7. Record appears in Uploaded Claims Grid
8. User selects a record
9. System loads Uploaded Claim Details
10. Claim details displayed in read-only mode

---

# 12. Claim Details Screen — Tabs

`ClaimIntakeDetails` (`claimIntakeDetails/index.tsx`), tab bar `cid-ref-tabs`.

| Tab | State |
|---|---|
| Service | Active, only tab |

## Removed: Metrics Tab

- Removed from `TABS`/`Tab` type.
- Removed state: `kpiGroups`, `kpiLoading`, `kpiError`, `collapsedServices`.
- Removed KPI-fetch `useEffect` and `setActiveTab('Metrics')` in `handleCompleteClaim`.
- Removed Metrics icon + tab body.
- `fetchKpiMetricsForClaim`/`KpiGroup` kept (used by `VendorPerformanceMetrics.tsx`).

---

# 13. Removed: Plan/Vendor Selection Modals

- Dead code: `PlanServicesModal`, `VendorServicesModal`
  - Never opened (`openPsModal`/`openVsModal` unused)

Removed:

- `PlanServicesModal`, `VendorServicesModal`, `PSModalProps`/`VSModalProps`.
- `MultiSelect`/`MSProps` (only used by these modals).
- State: `psModal`, `psRecord`, `vsModal`, `vsRecord`.
- `openPsModal`, `openVsModal`, related `setPsModal`/`setVsModal` calls.
- Their render calls.

- Kept: `savePlan`, `saveVendors`, `psSaving`/`psError`, `vsSaving`/`vsError` (used by combined confirm + error banner)
- Live flow: **Select Services & Vendors** card (`cid-vendors-card`)
  - Loads roles + suggested vendors
  - Toggle extra services/vendors
  - Finalize in one click (see §14)
- Verified: `tsc --noEmit` clean, 5/5 tests passing

---

# 14. One-Click Combined Confirm (Services + Vendors)

- Removed the two-step confirm flow
- Single action now covers both

## Removed

- `showPlanButton`/`showVendorButton` and their 2 buttons ("Confirm Services", "Confirm Service Provider")
- Gate `isActive && isPlanConfirmed` on the vendor sub-section
  - Now just `isActive`
  - Vendor picking shows immediately alongside service selection, not after a separate confirm

## Added

- `showConfirmButton = !isVendorConfirmed || hasPendingPlanChanges`.
- `confirmServiceProviderSelection()` — awaits `confirmPlanSelection()` then `confirmVendorSelection()`.
- Single button "Confirm Service Provider Selection", disabled when no active roles, no vendor picked, or saving.

## Fixed

- `saveVendors` bug: sent `record.planServices` (stale until a re-render) to `saveVendorServices`
- Fix: now computes `planServiceIds` fresh from `activeServiceRoles` + `allRoles`
- Result: combined action is correct even though both saves fire in the same click

## Status flow

- `planServiceStatus` still passes through `Pending Service Provider Selection` → `Service Provider Finalized` internally (set by `savePlan` then `saveVendors`)
- Both happen within one click — no separate visible step
- `Complete` claim remains gated on `isVendorConfirmed`

## Accept button styling

- New CSS class `.btn--accept` (green, `sourceCode/skin/css/custom.css`) added alongside `.btn--primary`
- Applied to the three accept/confirm actions on this screen in place of `btn--primary`:
  - **Confirm Service Provider Selection** (main action bar)
  - **Confirm switch** (`VendorSwitchModal`)
  - **Save Change** (`ReasonModal`)
- `.btn--complete` (Mark claim as completed) was already green and is unchanged

## Fixed (§20 follow-up) — Combined confirm sometimes required a second click

- Bug: `confirmPlanSelection()` fired an un-awaited `refresh()` right after `savePlan()`
  - In the combined one-click flow, `confirmVendorSelection()` (and its `saveVendorServices` call) runs immediately afterward
  - Stray `refresh()` still in flight — a comparatively heavy `uploadedClaimDetails` query (role/vendor resolution for every record) — racing the lighter vendor save
  - Whichever response landed last won:
    - `refresh()`'s snapshot is necessarily stale — reads the DB before the vendor write lands
    - If it arrived after the vendor save's own local `setLocalRecords` update, it silently overwrote the finalized status back down to `'Pending Service Provider Selection'`
    - User had to click Confirm a second time to get the claim to finalize (or move to `Pending Review`)

- Fix: removed the `refresh()` call from `confirmPlanSelection()` (it has no other caller — see §20)
  - Added a single `await refresh()` at the end of `confirmServiceProviderSelection()`, after both `confirmPlanSelection()` and `confirmVendorSelection()` have completed
  - Server now only ever queried once both writes have landed
  - Refreshed snapshot can't reflect the transient in-between state

---

# 15. Hide Vendor Rating for Claims Adjuster

`useAuth()` → `user.roleName`. `hideVendorRating = user?.roleName === 'Claims Adjuster'`.

Gated with `!hideVendorRating &&`:

- Recommended/Confirmed Service Provider label's `(Rating: N.N)` text.
- Dropdown trigger stars + numeric rating.
- Dropdown list item stars + numeric rating.
- `cid-vdrop__eye` button (opens the KPI/matching-breakdown popup) — hiding it also prevents `scorePopup` from ever being set
  - Breakdown popup itself never renders for this role

Not hidden: "Best Fit"/"Fit #N" labels (rank only, no numeric rating shown).

---

# 16. Claims Orchestrator — Swimlane Board

## Overview

- `ClaimIntakeMaster` (`claimIntakeMaster/index.tsx`) renders claims as a read-only Kanban-style board instead of a data grid

## Data Source

- Same `claim_intake` collection as §5, grouped client-side by `planServiceStatus`

## Columns

| Column | Matches Status |
|---|---|
| Pending Selection | Pending Service Selection, Pending Service Provider Selection |
| Service Provider Finalized | Service Provider Finalized |
| Pending Review | Pending Review (§20 — vendor override awaiting Claims Supervisor approval) |
| Completed | Completed |
| Other | Any status not listed above (shown only if present) |

## Card Fields

- Claim Number, Claim Type, Insured Name, Policy Number, Loss Date, Claim Amount

## Business Rules

1. Claims grouped into columns by pipeline status
2. Cards cannot be dragged between columns
3. Click a card to navigate to Claim Details
4. Search bar filters by claim number, insured name, or policy number before grouping into columns
5. "Other" column only appears when a claim's status doesn't match a known stage
6. Each column height-capped to roughly 10 cards
   - Beyond that, the card list scrolls within the column instead of expanding the page

## Verified

- `tsc --noEmit` clean
- 48/48 tests passing in `claimIntakeMaster.test.tsx`

---

# 17. App Navigation — Sidebar Footer (Shared Layout)

- Applies to the shared `AppShell` layout (sidebar + header), used across all admin screens

## Components

- `AppShell` — renders `Sidebar` + `Topbar` + page content.
- `Sidebar` — nav menu, now also owns the Logout action.
- `Topbar` — thin header; no longer has a Logout button.

## Sidebar Footer

Pinned below the nav items:

| Element | Content |
|---|---|
| Avatar | User's initials, derived from role name (fallback: username) |
| Name | Role name (fallback: username) |
| Email | Logged-in user's email, if available |
| Logout | Confirm dialog → clear session → redirect to Login |

## Business Rules

1. Logout lives only in the sidebar footer, not the header
2. When the sidebar is collapsed, only the avatar is shown

## Verified

- `tsc --noEmit` clean across the whole frontend

---

# 18. Fix: Duplicate Bullet on "Services Enabled" Rows

- Bug: each row in the Services Enabled list previously showed two markers
  - Shared list bullet
  - Plus a per-service colored indicator dot

## Fix

- Shared list bullet suppressed for Services Enabled rows only
  - Leaves just the one colored indicator dot per service
- Claims Summary and Signals rows unaffected — they keep their single shared bullet

---

# 19. Sidebar: Removed "Main" / "Admin" Group Headers

## Data model

- `scripts/seedMenu.ts` — removed the `menu-group-main` and `menu-admin-group` menu item records
  - Added to `removedMenuIds` so the seed script deletes them from `MenuItemModel` on next run
  - Former direct children re-parented to `parentId: null`:
    - `menu-dashboard-001`, `menu-claim-intake-001`, `menu-field-mapping-001` — now plain top-level items (no group header)
    - `menu-admin-vendor-group` ("Service Provider") — now a top-level group in its own right, keeping its own section header and children unchanged
- `menu-admin-services-group` ("AI Foundation") wrapper group has since been dissolved as well
  - Its record removed entirely from `menuItems`
  - Its two children re-parented individually instead of staying grouped together:
    - `menu-service-request-role-001` ("Claims Orchestration Engine") — `parentId: null`, now a plain top-level sidebar item; `sortOrder` set to `3` (after Field Mapping)
    - `menu-admin-analytics-insight-001` ("Service Provider Benchmarking") — `parentId: 'menu-admin-vendor-group'`, now nested under "Service Provider" instead of its own group
- No frontend code change needed
  - `Sidebar.tsx`'s tree-builder already renders any root item with children as a labeled group and any root item without children as a plain link
  - Removing the wrapper records is sufficient

---

# 20. Vendor Override Approval Workflow

**Requirement:**
- When an adjuster-type role (Claims Adjuster / Senior Adjuster / Junior Adjuster) selects a service provider other than the Rule Engine's recommended (top-rated) vendor for a role: claim must move to a `Pending Review` status that only a Claims Supervisor can complete
- If the selected vendor matches the recommendation: behavior unchanged

**Files touched:**

- `apps/api/graphQL/loginEntity.ts`
  - Exported `requireSupervisor(token)` (was module-private) so it can be reused outside this file
  - No behavior change to existing callers
- `apps/api/graphQL/claimIntakeEntity.ts`
  - `IClaimRecord` / `ClaimRecordSchema`: added `vendorOverrideBy: string` and `vendorOverrideDetails: { roleName, recommendedVendor, selectedVendor }[]`
  - typeDefs:
    - Added `VendorOverrideDetail` type + `VendorOverrideDetailInput` input
    - Added both new fields to `ClaimRecord`
    - Added `requiresReview`, `overrideDetails`, `changedBy` args to `saveVendorServices`
    - Added `token` arg to `completeClaim`
  - `Mutation.saveVendorServices`:
    - Looks up the existing record first
    - `nextStatus` is `'Pending Review'` when `requiresReview` is true
    - Otherwise stays `'Pending Review'` if the claim is already there (sticky — a Supervisor re-saving the vendor selection must not silently finalize it)
    - Otherwise `'Service Provider Finalized'` as before
    - When `requiresReview`: persists `vendorOverrideDetails`/`vendorOverrideBy`
  - `Mutation.completeClaim`:
    - Looks up the existing record first
    - If its `planServiceStatus === 'Pending Review'`: calls `requireSupervisor(args.token ?? '')` and rejects with `{ success: false, message: '...' }` if the caller isn't a Claims Supervisor
    - First server-side authorization check on this mutation — all other claims complete as before
  - `Query.getAllClaimRecords` / `Query.uploadedClaimDetails`: both now include `vendorOverrideBy`/`vendorOverrideDetails` in the mapped response
- `apps/frontEnd/src/models/claimIntakeMaster/claimIntakeModel.ts` — added `vendorOverrideBy?`/`vendorOverrideDetails?` to `IndividualClaimRecord`
- `apps/frontEnd/src/services/claimIntakeMaster/claimIntakeService.ts`
  - Added the new fields to `UPLOADED_CLAIM_DETAILS_QUERY`/`GET_ALL_CLAIM_RECORDS_QUERY`
  - Extended `saveVendorServices()`/`SAVE_VENDOR_SERVICES_MUTATION` with `requiresReview`/`overrideDetails`/`changedBy`
  - Extended `completeClaim()` with `token`
- `apps/frontEnd/src/pages/ClaimIntake/claimIntakeDetails/index.tsx`
  - `useAuth()` now also destructures `token`
  - New `getRecommendedVendor(role)` helper (top-rated vendor for a role, same ranking as the existing recommended-vendor label)
  - `confirmVendorSelection`:
    - For adjuster-type roles (`isAdjusterTypeRole`), diffs `roleVendorMap[role]` against `getRecommendedVendor(role)` for every active role to build `overrideDetails`/`requiresReview`, passed through `saveVendors` → `saveVendorServices`
    - A Claims Supervisor's own vendor changes never compute an override
  - `saveVendors`: accepts the override info, sets local `planServiceStatus` to `'Pending Review'` (sticky, same rule as the backend), stores `vendorOverrideBy`/`vendorOverrideDetails` locally when applicable
  - New derived flags `isPendingReview`, `isSupervisor`, `canCompleteClaim`
    - Complete button now renders on `canCompleteClaim` instead of `isVendorConfirmed && !isClaimCompleted`
    - Hides it from adjuster-type roles while `Pending Review`, shows it to a Claims Supervisor
  - New derived flag `isConfirmLockedForReview` (`isPendingReview && isAdjusterTypeRole(user?.roleName)`)
    - Added to the "Confirm Service Provider Selection" button's existing `disabled` expression
    - Plus a `title` tooltip ("Awaiting Claims Supervisor review") when locked
    - A Claims Supervisor is unaffected — the button (and vendor dropdown) stays usable so they can change the vendor before completing (FR-003)
  - `handleCompleteClaim` now sends the real logged-in user (`user?.fullName || user?.username`) as `completedBy` and the session `token`, instead of a hardcoded `'admin'` string
  - `planStatusBadgeCls`: `'pending review'` now maps to `badge-orange` (checked ahead of the generic `'pending'` fallthrough that would otherwise give it the same yellow as the two selection-pending statuses)
  - Added an "Overridden by {name}" note next to the recommended-vendor label when `planServiceStatus === 'Pending Review'`
  - Added a second "Pending Review" badge (`badge badge-orange`) directly next to the "Select Services & Vendors" card title (in addition to the existing Claim Snapshot header badge), rendered when `isPendingReview`
    - Flag visible right where the vendor was overridden, not just at the top of the page
- `apps/frontEnd/src/pages/ClaimIntake/claimIntakeMaster/index.tsx` — added a `'pending-review'` entry to `STAGE_COLUMNS` (between `service-provider-finalized` and `completed`) so the Kanban board and status pills pick it up automatically via the existing `stageKey()`/`columnFor()` logic

**Tests:** extended `claimIntakeMaster.test.tsx`'s swimlane-board test
- With a `'Pending Review'` record
- Assertion the new column renders

**Verified:**
- `tsc --noEmit` clean on both `apps/frontEnd` and `apps/api`
- Backend `jest` suite 20/20 passing (unchanged)
- Frontend `vitest` suite 450/452 passing
  - 2 failures (`renders the page subtitle`, `shows "Claims Command Center" as the title for the Claims Adjuster role`) pre-exist on `main`, unrelated to this feature (page-title/subtitle text assertions, no code in this change touches that path)
- No new backend resolver test harness exists in this repo yet (`apps/api` has one unrelated `jest` suite)
  - `saveVendorServices`/`completeClaim` gating verified by type-checking + code review rather than an automated resolver test
  - Recommend manually exercising the flow described in the FRD before shipping

## Backend bootstrap fix

- Bug: `server.ts` had a `seedKpiMenu()` function that ran on every server boot and, if `menu-admin-kpi-metrics` was ever missing, would recreate `menu-admin-group` (hardcoded, with a stale label/path/parentId that no longer match `seedMenu.ts`)
- Fix: removed this function and its call in `bootstrap()`
  - `seedMenu.ts` is the authoritative seed source for this item now
  - Leaving `seedKpiMenu()` in place risked silently resurrecting the just-removed "Admin" group on a future restart

## Data reconciliation (live DB vs. seed script)

- User shared a MongoDB export showing 3 further drifted fields between the live `triage_menu` collection and `seedMenu.ts` (unrelated to Main/Admin)
- Reconciled `seedMenu.ts` to match, correcting 2 real path bugs found in the process:

| id | Fixed to |
|---|---|
| `menu-admin-kpi-metrics` | Path corrected `/admin/kpi-matrics` → `/service-provider-analytics` (was pointing at the wrong page — `/admin/kpi-matrics` is the separate KPI-threshold config screen, not "Provider Scoreboard"). Label stays "Provider Scoreboard". |
| `menu-admin-analytics-insight-001` | Icon `analytics` → `vendor`, path `/analytics-insight` → `/admin/kpi-matrics`, to match "Service Provider Benchmarking"'s actual live destination. |
| `menu-active-vendor-performance` | Label `My Performance` → `Client Management`, path `/vendor/active` → `/vendor/active/clients`. |

## Verified

- Ran `scripts/seedMenu.ts` against the live MongoDB (`claim_triage.triage_menus`)
  - Note: Mongoose auto-pluralizes the `triage_menu` model name declared in `menuEntity.ts`, so the real collection is `triage_menus`, not `triage_menu`
- Queried it directly afterward: 19 documents, `menu-group-main`/`menu-admin-group` absent, all fields match the table above
- `tsc --noEmit` clean on both frontend and API
- API `jest` suite: 20/20 passing

---

# 21. Role-Based Status Display (Claims Command Center)

- FRD §13
- UI-only label swap + display-order change on `claimIntakeMaster/index.tsx`
- Plus a claim-wide read-only lockdown for adjuster-type roles on `claimIntakeDetails/index.tsx`
- Unchanged:
  - `planServiceStatus === 'Pending Review'` in MongoDB
  - `stageKey()`/`columnFor()`
  - The `serviceVendorReview[]`-based per-service workflow (FRD §12, built in an earlier pass — see `saveVendorServices`/`reviewServiceVendor` in `apps/api/graphQL/claimIntakeEntity.ts`)

**`apps/frontEnd/src/pages/ClaimIntake/claimIntakeMaster/index.tsx`:**

- Imported `isAdjusterTypeRole` from `utils/permissions.ts`; `const isAdjuster = isAdjusterTypeRole(user?.roleName)` in the main component
- New module-level `displayLabel(column: BoardColumn, isAdjuster: boolean): string`
  - Returns `'Pending Supervisor Approval'` when `column.key === 'pending-review' && isAdjuster`, else `column.label`
  - Applied everywhere a `BoardColumn.label` renders:
    - Status filter pills
    - Kanban swimlane header
    - List view status badge, via a new `context={{ isAdjuster }}` prop on `<AgGridReact>`, read as `params.context.isAdjuster` inside `StatusCellRenderer`
  - `StatusCellRenderer` is a module-level component with no closure over the parent's state
  - Grid `context` — not a prop — is how it learns the viewer's role
- `ClaimSummaryDrawer` gained an `isAdjuster: boolean` prop (passed from the main component), uses it the same way for its status row
- `filteredRecords` (`useMemo`):
  - For adjuster-type roles only, a second pass stable-partitions the already-filtered array into `rest`/`awaitingApproval` (by `stageKey(r.planServiceStatus) === 'pending-review'`) and returns `[...rest, ...awaitingApproval]`
  - Sinks claims awaiting Supervisor approval to the end of the List view's default (unsorted) row order
  - Non-adjuster roles get the array back unchanged
  - Only affects the flat List view's row order
  - Kanban swimlanes group by status already — every card in the "Pending Review" lane shares the same key
  - Partition is a no-op for that lane's internal order
- `stageKey`/`columnFor` — untouched; the label swap is purely a rendering-time lookup on top of the same derived stage key
- **Role-dependent column/pill order (2026-07-22 follow-up):**
  - `STAGE_COLUMNS` was split into `PENDING_REVIEW_COLUMN` (the single "Pending Review" entry) + `OTHER_STAGE_COLUMNS` (Pending Selection / Finalized / Completed, fixed order)
  - `STAGE_COLUMNS` itself kept as `[PENDING_REVIEW_COLUMN, ...OTHER_STAGE_COLUMNS]` purely as the canonical set for `stageKey()`'s key-validity check — order is irrelevant there
  - `getStageColumns(isAdjuster): BoardColumn[]` returns:
    - `[...OTHER_STAGE_COLUMNS, PENDING_REVIEW_COLUMN]` for adjuster-type roles (review column last)
    - `[PENDING_REVIEW_COLUMN, ...OTHER_STAGE_COLUMNS]` otherwise — i.e. Claims Supervisor (and any non-adjuster role, by the same default) sees it first
  - Main component computes `const orderedStageColumns = useMemo(() => getStageColumns(isAdjuster), [isAdjuster])`
  - Both `boardColumns` (Kanban swimlanes) and the status filter pills map over `orderedStageColumns` instead of the static array
  - 2026-07-23: briefly changed to a single fixed order for every role, reverted the same day back to this role-dependent behavior per explicit follow-up
- **5th stat tile (2026-07-22 follow-up):**
  - `stats` gained `pendingReview: countFor('pending-review')`
  - A 3rd tile renders it between "Pending Selection" and "Provider Finalized"
  - Role-based label/subtitle (`isAdjuster ? 'Pending Supervisor Approval' : 'Pending Review'`) inlined directly rather than via `displayLabel` (there's no `BoardColumn` object for a stat tile, just the raw count)
  - Tile row's class gained a `cim-metric-row--5` modifier (`custom.css`) that overrides `.dash-metric-row`'s shared `grid-template-columns: repeat(4, 1fr)` to 5 columns
    - Scoped to this page only — `DashboardMaster` also uses the base `.dash-metric-row` class for its own (4-tile) KPI row
    - A shared-class change would have misaligned it
- **Stat tile order made role-dependent (2026-07-23 follow-up):**
  - Review tile's fixed 3rd-position placement (above) didn't match the Kanban columns/filter pills
  - Those already order by role via `orderedStageColumns`
  - The 4 non-"Total Claims" tiles now rendered via `orderedStageColumns.map(...)` (same array §"Role-dependent column/pill order" above already computes), with a small per-`column.key` lookup supplying each tile's label/value/sub-text (`stats.pendingReview`/`stats.pending`/`stats.finalized`/`stats.completed`)
  - Review tile now leads (2nd overall, right after "Total Claims") for Claims Supervisor and trails (5th/last) for adjuster-type roles, matching the Kanban/pill order
  - "Total Claims" itself stays hardcoded first — grand total, not one of the 4 status-stage tiles `orderedStageColumns` covers
- **Tile label renamed (2026-07-23, same follow-up):**
  - `'finalized-selection'` tile's `label` changed from `'Provider Finalized'` to `'Finalized Selection'` in the per-`column.key` lookup above, matching the Kanban column/filter pill wording
  - UI-only — `stats.finalized`'s computation and every `'Service Provider Finalized'` DB-status reference elsewhere are unchanged

**`apps/frontEnd/src/pages/ClaimIntake/claimIntakeDetails/index.tsx`:**

- New derived flag, next to the existing `isPendingReview`/`isSupervisor`: `const isReadOnlyForAdjuster = isPendingReview && !isSupervisor;`
  - Claim-level, not per-service (contrast with `getServiceStatus(role)` — still gates individual dropdowns for the specific overridden service per FRD §12)
- Three existing conditions gained `&& !isReadOnlyForAdjuster` / `isReadOnlyForAdjuster ? false : ...`:
  1. Service role toggle row's `onClick` and pointer-cursor `style` (previously only checked `isClaimCompleted`/`vendorsForRole`/`disableplanChange`/`canOverrideService`)
     - An adjuster can no longer add/remove a service from the plan while the claim is `Pending Review`, even a service unrelated to the override
     - Row's lock-icon-vs-toggle-switch branch got the same addition
     - Read-only rows render the lock icon instead of an interactive-looking toggle
  2. `dropdownEditable` (previously `serviceStatus === 'Unconfirmed' ? true : serviceStatus === 'Pending Review' ? isSupervisor : false`)
     - Now short-circuits to `false` whenever `isReadOnlyForAdjuster`, before falling through to the existing per-service logic
     - Closes the gap where a *different*, still-`'Unconfirmed'` service on the same claim was previously still editable by the adjuster while another service was under review
  3. **"Confirm Service Provider Selection"** button's render condition gained `&& !isReadOnlyForAdjuster`
     - Previously it stayed visible/enabled for adjusters as long as `hasUnconfirmedServices` was true, letting them keep confirming other services on a claim that already had one under review
- `canCompleteClaim` (Complete button gating) was already correct from the earlier per-service rework — `(!isPendingReview || isSupervisor)` — no change needed here
- No change to `getServiceStatus`, `getServiceVendorEntry`, `confirmVendorSelection`, `approveServiceVendor`, or any GraphQL call
  - Purely an additional UI gate layered on top of the existing per-service state machine

**Verified:**
- `tsc --noEmit` clean on `apps/frontEnd`
  - The batch of "declared but never read" diagnostics surfaced during editing are pre-existing/stale in this file, unrelated to this change — confirmed present before and after, and `tsc` itself reports zero errors
- Vite HMR applied both files without a full reload or console error

---

# 22. Fix — Recommended Vendor Wasn't First in Dropdown

- Bug: `getVendorsByRoleIdsWithDetails` returns vendors sorted by its own `rating` field (per its own code comment)
  - Render layer — "Recommended Service Provider" label, dropdown's "Best Fit" tag, and the dropdown list itself — all independently re-sort a local copy of `roleToVendorsMap[role]` by `vendorMatchPercent(companyName, role)` (deterministic hash-based FitIQ %, same source as the Provider Scoreboard — §"Vendor FitIQ %" above)
  - Those two rankings can disagree — `rating` and the FitIQ-% formula are unrelated scores
  - **Auto-select** default in `fetchVendorsForRoles` (`map[role] = newEntries[role]?.[0]?.companyName`) used the *un-re-sorted*, `rating`-ordered array
  - Vendor that ended up pre-selected in `roleVendorMap[role]` was frequently a different vendor than the one rendered first/"Best Fit" in the dropdown, reading as an arbitrary/"random" pick

**Fix** (`apps/frontEnd/src/pages/ClaimIntake/claimIntakeDetails/index.tsx`, `fetchVendorsForRoles`):
- Vendors returned by `getVendorsByRoleIdsWithDetails` now immediately re-sorted by `vendorMatchPercent` — the same comparator already used at render time — before being stored in `newEntries[roleName]` (and thus `roleToVendorsMap`)
- Auto-select line unchanged (`newEntries[role]?.[0]?.companyName`) but now reads the FitIQ-%-sorted array
  - Always agrees with the dropdown's "Best Fit" vendor
- Confirmed-vendor restore branch (`vendors.find(v => confirmedVendors.includes(...))`) is order-independent (`.find`, not index-based) and unaffected
- Render-time re-sorts (`mappedVendors`, `getRecommendedVendor`) now sorting an already-sorted array
  - Redundant but harmless — left in place rather than removed
  - Each is the other's independent confirmation that the list is in FitIQ-% order

**Verified:**
- `tsc --noEmit` clean
- Vite HMR applied without a full reload or console error

---

# 23. Priority Boost Vendors Rank First in the Vendor Dropdown

- FRD "Priority Boost Vendors Rank First"
- Boosted vendors (`boostApplied: true` on the `Vendor` document, same flag as the Boost Yes/No grid column — see `docs/Vendors/Vendor_Boost/*.md`) must outrank non-boosted vendors for a role, independent of FitIQ %
- Displayed FitIQ % itself stays untouched
  - Per an explicit product decision — keeping it identical to the Provider Scoreboard/View Performance score for that vendor+role was prioritized over inflating the number to "look" high

**Backend:**

- `apps/api/graphQL/vendorEntity.ts`
  - `getActiveVendorsByRoleIds()` return type gained `boostApplied: boolean`
  - Mapped result now includes `boostApplied: (v as Record<string, unknown>)['boostApplied'] === true` (same read pattern already used for this flag elsewhere, e.g. `vendorOnboardingController.ts`'s `getOnboardingList`)
  - Underlying Mongo query/sort (`serviceRequestRoleId`/active-status filter, `.sort({ rating: -1 })`) unchanged — the API's own `rating` order was already going to be re-sorted client-side (§22), so no need to also boost-sort here
- `apps/api/graphQL/claimIntakeEntity.ts`
  - `type VendorOption` gained `boostApplied: Boolean` (nullable, matches `rating`'s existing nullability)
  - `getVendorsByRoleIdsWithDetails` resolver unchanged — it just forwards `getActiveVendorsByRoleIds()`'s result

**Frontend (`apps/frontEnd/src/pages/ClaimIntake/claimIntakeDetails/index.tsx`):**

- `models/claimIntakeMaster/claimIntakeModel.ts` — `VendorOption` gained `boostApplied?: boolean`
- `services/claimIntakeMaster/claimIntakeService.ts` — `GET_VENDORS_WITH_DETAILS_QUERY` now selects `boostApplied` alongside `companyName`/`rating`
- New module-level `vendorRankCompare(a: VendorOption, b: VendorOption, role: string): number`, next to `vendorMatchPercent`:
  - Boosted vendors sort before non-boosted (`(b.boostApplied===true?1:0) - (a.boostApplied===true?1:0)`)
  - Falls back to the existing `vendorMatchPercent` descending comparator when the boost flags are equal (both boosted, or both not)
  - This single function replaces the ad hoc `vendorMatchPercent`-only comparator at all three call sites that rank a role's vendor list
  - Ranking can't drift between them:
    1. `fetchVendorsForRoles` — the fetch-time sort (§22) that determines the auto-selected default
    2. `getRecommendedVendor(role)` — used to detect vendor overrides for the Pending Review workflow (FRD §12)
    3. The dropdown's `mappedVendors` render-time sort — recommended/confirmed label, "Best Fit" tag, and the dropdown list order
- No change to `vendorMatchPercent`/`vendorRoleScorecard` (`utils/kpiScoring.ts`)
  - FitIQ % calculation and the eye-icon breakdown popup are unaffected by boost, by design

**Verified:**
- `tsc --noEmit` clean on both `apps/api` and `apps/frontEnd`
- API restarted (schema/resolver change, not hot-reloadable under `ts-node`) and smoke-tested directly via GraphQL
  - `getVendorsByRoleIdsWithDetails` for a real `roleId` returned `boostApplied: true` for the two vendors with an active boost and `false` for the rest, confirming the field threads through end-to-end
- Vite HMR applied the frontend changes without a full reload or console error

---

# 23. Claims Supervisor Review & Supervisor Comments Workflow

- Moved to its own doc pair — see **`SupervisorReview-frd.md`** / **`SupervisorReview-techspec.md`**
- Substantial extension:
  - New mutation
  - New query
  - A new page
  - A new sidebar item
  - A rework of the Supervisor-facing half of §20/§22's per-service review UI
- Rather than a small addition to this file

---

# 24. Removed — "Complete" button (30-Jul-2026)

- Follows the "remove-completed-status" change to `claimIntakeMaster/index.tsx` (list/kanban screen, prior commit)
  - Excluded Completed claims from the Claims Command Center entirely (no filter pill, no kanban swimlane, no stat tile)
- With no way to even see a completed claim on that screen: leaving a button on the Claim Details screen that could still silently move a claim into that now-unsurfaced status was inconsistent
- Removed to match

**`apps/frontEnd/src/pages/ClaimIntake/claimIntakeDetails/index.tsx`:**

- Removed `handleCompleteClaim` (called the `completeClaim` mutation),
  `canCompleteClaim` (the button's render gate — see §22 "New derived
  flags..." above, now obsolete), and the `completing`/`completeError`
  state pair.
- Removed the "Complete" `<button>` itself from the page header.
- `completeClaim` import (from `claimIntakeService.ts`) and `token`
  (from `useAuth()`) both dropped — `handleCompleteClaim` was their only
  consumer on this page.
- **Not removed**:
  - `isClaimCompleted` and its downstream gating (locking service/vendor editing, hiding action buttons, etc. — ~10 call sites) stays as-is
    - Any claim marked Completed before this change must keep rendering read-only
  - Passive "✓ Completed" header badge and "✓ Claim Completed" footer badge (both `badge-blue`) also kept
    - Informational displays reflecting existing DB state, not actions
    - Remain accurate for legacy completed records
- `completeClaim` (the `claimIntakeService.ts` mutation wrapper) and the backend `Mutation.completeClaim` resolver both left in place
  - Unused by any current UI
  - Same "leave unwired code" precedent as other retired actions in this app (e.g. `UserRowActionsMenu.tsx`), in case the status is reinstated later

**CSS (`skin/css/custom.css`):**
- Removed the now-orphaned `.btn--complete` ruleset
- `.badge-blue` kept (still used by the two passive badges above)

**Verified:**
- `tsc --noEmit` clean on `apps/frontEnd`
- Full `vitest run` — 28 files, 496 tests passing

---

# 25. Service Request Rules Filtered by Line of Business (2026-09-06)

**Requirement:** Service Request Roles (`docs/ServiceRequest/ServiceRequestRole-techspec.md` §8a) now belong to a Line of Business (LOB) — WCM, Auto, General Liability, Property. The Claim Command Center must show a claim only the rules configured for that claim's own LOB, derived from its `claimType`, and must not let a role belonging to a different LOB be selected for it.

**Shared mapping logic:**
- `sourceCode/apps/api/utils/lineOfBusiness.ts` — `LINE_OF_BUSINESS_OPTIONS` and `mapClaimTypeToLOB(claimType)`.
- `sourceCode/apps/frontEnd/src/utils/lineOfBusiness.ts` — frontend mirror of the same mapping (imports `LINE_OF_BUSINESS_OPTIONS` from `models/ServiceRequestRole/serviceRequestRoleModel.ts`). Keep both in sync if the mapping rule changes.
- Mapping: exact case-insensitive match to one of the four LOB names first; otherwise fuzzy synonyms (`workers comp*`/`wc` → WCM, `auto*`/`vehicle` → Auto, `general liability`/`gl` → General Liability, `propert*` → Property); anything else defaults to `WCM` (every pre-LOB claim/rule in the system is WCM).

**Rule-matching engine (`sourceCode/apps/api/graphQL/claimIntakeEntity.ts`):**
- `matchRolesForRecord(record, activeRoles, condsByRole)` now computes `mapClaimTypeToLOB(getClaimField(record, 'claimType'))` once per record and skips any Active role whose `lineOfBusiness` array doesn't include it before evaluating its conditions.
- `buildRoleConditionsMap()` still loads Active roles across **all** LOBs in one query (unchanged signature) — a single bulk upload can contain records with different `claimType`/LOB values, so the LOB check has to happen per-record inside `matchRolesForRecord`, not once for the whole batch.
- This is the single choke point feeding both the bulk claim-listing resolver and the claim-details re-evaluation resolver, so both inherit LOB filtering automatically.

**Server-side selection guard:**
- New `validateRolesMatchClaimLOB(claimType, roleIds)` in `claimIntakeEntity.ts` loads the requested roles and flags any whose `lineOfBusiness` array doesn't include the claim's derived LOB.
- Wired into `savePlanServices`, `saveDraftPlanServices`, and `saveVendorServices` (all three now fetch the existing `ClaimRecord` first if they didn't already, to read its `claimType`) — a mismatched role selection is rejected with `{ success: false, message: "The following services do not belong to this claim's line of business: <names>" }` instead of being persisted.
- This is a defense-in-depth check: the UI (below) only ever offers same-LOB roles, so this should not be reachable in normal use.

**Claim Command Center display (`sourceCode/apps/frontEnd/src/pages/ClaimIntake/claimIntakeDetails/index.tsx`):**
- `allRoles` state now carries `lineOfBusiness` (an array) per role (from `getAllServiceRequestRoles()`).
- `claimLOB = mapClaimTypeToLOB(selectedRecord?.claimType)` computed once the claim record is loaded.
- `allRoleNames` (feeds the "Select Services & Service Providers" → "Service Request Rules" list) is now `allRoles.filter(r => r.lineOfBusiness.includes(claimLOB)).map(r => r.roleName)` instead of the full unfiltered list.
- All other `allRoles.find(...)` lookups elsewhere on the page (resolving a roleName back to a roleId for already-confirmed/legacy selections) intentionally stay on the **unfiltered** `allRoles` array, so a service selected before this feature (or before a claim's LOB classification changes) still resolves correctly instead of disappearing.

**No schema change to `ClaimRecord`:** LOB is derived from `claimType` on read, never persisted on the claim record itself.

**Verification:** create one Service Request Rule per LOB, confirm each only appears on claims with the matching `claimType`; confirm pre-existing WCM rules/claims are unaffected; confirm a mismatched role selection is rejected server-side.

---

# 25a. Service Request Rules Support Multiple Lines of Business (2026-09-07)

**Requirement:** A Service Request Rule can now be configured for more than one LOB, so a shared rule (e.g. a rule reused across General Liability and Property) is configured once instead of duplicated per LOB. `ServiceRequestRole.lineOfBusiness` changed from a single `String` to a `[String]` (see `docs/ServiceRequest/ServiceRequestRole-techspec.md` §5, §8a for the full schema/GraphQL/migration detail).

**Impact on this module:** None beyond the `===` → `.includes()` changes already reflected in §25 above — `mapClaimTypeToLOB(claimType)` still derives exactly one LOB per claim (a claim belongs to one LOB), only the *rule* side became multi-valued. All matching, the server-side selection guard, and the Claim Command Center's rule list all filter by "claim's LOB is a member of the rule's LOB array" rather than equality.

**Verification:** create one Service Request Rule configured for two LOBs (e.g. General Liability + Property); confirm it appears on claims of either `claimType` and is accepted as a valid selection for both; confirm single-LOB rules are unaffected.
