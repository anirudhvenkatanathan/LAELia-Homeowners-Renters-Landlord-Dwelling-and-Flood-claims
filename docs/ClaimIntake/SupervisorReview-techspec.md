# Claims Supervisor Review & Supervisor Comments Workflow — Technical Spec

- Implements `SupervisorReview-frd.md`
- Extends the per-service `serviceVendorReview[]` array built for the earlier Vendor Override Review Workflow (`claimIntakeMaster-techspec.md` §20)
  - See that section for the original data model this builds on

## 1. Data model — `apps/api/graphQL/claimIntakeEntity.ts`

`ClaimRecordSchema.serviceVendorReview[]` gained 3 fields; `status` gained
3 terminal values:

```ts
{
  roleName: string;
  changeType: string;        // NEW — 'ProviderChange' | 'ServiceAdded'. Absent (null) on entries created before this feature.
  recommendedVendor: string; // unchanged — rule engine's pick
  proposedVendor: string;    // NEW — Adjuster's original pick, frozen once set; never overwritten by a Supervisor's decision
  selectedVendor: string;    // unchanged field — now also the "current/final" vendor; a Supervisor's dropdown edit updates this
  status: string;            // 'Locked' | 'Pending Review' | 'Modified' | 'Included' | 'Rejected'
  confirmedBy: string; confirmedAt: string;   // Adjuster's action, unchanged
  reviewedBy?: string; reviewedAt?: string;    // Supervisor's action, unchanged
  supervisorComment?: string; // NEW
}
```

- `ServiceVendorReview` GraphQL type and `ServiceVendorReviewInput` input both extended to match
- Legacy entries (pre-dating this feature) have `changeType`/`proposedVendor` as `null`
  - Every read path treats a missing `changeType` as `'ProviderChange'` (the only trigger that existed before)
  - Falls back to `selectedVendor` when `proposedVendor` is absent
  - Result: old `Pending Review`/`Locked` entries keep rendering correctly
  - Exception: their "Original Value" on the Supervisor Comments page is less precise (may equal Final Value if the Supervisor didn't change anything) — true pre-review proposal was never captured for them

## 2. New mutation — `confirmSupervisorReview`

```graphql
input SupervisorReviewDecisionInput {
  roleName: String!
  decision: String!     # 'Modified' | 'Included' | 'Rejected'
  finalVendor: String   # Supervisor's final vendor (ProviderChange only)
  comment: String!
}
confirmSupervisorReview(
  uploadId: String!, recordIndex: Int!,
  reviews: [SupervisorReviewDecisionInput!]!,
  reviewedBy: String!, token: String!
): SaveVendorServicesResponse!
```

Resolver (`apps/api/graphQL/claimIntakeEntity.ts`) flow:
- `requireSupervisor(token)` gate (reused, unchanged)
- Rejects with `{success:false}` if any `comment` is blank
- For each decision: updates the matching `serviceVendorReview` entry (`status`, `selectedVendor` when `decision === 'Modified' && finalVendor` is provided, `reviewedBy`, `reviewedAt`, `supervisorComment`)
- For every `Rejected` decision:
  - Resolves `roleName → roleId` via `ServiceRequestRoleModel.find({roleName:{$in:...}})` (same pattern as the existing `roleNameMap` lookups elsewhere in this file)
  - Removes that role's id from `confirmedPlanServices`/`planServices`/`existingplanservices`
  - Drops its vendor from `vendorServices` only if no other still-active service uses it
- Recomputes `planServiceStatus` via the existing `deriveClaimStatus` (untouched — it already just checks for any remaining `'Pending Review'` entry)

- Existing single-service `reviewServiceVendor` mutation from the earlier workflow is **left in place, unwired**
  - No UI calls it anymore (`claimIntakeDetails/index.tsx` no longer imports it)
  - Matches this repo's established "don't delete, just stop wiring" pattern for superseded flows

**2026-07-22 simplification:**
- Mutation's `reviews` argument still accepts an array — unchanged shape/resolver logic, no backend change for this revision.
- Frontend now calls it with a single-element array as soon as a Supervisor confirms one service's review popup.
- No more batched multi-decision call from the UI.
- Resolver's loop-over-`reviews` shape kept as-is (rather than adding a separate single-decision mutation):
  - Already handles a length-1 array identically to a length-N one.
  - Keeping one mutation avoids two near-duplicate resolvers.

## 3. New query — `getSupervisorReviewedClaims(adjusterName: String!)`

- Scans `ClaimRecordModel` for records with an `$elemMatch` on `serviceVendorReview` where `confirmedBy === adjusterName` and `status` is one of `['Modified','Included','Rejected']`
- For each match: filters down to just that Adjuster's own reviewed entries, maps each to a `SupervisorReviewedItem`:

- `displayChangeType`:
  - `'Provider Change'` for `ProviderChange`
  - `'Service Added'`/`'Service Removed'` for `ServiceAdded`, chosen by whether the final `status` is `Included` or `Rejected`
  - Computed at query time, not stored
- `originalValue`/`finalValue`:
  - `proposedVendor`/`selectedVendor` for `ProviderChange`
  - Literal strings `'Added'`/`'Included'`/`'Removed'` for `ServiceAdded`
- Claims sorted by their most-recently-reviewed item, descending

## 4. Sidebar menu

- `menu-claim-supervisor-comments-001` (label "Supervisor Comments", icon
  `inbox`, path `/claim-supervisor-comments`, `parentId: null`) was already
  live in `triage_menus` but missing from `scripts/seedMenu.ts` — added there
  for reproducibility.
- Added to `ADJUSTER_MENU_IDS` in `scripts/migrateDemoUsersToTable.ts`
  (previously only had `menu-claim-intake-001`).

**Pre-existing data-hygiene issues found and fixed while re-running the seed
pipeline** (unrelated to this feature, but blocked it):
- `migrateDemoUsersToTable.ts`'s `DEMO_USER_SEED_DATA` had `loginId` values
  (`adjuster-login-001`, `supervisor-login-001`) that didn't match the real
  live `login_user` documents for those emails (`clientadj-login-001`,
  `client-login-001`).
  - Corrected the source file to match reality.
  - Corrected the corresponding stale `demo_users` documents' `loginId`.
  - Also corrected the adjuster row's `menuIds`
    - A `$setOnInsert`-based upsert never updates it on an existing document
    - Done via a one-off direct fix
- `seedUserManagementDemoData.ts` granted menu access using a per-user
  existence check (`hasAccess = findOne({loginId})`) instead of per-menuId.
  - Meant re-running it after `ADJUSTER_MENU_IDS` gained a new entry silently
    skipped already-seeded users (Sarah/James/Priya Nair/Derek).
  - Changed to a per-`(loginId, menuId)` upsert so it's both idempotent and
    incremental.

## 5. Frontend — `apps/frontEnd/src/pages/ClaimIntake/claimIntakeDetails/index.tsx`

### 5.1 Adjuster side — `confirmVendorSelection`

- Computes `recommendedRoleNames` (union of `confirmedPlanServiceNames` and a baseline "recommended" name list — see the bug fix below)
- For each active, not-yet-reviewed-and-done role (`!isServiceLockedStatus(getServiceStatus(role))` — a helper treating `Locked`/`Modified`/`Included` alike as "done"):
  - Not in `recommendedRoleNames` → `changeType: 'ServiceAdded'`, always `status: 'Pending Review'`, `proposedVendor`/`selectedVendor` both set to the currently-picked vendor, `recommendedVendor: ''`
  - In `recommendedRoleNames` → existing provider-compare logic (unchanged), now also stamping `changeType: 'ProviderChange'` and `proposedVendor`

**Bug fixed (2026-07-22): "Add a new service" never actually produced a
`ServiceAdded` entry.**
- `recommendedRoleNames` originally unioned `confirmedPlanServiceNames` with
  `selectedRecord.planServiceNames` (the *live*, server-refreshed value) —
  looked right, but:
  - `planServiceNames` is derived from `planServices`.
  - `planServices` gets overwritten the moment *any* role is toggled:
    `handleRoleToggle`'s `confirmToggle()` calls
    `saveDraftPlanServices({planServices: <current active roles as ids>})`
    immediately per toggle (a pre-existing, unrelated draft-autosave
    mechanism), and the very next `refresh()` pulls that back into
    `selectedRecord`.
  - By the time an Adjuster actually clicked "Confirm Selection" after adding an unrecommended service, that service's role name was *already* sitting in `planServiceNames`
    - Made `recommendedRoleNames.has(role)` true
    - Routed it into the `ProviderChange` branch instead of `ServiceAdded`, even though never rule-engine-recommended at all
  - Every test earlier in this feature's development bypassed this entirely by POSTing `changeType: 'ServiceAdded'` directly via `curl`
    - Real toggle → draft save → confirm path was never actually exercised end-to-end until now
- Fixed by unioning `confirmedPlanServiceNames` with `initialPlanNames`
  instead:
  - `initialPlanNames` is a `useRef` snapshot (`initialPlanNamesRef`,
    pre-existing, built for the Audit Trail's added/removed diffing)
    captured once per record-load, *before* any toggle this session can
    touch it.
  - Stays a true "what was recommended when this session started" baseline
    regardless of how many roles get drafted afterward.
  - `confirmedPlanServiceNames` itself was never affected by this bug
    - Only `savePlanServices`'s full commit touches it, not the interim draft save
  - `confirmVendorSelection` reads it from the not-yet-`refresh()`-ed `selectedRecord`
    - I.e. still the pre-this-click value

**Second bug fixed (2026-07-22, same day, reported after the fix above went
live): recommended services were *also* being flagged `Pending Review`.**
- The fix above only moved *which* name list `recommendedRoleNames` unions
  with `confirmedPlanServiceNames` — it didn't fix how `initialPlanNamesRef`
  itself picks a baseline.
- That selection was gated on `planServiceStatus`:
```ts
const baselineNames = (status === 'Pending Selection' || status === 'Finalized Selection')
  ? (selectedRecord.confirmedPlanServiceNames ?? [])
  : (selectedRecord.planServiceNames ?? []);
```
- This condition predates the earlier 2-status rename (§ external rename,
  ruled out above) from the old 3-status flow:
  - A claim that had never been touched had *neither* status string yet
    - `else` branch (fall back to `planServiceNames`, the rule-recommended list) was reachable
  - Once `planServiceStatus` collapsed to exactly two possible values, the `if` became a tautology — every claim matches it
    - Baseline was *unconditionally* `confirmedPlanServiceNames`
    - Empty for any claim that has never been through a full "Confirm Selection" yet
  - `initialPlanNames` then snapshotted as `[]`
    - `recommendedRoleNames` was empty too
    - Every active role — including the genuinely rule-recommended ones — failed `recommendedRoleNames.has(role)`
    - Misclassified `changeType: 'ServiceAdded'`, `status: 'Pending Review'`
- Fixed by dropping the status branch entirely and always snapshotting the
  union of both lists as they stood at load:
```ts
const baselineNames = Array.from(new Set([
  ...(selectedRecord.confirmedPlanServiceNames ?? []),
  ...(selectedRecord.planServiceNames ?? []),
]));
```
- Simpler than the status-gated version, correct in both cases:
  - A never-confirmed claim's `confirmedPlanServiceNames` is empty
    - Union reduces to `planServiceNames` (the rule-recommended list)
  - An already-confirmed claim's union additionally protects any Supervisor-approved-and-since-normal addition from being re-flagged on a later edit pass
    - No need to know which case applies ahead of time

### 5.2 `getServiceStatus` / `isServiceLockedStatus`

- `getServiceStatus`'s return type widened to include the 3 terminal states
- New `isServiceLockedStatus(status)` returns true for `Locked`/`Modified`/`Included`
  - Everywhere the code previously special-cased `=== 'Locked'` for "done, no longer editable" (`isConfirmed`, and the `confirmVendorSelection` skip-filter above) now uses this helper instead
- `Rejected` intentionally excluded
  - A rejected role is removed from `activeServiceRoles` server-side
  - Simply stops rendering as an active service
  - No special-case needed for it in the active-services loop

### 5.3 Supervisor review UI — no per-service Approve button

Removed entirely (per FRD §6 — an explicit removal, not a "leave unused" case):
- `approveServiceVendor`
- `reviewingRole` state
- the `isSupervisor && <button>Approve Selection</button>` block
- the `reviewServiceVendor` import

Replaced with:
- `needsReview = isSupervisor && getServiceStatus(role) === 'Pending Review'`
  computed per role in the render loop, adding `.cid-vendor-item--needs-review`
  to that row's class list.
- **Bug fixed (2026-07-22):**
  - Role-toggle row's click guard originally included `!disableplanChange` (`existingRoles?.some(r => r.roleName === role)`)
    - `true` for *any* role already present in `existingplanservices`
    - Including a freshly-added `ServiceAdded` role — the Adjuster's own confirm already wrote it there
  - That silently blocked the Supervisor from ever toggling a Pending-Review "Service Added" row off
    - Row visually rendered an interactive toggle (not the lock icon) regardless
    - Lock-icon condition never checked `disableplanChange` to begin with
  - Fixed by computing `adjusterCanToggle` (the original guard, unchanged, still gates the Adjuster's own edits) and `rowClickable = needsReview || adjusterCanToggle`
    - Uses `rowClickable` for both the `onClick` guard and the cursor style
  - A Supervisor can now toggle a Pending-Review `ServiceAdded` role regardless of `disableplanChange`/`vendorsForRole`
    - Those guards exist to freeze an *Adjuster's* already-confirmed plan
    - Not meant to block the Supervisor's own review decision on a role awaiting it
- **Popup-based review (2026-07-22 redesign):**
  - `handleRoleToggle`/`handleVendorDropdownChange` each gained an early branch — `if (isSupervisor && getServiceStatus(role) === 'Pending Review')`
  - That branch opens a new `SupervisorReviewModal` (`openSupervisorReviewModal`)
    - Instead of either applying the change inline or opening the existing Adjuster-facing `ReasonModal`/`VendorSwitchModal` (a different, pre-existing audit-log flow)
  - A `PendingSupervisorReview` state (`{role, changeType, toVendor?, keep?}`) drives the modal
- **Staged, applied only on Confirm Selection (2026-07-22: briefly changed to
  apply immediately; reverted 2026-07-23 back to staged, per explicit
  follow-up — "only when confirm selection is clicked then only the status
  of claim should change").**
  - `confirmSupervisorReviewDecision()` (the modal's "Confirm" handler) is
    synchronous and makes **no network call**.
  - It writes `{decision, finalVendor?, comment}` into a
    `supervisorStagedDecisions: Record<string, {...}>` state keyed by
    roleName.
  - Then updates local UI state immediately so the change is visible right
    away without waiting on a round-trip:
    - `roleVendorMap[role]` for a `ProviderChange`.
    - Removes `role` from `activeServiceRoles` for a `ServiceAdded` role
      staged as `Rejected`.
    - Same local-only pattern the Adjuster's own
      `confirmToggle`/`handleVendorDropdownChange` already use.
  - Nothing is sent to the server and `planServiceStatus` does not change
    until the shared "Confirm Selection" button is clicked — see
    `confirmVendorSelection` below for how the staged map gets folded into
    that submission.
  - Cancel discards the popup without touching `supervisorStagedDecisions`.
  - No more `savingSupervisorReview` boolean or "Confirming…" loading state on the popup's buttons
    - Confirming it is now a synchronous, local-only operation

  **`confirmVendorSelection` changes to consume the staged map:**
  - `!isAdjuster && getServiceStatus(role) === 'Pending Review'` branch (for a role still in `activeServiceRoles` — i.e. `ProviderChange`, or `ServiceAdded` staged `Included`, or untouched/silent-accept)
    - Now reads `supervisorStagedDecisions[role]` first
    - If present: uses its `finalVendor`/`comment`/`decision` instead of the untouched-role silent-accept defaults (`Included`/`Modified`, no comment)
  - A **separate pass**, `stagedRejectedEntries`, builds an entry for every
    `supervisorStagedDecisions` key with `decision === 'Rejected'` that is
    **not** in `activeServiceRoles`:
    - i.e. a `ServiceAdded` role staged as Rejected, already removed from
      `activeServiceRoles` at staging time.
    - Main `.map()` only iterates `activeServiceRoles`
      - Would never visit this role again
    - Without this second pass its `serviceVendorReview` entry would stay `'Pending Review'` forever
      - Nothing else ever revisits a role once it's inactive
    - Both arrays concatenated and sent to `saveVendors`/`saveVendorServices` together
    - `planServiceIds` for that same call is `activeServiceRoles.map(...)` (`saveVendors`, pre-existing)
      - Already correctly excludes a staged-Rejected role, since it was removed from `activeServiceRoles` when staged
      - `confirmedPlanServices`/`existingplanservices` end up correct with no extra work
  - `supervisorStagedDecisions` is reset to `{}` after a successful
    `saveVendors` call.
  - `hasUnconfirmedServices` (gates whether the "Confirm Selection" button shows at all) gained `|| Object.keys(supervisorStagedDecisions).length > 0`
    - Without it: staging a Rejected decision (removes the role from `activeServiceRoles`) could make the button disappear while a staged decision was still waiting to be submitted
    - Rest of that check only scans roles still in `activeServiceRoles`
  - `confirmSupervisorReview` mutation/service import no longer used by this component
    - Left in place, unwired, matching the repo's established "don't delete, just stop wiring" pattern
    - Everything now goes through the existing `saveVendorServices` merge-by-roleName path instead of a dedicated mutation call
- **No "Add Review Comment" trigger.**
  - The vendor dropdown and the service toggle are the *only* two ways to
    open the popup.
  - Per feedback, a separate always-visible "comment" affordance was
    redundant with them and has been removed
    (`.cid-supervisor-review-trigger` deleted from both the JSX and
    `custom.css`).
  - A provider-override service the Supervisor never opens the dropdown
    for is left `Pending Review` indefinitely — no comment, no
    forced resolution.
  - The Supervisor can still complete the claim regardless
    (`canCompleteClaim`'s existing `!isPendingReview || isSupervisor` gate,
    unchanged).
- Badge/label rendering: existing "Pending Review" block still branches on `changeType`
  - `ServiceAdded` shows "Added by {name} — not originally recommended" instead of "Overridden by {name}"
    - Latter only makes sense for a provider change
  - "Selected Service Provider" value reads `roleVendorMap[role] || reviewEntry.selectedVendor`
  - **Removed (2026-07-24):**
    - Claim details page previously rendered a final badge (`badge-orange` for Modified, `badge-blue` for Included) plus the Supervisor's quoted comment once `serviceStatus` was `Modified`/`Included`
    - Per updated requirement, that block (badge and comment together) removed from this page entirely, for every claim — not just reprocessed ones
    - Outcome now only visible on the Supervisor Comments page (§6)
    - An earlier, narrower fix had hidden just the comment (not the badge) for reprocessed claims specifically (`isReprocessed` check on `existingplanservices`/`planServiceStatus`)
      - That check removed along with the whole block, superseded by this broader hide
- **Single "Confirm Selection" button, shared by both roles (2026-07-22 simplification, refined twice same day):**
  - Pre-existing Adjuster button relabeled from "Confirm Service Provider Selection" to "Confirm Selection"
  - Same `showConfirmButton`/`confirmServiceProviderSelection` handler, unchanged
  - Only button of its kind on the screen
  - **The disabled condition was removed entirely** (per explicit
    feedback — "I need the confirm selection enabled... always"): the
    button's `disabled` prop no longer references `hasUnconfirmedServices`,
    only the fundamental "nothing to submit" guards
    (`activeServiceRoles.length===0`, no vendor picked, a save already in
    flight).
  - **The Supervisor's silent-accept covers both trigger types (2026-07-22,
    widened same day):**
    - `confirmVendorSelection`'s role filter is
      `!isServiceLockedStatus(getServiceStatus(role))` — no `changeType`
      restriction.
    - A `Pending Review` `'ServiceAdded'` role reaching this filter is, by construction, one the Supervisor left untouched
      - Turning one **off** applies `Rejected` immediately via the popup (§7), also removes the role from `activeServiceRoles`/`confirmedPlanServices` server-side
      - No longer in the array `confirmVendorSelection` iterates at all by the time Confirm Selection runs
      - No risk of silently re-including something the Supervisor just rejected
    - In the per-role `.map()`, the `!isAdjuster && getServiceStatus(role)
      === 'Pending Review'` branch now reads that role's `changeType`
      (defaulting absent/legacy to `'ProviderChange'`) and returns
      `status: 'Included'` for `'ServiceAdded'` or `status: 'Modified'`
      for `'ProviderChange'` — both with no `supervisorComment`.
    - This is how an as-is-accepted entry is distinguished from a
      popup-reviewed one (no comment), while still correctly attributing
      who reviewed it (below).
    - **Bug fixed (2026-07-22):**
      - `confirmedBy`/`confirmedAt` were originally taken from the top-level `confirmedBy`/`confirmedAt` consts
        - Those represent *whoever is currently confirming* — correct for the Adjuster's own branches
        - Wrong here — it's the *Supervisor* calling this button
      - `saveVendorServices` replaces each `serviceVendorReview` entry wholesale (not a partial merge)
        - This silently overwrote the original Adjuster's name with the Supervisor's
      - Broke `getSupervisorReviewedClaims(adjusterName)` — scoped by exact `confirmedBy` match
        - Item vanished from *that Adjuster's* Supervisor Comments page entirely
        - Would incorrectly appear on the Supervisor's own, if they ever looked
      - Fixed by reading `getServiceVendorEntry(role)` first and sending
        its existing `confirmedBy`/`confirmedAt` (falling back to the
        top-level consts only if absent) — **before** falling through to
        the pre-existing `isOverridden` ternary (`isAdjuster`-only branch,
        unaffected, still used for the Adjuster's own confirm).
      - `hasUnconfirmedServices` (still gates `showConfirmButton`'s
        visibility, not clickability) grew the matching change:
        `isSupervisor && status === 'Pending Review'` with no `changeType`
        check either.
      - No backend change was needed for any of this —
        `saveVendorServices`'s merge-by-roleName already overwrites the
        `'Pending Review'` entry with whatever status is sent, and
        `deriveClaimStatus` already treats any non-`'Pending Review'`
        status (`'Modified'`/`'Included'`/`'Rejected'` alike) as resolved,
        so the claim rolls up to `'Service Provider Finalized'`
        ("Finalized Selection" badge) once every entry clears `'Pending
        Review'`.
  - **"Reviewed by — · —" fixed, `ServiceVendorReviewInput` extended
    (2026-07-22):**
    - This mutation's input type never had `reviewedBy`/`reviewedAt`/`supervisorComment` fields (only the output `ServiceVendorReview` type did)
      - A gap from when the type was first extended (§ above)
      - Only became visible once entries could reach `Modified`/`Included` through this path instead of through `confirmSupervisorReview` (which always sets them)
    - Added all 3 as optional fields to `ServiceVendorReviewInput`
      (schema/typeDefs only — the resolver already stores whatever
      `serviceVendorReview` array it's given, no resolver change needed).
    - Supervisor's silent-accept branch now sends `reviewedBy: confirmedBy, reviewedAt: confirmedAt`
      - Reuses the *current-user* values (the Supervisor, at the moment of this click)
      - Same values `confirmedBy`/`confirmedAt` would have held before being renamed to `originalConfirmedBy`/`originalConfirmedAt` above
    - Requires an API restart (schema change, not hot-reloadable under
      `ts-node`).
  - **"Added" badge (2026-07-22):**
    - The `'Pending Review'` block for a `'ServiceAdded'` entry now shows
      a `badge-blue` **"Added"** pill next to the `badge-orange` **"Pending
      Review"** one (previously the change type was only conveyed via
      plain muted text).
    - Newly-added service is visually distinguishable from a provider-override row at a glance
      - Consistent with how both eventually get their own distinct final badges (`Included`/`Rejected` vs. `Modified`)

## 6. Frontend — new page `SupervisorComments`

- `apps/frontEnd/src/hooks/claimIntakeMaster/useSupervisorReviewedClaims.ts`
  - Mirrors `useAdjusterUsers`'s shape (`{claims, loading, error, refresh}`)
  - Fetches via the new `getSupervisorReviewedClaims` service call keyed on `user.fullName || user.username`
- `apps/frontEnd/src/pages/ClaimIntake/SupervisorComments/index.tsx` — new page
  - Layout: `AppShell` → `.page-card`/`.page-header` (title/subtitle + a `.csc-header__count` pill showing the claim count) → `.csc-body` split panel
  - `.csc-list` (left): one `.csc-list__row` card per claim — a subtle bordered/shadowed row, `border-left` tinted by the claim's most attention-worthy outcome via `dominantAccent()` (Rejected > Modified > Included), with a per-badge count summary and a clock-icon last-reviewed date
  - `.csc-detail` (right): one `.csc-item` card per reviewed item
  - **2026-07-22 redesign** for a more polished, on-brand look:
    - Item cards are white (not full-card-tinted) with only a `border-left` accent matching `finalBadge`'s tone (reusing the same 3 accent colors as the list's dominant-outcome border)
    - A change-type eyebrow label above the role name
    - An arrow icon between `originalValue`/`finalValue` (bold)
    - The comment in a neutral gray quote block with a quote-mark icon (not tinted to the badge color — kept legible/subdued rather than loud)
    - A reviewer-initials avatar chip in the meta row
    - An empty state (`.csc-empty`, icon + title + subtitle) replaced the old plain `<p className="cim-board-empty">` line
    - Selecting a claim just sets local `selectedKey` state
    - First claim selected by default
- Route `/claim-supervisor-comments` added to `App.tsx`, same `<ProtectedRoute>` pattern as every other route
- Models:
  - `ServiceVendorReview` extended to match the backend
  - `SupervisorReviewedClaim`/`SupervisorReviewedItem` added, in `models/claimIntakeMaster/claimIntakeModel.ts`
- Service layer (`services/claimIntakeMaster/claimIntakeService.ts`):
  - `confirmSupervisorReview()`/`getSupervisorReviewedClaims()` added, following the file's existing try/catch + `logError` shape
  - 3 new `serviceVendorReview` sub-fields added to both existing queries that select it (`GET_ALL_CLAIM_RECORDS_QUERY`, `UPLOADED_CLAIM_DETAILS_QUERY`)

**"All" Date Range option:** added as a page-local addition, not a change to the shared dashboard date-range model (`models/dashboard/executiveOverviewModel.ts`)
- Dashboard's Executive Overview date filter unaffected
- `SupervisorComments/index.tsx` defines its own `SupervisorDateRangeValue = 'all' | DateRangeValue` and `SUPERVISOR_DATE_RANGE_OPTIONS` (prepends `{label:'All', value:'all'}` to the shared `DATE_RANGE_OPTIONS`)
  - `DEFAULT_SUPERVISOR_DATE_RANGE = 'all'` as the page's initial `useState`
  - `DEFAULT_DATE_RANGE` (`'today'`) in the shared model untouched
- `isWithinDateRange()` short-circuits `range === 'all'` to `true` before any date math
  - No filtering applied
  - `filteredClaims` (and therefore the `.csc-header__count` badge and the "No claims match your filters" empty state, both already derived from `filteredClaims.length`) fall back to the full unfiltered `claims` list
- `components/dashboard/DateRangePicker.tsx` generalized to accept an optional `options` prop (`readonly {label,value:T}[]`), made generic over `T extends string = DateRangeValue`
  - Renders either the shared dashboard options (default, unchanged call sites) or a page-local option set
  - Only shared file touched by this change

**Specific-date calendar picker:**
- New shared component, `components/dashboard/SpecificDatePicker.tsx`
  (`value: string | null` as `'YYYY-MM-DD'` local, `onChange`),
  self-contained — no date-picker npm dependency added, consistent with
  the approved-tech-stack rule in `AGENTS.md`.
- Renders a calendar-icon trigger button; clicking toggles a
  `.dp-picker__panel` popover (month grid, prev/next nav, weekday header,
  today highlighted, selected day tinted) built from scratch with plain
  `Date` math — no external calendar library.
- Outside-click/`Escape` close via the same `useRef` +
  `document.addEventListener('mousedown', …)` pattern as
  `components/dashboard/MultiSelect.tsx`.
- New CSS block `.dp-picker*` added to `skin/css/custom.css` (trigger,
  popover, nav, grid, day states), reusing existing design tokens
  (`--color-primary`, `--color-border`, `--radius-sm`, etc.) — no new
  tokens introduced.
- The popover's footer "Today"/"Clear" quick-actions were removed per
  feedback; clearing a picked date is done via the `×` on the trigger
  itself (`aria-label="Clear selected date"`), shown only when a date is
  active.

Wired into `SupervisorComments/index.tsx`:
- New state `specificDate: string | null`, rendered as
  `<SpecificDatePicker value={specificDate} onChange={setSpecificDate} />`
  next to `<DateRangePicker>` in the same `.kpi-filter-bar` — additive, the
  dropdown is not removed or hidden.
- New helper `isOnSpecificDate(iso, dateIso)` — local calendar-day equality
  check (mirrors `isWithinDateRange`'s no-op/short-circuit style).
- `filteredClaims`'s date check is now `specificDate ? !isOnSpecificDate(...) : !isWithinDateRange(...)`
  - Either/or, not a combined AND
  - Specific date fully **overrides** the dropdown's range while set
  - ANDing a specific day with a broader range would be redundant (the day already satisfies any range it falls within)
  - ANDing with a narrower range would silently produce confusing empty results
- Dropdown's `onChange` handler now also calls `setSpecificDate(null)`
  - Picking a relative range clears any active specific date
  - Two controls mutually exclusive by construction, never fighting over which one is "active"
  - Dropdown's own displayed value untouched by picking a specific date (keeps showing whatever it was)
  - Simply stops affecting `filteredClaims` until the specific date is cleared
- `.csc-header__count` and the "No claims match your filters" empty state need no separate wiring
  - Both already derive from `filteredClaims.length`

## 7. CSS — `skin/css/custom.css`

- `.cid-vendor-item--needs-review` — light amber highlight (reuses the
  `#FDF3EB`/`#B45309` tokens from the Kanban "Pending Review" column).
  ~~`.cid-supervisor-comment`~~ (inline textarea) and
  ~~`.cid-supervisor-review-trigger`~~ ("Add Review Comment" pill) were
  both later removed in favor of `SupervisorReviewModal` — see §5.3.
- `.csc-*` — new Supervisor Comments page layout (list rows, detail cards
  tinted by final badge). Final badges themselves reuse the existing
  `.badge-orange`/`.badge-blue`/`.badge-red` classes app-wide — no new badge
  colors were introduced.

## 7b. Bug fixed (2026-07-22): Supervisor's provider switch never reached "confirmed vendor"

- Reported as: recommended = A, Adjuster overrides to B (→ `Pending
  Review`), Supervisor reviews and switches to A or C — the claim should
  then show A/C as the confirmed vendor, but kept showing B.
- Two compounding bugs, both in the popup-based review path
  (`confirmSupervisorReview`, §2):
  - **Backend** (`apps/api/graphQL/claimIntakeEntity.ts`):
    - Resolver correctly wrote the Supervisor's `finalVendor` into that one `serviceVendorReview` entry's `selectedVendor`
    - Top-level `vendorServices` array — the field `fetchVendorsForRoles`, `activeVendors`, the "Previously Selected" card, and the Provider Scoreboard all read as "the confirmed vendor" — was carried forward unchanged from `existing.vendorServices` (only ever *filtered*, and only when a rejection occurred)
    - So B stayed in `vendorServices`, A/C was never added
    - Fixed by always rebuilding `vendorServices` from `updatedReview` — `[...new Set(updatedReview.filter(e => e.status !== 'Rejected').map(e => e.selectedVendor).filter(Boolean))]`
      - Same approach the older `reviewServiceVendor` mutation already used, just previously missing from this newer one
  - **Frontend** (`claimIntakeDetails/index.tsx`, `confirmSupervisorReviewDecision`):
    - `roleVendorMap` (the local state the "Confirmed/Recommended Service Provider" label actually reads, via `selectedVendor` at line ~1392) is never derived from `selectedRecord`
      - Only gets synced from the server's `vendorServices` by `fetchVendorsForRoles`
      - That itself only re-runs when the surrounding `useEffect`'s dependencies (`planServiceStatus`, `planServiceNames`) change
    - If another role on the same claim was still `Pending Review`, `planServiceStatus` wouldn't flip on this one role's confirm
      - Effect wouldn't re-run, `roleVendorMap` would stay stale even after the backend fix
    - Fixed by setting `roleVendorMap[role] = toVendor` directly inside `confirmSupervisorReviewDecision` right after a successful `confirmSupervisorReview` call, independent of any broader refetch
- Both fixes needed together:
  - Backend fix alone would still show the stale vendor in the same session until an unrelated status change triggered a refetch
  - Frontend fix alone would show the right vendor locally but every other reader of `vendorServices` (Provider Scoreboard, Supervisor Comments' `finalValue`, "Previously Selected" card) would still see B

**Third bug fixed (2026-07-22, same day — user reported "still same issue"
after the two fixes above went live):**
- `fetchVendorsForRoles`'s restore logic (`claimIntakeDetails/index.tsx`) never actually read the per-role `serviceVendorReview[role].selectedVendor` at all
- Instead restored `roleVendorMap[role]` by intersecting THIS role's own ranked vendor list against the flat, claim-wide `confirmedVendors` (`selectedRecord.vendorServices`) array
  - Took whichever vendor in the role's list came first that also happened to appear *anywhere* in that claim-wide set:
```ts
const confirmedVendor = vendors.find(v => confirmedVendors.includes(v.companyName))?.companyName
```
- Wrong on any claim with more than one service role
  - If a sibling role's confirmed vendor also ranks near the top of *this* role's mapped list (a common vendor serving multiple roles), that sibling's vendor wins the match instead of this role's own selection
- So even after the backend correctly wrote A/C into `vendorServices`, the very next vendor refetch (runs after every `refresh()`, including the one at the end of `confirmSupervisorReviewDecision`) silently overwrote the just-fixed local state with the wrong vendor again
- Explains why the first two fixes (§ above) didn't hold
  - They fixed the write path and one moment of local state
  - This read/restore path ran again right after and clobbered it
- Fixed by preferring the role's own `getServiceVendorEntry(roleName)?.selectedVendor` (the authoritative per-role source, already used everywhere else on this page) whenever it exists
  - Falls back to the old claim-wide intersect only for legacy records with no `serviceVendorReview` entry at all

## 8. Verified

- `tsc --noEmit` clean on both `apps/api` and `apps/frontEnd`.
- Backend `jest`: 20/20 passing (unchanged). Frontend `vitest`: 452/452
  passing (unchanged from before this feature).
- Direct GraphQL, end-to-end, forged Supervisor JWT:
  - (a) An existing legacy `Pending Review` entry (predating
    `changeType`/`proposedVendor`) confirmed via `confirmSupervisorReview`
    with `decision: 'Modified'` → correctly became `status: 'Modified'`
    with `supervisorComment`/`reviewedBy`/`reviewedAt` set, claim rolled
    up to `'Service Provider Finalized'`.
  - (b) A fresh `ServiceAdded` entry submitted via `saveVendorServices`
    then rejected via `confirmSupervisorReview` → confirmed the role was
    removed from `confirmedPlanServiceNames`/`existingplanservices`, its
    vendor dropped from `vendorServices`.
  - (c) A fresh `ProviderChange` entry with an explicit `proposedVendor`
    distinct from the Supervisor's chosen `finalVendor` →
    `getSupervisorReviewedClaims` correctly returned `originalValue !==
    finalValue`, proving the "Adjuster's proposal" is preserved
    independently of the Supervisor's final decision.
- API restarted (schema/resolver change, not hot-reloadable under
  `ts-node`); Vite HMR applied every frontend file without a full reload or
  console error.
- **2026-07-22, confirmedBy fix:**
  - Reproduced the reported bug directly against the user's own live test claim before fixing it
    - `getSupervisorReviewedClaims("Priya Nair")` returned only the `Modified` item, missing the `Included` one entirely
    - Querying with `adjusterName: "claimssupervisor"` (the Supervisor's own login) wrongly returned it instead
    - Confirmed `confirmedBy` had been overwritten
  - After the frontend fix: corrected that one live entry's `confirmedBy` back to `"Priya Nair"` via a direct `saveVendorServices` call
    - Data correction only — same claim, same status/vendor, `confirmedBy` field only
  - Re-verified `getSupervisorReviewedClaims("Priya Nair")` then returned
    both items correctly.
  - New silent-accepts no longer need this manual correction — the
    frontend fix keeps `confirmedBy` correct going forward.
- **2026-07-22, `reviewedBy` fix:**
  - After extending `ServiceVendorReviewInput` and restarting the API,
    sent a `saveVendorServices` call with `reviewedBy`/`reviewedAt`
    populated for the same live "IME / peer review" entry.
  - Re-queried `getSupervisorReviewedClaims("Priya Nair")` — both items
    now return a populated `reviewedBy`/`reviewedAt` instead of blank.
  - Backend `jest` (20/20) and frontend `vitest` (452/452) re-run clean
    after the schema change.
- **2026-07-22, `initialPlanNames` fix (§5.1):**
  - While investigating: independently confirmed `apps/api/graphQL/claimIntakeEntity.ts` and `claimIntakeMaster/index.tsx`/`claimIntakeDetails/index.tsx` had all already been externally updated, consistently, to a simplified 2-status flow (`'Pending Selection'`/`'Finalized Selection'`)
    - Replacing the old 3-status `'Pending Service Selection'`/`'Pending Service Provider Selection'`/`'Service Provider Finalized'`
  - Grepped every `planServiceStatus`-literal comparison across both apps, found no stale/mismatched string
    - Ruled that rename out as a contributing cause before looking further
  - Actual bug (`planServiceNames` pollution via `saveDraftPlanServices`) confirmed against the live claim's own `planServices`/`planServiceNames`
    - Already containing services beyond what a fresh upload would recommend, consistent with the drafted-then-reused array
  - Frontend `vitest` (459/459) re-run clean after the fix
- **2026-07-22, `initialPlanNamesRef` baseline-selection fix (§5.1, second bug):**
  - User reported the same "adding a new service doesn't work" symptom again after the fix above
    - This time as "the default recommended services also go to Pending Review, which should not happen"
  - Traced to the `planServiceStatus === 'Pending Selection' || planServiceStatus === 'Finalized Selection'` condition guarding `initialPlanNamesRef`'s baseline selection having become a tautology after the earlier 2-status rename
    - See the write-up above
  - Fixed by removing the status branch, always snapshotting the union of `confirmedPlanServiceNames` and `planServiceNames` at load
  - `tsc --noEmit` clean on `apps/frontEnd` after the fix
  - Both dev servers restarted (Vite HMR + a full API restart) for live testing
- **2026-07-22, Supervisor's vendor-switch fix (§7b):**
  - `tsc --noEmit` clean on both `apps/api` and `apps/frontEnd`.
  - Backend `jest` 20/20 and frontend `vitest` 459/459 both re-run clean
    after the resolver change.
  - API restarted (resolver logic change, not hot-reloadable under
    `ts-node`).
- **2026-07-22, `fetchVendorsForRoles` restore-logic fix (§7b, third bug):**
  - `tsc --noEmit` clean on `apps/frontEnd`.
  - Frontend `vitest` 459/459 re-run clean after the fix.
  - Frontend restarted (Vite HMR) for live testing.
- **2026-07-23, staged-model revert — investigation before the fix:**
  - User reported two symptoms together:
    - (a) the claim's status appeared to change before "Confirm
      Selection" was clicked.
    - (b) toggling off a Supervisor-added-then-rejected service required
      two attempts — the first toggle asked for a reason but didn't
      actually uncheck the row; only a second toggle+reason correctly
      unchecked it.
  - Before assuming a frontend bug: reproduced the exact single-call sequence directly against the live backend (`confirmSupervisorReview` with `decision: 'Rejected'`, forged Supervisor JWT) on a real claim, seeded with a temporary test `serviceVendorReview` entry for this purpose (removed again after)
    - Confirmed the resolver correctly removed the role's id from `planServices`/`confirmedPlanServices`/`existingplanservices` and set `status: 'Rejected'` in a **single call**
    - Ruled out a backend persistence bug
  - Concluded the flakiness was inherent to the "apply-immediately-then-refetch" architecture itself (a client/server round-trip the toggle's visual state depended on)
    - Reverting to a staged model (§5.3 above) satisfies the explicit "only change on Confirm Selection" requirement
    - Also removes the network dependency the toggle's reliability was riding on
  - `tsc --noEmit` clean on both `apps/api` (unchanged, verified as a baseline) and `apps/frontEnd`
  - Backend `jest` 20/20 and frontend `vitest` 459/459 re-run clean after the frontend-only revert
  - No backend changes needed for this revert
    - `saveVendorServices`'s existing merge-by-roleName already supports everything the staged submission needs
- **2026-07-23, same day, follow-up: "the removed service still shows as
  selected" — full end-to-end verification, plus one real bug found and
  fixed.**
  - Before touching frontend code again, ran a full simulation of the
    exact 2-mutation sequence `confirmServiceProviderSelection` performs
    (`savePlanServices` then `saveVendorServices`), reproducing precisely
    what the new staged-model frontend code would send after a
    Supervisor stages a `ServiceAdded` role's rejection and then clicks
    Confirm Selection — on a real claim seeded with a temporary test
    entry (removed again after).
  - Result: `planServices`/`confirmedPlanServices`/`existingplanservices`
    correctly excluded the rejected role's id, `vendorServices` correctly
    excluded its vendor, and its `serviceVendorReview` entry correctly
    showed `status: 'Rejected'` with the comment — **the data layer
    end-to-end is fully correct** for this exact payload shape.
  - **Bug found in the payload-building code itself, not the backend:**
    `confirmSupervisorReviewDecision`'s staged-rejection branch removed the
    role from `activeServiceRoles` but never cleared its entry from
    `roleVendorMap`. `confirmVendorSelection`'s `vendorsFromMap` reads
    `Object.values(roleVendorMap)` — **every** value in the map, not
    filtered by `activeServiceRoles` — so the rejected role's stale vendor
    would still have been included in the `vendorServices` submitted to
    `saveVendorServices`, even though the role itself was correctly
    excluded from `planServices`/`confirmedPlanServices`. The Adjuster's
    own removal path (`confirmToggle`) already does this cleanup (`setRoleVendorMap(prev => { delete prev[role]; ... })`)
    - Supervisor's staged-rejection path was just missing the equivalent line
    - Fixed by adding the same cleanup
  - `tsc --noEmit` clean on `apps/frontEnd`; frontend `vitest` 459/459
    re-run clean after the fix. Frontend restarted (Vite HMR) for live
    testing.
- **2026-07-23, same day, real bug found via live DB inspection: a Claims
  Supervisor could not remove an already-`Locked` service at all once a
  claim reached `'Finalized Selection'` — the row wasn't even clickable.**
  - User reported toggling off "RTW / JFA" and clicking Confirm Selection
    did nothing — the service stayed listed, and the button remained
    available ("no 2 actions needed").
  - Inspected the live claim directly (not a seeded test): found `RTW / JFA`'s `serviceVendorReview` entry was `status: 'Locked'`, `changeType: 'ProviderChange'`
    - Had matched its recommendation from the start, was never `Pending Review`
    - Never went through the Supervisor Review popup at all
  - **Root cause**:
    - Role-grid row's clickability (`claimIntakeDetails/index.tsx`, `allRoleNames.map(...)`) was gated by `rowClickable = needsReview || adjusterCanToggle`
      - `adjusterCanToggle` requires `!vendorsForRole` — `vendorsForRole = selectedRecord?.planServiceStatus === 'Finalized Selection'`
    - Claim had already reached `'Finalized Selection'` (from the Supervisor confirming the *other* 3 Pending Review items minutes earlier)
      - `vendorsForRole` was `true`, `adjusterCanToggle` was `false`, `needsReview` was also `false` (the role was never Pending Review)
      - So `rowClickable` was `false`
    - Row rendered a lock icon, not a toggle switch
      - Clicking it did nothing at all — no modal opened, nothing was staged
    - Clicking "Confirm Selection" again submitted nothing new for this role, since nothing had changed
      - Why the service "wasn't removed" and the button stayed available (there was always something a user could still try, even though this specific attempt achieved nothing)
  - **Why this guard existed**:
    - `vendorsForRole`/`disableplanChange`/`canOverrideService` exist to freeze an *Adjuster's* already-submitted plan once a claim is finalized
    - Never meant to also block a *Supervisor's* separate authority to correct/remove a service on a claim they're reviewing
    - Per the FRD's "Preserved / Explicitly Unchanged" section, that authority should remain unrestricted regardless of review state ("Deactivating/removing a previously-recommended service does not trigger review — that remains unrestricted")
  - **Fix**:
    - Added `supervisorCanToggle = isSupervisor && !isClaimCompleted && !isReadOnlyForAdjuster`
      - Bypasses the Adjuster-specific `vendorsForRole`/`disableplanChange`/`canOverrideService` guards entirely
      - Folded into `rowClickable = needsReview || adjusterCanToggle || supervisorCanToggle`
    - Also simplified the lock-icon-vs-toggle-switch condition from its old ad-hoc check (`!needsReview && (isConfirmedLocked || vendorsForRole || !canOverrideService || isReadOnlyForAdjuster)`) to just `!rowClickable`
      - The two were already meant to agree — this makes them provably so by construction
    - A Supervisor now sees an actual toggle switch (not a lock) on an already-Locked row
    - Toggling it off for a Supervisor still goes through the plain Adjuster-style `ReasonModal`/`confirmToggle` path (not the Supervisor Review popup/staging mechanism above)
      - Same as an Adjuster removing a recommended service
      - Removing a role that was never under review doesn't need a review decision, just a reason
  - `tsc --noEmit` clean on `apps/frontEnd`; frontend `vitest` 459/459
    re-run clean after the fix.
- **2026-07-23, same day, second follow-up: removing that same service still
  needed two attempts — root cause was a genuine race condition in
  `confirmToggle`, not the clickability bug above.**
  - After the `supervisorCanToggle` fix, the row became clickable, but
    deselecting it and confirming the reason would make it **reappear
    checked** — the user had to deselect a second time, at which point
    "Confirm Selection" actually removed it.
  - **Root cause**:
    - `confirmToggle` (the plain Adjuster-style reason-modal handler role removals go through, per the fix above) called `saveDraftPlanServices(...).then(() => refresh())`
      - A refresh immediately after the draft save
    - `saveDraftPlanServices`'s resolver (confirmed by reading it directly) writes **only** the `planServices` field: `ClaimRecordModel.findOneAndUpdate(..., { planServices: args.planServices })`
      - Never touches `confirmedPlanServices`
    - But the `activeServiceRoles` computation effect derives its value as `dbInitial = [...confirmedPlanServiceNames, ...newMatches]`
      - Unconditional union that always includes everything in `confirmedPlanServiceNames`, regardless of what's in the fresher `planServiceNames`
    - A role already part of a prior *confirmed* selection has its name sitting in `confirmedPlanServiceNames`
      - That field is untouched by a mere draft save
      - Refresh right after removing it pulled back a snapshot where `confirmedPlanServiceNames` still listed the just-removed role
      - Resurrected it straight back into `activeServiceRoles`
    - Timing-dependent (a race between the draft-save-triggered refresh and whatever the user does next)
      - Why it read as "sometimes needs two tries" rather than "always broken"
  - **Fix**:
    - Removed the `.then(() => refresh())` entirely
    - Comment already called this "Immediately persist current selections to planServices (**draft** save)"
      - Its purpose is a session-restore backup, not something that needs to sync back into the page immediately
    - Local `setActiveServiceRoles(...)` a few lines above it already keeps the UI correct without any round-trip
    - This was the only `refresh()` call anywhere in the toggle/reason-modal flow that didn't correspond to an actual full-confirm submission
  - **Second part of the report — "Confirm Selection should stop being available/clickable once nothing is left to confirm"**:
    - Very likely a downstream symptom of the same resurrection bug
      - `showConfirmButton` (`!isVendorConfirmed || hasPendingPlanChanges || hasUnconfirmedServices`) already hides the button entirely (not just disables it) once the claim is `'Finalized Selection'` with no pending plan changes or unconfirmed services
      - A resurrected role kept at least one of those conditions perpetually true
    - No separate change made to `showConfirmButton`'s logic itself
      - Worth re-verifying live now that the resurrection is fixed
      - This part wasn't independently reproduced against live data the way the resurrection itself was
  - `tsc --noEmit` clean on `apps/frontEnd`; frontend `vitest` 459/459
    re-run clean after the fix.
- **2026-07-23, same day, third follow-up — user reported the exact same
  symptom persisting after both fixes above: a genuine second, distinct bug,
  found and fixed with a direct live-data reproduction (not inference).**
  Inspected the actual test claim's raw DB record (not a fresh seed) and
  found something the earlier fixes hadn't accounted for: `RTW / JFA` had
  *already* been correctly removed from `planServices` /
  `confirmedPlanServices` / `existingplanservices` by the user's own prior
  testing — the plan-level removal genuinely works — but its
  `serviceVendorReview` entry was still sitting there with `status:
  'Locked'`, an **orphaned record never cleaned up by any code path**.
  - **Root cause**:
    - `saveVendorServices`'s merge-by-roleName (§ above) was written on the assumption that "entry not present in this call's incoming payload" always means "role untouched, still active, just not re-sent because already Locked"
      - Preserved it unconditionally
    - Never considered the *other* case: the role was actually **removed** from the plan
      - Its entry is not just "unchanged" but genuinely stale
    - Both cases look identical from inside that merge (the entry simply isn't in `incoming` either way)
      - Existing logic silently preserved a Locked/Modified/Included entry for a role that was no longer part of the plan at all, forever
    - `getServiceStatus()` on the details page still finds this orphaned entry and returns its stale status — a live behavioral risk
      - In this exact instance the role-grid's `isActive`/category logic (keyed off `confirmedPlanServiceNames`, which *was* correctly updated) happened to still render it as unselected
  - **Fix**: `saveVendorServices` now resolves `args.planServices` (roleIds) to role names via `ServiceRequestRoleModel`, prunes any merged entry whose role is no longer in that set
    - **Except** entries with `status: 'Rejected'`, deliberately kept forever regardless of plan membership
    - A Rejected role is by definition never in `planServices` (that's what rejecting it means)
    - Its entry is the permanent historical record `getSupervisorReviewedClaims`/Supervisor Comments reads, not staleness
  - **A real mistake made and caught during this same fix**:
    - First version of this pruning logic did not carve out the `'Rejected'` exception
      - A live test against the real claim confirmed it **silently deleted a genuine Rejected history entry** (`Records Retrieval (Defense)`, with a real Supervisor comment attached) the moment `saveVendorServices` ran
      - Caught immediately by re-inspecting the claim's raw data after the test call, before this was reported as "done"
    - Corrected the same investigation session by adding the `|| e.status === 'Rejected'` carve-out
      - Re-verified live with both an orphaned Locked entry and a Rejected entry seeded together in one claim: orphaned entry pruned, Rejected entry survived
    - One real demo/test claim's original "Records Retrieval (Defense)" Rejected entry was lost during this investigation before the fix was corrected
      - Test/demo data only, not real claims data — noted here for completeness
  - `tsc --noEmit` clean on `apps/api`; backend `jest` 20/20 re-run clean
  - API restarted (resolver logic change, not hot-reloadable under `ts-node`)
  - Frontend `vitest` 459/459 also re-run clean (unaffected, no frontend changes this round)
- **2026-07-23, same day, fourth follow-up: user supplied the full intended
  13-step workflow and reported "still same issue" — added an explicit
  submission lock (steps 6/7 of that spec: "Confirm Selection must execute
  ONLY ONCE... lock the action... prevent duplicate submissions").**
  - New `confirmingSelection` boolean state wraps the entire `confirmServiceProviderSelection` body (`await confirmPlanSelection(); await confirmVendorSelection(); await refresh();`) in a `try/finally`
    - Set `true` before the sequence starts, `false` only after the closing `refresh()` completes
    - Early-return guard (`if (confirmingSelection) return;`) at the top
    - A call that arrives while one is already in flight is a no-op rather than a second, concurrent submission
  - Replaces the button's previous `disabled` condition (`... || psSaving || vsSaving`) with `... || confirmingSelection`
    - `psSaving`/`vsSaving` individually flip false/true at *different* points inside the sequence (`confirmPlanSelection` clears `psSaving` in its own `finally` *before* `confirmVendorSelection` has set `vsSaving`)
    - Left a brief window where neither was true, button could have re-enabled mid-submission
    - Single overarching flag has no such gap by construction
  - `tsc --noEmit` clean on `apps/frontEnd`; frontend `vitest` 459/459
    re-run clean.
  - **Resolved by explicit confirmation, no code change**:
    - Supplied workflow's step 11 ("Supervisor enters comments for every modified service") read as requiring an explicit comment on *every* Pending Review service before Confirm Selection can complete
      - Conflicts with the current "silent accept" design (§5.3, built earlier per explicit feedback: "No need to track if supervisor accepts the same vendor chosen by adjuster other than recommended service providers")
      - That design lets an *untouched* Pending Review service resolve to Modified/Included via Confirm Selection alone, with no comment
    - Asked directly rather than guessing: user confirmed **keep silent-accept as-is**
      - Step 11 describes the comment flow for services the Supervisor actively reviews via the popup, not a requirement that every single service get one
    - No behavior change from this round's investigation
- **2026-07-23, fifth follow-up: "the unselected moves back to selected"
  after a Supervisor removes an added service and clicks Confirm
  Selection.** Two independent bugs found and fixed this round, both via
  live GraphQL/DB verification against the real test claim
  (`WCM-2026-007`, `uploadId 94ed9376-6f1d-4b98-b0e2-8dd244dd2564`):
  1. **Backend — `uploadedClaimDetails` resolver silently discarded the
     stored `planServices` while a claim sat in `'Pending Review'` status**
     (`graphQL/claimIntakeEntity.ts`, the `computedPlanServices`/
     `mappedRecords` block).
     - `isPlanConfirmed` gate (decides whether to trust the stored `planServices` field or fall back to a fresh `matchRolesForRecord()` re-match) only recognized `'Pending Selection'`/`'Finalized Selection'`
       - `'Pending Review'` (and `'Completed'`) fell through to the fresh-match-only branch
       - Both statuses are reachable *only* after at least one plan/vendor confirm cycle (`deriveClaimStatus`/`completeClaim`), never as a starting state
     - Live-verified: before the fix, querying `uploadedClaimDetails` for a claim with one Locked and one Pending Review ("added") service returned `planServiceNames: []`
       - Manually-added service (by definition not a rule match) vanished from the field entirely while the claim sat in Pending Review
       - I.e. for the whole window a Supervisor is actively reviewing it
     - Fixed by folding `'Pending Review'` and `'Completed'` into the same "trust `r.planServices`, union in fresh matches" branch via a shared `isRecordConfirmed(status)` helper
       - Applied at both call sites (`computedPlanServices` and the per-record `planServices` merge)
     - Re-verified live: `planServiceNames` now correctly returns both roles while Pending Review
  2. **Frontend — the tab-visibility refresh handler clobbered unsaved local edits** (`claimIntakeDetails/index.tsx`, the `document.visibilitychange` effect near the top of the component)
     - `onVisible` unconditionally called `refresh()` whenever the tab regained focus, regardless of any in-progress local state
       - A Supervisor's just-toggled-off "added" service (staged in `supervisorStagedDecisions`, removed from `activeServiceRoles` locally, **not yet sent to the server**) is silently overwritten the next time `document.visibilityState` flips to `'visible'` (switching tabs/windows, or the OS momentarily stealing focus)
     - Cause: main `activeServiceRoles`-recompute effect (§ "role toggle" derivation) rebuilds `dbInitial` from the freshly-refetched `confirmedPlanServiceNames`
       - That still contains the role, since nothing was saved yet
       - No awareness that the user had already removed it on screen
     - This is the exact resurrection class `confirmToggle` was already written to avoid (see its comment on why it deliberately skips `refresh()` after a draft save)
       - Just reachable through a second, unguarded path
     - Fixed with a `hasUnconfirmedRef` ref, updated every render from `hasUnconfirmedServices`
       - Already the existing "there's something the user needs to Confirm Selection on" signal, now doing double duty as "don't background-refresh over this right now"
       - Checked inside `onVisible` before calling `refresh()`
       - The `[]`-dependency effect can't read component state directly without going stale, hence the ref — same pattern as the pre-existing `vendorFetchRef`
     - `loadRoles()`/`loadVendors()`/`vendorFetchRef.current()` still run unconditionally
       - Only the record-level `refresh()` is gated, since only that one feeds `activeServiceRoles`
  - `tsc --noEmit` clean on both `apps/api` and `apps/frontEnd`
  - Backend `jest` 20/20 and frontend `vitest` 459/459 re-run clean
  - Both dev servers restarted (resolver + non-hot-reloadable ref change)
- **2026-07-23, sixth follow-up: user reported the same resurrection
  symptom persisting even after both fixes above, and asked for a full
  instrumented trace instead of another guess** — root-caused this time
  with real evidence (temporary `console.log` tracing added to
  `savePlanServices`/`saveVendorServices`/`uploadedClaimDetails` and to
  every step of the frontend confirm sequence, both removed once the fix
  landed).
  - Trace initially showed the two prior fixes working correctly end-to-end for a clean single-removal test
    - But a live user session left the test claim's `planServices` at `[]` while `confirmedPlanServices` still held both roles — a state neither prior fix could produce
  - That divergence is only possible if `saveDraftPlanServices` fired with an empty role list
  - **Root cause**:
    - `handleRoleToggle` (`claimIntakeDetails/index.tsx`) only routed a Supervisor's click through the staged `SupervisorReviewModal` when the clicked role's status was exactly `'Pending Review'`
    - `supervisorCanToggle` (the row-clickable gate) deliberately makes *every* row clickable for a Supervisor, including an already-`Locked`/`Modified`/`Included`/`Rejected` one (FRD §6: "can remove ANY active service — including an already-Locked one")
    - A Supervisor clicking that other row therefore fell through to the plain Adjuster path (`setPendingToggle` → generic reason modal → `confirmToggle`)
      - The wrong dialog (no mandatory comment, not staged)
      - Calls `saveDraftPlanServices` **immediately**, computing its new role list from `activeServiceRoles` as it stood at that click
    - If a *different* role had already been staged off moments earlier via the correct popup (locally, not yet sent to the server), `activeServiceRoles` was already one role short
      - This second, unstaged toggle persisted a `planServices` list missing both roles instead of just the one actually being toggled
      - Corrupted `planServices` out of sync with `confirmedPlanServices`
    - Also what the user separately reported as "the wrong dialogue box appears first"
      - The generic reason modal instead of the Supervisor Review modal, on any row other than the one currently `Pending Review`
  - **Fix**: `handleRoleToggle` and `handleVendorDropdownChange` now check `isSupervisor` alone (not `isSupervisor && status === 'Pending Review'`) before routing to `openSupervisorReviewModal`
    - A Supervisor's click on *any* row, in any status, always goes through the staged, comment-required popup
    - Immediately-persisting Adjuster path (`setPendingToggle`/`confirmToggle`/`pendingVendorChange`/`confirmVendorChange`) is now unreachable for a Supervisor entirely
    - Closes the corruption path at its source rather than patching a downstream symptom
  - `tsc --noEmit` clean on both apps
  - Backend `jest` 20/20 and frontend `vitest` 459/459 re-run clean
  - Both dev servers restarted
  - Test claim's corrupted `planServices: []` state (left over from reproducing this live) was reset back to a clean baseline
- **2026-07-23, seventh follow-up: explicit new requirement — once Confirm
  Selection succeeds and the claim reaches `Finalized Selection`, the
  service grid must lock for everyone, Claims Supervisor included.**
  - Confirmed via AskUserQuestion (option chosen: "Fully locked after Finalized Selection", over keeping the existing "Supervisor can still edit anytime" behavior)
    - Deliberately reverses the FRD §8 note from earlier the same day ("A Claims Supervisor can remove ANY active service — including an already-Locked one — even after the claim's overall status has reached 'Finalized Selection'")
  - `claimIntakeDetails/index.tsx`, the role-grid `.map()`: `supervisorCanToggle` changed from `isSupervisor && !isClaimCompleted && !isReadOnlyForAdjuster` to `isSupervisor && !isClaimCompleted && !vendorsForRole && !isReadOnlyForAdjuster`
    - Folds in the same `vendorsForRole` guard (`true` once `planServiceStatus === 'Finalized Selection'`) that `adjusterCanToggle` already respected
  - `rowClickable` (`needsReview || adjusterCanToggle || supervisorCanToggle`) now evaluates false for every role once the claim is genuinely finalized
    - `needsReview` can't independently keep it true at that point either
    - `deriveClaimStatus` never reports `Finalized Selection` while any `serviceVendorReview` entry is still `Pending Review`
  - Each row then renders its lock icon instead of a toggle, via the pre-existing `!rowClickable` branch
    - No new UI needed
  - `dropdownEditable` (the per-role vendor dropdown) needed no change
    - Already effectively locked post-Finalized-Selection for every role
    - Its `'Unconfirmed'` branch can't fire once `planServiceStatus === 'Finalized Selection'` (`getServiceStatus` falls back to `'Locked'` in that case via `isVendorConfirmed`)
    - Its `'Pending Review'` branch can't fire either, for the same `deriveClaimStatus` reason above
  - `tsc --noEmit` clean; frontend `vitest` 459/459 re-run clean
- **2026-07-24: regression test coverage added** —
  `claimIntakeDetails/__tests__/claimIntakeDetails.supervisorReview.test.tsx`
  (new file, 3 tests), following the existing
  `claimIntakeDetails.fetchVendors.test.tsx` mocking pattern
  (`useClaimDetails`/`useLocation` mocked; `AuthContext` newly mocked too,
  returning a `Claims Supervisor` user):
  1. Clicking an already-`Locked` row as Supervisor opens the staged
     Supervisor Review popup (`"Review — <role>"`), never the plain
     "Reason for Change" modal, and never calls `saveDraftPlanServices`.
  2. Once `planServiceStatus` is `Finalized Selection`, clicking a row opens
     no popup at all (lock icon, not a toggle).
  3. The core regression guard: Supervisor removes a `Pending Review`
     "added" role via the staged popup, clicks Confirm Selection once.
     - The mocked `refresh()` returns the corrected server state
       (`confirmedPlanServiceNames` excluding the role, `Finalized
       Selection`).
     - Asserts the role's row never re-renders with `cid-vendor-item--selected`/`--active`
     - Asserts the actual `savePlanServices`/`saveVendorServices` payloads excluded the role / marked it `Rejected`
     - **Verified this test actually catches the regression**:
       - Temporarily reverted both source fixes (the `confirmedPlanServices`/`confirmedPlanServiceNames` line in `savePlan`'s optimistic update, and the effect's `confirmedPlanServiceNames` dependency)
       - Re-ran the suite, confirmed test 3 fails with the exact symptom (`cid-vendor-item--active` on the removed role)
       - Restored both fixes, confirmed all tests pass again
  - `tsc --noEmit` clean; frontend `vitest` 462/462 (459 prior + 3 new)
  - Backend `jest` 20/20 unaffected. Frontend restarted
- **2026-07-24: Supervisor provider-dropdown authority extended to every
  enabled service, not just `Pending Review` ones** — explicit new
  requirement: "Currently, only the services that were modified by the
  Adjuster are editable... the corresponding Service Provider dropdown is
  locked and cannot be changed [for default recommended services]. This is
  incorrect... Pending Review determines that the claim requires Supervisor
  approval; it should not limit what the Supervisor can edit."
  - Two independent changes were required, in
    `claimIntakeDetails/index.tsx`:
  1. **`dropdownEditable`** (role-grid `.map()`, vendor-sub IIFE):
     - Was `isReadOnlyForAdjuster ? false : serviceStatus === 'Unconfirmed' ? true : serviceStatus === 'Pending Review' ? isSupervisor : false`
       - Locked the dropdown for a Supervisor on any `Locked`/`Modified`/`Included` role
     - Changed to `isReadOnlyForAdjuster ? false : isSupervisor ? !vendorsForRole : serviceStatus === 'Unconfirmed'`
       - Supervisor's branch now independent of `serviceStatus` entirely
       - Gated only by `vendorsForRole` (`true` once `planServiceStatus === 'Finalized Selection'`)
       - Mirrors `supervisorCanToggle`'s existing gate (see the seventh follow-up above)
       - Dropdown and the row-toggle now lock at exactly the same point
     - Adjuster's own branch unchanged in effect (still only `'Unconfirmed'` is editable)
  2. **`confirmVendorSelection`'s `serviceVendorReview` construction**:
     - Main `.map()` over `activeServiceRoles` was preceded by `.filter(role => !isServiceLockedStatus(getServiceStatus(role)))`
       - Now that the dropdown above can be opened on such a role, this would silently exclude a Supervisor's freshly staged decision on an already-`Locked`/`Modified`/`Included` role from ever reaching `saveVendorServices`
       - Same silent-drop failure class as the "ghost entry" bug fixed earlier this session for a different code path (found and fixed via the same revert-test-restore method, see below)
     - Fixed by changing the filter to `.filter(role =>
       !isServiceLockedStatus(getServiceStatus(role)) ||
       supervisorStagedDecisions[role])` and adding a new branch inside
       the `.map()`, checked right after `recommendedVendor` is
       computed: if `!isAdjuster && supervisorStagedDecisions[role] &&
       isServiceLockedStatus(getServiceStatus(role))`, build the entry
       directly from the staged decision — `changeType` and
       `confirmedBy`/`confirmedAt` preserved from the role's existing
       `serviceVendorReview` entry (same pattern as the adjacent
       `Pending Review` branch), `status`/`selectedVendor`/
       `supervisorComment` taken from `supervisorStagedDecisions[role]`.
     - Without this, none of the three existing branches (new-role,
       `Pending-Review`-role, Adjuster's own confirm) could ever match a
       role that both (a) already has a resolved status and (b) isn't
       being added by an Adjuster — it would fall through and be
       silently dropped.
  - Regression test added: `claimIntakeDetails.supervisorReview.test.tsx`
    test 4 — opens the dropdown on the fixture's already-`Locked` "Nurse
    case management" role, switches to a second mocked vendor, stages the
    decision via the popup, clicks Confirm Selection, asserts the
    `saveVendorServices` payload's `serviceVendorReview` array actually
    contains an entry for that role with the new `selectedVendor`,
    `status: 'Modified'`, and the entered `supervisorComment`.
    - **Verified this test catches both regressions independently**:
      - Reverted only fix 1 → dropdown trigger never renders, `findByRole('button', {name: /Careworks/})` times out
      - Restored fix 1, reverted only fix 2 → dropdown works but `nurseEntry` in the submitted payload is `undefined` (the exact silent-drop symptom)
      - Restored both, full suite green again
  - `tsc --noEmit` clean (both apps); frontend `vitest` 463/463 (462 prior + 1 new)
  - Backend `jest` 20/20 unaffected. Both dev servers restarted
- **2026-07-24, follow-up: enabling a service as Supervisor did nothing** — reported symptom: "When i click on any service to enable as supervisor user in pending review or pending selection, it is not enabling."
  - Root cause in `confirmSupervisorReviewDecision`: function staged the decision (`supervisorStagedDecisions[role] = {...}`)
    - For a `ServiceAdded`-typed toggle, only ever handled the `!keep` (turn OFF) direction — `setActiveServiceRoles(prev => prev.filter(r => r !== role))`
  - No corresponding branch for `keep === true` (turn ON)
    - Nothing ever added the role to `activeServiceRoles`
    - Row's toggle visually never switched on no matter how many times it was clicked or confirmed
    - Regardless of the claim's `planServiceStatus` (Pending Review or Pending Selection — both reachable, since `supervisorCanToggle` only guards on `!isClaimCompleted && !vendorsForRole`, not the claim's specific status)
  - Fix 1 — `confirmSupervisorReviewDecision`:
    - Restructured the `changeType === 'ServiceAdded'` block into an explicit `if (keep) {...} else {...}`
    - `keep` branch now does `setActiveServiceRoles(prev => prev.includes(role) ? prev : [...prev, role])`
    - Also fetches vendor options for the role if `roleToVendorsMap[role]` is empty (`fetchVendorsForRoles([role], [])`, fire-and-forget with `logError` on failure)
    - Mirrors the Adjuster's own `confirmToggle` "add" path
      - Already does the equivalent `fetchVendorsForRoles([pendingToggle.item], [])` call so the vendor dropdown/auto-selected vendor is ready once the row renders
  - Fix 2 (found while tracing what happens after Fix 1, on Confirm Selection) — `confirmVendorSelection`'s `serviceVendorReview` construction:
    - Once a freshly-enabled role reaches `activeServiceRoles`, it's `'Unconfirmed'` status (no existing `serviceVendorReview` entry yet)
      - Not locked-status, so never excluded by the outer filter
      - Inner branch added earlier this session (`lockedStatusStaged`) was scoped only to `isServiceLockedStatus(getServiceStatus(role))`
    - An `'Unconfirmed'` role with a staged decision fell through it, hit the generic catch-all at the bottom (`status: isOverridden ? 'Pending Review' : 'Locked'` — always `'Locked'` here since `isAdjuster` is false)
      - Silently discarded the staged `'Included'` decision and comment entirely
    - Generalized the branch's condition from `isServiceLockedStatus(getServiceStatus(role))` to `getServiceStatus(role) !== 'Pending Review'`
      - Covers both already-resolved AND brand-new/Unconfirmed roles with a staged decision
      - Very next branch already owns the `'Pending Review'` case
    - Changed the `changeType` fallback from a flat `'ProviderChange'` to `recommendedRoleNames.has(role) ? 'ProviderChange' : 'ServiceAdded'`
      - A role with no existing entry that also was never part of the original recommended set is a genuine new addition, not a provider override
  - Regression test added: `claimIntakeDetails.supervisorReview.test.tsx` test 5
    - Adds a third fixture role ("Physical Therapy") that starts SUGGESTED/inactive (absent from `planServiceNames`/`confirmedPlanServiceNames`)
    - Clicks its row as Supervisor, confirms the popup, asserts the row now renders `cid-vendor-item--active`
    - Clicks Confirm Selection, asserts the `saveVendorServices` payload's `planServices` includes the role's ID and its `serviceVendorReview` entry has `status: 'Included'` with the entered comment
    - **Verified this test catches the regression**:
      - Reverted `confirmSupervisorReviewDecision`'s "keep" branch back to the old `!keep`-only shape
      - Re-ran, confirmed the test fails with the exact reported symptom (row's className stays plain `cid-vendor-item`, never gains `--active`)
      - Restored, confirmed all 5 tests in the file pass again
  - `tsc --noEmit` clean; frontend `vitest` 464/464 (463 prior + 1 new)
  - Backend `jest` unaffected (frontend-only change). Both dev servers restarted

## 9. Adjuster Comments on Pending Review (New)

- Implements `SupervisorReview-frd.md` §12
- Separate concept from the per-service `serviceVendorReview[].supervisorComment` (§1/§2 above)
  - This is a single claim-level note captured once at submission
  - Sourced from the mandatory "Reason for Change" text rather than a new field the Adjuster types
- An earlier iteration of this feature added a dedicated free-typed "Adjuster Comments" box
  - Removed after user testing showed it was redundant with the reason the Adjuster has to give for every change
  - Also easy to miss, since it required scrolling past the full services grid
- §9.3 below reflects the final, reason-driven design

### 9.1 Data model — `apps/api/graphQL/claimIntakeEntity.ts`

`IClaimRecord` / `ClaimRecordSchema` gained 3 top-level fields (all
`{ type: String, default: '' }`):

```ts
adjusterComments:    string; // combined "Reason for Change" text, may be ''
adjusterSubmittedBy: string; // user.fullName || user.username at submit time
adjusterSubmittedAt: string; // ISO timestamp, set server-side (new Date().toISOString())
```

- `type ClaimRecord` (GraphQL SDL) gained the same 3 fields as `String`
- `ServiceVendorReview` / `ServiceVendorReviewInput` (GraphQL) and each `serviceVendorReview[]` entry in `ClaimRecordSchema` (Mongoose) also gained one new field, `adjusterComment: String`
  - Reason text for that specific service only (not the claim-level combined text above)
  - No resolver change needed for this one
  - `saveVendorServices` already merges each incoming `serviceVendorReview` entry into the stored array by `roleName` (`mergedByRole.set(entry.roleName, entry)`, see §9.2 below), stores the whole object as-is
  - A field present on the incoming entry just persists automatically once declared on the GraphQL/Mongoose types

### 9.2 Mutation — extended `saveVendorServices`

No new mutation was added. `saveVendorServices` gained two optional args:

```graphql
saveVendorServices(
  ...
  adjusterComments:    String
  adjusterSubmittedBy: String
): SaveVendorServicesResponse!
```

- Same mutation `confirmVendorSelection` already calls as the final step of Confirm Selection for both Adjuster and Supervisor
- Reusing it (rather than adding a dedicated mutation) meant no new save button, no new round trip, no new race with the existing plan/vendor save sequence

Resolver: the 3 DB fields are only written when `args.adjusterComments !== undefined`:

```ts
if (args.adjusterComments !== undefined) {
  update.adjusterComments    = args.adjusterComments;
  update.adjusterSubmittedBy = args.adjusterSubmittedBy ?? '';
  update.adjusterSubmittedAt = new Date().toISOString();
}
```

- Frontend only ever sends these args when the caller is an adjuster-type role (see §9.3)
  - A Supervisor's own Confirm Selection call — same mutation, same resolver — omits them, this block never runs
  - Stored Adjuster comment stays untouched
  - This is the mechanism that satisfies "Supervisor's Confirm Selection workflow must not change"
- `uploadedClaimDetails` resolver's per-record mapping extended to return the 3 fields (`r.adjusterComments ?? ''`, etc.)
  - Details screen can read them back
- `getAllClaimRecords` and `getSupervisorReviewedClaims` intentionally left untouched
  - They back the Claims Command Center grid and the separate Supervisor Comments page, neither of which this feature touches

### 9.3 Frontend — `apps/frontEnd/src/pages/ClaimIntake/claimIntakeDetails/index.tsx`

- No new input control and no new local state for the Adjuster
  - Content comes from `localChangeLog`, the same array populated by the mandatory "Reason for Change" modal (`ReasonModal`, role/vendor toggles) and the Supervisor's own staged-review popup

- In `confirmVendorSelection`, alongside the existing `combinedReason` (vendor-type reasons only, used for `vendorServiceComments` — unchanged), a new `adjusterSubmissionReason` is computed
  - From **all** of this submission's `localChangeLog` entries regardless of type (role toggles *and* provider switches)
  - Deduplicated and joined with `'; '`: `[...new Set(localChangeLog.map(e => e.reason))].join('; ')`
  - Empty when the Adjuster made no changes (a plain re-confirm)
  - Correctly yields "No comments provided." on the Supervisor's side
- `saveVendors` called with `isAdjuster ? { comments: adjusterSubmissionReason, submittedBy: confirmedBy } : undefined` as its 5th arg
  - Forwards `adjusterComments`/`adjusterSubmittedBy` into the `saveVendorServices(...)` service call only when that arg is present
  - A Supervisor's own Confirm Selection (which never builds this object) sends neither key
  - Stored value stays untouched (regression-tested, see below)
- On a successful Adjuster submission, `saveVendors` optimistically merges the 3 new fields into `localRecords`
  - Same place `vendorServiceComments` etc. are already optimistically updated
- Read-only display card, styled with the existing `cid-snapshot` family of CSS classes (`skin/css/custom.css` ~L3805-3860, unchanged — no new CSS needed)
  - Placed directly after the Claim Snapshot card and before the Q-AI Insights card (near the top of the page, not scrolled below the services list)
  - Gated on `isSupervisor && isPendingReview && selectedRecord`
  - Shows Adjuster Name (`adjusterSubmittedBy || '—'`), Submitted Date & Time (formatted with the same `toLocaleString(undefined, {...})` pattern already used for Audit Trail timestamps elsewhere in this file)
  - Shows comment text, or the literal string `'No comments provided.'` when `adjusterComments` is empty/blank
- **Per-service `adjusterComment`**
  - Added after the claim-level summary alone proved insufficient — a Supervisor reviewing a specific service had no way to see *that service's own* reason, only the combined claim-wide text
  - Each `serviceVendorReview` entry built in `confirmVendorSelection` now carries `adjusterComment` sourced from whichever per-role reason map applies:
  - A brand-new "Service Added" entry (`isAdjuster && !recommendedRoleNames.has(role)`) uses `roleReasonMap[role]`
    - Set in `confirmToggle` when this exact role was switched on (previously dead state: declared and written, never read, until now)
  - The generic catch-all entry's `isOverridden` branch uses `roleVendorReasonMap[role]`
    - Set in `confirmVendorChange` when this role's provider was switched (same previously-dead-state situation)
  - Every other branch (Supervisor accepting/modifying/rejecting an existing Pending Review entry, or a plain re-Locked confirm) carries forward `existingEntry?.adjusterComment` unchanged
    - A Supervisor's own review action never erases the Adjuster's original per-service reason
  - Displayed in the per-service row (§1719-1763-ish, inside the `serviceStatus === 'Pending Review' && reviewEntry` block), as an "Adjuster Comment:" line directly below the existing "Added by {confirmedBy}" / "Overridden by {confirmedBy}" text
    - Shown only when `reviewEntry.adjusterComment` is present
    - No per-row "No comments provided." fallback — a service with nothing to show just has no line
- Regression tests: `claimIntakeDetails.adjusterComments.test.tsx`
  - (1) An Adjuster toggling on a new/additional service, entering a reason in the "Reason for Change" modal, then clicking Confirm Selection
    - Asserts the `saveVendorServices` payload's `adjusterComments` equals that reason, `adjusterSubmittedBy` equals the Adjuster's name
    - **And** that same service's own `serviceVendorReview` entry has `adjusterComment` equal to that reason
  - (2) A Supervisor's own Confirm Selection on a claim with an untouched Pending Review "Service Added" role
    - Asserts the payload has neither `adjusterComments` nor `adjusterSubmittedBy` (`undefined`, not merely empty)

**Earlier iteration (superseded):**
- A dedicated optional textarea + local state (`adjusterComments`/`setAdjusterComments`)
  - First placed directly above the `cid-action-bar` Confirm Selection button
  - Then moved near the top of the page (after the Claim Snapshot card) when it proved easy to miss during testing
- Both removed once the requirement was clarified
  - Supervisor should see the reason the Adjuster *already* has to give for every change, not a second, separately-typed comment

### 9.4 Frontend — model & GraphQL service

- `models/claimIntakeMaster/claimIntakeModel.ts`: `IndividualClaimRecord`
  gained `adjusterComments?`, `adjusterSubmittedBy?`, `adjusterSubmittedAt?:
  string`.
- `services/claimIntakeMaster/claimIntakeService.ts`:
  - Added the 3 fields to `UPLOADED_CLAIM_DETAILS_QUERY`'s `records { ... }` selection
  - Added `$adjusterComments`/`$adjusterSubmittedBy` to `SAVE_VENDOR_SERVICES_MUTATION`
  - Extended the `saveVendorServices()` wrapper's input type with the two optional fields (forwarded automatically via `variables: input`)

### 9.5 Explicitly unchanged

- `SupervisorReviewModal`, `supervisorStagedDecisions`, and the mandatory
  per-service Supervisor Comment flow (§1/§2/§6 above) are untouched.
- The Supervisor Comments page (§3/§6) and `getSupervisorReviewedClaims` are
  untouched.
- No new GraphQL mutation, no new MongoDB collection.
