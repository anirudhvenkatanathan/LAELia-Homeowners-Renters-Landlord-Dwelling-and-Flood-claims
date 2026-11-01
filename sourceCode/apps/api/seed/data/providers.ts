// Service providers for the demo: real property-claims firms (public listings supplied by the client team plus market research).
// Names, cities, addresses, phones and Google ratings come from those listings where found. Where nothing was found
// the field is a demo placeholder: rating 4.0, generated .example e-mail, 555-01xx phone. Turnaround is indicative.
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
  phone?: string;          // real listed phone, when found
  street?: string;         // real listed street address, when found
  email?: string;          // real published business e-mail, when found
}

type Extra = { phone?: string; street?: string; email?: string; boosted?: boolean; state?: string; status?: ProviderStatus };
const V = (company: string, city: string, county: string, rating: number, turnaround: string, coverage: string,
           rules: string[], x: Extra = {}): ProviderDef =>
  ({ company, city, county, rating, turnaround, coverage, rules, contact: 'Main office', status: x.status ?? 'Active',
     boosted: x.boosted ?? false, state: x.state, phone: x.phone, street: x.street, email: x.email });

const ROOF = ['Roof Surface Review', 'Estimate & Invoice Review', 'Repair Network Referral'];

export const PROVIDERS: ProviderDef[] = [
  // ── Core 14: roofing, restoration, mitigation and engineering firms ─────────────
  V('Southeast Roofing & Construction', 'Pensacola', 'Escambia', 4.4, '3 Business Days', 'FL', ROOF,
    { phone: '(850) 478-4715', street: '9531 N Palafox St, Pensacola, FL 32534' }),
  V('E2 Roofing', 'Jacksonville', 'Duval', 4.8, '3 Business Days', 'FL', ROOF,
    { phone: '(904) 420-8844', street: '6900 Philips Hwy Suite 31, Jacksonville, FL 32216' }),
  V('Paul Davis Restoration', 'Fort Lauderdale', 'Broward', 4.5, '4 Hours', 'FL', ['24/7 Loss Mitigation Contractors', 'Pack-out & Contents Cleaning', 'CAT Response'],
    { phone: '(954) 979-9078', street: '4571 NW 8th Ave, Fort Lauderdale, FL 33309', email: 'BCFLemergency@pauldavis.com' }),
  V('M6 Building Solutions', 'Tampa', 'Hillsborough', 4.9, '3 Business Days', 'FL', ROOF,
    { street: '401 E Jackson St Ste 3300, Tampa, FL 33602' }),
  V('Proclaim Engineering, Inc', 'Winter Haven', 'Polk', 4.0, '5 Business Days', 'FL', ['Forensic Engineers', 'Cause & Origin Specialists'],
    { phone: '(800) 309-2755', street: '264 Terranova Blvd, Winter Haven, FL 33884' }),
  V('Hi Low Roofing', 'Winter Garden', 'Orange', 4.9, '3 Business Days', 'FL', ROOF,
    { phone: '(407) 287-6171', street: '13330 W Colonial Dr Suite 110, Winter Garden, FL 34787' }),
  V('Dehlinger Construction', 'Longwood', 'Seminole', 4.6, '4 Business Days', 'FL', ROOF,
    { phone: '(407) 636-9322', street: '157 E Lake Brantley Dr, Longwood, FL 32779' }),
  V('Neumann Construction & Roofing', 'San Antonio', 'Pasco', 4.3, '4 Business Days', 'FL', ['Roof Surface Review', 'Repair Network Referral'],
    { phone: '(877) 762-6350', street: '30427 Commerce Dr, San Antonio, FL 33576' }),
  V('DDA Forensics', 'Miami', 'Miami-Dade', 4.7, '5 Business Days', 'AL, FL, GA, LA, MS, SC, TX', ['Forensic Engineers', 'Cause & Origin Specialists'],
    { phone: '(786) 772-5643', street: '5335 NW 87th Ave Suite 109, Miami, FL', email: 'info@DDAForensics.com' }),
  V('Herring Cleaning and Restoration', 'Jacksonville', 'Duval', 3.8, '1 Business Day', 'FL', ['24/7 Loss Mitigation Contractors', 'Pack-out & Contents Cleaning'],
    { street: '239 Jones Rd, Jacksonville, FL 32220' }),
  V('Janney Roofing', 'Casselberry', 'Seminole', 4.9, '3 Business Days', 'FL', ['Roof Surface Review', 'Estimate & Invoice Review', 'CAT Response'],
    { phone: '(407) 305-5049', street: '1211 FL-436 #227, Casselberry, FL 32707' }),
  V('Megram Construction', 'Oviedo', 'Seminole', 4.8, '5 Business Days', 'FL', ['Repair Network Referral', 'Estimate & Invoice Review'],
    { phone: '(407) 592-7360', street: '400 W State Rd 434 Ste 106, Oviedo, FL 32765' }),
  V('Bigfoot Roofing & Construction', 'Jacksonville', 'Duval', 4.8, '1 Business Day', 'FL', [...ROOF, 'CAT Response'],
    { phone: '(904) 751-6112', street: '2929 Edison Ave, Jacksonville, FL 32254' }),
  V('Kruger Property Solutions', 'Boca Raton', 'Palm Beach', 4.0, '4 Hours', 'FL, LA', ['24/7 Loss Mitigation Contractors', 'CAT Response', 'Roof Surface Review'],
    { phone: '(954) 933-1298', street: '456 NW 35th St, Boca Raton, FL 33431', email: 'claims@callkruger.com', boosted: true }),

  // ── Market additions: adjusting, investigation, legal and subrogation, specialists ──
  V('Colonial Claims', 'Dunedin', 'Pinellas', 4.6, '3 Business Days', 'FL, KY',
    ['Independent Adjusters', 'Appraisers/Independent Adjusters', 'Insurance-to-Value Review', 'Vacancy Review', 'Deductible Waiver Review', 'Statutory Deadline Watch'],
    { phone: '(727) 738-1366', street: '2200 Bayshore Blvd, Dunedin, FL' }),
  V('Specialty Adjusting International', 'Miami', 'Miami-Dade', 4.2, '2 Business Days', 'FL', ['Independent Adjusters', 'Appraisers/Independent Adjusters', 'CAT Response'],
    { street: '10737 SW 104 St, Miami, FL 33176', status: 'ReadyForActivation' }),
  V('Gold Star Adjusters', 'Jacksonville', 'Duval', 4.9, '3 Business Days', 'FL', ['Public Adjuster / Appraisal'],
    { street: '3771 San Jose Pl, Jacksonville, FL 32257' }),
  V('K&R Investigative Group', 'Tampa', 'Hillsborough', 4.4, '3 Business Days', 'FL', ['Desk investigations', 'Scene Investigation & Official Reports']),
  V('GrayRobinson', 'Orlando', 'Orange', 4.7, '5 Business Days', 'FL',
    ['Legal', 'Subrogation', 'Tenant-Caused Loss Recovery', 'Coverage Verification & ROR', 'Decision letters'],
    { phone: '(407) 843-8880', street: '301 E Pine St Suite 1400, Orlando, FL 32801' }),
  V('The Chapman Law Firm, P.A.', 'Boca Raton', 'Palm Beach', 4.5, '5 Business Days', 'FL', ['Subrogation', 'Tenant-Caused Loss Recovery', 'Legal'],
    { phone: '(561) 997-0449', street: '7200 W Camino Real Suite 102, Boca Raton, FL 33433', status: 'ReadyForActivation' }),
  V('Total Inventory, LLC', 'Maitland', 'Orange', 4.3, '4 Business Days', 'FL', ['Contents Inventory & Valuation'],
    { phone: '(689) 777-3665', street: 'PO Box 940242, Maitland, FL 32794' }),
  V('MDD Forensic Accountants', 'Lake Mary', 'Seminole', 4.6, '7 Business Days', 'FL', ['Forensic Accountant'],
    { street: '100 Colonial Center Pkwy Suite 240, Lake Mary, FL 32746' }),
  V('J.S. Held', 'Jericho', 'Nassau', 4.5, '7 Business Days', 'FL, TX, LA, AL, GA, SC, NC', ['Substantial Damage Determination', 'ICC Claim Handling'], { state: 'New York' }),
  V('Crawford & Company', 'Peachtree Corners', 'Gwinnett', 4.1, '3 Business Days', 'FL, TX, LA, AL, GA, SC, NC',
    ['NFIP Authorized Adjuster', 'Proof of Loss Follow-up', 'Waiting Period Review', 'NFIP Limit Exposure', 'CAT Response'], { state: 'Georgia' }),
  V('ALE Solutions', 'Nationwide', 'N/A', 4.2, '1 Business Day', 'FL, TX, LA, AL, GA, SC, NC', ['Temporary Housing / ALE'], { state: 'Florida' }),
  V('CorVel Corporation', 'Irvine', 'Orange', 3.9, '2 Business Days', 'FL, TX, LA, AL, GA, SC, NC', ['Medical Management / Rehab'], { state: 'California' }),

  // ── Provider onboarding queue (new firms, not yet approved) ──────────────────────
  V('Five Star Claims Adjusting', 'Oakland Park', 'Broward', 4.8, '3 Business Days', 'FL', ['Public Adjuster / Appraisal'],
    { phone: '(321) 701-1371', street: '1640 W Oakland Park Blvd Ste 202, Oakland Park, FL', email: 'help@fsclaimsadj.com', status: 'PendingApproval' }),
  V('MSR Adjusters', 'Tampa', 'Hillsborough', 4.4, '3 Business Days', 'FL', ['Public Adjuster / Appraisal', 'Independent Adjusters'],
    { phone: '(813) 935-9364', street: '3310 W Cypress St Ste 202, Tampa, FL', status: 'PendingApproval' }),
  V('Specialized Investigative Support Inc', 'Lutz', 'Pasco', 4.8, '4 Business Days', 'FL', ['Desk investigations', 'Scene Investigation & Official Reports'],
    { street: 'Lutz, FL 33558', status: 'InProgress' }),
  V('Pack On The Go - The Contents Pro', 'Pompano Beach', 'Broward', 4.2, '3 Business Days', 'FL', ['Pack-out & Contents Cleaning', 'Contents Inventory & Valuation'],
    { phone: '(954) 800-6800', street: '1726 W Atlantic Blvd, Pompano Beach, FL 33069', status: 'InProgress' }),
];
