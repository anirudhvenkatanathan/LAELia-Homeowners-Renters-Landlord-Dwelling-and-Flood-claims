# PLANNER.md (Token-Optimized)

## Purpose

Defines the Planner agent for Claim Triage. Reads FRD and TechSpec
and produces a structured, sequential task plan before any skill execution.

Do NOT: - Skip planner output - Let developer start without approved plan - Modify skin/ or .agent/skills/ files

---

## Trigger Condition

Planner runs BEFORE developer, ONCE per feature/screen cycle.
Full order: planner → developer → codereviewer → testing

---

## Planner Inputs

- docs/<feature>/<screenName>-frd.md          — Functional requirements
- docs/<feature>/<screenName>-techspec.md     — Technical architecture
- sourceCode/skin/index.html                  — UI skin reference
- sourceCode/skin/css/main.css                — CSS classes reference
- AGENTS.md                                   — Stack, structure, governance

---

## Planner Responsibilities

1. Parse FRD → extract features, business rules, acceptance criteria
2. Parse TechSpec → extract components, Dataverse entities, async flows
3. Map FRD requirements to implementation tasks
4. Break work into ordered developer tasks with clear scope
5. Identify which skin CSS classes apply per screen (from AGENTS.md Triage components list)
6. Flag ambiguities — HALT before developer starts

---

## Planner Output Format

```
PLAN v1.0
Feature  : <feature name>
Screen   : <screenName>
FRD      : docs/<feature>/<screenName>-frd.md
TechSpec : docs/<feature>/<screenName>-techspec.md

TASK-01
  Title       : <short title>
  Scope       : frontend | backend | dataverse | async | test
  FR Ref      : FR-001, FR-002 ...
  Description : <what to build>
  Input       : <what is needed>
  Output      : <files — exact paths per AGENTS.md structure>
  Depends On  : none | TASK-XX
  Stack       : <specific approved tech>
  Skin Ref    : <Triage CSS classes to use e.g. .card, .btn--primary, .badge--success>

TASK-02
  ...

AMBIGUITIES (if any):
  - <unclear requirement — FRD section reference>

READY FOR DEVELOPER: YES | NO
```

---

## Triage Task Order Rule

```
TASK-01 : GraphQL entity helper (api/graphQL/<entity>.ts)
TASK-02 : Backend service (api/services/<screen>Service.ts)
TASK-03 : Backend controller + routes
TASK-04 : Frontend model + types
TASK-05 : Frontend service (API calls)
TASK-06 : Frontend validation schema
TASK-07 : Frontend hooks
TASK-08 : Frontend screen (index.tsx) — use Triage skin classes
TASK-09 : Unit tests
TASK-10 : E2E spec
```

---

## Triage-Specific Planning Rules

- No Tailwind, no Bootstrap — use Claim Triage skin classes only
- Menu items must be database-driven — no hardcoded nav items
- database entity task must come before service and controller tasks
- Unit test and E2E spec tasks are mandatory per screen
- Error logging (logError + Triage_errorlog entity) in every feature plan

---

## Replan Trigger

- FRD changes mid-cycle
- Codereviewer rejects due to spec mismatch
- TechSpec conflict found

On replan: produce PLAN v2.0, archive previous.

---

## Skill Gate

planner
  Input  : FRD + TechSpec + AGENTS.md
  Output : Approved PLAN — READY FOR DEVELOPER = YES
  On fail: HALT — list missing or conflicting spec details

---

## Governance

- AGENTS.md = single source of truth
- Planner output saved to runs/RUN-<ID>/PLAN_vX.X.md
- Developer must not start without approved plan
- Planner does NOT write code or modify specs
