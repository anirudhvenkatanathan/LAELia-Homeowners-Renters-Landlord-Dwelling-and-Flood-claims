# TechSpec — Property Lines Conversion

Stack per AGENTS.md: React + Vite (skin CSS, AG Grid, Nivo), Node.js + Express + Apollo GraphQL, MongoDB (Mongoose), JWT login. Hosting: Netlify (static + one function).

## Components
- `api/utils/lineOfBusiness.ts` — LOB constants and `mapClaimTypeToLOB` (mirrored in `frontEnd/src/utils/lineOfBusiness.ts`; options in `models/ServiceRequestRole/serviceRequestRoleModel.ts`).
- `api/graphQL/serviceRequestRoleEntity.ts` — LOB enum, at-least-one validation.
- `api/graphQL/claimIntakeEntity.ts` — null-LOB handling in role matching and validation; claimType validation; property field extraction.
- `frontEnd/src/utils/kpiScoring.ts` — seven weighting profiles mapped to 31 rule names.
- `frontEnd/src/models/dashboard/*`, `pages/Dashboard/*` — property-line dashboard content.
- `api/controllers/aiSummaryController.ts` — property prompt, optional key.
- `api/seed/` — generator and `seed` script (MongoDB); `api/app.ts` (app factory) and `netlify/functions/api.ts` (serverless-http wrapper); `netlify.toml`.

## Data and DB vs code
- Code: LOB list, mapping, validation, KPI profiles, dashboard, prompts, claim-detail fields, templates.
- DB (seeded): rules and conditions (conditionExpression evaluated against claim fields), field mappings, providers, onboarding items, vendor selection rules, claims, users/roles/menus.

## Async flows
- Seed runs once from a developer machine (`MONGODB_URI`, `MONGODB_DB`); runtime never seeds. Function reuses a cached Mongo connection between invocations.

## Error logging
- Frontend `logError()` and Error Boundary unchanged; backend shared error log service writes to the `triage_errorlogs` collection (collection created empty, not copied).

## Terminology note
The skill files are templated from another project and mention Dataverse/Sharp*/Triage_errorlog. They are read as MongoDB / this project's equivalents, as AGENTS.md specifies MongoDB.

## Plan-document rule definitions
Authoritative expressions for the 31 rules and 40 fields: the approved plan document (Claude Doc "LAELia property lines plan").
