# AGENTS.md (Token-Optimized)

## Purpose

Master governance file for the Claim Triage Platform.
Defines agent roles, approved tech stack, mandatory execution order, and project structure rules.

Do NOT: - Modify this file - Modify files inside .agent/skills/ - Change execution order - Introduce unapproved tech

---

## Application Summary

Claim Triage Platform:
- An automated middleware engine that instantly analyzes incoming claim data and dispatches work orders to the best-suited vendor.
- Modules: Dashboard, Claims Orchestrator, Field Mapping, Service Role Engine,Vendor Onboarding,  Vendor & service Role Selection
- Frontend + Node.js Server + GraphQL API + MongoDB 
- Documentation-driven, agent-enforced workflow
- UI skin: Claim Triage custom light theme — sourceCode/skin/ is the single UI reference

---

## Approved Tech Stack

Frontend:
  - React
  - Vite
  - Claim Triage CSS (sourceCode/skin/css/main.css) — no Tailwind
  - AG Grid         — tabular data
  - NIVO Charts     — data visualization

Backend:
  - Node.js
  - GraphQL

Database:
  - MongoDB

Authentication:
  - Login with DB creditional from database

---

## Mandatory Project Structure

```
ClaimTracker/
├── sourceCode/
│   ├── AGENTS.md
│   ├── skin/                          ← UI reference — do not modify
│   │   ├── css/main.css
│   │   ├── js/main.js
│   │   └── index.html
│   ├── .agent/
│   │   └── skills/
│   │       ├── planner/SKILL.md
│   │       ├── developer/SKILL.md
│   │       ├── codereviewer/SKILL.md
│   │       └── testing/SKILL.md
│   ├── e2eResults/                    ← Test result spreadsheets
│   └── apps/
│       ├── frontEnd/
│       │   ├── pages/<feature>/<screenName>/
│       │   │   ├── index.tsx
│       │   │   ├── styles.ts
│       │   │   ├── types.ts
│       │   │   ├── e2e/<screenName>.spec.ts
│       │   │   └── unitTest/<screenName>.test.tsx
│       │   ├── hooks/<screenName>/
│       │   ├── components/<screenName>/
│       │   ├── validations/<screenName>/
│       │   ├── services/<screenName>/
│       │   ├── models/<screenName>/
│       │   └── config/
│       │       ├── package.json
│       │       ├── vite.config.ts
│       │       └── tailwind.config.ts
│       └── api/
│           ├── controllers/
│           ├── routes/
│           ├── services/
├── docs/
│   └── <feature>/<screenName>/
│       ├── <screenName>-frd.md
│       └── <screenName>-techspec.md
└── runs/
    └── RUN-<ID>/
        ├── RUN_CONTEXT.md
        ├── PLAN_vX.X.md
        ├── REVIEW_attemptX.md
        └── TEST_REPORT_attemptX.md
```

Structure is non-negotiable.

---

## Skill File Locations

PLANNER      : .agent/skills/planner/SKILL.md
DEVELOPER    : .agent/skills/developer/SKILL.md
CODEREVIEWER : .agent/skills/codereviewer/SKILL.md
TESTING      : .agent/skills/testing/SKILL.md

Each skill must read its own SKILL.md file before executing.
Deploy is a MANUAL process — not handled by agent.

---

## Agent Roles

1. planner
2. developer
3. codereviewer
4. testing

---

## Mandatory Execution Order

planner → developer → codereviewer → testing

Rules:
- No parallel execution
- No skipping
- No reordering
- No partial auto-advance

---

## Skill Gates

planner
  Input  : docs/<feature>/<screen>-frd.md + -techspec.md + AGENTS.md
  Output : Approved PLAN with READY FOR DEVELOPER = YES
  On fail: HALT — resolve ambiguities first

developer
  Input  : Approved PLAN + FRD + TechSpec
  Output : Code + unit tests + passing build
  On fail: Stop — update RUN_CONTEXT
  Max    : 3 attempts — 3rd fail → HALT, human review

codereviewer
  Input  : Developer COMPLETED + commit + build PASS
  Output : APPROVED — 0 blocking issues
  On reject: Return to developer with REVIEW file
  Max    : 2 attempts — 2nd reject → HALT, human review

testing
  Input  : Codereviewer APPROVED
  Output : All tests pass + TEST_REPORT + e2eResults xlsx
  On fail: Return to developer with TEST_REPORT
  Max    : 3 attempts — 3rd fail → HALT, human review

---

## UI Rules (Mandatory)

- All screens MUST use CSS classes and layout patterns from sourceCode/skin/css/main.css
- Claim Triage custom light theme — no Tailwind, no Bootstrap, no inline styles
- AG Grid for all tabular data
- NIVO Charts for all data visualisation
- Dynamic menu — database-driven via MongoDB, no hardcoded nav items
- Shared logic in hooks/, components/, services/ — never inside a screen folder

---

## Error Logging (Mandatory)

Frontend:
  - Global React Error Boundary
  - Shared logError() helper — all API, async, and event errors

Backend:
  - Shared error logging service in all controllers
  - All errors stored in MongoDB Triage_errorlog entity

---

## Completion Definition

DONE only if:
  planner ✔  developer ✔  codereviewer ✔  testing ✔

Deploy : manual process — handled outside agent pipeline

---

## Governance

- AGENTS.md = single source of truth
- Any deviation = non-compliant
- Restart from last failed skill if violation occurs
- All runs tracked in runs/RUN-<ID>/RUN_CONTEXT.md
