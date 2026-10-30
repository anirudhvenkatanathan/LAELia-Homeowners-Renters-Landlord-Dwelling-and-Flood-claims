# RUN-001 — Property Lines Conversion
Branch: feature/property-lines

PLANNER
  STATUS : COMPLETED
  PLAN   : runs/RUN-001/PLAN_v1.0.md  (READY FOR DEVELOPER = YES)

DEVELOPER
  STATUS     : IN PROGRESS
  ATTEMPT    : 1 of 3
  TASKS_DONE : TASK-01..04 (built before the pipeline was applied at the user's request; will be reviewed in full), TASK-06 partly pending
  COMMIT     : f0424db (checkpoint)
  BRANCH     : feature/property-lines
  BUILD      : PASS (frontend tsc, vitest; API jest)
  NOTES      : AGENTS.md followed from this point on, on the user's instruction. Nothing is merged or deployed until the user says "host it".

CODEREVIEWER
  STATUS : NOT STARTED

TESTING
  STATUS : NOT STARTED

## Developer stage update (2026-10-30)
- TASK-07 done: seed definitions (rules 31, providers 70, claims 75, onboarding), generator, check, loader (`npm run seed`). Auth collections committed at the user's explicit instruction (repo public).
- TASK-08 done: `api/app.ts` (createApp), `api/netlify/functions/api.ts` (serverless-http, cached Mongo), `netlify.toml`, startup seeding removed, vendor documents stored in Mongo, template folder resolves on Netlify. Function bundles with esbuild (9.8 MB).
- Verified: API jest 63/63, frontend vitest 495/495, tsc clean, vite build OK.
- NOT verified: live Mongo/Netlify run (sandbox cannot reach Atlas or download mongod). Needs a real deploy preview.
- Remaining: codereviewer, testing stages, e2e spec, WC leftovers in docs/mocks, PR.
