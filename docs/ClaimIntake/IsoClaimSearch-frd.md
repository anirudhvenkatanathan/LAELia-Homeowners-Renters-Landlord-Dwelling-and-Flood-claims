# ISO ClaimSearch Signal — Functional Requirements

**Module:** Claims Management
**Screens:** Claims Command Center / Claim Details — Q-AI Insights → Signals
**Version:** 1.0
**Date:** 28-Jul-2026

---

## 1. Overview

Adds an **ISO ClaimSearch** signal row under the Q-AI Insights → Signals
section of the Claim Details screen. It surfaces mock ISO fraud-pattern
matches for the claim currently open — cross-referencing prior claims,
shared legal representation, employer clustering, jurisdiction, and treating
provider patterns — via a hover flyout panel triggered from an eye icon.

This is demo/mock data (no real ISO ClaimSearch integration exists), but the
data returned is built to be internally consistent with the rest of the
claim record and with the other Q-AI Insights sections shown for the same
claim.

## 2. Signals Row

- Badge reads **"ISO Flags"** (warning color) when one or more matches were
  found, or **"ISO Clear"** (success color) when none were found. The badge
  itself is not interactive.
- The row text reads `"{N} matching claims — {FLAG HEADINGS}"` when matches
  exist (all matched flag headings joined with `" + "`, e.g. `"EMPLOYER CLAIM
  CLUSTERING + CLAIM FREQUENCY"`), or `"No ISO ClaimSearch matches found"`
  otherwise.
- An eye icon at the end of the row is the **only** trigger for the flyout —
  hovering it opens the panel; the panel stays open while the pointer is
  over the icon or the panel itself (150ms grace period on leave), and
  closes otherwise.

## 3. Flyout Panel

- Opens to the left of the eye icon by default, flipping right/up as needed
  to stay fully on-screen regardless of scroll position; the panel's actual
  rendered size is measured before it is positioned, so it never renders
  clipped or off-screen.
- Shows the claimant's name and masked ISO subject ID, followed by one or
  more **flag cards** (most significant first when a claim has more than
  one flag type):
  - A card lists its **match(es)** — grouped in neutral gray tables, each
    with the matched claim's own identifying fields (Date of Loss, Claim
    Number, Employer, Insuring Company, Policy Number/Type, Policy Period,
    Coverage/Loss Type, **Alleged Injury**, Part of Body, Claim Status,
    Adjuster, plus fields specific to that flag type).
  - Below the match table(s), a red-left-border indicator box states the
    flag type (bold, red, warning icon), the general explanation for that
    flag type (same wording across every claim that gets it), then — below
    a divider — this specific claim's own facts.
  - A match whose Date of Loss equals the current claim's own loss date
    shows a **"SAME DAY"** badge — the most visually prominent element on
    the card.
  - Language is neutral and factual throughout — flag/indicator text states
    the pattern and what it indicates, with no reassuring or editorializing
    asides (e.g. no "not necessarily fraud" framing).
- Panel body scrolls internally when a claim's stacked flags/matches exceed
  the available viewport height; the panel frame itself never overflows the
  viewport.
- When there is no match, the panel shows a single neutral "no matches
  found" message instead of any flag cards.

## 4. Data Consistency Rules

Every fact shown for the *current* claim inside the panel — claimant name,
claim number, policy number, claim status, jurisdiction, and **alleged
injury / part of body** — is always the claim's own real data, never
independently generated filler. In particular:

- **Alleged Injury / Part of Body always matches the Claims Summary
  section** shown elsewhere under Q-AI Insights for the same claim, with no
  exceptions. Both sections resolve the injury the same way: the claim
  record's own `injuryType`/`bodyParts` when present, otherwise the same
  deterministic mock pick keyed off the claim number — so the two sections
  can never disagree, regardless of whether the underlying claim record
  happens to carry real injury data or not. (See `IsoClaimSearch-techspec.md`
  §2 for the shared resolution function.)

## 5. Match Assignment (demo data)

- The 4 seeded demo claims are guaranteed a realistic spread: exactly one
  with no match, one with two stacked flags, and two with a single flag —
  so the feature is always visibly exercised in a demo without every claim
  looking the same.
- Any other claim number gets a random (but per-claim-number-stable) result,
  including the possibility of no match.
- Results are randomized once per browser session/device (persisted so they
  don't reshuffle on every page refresh) but always fully deterministic for
  a given claim number within that session — the same claim always shows
  the same panel content until the session reshuffles.
