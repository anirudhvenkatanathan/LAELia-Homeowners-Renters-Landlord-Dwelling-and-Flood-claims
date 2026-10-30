# FRD — Provider Scoreboard

**Module:** Service Provider
**Screen:** Provider Scoreboard
**Version:** 1.3
**Date:** July 2026

---

## 1. Overview

Shows active service providers grouped by service type (e.g. IME, Pharmacy, Bill Review), each rated by a **Provider Performance Index (PPI)** — replaces the old flat list with a single blended 5-star rating per provider.

"PPI" and "Provider Performance Index" appear once, as the column heading only. Each provider's own row shows just the numeric score, rounded to one decimal place and formatted as "X.X/5".

## 2. Navigation

| Menu | Path |
|---|---|
| Provider Scoreboard | `/service-provider-analytics` |

## 3. Groups

- One group per service type a provider is registered for.
- A provider offering multiple service types appears once per type, each with its own PPI for that type.
- Groups are collapsible; each group shows a provider count.

## 4. Provider Row (per group)

- Service Provider name (+ legal entity, if different)
- PPI badge (numeric score rounded to one decimal, as "X.X/5"; color-coded: green ≥ 4.2, yellow 3.8–4.2, red < 3.8) — no "PPI" text repeated per row
- **View Performance** → opens the provider's detail/performance screen

## 5. Business Rules

1. Providers are ranked by PPI **within their own service-type group only** — providers of different service types are never compared against each other.
2. Within a group, providers are sorted by PPI, highest first.
3. Only Active / Requalification-Due providers are shown.
4. Search filters by provider name or service type name.
5. A group with many providers scrolls internally rather than growing the page.
6. A provider's PPI for a given service type is always the same value shown for that provider+service inside "View Performance" — both screens compute the score the same way.

## 6. Acceptance Criteria

- User sees providers grouped by service type, not a single flat list.
- Each provider shows a PPI score, not a 5-star rating.
- Ranking/sorting never mixes providers across different service types.
- A provider's PPI here matches the rating shown for the same provider+service in "View Performance".
- The "Provider Performance Index" column heading always fits on one line and never overflows the grid, at any screen width.
