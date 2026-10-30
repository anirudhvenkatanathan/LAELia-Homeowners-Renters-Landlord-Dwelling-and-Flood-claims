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

- Clarified with requester, then **superseded by follow-up instruction**:
  - Scope unchanged: effect applies **only to the vendor** just boosted.
    - Not a bulk update across every Suspended/Requalification Due vendor.
  - Mechanism revised:
    - Requester instruction: "make all qualification layers for requal/Suspended to Approved status" — a real data change, not just a display bypass.
    - `applyPriorityBoost` now rewrites `ConfirmationDocModel`.
    - Every applicable qualification requirement for that vendor flipped to `approvalStatus: 'Approved'`.
    - Already-`Waived` items left alone.
    - Earlier "never touch document approval data" reading of §8: superseded for this flow.
    - §8 now treated as "don't change the onboarding/approval *logic* for other vendors" — still true:
      - `computeStageStatus()` itself untouched.
      - Every other vendor status path unaffected.
  - `finalApprove` stage-completion bypass added in first pass:
    - Kept as defensive fallback, normally moot now.
    - After `approveAllQualificationLayers` runs, `computeStageStatus()` reports every stage `Completed` automatically.
- **Superseded (2026-07-24) by "Service Provider Activation Workflow Enhancement" below**:
  - §4 hard rule ("vendor cannot be activated until Priority Boost is completed", 422 from `finalApprove`): no longer holds for Suspended / Requalification Due / In Progress vendors.
  - User now chooses, via new Activate confirmation dialog, to activate with or without a Priority Boost.
    - Full behavior: see new section below.
  - Everything else on this page unchanged:
    - The Boost column.
    - The modal's fields/validation.
    - The `vendor_priority_boost` collection.

---

## Service Provider Activation Workflow Enhancement (2026-07-24)

- Enhances **Activate Vendor** workflow, only for **In Progress** / **Suspended** / **Requalification Due** vendors.
- Does not change:
  - Priority Boost fields/validation above.
  - Recommendation Engine / FitIQ / provider-scoring logic anywhere else in the app.
- **Superseded same day**:
  - Earlier pass of this section (kept below, replaced by this one): introduced a 3-option confirmation dialog in front of the Priority Boost modal.
  - Follow-up instruction reversed that: **no new screen or dialog**.
    - Priority Boost modal must open directly.
    - Its own buttons changed instead — no dialog in front of it.

### Standalone "Apply Priority Boost" button removed

- Button described in §2 above no longer exists.
- Priority Boost workflow now reached only through the **Activate Service Provider** action, for these three statuses.
- No other new button or screen was added.

### Activate Vendor flow

- **Activate Service Provider** click, three targeted statuses: opens **Priority Boost modal directly**.
  - Same modal from §3 above.
  - Same fields: States / Service Disciplines / Assignment Limit / Reason for Boost.
  - Pre-populated from vendor's Priority Boost record, if one exists.
    - Blank otherwise.
- Footer now has three buttons instead of original two:

1. **Activate with Boost**
   - Validates States, Service Disciplines, Reason for Boost as mandatory (unchanged from §3).
   - On success:
     - Saves the Priority Boost (Boost badge → **Yes**).
     - Activates the vendor (status → **Active**).
     - Closes the modal.
     - Shows a success message.
   - If boost saves but activation fails otherwise:
     - Modal stays open, entered values intact (not lost).
     - Page-level error banner explains why.
2. **Activate without Boost**
   - **Reason for Boost NOT mandatory** here.
   - No other field mandatory either.
   - Nothing entered on the form validated or saved.
   - Activates the vendor immediately (status → **Active**).
   - Boost stays/resets to **No**.
     - Even if a prior Priority Boost had left it **Yes**.
   - Closes the modal.
   - Shows a success message.
3. **Cancel** — closes the modal; nothing activated or saved.

- Every OTHER vendor status still showing "Activate Service Provider" (e.g. fresh vendor, no boost history):
  - Click behavior unchanged.
  - Plain single "Are you sure?" confirm dialog.
  - No Priority Boost modal involved.

### Recommended Provider Logic — unchanged

- Boosted vendors still sort first in Recommended Provider dropdown.
- Boost = Yes: same recommendation priority as always.
- Nothing in this enhancement touches that sort/recommendation logic.

### Data model

- New collection `vendor_priority_boost` (Mongoose model `VendorPriorityBoostModel`, `sourceCode/apps/api/graphQL/vendorOnboardingEntity.ts`):
  - Fields: `vendorId`, `states`, `serviceDisciplines`, `assignmentLimit`, `reasonForBoost`, `boostApplied`, `createdBy`, `createdAt`, `updatedAt`.
  - Upserted per vendor — one document per vendor; re-applying updates it in place.
- `boostApplied: Boolean` denormalized onto `vendor_details` (`VendorModel`, `vendorEntity.ts`):
  - Service Provider Administration grid's `getVendors` GraphQL query: reads it directly, no extra join.
  - Mirrors `vendorStatus` denormalization pattern.

### Endpoints

- `POST /api/vendors/onboarding/apply-priority-boost` (new):
  - Validates `states`/`serviceDisciplines` non-empty and `reasonForBoost` non-blank.
  - Upserts `vendor_priority_boost`.
  - Sets `vendor_details.boostApplied = true`.
  - Vendor status `Suspended` or `Requalification Due`: calls `approveAllQualificationLayers(vendorId, performedBy)` (`vendorOnboardingController.ts`):
    - Deletes each applicable requirement's existing non-Waived `ConfirmationDocModel` doc.
    - Inserts a fresh one with `approvalStatus: 'Approved'`, `comments: 'Approved via Priority Boost'`.
- `POST /api/vendors/onboarding/final-approve` (existing, extended) — vendor status `Suspended` or `Requalification Due`:
  - Returns 422 ("Please complete the Priority Boost details before activating this vendor.") if `boostApplied` not true.
  - If `boostApplied` true: per-stage `computeStageStatus` completion loop skipped as fallback.
  - All other vendor statuses unaffected — §8 preserved for them.

### UI

- States and Service Disciplines: rendered as **checkbox grid** (not dropdown).
  - Same `vs-category-panel` / `vs-category-checkbox` pattern already used for Category filter on Service Provider Administration grid (`VendorSearch/index.tsx`).
  - Reused via small local `CheckboxGrid` component in `VendorOnboardingDetails/index.tsx`.
- "Boost" column added to Service Provider Administration grid (`VendorSearch/index.tsx`), immediately after "Category".
  - Grey "No" / green "Yes" badge.
  - Sourced from `Vendor.boostApplied`.
- "Apply Priority Boost" button renders below "Activate Service Provider" on vendor detail screen (`VendorOnboardingDetails/index.tsx`).
  - Only when `vendorStatus` is `Suspended` or `Requalification Due`.
- Priority Boost modal:
  - States (multi-select, full US state list) — required.
  - Service Disciplines (multi-select, scoped to *that vendor's* qualified service categories — read as "applicable to the provider") — required.
  - Assignment Limit — optional numeric field.
  - Reason for Boost — required textarea.
  - No Boost Duration field, per spec.