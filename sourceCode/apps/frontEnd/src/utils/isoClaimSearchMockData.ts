// ISO ClaimSearch mock data — a claim can carry 1 or 2 flags (stacked, most
// significant first), each built from the claim's own real fields
// (claimNumber, insuredName, injuryType, bodyParts, jurisdiction,
// policyNumber, lossDate, claimStatus, employerName, treatingProvider,
// vendorServices) wherever they're populated, falling back to deterministic
// generated values only where the real claim record has nothing for that
// field. Every match record refers only to THIS claim's own insured — no
// other/fictional claimant names are ever introduced, so "Claimant" always
// reads the same as the claim's real Insured Name. Injury fallback reuses
// claimSummaryMockData's own resolved injury for this claim number, so the
// Q-AI "Claims Summary" section and this ISO section never disagree about
// what the claim's injury is. Not a live ISO ClaimSearch lookup — mock data
// for demo purposes, clearly labeled as such in the UI.
//
// Assignment is randomized once per browser/device — not hardcoded forever
// by claim number, but also not re-rolled on every page refresh (the seed
// is persisted in localStorage; see SESSION_SEED below). Each claim sticks
// to whatever it was assigned (no match / 1 flag / 2 flags) until that seed
// changes, so a given claim's ISO ClaimSearch result stays put across
// reloads instead of flickering between different flags each time.
import type { IndividualClaimRecord } from '../models/claimIntakeMaster/claimIntakeModel';
import { getClaimSummaryData } from './claimSummaryMockData';

export type IsoFlagType =
  | 'PriorClaimsHistory'
  | 'SharedLegalRepresentation'
  | 'EmployerClaimClustering'
  | 'EmployerFrequencySpike'
  | 'CrossJurisdictionMatch'
  | 'TreatingProviderUtilizationOutlier'
  | 'ClaimFrequency';

export interface IsoMatchField { label: string; value: string; }
export interface IsoMatchRecord {
  isoFileNumber:    string;
  fields:           IsoMatchField[];
  // True when this match's "Date of Loss" field is the exact same date as
  // the current claim's own real lossDate — flagged as the panel's most
  // visually prominent element (see getIsoClaimSearchData's post-pass below).
  sameDayAsCurrent?: boolean;
}

// One indicator card — a single flag type's own match(es), description, and
// claim-specific facts. A claim's IsoClaimSearchData holds 1 or 2 of these.
export interface IsoFlagCard {
  flagType:              IsoFlagType;
  matches:               IsoMatchRecord[];
  flagHeading:            string;  // e.g. "PRIOR CLAIMS HISTORY"
  flagDescription:        string;  // fixed short text per flag type
  claimSpecificInsight:   string;  // dynamic — built from this claim's own real fields
}

export interface IsoClaimSearchData {
  claimantName:          string;
  maskedId:              string;
  // Cards are ordered most-significant-first — see SIGNIFICANCE_ORDER.
  flags:                 IsoFlagCard[];
  // This claim's own real identifying fields, surfaced verbatim so the
  // flyout can show "this is the claim you're looking at" alongside the
  // matched ISO record(s) — never generated/fallback values.
  currentClaimNumber:    string;
  currentPolicyNumber:   string;
  currentClaimStatus:    string;
  currentJurisdiction:   string;
  currentLossDate:       string;
}

// ─── Fixed flag descriptions (short — never vary by claim) ────────────────────

const FLAG_META: Record<IsoFlagType, { heading: string; description: string }> = {
  PriorClaimsHistory: {
    heading: 'PRIOR CLAIMS HISTORY',
    description: 'Prior claim for the same body part under a different employer — may be pre-existing or aggravated, not a new injury.',
  },
  SharedLegalRepresentation: {
    heading: 'SHARED LEGAL REPRESENTATION',
    description: 'Same attorney representing this claimant on a separate, similar-injury claim filed close together — possible coordinated activity.',
  },
  EmployerClaimClustering: {
    heading: 'EMPLOYER CLAIM CLUSTERING',
    description: 'Another claim from this claimant at the same employer, same legal representation, within a short timeframe.',
  },
  EmployerFrequencySpike: {
    heading: 'EMPLOYER FREQUENCY SPIKE',
    description: 'Multiple claims from this claimant at the same employer within one policy term — a frequency pattern worth reviewing.',
  },
  CrossJurisdictionMatch: {
    heading: 'CROSS-JURISDICTION MATCH',
    description: "Another active workers' comp claim exists in a different state under another employer — review to prevent overlapping indemnity.",
  },
  TreatingProviderUtilizationOutlier: {
    heading: 'TREATING PROVIDER UTILIZATION OUTLIER',
    description: "Treating provider has this claimant on multiple claims, with treatment durations well above regional averages.",
  },
  ClaimFrequency: {
    heading: 'CLAIM FREQUENCY',
    description: "Claimant has filed more workers' comp claims than occupational peers over a comparable period — raises overall risk profile.",
  },
};

// ─── Deterministic helpers ──────────────────────────────────────────────────

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}
function pick<T>(arr: T[], h: number, salt: number): T {
  return arr[((h * salt) >>> 0) % arr.length];
}
function maskedId(h: number): string {
  const last4 = String(1000 + (h % 9000));
  return `XXX-XX-${last4}`;
}
function isoFileNumber(h: number, salt: number): string {
  return `7K${String(((h * salt) >>> 0) % 900000 + 100000)}`;
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const FALLBACK_EMPLOYERS = [
  'Redwood Freight Systems', 'Harbor View Logistics', 'Granite Peak Construction',
  'Silverline Manufacturing', 'Coastal Produce Distributors', 'Ironclad Warehousing Co.',
];
const FALLBACK_STATES = [
  { code: 'TX', name: 'Texas' }, { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'AZ', name: 'Arizona' }, { code: 'NC', name: 'North Carolina' }, { code: 'OH', name: 'Ohio' },
];
const INSURING_COMPANIES = [
  'Meridian Casualty Group', 'Continental Indemnity Co.', 'Heartland Mutual Insurance',
  'Pinnacle Casualty Group', 'Union Surety & Casualty', 'Bayview Underwriters',
];
const ADJUSTERS = [
  'Delgado, Marisol', 'Chen, Kevin', 'Whitfield, Renee', 'Brooks, Tamika', 'Alvarez, Diego', 'Nakamura, Sarah',
];
const ATTORNEYS = [
  'Marcus Feld, Esq. — Feld & Grayson LLP', 'Lisa Tran, Esq. — Tran Injury Law',
  'Robert Halloway, Esq. — Halloway & Associates', 'Denise Whitmore, Esq. — Whitmore Legal Group',
];
const PROVIDER_SURNAMES = ['Bennett', 'Alvarez', 'Whitfield', 'Nakamura', 'Sorensen', 'Delgado', 'Okafor', 'Marsh'];

function policyPeriod(lossDateIso: string): string {
  const d = lossDateIso ? new Date(lossDateIso) : new Date();
  const start = new Date(d); start.setMonth(start.getMonth() - 6);
  const end   = new Date(d); end.setMonth(end.getMonth() + 6);
  return `${start.toISOString().slice(0, 7)}-01 – ${end.toISOString().slice(0, 7)}-01`;
}

// Resolves this claim's injury/body part from the exact same source
// claimSummaryMockData.ts uses (real record fields when present, otherwise
// its hashed mock pick) — never an independently-generated value, so the
// Claims Summary section and this panel always agree.
interface ResolvedInjury { alleged: string; bodyPart: string; }
function resolveInjury(r: IndividualClaimRecord): ResolvedInjury {
  const summary = getClaimSummaryData(r.claimNumber ?? '', r.insuredName, r.injuryType, r.bodyParts);
  return {
    alleged:  summary.injury.label,
    bodyPart: summary.injury.bodyPart,
  };
}

// ─── Per-flag builders — every match refers only to this claim's own insured ──
// Each returns one IsoFlagCard; claimant/current-claim fields are assembled
// once at the top level (getIsoClaimSearchData), not duplicated per card.

function buildPriorClaimsHistory(r: IndividualClaimRecord, h: number, inj: ResolvedInjury): IsoFlagCard {
  const claimant = r.insuredName?.trim() || 'The claimant';
  const priorEmployer = pick(FALLBACK_EMPLOYERS, h, 13);
  const monthsAgo = 12 + (h % 12);
  const priorDol = daysAgo(monthsAgo * 30 + 20);

  return {
    flagType: 'PriorClaimsHistory',
    matches: [{
      isoFileNumber: isoFileNumber(h, 3),
      fields: [
        { label: 'Date of Loss',          value: priorDol },
        { label: 'Claim Number',          value: `BIN${String(100000 + (h % 900000))}` },
        { label: 'Insuring Company',      value: pick(INSURING_COMPANIES, h, 9) },
        { label: 'Policy Number / Type',  value: `${pick(FALLBACK_STATES, h, 2).code}WC${String(100000 + (h % 900000)).slice(0, 6)} · Workers Compensation` },
        { label: 'Policy Period',         value: policyPeriod(priorDol) },
        { label: 'Claim Status',          value: 'CLOSED' },
        { label: 'Coverage / Loss Type',  value: 'Indemnity / Medical' },
        { label: 'Alleged Injury',        value: inj.alleged },
        { label: 'Part of Body',          value: inj.bodyPart },
        { label: 'Employer',              value: priorEmployer },
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 15) },
        { label: 'Matched On',            value: 'Name, SSN' },
      ],
    }],
    flagHeading: FLAG_META.PriorClaimsHistory.heading,
    flagDescription: FLAG_META.PriorClaimsHistory.description,
    claimSpecificInsight:
      `${claimant} has a prior closed claim for the same body part (${inj.bodyPart.toLowerCase()}) under ${priorEmployer}, `
      + `filed ~${monthsAgo} months earlier — current claim: ${inj.alleged.toLowerCase()}, ${r.claimStatus?.trim() || 'open'}.`,
  };
}

function buildSharedLegalRepresentation(r: IndividualClaimRecord, h: number, inj: ResolvedInjury): IsoFlagCard {
  const claimant = r.insuredName?.trim() || 'The claimant';
  const attorney = pick(ATTORNEYS, h, 11);
  const legalVendor = r.vendorServices?.find(v => /legal/i.test(v));
  const attorneyLine = legalVendor ? `${attorney} (via ${legalVendor})` : attorney;
  const priorEmployer = pick(FALLBACK_EMPLOYERS, h, 6);
  const daysApart = 14 + (h % 15);

  return {
    flagType: 'SharedLegalRepresentation',
    matches: [{
      isoFileNumber: isoFileNumber(h, 4),
      fields: [
        { label: 'Date of Loss',          value: daysAgo(daysApart) },
        { label: 'Claim Number',          value: `BIN${String(150000 + (h % 850000))}` },
        { label: 'Attorney',              value: attorneyLine },
        { label: 'Insuring Company',      value: pick(INSURING_COMPANIES, h, 17) },
        { label: 'Policy Number / Type',  value: `${pick(FALLBACK_STATES, h, 6).code}WC${String(150000 + (h % 850000)).slice(0, 6)} · Workers Compensation` },
        { label: 'Policy Period',         value: policyPeriod(daysAgo(daysApart)) },
        { label: 'Claim Status',          value: 'OPEN' },
        { label: 'Coverage / Loss Type',  value: 'Indemnity / Medical' },
        { label: 'Employer',              value: priorEmployer },
        { label: 'Alleged Injury',        value: inj.alleged },
        { label: 'Part of Body',          value: inj.bodyPart },
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 19) },
        { label: 'Matched On',            value: 'Attorney of Record' },
      ],
    }],
    flagHeading: FLAG_META.SharedLegalRepresentation.heading,
    flagDescription: FLAG_META.SharedLegalRepresentation.description,
    claimSpecificInsight:
      `${attorneyLine} also represents ${claimant} on a separate ${inj.alleged.toLowerCase()} claim at ${priorEmployer}, filed within ${daysApart} days of this claim.`,
  };
}

function buildEmployerClaimClustering(r: IndividualClaimRecord, h: number, inj: ResolvedInjury): IsoFlagCard {
  const claimant = r.insuredName?.trim() || 'The claimant';
  const employer = r.employerName?.trim() || pick(FALLBACK_EMPLOYERS, h, 4);
  const attorney = pick(ATTORNEYS, h, 12);
  const d1 = daysAgo(9 + (h % 8));

  return {
    flagType: 'EmployerClaimClustering',
    matches: [{
      isoFileNumber: isoFileNumber(h, 5),
      fields: [
        { label: 'Date of Loss',          value: d1 },
        { label: 'Claim Number',          value: `BIN${String(160000 + (h % 840000))}` },
        { label: 'Employer',              value: employer },
        { label: 'Attorney',              value: attorney },
        { label: 'Insuring Company',      value: pick(INSURING_COMPANIES, h, 21) },
        { label: 'Policy Number / Type',  value: `${pick(FALLBACK_STATES, h, 8).code}WC${String(160000 + (h % 840000)).slice(0, 6)} · Workers Compensation` },
        { label: 'Policy Period',         value: policyPeriod(d1) },
        { label: 'Claim Status',          value: 'OPEN' },
        { label: 'Coverage / Loss Type',  value: 'Indemnity / Medical' },
        { label: 'Alleged Injury',        value: inj.alleged },
        { label: 'Part of Body',          value: inj.bodyPart },
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 23) },
        { label: 'Matched On',            value: 'Employer + Attorney of Record' },
      ],
    }],
    flagHeading: FLAG_META.EmployerClaimClustering.heading,
    flagDescription: FLAG_META.EmployerClaimClustering.description,
    claimSpecificInsight:
      `${claimant} has another claim at ${employer} with the same attorney (${attorney}), filed within weeks of this ${inj.alleged.toLowerCase()} claim.`,
  };
}

function buildEmployerFrequencySpike(r: IndividualClaimRecord, h: number, inj: ResolvedInjury): IsoFlagCard {
  const claimant = r.insuredName?.trim() || 'The claimant';
  const employer = r.employerName?.trim() || pick(FALLBACK_EMPLOYERS, h, 8);
  const period = policyPeriod(r.lossDate || daysAgo(30));

  return {
    flagType: 'EmployerFrequencySpike',
    matches: [
      { isoFileNumber: isoFileNumber(h, 14), fields: [
        { label: 'Date of Loss', value: daysAgo(11 + (h % 6)) },
        { label: 'Claim Number', value: `BIN${String(170000 + (h % 830000))}` },
        { label: 'Employer', value: employer },
        { label: 'Insuring Company', value: pick(INSURING_COMPANIES, h, 27) },
        { label: 'Policy Period', value: period },
        { label: 'Claim Status', value: 'OPEN' },
        { label: 'Alleged Injury', value: inj.alleged },
        { label: 'Part of Body', value: inj.bodyPart },
        { label: 'Adjuster', value: pick(ADJUSTERS, h, 29) },
      ] },
      { isoFileNumber: isoFileNumber(h, 16), fields: [
        // Employer Frequency Spike's own premise is claims clustering in a
        // short window — deliberately landing this one on the exact same
        // date of loss as the current claim (when it has a real one) is a
        // realistic, stronger version of that pattern (e.g. one incident
        // affecting multiple employees), not just "close together".
        { label: 'Date of Loss', value: r.lossDate?.trim() || daysAgo(24 + (h % 6)) },
        { label: 'Claim Number', value: `BIN${String(180000 + (h % 820000))}` },
        { label: 'Employer', value: employer },
        { label: 'Insuring Company', value: pick(INSURING_COMPANIES, h, 31) },
        { label: 'Policy Period', value: period },
        { label: 'Claim Status', value: 'CLOSED' },
        { label: 'Alleged Injury', value: inj.alleged },
        { label: 'Part of Body', value: inj.bodyPart },
        { label: 'Adjuster', value: pick(ADJUSTERS, h, 33) },
      ] },
    ],
    flagHeading: FLAG_META.EmployerFrequencySpike.heading,
    flagDescription: FLAG_META.EmployerFrequencySpike.description,
    claimSpecificInsight:
      `${claimant} has 2 other matched claims at ${employer} within the same policy term as this ${inj.alleged.toLowerCase()} claim.`,
  };
}

function buildCrossJurisdictionMatch(r: IndividualClaimRecord, h: number, inj: ResolvedInjury): IsoFlagCard {
  const claimant = r.insuredName?.trim() || 'The claimant';
  const homeState = r.jurisdiction?.trim() || pick(FALLBACK_STATES, h, 2).name;
  const homeEmployer = r.employerName?.trim() || '';
  const otherState = pick(FALLBACK_STATES, h, 27);
  const employer = pick(FALLBACK_EMPLOYERS, h, 9);
  const dol = daysAgo(18 + (h % 20));

  return {
    flagType: 'CrossJurisdictionMatch',
    matches: [{
      isoFileNumber: isoFileNumber(h, 21),
      fields: [
        { label: 'Date of Loss',          value: dol },
        { label: 'Claim Number',          value: `BIN${String(200000 + (h % 700000))}` },
        { label: 'State',                 value: `${otherState.name} (${otherState.code})` },
        { label: 'Employer',              value: employer },
        { label: 'Insuring Company',      value: pick(INSURING_COMPANIES, h, 25) },
        { label: 'Policy Number / Type',  value: `${otherState.code}WC${String(200000 + (h % 700000)).slice(0, 6)} · Workers Compensation` },
        { label: 'Policy Period',         value: policyPeriod(dol) },
        { label: 'Coverage / Loss Type',  value: 'Indemnity / Medical' },
        { label: 'Claim Status',          value: 'OPEN — Active Indemnity' },
        { label: 'Alleged Injury',        value: inj.alleged },
        { label: 'Part of Body',          value: inj.bodyPart },
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 37) },
        { label: 'Matched On',            value: 'Name, DOB' },
      ],
    }],
    flagHeading: FLAG_META.CrossJurisdictionMatch.heading,
    flagDescription: FLAG_META.CrossJurisdictionMatch.description,
    claimSpecificInsight:
      `${claimant} has an active indemnity claim in ${otherState.name} under ${employer} — different employer and state than `
      + `this ${homeState} ${inj.alleged.toLowerCase()} claim` + (homeEmployer ? ` at ${homeEmployer}.` : '.'),
  };
}

function buildTreatingProviderUtilizationOutlier(r: IndividualClaimRecord, h: number, inj: ResolvedInjury): IsoFlagCard {
  const claimant = r.insuredName?.trim() || 'The claimant';
  const provider = r.treatingProvider?.trim() || `Dr. ${pick(PROVIDER_SURNAMES, h, 43)}`;
  const facility = r.medicalFacility?.trim() || 'Regional Occupational Health Clinic';
  const employer = r.employerName?.trim() || pick(FALLBACK_EMPLOYERS, h, 45);
  const avgWeeks = 6 + (h % 4);
  const dol = daysAgo(95 + (h % 30));

  return {
    flagType: 'TreatingProviderUtilizationOutlier',
    matches: [{
      isoFileNumber: isoFileNumber(h, 29),
      fields: [
        { label: 'Date of Loss',          value: dol },
        { label: 'Claim Number',          value: `BIN${String(220000 + (h % 680000))}` },
        { label: 'Treating Provider',     value: `${provider} — ${facility}` },
        { label: 'Employer',              value: employer },
        { label: 'Insuring Company',      value: pick(INSURING_COMPANIES, h, 39) },
        { label: 'Policy Number / Type',  value: `${pick(FALLBACK_STATES, h, 12).code}WC${String(220000 + (h % 680000)).slice(0, 6)} · Workers Compensation` },
        { label: 'Alleged Injury',        value: inj.alleged },
        { label: 'Part of Body',          value: inj.bodyPart },
        { label: 'Treatment Duration',    value: `${avgWeeks + 4 + (h % 5)} weeks (regional avg: ${avgWeeks} weeks)` },
        { label: 'Claim Status',          value: 'CLOSED' },
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 41) },
      ],
    }],
    flagHeading: FLAG_META.TreatingProviderUtilizationOutlier.heading,
    flagDescription: FLAG_META.TreatingProviderUtilizationOutlier.description,
    claimSpecificInsight:
      `${provider} at ${facility} previously treated ${claimant} on an earlier claim — durations trending above the ${avgWeeks}-week regional average.`,
  };
}

function buildClaimFrequency(r: IndividualClaimRecord, h: number, inj: ResolvedInjury): IsoFlagCard {
  const claimant = r.insuredName?.trim() || 'The claimant';
  const employer1 = r.employerName?.trim() || pick(FALLBACK_EMPLOYERS, h, 51);
  const employer2 = pick(FALLBACK_EMPLOYERS, h, 53);
  const claimCount = 3 + (h % 2);

  return {
    flagType: 'ClaimFrequency',
    matches: [
      { isoFileNumber: isoFileNumber(h, 35), fields: [
        { label: 'Date of Loss',          value: daysAgo(240 + (h % 60)) },
        { label: 'Claim Number',          value: `BIN${String(300000 + (h % 600000))}` },
        { label: 'Employer',              value: employer1 },
        { label: 'Insuring Company',      value: pick(INSURING_COMPANIES, h, 43) },
        { label: 'Policy Number / Type',  value: `${pick(FALLBACK_STATES, h, 14).code}WC${String(300000 + (h % 600000)).slice(0, 6)} · Workers Compensation` },
        { label: 'Coverage / Loss Type',  value: 'Indemnity / Medical' },
        { label: 'Alleged Injury',        value: inj.alleged },
        { label: 'Part of Body',          value: inj.bodyPart },
        { label: 'Claim Status',          value: 'CLOSED' },
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 45) },
      ] },
      { isoFileNumber: isoFileNumber(h, 39), fields: [
        { label: 'Date of Loss',          value: daysAgo(120 + (h % 60)) },
        { label: 'Claim Number',          value: `BIN${String(400000 + (h % 600000))}` },
        { label: 'Employer',              value: employer2 },
        { label: 'Insuring Company',      value: pick(INSURING_COMPANIES, h, 47) },
        { label: 'Policy Number / Type',  value: `${pick(FALLBACK_STATES, h, 16).code}WC${String(400000 + (h % 600000)).slice(0, 6)} · Workers Compensation` },
        { label: 'Coverage / Loss Type',  value: 'Indemnity / Medical' },
        { label: 'Alleged Injury',        value: inj.alleged },
        { label: 'Part of Body',          value: inj.bodyPart },
        { label: 'Claim Status',          value: 'CLOSED' },
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 49) },
      ] },
    ],
    flagHeading: FLAG_META.ClaimFrequency.heading,
    flagDescription: FLAG_META.ClaimFrequency.description,
    claimSpecificInsight:
      `${claimant} has filed ${claimCount} workers' comp claims across ${employer1} and ${employer2}, most recently this ${inj.alleged.toLowerCase()} claim.`,
  };
}

const BUILDERS: Record<IsoFlagType, (r: IndividualClaimRecord, h: number, inj: ResolvedInjury) => IsoFlagCard> = {
  PriorClaimsHistory:                  buildPriorClaimsHistory,
  SharedLegalRepresentation:           buildSharedLegalRepresentation,
  EmployerClaimClustering:             buildEmployerClaimClustering,
  EmployerFrequencySpike:              buildEmployerFrequencySpike,
  CrossJurisdictionMatch:              buildCrossJurisdictionMatch,
  TreatingProviderUtilizationOutlier:  buildTreatingProviderUtilizationOutlier,
  ClaimFrequency:                      buildClaimFrequency,
};

const ALL_FLAG_TYPES: IsoFlagType[] = [
  'PriorClaimsHistory', 'SharedLegalRepresentation', 'EmployerClaimClustering',
  'EmployerFrequencySpike', 'CrossJurisdictionMatch', 'TreatingProviderUtilizationOutlier', 'ClaimFrequency',
];

// Higher up this list = shown first when a claim has multiple flags stacked.
// Coordinated/legal patterns and provider billing risk lead (SIU-worthy);
// frequency-based, informational patterns trail.
const SIGNIFICANCE_ORDER: IsoFlagType[] = [
  'SharedLegalRepresentation',
  'EmployerClaimClustering',
  'TreatingProviderUtilizationOutlier',
  'PriorClaimsHistory',
  'CrossJurisdictionMatch',
  'EmployerFrequencySpike',
  'ClaimFrequency',
];
function bySignificance(a: IsoFlagType, b: IsoFlagType): number {
  return SIGNIFICANCE_ORDER.indexOf(a) - SIGNIFICANCE_ORDER.indexOf(b);
}

// Today's 4 real demo claims (see research notes) — used to guarantee a
// visible spread each session (no match / 1 flag / 2 stacked flags); any
// other/future claim number is assigned purely by the random session seed.
const KNOWN_CLAIM_NUMBERS = ['WCM-2026-007', 'WCM-2026-100001', 'WCM-2026-008', 'WCM-2026-006'];

// Rolled once and persisted in localStorage — NOT re-rolled on every page
// refresh (a plain module-level Math.random() would reshuffle on every
// reload, since the whole bundle re-executes then). Same browser/device
// keeps the same seed — and therefore the same claim → flag assignment —
// across any number of refreshes, until localStorage is cleared or a
// different browser/device is used.
const SESSION_SEED_STORAGE_KEY = 'iso-claimsearch-seed';
function resolveSessionSeed(): number {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(SESSION_SEED_STORAGE_KEY);
      const parsed = stored ? Number(stored) : NaN;
      if (Number.isFinite(parsed)) return parsed >>> 0;
      const fresh = Math.floor(Math.random() * 0xffffffff) >>> 0;
      window.localStorage.setItem(SESSION_SEED_STORAGE_KEY, String(fresh));
      return fresh;
    }
  } catch {
    // localStorage unavailable (privacy mode, SSR, etc.) — fall through.
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
const SESSION_SEED = resolveSessionSeed();

function sessionHash(claimNumber: string): number {
  return (djb2(claimNumber) ^ SESSION_SEED) >>> 0;
}

// Deterministic Fisher-Yates shuffle, seeded — same seed always produces the
// same order, but a different SESSION_SEED (new browser/localStorage) shuffles it.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Guarantees, every session, exactly one of the 4 known demo claims shows no
// match, exactly one shows 2 stacked flags, and the remaining two show 1
// flag — which specific claim lands in which bucket is reshuffled per
// SESSION_SEED. (Whether an individual flag itself has 1 or 2 match records
// is a separate, natural side effect of which flag type gets picked —
// EmployerFrequencySpike/ClaimFrequency always carry 2.)
type ClaimCategory = 'none' | 'double' | 'single';
const CATEGORY_TEMPLATE: ClaimCategory[] = ['none', 'double', 'single', 'single'];
const shuffledCategories = seededShuffle(CATEGORY_TEMPLATE, SESSION_SEED);
const CLAIM_CATEGORY: Record<string, ClaimCategory> = {};
KNOWN_CLAIM_NUMBERS.forEach((claimNumber, i) => { CLAIM_CATEGORY[claimNumber] = shuffledCategories[i]; });

// For any other/future claim number — pure random, small chance of no match.
const NO_MATCH_WEIGHT = 1;

/** Returns this claim's ISO ClaimSearch data (1–2 stacked flags), or null if the claim has no ISO match. */
export function getIsoClaimSearchData(record: IndividualClaimRecord | null | undefined): IsoClaimSearchData | null {
  if (!record?.claimNumber) return null;

  const h = sessionHash(record.claimNumber);
  const category = CLAIM_CATEGORY[record.claimNumber];

  let flagTypes: IsoFlagType[];
  if (category === 'none') {
    flagTypes = [];
  } else if (category === 'double') {
    const first = pick(ALL_FLAG_TYPES, h, 41);
    let second = pick(ALL_FLAG_TYPES, h, 57);
    if (second === first) second = ALL_FLAG_TYPES[(ALL_FLAG_TYPES.indexOf(second) + 1) % ALL_FLAG_TYPES.length];
    flagTypes = [first, second];
  } else if (category === 'single') {
    flagTypes = [pick(ALL_FLAG_TYPES, h, 41)];
  } else {
    const pool: (IsoFlagType | null)[] = [...ALL_FLAG_TYPES, ...Array(NO_MATCH_WEIGHT).fill(null)];
    const picked = pick(pool, h, 41);
    flagTypes = picked === null ? [] : [picked];
  }

  if (flagTypes.length === 0) return null;
  flagTypes = [...flagTypes].sort(bySignificance);

  const inj = resolveInjury(record);
  const flags = flagTypes.map(ft => BUILDERS[ft](record, h, inj));

  // Flag any match whose own "Date of Loss" field lands on the exact same
  // date as this claim's real lossDate — the panel's most visually
  // prominent element (see FLAG_META/CSS), not just "close together".
  const currentLossDate = record.lossDate?.trim();
  if (currentLossDate) {
    for (const card of flags) {
      for (const match of card.matches) {
        const dolField = match.fields.find(f => f.label === 'Date of Loss');
        if (dolField && dolField.value === currentLossDate) match.sameDayAsCurrent = true;
      }
    }
  }

  return {
    claimantName: record.insuredName?.trim() || 'The claimant',
    maskedId: maskedId(h),
    flags,
    currentClaimNumber:  record.claimNumber ?? '',
    currentPolicyNumber: record.policyNumber?.trim() || '—',
    currentClaimStatus:  record.claimStatus?.trim() || '—',
    currentJurisdiction: record.jurisdiction?.trim() || '—',
    currentLossDate:     record.lossDate?.trim() || '—',
  };
}
