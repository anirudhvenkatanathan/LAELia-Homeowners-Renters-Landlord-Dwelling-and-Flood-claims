// Onboarding checklist content. L1 items are specific to each rule (service
// category); L2–L4 are universal. [name, mandatory]
export type Item = [name: string, mandatory: boolean];

export const L2_UNIVERSAL: Item[] = [
  ['Professional / E&O liability insurance ≥ $1M', true],
  ['General liability insurance ≥ $1M', true],
  ["Workers' compensation insurance (statutory)", true],
  ['Business license & legal entity / tax ID', true],
  ['Florida licence per covered service (adjuster, contractor or engineer)', true],
  ['Background checks on field personnel', true],
  ['Cyber liability insurance ≥ $1M', false],
  ['SOC 2 Type II certification', false],
  ['Conflict of interest disclosure', false],
];

export const L3_TECHNOLOGY: Item[] = [
  ['REST API with documented endpoints', false],
  ['ClaimSystem integration (native or middleware)', false],
  ['Two-way status updates (webhook or daily batch)', false],
  ['Xactimate-compatible estimate and photo exchange', false],
  ['Machine-readable reports with audit trail', false],
  ['Business continuity plan with tested RTO/RPO', false],
];

export const L4_TRACK_RECORD: Item[] = [
  ['3+ years in each applied service category', true],
  ['Carrier reference of comparable scale', true],
  ['Capacity attestation — max claim volume per month/quarter + certification to meet demand', true],
  ['CAT surge attestation — capacity to scale during a declared catastrophe', true],
  ['Performance monitoring plan (SLA, cycle time, re-inspection rate)', true],
  ['Prior pilot disclosure (including failures)', true],
  ['Third-party analyst rating (if category has one)', true],
  ['Willingness to accept performance-based fees', true],
];

const SLA: Item = ['Turnaround Time SLA Attestation', true];

/** L1 (service-category specific) items by exact rule name. */
export const L1_BY_RULE: Record<string, Item[]> = {
  '24/7 Loss Mitigation Contractors': [['IICRC certification (WRT / ASD) for technicians', true], ['24/7 emergency response SOP with 2-hour arrival target', true], ['Sample moisture map and drying log', true], ['Equipment inventory and capacity attestation', true]],
  'Cause & Origin Specialists': [['Certified Fire Investigator credentials', true], ['Sample cause-and-origin report', true], ['Evidence preservation and chain-of-custody SOP', true], ['Florida licence documentation', true]],
  'Appraisers/Independent Adjusters': [['Florida all-lines adjuster licence', true], ['Xactimate proficiency evidence', true], ['Sample estimate and photo report', true], SLA],
  'Forensic Engineers': [['Florida Professional Engineer licence', true], ['Sample forensic engineering report', true], ['Expert witness history', true], ['Roof and structural testing methodology', true]],
  'Forensic Accountant': [['CPA / CFE credentials', true], ['Sample loss-of-rents analysis', true], ['Valuation methodology documentation', true], ['Conflict of interest screening SOP', true]],
  'Legal': [['Florida Bar membership and property-coverage experience', true], ['Reservation of rights letter templates', true], ['Litigation fee schedule', true], ['Conflict of interest screening SOP', true]],
  'Independent Adjusters': [['Florida all-lines adjuster licence', true], ['Sample field adjuster report', true], ['Caseload capacity attestation', true], SLA],
  'Decision letters': [['Florida statute-compliant letter templates (s. 627.70131)', true], ['Attorney review and compliance approval process', true], ['State filing and delivery compliance SOP', true], SLA],
  'Subrogation': [['Subrogation counsel network documentation', true], ['Evidence preservation (spoliation) SOP', true], ['Statute of limitations compliance documentation', true], ['Recovery rate history report', true]],
  'Desk investigations': [['Florida investigator licence documentation', true], ['Database access documentation', true], ['Fraud indicator scoring methodology', true], ['Sample desk investigation report', true]],
  'CAT Response': [['CAT surge capacity attestation', true], ['Deployment readiness plan', true], ['Emergency adjuster certification', true], ['Sample CAT field report', true]],
  'Repair Network Referral': [['Florida contractor licence (CGC / CRC)', true], ['Workmanship warranty terms (10-year roof)', true], ['Pricing alignment with Xactimate price lists', true], ['Customer satisfaction and re-inspection report', true]],
  'Scene Investigation & Official Reports': [['Fire and police report retrieval SOP', true], ['Sample scene investigation report', true], ['Photo and evidence standards', true], ['Investigator credentials', true]],
  'NFIP Authorized Adjuster': [['NFIP flood adjuster certification', true], ['Elevation certificate review capability', true], ['Sample SFIP adjuster report', true], ['Proof-of-loss processing SOP', true]],
  'Proof of Loss Follow-up': [['Insured outreach protocol', true], ['Proof-of-loss form templates', true], ['Deadline tracking SOP', true], SLA],
  'Waiting Period Review': [['Policy effective-date verification SOP', true], ['Waiting-period exception guide', true], ['Sample waiting-period review', true]],
  'Substantial Damage Determination': [['Floodplain administrator coordination documentation', true], ['Structure valuation methodology', true], ['Sample substantial damage determination', true], ['50% rule training evidence', true]],
  'ICC Claim Handling': [['ICC claim processing SOP', true], ['Local code-enforcement coordination protocol', true], ['Sample ICC claim package', true]],
  'NFIP Limit Exposure': [['Limits monitoring methodology', true], ['Sample limit exposure report', true], ['Reporting cadence SLA', true]],
  'Estimate & Invoice Review': [['Xactimate-certified reviewer evidence', true], ['Price-list methodology', true], ['Sample estimate review', true], SLA],
  'Coverage Verification & ROR': [['Coverage opinion template', true], ['Reservation of rights letter library', true], ['Florida licensed counsel evidence', true]],
  'Public Adjuster / Appraisal': [['Appraiser and umpire credentials', true], ['Appraisal protocol', true], ['Sample appraisal award', true], ['Conflict of interest disclosure', true]],
  'Roof Surface Review': [['Roof inspector credentials', true], ['Sample roof inspection report with age and condition grading', true], ['Drone inspection capability (FAA Part 107)', true], ['Roof payment-schedule training', true]],
  'Insurance-to-Value Review': [['Replacement cost estimator methodology', true], ['Sample insurance-to-value report', true], ['Data source documentation', true]],
  'Contents Inventory & Valuation': [['Inventory software evidence', true], ['Sample contents inventory report', true], ['Valuation methodology (ACV / RCV)', true], ['Salvage handling SOP', true]],
  'Pack-out & Contents Cleaning': [['Textile and contents restoration certification', true], ['Storage facility documentation', true], ['Chain-of-custody SOP', true], ['Sample pack-out inventory', true]],
  'Temporary Housing / ALE': [['Housing inventory coverage documentation', true], ['Vetted lodging contracts', true], ['Rapid placement SLA', true], ['Pet and accessibility policy', true]],
  'Vacancy Review': [['Occupancy verification methodology', true], ['Sample vacancy inspection report', true], ['Photo and utility-record standards', true]],
  'Tenant-Caused Loss Recovery': [['Tenant recovery process SOP', true], ['Florida consumer collection agency licence', true], ['Sample recovery file', true]],
  'Statutory Deadline Watch': [['Florida statutory deadline calendar methodology', true], ['Alerting and escalation SOP', true], ['Sample compliance report', true]],
  'Deductible Waiver Review': [['Contractor rebate and waiver investigation method', true], ['Contractor audit SOP', true], ['Sample audit report', true]],
};
