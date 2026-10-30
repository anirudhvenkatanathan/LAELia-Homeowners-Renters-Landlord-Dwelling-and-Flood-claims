# Tech Spec — Claim Intake Configuration

**Module:** Claims Management
**Screen:** Claim Intake
**Version:** 4.5
**Date:** 31-Jul-2026

---

## 1. Overview

- Upload claim information via claim file, JSON payload, or XML data
- Accessible from the **Claim Intake** menu
- Uploaded claims stored and displayed in a grid for tracking and review
- Select any uploaded record to view full details in Uploaded Claim Details screen

---

## 2. Navigation

| Element | Value |
|----------|----------|
| Menu Name | Claim Intake |
| Access Type | Authorized Users Only |
| Navigation Path | Claims → Claim Intake |
| Default Action | Opens Claim Intake Screen |

---

## 3. Screen Layout

### Header

| Element | Value |
|---|---|
| Title | Claim Intake |
| Subtitle | Upload and review claim intake records |

---

## 3.1 Role-Based Module Title (UI-only)

- Screen's title/subtitle in code: **"Claims Orchestrator"** / "Upload and review Claims Orchestrator records"
  - Not the "Claim Intake" wording in section 3 above — that wording predates this rename
- When logged-in user's role is **Claims Adjuster**: every place this title appears is swapped to **"Claims Command Center"**

| Surface | Other roles | Claims Adjuster |
|---|---|---|
| Page header (`<h1 className="page-title">`) | Claims Orchestrator | Claims Command Center |
| Page subtitle | Upload and review Claims Orchestrator records | Upload and review Claims Command Center records |
| Sidebar navigation label (path `/claim-intake`) | Claims Orchestrator | Claims Command Center |
| Browser tab title | unchanged (`Claims Triage Platform`) | Claims Command Center (restored on navigating away) |

- **UI-only display swap** driven by `user.roleName === 'Claims Adjuster'`
  - Route (`/claim-intake`) unchanged
  - GraphQL API unchanged
  - MongoDB `menuItems` label ("Claims Orchestrator") unchanged
  - All business logic unchanged
- No breadcrumb exists on this screen — breadcrumbs aren't used anywhere in Claim Triage, per `AGENTS.md`; nothing to update

---

## 3.2 View Modes — List View and Kanban (Swimlane) View

- Two interchangeable view modes for the same underlying claim data
- Switched via a toggle at the top of the page
- No page reload

* **Kanban View** — the swimlane board, unchanged (columns = Pending Service and
  Provider Selection / Service Provider Finalized / Completed / Other, colored per
  `docs/Common/DESIGN.md` § Kanban Columns).
* **List View** (new) — the same claim records in a sortable, paginated table (AG Grid, per
  `AGENTS.md`'s "AG Grid for all tabular data" rule): Claim #, Insured Name, Policy #, Claim
  Type, Loss Date, Amount, and a colored Status badge using the same palette as the Kanban
  column headers
  - Both views read as one consistent color language

**Shared toolbar** (applies to both views identically):
* Status filter pills — All Claims / Pending Selection / Service Provider Finalized /
  Pending Review / Completed / Other. For Claims Adjuster / Senior Adjuster / Junior
  Adjuster, the "Pending Review" pill (and every other place that status label
  renders) reads **"Pending Supervisor Approval"** instead — see §13.
* Search box — claim number, insured name, or policy number (unchanged).
* Clicking a claim (a card in Kanban, a row in List) navigates to Uploaded Claim Details, as before.

**Stat tiles**
- Five summary tiles above the toolbar
- Computed from the live claim records
- Independent of the filter/search
- Always reflect the whole data set
- History:
  - A "Total Claim Value" dollar tile was tried here initially and removed per feedback
  - Completed count took its place
  - Kept the tile row a complete, balanced set of the four claim statuses
  - A 5th tile, the Pending Review count, was added later (§13), once that became its own trackable stage

* **Order (changed 2026-07-23)**:
  - "Total Claims" is always first (a grand total, not a status-stage tile)
  - The remaining 4 follow the **same role-based order as the Kanban columns/filter pills** (§13's `orderedStageColumns`)
    - For Claims Supervisor: Pending Review, Pending Selection, Finalized Selection, Completed
    - For adjuster-type roles: Pending Selection, Finalized Selection, Completed, Pending Supervisor Approval
  - Was previously a fixed order with the review tile always 3rd, regardless of role
* **Tile label (changed 2026-07-23)**:
  - 4th tile reads **"Finalized Selection"**, matching the Kanban column/filter pill wording
  - Was previously labeled "Provider Finalized"
  - UI-only label change — the underlying `'Service Provider Finalized'` DB status string, and every column/table referencing it elsewhere in this doc, are unchanged
* Review tile's label/subtitle follow the same role-based swap as everywhere else in §13:
  - **"Pending Supervisor Approval"** / "Awaiting Supervisor decision" for adjuster-type roles
  - **"Pending Review"** / "Vendor override awaiting review" for Claims Supervisor

**View persistence**
- Last-selected view remembered for the browser session only (`sessionStorage`, key `cim-view-mode`)
- Does not persist across a browser restart
- **Defaults to List View** when nothing is stored yet
  - Changed from a Kanban default, per feedback
  - List is now the expected landing view

- No backend, database, route, or business logic changed for this feature
  - Presentation and client-side view-state only
  - Built on the same `useAllClaimRecords` data source the Kanban view used

---

## 4. Form Sections

1. Upload Claim
2. Uploaded Claims Grid
3. Uploaded Claim Details

---

### 4.1 Upload Claim

| Field | Type | Mandatory | Notes |
|---|---|---|---|
| Upload Type | Radio Button | Yes | Excel File / JSON Payload |
| Excel File | File Upload | Conditional | Required when Upload Type = Excel |
| JSON Payload | Text Area | Conditional | Required when Upload Type = JSON |
| XML Data | Text Area | Conditional | Required when Upload Type = XML |
| Upload Claim | Button | Yes | Validate and upload claim |

### Upload Type Options

| Option | Description |
|---|---|
| Excel File | Upload claim information using Excel (.xlsx, .xls) |
| JSON Payload | Upload or Paste claim information directly in JSON format |
| XML Data | Upload or Paste claim information directly in XML format |

### Supported File Types

| File Type |
|---|
| .xlsx |
| .xls |
| XML Data |
| JSON Payload |

---

## 4. Uploaded Claims Grid

- Displayed at the bottom of the screen

### Grid Columns

| Column |
|---|
| Upload ID |
| File Name |
| Upload Type |
| Claim Number |
| Uploaded By |
| Upload Date |
| Status |

### Grid Behaviour

- Latest uploads first
- Sorting and pagination supported
- Single row selection
- Row click opens Uploaded Claim Details

---

## 4.1 Claims Orchestrator Board

- Displays claims as a swimlane (Kanban-style) board
- Grouped by pipeline status

### Board Columns

- Column order (left to right) is **role-dependent** — see §13:

- **Claims Supervisor**: Pending Review, Pending Selection, Service Provider Finalized, Completed, Other
  - Pending Review first — it's the Supervisor's review queue
- **Claims Adjuster / Senior Adjuster / Junior Adjuster**: Pending Selection, Service Provider Finalized, Completed, Pending Supervisor Approval, Other
  - Review-stage column sinks to last

| Column | Includes Statuses |
|---|---|
| Pending Selection | Pending Service Selection, Pending Service Provider Selection |
| Service Provider Finalized | Service Provider Finalized |
| Completed | Completed |
| Pending Review | Pending Review (§12 — vendor override awaiting Claims Supervisor approval). Displayed as **"Pending Supervisor Approval"** for adjuster-type roles — §13. |
| Other | Any status not listed above |

### Card Fields

- Claim Number
- Claim Type
- Insured Name
- Policy Number
- Loss Date
- Claim Amount

### Business Rules

1. Claims grouped into columns by pipeline status
2. Cards read-only — no drag-and-drop between columns
3. Click a card to open Claim Details
4. Search bar filters cards by claim number, insured name, or policy number
5. "Other" column shown only when at least one claim's status doesn't match a known stage
6. Each column caps at roughly 10 visible cards; additional cards scroll within that column
   - Overall page height stays fixed as claims are added

---

## 5. Uploaded Claim Details Screen

- Selecting a record from the Uploaded Claims Grid opens the Uploaded Claim Details screen

### Claim Details Tabs

| Tab | Status |
|---|---|
| Service | Active, only tab |
| ~~Metrics~~ | Removed — see Provider Scoreboard |

### AI Insights Panel

| Section | Notes |
|---|---|
| Q-AI Insights | Panel title (was Q-AI Summary) |
| Claims Summary | Bullet list (was Summary) |
| Signals | Bullet list |
| Services Enabled | Bullet list (was "QAI Intelligence"), moved in from its own card |

- All 3 sections render as bullets.
- Services Enabled: was a separate "QAI Intelligence" card; now nested here, and renamed.
- Panel background: distinct tinted shade with clear border and left accent bar
  - Stands out from the white cards elsewhere in the tab (previously too light/blended in)
  - "Q-AI Insights" title uses a larger font size
  - Each section title (Claims Summary, Signals, Services Enabled) is highlighted
- Footer notes ("Last evaluated…", "Generated by…") removed.
- Services Enabled rows previously showed **two** markers per line
  - Shared list bullet plus a per-service colored dot
  - Shared bullet now suppressed for this section only, leaving just the one colored dot
  - Claims Summary/Signals unaffected — they only had the one shared bullet

### Claim Snapshot Card

Read-only claim fields + status badge.

- Removed: active plan-service chip row at the bottom.

### Select Services & Vendors — Single Screen, One-Click Confirm

One card handles the full flow:

1. Loads active service roles + suggested vendors (by rating)
   - Triggered as soon as the claim is ingested
2. User picks extra services and a vendor per service together (reason required for changes)
3. Single **Confirm Service Provider Selection** button finalizes both

- Removed: separate **Confirm Services** / **Confirm Service Provider** two-step buttons and the intermediate "Pending Service Provider Selection" gate — vendor picking no longer waits on a prior services confirm.
- Removed: legacy **Select Plan Services** / **Select Service Provider Services** modals — unreachable dead code, no UI change.
- **Accept action styling**: the accept/confirm buttons on this screen — **Confirm Service Provider Selection**, **Confirm switch**, and **Save Change** — are now green instead of the prior brand-primary color.
- **Removed (30-Jul-2026): the "Mark claim as completed" / Complete button** on the Claim Details screen
  - "Completed" status no longer a supported end-state on this screen
    - Claims Command Center's list/kanban excludes Completed claims entirely, per the "remove-completed-status" change to `claimIntakeMaster/index.tsx`
  - Claim-completion flow now ends at Confirm Service Provider Selection / Finalized Selection
  - Claim records marked Completed before this change:
    - Still render read-only/locked (`isClaimCompleted` gating unchanged)
    - Still show a passive "✓ Completed" badge
    - No remaining UI action can set that status

### Service Request Rules Filtered by Line of Business (2026-09-06)

Service Request Rules (see `docs/ServiceRequest/ServiceRequestRole-frd.md` §11a) are now configured per Line of Business (LOB): WCM, Auto, General Liability, Property.

- A claim's LOB is derived from its `Claim Type` field (Card Fields, §4) — exact match to one of the four LOB names, falling back to common synonyms, and defaulting to WCM for anything unrecognized.
- The "Select Services & Vendors" card (above) now lists only the Service Request Rules configured for the claim's own LOB — a claim with `Claim Type: "Auto"` shows only Auto rules, `"General Liability"` shows only General Liability rules, and so on.
- Existing WCM claims and rules are unaffected: every rule that existed before this feature is treated as WCM, matching every existing WCM claim.
- If a user attempts to confirm a service/vendor selection for a role that doesn't belong to the claim's LOB (should not be reachable through the filtered UI above, but is enforced server-side as a safeguard), the save is rejected with an error message naming the mismatched service(s).

### Service Request Rules Support Multiple Lines of Business (2026-09-07)

A Service Request Rule can now be configured for more than one LOB at once (see `docs/ServiceRequest/ServiceRequestRole-frd.md` §11a), so a shared rule (e.g. a rule that applies to both General Liability and Property) is configured once instead of duplicated per LOB.

- The Claims Command Center's LOB filtering (above) is unaffected in behavior: a claim still shows only rules whose Line of Business list includes the claim's own derived LOB — a rule now simply may appear on more than one LOB's claims.
- Existing single-LOB rules are unaffected — every rule still matches exactly the LOB(s) it's configured for.

### Vendor Rating Visibility

- **Claims Adjuster** profile: vendor FitIQ % and the FitIQ breakdown (KPI score) popup hidden everywhere they'd otherwise show
  - Recommended/confirmed provider label, vendor dropdown trigger, dropdown list
- All other profiles: unchanged

### Vendor FitIQ %

- Vendor dropdown (recommended/confirmed label, dropdown trigger, dropdown list, and the FitIQ breakdown popup's total) shows each vendor's score as a percentage under the label **FitIQ** (e.g. "90%")
  - Not a 5-star/decimal rating
- Same score used for that vendor+service on the Provider Scoreboard (and "View Performance")
  - Just rescaled to 0–100 instead of 0–5
  - A vendor's FitIQ % here always agrees with its score on those screens
- Vendors within a role's dropdown ranked by FitIQ %
  - "Best Fit" = the highest-scoring vendor for that service
  - Always the vendor shown first in the dropdown list
  - Pre-selected when a service becomes active
- Eye-icon "FitIQ breakdown" popup (Category/Wt/Score/Contribution table) uses the same canonical KPI breakdown as the FitIQ %
  - Wt column always sums to 100%
  - Contribution column expressed on the same 0–100 scale, also summing to 100
  - Matches the FitIQ total shown at the bottom of the table
- **Fixed (2026-07-22):**
  - Bug: default/auto-selected vendor for a service was previously chosen from the vendor API's own `rating`-sorted order
    - Doesn't necessarily agree with the FitIQ % ranking used for display
    - An adjuster could open a service and see a vendor other than the FitIQ "Best Fit" one pre-selected — looking like an arbitrary vendor was recommended
  - Fix: vendors now sorted by FitIQ % once, as soon as they're fetched
  - Result: auto-selected default always matches the "Best Fit"/first-listed vendor shown in the dropdown

### Priority Boost Vendors Rank First (2026-07-22)

- Vendor with an active Priority Boost (Service Provider Administration → **Apply Priority Boost**, `boostApplied: true` on the vendor record):
  - Always ranks **above every non-boosted vendor** for a role in the "Select Services & Vendors" dropdown
    - Recommended/confirmed label, dropdown list order, and the auto-selected default all reflect this
  - **Regardless of its FitIQ %**
  - Within the boosted group and non-boosted group, vendors are ranked by FitIQ % as before

- **The displayed FitIQ % is not changed by boost.**
  - A boosted vendor still shows its actual FitIQ %
  - Can be lower than a non-boosted vendor listed right below it — this is intentional
  - Keeps agreeing with the same vendor+role's score on the Provider Scoreboard and "View Performance" (an existing, documented invariant this feature does not break)
- If more than one vendor for a role has an active boost: ordered among themselves by FitIQ % (same tiebreak as non-boosted vendors)
- A vendor's boost status is not scoped per-role/per-claim here
  - Same account-level `boostApplied` flag shown as the Boost Yes/No column on the Service Provider Administration and Provider Onboarding grids (`docs/Vendors/Vendor_Boost/*.md`)

### Claim Information

| Field |
|---|
| Claim Number |
| Policy Number |
| Insured Name |
| Loss Date |
| Reported Date |
| Claim Type |
| Claim Status |

### Upload Information

| Field |
|---|
| Upload ID |
| Upload Type |
| File Name |
| Uploaded By |
| Upload Date |
| Processing Status |

### Payload Information

| Field |
|---|
| Uploaded Excel Data or JSON Payload or XML Data |
| Validation Result |
| Processing Messages |

---

## 6. Validation Rules

| Field | Rule |
|---|---|
| Upload Type | Mandatory |
| Excel File | Required when Upload Type = Excel |
| JSON Payload | Required when Upload Type = JSON |
| XML Data | Required when Upload Type = XML |
| Excel File | Must be .xlsx or .xls |
| JSON Payload | Must be valid JSON |
| XML Data | Must be valid XML |
| Upload Content | Cannot be empty |
| File Size | Must not exceed configured limit |

---

## 7. Processing Logic

### Excel Upload

1. User selects Excel File upload.
2. User uploads .xlsx or .xls file.
3. System validates file format and required columns.
4. System processes claim data.
5. System creates claim intake record.
6. Record appears in Uploaded Claims Grid.

### JSON Upload

1. User selects JSON Payload.
2. User pastes JSON content.
3. System validates JSON structure.
4. System processes claim data.
5. System creates claim intake record.
6. Record appears in Uploaded Claims Grid.


### XML Upload

1. User selects XML Data.
2. User pastes XML content.
3. System validates XML structure.
4. System processes claim data.
5. System creates claim intake record.
6. Record appears in Uploaded Claims Grid.


---

## 8. Database Storage

| Column | Source |
|---|---|
| UploadId | System Generated |
| UploadType | Excel / JSON / XML |
| FileName | Uploaded File Name |
| ClaimNumber | Extracted Claim Number |
| UploadedBy | Logged-in User |
| UploadDate | System Date/Time |
| Status | Processing Result |
| Payload | Original Excel Data / JSON Payload / XML Data |

---

## 9. Success & Error Handling

| Scenario | Behaviour |
|---|---|
| Upload Successful | Show success message and refresh grid |
| Invalid JSON | Show validation error |
| Invalid Excel Format | Show validation error |
| Invalid XML | Show validation error |
| Missing Required Columns | Show validation error |
| Empty Upload | Show validation error |
| Upload Failure | Show processing failure message |
| Record Selected | Open Uploaded Claim Details screen |
| System Error | Display generic error message |

---

## 10. Audit Information

System stores:

- Upload ID
- Upload Type
- Uploaded By
- Upload Date/Time
- File Name
- Processing Status
- Validation Results

---

## 11. App Navigation — Sidebar (Shared Layout)

- Applies to the shared `AppShell` layout (sidebar + header) used across admin screens, including this one

- Sidebar background: sage-green gradient (top to bottom), both expanded and collapsed
- Selecting a menu item: light pill background + dark text, same in both states
- Sage-green is now the app's primary brand color everywhere, not just the sidebar
  - Primary buttons, links, active tabs, focus highlights, and similar accents across all screens use this tone instead of the previous darker green
- Sage-green tone (sidebar and brand color both) one shade darker than when first introduced
- Fixed: Login screen's "Signing in…" button state and Quick Login links
  - Had their own hardcoded old green, out of sync with the rest of the app
- Active Service Provider and Service Provider Onboarding portals:
  - Logout moved from the top header into the sidebar footer (bottom-left), matching the admin layout
  - These sidebars now show the same login user details as the admin footer (avatar, name, email) rather than Logout alone
- "MAIN" and "ADMIN" section headers removed from the admin sidebar
  - Dashboard, Claims Orchestrator, and Field Mapping now sit at the top level (no "Main" header above them)
  - "Service Provider" and "AI Foundation" — previously nested under "Admin" — are now top-level groups with their own section header, same as before minus the outer "Admin" wrapper
  - No page routes changed, only the grouping/headers

### Sidebar Footer

Pinned below the nav items, on every screen (admin, Active Service Provider, Service Provider Onboarding):

| Element | Content |
|---|---|
| Avatar | Circle with the user's initials |
| Name | Admin: role name (fallback: username). Vendor portals: company name (fallback: username/email) |
| Email | Logged-in user's email, if available |
| Logout (exit icon) | Click → confirm dialog → clear session → redirect to Login |

- Logout moved here from the top header on all 3 layouts
  - None of their headers have a Logout button anymore
- Collapsed admin sidebar: only the avatar shows (name/email/action hidden), same as the rest of the collapsed nav
  - Vendor portal sidebars don't support collapse
- Top header bar (left empty once Logout moved to the sidebar footer) removed on every screen
  - Page content starts right at the top instead of leaving a blank strip above the page title

## 12. Vendor Override Review Workflow (per-service)

- Pending Review evaluated **per service, not for the entire claim**
- When a Claims Adjuster, Senior Adjuster, or Junior Adjuster clicks "Confirm Service Provider Selection": each active service is compared against the Rule Engine's recommended provider for that service

- **Matching provider** → that service is marked `Locked` immediately — no Pending
  Review badge, and the vendor dropdown is hidden for everyone (adjuster and
  Supervisor alike) from that point on.
- **Different provider (override)** → only *that* service is marked `Pending
  Review` — badge shown solely on that service, dropdown stays hidden for the
  adjuster but becomes editable for a Claims Supervisor, and the service remains
  outside the adjuster's control until reviewed.

- Claim-level status (`planServiceStatus`) is a **derived** roll-up:
  - `'Pending Review'` if any service is still `Pending Review`
  - Else `'Service Provider Finalized'`
  - Recomputed server-side on every save
- Keeps the Claims Orchestrator Kanban board's "Pending Review" swimlane column and every other `planServiceStatus`-based view unchanged

| Field | Type | Notes |
|---|---|---|
| Role name used | — | The role that reviews/approves is **`Claims Supervisor`** (the actual seeded/coded role name — the plural form, not "Claim Supervisor"). |
| `planServiceStatus` | String | Derived from `serviceVendorReview` on every save/review — `'Pending Review'` if any entry is, else `'Service Provider Finalized'`. |
| `serviceVendorReview` | `{roleName, recommendedVendor, selectedVendor, status, confirmedBy, confirmedAt, reviewedBy?, reviewedAt?}[]` | Per-service source of truth for both display and locking. Replaces the old claim-wide `vendorOverrideBy`/`vendorOverrideDetails` fields. Merged (upserted by `roleName`), never overwritten wholesale, so re-confirming other services never disturbs an already-`Locked` or still-`Pending Review` entry. |
| Badge | UI | "Pending Review" (`badge-orange`) renders only on the specific service row whose `serviceVendorReview` entry has `status: 'Pending Review'`. |
| Kanban column | UI | Unchanged — the existing "Pending Review" swimlane still buckets by the (now-derived) claim-wide `planServiceStatus`. |

### FR-001 — Per-Service Vendor Comparison

- On "Confirm Service Provider Selection": for each active service not already `Locked`, compare its recommended vendor against the selected one
- Only services confirmed by an adjuster-type role (Claims Adjuster / Senior Adjuster / Junior Adjuster) with a mismatch are marked `'Pending Review'`
- A Claims Supervisor's own picks are `'Locked'` immediately (never flagged as a new override)

### FR-002 — Matching Provider

- If recommended === selected: that service's entry is `'Locked'` on confirm
  - No badge
  - Service's vendor dropdown hidden from then on for everyone — cannot be reopened by an adjuster or a Supervisor

### FR-003 — Different Provider (Vendor Override)

- If recommended !== selected (adjuster-type role): only that service's entry becomes `'Pending Review'`
  - Badge and an "Overridden by {confirmedBy}" note render only on that service row
- **Superseded by §13 (2026-07-22):**
  - Previously: other unrelated active services stayed confirmable while one service was `Pending Review`
  - Now: as soon as `planServiceStatus` rolls up to `'Pending Review'` (FR-004), the **entire claim** becomes read-only for the adjuster who owns it — not just the overridden service
  - See §13's read-only rule

### FR-004 — Claim Status Roll-up

- `planServiceStatus` becomes `'Pending Review'` only if at least one service's entry is `'Pending Review'`
- If every service matches its recommendation: claim proceeds through the `'Service Provider Finalized'` → `'Completed'` flow unchanged
- This roll-up status is also what §13's role-based read-only/label/list-ordering rules key off of

### FR-005 — Claims Supervisor Review

- Opening a claim with one or more `Pending Review` services, a Supervisor sees, per such service:
  - Recommended Service Provider
  - Selected Service Provider
  - Editable dropdown (reusing the same vendor-switch modal/reason flow adjusters use) to change the provider or switch it back to the recommended one
- Clicking **"Approve Selection"** on that service calls `reviewServiceVendor` (server-side Supervisor-gated via JWT `roleName === 'Claims Supervisor'`)
  - Locks that service with whatever vendor is selected
  - Records `reviewedBy`/`reviewedAt`
  - Recomputes the claim-wide status
- Services already `Locked` (matched, or supervisor-approved) remain read-only regardless of who's viewing

### FR-006 — Completion

- Approving a `Pending Review` service:
  - Removes its badge
  - Locks it with the final vendor
- Once no other service on the claim remains `Pending Review`:
  - `planServiceStatus` automatically reverts to `'Service Provider Finalized'`
  - Claim becomes eligible for the "Mark as Completed" flow
  - No separate claim-wide unlock step needed

## 13. Role-Based Status Display (Claims Command Center)

**See also `SupervisorReview-frd.md`**, built on top of this section's role-based label swap:
- A second review trigger (adding an unrecommended service, not just a provider override)
- A bulk "Confirm Selection" action with mandatory Supervisor comments
- Three final review badges (Modified/Included/Rejected)
- The new Supervisor Comments page

**UI-only.**
- Underlying `planServiceStatus` value stays `'Pending Review'` in MongoDB regardless of who's viewing it
  - Status-based filtering (`stageKey`) unchanged
  - Kanban swimlane grouping unchanged
  - Every business rule in §12 uses `'Pending Review'` internally, unchanged
- Only what's *displayed*, and the adjuster's edit access, differ by role

### Claims Adjuster / Senior Adjuster / Junior Adjuster

- Wherever the `'Pending Review'` stage label would normally render, it instead reads **"Pending Supervisor Approval."**
  - List view status badge
  - Kanban swimlane header
  - Status filter pill
  - Claim Summary drawer's status row
- **List placement**:
  - Claims in this state sort to the **last position** in the List view grid — display order only, independent of any active column sort or the search/stage filter results
  - "Pending Supervisor Approval" swimlane is also the **last column** on the Kanban board
  - Last filter pill (§4.1) — same "sinks to the end" reading order
- **Read-only claim**: per FR-003's update above, once the claim rolls up to `'Pending Review'`, the adjuster who owns it can no longer:
  - Toggle any service on/off
  - Open any vendor dropdown (including on services that are themselves still `'Unconfirmed'`, not just the one under review)
  - See the **"Confirm Service Provider Selection"** button
  - Whole claim is frozen from the adjuster's side until a Claims Supervisor approves the overridden service(s) (FR-005) and/or completes the claim
  - The **Complete** button was already Supervisor-only during Pending Review (FR-005/§12 table) — unchanged

### Claim Supervisor

- Status still reads **"Pending Review"** everywhere
- Existing FR-005 review flow available, unchanged:
  - Edit the overridden service's dropdown
  - **Approve Selection**
  - Or **Complete**
- **Column/pill placement**: unlike the adjuster view, "Pending Review" is the **first** Kanban swimlane and the first status filter pill (§4.1)
  - Supervisor's review queue — leads rather than trails
  - Briefly unified to match the adjuster view's ordering on 2026-07-23, reverted the same day back to this role-dependent order per explicit follow-up
