# Functional Requirements Document

## Service Provider Navigation Redesign

| Field | Value |
|---|---|
| Document Title | FRD — Service Provider Navigation Redesign |
| Module | Sidebar / Service Provider section |
| Version | 1.5 |
| Date | 21-Jul-2026 |
| Status | Implemented |

---

## 1. Purpose

-   Collapse the sidebar's expandable "Service Provider" group into a single sidebar entry
    -   Same font size as every other top-level item — no visual distinction
-   Introduce a persistent tab bar on the operational Service Provider pages
-   Without:
    -   Creating any new pages/routes
    -   Changing business logic/APIs
    -   Modifying MongoDB data beyond menu-item parent/sort fields
-   Earlier iterations explored:
    -   Putting all 6 of the group's original children into the tab bar
    -   A larger font for the flattened sidebar entry
    -   Moving Service Metrics Configuration on and off its own standalone sidebar entry
-   Final design:
    -   **5 of the 6 in the tab bar**
    -   **Service Metrics Configuration back as its own standalone sidebar item**
    -   **No font-size override** on "Service Provider" — it matches every other sidebar link

---

## 2. Sidebar

- The "Service Provider" sidebar entry (`menu-admin-vendor-group` in the
  `triage_menu` collection) no longer expands
  - Renders as a single leaf link
  - Same font size as every other top-level sidebar item
    (`TopLevelLink` in `Sidebar.tsx` applies no size-modifier class to it)
- **No MongoDB document content was changed, only `parentId`/`sortOrder` on
  menu items**
  - No menu item was deleted
  - No other collection was touched
  - 5 of the group's 6 original children (Provider Administration,
    Provider Onboarding, Curated Provider Network, Provider Scoreboard, Service
    Provider Request) are children of `menu-admin-vendor-group` in
    `triage_menu`, hidden from the sidebar by `Sidebar.tsx`'s frontend
    tree-building logic (`FLATTENED_GROUP_IDS`) — data untouched
- **Service Metrics Configuration is the one exception**
  - `menu-admin-analytics-insight-001` has `parentId: null` in `seedMenu.ts`
  - Standalone top-level sidebar entry, own icon, own link
  - Not part of the flattened group and not part of `ServiceProviderTabs`
- Clicking "Service Provider" keeps navigating to its existing `path`
  (`/service-provider`, the `ServiceProviderLanding` tile hub) —
  unchanged

---

## 3. Top Tab Bar — `ServiceProviderTabs`

-   Component: `src/components/layout/ServiceProviderTabs.tsx`
-   Renders a static `role="tablist"` bar with 5 tabs, each linking to an
    **existing, unmodified route**
    -   Tab click → plain `useNavigate()` call
    -   No new pages created

| Tab | Route | Existing page |
|---|---|---|
| Provider Administration | `/vendor/search` | `VendorSearch` |
| Provider Onboarding | `/vendor/onboarding` | `VendorOnboardingSearch` |
| Curated Provider Network | `/vendor/panel` | `VendorPanel` |
| Provider Scoreboard | `/service-provider-analytics` | `ServiceProviderAnalytics` |
| Service Provider Request | `/vendor-request/new` | `VendorRequestForm` |

-   The active tab is derived from `useLocation().pathname` (exact match), not
    a prop
    -   Consistent with the rest of this codebase's manual-path-comparison
        convention (no `NavLink` is used anywhere in the app)
-   Each of the 5 pages renders `<ServiceProviderTabs />` as first element
    inside its existing `<AppShell>` call
    -   Immediately above its unmodified page header/content
    -   `AppShell.tsx` was not changed (it still only accepts `children`)
    -   The tab bar is additive chrome duplicated across the 5 call sites, not
        a new shared layout mechanism
-   Detail/drill-down screens reached *from* these pages (`VendorOnboardingDetails`,
    `VendorOnboardingPendingApproval`) intentionally do **not** show the tab bar
    -   It's a top-level section switcher, not a global breadcrumb

---

## 4. Service Metrics Configuration — standalone sidebar entry

-   Unlike the other 5: reached directly from the sidebar (its
    own top-level link, see §2) — not from `ServiceProviderTabs`
-   `ServiceProviderLanding` tile hub (`/service-provider`) also has
    a tile for it
    -   Added during an earlier iteration, along with a since-redundant but
        harmless tile for Service Provider Request
    -   Reuses the page's `Tile` component/CSS classes — no new page
        or component
-   Reachable both ways

---

## 5. Explicitly Preserved / Not Modified

- No route added, removed, or changed in `App.tsx`
- No backend/API/GraphQL resolver touched
- Only MongoDB writes: `parentId`/`sortOrder` updates
  on the 6 existing menu items under `menu-admin-vendor-group` (via the
  idempotent, upsert-based `seedMenu.ts` script)
  - No document was created or deleted
  - No other collection touched
- `AppShell.tsx`, `Topbar.tsx` unchanged
- Every page's title, breadcrumb, functionality below the tab
  bar (or tile grid): unchanged
  - Both purely additive navigation
