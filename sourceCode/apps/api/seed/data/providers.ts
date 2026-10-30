// Fictional service providers for the demo (mostly Florida, plus the wider Gulf and Southeast footprint). Every name, address, e-mail
// and phone number is invented (e-mail uses the reserved .example domain,
// phone numbers use the 555-01xx fictional range).
export type ProviderStatus =
  | 'Active' | 'requalDue' | 'Suspended' | 'InProgress' | 'Disqualified' | 'ReadyForActivation' | 'PendingApproval';

export interface ProviderDef {
  company: string;
  city: string;
  county: string;
  rating: number;
  status: ProviderStatus;
  turnaround: string;
  coverage: string;        // states / region text
  contact: string;
  rules: string[];         // exact rule names (see rules.ts)
  boosted?: boolean;
  state?: string;          // full state name; defaults to Florida
}

const P = (company: string, city: string, county: string, rating: number, turnaround: string,
           contact: string, rules: string[], status: ProviderStatus = 'Active', coverage = 'FL', boosted = false): ProviderDef =>
  ({ company, city, county, rating, status, turnaround, coverage, contact, rules, boosted });

const X = (company: string, city: string, county: string, state: string, coverage: string, rating: number, turnaround: string,
           contact: string, rules: string[], status: ProviderStatus = 'Active', boosted = false): ProviderDef =>
  ({ company, city, county, state, rating, status, turnaround, coverage, contact, rules, boosted });

export const PROVIDERS: ProviderDef[] = [
  // 24/7 Loss Mitigation Contractors
  P('Gulfshore Restoration Group', 'Fort Myers', 'Lee', 4.8, '4 Hours', 'Dana Whitfield', ['24/7 Loss Mitigation Contractors', 'Pack-out & Contents Cleaning', 'CAT Response'], 'Active', 'FL', true),
  P('Sunstate Water Mitigation', 'Orlando', 'Orange', 4.5, '4 Hours', 'Luis Barrios', ['24/7 Loss Mitigation Contractors']),
  P('Palm Coast Restoration', 'Daytona Beach', 'Volusia', 4.3, '6 Hours', 'Tamara Cole', ['24/7 Loss Mitigation Contractors', 'Repair Network Referral']),
  P('Bluewater Dry-Out Services', 'Miami', 'Miami-Dade', 3.9, '6 Hours', 'Omar Reyes', ['24/7 Loss Mitigation Contractors'], 'requalDue'),

  // Cause & Origin Specialists
  P('Everglades Cause & Origin', 'Hialeah', 'Miami-Dade', 4.7, '48 Hours', 'Marcus Feld', ['Cause & Origin Specialists']),
  P('Tri-County Fire Analysis', 'Tampa', 'Hillsborough', 4.4, '48 Hours', 'Renee Alvarado', ['Cause & Origin Specialists', 'Scene Investigation & Official Reports']),
  P('Meridian Origin Consultants', 'Jacksonville', 'Duval', 4.1, '72 Hours', 'Peter Nakamura', ['Cause & Origin Specialists'], 'Suspended'),

  // Appraisers / Independent Adjusters
  P('Coastal Claim Estimators', 'Sarasota', 'Sarasota', 4.6, '3 Business Days', 'Janelle Brooks', ['Appraisers/Independent Adjusters', 'Estimate & Invoice Review']),
  P('Bayfront Independent Adjusters', 'St. Petersburg', 'Pinellas', 4.4, '3 Business Days', 'Kevin Chen', ['Independent Adjusters', 'Appraisers/Independent Adjusters']),
  P('Citrus Valley Appraisal Group', 'Lakeland', 'Polk', 4.0, '4 Business Days', 'Sofia Marsh', ['Appraisers/Independent Adjusters']),

  // Independent Adjusters
  P('Heron Adjusting Services', 'Naples', 'Collier', 4.2, '2 Business Days', 'Diego Alvarez', ['Independent Adjusters']),
  P('Keys Independent Adjusters', 'Key West', 'Monroe', 4.1, '3 Business Days', 'Maria Delgado', ['Independent Adjusters'], 'Active', 'FL Keys'),
  P('Panhandle Claims Services', 'Pensacola', 'Escambia', 3.8, '3 Business Days', 'Robert Halloway', ['Independent Adjusters'], 'InProgress'),

  // Forensic Engineers
  P('Harbor Forensic Engineering', 'Fort Lauderdale', 'Broward', 4.7, '5 Business Days', 'Dr. Anita Sorensen', ['Forensic Engineers']),
  P('Pelican Structural Engineers', 'Clearwater', 'Pinellas', 4.5, '5 Business Days', 'Grant Okafor', ['Forensic Engineers']),
  P('Atlantic Building Sciences', 'Melbourne', 'Brevard', 4.2, '7 Business Days', 'Helen Park', ['Forensic Engineers'], 'ReadyForActivation'),

  // Forensic Accountant
  P('Lakeshore Forensic Accounting', 'Orlando', 'Orange', 4.5, '5 Business Days', 'Noah Whitmore', ['Forensic Accountant']),
  P('Cardinal Loss Analytics', 'Boca Raton', 'Palm Beach', 4.3, '5 Business Days', 'Imani Hughes', ['Forensic Accountant']),

  // Legal / Coverage
  P('Magnolia Coverage Counsel', 'Tallahassee', 'Leon', 4.3, '5 Business Days', 'Denise Whitmore, Esq.', ['Legal', 'Coverage Verification & ROR']),
  P('Sawgrass Insurance Law Group', 'Fort Lauderdale', 'Broward', 4.4, '5 Business Days', 'Lisa Tran, Esq.', ['Legal', 'Public Adjuster / Appraisal']),
  P('Bayshore Legal Partners', 'Tampa', 'Hillsborough', 4.0, '7 Business Days', 'Carl Jennings, Esq.', ['Legal']),
  P('Fidelity Coverage Review', 'Miami', 'Miami-Dade', 4.2, '3 Business Days', 'Yara Haddad', ['Coverage Verification & ROR']),

  // Decision letters
  P('Clarity Claim Letters', 'Orlando', 'Orange', 4.6, '24 Hours', 'Brianna Cole', ['Decision letters', 'Statutory Deadline Watch']),
  P('Sunrise Correspondence Services', 'Jacksonville', 'Duval', 4.3, '24 Hours', 'Theo Marsh', ['Decision letters']),
  P('Plainspoken Notices', 'Tampa', 'Hillsborough', 4.0, '48 Hours', 'Alicia Brooks', ['Decision letters']),

  // Subrogation / recovery
  P('Tidewater Recovery Partners', 'Jacksonville', 'Duval', 4.4, '10 Business Days', 'Gordon Pike', ['Subrogation', 'Tenant-Caused Loss Recovery']),
  P('Recoup Florida Subrogation', 'Miami', 'Miami-Dade', 4.2, '10 Business Days', 'Natalia Cruz', ['Subrogation']),
  P('Anchor Recovery Group', 'Tampa', 'Hillsborough', 3.9, '12 Business Days', 'Victor Lang', ['Subrogation', 'Tenant-Caused Loss Recovery'], 'requalDue'),
  P('Landlord Recovery Partners', 'Orlando', 'Orange', 4.1, '8 Business Days', 'Whitney Boyd', ['Tenant-Caused Loss Recovery']),

  // Desk investigations
  P('Meridian Desk Investigations', 'Jacksonville', 'Duval', 4.5, '3 Business Days', 'Colleen Roark', ['Desk investigations']),
  P('Northpoint Special Investigations', 'Orlando', 'Orange', 4.3, '3 Business Days', 'Andre Wilkes', ['Desk investigations', 'Scene Investigation & Official Reports']),
  P('Cardinal Claims Verification', 'Miami', 'Miami-Dade', 4.1, '4 Business Days', 'Esteban Ruiz', ['Desk investigations']),

  // CAT Response
  P('Stormline CAT Services', 'Fort Myers', 'Lee', 4.6, '12 Hours', 'Jordan Pierce', ['CAT Response', 'Statutory Deadline Watch'], 'Active', 'FL, GA, AL', true),
  P('Hurricane Alley Response Team', 'Miami', 'Miami-Dade', 4.4, '12 Hours', 'Camila Soto', ['CAT Response']),
  P('Gulfstream CAT Adjusters', 'Tampa', 'Hillsborough', 4.2, '24 Hours', 'Ben Hartley', ['CAT Response']),

  // Repair Network Referral
  P('Palmetto Contractor Network', 'Orlando', 'Orange', 4.4, '48 Hours', 'Renata Silva', ['Repair Network Referral']),
  P('Sunbelt Repair Alliance', 'Tampa', 'Hillsborough', 4.2, '48 Hours', 'Jerome Tate', ['Repair Network Referral']),
  P('Cornerstone Trades Network', 'Jacksonville', 'Duval', 3.9, '72 Hours', 'Nadia Karim', ['Repair Network Referral'], 'PendingApproval'),

  // Scene investigation
  P('Beacon Scene Investigations', 'Orlando', 'Orange', 4.2, '48 Hours', 'Hector Villa', ['Scene Investigation & Official Reports']),
  P('Orange Grove Reports & Records', 'Orlando', 'Orange', 4.0, '48 Hours', 'Faith Obi', ['Scene Investigation & Official Reports']),

  // Flood
  P('Palmetto Flood Adjusters', 'Tampa', 'Hillsborough', 4.7, '24 Hours', 'Gina Alvarez', ['NFIP Authorized Adjuster', 'Proof of Loss Follow-up'], 'Active', 'FL, GA, SC', true),
  P('Tidewater Flood Services', 'Fort Lauderdale', 'Broward', 4.5, '24 Hours', 'Samir Patel', ['NFIP Authorized Adjuster']),
  P('Gulf Coast NFIP Adjusting', 'Naples', 'Collier', 4.3, '36 Hours', 'Leah Brandt', ['NFIP Authorized Adjuster'], 'Active', 'FL, AL, MS'),
  P('Clearwater Documentation Services', 'Clearwater', 'Pinellas', 4.2, '48 Hours', 'Irene Fox', ['Proof of Loss Follow-up']),
  P('Harborview Policy Review', 'Miami', 'Miami-Dade', 4.1, '3 Business Days', 'Dmitri Volkov', ['Waiting Period Review']),
  P('Coverage Timeline Analysts', 'Orlando', 'Orange', 4.0, '3 Business Days', 'Joy Ellison', ['Waiting Period Review']),
  P('Sunshine Floodplain Consultants', 'Sarasota', 'Sarasota', 4.5, '5 Business Days', 'Tom Lindqvist', ['Substantial Damage Determination']),
  P('Elevation & Damage Assessors', 'Fort Myers', 'Lee', 4.3, '5 Business Days', 'Priscilla Ng', ['Substantial Damage Determination']),
  P('Resilient Home Consultants', 'Tampa', 'Hillsborough', 4.4, '5 Business Days', 'Marcus Bell', ['ICC Claim Handling']),
  P('Mitigation Grant & ICC Services', 'Tallahassee', 'Leon', 4.1, '7 Business Days', 'Olivia Grant', ['ICC Claim Handling']),
  P('Limit Review Associates', 'Miami', 'Miami-Dade', 4.2, '3 Business Days', 'Peter Zhao', ['NFIP Limit Exposure']),
  P('Flood Exposure Analysts', 'Jacksonville', 'Duval', 4.0, '3 Business Days', 'Rosa Medina', ['NFIP Limit Exposure']),

  // Property
  P('Estimate Integrity Partners', 'Orlando', 'Orange', 4.5, '2 Business Days', 'Vince Carter', ['Estimate & Invoice Review']),
  P('Keystone Estimate Review', 'Tampa', 'Hillsborough', 4.2, '2 Business Days', 'Ruth Adeyemi', ['Estimate & Invoice Review']),
  P('Neutral Appraisal Group of Florida', 'Orlando', 'Orange', 4.3, '10 Business Days', 'Howard Kim', ['Public Adjuster / Appraisal']),
  P('Umpire Services of Tampa Bay', 'Tampa', 'Hillsborough', 4.1, '10 Business Days', 'Elaine Ross', ['Public Adjuster / Appraisal']),
  P('Sunstate Roofing Inspections', 'Orlando', 'Orange', 4.6, '3 Business Days', 'Caleb Ortiz', ['Roof Surface Review', 'Repair Network Referral']),
  P('Skyline Roof Analysts', 'Fort Myers', 'Lee', 4.3, '3 Business Days', 'Mei Tanaka', ['Roof Surface Review']),
  P('Valuation Insight Group', 'Miami', 'Miami-Dade', 4.4, '3 Business Days', 'Adrian Stone', ['Insurance-to-Value Review']),
  P('Replacement Cost Analytics', 'Tampa', 'Hillsborough', 4.1, '3 Business Days', 'Fiona Burke', ['Insurance-to-Value Review']),
  P('Keystone Contents Services', 'Orlando', 'Orange', 4.4, '5 Business Days', 'Daniel Okoye', ['Contents Inventory & Valuation', 'Pack-out & Contents Cleaning']),
  P('Inventory Pros of Florida', 'Tampa', 'Hillsborough', 4.2, '5 Business Days', 'Sabrina Lowe', ['Contents Inventory & Valuation']),
  P('Careful Hands Pack-Out', 'Jacksonville', 'Duval', 4.3, '48 Hours', 'Walter Finch', ['Pack-out & Contents Cleaning']),
  P('Safe Harbor Temporary Housing', 'Orlando', 'Orange', 4.5, '24 Hours', 'Gloria Mendez', ['Temporary Housing / ALE']),
  P('Interim Living Solutions', 'Tampa', 'Hillsborough', 4.2, '24 Hours', 'Patrick Doyle', ['Temporary Housing / ALE']),
  P('Occupancy Verification Services', 'Orlando', 'Orange', 4.1, '3 Business Days', 'Nora Feldman', ['Vacancy Review']),
  P('Property Watch Inspections', 'Tampa', 'Hillsborough', 4.0, '3 Business Days', 'Ian Murphy', ['Vacancy Review']),
  P('Compliance Clock Services', 'Tallahassee', 'Leon', 4.4, '24 Hours', 'Celeste Rowe', ['Statutory Deadline Watch']),
  P('Fee & Waiver Audit Group', 'Orlando', 'Orange', 4.2, '5 Business Days', 'Dennis Hall', ['Deductible Waiver Review']),
  P('Integrity Review Associates', 'Miami', 'Miami-Dade', 4.0, '5 Business Days', 'Tasha Greene', ['Deductible Waiver Review'], 'Disqualified'),

  // ── Wider footprint: Gulf and Southeast coast (fictional) ────────────────────
  X('Lone Star Storm Response', 'Houston', 'Harris', 'Texas', 'TX, LA', 4.5, '12 Hours', 'Marcus Delaney', ['CAT Response', '24/7 Loss Mitigation Contractors'], 'Active', true),
  X('Gulf Coast Flood Adjusters', 'Corpus Christi', 'Nueces', 'Texas', 'TX, LA, MS', 4.4, '2 Business Days', 'Renata Silva', ['NFIP Authorized Adjuster', 'Proof of Loss Follow-up', 'Waiting Period Review']),
  X('Brazos Independent Adjusters', 'Dallas', 'Dallas', 'Texas', 'TX, OK', 4.1, '3 Business Days', 'Cole Hendricks', ['Independent Adjusters', 'Appraisers/Independent Adjusters', 'Estimate & Invoice Review']),
  X('Bayou Restoration Partners', 'New Orleans', 'Orleans', 'Louisiana', 'LA, MS', 4.3, '6 Hours', 'Antoine Boudreaux', ['24/7 Loss Mitigation Contractors', 'Pack-out & Contents Cleaning']),
  X('Crescent Flood Services', 'Baton Rouge', 'East Baton Rouge', 'Louisiana', 'LA', 4.2, '2 Business Days', 'Simone Arceneaux', ['NFIP Authorized Adjuster', 'Substantial Damage Determination', 'ICC Claim Handling']),
  X('Mobile Bay Claims Group', 'Mobile', 'Mobile', 'Alabama', 'AL, MS, FL', 4.4, '3 Business Days', 'Tyrone Wells', ['Independent Adjusters', 'Roof Surface Review', 'Repair Network Referral']),
  X('Yellowhammer Roof Inspections', 'Birmingham', 'Jefferson', 'Alabama', 'AL, GA', 4.0, '4 Business Days', 'Carla Whitfield', ['Roof Surface Review', 'Estimate & Invoice Review']),
  X('Peach State Property Adjusters', 'Atlanta', 'Fulton', 'Georgia', 'GA, SC, AL', 4.3, '3 Business Days', 'Jamal Ellis', ['Independent Adjusters', 'Appraisers/Independent Adjusters', 'Coverage Verification & ROR']),
  X('Lowcountry Coastal Claims', 'Savannah', 'Chatham', 'Georgia', 'GA, SC', 4.4, '2 Business Days', 'Hannah Dorsey', ['NFIP Authorized Adjuster', 'CAT Response', 'Contents Inventory & Valuation']),
  X('Palmetto Recovery Group', 'Charleston', 'Charleston', 'South Carolina', 'SC, NC, GA', 4.5, '10 Business Days', 'Gideon Marsh', ['Subrogation', 'Tenant-Caused Loss Recovery', 'Legal']),
  X('Holy City Mitigation', 'Charleston', 'Charleston', 'South Carolina', 'SC, NC', 4.2, '4 Hours', 'Beth Calloway', ['24/7 Loss Mitigation Contractors', 'Temporary Housing / ALE']),
  X('Cape Fear Catastrophe Services', 'Wilmington', 'New Hanover', 'North Carolina', 'NC, SC', 4.3, '12 Hours', 'Russell Pike', ['CAT Response', 'Desk investigations']),
  X('Outer Banks Flood Review', 'Wilmington', 'New Hanover', 'North Carolina', 'NC, SC, VA', 4.1, '3 Business Days', 'Mallory Quinn', ['NFIP Authorized Adjuster', 'NFIP Limit Exposure']),
];

// Spread the Florida providers across neighbouring states so the coverage column shows a realistic footprint.
const WIDER_COVERAGE = ['FL, GA, AL', 'FL, GA', 'FL, AL, MS', 'FL, SC, NC', 'FL, GA, SC'];
PROVIDERS.forEach((pr, i) => { if (pr.coverage === 'FL' && i % 3 === 1) pr.coverage = WIDER_COVERAGE[(i / 3 | 0) % WIDER_COVERAGE.length]; });
