# TESTING.md (Token-Optimized)

## Purpose

Defines the Testing agent for Claims Triage.
Runs Playwright E2E tests in two modes.

Do NOT: - Modify AGENTS.md or skill files

---

## Pipeline Position

planner → developer → codereviewer → testing → DONE

---

## Trigger Mode — Read This First

### Mode 1: Full Pipeline (auto-triggered)

Conditions:
- CODEREVIEWER status = COMPLETED + APPROVED in RUN_CONTEXT

Inputs:
  FRD file  : docs/<feature>/<screenName>-frd.md
  PLAN file : runs/RUN-<ID>/PLAN_vX.X.md

Behaviour:
- Run ALL FRD-derived test cases
- Update RUN_CONTEXT after completion
- On fail → return to developer

### Mode 2: Standalone (manual prompt)

Trigger phrase: "Run testing skill standalone for <screen>"

Conditions: No RUN_CONTEXT check required

Behaviour:
- Run tests for specified screen/fix only
- Save results to e2eResults/
- Report PASS/FAIL in chat
- Do NOT update RUN_CONTEXT pipeline state

---

## Test Scope for Triage

IN SCOPE:
  - All FRD acceptance criteria per screen
  - Status badge rendering (Approved/Processing/Draft/Rejected)
  - AG Grid table render, sort, filter, pagination
  - Modal open/close (Create Order modal)
  - Form validation (SharpValidate)
  - Toast notifications (SharpToast)
  - Confirm dialogs (SharpConfirm)
  - Dynamic menu loading from database
  - Role-based views (Customer View)
  - Error handling — inline validation messages

OUT OF SCOPE:
  - Unit tests (developer handles)
  - Code quality (codereviewer handles)
  - Direct database queries
  - Load / performance testing

---

## E2E Test File Location

  sourceCode/apps/frontEnd/pages/<feature>/<screenName>/e2e/<screenName>.spec.ts

---

## Test Output Format

```
TEST-01
  FR Ref      : FR-001
  Scenario    : <description>
  Status      : PASS | FAIL
  Screenshot  : e2eResults/<screenName>/TEST-01.png (if FAIL)
  Notes       : <error>

SUMMARY
  Total / Passed / Failed / Critical Failures

OVERALL : PASS | FAIL
```

Results: sourceCode/e2eResults/<screenName>-results.xlsx
Report : runs/RUN-<ID>/TEST_REPORT_attemptX.md (Mode 1)
         runs/RUN-<ID>/TEST_REPORT_standalone_<timestamp>.md (Mode 2)

---

## Failure Handling

Mode 1: Critical fail → RETURNED_TO_DEV = YES → developer fixes → rerun
Mode 2: Any fail → report in chat, no pipeline impact

---

## Skill Gate

Mode 1: Input = Codereviewer APPROVED | Max 3 attempts → HALT
Mode 2: Input = human prompt | No pipeline impact
