// 75 demo claims (15 per line) for a Florida carrier. All people, addresses and
// amounts are invented. Reference "today" for ages and clocks: 2026-10-30.
import type { LineOfBusiness } from '../../utils/lineOfBusiness';

export type Stage =
  | 'PS'   // Pending Selection — adjuster has not chosen providers yet
  | 'PR'   // Pending Review    — adjuster submitted, supervisor must review
  | 'FS'   // Finalized Selection — supervisor reviewed / approved
  | 'CP'   // Completed
  | 'DN';  // Denied (coverage declined) — decision letter issued

export interface ClaimSpec {
  lob: LineOfBusiness;
  n: number;
  insured: string;
  city: string;
  county: string;
  form: string;
  cause: string;
  areas: string[];
  lossAgo: number;          // days before 2026-10-30
  reportedAgo: number;      // days since first notice
  amount: number;
  stage: Stage;
  flags?: string[];         // fields set to "present"
  ov?: Record<string, string | number>;   // overrides ('' removes a default)
  sev?: 'low' | 'moderate' | 'high' | 'catastrophic';
  st: string;               // state code, default FL
}

type Tuple = [string, string, string, string, string, string[], number, number, number, Stage, string[]?, Record<string, string | number>?, ClaimSpec['sev']?];

const mk = (lob: LineOfBusiness, n: number, t: Tuple): ClaimSpec => ({
  lob, n, insured: t[0], city: t[1], county: t[2], form: t[3], cause: t[4], areas: t[5],
  lossAgo: t[6], reportedAgo: t[7], amount: t[8], stage: t[9], flags: t[10], ov: t[11], sev: t[12], st: 'FL',
});

const HOMEOWNERS: Tuple[] = [
  ['Maria Santos', 'Cape Coral', 'Lee', 'HO3', 'Hurricane wind and rain damage', ['Roof', 'Windows', 'Interior'], 33, 31, 86000, 'PR',
    ['cat_event_flag', 'wind_hail_flag', 'roof_damage_flag', 'displaced_flag', 'contractor_referral_required_flag'], { roof_age_years: 24, contractor_estimate_amount: 64000 }, 'high'],
  ['David Kowalczyk', 'Orlando', 'Orange', 'HO3', 'Burst supply line', ['Kitchen', 'Dining room'], 12, 11, 14200, 'PS',
    ['structural_drying_required_flag', 'contractor_referral_required_flag'], { contractor_estimate_amount: 11800 }],
  ['Priya Raman', 'Tampa', 'Hillsborough', 'HO5', 'Kitchen fire', ['Kitchen', 'Living areas'], 21, 20, 58000, 'PR',
    ['smoke_odor_flag', 'contents_cleaning_required_flag', 'scene_investigation_required_flag', 'high_value_claim_flag', 'displaced_flag'], { contents_loss_amount: 31000, contractor_estimate_amount: 41000 }, 'high'],
  ['Robert Chen', 'Jacksonville', 'Duval', 'HO3', 'Theft of personal property', ['Bedroom', 'Living room'], 9, 8, 7600, 'PS',
    ['police_report_required_flag', 'contents_valuation_dispute_flag'], { contents_loss_amount: 7600 }],
  ['Angela Brooks', 'Miami', 'Miami-Dade', 'HO6', 'Water intrusion from unit above', ['Bathroom', 'Hallway'], 18, 17, 9800, 'PS',
    ['structural_drying_required_flag', 'liability_evidence_flag', 'disputed_cause_origin_flag', 'multiple_entities_jobsite_flag'], { potential_recovery_amount: 9800, contractor_estimate_amount: 3200 }],
  ['Thomas Whitaker', 'Sarasota', 'Sarasota', 'HO3', 'Mold growth after slow leak', ['Bathroom wall'], 40, 22, 12400, 'PR',
    ['mold_remediation_required_flag', 'coverage_question_flag', 'excluded_peril_flag', 'late_notice_flag']],
  ['Linda Okafor', 'Orlando', 'Orange', 'HO3', 'Roof hail damage', ['Roof', 'Gutters'], 27, 26, 21800, 'FS',
    ['wind_hail_flag', 'roof_damage_flag', 'roof_payment_schedule_flag', 'public_adjuster_flag'], { roof_age_years: 17, contractor_estimate_amount: 21800 }],
  ['Carlos Mendez', 'Miami', 'Miami-Dade', 'HO3', 'Fire damage with suspected arson', ['Garage', 'Attic'], 55, 54, 94000, 'FS',
    ['prior_claim_history_flag', 'multiple_insurer_iso_hit_flag', 'inconsistent_loss_version_flag', 'unwitnessed_credibility_concern_flag', 'attorney_initial_notice_flag', 'high_value_claim_flag'], { fraud_score: 82 }, 'high'],
  ['Susan Delgado', 'Palm Beach Gardens', 'Palm Beach', 'HO5', 'Dishwasher failure water damage', ['Kitchen'], 15, 14, 9300, 'PS',
    ['structural_drying_required_flag', 'product_involvement_flag', 'liability_evidence_flag'], { potential_recovery_amount: 9300 }],
  ['James Whitfield', 'Naples', 'Collier', 'HO3', 'Tree fall through roof', ['Roof', 'Bedroom'], 24, 23, 33000, 'PR',
    ['roof_damage_flag', 'displaced_flag', 'uninhabitable_flag', 'construction_trade_involvement_flag', 'specialty_trade_required_flag'], { contractor_estimate_amount: 28000 }],
  ['Karen Liu', 'Hollywood', 'Broward', 'HO3', 'Pipe burst with insurance-to-value shortfall', ['Kitchen', 'Laundry'], 11, 10, 26500, 'PS',
    ['structural_drying_required_flag'], { insurance_to_value_pct: 68, contractor_estimate_amount: 17500 }],
  ['Michael Torres', 'Fort Lauderdale', 'Broward', 'HO3', 'Hurricane water damage reported late', ['Roof', 'Ceiling'], 70, 62, 41000, 'DN',
    ['late_notice_flag', 'coverage_question_flag', 'excluded_peril_flag'], { status_interval_days: 30 }],
  ['Emily Foster', 'Tallahassee', 'Leon', 'HO6', 'Lightning surge damage', ['Electrical', 'Appliances'], 6, 5, 4200, 'PS',
    ['deductible_waiver_suspected_flag'], { contents_loss_amount: 2100 }],
  ['Anthony Russo', 'Daytona Beach', 'Volusia', 'HO3', 'Bathroom water damage, acknowledgement overdue', ['Bathroom'], 14, 13, 6100, 'PS',
    ['structural_drying_required_flag'], { acknowledged_flag: '', contractor_estimate_amount: 6100 }],
  ['Patricia Gomez', 'Miami Gardens', 'Miami-Dade', 'HO5', 'Smoke damage, policy lapsed', ['Living areas'], 80, 79, 18000, 'DN',
    ['coverage_question_flag', 'policy_lapse_flag', 'smoke_odor_flag', 'contents_cleaning_required_flag'], { status_interval_days: 30 }],
];

const RENTERS: Tuple[] = [
  ['Jasmine Carter', 'Orlando', 'Orange', 'HO4', 'Water leak from unit above', ['Bedroom', 'Living room'], 8, 7, 6200, 'PS',
    ['displaced_flag'], { contents_loss_amount: 6200 }],
  ['Brian Nguyen', 'Tampa', 'Hillsborough', 'HO4', 'Kitchen fire', ['Kitchen'], 19, 18, 15400, 'PR',
    ['smoke_odor_flag', 'contents_cleaning_required_flag', 'scene_investigation_required_flag', 'uninhabitable_flag'], { contents_loss_amount: 15400 }],
  ['Olivia Bennett', 'Jacksonville', 'Duval', 'HO4', 'Burglary', ['Living room', 'Bedroom'], 5, 4, 8900, 'PS',
    ['police_report_required_flag', 'contents_valuation_dispute_flag'], { contents_loss_amount: 8900 }],
  ['Marcus Reed', 'Miami', 'Miami-Dade', 'HO4', 'Hurricane wind-driven rain', ['Living room'], 31, 30, 12800, 'FS',
    ['cat_event_flag', 'displaced_flag'], { contents_loss_amount: 12800 }],
  ['Sofia Ramirez', 'Orlando', 'Orange', 'HO4', 'Theft with questionable inventory', ['Entire unit'], 45, 44, 38000, 'PR',
    ['prior_claim_history_flag', 'inconsistent_loss_version_flag', 'immediate_counsel_representation_flag', 'contents_valuation_dispute_flag', 'Fraud flag'], { fraud_score: 78, contents_loss_amount: 38000 }, 'high'],
  ['Kevin Park', 'Gainesville', 'Alachua', 'HO4', 'Washing machine hose burst', ['Kitchen', 'Laundry'], 13, 12, 7400, 'PS',
    ['liability_evidence_flag', 'product_involvement_flag'], { potential_recovery_amount: 7400, contents_loss_amount: 7400 }],
  ['Aaliyah Jenkins', 'Fort Lauderdale', 'Broward', 'HO4', 'Smoke from neighbour fire', ['Bedroom'], 22, 21, 5100, 'CP',
    ['smoke_odor_flag', 'contents_cleaning_required_flag'], { contents_loss_amount: 5100 }],
  ['Daniel Ortiz', 'Miami', 'Miami-Dade', 'HO4', 'Water damage with public adjuster', ['Living room'], 35, 33, 14300, 'PR',
    ['public_adjuster_flag', 'appraisal_demand_flag', 'contents_valuation_dispute_flag'], { contents_loss_amount: 14300 }],
  ['Hannah Lee', 'Tampa', 'Hillsborough', 'HO4', 'Lightning damage to electronics', ['Electronics'], 10, 9, 3300, 'PS',
    ['deductible_waiver_suspected_flag'], { contents_loss_amount: 3300 }],
  ['Isaiah Thompson', 'St. Petersburg', 'Pinellas', 'HO4', 'Fire loss, policy lapsed', ['Entire unit'], 60, 58, 22000, 'DN',
    ['policy_lapse_flag', 'coverage_question_flag', 'late_notice_flag'], { status_interval_days: 30, contents_loss_amount: 22000 }],
  ['Grace Mitchell', 'Orlando', 'Orange', 'HO4', 'Bathroom leak, acknowledgement overdue', ['Bathroom'], 20, 19, 4600, 'PS',
    [], { acknowledged_flag: '', contents_loss_amount: 4600 }],
  ['Victor Alvarez', 'Hialeah', 'Miami-Dade', 'HO4', 'Burglary', ['Bedroom'], 28, 27, 7100, 'FS',
    ['police_report_required_flag', 'attorney_initial_notice_flag'], { contents_loss_amount: 7100 }],
  ['Natalie Cruz', 'Sarasota', 'Sarasota', 'HO4', 'Hurricane, tenant displaced', ['Entire unit'], 36, 34, 17500, 'CP',
    ['cat_event_flag', 'displaced_flag', 'uninhabitable_flag'], { contents_loss_amount: 17500 }],
  ['Peter Wang', 'Lakeland', 'Polk', 'HO4', 'Kitchen water damage, late reporting', ['Kitchen'], 90, 52, 5400, 'PR',
    ['late_notice_flag', 'coverage_question_flag'], { payment_decision_issued_flag: '', contents_loss_amount: 5400 }],
  ['Rachel Adams', 'Melbourne', 'Brevard', 'HO4', 'Theft from apartment', ['Living room'], 30, 29, 6800, 'PS',
    ['police_report_required_flag'], { status_interval_days: 30, contents_loss_amount: 6800 }],
];

const LANDLORD: Tuple[] = [
  ['Harold Pierce', 'Orlando', 'Orange', 'DF3-DL', 'Tenant-caused water leak', ['Unit 2B', 'Unit 1B'], 25, 24, 38000, 'PR',
    ['tenant_caused_flag', 'liability_evidence_flag', 'structural_drying_required_flag', 'business_interruption_flag'], { potential_recovery_amount: 12000, contractor_estimate_amount: 38000 }],
  ['Gloria Hensley', 'Tampa', 'Hillsborough', 'DF3-DL', 'Hurricane roof damage to rental duplex', ['Roof'], 32, 30, 72000, 'PS',
    ['cat_event_flag', 'wind_hail_flag', 'roof_damage_flag', 'specialty_trade_required_flag'], { roof_age_years: 26, contractor_estimate_amount: 72000 }, 'high'],
  ['Samuel Baptiste', 'Miami', 'Miami-Dade', 'DF3-DL', 'Water loss in vacant rental', ['Entire unit'], 47, 46, 29000, 'PR',
    ['unoccupied_flag', 'structural_drying_required_flag', 'mold_remediation_required_flag', 'coverage_question_flag'], { vacancy_days: 75, contractor_estimate_amount: 29000 }],
  ['Wendy Clarke', 'Jacksonville', 'Duval', 'DF3-DL', 'Tenant-caused fire', ['Unit 3'], 18, 17, 88000, 'FS',
    ['high_value_claim_flag', 'scene_investigation_required_flag', 'tenant_caused_flag', 'liability_evidence_flag', 'business_interruption_flag'], { potential_recovery_amount: 52000 }, 'high'],
  ['Elias Haddad', 'Hollywood', 'Broward', 'DF3-DL', 'Short-term rental guest damage', ['Living room', 'Kitchen'], 14, 13, 11200, 'PS',
    ['short_term_rental_flag', 'tenant_caused_flag', 'coverage_question_flag'], { potential_recovery_amount: 4000, contractor_estimate_amount: 11200 }],
  ['Beatrice Okoye', 'Orlando', 'Orange', 'DF3-DL', 'Storm damage, appraisal demanded', ['Roof', 'Soffit'], 38, 36, 46000, 'PR',
    ['public_adjuster_flag', 'appraisal_demand_flag', 'estimate_dispute_flag', 'wind_hail_flag'], { roof_age_years: 15, contractor_estimate_amount: 46000 }],
  ['Terrance Wallace', 'Gainesville', 'Alachua', 'DF3-DL', 'Pipe burst in vacant unit, vacancy exclusion', ['Unit'], 66, 60, 22000, 'DN',
    ['unoccupied_flag', 'excluded_peril_flag', 'coverage_question_flag'], { vacancy_days: 90, status_interval_days: 30, contractor_estimate_amount: 22000 }],
  ['Janice Morrow', 'Fort Myers', 'Lee', 'DF3-DL', 'Hurricane damage to multi-unit property', ['Roofs', 'Units'], 29, 28, 310000, 'PR',
    ['cat_event_flag', 'catastrophic_claim_flag', 'high_value_claim_flag', 'specialty_trade_required_flag', 'roof_damage_flag'], { total_reserve_amount: 540000, contractor_estimate_amount: 280000 }, 'catastrophic'],
  ['Andre Fischer', 'Pensacola', 'Escambia', 'DF3-DL', 'Contractor negligence water damage', ['Bathroom'], 20, 19, 18000, 'PS',
    ['contractor_negligence_flag', 'liability_evidence_flag', 'multiple_entities_jobsite_flag'], { potential_recovery_amount: 18000, contractor_estimate_amount: 18000 }],
  ['Mei Zhang', 'Orlando', 'Orange', 'DF3-DL', 'Tenant fire with loss of rents', ['Unit'], 52, 50, 64000, 'FS',
    ['business_interruption_flag', 'large_additional_expense_flag', 'tenant_caused_flag'], { potential_recovery_amount: 20000 }],
  ['Calvin Brooks', 'Tampa', 'Hillsborough', 'DF3-DL', 'Roof damage, deductible waiver suspected', ['Roof'], 23, 22, 15500, 'PS',
    ['deductible_waiver_suspected_flag', 'roof_damage_flag', 'wind_hail_flag', 'roof_payment_schedule_flag'], { roof_age_years: 21, contractor_estimate_amount: 15500 }],
  ['Naomi Shapiro', 'Boca Raton', 'Palm Beach', 'DF3-DL', 'Water damage, underinsured', ['Kitchen'], 9, 8, 12300, 'PS',
    ['structural_drying_required_flag'], { insurance_to_value_pct: 62, contractor_estimate_amount: 12300 }],
  ['Reggie Coleman', 'Ocala', 'Marion', 'DF3-DL', 'Fire, acknowledgement overdue', ['Unit'], 16, 15, 27000, 'PS',
    ['scene_investigation_required_flag', 'attorney_initial_notice_flag', 'immediate_counsel_representation_flag'], { acknowledged_flag: '', contractor_estimate_amount: 27000 }],
  ['Tara Nguyen', 'Orlando', 'Orange', 'DF3-DL', 'Storm damage to fence and roof', ['Fence', 'Roof'], 100, 98, 9400, 'CP',
    ['wind_hail_flag'], { roof_age_years: 12, status_interval_days: 30, contractor_estimate_amount: 9400 }],
  ['Gordon Hale', 'Miami', 'Miami-Dade', 'DF3-DL', 'Burst pipe, policy lapsed', ['Unit'], 75, 74, 31000, 'DN',
    ['policy_lapse_flag', 'coverage_question_flag'], { status_interval_days: 30, contractor_estimate_amount: 31000 }],
];

const DWELLING: Tuple[] = [
  ['Walter Jennings', 'Lakeland', 'Polk', 'DF3-DO', 'Fire in owner-occupied dwelling', ['Kitchen', 'Attic'], 17, 16, 52000, 'PR',
    ['high_value_claim_flag', 'scene_investigation_required_flag'], { contractor_estimate_amount: 52000 }, 'high'],
  ['Rosa Villanueva', 'Hialeah', 'Miami-Dade', 'DF1', 'Water loss in vacant dwelling', ['Entire dwelling'], 58, 57, 24000, 'PS',
    ['unoccupied_flag', 'mold_remediation_required_flag', 'coverage_question_flag'], { vacancy_days: 85, contractor_estimate_amount: 24000 }],
  ['Franklin Odom', 'Pensacola', 'Escambia', 'DF3-DO', 'Wind damage to older roof', ['Roof'], 26, 25, 19800, 'PS',
    ['wind_hail_flag', 'roof_damage_flag'], { roof_age_years: 28, contractor_estimate_amount: 19800 }],
  ['Lucille Baptiste', 'Fort Pierce', 'St. Lucie', 'DF3-DO', 'Hurricane total loss', ['Entire dwelling'], 34, 33, 245000, 'FS',
    ['cat_event_flag', 'catastrophic_claim_flag', 'high_value_claim_flag', 'public_adjuster_flag'], { total_reserve_amount: 560000 }, 'catastrophic'],
  ['Gerald Stein', 'Clearwater', 'Pinellas', 'DF3-DO', 'Structural settlement dispute', ['Foundation'], 44, 43, 78000, 'PR',
    ['disputed_cause_origin_flag', 'construction_trade_involvement_flag', 'special_handling_property_flag', 'coverage_question_flag'], { contractor_estimate_amount: 78000 }],
  ['Yolanda Price', 'Ocala', 'Marion', 'DF3-DO', 'Roof repair, contractor rebate suspected', ['Roof'], 21, 20, 13700, 'PS',
    ['deductible_waiver_suspected_flag', 'contractor_referral_required_flag'], { contractor_estimate_amount: 13700 }],
  ['Harold Quinn', 'Port St. Lucie', 'St. Lucie', 'DF3-DO', 'Appliance fire, product defect', ['Laundry room'], 15, 14, 17500, 'PS',
    ['product_involvement_flag', 'liability_evidence_flag', 'scene_investigation_required_flag'], { potential_recovery_amount: 17500 }],
  ['Mabel Hodges', 'Kissimmee', 'Osceola', 'DF1', 'Vandalism to tenant-occupied dwelling', ['Interior'], 12, 11, 8800, 'PS',
    ['police_report_required_flag'], { contractor_estimate_amount: 8800 }],
  ['Dominic Fabre', 'Miami', 'Miami-Dade', 'DF3-DO', 'Water damage reported late', ['Bathroom'], 85, 50, 11000, 'PR',
    ['late_notice_flag', 'coverage_question_flag'], { payment_decision_issued_flag: '', contractor_estimate_amount: 11000 }],
  ['Priscilla Dunn', 'Tampa', 'Hillsborough', 'DF3-DO', 'Hail damage, appraisal demanded', ['Roof'], 40, 38, 29500, 'PR',
    ['appraisal_demand_flag', 'public_adjuster_flag', 'estimate_dispute_flag', 'wind_hail_flag'], { roof_age_years: 22, contractor_estimate_amount: 29500 }],
  ['Oscar Medina', 'Homestead', 'Miami-Dade', 'DF3-DO', 'Fire with suspected fraud', ['Entire dwelling'], 48, 47, 61000, 'FS',
    ['prior_claim_history_flag', 'multiple_insurer_iso_hit_flag', 'inconsistent_loss_version_flag', 'Fraud flag', 'Litigated claim', 'high_value_claim_flag', 'inflated_value_claim_flag'], { fraud_score: 85 }, 'high'],
  ['Evelyn Sharpe', 'Ocala', 'Marion', 'DF3-DO', 'Wind loss, underinsured dwelling', ['Roof', 'Siding'], 19, 18, 22600, 'PS',
    ['wind_hail_flag'], { insurance_to_value_pct: 71, roof_age_years: 14, contractor_estimate_amount: 22600 }],
  ['Raymond Cole', 'Gainesville', 'Alachua', 'DF1', 'Kitchen water damage', ['Kitchen'], 110, 108, 8200, 'CP',
    [], { status_interval_days: 30 }],
  ['Sylvia Grant', 'Sarasota', 'Sarasota', 'DF3-DO', 'Wear and tear, excluded peril', ['Roof'], 62, 60, 14000, 'DN',
    ['excluded_peril_flag', 'coverage_question_flag'], { status_interval_days: 30 }],
  ['Nathan Brooks', 'Panama City', 'Bay', 'DF3-DO', 'Hurricane damage to roof and windows', ['Roof', 'Windows'], 38, 37, 98000, 'PS',
    ['cat_event_flag', 'roof_damage_flag', 'wind_hail_flag', 'contractor_referral_required_flag', 'specialty_trade_required_flag'], { roof_age_years: 25, contractor_estimate_amount: 98000 }, 'high'],
];

const FLOOD: Tuple[] = [
  ['Ricardo Salazar', 'Naples', 'Collier', 'SFIP', 'Storm surge', ['Ground floor', 'Utilities'], 28, 27, 142000, 'PR',
    ['nfip_policy_flag', 'sfha_flag', 'structural_drying_required_flag', 'substantial_damage_flag'], { repair_cost_pct_of_value: 54, building_loss_amount: 142000, contents_loss_amount: 22000, policy_days_before_loss: 600 }, 'high'],
  ['Teresa Holloway', 'Fort Myers', 'Lee', 'SFIP', 'Hurricane flood, total loss', ['Entire building'], 33, 32, 310000, 'FS',
    ['nfip_policy_flag', 'sfha_flag', 'substantial_damage_flag', 'cat_event_flag'], { repair_cost_pct_of_value: 71, building_loss_amount: 262000, contents_loss_amount: 48000, policy_days_before_loss: 900 }, 'catastrophic'],
  ['Bruce Anderson', 'Tampa', 'Hillsborough', 'SFIP', 'Heavy rain flooding', ['First floor'], 52, 51, 38000, 'PR',
    ['nfip_policy_flag'], { proof_of_loss_received_flag: '', contents_loss_amount: 9000, building_loss_amount: 29000, policy_days_before_loss: 730 }],
  ['Cindy Matthews', 'Miami', 'Miami-Dade', 'SFIP', 'Flood inside waiting period', ['Ground floor'], 20, 19, 26000, 'PS',
    ['nfip_policy_flag'], { policy_days_before_loss: 18, waiting_period_exception_flag: '', contents_loss_amount: 4000, building_loss_amount: 22000 }],
  ['Julian Pratt', 'Jacksonville', 'Duval', 'SFIP', 'River flooding', ['Basement'], 48, 47, 54000, 'PR',
    ['nfip_policy_flag', 'sfha_flag'], { proof_of_loss_received_flag: '', repair_cost_pct_of_value: 38, contents_loss_amount: 11000, building_loss_amount: 43000, policy_days_before_loss: 500 }],
  ['Monica Estrada', 'Key West', 'Monroe', 'SFIP', 'Storm surge', ['Ground floor'], 15, 14, 83000, 'PS',
    ['nfip_policy_flag', 'sfha_flag', 'substantial_damage_flag', 'structural_drying_required_flag'], { repair_cost_pct_of_value: 52, building_loss_amount: 83000, policy_days_before_loss: 1200 }],
  ['Harvey Dillon', 'Sarasota', 'Sarasota', 'SFIP', 'Flooding, waiting-period exception applies', ['Ground floor'], 26, 25, 19000, 'FS',
    ['nfip_policy_flag', 'waiting_period_exception_flag'], { policy_days_before_loss: 12, status_interval_days: 30, building_loss_amount: 19000 }],
  ['Ana Beltran', 'Hialeah', 'Miami-Dade', 'SFIP', 'Flood inside waiting period, claim denied', ['Ground floor'], 40, 38, 31000, 'DN',
    ['nfip_policy_flag'], { policy_days_before_loss: 9, waiting_period_exception_flag: '', status_interval_days: 30, building_loss_amount: 31000 }],
  ['Phillip Grant', 'Cape Coral', 'Lee', 'SFIP', 'Canal overflow', ['Garage', 'Lower level'], 36, 35, 288000, 'PR',
    ['nfip_policy_flag', 'sfha_flag', 'substantial_damage_flag', 'Contested claim'], { repair_cost_pct_of_value: 61, building_loss_amount: 270000, contents_loss_amount: 18000, policy_days_before_loss: 800 }, 'high'],
  ['Lorraine Kim', 'Pensacola', 'Escambia', 'SFIP', 'Flash flood', ['First floor'], 58, 57, 24500, 'CP',
    ['nfip_policy_flag'], { contents_loss_amount: 6000, building_loss_amount: 18500, policy_days_before_loss: 640 }],
  ['Dennis Whitaker', 'Daytona Beach', 'Volusia', 'SFIP', 'Flood, contents only', ['Contents'], 22, 21, 15000, 'PS',
    ['nfip_policy_flag', 'contents_valuation_dispute_flag'], { contents_loss_amount: 15000, policy_days_before_loss: 410 }],
  ['Shawna Perry', 'Fort Lauderdale', 'Broward', 'SFIP', 'Flood under a private flood policy', ['Ground floor'], 31, 30, 47000, 'PS',
    ['structural_drying_required_flag', 'coverage_question_flag'], { contents_loss_amount: 8000, building_loss_amount: 39000, policy_days_before_loss: 300 }],
  ['Leonard Ruiz', 'Punta Gorda', 'Charlotte', 'SFIP', 'Hurricane storm surge', ['Entire building'], 41, 40, 357000, 'PS',
    ['nfip_policy_flag', 'sfha_flag', 'substantial_damage_flag', 'cat_event_flag'], { repair_cost_pct_of_value: 66, building_loss_amount: 255000, contents_loss_amount: 102000, policy_days_before_loss: 1500 }, 'catastrophic'],
  ['Gabriela Soto', 'Miami', 'Miami-Dade', 'SFIP', 'Flooding, closed', ['Ground floor'], 120, 118, 17000, 'CP',
    ['nfip_policy_flag'], { status_interval_days: 30, contents_loss_amount: 3000, building_loss_amount: 14000, policy_days_before_loss: 700 }],
  ['Winston Clark', 'Tampa', 'Hillsborough', 'SFIP', 'Flooding, late proof of loss', ['Ground floor'], 65, 64, 41000, 'PR',
    ['nfip_policy_flag', 'sfha_flag'], { proof_of_loss_received_flag: '', fraud_score: 74, contents_loss_amount: 12000, building_loss_amount: 29000, repair_cost_pct_of_value: 22, policy_days_before_loss: 365 }],
];

const BASE_CLAIMS: ClaimSpec[] = [
  ...HOMEOWNERS.map((t, i) => mk('Homeowners', i + 1, t)),
  ...RENTERS.map((t, i) => mk('Renters', i + 1, t)),
  ...LANDLORD.map((t, i) => mk('Landlord', i + 1, t)),
  ...DWELLING.map((t, i) => mk('Dwelling', i + 1, t)),
  ...FLOOD.map((t, i) => mk('Flood', i + 1, t)),
];

export const CLAIM_PREFIX: Record<LineOfBusiness, string> = {
  Homeowners: 'HO', Renters: 'RN', Landlord: 'LL', Dwelling: 'DW', Flood: 'FL',
};

// Wider footprint: move selected claims out of Florida (city, county and state). Everything else stays in FL.
const MOVES: Record<string, [string, string, string]> = {
  'Homeowners:2': ['Houston', 'Harris', 'TX'], 'Homeowners:4': ['Atlanta', 'Fulton', 'GA'], 'Homeowners:9': ['Charleston', 'Charleston', 'SC'],
  'Homeowners:10': ['Mobile', 'Mobile', 'AL'], 'Homeowners:13': ['Baton Rouge', 'East Baton Rouge', 'LA'],
  'Renters:3': ['Atlanta', 'Fulton', 'GA'], 'Renters:7': ['Houston', 'Harris', 'TX'], 'Renters:12': ['New Orleans', 'Orleans', 'LA'], 'Renters:14': ['Charlotte', 'Mecklenburg', 'NC'],
  'Landlord:4': ['Savannah', 'Chatham', 'GA'], 'Landlord:9': ['Mobile', 'Mobile', 'AL'], 'Landlord:13': ['Wilmington', 'New Hanover', 'NC'], 'Landlord:5': ['Dallas', 'Dallas', 'TX'],
  'Dwelling:3': ['Mobile', 'Mobile', 'AL'], 'Dwelling:7': ['Corpus Christi', 'Nueces', 'TX'], 'Dwelling:10': ['Charleston', 'Charleston', 'SC'], 'Dwelling:13': ['Birmingham', 'Jefferson', 'AL'],
  'Flood:3': ['New Orleans', 'Orleans', 'LA'], 'Flood:5': ['Savannah', 'Chatham', 'GA'], 'Flood:10': ['Mobile', 'Mobile', 'AL'], 'Flood:11': ['Charleston', 'Charleston', 'SC'], 'Flood:13': ['Galveston', 'Galveston', 'TX'], 'Flood:15': ['Wilmington', 'New Hanover', 'NC'],
};
export const CLAIMS: ClaimSpec[] = BASE_CLAIMS.map((c) => {
  const m = MOVES[`${c.lob}:${c.n}`];
  return m ? { ...c, city: m[0], county: m[1], st: m[2] } : c;
});
