PLAN v1.0
Feature  : PropertyLines
Screen   : PropertyLinesConversion
FRD      : docs/PropertyLines/PropertyLinesConversion/PropertyLinesConversion-frd.md
TechSpec : docs/PropertyLines/PropertyLinesConversion/PropertyLinesConversion-techspec.md

TASK-01
  Title       : LOB constants and claim-type mapping (API)
  Scope       : backend
  FR Ref      : FR-001, FR-002, FR-003
  Output      : sourceCode/apps/api/utils/lineOfBusiness.ts, api/graphQL/serviceRequestRoleEntity.ts
  Depends On  : none
  Stack       : Node.js, Mongoose

TASK-02
  Title       : Intake validation and null-LOB handling
  Scope       : backend
  FR Ref      : FR-002, FR-003
  Output      : sourceCode/apps/api/graphQL/claimIntakeEntity.ts, api/server.ts
  Depends On  : TASK-01

TASK-03
  Title       : Frontend LOB model, mapping and fallbacks
  Scope       : frontend
  FR Ref      : FR-001, FR-002, FR-006
  Output      : frontEnd/src/models/ServiceRequestRole/serviceRequestRoleModel.ts, utils/lineOfBusiness.ts, hooks/ServiceRequestRole/useServiceRequestRoleCreate.ts, pages/ClaimIntake/claimIntakeDetails/index.tsx
  Depends On  : TASK-01
  Skin Ref    : existing screens unchanged

TASK-04
  Title       : Rule recommendation cards, KPI scoring profiles, dashboard content
  Scope       : frontend
  FR Ref      : FR-007, FR-008, FR-009
  Output      : pages/ServiceRequestRole/ServiceRequestRoleMaster/index.tsx, utils/kpiScoring.ts, models/dashboard/executiveOverviewModel.ts, pages/Dashboard/DashboardMaster/index.tsx
  Depends On  : TASK-03

TASK-05
  Title       : Property claim detail fields (API extractor, GraphQL type, frontend model and display)
  Scope       : backend + frontend
  FR Ref      : FR-010
  Output      : api/graphQL/claimIntakeEntity.ts, frontEnd/src/models/claimIntakeMaster/claimIntakeModel.ts, claim details display, utils/claimSummaryMockData.ts, utils/isoClaimSearchMockData.ts
  Depends On  : TASK-02

TASK-06
  Title       : AI summary prompt and optional API key
  Scope       : backend
  FR Ref      : FR-011
  Output      : api/controllers/aiSummaryController.ts (+ vendor intelligence prompt)
  Depends On  : none

TASK-07
  Title       : Seed generator and `npm run seed`
  Scope       : backend (database)
  FR Ref      : FR-004, FR-005, FR-012, FR-013
  Output      : api/seed/*.ts, api/package.json script; users/roles/menus copied from original export
  Depends On  : TASK-01, TASK-05

TASK-08
  Title       : Netlify adaptation
  Scope       : backend + config
  FR Ref      : FR-014
  Output      : api/app.ts, netlify/functions/api.ts, netlify.toml, redirects, remove startup seeding
  Depends On  : TASK-07

TASK-09
  Title       : Unit tests for each task
  Scope       : test
  Output      : api/utils/__tests__/*.test.ts, frontEnd/src/**/__tests__ updates, seed consistency test
  Depends On  : TASK-01..TASK-08

TASK-10
  Title       : E2E spec
  Scope       : test
  Output      : frontEnd/src/pages/PropertyLines/PropertyLinesConversion/e2e/PropertyLinesConversion.spec.ts
  Depends On  : TASK-07, TASK-08

AMBIGUITIES (non-blocking, resolved):
  - Skill files reference Dataverse/Sharp*/Triage_errorlog; AGENTS.md says MongoDB; read as MongoDB equivalents.
  - Whether Flood is NFIP-written or private flood is unconfirmed with the client; rules written for NFIP/SFIP and marked demo.
  - Planner and developer stages were started before AGENTS.md was adopted; TASK-01..TASK-04 were built first and are recorded as such in RUN_CONTEXT and will go through full review.

READY FOR DEVELOPER: YES
