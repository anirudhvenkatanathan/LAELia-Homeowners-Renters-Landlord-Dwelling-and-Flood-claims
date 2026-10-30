# Tech Spec — Service Provider Screen

**Module:** Service Provider
**Screen:** Service Provider (landing)
**Version:** 1.8
**Date:** July 2026

---

## 1. Component

`ServiceProviderLanding` — `sourceCode/apps/frontEnd/src/pages/ServiceProvider/ServiceProviderLanding/index.tsx`. Static page, no API calls.

## 2. Structure

- `TILES` array (4 items) → `sp-grid` (2×2 CSS grid) of `Tile` components.
- `AB_TEST_TILES` array (2 items) → same `Tile` component, same `sp-grid` layout, nested inside an `sp-abtest` wrapper (with the "A/B testing" title) rendered below the main `sp-grid`.
- `Tile` supports `route?` (optional) and `disabled?`
  - When `disabled` is true or `route` is absent:
    - Card doesn't navigate
    - Card isn't keyboard-focusable (`tabIndex={-1}`)
    - CTA `<button>` gets the native `disabled` attribute
- 2 new color variants for A/B tiles: `teal` (A/B Testing), `indigo` (Base Line Testing)

## 3. CSS classes (`sourceCode/skin/css/custom.css`)

| Class | Purpose |
|---|---|
| `.sp-abtest` | Wrapper card around the A/B testing `sp-grid` (white card, border, radius — same tokens as `.sp-tile`) |
| `.sp-abtest__title` | "A/B testing" section heading (left-aligned) + bottom divider |
| `.sp-tile--disabled` | Dashed border + slightly off-white background so it reads as different from the 4 active tiles. Keeps the normal hover lift/shadow; only `cursor: default` and no navigation. `.sp-cta` inside gets reduced opacity + `cursor: not-allowed` |
| `.sp-tile--teal`, `.sp-tile--indigo` | New icon/CTA color tokens, same pattern as `.sp-tile--purple/--green/--blue/--orange` |

The A/B tiles reuse `.sp-tile`, `.sp-tile__icon-wrap`, `.sp-tile__title`, `.sp-tile__subtitle`, `.sp-cta` etc. — no separate box CSS.

## 4. Layout change

- `.sp-landing` previously: fixed `height` + `overflow: hidden`, fit 4 tiles to viewport (no scroll)
- A/B panel needs more vertical room:
  - `.sp-landing`: `height` → `min-height`, `overflow: hidden` removed (page now scrolls naturally like other screens)
  - `.sp-grid`: `flex: 1; min-height: 0;` → `flex-shrink: 0;` (tiles size to content instead of stretching to fill the old fixed-height viewport)

## 5. Revision history

- v1.0–1.3: dedicated `.sp-abtest__box` markup — plain box, then heading-only box, resized a few times
- v1.4: A/B boxes reuse the exact `Tile` component/card used by the 4 tiles above
  - Icon, title, subtitle, "Open …" CTA — full visual/structural consistency
  - No destination screen yet for either — both tiles rendered with `disabled: true` (not clickable, not keyboard-focusable, CTA button has the native `disabled` attribute, dimmed via `.sp-tile--disabled`)
  - Confirmed with the user before implementing (chose "style like tiles, CTA disabled" over adding real routes or dropping the CTA)
- v1.5: restored the hover lift/shadow on the disabled A/B tiles
  - Removed the `.sp-tile--disabled:hover` override
  - Hover still gives visual feedback despite no navigation
  - `.sp-abtest__title` ("A/B testing") changed from centered to left-aligned
- v1.6: made disabled vs. active tiles visibly distinct — `.sp-tile--disabled` now has a dashed border, a slightly off-white background (`#fbfbfc` vs `#fff`), and a "Coming Soon" badge in the top-right corner (`::after`)

## 6. Verified

- `tsc --noEmit` clean
- No existing tests for this page
- Not visually verified in a browser
  - No MongoDB/API in sandbox to run full stack behind Service Provider route's auth guard
  - No browser binary available
  - Only CSS/structure reviewed against reference mockup
