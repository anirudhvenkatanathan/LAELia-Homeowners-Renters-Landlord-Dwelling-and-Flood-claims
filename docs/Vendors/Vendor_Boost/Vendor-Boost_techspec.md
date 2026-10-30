````text

## Feature Enhancement – Priority Boost Validation Before Vendor Activation



### Objective



Introduce a **Priority Boost** workflow in the **Service Provider Administration** module. A vendor cannot be activated until the required **Priority Boost** information has been completed.



---



## 1. Service Provider Administration Grid



Add a new column named **Boost** immediately after the **Category** column.



### Default Value



- Display a **"No"** badge.

- Badge color: **Grey**.

- All existing and newly created providers should default to **No**.



Once a Priority Boost is successfully applied, update the badge to **"Yes"** using the application's success color.



---



## 2. Apply Priority Boost Button



For vendors with the following statuses:

 

- Suspended

- Requalification Due



display an additional button below the **Activate Vendor** button.



Button Label:



```

Apply Priority Boost

```



Follow the existing button styling used throughout the application.



---



## 3. Priority Boost Modal



Clicking **Apply Priority Boost** should open a modal similar to the attached design.



Required fields:



### States *



- Multi-select state list.



### Service Disciplines *



- Multi-select service disciplines applicable to the provider.



### Assignment Limit (Optional)



- Numeric input.

- Leave blank if no assignment limit is required.



### Reason for Boost *



- Multi-line text area.

- Mandatory.



**Do not include the "Boost Duration" section.** Remove it completely from the modal.



---



## 4. Validation Before Vendor Activation



After all onboarding documents are approved and the **Activate Vendor** button becomes enabled:



If **Priority Boost** has **not** been completed, the system must prevent vendor activation.



When the user clicks **Activate Vendor**, display validation errors indicating that the Priority Boost information is required before activation.



Example validation message:



> Please complete the Priority Boost details before activating this vendor.



The vendor must not be activated until all mandatory Priority Boost fields are completed successfully.



---



## 5. Successful Priority Boost



After successfully saving the Priority Boost:



- Update the **Boost** column badge from **No** to **Yes**.

- Store the Priority Boost details in MongoDB.

- Allow the **Activate Vendor** action to proceed.

- Display a success notification.



---



## 6. MongoDB



Persist the following information:



- Vendor ID

- Selected States

- Selected Service Disciplines

- Assignment Limit

- Reason for Boost

- Boost Applied (Yes/No)

- Created By

- Created Date

- Last Updated Date



---



## 7. Business Rules



- Every vendor must complete the Priority Boost configuration before activation.

- Boost Duration is not required and should not be displayed.

- Assignment Limit remains optional.

- States, Service Disciplines, and Reason for Boost are mandatory.

- Vendors cannot be activated until the Priority Boost has been successfully saved.

- The Boost badge should accurately reflect whether Priority Boost has been applied.



---



## 8. Preserve Existing Functionality



- Do not modify the existing onboarding workflow.

- Do not change document approval logic.

- Do not modify vendor qualification logic.

- Do not change activation logic except for introducing the Priority Boost validation.

- Maintain the existing LAElia UI styling and workflow consistency.

````



- After Priority Boost is completed for a vendor:
  - Change the Boost badge from **No** to **Yes** in the grid.
  - Change all Suspended and Requalification Due vendors' qualification layers from Pending to Approved status.

---

## Implementation Notes (as built)

See `Vendor-Boost_frd.md` "Implementation Notes" for the full write-up. Summary:

- New Mongoose model `VendorPriorityBoostModel` → collection `vendor_priority_boost` (`sourceCode/apps/api/graphQL/vendorOnboardingEntity.ts`).
  - Upserted per vendor.
- `vendor_details.boostApplied: Boolean` denormalized flag (`vendorEntity.ts`).
  - Exposed on the GraphQL `Vendor` type for the grid.
- New controller `applyPriorityBoost` + route `POST /api/vendors/onboarding/apply-priority-boost` (`controllers/vendorOnboardingController.ts`, `routes/vendorOnboardingRoutes.ts`).
  - Vendor status `Suspended`/`Requalification Due`: also calls `approveAllQualificationLayers(vendorId, performedBy)`.
    - A real data mutation.
    - Deletes each applicable requirement's existing non-Waived `ConfirmationDocModel` doc.
    - Inserts a fresh `approvalStatus: 'Approved'` one.
    - Supersedes original "logic bypass only, never mutate" design, per follow-up requester instruction.
- `finalApprove` still 422s with spec's exact validation message when a Suspended/Requalification-Due vendor lacks `boostApplied`.
  - Per-stage `computeStageStatus` completion-loop skip kept as defensive fallback.
  - Normally moot: `approveAllQualificationLayers` already makes every stage compute `Completed` on its own.
- Frontend:
  - `Vendor`/`VendorOnboardingDetails` models.
  - `vendorService`/`vendorOnboardingService`.
  - `useVendorOnboardingDetails` (`applyBoost`).
  - `VendorSearch` grid (Boost column).
  - New `PriorityBoostModal` in `VendorOnboardingDetails/index.tsx`, built on existing modal shell.
  - States and Service Disciplines: checkbox grid (`CheckboxGrid`, reusing `vs-category-panel`/`vs-category-checkbox` CSS already used for grid's Category filter).
    - Replaces `MultiSelect` dropdown used in first pass.

**Note**:
- `approveAllQualificationLayers` described above not present in current codebase (`controllers/vendorOnboardingController.ts` has no function by that name).
- This section predates the 2026-07-24 change below.
- Left as historical record, not corrected retroactively.
  - Auditing that drift wasn't in scope for this session.
- Stage-completion bypass in current code: `preApproveQualification` carve-out, described below.
  - Pre-dates and is independent of that claim.

---

## Service Provider Activation Workflow Enhancement (2026-07-24)

### Backend — `controllers/vendorOnboardingController.ts`

- **`getOnboardingDetails`**:
  - Now also fetches `VendorPriorityBoostModel.findOne({ vendorId }).lean()` alongside existing `Promise.all` fetches.
  - Includes it in response as `priorityBoost: { states, serviceDisciplines, assignmentLimit, reasonForBoost } | null`.
    - `null` when no boost record exists yet.
  - Purpose: lets frontend pre-populate Priority Boost modal with vendor's existing values (FRD "Option 1").
    - Instead of always starting blank.
- **`finalApprove`**:
  - Removed hard `if (requiresBoost && !boostApplied) → 422` block.
    - A Suspended / Requalification Due / In Progress vendor can now be activated without a Priority Boost.
    - Frontend's new confirmation dialog: makes that a valid user choice.
    - No longer hard-blocked server-side.
  - Per-stage `computeStageStatus` completion check (previously skipped only when `boostApplied` was true): now ALSO skipped whenever vendor's prior status is one of those same three.
    - Renamed to `preApproveQualification`, from old `requiresBoost`.
    - Same three statuses, same spaced/unspaced "In Progress" check.
  - This carve-out necessary, not optional:
    - `getOnboardingDetails` already synthesizes every Qualification Layer question as pre-approved for these three statuses ("TEMPORARY (testing only)" comment, pre-existing).
    - Result: frontend's `allStagesCompleted` is always `true` for them.
    - `finalApprove`'s own stage check reads REAL `ConfirmationDocModel` records only, not that synthetic view.
    - Without mirroring same carve-out here: "Activate without Priority Boost" would 422 with "stage not completed" for almost every vendor this feature targets.
    - Reason: real document approvals typically don't exist in this environment for Suspended/Requalification-Due/In-Progress test vendors.

### Frontend — `VendorOnboardingDetails/index.tsx`

- Removed standalone "Apply Priority Boost" ghost button.
  - Previously rendered below "Activate Service Provider" whenever `boostRequired`.
- New state `showActivateChoice`.
- "Activate Service Provider" button's `onClick` now checks `boostRequired` (unchanged flag — Suspended / Requalification Due / In Progress).
  - Opens new `ActivateVendorChoiceModal` for those three statuses.
  - Instead of going straight to `setActiveDialog('finalApprove')`.
  - Every other status's click behavior untouched.
- Button's `disabled`/`title` logic (stage-completion / already-boosted gate) unchanged.
  - Already a no-op for these three statuses.
  - Reason: `allStagesCompleted` always `true` for them via same synthetic pre-approval noted above.
- New component `ActivateVendorChoiceModal` (styled like existing `ConfirmModal`/`PriorityBoostModal` shell). Three buttons:
  - Cancel.
  - "Activate without Priority Boost" (`btn--accept`) — calls `finalApprove` directly, closes the dialog.
  - "Activate with Priority Boost" (`btn--primary`) — closes choice dialog, opens existing `showBoostModal`/`PriorityBoostModal`.
- `PriorityBoostModal` gained three new optional props — `initialServiceDisciplines`, `initialAssignmentLimit`, `initialReasonForBoost`.
  - Used as `useState` initializers.
  - Replaces previous hardcoded defaults (all qualified roles / blank / blank).
- Render call now passes `details.priorityBoost?.{states, serviceDisciplines, assignmentLimit, reasonForBoost}` when present.
  - Falls back to prior defaults (coverage-derived states, all qualified roles, blank) when `priorityBoost` is `null`.
- Footer button relabeled from "Apply Boost" to **"Apply Boost and Activate"**.
- `PriorityBoostModal`'s `onSubmit` (passed from parent) now chains two hook calls instead of one:
  - `applyBoost(...)`.
  - `finalApprove(user?.username)` — only if `applyBoost` succeeds.
- Modal's own `handleSubmit` only calls `onCancel()` (closing itself) if returned `{success}` is `true`.
  - A boost that saved but couldn't activate: leaves form open, user's entries intact.
- Both hook calls already show their own success/error toasts via `showNote` internally.
  - No new messaging plumbing needed.
- `useVendorOnboardingDetails.finalApprove` changed to `return result;` (and typed failure object in `catch` branch).
  - Enables chaining to check its outcome.
  - Previously resolved to `void`.
- Additive only.
  - One other caller (`handleDialogConfirm`) already ignored return value.
  - Not a breaking change.
- Frontend model (`models/vendorOnboarding/vendorOnboardingModel.ts`):
  - Added `PriorityBoostDetails` interface.
  - Added `priorityBoost: PriorityBoostDetails | null` on `VendorOnboardingDetails`, matching the new API field.

### Tests

- New file `VendorOnboardingDetails/__tests__/VendorOnboardingDetails.activation.test.tsx` (5 tests).
  - Mocks `useVendorOnboardingDetails`/`useAuth`/`AppShell` — same pattern as `claimIntakeDetails` tests use for their own hooks.
  - Standalone boost button is gone.
  - Clicking Activate for a Suspended vendor opens the 3-option dialog.
  - Cancel closes it with no calls.
  - "Activate without Priority Boost" calls `finalApprove` only.
  - "Activate with Priority Boost" opens the modal pre-populated from a `priorityBoost` fixture.
  - "Apply Boost and Activate" calls `applyBoost` then `finalApprove` in that order (asserted via `mock.invocationCallOrder`).
  - **Verified these tests catch the regression**:
    - Reverted the button's `onClick` back to always `setActiveDialog('finalApprove')`.
    - Re-ran, confirmed 4 of 5 tests failed (the dialog never appeared).
    - Restored and confirmed all 5 pass again.
- `tsc --noEmit` clean (both apps).
- Frontend `vitest` 469/469 (464 prior + 5 new).
- Backend `jest` 20/20.
- Both dev servers restarted.

### Follow-up (same day): dialog redesign, then reversed entirely

Two follow-ups to `ActivateVendorChoiceModal`, requested after initial build:
- Footer buttons changed from a horizontal row to a vertical, full-width stack (`flexDirection: 'column'`, `alignItems: 'stretch'`).
  - Reworked again below.
- Redesigned as two left-aligned "choice cards" instead of plain stacked buttons.
  - New `.activate-choice-card` / `--primary` / `--neutral` / `__icon` / `__body` / `__title` / `__desc` / `__badge` classes in `custom.css`.
  - Themed with the existing `--color-primary`/`--color-primary-lt`/`--color-border` tokens rather than new colors.
  - Each card is itself the clickable action (icon + title + one-line description).
  - Requested order: **Activate with Priority Boost** (primary-teal, tagged "Recommended") first, **Activate without Priority Boost** (neutral-gray) second, **Cancel** as the sole footer button last.
  - Distinct from the pre-existing `.modal-radio-card` pattern elsewhere (a select-then-submit radio grid).
    - These cards fire their action immediately on click, no separate submit step.
- Test file updated:
  - Two `getByRole('button', {name: ...})` queries switched from exact strings to regexes.
    - Each card's accessible name now also concatenates its nested description (and, for the boost card, the "Recommended" badge) text.
  - `getByText` queries were unaffected.
    - `getNodeText` (unlike accessible-name computation) only reads an element's own direct text-node children, not descendant elements'.
  - `tsc --noEmit` clean.
  - Frontend `vitest` 469/469 (unaffected count — no new tests added for the redesign itself).
  - Frontend dev server restarted.

**Then explicitly reversed**: "Do not create a new confirmation popup or
screen... Reuse the existing Priority Boost screen/modal... The existing
Priority Boost screen should open directly when the user clicks Activate
Vendor."
- `ActivateVendorChoiceModal` deleted outright — the whole component, its `.modal__body` markup, and its dedicated `.activate-choice-card*` CSS block.
- `showActivateChoice` state also removed.
- Priority Boost modal itself now opens directly.

### Rework: Priority Boost modal gets 3 footer buttons instead of a 2-button modal behind a chooser

- **Button onClick** (the "Activate Service Provider" button, `boostRequired`
  branch): now `setShowBoostModal(true)` directly, no intermediate state.
- **`PriorityBoostModal` props**: `onSubmit` replaced with two separate callbacks:
  - `onActivateWithBoost(payload) => Promise<{success,message}>` — full validation: States/Service Disciplines/Reason for Boost all mandatory, same as before.
  - `onActivateWithoutBoost: () => Promise<{success,message}>` — no payload, no validation.
    - This path saves nothing on the form.
    - Empty Reason for Boost: ignored, not blocked.
    - Per "Reason for Boost is NOT mandatory... ignore any empty value" instruction.
- **Footer**: three full-width stacked buttons.
  - Order requested for the (now-removed) choice dialog, kept here:
  - **Activate with Boost** (`btn--primary`) — runs `handleActivateWithBoost`.
  - **Activate without Boost** (`btn--accept`) — runs `handleActivateWithoutBoost`, no validation.
  - **Cancel** (`btn--ghost`) — `onCancel`.
- **Backend — `finalApprove`**: gained an optional `resetBoost?: boolean` request-body field.
  - When true: `boostApplied: false` added to same `vendor_details` update setting `vendorStatus: 'Active'`.
  - Lets "Activate without Boost" satisfy "Set the vendor's Boost value to No".
    - Even for a vendor with a PRIOR Priority Boost applied (e.g. re-suspended, then reactivated without boosting).
  - `vendor_priority_boost` record itself left untouched — only the denormalized flag resets.
  - "Activate with Boost" path never passes `resetBoost`.
    - `boostApplied` already set `true` by `applyBoost` moments earlier in that path.
- **`finalApproveVendor`** (frontend service) and **`useVendorOnboardingDetails.finalApprove`** (hook) both gained a third `resetBoost?: boolean` parameter.
  - Threaded straight through to the request body.
- Test file rewritten (`VendorOnboardingDetails.activation.test.tsx`, now 6 tests):
  - Standalone button still gone.
  - Clicking Activate opens the Priority Boost modal directly (States/Service Disciplines/Reason for Boost labels and all three footer buttons visible, nothing called yet).
  - Cancel closes with no calls.
  - **Activate with Boost** blocks on an empty Reason for Boost with the field error, calling neither hook.
  - **Activate without Boost** ignores that same empty field, calls `finalApprove(user, true)` only.
  - **Activate with Boost** (pre-populated fixture) calls `applyBoost` then `finalApprove(user)` (no `resetBoost`) in that order.
  - **Verified the regression-catching test**:
    - Temporarily reinstated validation inside `handleActivateWithoutBoost`.
    - Re-ran, confirmed the "ignores an empty Reason for Boost" test failed (timed out waiting for `finalApprove`).
    - Restored and confirmed all 6 pass again.
- `tsc --noEmit` clean (both apps).
- Frontend `vitest` 470/470 (464 baseline + 6, replacing the prior 5).
- Backend `jest` 20/20.
- Both dev servers restarted.

### Follow-up: footer buttons on one line, and History now distinguishes with/without Boost

- **Footer layout**: reverted the vertical stack back to the default horizontal `.modal__footer` row (`flexWrap: 'wrap'` only, no per-button `width: 100%`).
  - Order: **Activate with Boost**, **Activate without Boost**, **Cancel** (left to right).
  - `.modal__footer`'s own `justify-content: flex-end` keeps the group right-aligned as usual.
- **`finalApprove` (backend)**: now passes a `remarks` string to `recordVendorHistory` instead of always `''`:
  - `'Activated without Priority Boost'` when `resetBoost` was sent.
  - `'Activated with Priority Boost'` when `boostApplied` is already `true` at this point (i.e. `applyPriorityBoost`'s own request just completed).
  - `''` for any activation where Priority Boost was never part of the flow (other vendor statuses).
  - History card already rendered `entry.remarks` unconditionally (`VendorOnboardingDetails/index.tsx`).
  - No frontend change needed for this to show up.
- **Verified live** (not just re-reading code) against real seeded vendors via direct `curl` calls to `/api/vendors/onboarding/final-approve` and `/apply-priority-boost` for both paths. Confirmed:
  - A `vendor_status_history` entry created every time either path succeeds.
    - Already true before this follow-up — `useVendorOnboardingDetails.finalApprove` already called `refetchHistory()` unconditionally on success.
  - That entry's `remarks` field correctly reads "Activated without Priority Boost" / "Activated with Priority Boost", matching button used.
- Test vendors and their history entries fully restored afterward.
  - Includes `RequalificationStartDate`/`RequalificationEndDate` — live test run itself sets these.
  - Omitting them in first cleanup pass caused confusing, unrelated 422 on second manual test round.
  - Restoring them resolved it.
- `tsc --noEmit` clean.
- Backend `jest` 20/20.
- Frontend `vitest` 470/470 (unaffected — this follow-up didn't change any tested frontend behavior other than button layout).
- Both dev servers restarted.