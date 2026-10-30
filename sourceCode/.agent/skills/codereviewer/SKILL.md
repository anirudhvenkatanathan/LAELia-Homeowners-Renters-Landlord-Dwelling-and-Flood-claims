# CODEREVIEWER.md (Token-Optimized)

## Purpose

Defines the Code Reviewer agent for SHARP Triage. Reviews developer output
for quality, standards compliance, and blocking issues. Does NOT fix code.

Do NOT: - Start without developer COMPLETED in RUN_CONTEXT - Fix code - Approve with blocking issues

---

## Trigger Condition

- DEVELOPER status = COMPLETED in RUN_CONTEXT
- Commit hash present
- Build = PASS

---

## Review Checklist

### Structure
- [ ] Folder structure matches AGENTS.md exactly
- [ ] No logic inside screen folders
- [ ] No hardcoded nav items or routes
- [ ] skin/ files untouched
- [ ] api/graphQL/ entity helpers exist

### Frontend (React + Triage skin)
- [ ] ONLY Triage skin CSS classes used — no Tailwind, no inline styles
- [ ] AG Grid for tabular data — wrapped in `ag-theme-alpine ag-grid-in-card`
- [ ] NIVO Charts for visualisation
- [ ] Global Error Boundary applied
- [ ] logError() in all API, async, event handlers
- [ ] Two-card layout: header card uses `.page-header-card`, content card uses `.content-topbar`
- [ ] Status badges: `● ACTIVE` / `○ INACTIVE` text with `.badge--success` / `.badge--inactive`
- [ ] Code/rank values use `.badge.badge--outline`
- [ ] No inline styles in cell renderers or form components

### Backend (Node.js + GraphQL + MongoDB)
- [ ] No `$skip` in any MongoDB/<entity>.ts — use cursor or in-memory pagination
- [ ] MongoDB SDK used
- [ ] Controllers → request/response only
- [ ] Services → business logic
- [ ] MongoDB/<entity>.ts → all CRUD
- [ ] .env vars used — no hardcoded credentials
- [ ] Errors stored in Triage_errorlog MongoDB entity

### Tests
- [ ] Unit tests for every PLAN task
- [ ] E2E spec file exists
- [ ] FRD edge cases covered

### Stack Compliance
- [ ] No unapproved libraries
- [ ] No Tailwind, no Bootstrap, no inline styles
- [ ] No hardcoded values

---

## Finding Classification

BLOCKING:
  - Header card body not using `.page-header-card` flex layout
  - Content card missing `.content-topbar` top bar
  - AG Grid not wrapped in `ag-theme-alpine ag-grid-in-card` inside card
  - Inline `style={{...}}` used in any cell renderer or DrawerForm — must use CSS classes
  - `$skip` used in any MongoDB/<entity>.ts file
  - Sidebar renders flat menu array without building parent-child tree first
  - `sidebar-nav__link` class used on child items (must use `sidebar-nav__child`)
  - DefaultIcon (circle SVG) used as fallback — unknown icons must resolve to null
  - Sidebar brand area uses invented class (e.g. `sidebar__brand`) instead of `sidebar-logo`
  - Any CSS class used in AppShell.tsx / Sidebar.tsx / Topbar.tsx that is NOT listed in the CSS Classes for Layout reference table in DEVELOPER SKILL.md
  - No unit tests
  - Hardcoded nav / routes
  - skin/ modified
  - Error logging missing
  
NON-BLOCKING:
  - Naming conventions
  - Minor style issues
  - Optimisation suggestions

---

## Review Output Format

```
REVIEW v1.0 — Attempt X
Feature  : <name>
Screen   : <screenName>
Commit   : <hash>

FINDINGS
  BLOCKING    : <issue> — File: <path>, Line: <N> | none
  NON-BLOCKING: <issue> — File: <path> | none

DECISION        : APPROVED | REJECTED
BLOCKING COUNT  : X
```

Review file: runs/RUN-<ID>/REVIEW_attemptX.md

---

## Skill Gate

codereviewer
  Input  : Developer COMPLETED + commit + build PASS
  Output : REVIEW file + APPROVED + 0 blocking issues
  On reject: Return to developer
  Max    : 2 attempts — 2nd reject → HALT
