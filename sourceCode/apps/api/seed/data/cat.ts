// Catastrophe events, public adjuster and investigator tags, and ZIP codes for the demo claims.
// Event windows follow public reporting (NAIC 2026 catastrophe event list; NHC landfall for Hurricane Isaias).
// The CAT number is an internal code modelled on the Lloyd's catastrophe code convention (2-digit year + event letter + state suffix, e.g. Lloyd's 20L / 20LB for Hurricane Isaias 2020).
// No state-assigned event number exists (OIR CRF-26A identifies events by name); Verisk PCS serial numbers are proprietary and are not used.
// Whether a state of emergency was declared for Isaias is assumed for the demo and must be confirmed.

export interface CatEventDef {
  eventId: string;           // internal CAT number shown on claims, e.g. 26B-FL
  eventName: string;
  eventType: string;
  states: string[];
  lossDateFrom: string;      // claims with loss dates inside this window and a listed county tie to the event
  lossDateTo: string;
  counties: string[];
  emergencyDeclared: boolean;
  crfApplicable: boolean;    // CRF-26A is a Florida data call only
  dataCallStatus: string;
  note: string;
  crfForm: string;           // reporting form for the event year
  reportedClaimCount?: number; // company-wide count when known
}

export const CAT_EVENTS: CatEventDef[] = [
  {
    eventId: '25A-FL', eventName: 'Gulf Coast Winter Storm', eventType: 'Winter storm', states: ['FL'],
    lossDateFrom: '2025-01-20', lossDateTo: '2025-01-22',
    counties: ['Escambia', 'Santa Rosa', 'Okaloosa', 'Walton', 'Bay', 'Leon', 'Jackson'],
    emergencyDeclared: true, crfApplicable: false, crfForm: 'CRF-25', dataCallStatus: 'No OIR data call on file (historical; confirm)',
    note: 'Record Panhandle snow and ice, Jan 21-22 2025; Governor declared a state of emergency (FPREN, Dec 2025 review).',
  },
  {
    eventId: '25B-FL', eventName: 'Central Florida Tornado Outbreak', eventType: 'Tornado', states: ['FL'],
    lossDateFrom: '2025-03-10', lossDateTo: '2025-03-10',
    counties: ['Seminole', 'Orange', 'Okeechobee', 'St. Lucie'],
    emergencyDeclared: false, crfApplicable: false, crfForm: 'CRF-25', dataCallStatus: 'No OIR data call on file (historical; confirm)',
    note: 'EF-2 tornado, Longwood/I-4 corridor, Mar 10 2025; at least $4M property damage reported.',
  },
  {
    eventId: '25C-FL', eventName: 'Late-October Flash Flooding', eventType: 'Flash flood', states: ['FL'],
    lossDateFrom: '2025-10-25', lossDateTo: '2025-10-28',
    counties: ['Lake', 'Palm Beach'],
    emergencyDeclared: false, crfApplicable: false, crfForm: 'CRF-25', dataCallStatus: 'No OIR data call on file (historical; confirm)',
    note: 'Lake County (Mount Dora) and Palm Beach County (Boca Raton) flash flooding, late Oct 2025; exact dates approximate.',
  },
  {
    eventId: '26A-TX', eventName: 'Tropical Storm Edouard', eventType: 'Tropical storm', states: ['LA', 'TX'],
    lossDateFrom: '2026-08-31', lossDateTo: '2026-09-03', counties: ['Galveston'],
    emergencyDeclared: false, crfApplicable: false, crfForm: 'n/a', dataCallStatus: 'Not a Florida event (no CRF-26A)',
    note: 'Louisiana and Texas, 2026-08-31 to 2026-09-03 (NAIC 2026 catastrophe event list).',
  },
  {
    eventId: '26B-FL', eventName: 'Hurricane Isaias', eventType: 'Hurricane', states: ['FL'],
    lossDateFrom: '2026-10-08', lossDateTo: '2026-10-11',
    counties: ['Escambia', 'Santa Rosa', 'Okaloosa', 'Walton', 'Holmes', 'Bay', 'Washington', 'Gulf', 'Franklin', 'Calhoun'],
    emergencyDeclared: true, crfApplicable: true, crfForm: 'CRF-26A', dataCallStatus: 'Data call active (demo)',
    note: 'Landfall near Destin, FL on 2026-10-09. Emergency declaration is assumed for the demo; confirm against the OIR data call notice.',
  },
];

// key "<LOB>:<n>" -> [city, county, lossAgo, reportedAgo, cause]   (reference date 2026-10-30; Isaias loss day = 21 days ago)
export const ISAIAS_CLAIMS: Record<string, [string, string, number, number, string]> = {
  'Homeowners:1': ['Pensacola', 'Escambia', 21, 20, 'Hurricane Isaias wind and rain damage'],
  'Homeowners:7': ['Navarre', 'Santa Rosa', 21, 19, 'Hurricane Isaias roof wind damage'],
  'Homeowners:11': ['Destin', 'Okaloosa', 21, 18, 'Hurricane Isaias wind-driven rain and burst pipe'],
  'Homeowners:14': ['Pensacola', 'Escambia', 22, 17, 'Hurricane Isaias water intrusion, acknowledgement overdue'],
  'Renters:4': ['Pensacola', 'Escambia', 21, 20, 'Hurricane Isaias wind-driven rain'],
  'Renters:8': ['Panama City', 'Bay', 21, 17, 'Hurricane Isaias water damage with public adjuster'],
  'Renters:13': ['Fort Walton Beach', 'Okaloosa', 21, 19, 'Hurricane Isaias, tenant displaced'],
  'Landlord:2': ['Pensacola', 'Escambia', 21, 20, 'Hurricane Isaias roof damage to rental duplex'],
  'Landlord:6': ['Crestview', 'Okaloosa', 21, 16, 'Hurricane Isaias storm damage, appraisal demanded'],
  'Landlord:8': ['Panama City Beach', 'Bay', 21, 20, 'Hurricane Isaias damage to multi-unit property'],
  'Landlord:11': ['Milton', 'Santa Rosa', 20, 18, 'Hurricane Isaias roof damage, deductible waiver suspected'],
  'Landlord:12': ['Fort Walton Beach', 'Okaloosa', 20, 17, 'Hurricane Isaias water intrusion, underinsured'],
  'Dwelling:4': ['Fort Walton Beach', 'Okaloosa', 21, 19, 'Hurricane Isaias total loss'],
  'Dwelling:6': ['Gulf Breeze', 'Santa Rosa', 20, 18, 'Hurricane Isaias roof repair, contractor rebate suspected'],
  'Dwelling:12': ['Pensacola', 'Escambia', 21, 17, 'Hurricane Isaias wind loss, underinsured dwelling'],
  'Dwelling:15': ['Panama City', 'Bay', 21, 19, 'Hurricane Isaias damage to roof and windows'],
  'Flood:1': ['Destin', 'Okaloosa', 21, 19, 'Hurricane Isaias storm surge'],
  'Flood:2': ['Pensacola Beach', 'Escambia', 21, 20, 'Hurricane Isaias flood, total loss'],
  'Flood:6': ['Santa Rosa Beach', 'Walton', 21, 18, 'Hurricane Isaias storm surge'],
  'Flood:7': ['Port St. Joe', 'Gulf', 21, 17, 'Hurricane Isaias flooding, waiting-period exception applies'],
  'Flood:9': ['Mexico Beach', 'Bay', 21, 18, 'Hurricane Isaias canal overflow'],
};
export const EDOUARD_CLAIMS: Record<string, [string, string, number, number, string]> = {
  'Flood:13': ['Galveston', 'Galveston', 58, 55, 'Tropical Storm Edouard storm surge'],
};

// Prior-year (2025) events: existing closed claims re-dated to the event. key -> [eventId, city, county, lossAgo, reportedAgo, cause]
export const HIST_CLAIMS: Record<string, [string, string, string, number, number, string]> = {
  'Landlord:7': ['25A-FL', 'Pensacola', 'Escambia', 646, 644, 'Gulf Coast winter storm: freeze burst pipe in vacant unit, vacancy exclusion'],
  'Landlord:14': ['25B-FL', 'Orlando', 'Orange', 599, 597, 'Central Florida tornado damage to fence and roof'],
  'Flood:14': ['25C-FL', 'Boca Raton', 'Palm Beach', 369, 366, 'Late-October flash flooding, closed'],
  'Flood:8': ['25C-FL', 'Mount Dora', 'Lake', 369, 366, 'Late-October flash flooding inside waiting period, claim denied'],
};

// Public adjusters (fictional firms). feePct is the contingency fee in the signed contract.
export const PUBLIC_ADJUSTERS: Record<string, { firm: string; feePct: number; contractAgo: number }> = {
  'Homeowners:7': { firm: 'Bayline Public Adjusting', feePct: 20, contractAgo: 17 },
  'Renters:8': { firm: 'Gulfstream Claim Advocates', feePct: 10, contractAgo: 16 },
  'Landlord:6': { firm: 'Sunrise Claim Advocates', feePct: 20, contractAgo: 15 },
  'Dwelling:4': { firm: 'Coastal Loss Consultants', feePct: 10, contractAgo: 17 },
  'Homeowners:5': { firm: 'Biscayne Public Adjusting', feePct: 20, contractAgo: 14 },
  'Dwelling:5': { firm: 'Pinellas Claim Advocates', feePct: 20, contractAgo: 40 },
  'Dwelling:10': { firm: 'Palmetto Claim Advocates', feePct: 20, contractAgo: 36 },
};
// Independent investigators engaged by the insured or counsel (fictional firms).
export const INVESTIGATORS: Record<string, string> = {
  'Homeowners:8': 'Meridian Investigative Services', 'Renters:5': 'Tidewater Investigations', 'Dwelling:11': 'Orion Claims Investigations',
};

export const ZIPS: Record<string, string> = {
  'Cape Coral': '33904', Orlando: '32801', Tampa: '33602', Jacksonville: '32202', Miami: '33130', Sarasota: '34236', 'Palm Beach Gardens': '33410', Naples: '34102',
  Hollywood: '33020', 'Fort Lauderdale': '33301', 'Daytona Beach': '32114', 'Miami Gardens': '33056', Gainesville: '32601', 'St. Petersburg': '33701', Melbourne: '32901',
  'Fort Myers': '33901', 'Boca Raton': '33432', Lakeland: '33801', Hialeah: '33010', 'Fort Pierce': '34950', Clearwater: '33756', Ocala: '34470', Kissimmee: '34741',
  Homestead: '33030', 'Panama City': '32401', 'Key West': '33040', Houston: '77002', Atlanta: '30303', Charleston: '29401', Mobile: '36602', 'Baton Rouge': '70802',
  'New Orleans': '70112', Charlotte: '28202', Savannah: '31401', Dallas: '75201', Wilmington: '28401', 'Corpus Christi': '78401', Birmingham: '35203', Galveston: '77550',
  Pensacola: '32502', 'Pensacola Beach': '32561', Navarre: '32566', Destin: '32541', 'Fort Walton Beach': '32548', 'Panama City Beach': '32408', Crestview: '32536',
  Milton: '32570', 'Gulf Breeze': '32561', 'Santa Rosa Beach': '32459', 'Mexico Beach': '32410', 'Port St. Joe': '32456', 'Mount Dora': '32757',
};

export const FL_COUNTIES = ['Alachua', 'Baker', 'Bay', 'Bradford', 'Brevard', 'Broward', 'Calhoun', 'Charlotte', 'Citrus', 'Clay', 'Collier', 'Columbia', 'DeSoto', 'Dixie', 'Duval',
  'Escambia', 'Flagler', 'Franklin', 'Gadsden', 'Gilchrist', 'Glades', 'Gulf', 'Hamilton', 'Hardee', 'Hendry', 'Hernando', 'Highlands', 'Hillsborough', 'Holmes', 'Indian River',
  'Jackson', 'Jefferson', 'Lafayette', 'Lake', 'Lee', 'Leon', 'Levy', 'Liberty', 'Madison', 'Manatee', 'Marion', 'Martin', 'Miami-Dade', 'Monroe', 'Nassau', 'Okaloosa',
  'Okeechobee', 'Orange', 'Osceola', 'Palm Beach', 'Pasco', 'Pinellas', 'Polk', 'Putnam', 'Santa Rosa', 'Sarasota', 'Seminole', 'St. Johns', 'St. Lucie', 'Sumter', 'Suwannee',
  'Taylor', 'Union', 'Volusia', 'Wakulla', 'Walton', 'Washington'];
