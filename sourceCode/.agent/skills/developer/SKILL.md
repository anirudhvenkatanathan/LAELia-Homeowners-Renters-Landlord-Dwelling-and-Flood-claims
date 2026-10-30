# DEVELOPER.md (Token-Optimized)

## Purpose

Defines the Developer agent for Claim Triage. Builds frontend screens,
GraphQL API services with MongoDB, and unit tests based on the approved PLAN.

Do NOT: - Start without approved PLAN - Skip unit tests - Modify skin/ files - Deviate from folder structure

---

## Trigger Condition

Developer starts ONLY when:
- PLANNER status = COMPLETED in RUN_CONTEXT
- PLAN file exists at runs/RUN-<ID>/PLAN_vX.X.md
- READY FOR DEVELOPER = YES

---

## Developer Inputs

- runs/RUN-<ID>/PLAN_vX.X.md              — Task list
- docs/<feature>/<screenName>-frd.md      — Requirements
- docs/<feature>/<screenName>-techspec.md — Architecture
- sourceCode/skin/                        — UI reference (read-only)
- AGENTS.md                               — Stack and rules

---

## UI Rules (Mandatory)

- Do NOT add breadcrumbs to any screen — breadcrumb navigation is not used in Claim Triage
- Use ONLY CSS classes from sourceCode/skin/css/main.css and  sourceCode/skin/css/custom.css.
- No Tailwind, no Bootstrap, no inline styles, no page-specific CSS
- AG Grid for all tabular data
- NIVO Charts for all data visualisation
- Dynamic menu from MongoDB — no hardcoded nav items
- Add sourceCode/skin to vite.config.ts → fs.allow
- Add an import of the skin CSS in main.tsx
- Add a <script src="..."> for skin/js/main.js in index.html

---


## Folder Output Rules (Non-Negotiable)

Frontend:
  sourceCode/apps/frontEnd/pages/<feature>/<screenName>/index.tsx
  sourceCode/apps/frontEnd/pages/<feature>/<screenName>/styles.ts
  sourceCode/apps/frontEnd/pages/<feature>/<screenName>/types.ts
  sourceCode/apps/frontEnd/pages/<feature>/<screenName>/unitTest/<screenName>.test.tsx
  sourceCode/apps/frontEnd/pages/<feature>/<screenName>/e2e/<screenName>.spec.ts

Shared (never inside screen folder):
  sourceCode/apps/frontEnd/hooks/<screenName>/use<Something>.ts
  sourceCode/apps/frontEnd/components/<screenName>/<Component>.tsx
  sourceCode/apps/frontEnd/services/<screenName>/<service>.ts
  sourceCode/apps/frontEnd/validations/<screenName>/<schema>.ts
  sourceCode/apps/frontEnd/models/<screenName>/<model>.ts

Backend:
  sourceCode/apps/api/controllers/<screenName>Controller.ts
  sourceCode/apps/api/routes/<screenName>Routes.ts
  sourceCode/apps/api/services/<screenName>Service.ts
  sourceCode/apps/api/dataverse/<screenName>Entity.ts

---

## .env Variables Required

---

## Error Logging (Mandatory)

Frontend : logError() in all API, async, event handlers + React Error Boundary
Backend  : Shared error service → Triage_errorlog Dataverse entity

---

## Output Format (for RUN_CONTEXT update)

```
DEVELOPER
  STATUS        : COMPLETED | IN PROGRESS | FAILED
  ATTEMPT       : X of 3
  TASKS_DONE    : X of X
  COMMIT        : <hash>
  BRANCH        : feature/<slug>
  BUILD         : PASS | FAIL
  NOTES         : -
```

---

## Skill Gate

developer
  Input  : Approved PLAN + FRD + TechSpec
  Output : All tasks built + unit tests passing + commit ready
  On fail: Stop, update RUN_CONTEXT
  Max    : 3 attempts — 3rd fail → HALT

---

## App Shell & Navbar (Mandatory)

Every screen MUST be wrapped inside the full app shell from skin/index.html.
Never build a screen without the sidebar and topbar — they are part of every page.

### React Implementation Rules:

- Create a shared `AppShell.tsx` component under `sourceCode/apps/frontEnd/components/layout/AppShell.tsx`
- Create a shared `Sidebar.tsx` under `sourceCode/apps/frontEnd/components/layout/Sidebar.tsx`
- Create a shared `Topbar.tsx` under `sourceCode/apps/frontEnd/components/layout/Topbar.tsx`
- Every page screen wraps its content inside `<AppShell>`
- Sidebar nav items are fetched from Dataverse dynamically
- Active nav item is highlighted using `sidebar-nav__link active` class
- Mobile sidebar toggle uses `sidebar-toggle` button and `sidebar-overlay`

### CRITICAL — Never Invent CSS Class Names:

- **NEVER** create class names that are not in the CSS Classes for Layout table below or in skin/css/main.css / skin/css/custom.css
- The div beside the sidebar **MUST** use `main-content` — NOT `app-shell__main`, `app-shell__body`, or anything else
- The scrollable content area **MUST** use `page` — NOT `app-shell__content`, `main-page`, or anything else
- The topbar hamburger button **MUST** use `btn btn--ghost btn--sm` — NOT `topbar__toggle` or any invented class
- The sidebar brand area **MUST** use `sidebar-logo` — NOT `sidebar__brand` or any invented class
- If a layout class you want to use is not in the reference table below, it does not exist in the skin — do not use it

### Sidebar Menu Rules:

- `useMenu` returns a **flat array** — Sidebar must call `buildTree(flat)` to nest children before rendering. Match child `parentId` against parent `id` (GUID).
- Parent items (has children): use class `sidebar-nav__link sidebar-nav__link--parent` + chevron SVG. Toggle open/close on click. Auto-open if a child path is active.
- Child items: use class `sidebar-nav__child` (NOT `sidebar-nav__link`). Active child gets `.active` which applies bullet via `::before` + bold primary color. No background fill.
- `resolveIcon()` must return `null` for unknown icon strings — never use a circle SVG as a fallback (renders as a visible ○ in the nav).
- `Triage_parentid` in Dataverse stores the parent item's **GUID** (not the label string). Seed scripts must patch child records with the actual GUID after creating the parent.
