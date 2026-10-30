# ISO ClaimSearch Signal — Technical Spec

Implements `IsoClaimSearch-frd.md`. Frontend-only mock feature — no backend
schema/resolver changes; no new GraphQL fields.

## 1. Data generation — `apps/frontEnd/src/utils/isoClaimSearchMockData.ts`

- `getIsoClaimSearchData(record: IndividualClaimRecord | null | undefined): IsoClaimSearchData | null`
  — single entry point.
  - Called from `claimIntakeDetails/index.tsx`.
- Deterministic-per-claim-number hashing (`djb2` + `pick`) combined with a
  `SESSION_SEED` persisted in `localStorage['iso-claimsearch-seed']`.
  - Seed rolled once via `Math.random()`, reused thereafter.
  - Results stable across refreshes within a session/device.
  - Can reshuffle across sessions.
- `CATEGORY_TEMPLATE` (`['none','double','single','single']`) seed-shuffled
  once into `CLAIM_CATEGORY`.
  - Maps each of the 4 known demo claim numbers to a category.
  - Guarantees the 1 no-match / 1 two-flag / 2 one-flag spread described in the FRD.
  - Unknown claim numbers: fall back to a weighted random pool (including a
    no-match outcome), not this fixed mapping.
- 7 flag-type builder functions (`buildPriorClaimsHistory`,
  `buildSharedLegalRepresentation`, `buildEmployerClaimClustering`,
  `buildEmployerFrequencySpike`, `buildCrossJurisdictionMatch`,
  `buildTreatingProviderUtilizationOutlier`, `buildClaimFrequency`) —
  each returns an `IsoFlagCard`.
  - `SIGNIFICANCE_ORDER` ranks flag types.
  - Sorts a multi-flag claim's cards most-significant-first.
- After building a claim's flag cards: every match's Date of Loss compared
  against the current claim's `lossDate`.
  - Exact match sets `sameDayAsCurrent = true` on that match record.
  - Drives the "SAME DAY" badge.

## 2. Injury consistency — shared resolution function

Both this module and the Claims Summary section resolve "this claim's
injury" through the **same** function,
`getClaimSummaryData(claimNumber, insuredName, realInjuryType?, realBodyPart?)`
in `apps/frontEnd/src/utils/claimSummaryMockData.ts`.
- Guarantees the two sections can never disagree:

```ts
// claimSummaryMockData.ts
const realLabel = realInjuryType?.trim();
const realPart  = realBodyPart?.trim();
const injury: InjuryData = realLabel
  ? {
      ...baseInjury,                 // hashed pick — supplies icd/resolutionWeeks/laeOpportunity
      label:       realLabel.toLowerCase(),
      bodyPart:    realPart || baseInjury.bodyPart,
      description: realPart ? `${realLabel.toLowerCase()} to the ${realPart.toLowerCase()}` : realLabel.toLowerCase(),
    }
  : baseInjury;                      // no real data on the record — fall back to the deterministic mock pick
```

- `index.tsx` calls `getClaimSummaryData(selectedRecord?.claimNumber, selectedRecord?.insuredName, selectedRecord?.injuryType, selectedRecord?.bodyParts)` — renders the Claims Summary section.
- `isoClaimSearchMockData.ts`'s `resolveInjury(r)` calls the identical function with the identical arguments.
  - Reads `summary.injury.label` / `summary.injury.bodyPart` for every match's "Alleged Injury" / "Part of Body" fields.
  - Does **not** prioritize `r.injuryType` over the mock pick.
  - Reason: previously let the two sections diverge when a claim record carried real injury data.
    - Mock-only Claims Summary ignored it.
    - ISO panel used it.
  - Fix: route the real fields through `getClaimSummaryData` once — closes that gap.

**Regression coverage:** `apps/frontEnd/src/utils/__tests__/isoClaimSearchMockData.test.ts`
- Test: *"every match's Alleged Injury / Part of Body always agrees with this claim's Claims Summary section, even when the record has real injuryType/bodyParts set"*.
- Asserts every match's Alleged Injury/Part of Body field equals `getClaimSummaryData(...).injury.label`/`.bodyPart` for the same claim number and real injury fields.

## 3. UI — `apps/frontEnd/src/pages/ClaimIntake/claimIntakeDetails/index.tsx`

- `IsoClaimSearchFlyout` rendered via `createPortal` into `document.body`.
  - Measures its own rendered size with `useLayoutEffect` +
    `panelRef.current.offsetWidth/offsetHeight`.
  - Computes a clamped `top`/`left` position from that (flips left-of-trigger /
    up-from-trigger as needed).
  - Stays `visibility: hidden` until positioned — avoids a flash of
    misplaced content.
- Hover state: `openIsoFlyout(el)` stores `el.getBoundingClientRect()` on
  mouse-enter of the eye icon (`cid-ai-eye-btn`).
  - `scheduleIsoHide()` / `cancelIsoHide()` implement a 150ms grace period.
  - Moving the pointer from the icon into the panel doesn't close it.
- Signals row text computed inline from `isoClaimSearchData.flags`:
  - Total match count summed across all flag cards.
  - All `flagHeading`s joined with `" + "`.

## 4. Styling — `apps/skin/css/custom.css`

- `.iso-flyout` — fixed-width flyout container, `max-height: calc(100vh -
  24px)`, `display:flex; flex-direction:column`.
- `.iso-flyout__body` — `overflow-y:auto; flex:1; min-height:0` — internal
  scroll region. Stacked multi-flag content never overflows the panel frame.
- `.iso-flyout__match` — neutral gray match-detail table container, visually
  distinct from:
- `.iso-flyout__flag-box` — red-left-border (`border-left: 3px solid
  var(--color-danger)`) indicator card for the flag explanation + claim
  facts, separated by `.iso-flyout__flag-divider`.
- `.iso-flyout__same-day-badge` — filled danger-color pill, the most
  visually prominent element on a match card.
- `.cid-ai-signal__badge--iso` / `--iso-clear` — warning / success colored,
  non-interactive (no cursor/hover styling).
