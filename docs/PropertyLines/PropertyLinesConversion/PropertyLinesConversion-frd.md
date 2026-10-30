# FRD — Property Lines Conversion (Homeowners, Renters, Landlord, Dwelling, Flood)

Feature: PropertyLines · Screen/Module: PropertyLinesConversion
Source of truth for scope: the approved LAELia plan document (31 rules, 40 new fields, ~75 Florida claims). Client context: Florida carrier writing HO3/HO5/HO6, HO4, DF1/DF3-DO, DF3-DL and flood (SFIP/NFIP).

## Functional requirements

- **FR-001 Lines of business.** The only LOBs are Homeowners, Renters, Landlord, Dwelling, Flood. Workers' Comp, Auto, General Liability and the generic "Property" LOB are removed from code, UI and data.
- **FR-002 Claim-type mapping.** A claim's `claimType` maps to exactly one LOB (LOB name, or form codes HO3/HO5/HO6→Homeowners, HO4→Renters, DF3-DL→Landlord, DF1/DF3-DO→Dwelling, SFIP/NFIP→Flood). An unrecognised or empty claimType maps to no LOB, never a default, and is rejected at intake.
- **FR-003 Rule gating.** Only rules tagged with the claim's LOB are matched and displayed. API and UI must agree.
- **FR-004 Rule library.** 31 rules: 8 reused unchanged (definitions kept, LOB retagged), 5 adapted, 18 new (6 flood + 12 property). Final names/expressions are in the plan document; the 15 WC/medical rules are removed.
- **FR-005 Rule fields.** 40 new claim fields are registered in field mapping so every rule condition resolves.
- **FR-006 Rule creation UI.** The create/edit rule screens offer only the five LOBs, require at least one, and have no "WCM" default.
- **FR-007 Rule recommendations.** The AI-recommendation cards on the rule master screen refer to existing property rules by exact name.
- **FR-008 Provider scoring.** Every one of the 31 rules has a dedicated KPI weighting profile (11 categories; weights of applicable categories sum to 100). KPI category labels are property-appropriate (Peril specialization, Dispute resolution, Policyholder experience).
- **FR-009 Dashboard.** Executive Overview labels, KPIs, vendors, alerts and SLA rows describe property claims (LAE, repair cost, contents & ALE, subrogation, CAT).
- **FR-010 Claim details.** Claim detail screens show property fields (loss date, cause of loss, peril, policy form, coverages A–D, deductible, flood zone, etc.) instead of WC clinical fields.
- **FR-011 AI summary.** The summary prompt describes property claims; a missing `ANTHROPIC_API_KEY` yields a clear "AI summaries unavailable" message, not a crash.
- **FR-012 Seed data.** A repeatable `npm run seed` loads: 31 rules + conditions, field mappings, provider network (~60 fictional providers), onboarding items, KPIs, vendor selection rules, ~75 Florida claims across all workflow statuses (including Declined, Review Needed/awaiting adjuster or supervisor, Approved/Finalized), change-log history, and the original app's users, roles and menus.
- **FR-013 Isolation.** New repo and new MongoDB database; no reference to the original site, DB or secrets.
- **FR-014 Hosting.** Static frontend plus one serverless function for the API on Netlify; no server that must stay running; database connection cached across invocations.

## Edge cases
- Claim with no recognisable claimType is rejected with a clear message.
- A role saved with no LOB is rejected by validation (API default of all five applies only to programmatic creation without the field).
- Dormant legacy documents with an LOB outside the five are never returned.

## Acceptance criteria
- API and frontend type-checks and unit tests pass; each of the 31 rules fires on at least 2 seeded claims; the five LOBs each have ~15 claims; every workflow status has seeded claims; login works with the original usernames; the deployed function answers `/api/health`.
