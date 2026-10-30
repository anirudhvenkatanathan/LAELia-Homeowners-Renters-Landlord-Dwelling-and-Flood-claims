# FRD — Service Provider Screen

**Module:** Service Provider
**Screen:** Service Provider (landing)
**Version:** 1.8
**Date:** July 2026

---

## 1. Overview

-   Landing page for the Service Provider module
-   4 navigation tiles + A/B testing info panel

## 2. Navigation

| Menu | Path |
|---|---|
| Service Provider | `/service-provider` |

## 3. Tiles (2×2 grid)

| Tile | Route |
|---|---|
| Provider Administration | `/vendor/search` |
| Provider Onboarding | `/vendor/onboarding` |
| Curated Provider Network | `/vendor/panel` |
| Service Provider Analytics | `/service-provider-analytics` |

-   Each tile: icon, title, subtitle, CTA button
-   Click anywhere on tile → navigates to its route

## 4. A/B Testing Panel

-   New section below tile grid, titled "A/B testing"
-   2 cards, styled/structured like the 4 tiles above (icon, title, subtitle, CTA button):

| Tile | Subtitle | CTA |
|---|---|---|
| A/B Testing | A/B testing for suspended, reactivation, disqualified vendors. | Open A/B Testing |
| Base Line Testing | Base Line testing for any newly onboarded vendors. | Open Base Line Testing |

- No destination screen exists for either yet
  - Both cards **disabled** (not clickable, CTA greyed out) — no links, no pretending
  - Hover still lifts card (visual feedback)
- Clearly marked as not-yet-available
  - Dashed border + subtly different background tint
  - Avoids being mistaken for active/clickable tiles
- "A/B testing" section title: left-aligned (not centered)
- Everything else (card size, icon style, typography, layout): matches the 4 tiles
