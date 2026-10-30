// ISO ClaimSearch mock data — a claim can carry 1 or 2 flags (stacked, most
// significant first), each built from the claim's own real fields
// (claimNumber, insuredName, causeOfLoss, damagedAreas, jurisdiction,
// policyNumber, lossDate, claimStatus, propertyAddress, assignedAdjuster,
// contractorName, vendorServices) wherever they're populated, falling back to
// deterministic generated values only where the real claim record has nothing
// for that field. Every match record refers only to THIS claim's own insured —
// no other/fictional insured names are ever introduced, so "Insured" always
// reads the same as the claim's real Insured Name. The loss fallback reuses
// claimSummaryMockData's own resolved loss for this claim number, so the
// Q-AI "Claims Summary" section and this ISO section never disagree about
// what the claim's loss is. Not a live ISO ClaimSearch lookup — mock data
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
  | 'SharedRepresentation'
  | 'PropertyClaimClustering'
  | 'PropertyFrequencySpike'
  | 'CrossCarrierMatch'
  | 'ContractorUtilizationOutlier'
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
    description: 'Prior claim for the same cause of loss and area at this property — may be pre-existing or previously paid damage, not a new loss.',
  },
  SharedRepresentation: {
    heading: 'SHARED REPRESENTATION',
    description: 'Same public adjuster or attorney representing this insured on a separate, similar claim filed close together — possible coordinated activity.',
  },
  PropertyClaimClustering: {
    heading: 'PROPERTY CLAIM CLUSTERING',
    description: 'Another claim at the same property address with the same representation, filed within a short timeframe.',
  },
  PropertyFrequencySpike: {
    heading: 'PROPERTY FREQUENCY SPIKE',
    description: 'Multiple claims at the same property within one policy term — a frequency pattern worth reviewing.',
  },
  CrossCarrierMatch: {
    heading: 'CROSS-CARRIER MATCH',
    description: 'Another open claim exists for the same property and loss date with a different carrier — review to prevent duplicate payment.',
  },
  ContractorUtilizationOutlier: {
    heading: 'CONTRACTOR UTILIZATION OUTLIER',
    description: 'Contractor appears on multiple claims with estimates and repair durations well above regional averages.',
  },
  ClaimFrequency: {
    heading: 'CLAIM FREQUENCY',
    description: 'Insured has filed more property claims than peers over a comparable period — raises overall risk profile.',
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

const FALLBACK_ADDRESSES = [
  '1420 Palmetto Ave, Tampa, FL', '88 Seabreeze Dr, Naples, FL', '305 Coral Way, Miami, FL',
  '2210 Magnolia Ln, Jacksonville, FL', '47 Heron Cove, Sarasota, FL', '915 Sawgrass Ct, Orlando, FL',
];
const POLICY_FORMS = [
  { code: 'HO3', label: 'Homeowners (HO3)' }, { code: 'HO5', label: 'Homeowners (HO5)' },
  { code: 'HO6', label: 'Condo (HO6)' }, { code: 'HO4', label: 'Renters (HO4)' },
  { code: 'DF3', label: 'Dwelling Fire (DF3)' }, { code: 'SFIP', label: 'Flood (SFIP)' },
];
const INSURING_COMPANIES = [
  'Palmetto Shield Insurance', 'Gulfstream Mutual', 'Sunshine State Underwriters',
  'Bayview Underwriters', 'Atlantic Coast Casualty', 'Everglades Indemnity Co.',
];
const ADJUSTERS = [
  'Delgado, Marisol', 'Chen, Kevin', 'Whitfield, Renee', 'Brooks, Tamika', 'Alvarez, Diego', 'Nakamura, Sarah',
];
const REPRESENTATIVES = [
  'Gulf Coast Claims Advocates (public adjuster)', 'Sunrise Public Adjusting (public adjuster)',
  'Halloway & Associates, Attorneys at Law', 'Whitmore Legal Group, Attorneys at Law',
];
const CONTRACTORS = [
  'Palm Coast Restoration', 'Bayshore Roofing & Exteriors', 'Sunstate Water Mitigation', 'Keystone Builders of Florida',
];

function policyPeriod(lossDateIso: string): string {
  const d = lossDateIso ? new Date(lossDateIso) : new Date();
  const start = new Date(d); start.setMonth(start.getMonth() - 6);
  const end   = new Date(d); end.setMonth(end.getMonth() + 6);
  return `${start.toISOString().slice(0, 7)}-01 – ${end.toISOString().slice(0, 7)}-01`;
}

function policyLabel(h: number, salt: number, base: number): string {
  const f = pick(POLICY_FORMS, h, salt);
  return `FL${f.code}-${String(base + (h % 100000)).slice(0, 6)} · ${f.label}`;
}

// Resolves this claim's cause of loss / damaged area from the exact same
// source claimSummaryMockData.ts uses (real record fields when present,
// otherwise its hashed mock pick) — never an independently-generated value, so
// the Claims Summary section and this panel always agree.
interface ResolvedLoss { cause: string; area: string; }
function resolveLoss(r: IndividualClaimRecord): ResolvedLoss {
  const summary = getClaimSummaryData(r.claimNumber ?? '', r.insuredName, r.causeOfLoss, r.damagedAreas);
  return { cause: summary.loss.label, area: summary.loss.area };
}

// ─── Per-flag builders — every match refers only to this claim's own insured ──
// Each returns one IsoFlagCard; insured/current-claim fields are assembled
// once at the top level (getIsoClaimSearchData), not duplicated per card.

function lossFields(loss: ResolvedLoss): IsoMatchField[] {
  return [
    { label: 'Cause of Loss', value: loss.cause },
    { label: 'Damaged Area',  value: loss.area },
  ];
}

function buildPriorClaimsHistory(r: IndividualClaimRecord, h: number, loss: ResolvedLoss): IsoFlagCard {
  const insured = r.insuredName?.trim() || 'The insured';
  const address = r.propertyAddress?.trim() || pick(FALLBACK_ADDRESSES, h, 13);
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
        { label: 'Policy Number / Type',  value: policyLabel(h, 2, 100000) },
        { label: 'Policy Period',         value: policyPeriod(priorDol) },
        { label: 'Claim Status',          value: 'CLOSED' },
        { label: 'Coverage / Loss Type',  value: 'Dwelling / Contents' },
        ...lossFields(loss),
        { label: 'Property Address',      value: address },
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 15) },
        { label: 'Matched On',            value: 'Name, Property Address' },
      ],
    }],
    flagHeading: FLAG_META.PriorClaimsHistory.heading,
    flagDescription: FLAG_META.PriorClaimsHistory.description,
    claimSpecificInsight:
      `${insured} has a prior closed claim for the same area (${loss.area.toLowerCase()}) at ${address}, `
      + `filed ~${monthsAgo} months earlier — current claim: ${loss.cause.toLowerCase()}, ${r.claimStatus?.trim() || 'open'}.`,
  };
}

function buildSharedRepresentation(r: IndividualClaimRecord, h: number, loss: ResolvedLoss): IsoFlagCard {
  const insured = r.insuredName?.trim() || 'The insured';
  const rep = pick(REPRESENTATIVES, h, 11);
  const legalVendor = r.vendorServices?.find(v => /legal|public adjuster/i.test(v));
  const repLine = legalVendor ? `${rep} (via ${legalVendor})` : rep;
  const address = pick(FALLBACK_ADDRESSES, h, 6);
  const daysApart = 14 + (h % 15);

  return {
    flagType: 'SharedRepresentation',
    matches: [{
      isoFileNumber: isoFileNumber(h, 4),
      fields: [
        { label: 'Date of Loss',          value: daysAgo(daysApart) },
        { label: 'Claim Number',          value: `BIN${String(150000 + (h % 850000))}` },
        { label: 'Representative',        value: repLine },
        { label: 'Insuring Company',      value: pick(INSURING_COMPANIES, h, 17) },
        { label: 'Policy Number / Type',  value: policyLabel(h, 6, 150000) },
        { label: 'Policy Period',         value: policyPeriod(daysAgo(daysApart)) },
        { label: 'Claim Status',          value: 'OPEN' },
        { label: 'Coverage / Loss Type',  value: 'Dwelling / Contents' },
        { label: 'Property Address',      value: address },
        ...lossFields(loss),
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 19) },
        { label: 'Matched On',            value: 'Representative of Record' },
      ],
    }],
    flagHeading: FLAG_META.SharedRepresentation.heading,
    flagDescription: FLAG_META.SharedRepresentation.description,
    claimSpecificInsight:
      `${repLine} also represents ${insured} on a separate ${loss.cause.toLowerCase()} claim at ${address}, filed within ${daysApart} days of this claim.`,
  };
}

function buildPropertyClaimClustering(r: IndividualClaimRecord, h: number, loss: ResolvedLoss): IsoFlagCard {
  const insured = r.insuredName?.trim() || 'The insured';
  const address = r.propertyAddress?.trim() || pick(FALLBACK_ADDRESSES, h, 4);
  const rep = pick(REPRESENTATIVES, h, 12);
  const d1 = daysAgo(9 + (h % 8));

  return {
    flagType: 'PropertyClaimClustering',
    matches: [{
      isoFileNumber: isoFileNumber(h, 5),
      fields: [
        { label: 'Date of Loss',          value: d1 },
        { label: 'Claim Number',          value: `BIN${String(160000 + (h % 840000))}` },
        { label: 'Property Address',      value: address },
        { label: 'Representative',        value: rep },
        { label: 'Insuring Company',      value: pick(INSURING_COMPANIES, h, 21) },
        { label: 'Policy Number / Type',  value: policyLabel(h, 8, 160000) },
        { label: 'Policy Period',         value: policyPeriod(d1) },
        { label: 'Claim Status',          value: 'OPEN' },
        { label: 'Coverage / Loss Type',  value: 'Dwelling / Contents' },
        ...lossFields(loss),
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 23) },
        { label: 'Matched On',            value: 'Property Address + Representative of Record' },
      ],
    }],
    flagHeading: FLAG_META.PropertyClaimClustering.heading,
    flagDescription: FLAG_META.PropertyClaimClustering.description,
    claimSpecificInsight:
      `${insured} has another claim at ${address} with the same representative (${rep}), filed within weeks of this ${loss.cause.toLowerCase()} claim.`,
  };
}

function buildPropertyFrequencySpike(r: IndividualClaimRecord, h: number, loss: ResolvedLoss): IsoFlagCard {
  const insured = r.insuredName?.trim() || 'The insured';
  const address = r.propertyAddress?.trim() || pick(FALLBACK_ADDRESSES, h, 8);
  const period = policyPeriod(r.lossDate || daysAgo(30));

  return {
    flagType: 'PropertyFrequencySpike',
    matches: [
      { isoFileNumber: isoFileNumber(h, 14), fields: [
        { label: 'Date of Loss', value: daysAgo(11 + (h % 6)) },
        { label: 'Claim Number', value: `BIN${String(170000 + (h % 830000))}` },
        { label: 'Property Address', value: address },
        { label: 'Insuring Company', value: pick(INSURING_COMPANIES, h, 27) },
        { label: 'Policy Period', value: period },
        { label: 'Claim Status', value: 'OPEN' },
        ...lossFields(loss),
        { label: 'Adjuster', value: pick(ADJUSTERS, h, 29) },
      ] },
      { isoFileNumber: isoFileNumber(h, 16), fields: [
        // The frequency spike's own premise is claims clustering in a short
        // window — deliberately landing this one on the exact same date of
        // loss as the current claim (when it has a real one) is a realistic,
        // stronger version of that pattern (e.g. one storm affecting several
        // structures on the property), not just "close together".
        { label: 'Date of Loss', value: r.lossDate?.trim() || daysAgo(24 + (h % 6)) },
        { label: 'Claim Number', value: `BIN${String(180000 + (h % 820000))}` },
        { label: 'Property Address', value: address },
        { label: 'Insuring Company', value: pick(INSURING_COMPANIES, h, 31) },
        { label: 'Policy Period', value: period },
        { label: 'Claim Status', value: 'CLOSED' },
        ...lossFields(loss),
        { label: 'Adjuster', value: pick(ADJUSTERS, h, 33) },
      ] },
    ],
    flagHeading: FLAG_META.PropertyFrequencySpike.heading,
    flagDescription: FLAG_META.PropertyFrequencySpike.description,
    claimSpecificInsight:
      `${insured} has 2 other matched claims at ${address} within the same policy term as this ${loss.cause.toLowerCase()} claim.`,
  };
}

function buildCrossCarrierMatch(r: IndividualClaimRecord, h: number, loss: ResolvedLoss): IsoFlagCard {
  const insured = r.insuredName?.trim() || 'The insured';
  const address = r.propertyAddress?.trim() || pick(FALLBACK_ADDRESSES, h, 9);
  const otherCarrier = pick(INSURING_COMPANIES, h, 25);
  const dol = r.lossDate?.trim() || daysAgo(18 + (h % 20));

  return {
    flagType: 'CrossCarrierMatch',
    matches: [{
      isoFileNumber: isoFileNumber(h, 21),
      fields: [
        { label: 'Date of Loss',          value: dol },
        { label: 'Claim Number',          value: `BIN${String(200000 + (h % 700000))}` },
        { label: 'Insuring Company',      value: otherCarrier },
        { label: 'Policy Number / Type',  value: policyLabel(h, 14, 200000) },
        { label: 'Policy Period',         value: policyPeriod(dol) },
        { label: 'Coverage / Loss Type',  value: 'Dwelling / Contents' },
        { label: 'Claim Status',          value: 'OPEN — Active Payment' },
        { label: 'Property Address',      value: address },
        ...lossFields(loss),
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 37) },
        { label: 'Matched On',            value: 'Name, Property Address, Date of Loss' },
      ],
    }],
    flagHeading: FLAG_META.CrossCarrierMatch.heading,
    flagDescription: FLAG_META.CrossCarrierMatch.description,
    claimSpecificInsight:
      `${insured} has an open ${loss.cause.toLowerCase()} claim with ${otherCarrier} for ${address} on the same loss date as this claim — verify no duplicate payment.`,
  };
}

function buildContractorUtilizationOutlier(r: IndividualClaimRecord, h: number, loss: ResolvedLoss): IsoFlagCard {
  const insured = r.insuredName?.trim() || 'The insured';
  const contractor = r.contractorName?.trim() || pick(CONTRACTORS, h, 43);
  const address = r.propertyAddress?.trim() || pick(FALLBACK_ADDRESSES, h, 45);
  const avgWeeks = 4 + (h % 4);
  const dol = daysAgo(95 + (h % 30));

  return {
    flagType: 'ContractorUtilizationOutlier',
    matches: [{
      isoFileNumber: isoFileNumber(h, 29),
      fields: [
        { label: 'Date of Loss',          value: dol },
        { label: 'Claim Number',          value: `BIN${String(220000 + (h % 680000))}` },
        { label: 'Contractor',            value: contractor },
        { label: 'Property Address',      value: address },
        { label: 'Insuring Company',      value: pick(INSURING_COMPANIES, h, 39) },
        { label: 'Policy Number / Type',  value: policyLabel(h, 12, 220000) },
        ...lossFields(loss),
        { label: 'Repair Duration',       value: `${avgWeeks + 3 + (h % 5)} weeks (regional avg: ${avgWeeks} weeks)` },
        { label: 'Claim Status',          value: 'CLOSED' },
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 41) },
      ],
    }],
    flagHeading: FLAG_META.ContractorUtilizationOutlier.heading,
    flagDescription: FLAG_META.ContractorUtilizationOutlier.description,
    claimSpecificInsight:
      `${contractor} previously worked an earlier claim for ${insured} — estimates and durations trending above the ${avgWeeks}-week regional average.`,
  };
}

function buildClaimFrequency(r: IndividualClaimRecord, h: number, loss: ResolvedLoss): IsoFlagCard {
  const insured = r.insuredName?.trim() || 'The insured';
  const address1 = r.propertyAddress?.trim() || pick(FALLBACK_ADDRESSES, h, 51);
  const address2 = pick(FALLBACK_ADDRESSES, h, 53);
  const claimCount = 3 + (h % 2);

  return {
    flagType: 'ClaimFrequency',
    matches: [
      { isoFileNumber: isoFileNumber(h, 35), fields: [
        { label: 'Date of Loss',          value: daysAgo(240 + (h % 60)) },
        { label: 'Claim Number',          value: `BIN${String(300000 + (h % 600000))}` },
        { label: 'Property Address',      value: address1 },
        { label: 'Insuring Company',      value: pick(INSURING_COMPANIES, h, 43) },
        { label: 'Policy Number / Type',  value: policyLabel(h, 14, 300000) },
        { label: 'Coverage / Loss Type',  value: 'Dwelling / Contents' },
        ...lossFields(loss),
        { label: 'Claim Status',          value: 'CLOSED' },
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 45) },
      ] },
      { isoFileNumber: isoFileNumber(h, 39), fields: [
        { label: 'Date of Loss',          value: daysAgo(120 + (h % 60)) },
        { label: 'Claim Number',          value: `BIN${String(400000 + (h % 600000))}` },
        { label: 'Property Address',      value: address2 },
        { label: 'Insuring Company',      value: pick(INSURING_COMPANIES, h, 47) },
        { label: 'Policy Number / Type',  value: policyLabel(h, 16, 400000) },
        { label: 'Coverage / Loss Type',  value: 'Dwelling / Contents' },
        ...lossFields(loss),
        { label: 'Claim Status',          value: 'CLOSED' },
        { label: 'Adjuster',              value: pick(ADJUSTERS, h, 49) },
      ] },
    ],
    flagHeading: FLAG_META.ClaimFrequency.heading,
    flagDescription: FLAG_META.ClaimFrequency.description,
    claimSpecificInsight:
      `${insured} has filed ${claimCount} property claims across ${address1} and ${address2}, most recently this ${loss.cause.toLowerCase()} claim.`,
  };
}

const BUILDERS: Record<IsoFlagType, (r: IndividualClaimRecord, h: number, loss: ResolvedLoss) => IsoFlagCard> = {
  PriorClaimsHistory:           buildPriorClaimsHistory,
  SharedRepresentation:         buildSharedRepresentation,
  PropertyClaimClustering:      buildPropertyClaimClustering,
  PropertyFrequencySpike:       buildPropertyFrequencySpike,
  CrossCarrierMatch:            buildCrossCarrierMatch,
  ContractorUtilizationOutlier: buildContractorUtilizationOutlier,
  ClaimFrequency:               buildClaimFrequency,
};

const ALL_FLAG_TYPES: IsoFlagType[] = [
  'PriorClaimsHistory', 'SharedRepresentation', 'PropertyClaimClustering',
  'PropertyFrequencySpike', 'CrossCarrierMatch', 'ContractorUtilizationOutlier', 'ClaimFrequency',
];

// Higher up this list = shown first when a claim has multiple flags stacked.
// Coordinated/representation patterns and duplicate-payment risk lead
// (SIU-worthy); frequency-based, informational patterns trail.
const SIGNIFICANCE_ORDER: IsoFlagType[] = [
  'SharedRepresentation',
  'PropertyClaimClustering',
  'CrossCarrierMatch',
  'ContractorUtilizationOutlier',
  'PriorClaimsHistory',
  'PropertyFrequencySpike',
  'ClaimFrequency',
];
function bySignificance(a: IsoFlagType, b: IsoFlagType): number {
  return SIGNIFICANCE_ORDER.indexOf(a) - SIGNIFICANCE_ORDER.indexOf(b);
}

// The four anchor demo claims (one per major line, see seed) — used to
// guarantee a visible spread each session (no match / 1 flag / 2 stacked
// flags); any other claim number is assigned purely by the random session seed.
const KNOWN_CLAIM_NUMBERS = ['HO-2026-001', 'LL-2026-001', 'DW-2026-001', 'FL-2026-001'];

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
// PropertyFrequencySpike/ClaimFrequency always carry 2.)
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

  const loss = resolveLoss(record);
  const flags = flagTypes.map(ft => BUILDERS[ft](record, h, loss));

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
    claimantName: record.insuredName?.trim() || 'The insured',
    maskedId: maskedId(h),
    flags,
    currentClaimNumber:  record.claimNumber ?? '',
    currentPolicyNumber: record.policyNumber?.trim() || '—',
    currentClaimStatus:  record.claimStatus?.trim() || '—',
    currentJurisdiction: record.jurisdiction?.trim() || '—',
    currentLossDate:     record.lossDate?.trim() || '—',
  };
}
