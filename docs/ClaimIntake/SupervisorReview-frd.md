# Claims Supervisor Review & Supervisor Comments Workflow — Functional Requirements

**Module:** Claims Management
**Screens:** Claims Command Center, Uploaded Claim Details, Supervisor Comments (new)
**Version:** 1.0
**Date:** 22-Jul-2026

---

## 1. Overview

- Extends the existing per-service Pending Review workflow (`claimIntakeMaster-frd.md` §12/§13) with:
  - A second review trigger
  - A single bulk confirmation action with mandatory comments
  - Three final review outcomes
  - A new page — **Supervisor Comments** — where an Adjuster can see every decision a Supervisor made on their overrides, with the reasoning

## 2. Adjuster Sidebar

- New sidebar item, **Supervisor Comments** (icon: inbox, path `/claim-supervisor-comments`)
- Shown to all three adjuster-type roles (Claims Adjuster, Senior Adjuster, Junior Adjuster), alongside the Claims Command Center item
- Claim Supervisor and Admin do not see it

## 3. Two Review Triggers

A service on a claim requires Supervisor review when an Adjuster:

1. **Provider Override** — selects a different Service Provider than the
   one the recommendation engine suggested for a recommended service, or
2. **Service Added** — activates a service that was **not** part of the
   originally recommended set at all.

- Deactivating/removing a previously-recommended service does **not** trigger review
  - Unrestricted, as before this feature

## 4. Status Display (role-based — unchanged from claimIntakeMaster-frd.md §13)

| Role | Status shown |
|---|---|
| Claims Adjuster / Senior Adjuster / Junior Adjuster | **Pending Supervisor Approval** |
| Claims Supervisor | **Pending Review** |

- Underlying `planServiceStatus` stored in MongoDB is always `'Pending Review'` regardless of viewer
  - UI-only label swap
- Kanban/List ordering rules from §13 (sinks to the end for Adjusters, first column for Supervisors) are unchanged

## 5. Service-Level Pending Review

- Only the specific service that was overridden or added gets the `Pending Review` badge
  - Other services on the same claim are unaffected
- If the Adjuster picks the same recommended provider: no badge appears at all (nothing to review)

## 6. Supervisor Review Screen (Uploaded Claim Details)

When a Claims Supervisor opens a claim with one or more Pending Review
services:

- Each such service row is **highlighted with a light amber background** (`.cid-vendor-item--needs-review`) to distinguish it from unchanged services
  - Reuses the same amber tokens as the Kanban board's "Pending Review" column, for a consistent color language
- **Provider overrides**: Supervisor can pick any vendor from the same dropdown the Adjuster used
  - Keep the Adjuster's pick untouched, choose a different one, or switch back to the recommended vendor
  - Picking a vendor opens the comment popup (§7)
  - Confirming that popup **stages** the decision
    - Row updates right away (new vendor shown)
    - Service only becomes `Modified` once **Confirm Selection** (§8) is clicked
    - Claim's status only changes at that same point
- **Updated (2026-07-24):** provider dropdown open to the Supervisor for **every enabled service, regardless of status** — not only ones flagged `Pending Review`
  - `Pending Review` only marks which items need review; it never bounded what the Supervisor can edit
  - An already-`Locked` service (originally recommended, never touched by the Adjuster) is just as editable, until `Finalized Selection` freezes the whole screen (§8)
  - Previously: dropdown was locked for any service whose status wasn't `Pending Review` or `Unconfirmed` — incorrectly prevented the Supervisor from changing the provider on most of a claim's services, the ones the Adjuster never touched
- **Newly added services**: shown with an **"Added"** badge next to **"Pending Review"** (in addition to who added it)
  - Visually distinguishable from a provider-override row at a glance
  - Supervisor can leave the service's toggle on (keep it) or turn it off (remove it)
    - Editable regardless of whether the service is already part of the Adjuster's confirmed plan
  - Turning it **off** opens the comment popup
    - Removal is the one decision that still needs an explicit reason
  - Confirming **stages** the removal
    - Toggle switches off right away
    - Service only becomes `Rejected` once **Confirm Selection** is clicked
- **A service the Supervisor is fine with as-is needs no popup** — neither a provider override nor a newly added one
  - No requirement to explicitly "accept" the Adjuster's pick/addition through a comment when nothing is being changed
  - Clicking **Confirm Selection** (§8) resolves every such untouched service:
    - Provider-override becomes **Modified**
    - Newly added service left toggled on becomes **Included**
    - Both with no comment — same final badges an explicit popup decision would produce
  - Only turning a newly added service **off** still requires the popup
- **No per-service Approve button and no separate "Add Review Comment" trigger**
  - Vendor dropdown and the service toggle are the only two ways to open the review popup
  - Both are the natural place a Supervisor makes an explicit change
- This popup is how a Supervisor changes **any** service row on the screen, not only one `Pending Review`
  - A Supervisor may also toggle off an already-`Locked` service that never needed review (§3 intentionally leaves plain removal unrestricted)
  - Doing so opens the same staged, comment-required popup as a Pending Review row
  - No separate "quick remove" path for a Supervisor on this screen

## 7. Mandatory Supervisor Comment — Popup Only, Staged Until Confirm Selection

- Comments are **never entered inline on the row**
- Switching a provider or toggling an added service opens a popup dialog with a required comment field
- Confirming the popup **stages** the decision and comment locally
  - Row's toggle/dropdown updates immediately so the Supervisor can see their change
  - Nothing is sent to the server and the claim's status does not change yet
- Every staged decision is submitted together and only takes effect when the Supervisor clicks the shared **Confirm Selection** button (§8)
  - Same single action the Adjuster uses to submit their own plan/vendor selections
- Cancel discards the popup and leaves the row as it was, nothing staged

## 8. Confirm Selection

- **"Confirm Selection"** is the same single button an Adjuster used to submit their plan/vendor selections
  - Previously labeled "Confirm Service Provider Selection"
  - Only one such button on this screen, for either role

- **Adjuster**: submits the current plan/vendor selections — same as before
- **Claims Supervisor**: clicking it submits every staged popup decision (§7) together
  - Also resolves every `Pending Review` service the Supervisor hasn't explicitly changed:
    - Provider-override becomes **Modified**
    - Newly added service (still toggled on) becomes **Included**
    - Both with no comment needed
  - A newly added service the Supervisor turned **off** was staged as **Rejected** by the popup and is submitted as such here — actually removed from the plan at this point, not when the popup was confirmed
  - Claim's overall status becomes `Service Provider Finalized` ("Finalized Selection") once nothing on it remains `Pending Review`
    - Per §7, this is the only point the claim's status changes
- Button always clickable for either role
  - No "nothing left to confirm" disabled state to work around
- **Once the claim reaches `Finalized Selection`, every service row on the screen locks — for both roles, including the Claims Supervisor.**
  - No further toggling a service on/off or provider changes are possible from this screen at that point
  - Each row shows a lock icon instead of a toggle
  - Reverses an earlier version of this section that let a Supervisor keep removing/modifying services even after Finalized Selection
    - That authority is now bounded by the same Finalized-Selection lock as everything else on the screen

## 9. Final Badges

| Badge | Shown when |
|---|---|
| **Modified** | A Supervisor switches (or re-confirms) a provider-override service's vendor via the popup, regardless of the final vendor chosen |
| **Included** | A Supervisor confirms a newly-added service kept active via the popup |
| **Rejected** | A Supervisor confirms a newly-added service removed via the popup |

- `Pending Review` badge disappears once **Confirm Selection** is clicked and that service's staged decision is submitted
  - Confirming the popup itself only stages the decision (§7) — badge doesn't flip until Confirm Selection
- Provider-override service the Supervisor hasn't touched yet keeps showing `Pending Review` indefinitely
  - No forced timeout that resolves it

- **Updated (2026-07-24):** final badge and the Supervisor's comment no longer shown on the claim details page, for any claim
  - Once a service's decision is submitted: row drops the `Pending Review` badge and shows no replacement badge or comment there
  - Final badge and comment remain visible only on the Supervisor Comments screen (§10)

## 10. Supervisor Comments Screen (Adjuster-facing)

- Left panel: every claim where a Supervisor has reviewed **this Adjuster's** own submitted override(s)
  - Most-recently-reviewed first
  - Small badge count per claim (e.g. "1 Rejected · 1 Included · 2 Modified")
- Selecting a claim shows every reviewed item on the right:

| Field | Source |
|---|---|
| Service Name | the role/service that was reviewed |
| Change Type | "Provider Change", "Service Added", or "Service Removed" (the latter two are the same underlying trigger — Service Added — displayed differently based on whether the final outcome was Included or Rejected) |
| Original Value | the Adjuster's own proposed value (their selected vendor, or "Added" for a new service) — **not** the rule engine's recommendation |
| Final Value | the Supervisor's decision (final vendor, or "Included"/"Removed") |
| Final Badge | Modified / Included / Rejected |
| Supervisor Comment | the mandatory comment entered in the popup |
| Reviewed Date & Time | when the Supervisor confirmed that service's popup |

- Only claims with at least one reviewed item scoped to the logged-in Adjuster are shown
  - A Supervisor's review of a *different* Adjuster's override never appears here

- Date Range filter narrows the left panel by each claim's most-recent reviewed date
  - Options: **All**, Today, This week, This Month, This Quarter, This Year
  - **All** is first in the list and is the default on initial page load (previously defaulted to Today)
  - Selecting **All** applies no date filtering — every reviewed claim scoped to the logged-in Adjuster is shown, regardless of when it was reviewed
  - Claim count badge in the page header and the "No claims match your filters" empty state both reflect whichever range is selected, including **All**
  - Other five options keep their existing filtering behavior

- Calendar icon sits next to the Date Range dropdown, letting the Adjuster pick one exact date instead of a relative range
  - Clicking it opens a month popup (prev/next month navigation, today highlighted)
  - Picking a day narrows the left panel to only the claims whose most-recent reviewed date falls on that day
- Picking a specific date **overrides** the dropdown
  - Dropdown's own selection stays visible but has no filtering effect while a specific date is active
- Choosing a new option from the dropdown clears the specific date
  - Vice versa not needed — picking a date is itself the override
  - Two controls never apply at once
- Picked date can also be cleared directly from its own "×"
  - Reverts filtering to whatever the dropdown is currently set to
- Dropdown itself is unchanged/not removed by this addition
- Claim count badge and empty state reflect the specific-date filter the same way they do for the dropdown

## 11. Preserved / Explicitly Unchanged

- Routing, existing APIs, Claims Command Center functionality outside this workflow — unchanged
- Existing single-service `reviewServiceVendor` mutation (built for the earlier Pending Review workflow)
  - Left in place, unused by any UI
  - See `SupervisorReview-techspec.md`
- All new data lives in the existing `serviceVendorReview[]` array on `claim_intake_records`
  - Extended, not replaced
  - No new collection introduced
  - Per "reuse existing MongoDB collections wherever possible"

## 12. Adjuster Comments on Pending Review (New)

- Surfaces to the Supervisor the same **Reason for Change** text an Adjuster must enter for every plan-service toggle and every provider switch (`claimIntakeMaster-frd.md`'s existing mandatory "Reason for Change" modal)
  - No separate comment box for the Adjuster to fill in
- Separate from the mandatory per-service Supervisor Comment described in §6/§10 above

### 12.1 Capture (Adjuster)

- No new input
- On **Confirm Selection** click:
  - Reason(s) entered via the "Reason for Change" modal, for every service/provider change made in that submission
  - Combined (deduplicated, joined)
  - Saved as the claim's "Adjuster Comments"
  - Together with the Adjuster's name and a server-recorded submission timestamp
- No changes in this submission (plain re-confirm): nothing to show
  - Supervisor sees "No comments provided."

### 12.2 Display (Claims Supervisor — Pending Review Screen)

Shown in two places, both read-only for the Supervisor:

1. **Claim-level summary.** Claims Supervisor opens a claim in **Pending Review**:
   - Read-only **Adjuster Comments** section shown (styled like the existing Claim Snapshot card), containing:
   - **Adjuster Name** — who submitted the claim for review
   - **Submitted Date & Time** — when Confirm Selection was clicked
   - **Adjuster Comments** — the combined reason text, or the literal text
     **"No comments provided."** when none was entered

2. **Per-service.** Against the specific service row that's Pending Review (next to its Recommended/Selected Provider and "Added by"/"Overridden by" line):
   - That service's own reason is shown as **"Adjuster Comment:"**
     - Reason given for that service's own toggle-on or provider switch, not the claim-wide combined text
   - A service with no individual reason attached (e.g. it wasn't the one changed this submission) shows no line, rather than a claim-wide fallback

- Neither location participates in the Supervisor Comment / `serviceVendorReview[]` review-decision workflow in §6/§10
  - They're context for the Supervisor before they make their own review decision

### 12.3 Explicitly Unchanged

- Existing Supervisor Comment (§6), Supervisor Comments page (§10), `confirmSupervisorReview`/`getSupervisorReviewedClaims` logic — untouched
- Supervisor's own Confirm Selection (accepting/modifying/rejecting a service)
  - Never overwrites the Adjuster's stored comment
  - That click does not resend it
- Persisted on the existing `claim_intake_records` collection (new fields `adjusterComments`, `adjusterSubmittedBy`, `adjusterSubmittedAt`)
  - No new collection
  - Consistent with §11
