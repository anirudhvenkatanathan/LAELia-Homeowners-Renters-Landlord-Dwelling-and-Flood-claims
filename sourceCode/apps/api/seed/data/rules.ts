// The 31 service-request rules for the five property lines.
//   reused  – kept from the original library, definition unchanged, LOB retagged
//   adapted – kept, with property-irrelevant conditions removed or added
//   new     – added for property / flood
// Thresholds marked "demo" are illustrative until confirmed with the client.
import type { LineOfBusiness } from '../../utils/lineOfBusiness';

export type Join = 'AND' | 'OR';
/** [fieldName, operator, value, join to previous condition] — the first join is ignored. */
export type Cond = [field: string, op: string, value: string, join?: Join];

export interface RuleDef {
  name: string;
  description: string;
  origin: 'reused' | 'adapted' | 'new';
  lobs: LineOfBusiness[];
  conds: Cond[];
}

const HO: LineOfBusiness = 'Homeowners';
const RN: LineOfBusiness = 'Renters';
const LL: LineOfBusiness = 'Landlord';
const DW: LineOfBusiness = 'Dwelling';
const FL: LineOfBusiness = 'Flood';
const ALL: LineOfBusiness[] = [HO, RN, LL, DW, FL];
const NOT_FLOOD: LineOfBusiness[] = [HO, RN, LL, DW];

/** A list of "field is present" conditions joined with OR. */
const anyFlag = (...fields: string[]): Cond[] => fields.map((f, i): Cond => [f, '!=', '', i === 0 ? 'AND' : 'OR']);

export const RULES: RuleDef[] = [
  // ─── Reused (8) ─────────────────────────────────────────────────────────────
  { name: '24/7 Loss Mitigation Contractors', origin: 'reused', lobs: [HO, LL, DW, FL],
    description: 'Emergency mitigation (drying, debris removal, odor and mold remediation, roof protection) dispatched within hours of the loss.',
    conds: anyFlag('roof_damage_flag', 'debris_removal_required_flag', 'hvac_odor_remediation_required_flag', 'mold_remediation_required_flag', 'structural_drying_required_flag') },
  { name: 'Cause & Origin Specialists', origin: 'reused', lobs: NOT_FLOOD,
    description: 'Determine how and where a loss started on high-value, catastrophic, suspicious or contractor-related fire and explosion losses.',
    conds: [['high_value_claim_flag', '!=', ''], ['catastrophic_claim_flag', '!=', '', 'OR'], ['fraud_score', '>', '70', 'OR'], ['contractor_negligence_flag', '!=', '', 'OR'], ['product_involvement_flag', '!=', '', 'OR']] },
  { name: 'Appraisers/Independent Adjusters', origin: 'reused', lobs: NOT_FLOOD,
    description: 'Field appraisal and independent adjusting for losses with construction-trade involvement or special-handling property.',
    conds: anyFlag('construction_trade_involvement_flag', 'special_handling_property_flag') },
  { name: 'Forensic Engineers', origin: 'reused', lobs: [HO, LL, DW, FL],
    description: 'Structural and causation analysis for high-value, catastrophic or disputed-cause losses.',
    conds: anyFlag('high_value_claim_flag', 'catastrophic_claim_flag', 'disputed_cause_origin_flag', 'multiple_entities_jobsite_flag', 'liability_contribution_determination_flag', 'contractor_negligence_flag') },
  { name: 'Forensic Accountant', origin: 'reused', lobs: [HO, LL, DW],
    description: 'Loss-of-rents, additional-expense and inventory valuation review on complex or inflated claims.',
    conds: [['business_interruption_flag', '!=', ''], ['large_additional_expense_flag', '!=', '', 'OR'], ['inflated_value_claim_flag', '!=', '', 'OR'], ['complex_inventory_loss_flag', '!=', '', 'OR'], ['Litigated claim', '!=', '', 'OR'], ['potential_recovery_amount', '>', '35000', 'OR']] },
  { name: 'Legal', origin: 'reused', lobs: ALL,
    description: 'Coverage and litigation counsel for contested, litigated, fraud-flagged or high-value claims.',
    conds: [['first_notice_petition_flag', '!=', ''], ['high_value_claim_flag', '!=', '', 'OR'], ['catastrophic_claim_flag', '!=', '', 'OR'], ['Contested claim', '!=', '', 'OR'], ['Litigated claim', '!=', '', 'OR'], ['Fraud flag', '!=', '', 'OR'], ['significant_preexisting_condition_flag', '!=', '', 'OR'], ['Diagnosis in dispute', '!=', '', 'OR'], ['large_lump_sum_resolution_flag', '!=', '', 'OR'], ['medical_set_aside_agreement_flag', '!=', '', 'OR']] },
  { name: 'Independent Adjusters', origin: 'reused', lobs: NOT_FLOOD,
    description: 'Independent adjusting where the loss version is inconsistent, liability is contested or damages look overstated.',
    conds: anyFlag('inconsistent_loss_version_flag', 'liability_negligence_contested_flag', 'damages_overstated_flag', 'prior_claim_history_flag', 'party_non_cooperation_flag') },
  { name: 'Decision letters', origin: 'reused', lobs: ALL,
    description: 'Coverage decision and status letters on the 30-day status cycle.',
    conds: [['status_interval_days', '=', '30']] },

  // ─── Adapted (5) ────────────────────────────────────────────────────────────
  { name: 'Subrogation', origin: 'adapted', lobs: ALL,
    description: 'Recovery from responsible third parties: product failures, contractor negligence, multiple liable entities or ISO hits.',
    conds: [['liability_evidence_flag', '!=', ''], ['potential_recovery_amount', '>', '35000', 'AND'], ['jurisdiction', 'IN', 'FL,TX,LA,AL,GA,SC,NC', 'AND'], ['product_involvement_flag', '!=', '', 'OR'], ['multiple_entities_jobsite_flag', '!=', '', 'OR'], ['contractor_negligence_flag', '!=', '', 'OR'], ['multiple_insurer_iso_hit_flag', '!=', '', 'OR']] },
  { name: 'Desk investigations', origin: 'adapted', lobs: ALL,
    description: 'Desk-based verification for fraud indicators, prior-claim history, ISO hits, inconsistent accounts or early attorney involvement.',
    conds: [['fraud_score', '>', '70'], ['prior_claim_history_flag', '!=', '', 'OR'], ['multiple_insurer_iso_hit_flag', '!=', '', 'OR'], ['inconsistent_loss_version_flag', '!=', '', 'OR'], ['attorney_initial_notice_flag', '!=', '', 'OR'], ['unwitnessed_credibility_concern_flag', '!=', '', 'OR'], ['immediate_counsel_representation_flag', '!=', '', 'OR']] },
  { name: 'CAT Response', origin: 'adapted', lobs: ALL,
    description: 'Catastrophe surge handling for catastrophic-severity claims, large reserves or claims tied to a declared catastrophe event.',
    conds: [['severity_category', '=', 'catastrophic'], ['total_reserve_amount', '>', '500000', 'OR'], ['cat_event_flag', '!=', '', 'OR']] },
  { name: 'Repair Network Referral', origin: 'adapted', lobs: [HO, LL, DW],
    description: 'Refer repairs to the carrier’s contractor network, including specialty trades.',
    conds: anyFlag('contractor_referral_required_flag', 'specialty_trade_required_flag') },
  { name: 'Scene Investigation & Official Reports', origin: 'adapted', lobs: NOT_FLOOD,
    description: 'On-site scene investigation and fire, police or other official report retrieval.',
    conds: anyFlag('scene_investigation_required_flag', 'police_report_required_flag') },

  // ─── New: Flood (6) ─────────────────────────────────────────────────────────
  { name: 'NFIP Authorized Adjuster', origin: 'new', lobs: [FL],
    description: 'Assign an NFIP-authorized flood adjuster to every claim under a National Flood Insurance Program policy.',
    conds: [['nfip_policy_flag', '!=', '']] },
  { name: 'Proof of Loss Follow-up', origin: 'new', lobs: [FL],
    description: 'Chase the sworn proof of loss before the 60-day SFIP deadline (follow-up starts at day 45).',
    conds: [['days_since_loss', '>=', '45'], ['proof_of_loss_received_flag', '=', '', 'AND']] },
  { name: 'Waiting Period Review', origin: 'new', lobs: [FL],
    description: 'Review losses that occur inside the standard 30-day flood waiting period unless an exception applies.',
    conds: [['policy_days_before_loss', '<', '30'], ['waiting_period_exception_flag', '=', '', 'AND']] },
  { name: 'Substantial Damage Determination', origin: 'new', lobs: [FL],
    description: 'Determine substantial damage (repair cost of 50% or more of structure value) for structures in a special flood hazard area.',
    conds: [['repair_cost_pct_of_value', '>=', '50'], ['sfha_flag', '!=', '', 'AND']] },
  { name: 'ICC Claim Handling', origin: 'new', lobs: [FL],
    description: 'Handle Increased Cost of Compliance claims (up to $30,000) once substantial damage is determined.',
    conds: [['substantial_damage_flag', '!=', '']] },
  { name: 'NFIP Limit Exposure', origin: 'new', lobs: [FL],
    description: 'Monitor losses approaching the NFIP residential limits of $250,000 building and $100,000 contents.',
    conds: [['building_loss_amount', '>', '250000'], ['contents_loss_amount', '>', '100000', 'OR']] },

  // ─── New: Property (12) ─────────────────────────────────────────────────────
  { name: 'Estimate & Invoice Review', origin: 'new', lobs: [HO, LL, DW],
    description: 'Review contractor estimates and invoices that are large (demo threshold $5,000) or disputed.',
    conds: [['contractor_estimate_amount', '>', '5000'], ['estimate_dispute_flag', '!=', '', 'OR']] },
  { name: 'Coverage Verification & ROR', origin: 'new', lobs: ALL,
    description: 'Verify coverage and issue a reservation of rights where coverage is questioned, the policy lapsed, a peril is excluded or notice was late.',
    conds: anyFlag('coverage_question_flag', 'policy_lapse_flag', 'excluded_peril_flag', 'late_notice_flag') },
  { name: 'Public Adjuster / Appraisal', origin: 'new', lobs: ALL,
    description: 'Manage claims where a public adjuster represents the insured or an appraisal has been demanded.',
    conds: anyFlag('public_adjuster_flag', 'appraisal_demand_flag') },
  { name: 'Roof Surface Review', origin: 'new', lobs: [HO, LL, DW],
    description: 'Inspect older roofs on wind or hail losses (over 20 years, demo) and apply roof payment-schedule endorsements.',
    conds: [['wind_hail_flag', '!=', ''], ['roof_age_years', '>', '20', 'AND'], ['roof_payment_schedule_flag', '!=', '', 'OR']] },
  { name: 'Insurance-to-Value Review', origin: 'new', lobs: [HO, LL, DW],
    description: 'Review underinsured properties where insurance-to-value is below 80% (demo).',
    conds: [['insurance_to_value_pct', '<', '80']] },
  { name: 'Contents Inventory & Valuation', origin: 'new', lobs: [HO, RN, FL],
    description: 'Build and value the contents inventory, and resolve valuation disputes (ACV versus replacement cost).',
    conds: [['contents_loss_amount', '>', '0'], ['contents_valuation_dispute_flag', '!=', '', 'OR']] },
  { name: 'Pack-out & Contents Cleaning', origin: 'new', lobs: [HO, RN],
    description: 'Pack-out, cleaning and storage of contents after smoke, water or odor losses.',
    conds: anyFlag('contents_cleaning_required_flag', 'smoke_odor_flag') },
  { name: 'Temporary Housing / ALE', origin: 'new', lobs: [HO, RN],
    description: 'Arrange temporary housing and additional living expense when the insured is displaced or the home is uninhabitable.',
    conds: anyFlag('displaced_flag', 'uninhabitable_flag') },
  { name: 'Vacancy Review', origin: 'new', lobs: [LL, DW],
    description: 'Review dwelling-fire and landlord losses at properties vacant more than 60 days or flagged unoccupied.',
    conds: [['vacancy_days', '>', '60'], ['unoccupied_flag', '!=', '', 'OR']] },
  { name: 'Tenant-Caused Loss Recovery', origin: 'new', lobs: [LL],
    description: 'Pursue recovery from tenants where the tenant caused the loss and there is recoverable value.',
    conds: [['tenant_caused_flag', '!=', ''], ['potential_recovery_amount', '>', '0', 'AND']] },
  { name: 'Statutory Deadline Watch', origin: 'new', lobs: NOT_FLOOD,
    description: 'Florida 627.70131 clocks (Florida claims only): acknowledge within 7 days of notice, begin investigation within 7 days and inspect within 30 days of proof of loss (alert at day 23), pay or deny within 60 days of notice. Other states\' clocks are not configured yet.',
    conds: [['days_since_notice', '>', '7'], ['acknowledged_flag', '=', '', 'AND'], ['jurisdiction', '=', 'FL', 'AND'],
            ['days_since_proof_of_loss', '>=', '23', 'OR'], ['inspection_completed_flag', '=', '', 'AND'], ['jurisdiction', '=', 'FL', 'AND'],
            ['days_since_notice', '>=', '50', 'OR'], ['payment_decision_issued_flag', '=', '', 'AND'], ['jurisdiction', '=', 'FL', 'AND']] },
  { name: 'Deductible Waiver Review', origin: 'new', lobs: NOT_FLOOD,
    description: 'Review suspected improper deductible waivers or rebates by contractors.',
    conds: [['deductible_waiver_suspected_flag', '!=', '']] },
];
