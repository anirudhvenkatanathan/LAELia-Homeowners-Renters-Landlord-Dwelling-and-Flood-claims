// Deterministic claim summary mock data — keyed by claim number.
// Same claimNumber always produces the same summary; add new pool entries to expand variety.
// Property lines (Homeowners, Renters, Landlord, Dwelling, Flood) — Florida.

export interface ClaimSummaryItem {
  text: string;
  popup: { source: string; comparedAgainst: string; fetched: string };
}

export interface ClaimSignal {
  text: string;
  badge: string;
  variant: 'duration' | 'reserve' | 'lae';
  popup: { source: string; comparedAgainst: string; fetched: string };
}

export interface ClaimSummaryData {
  items: ClaimSummaryItem[];
  signals: ClaimSignal[];
  footerNote: string;
  // The loss this claim number deterministically resolved to — exposed so
  // other mock-data modules (e.g. ISO ClaimSearch) can reuse the exact same
  // value instead of picking their own, independently-hashed one, so every
  // section on the page describing "this claim's loss" agrees.
  loss: { label: string; policyForm: string; area: string; description: string };
}

// ─── Data pools ───────────────────────────────────────────────────────────────

interface County { county: string; area: string; }
const COUNTIES: County[] = [
  { county: 'Miami-Dade',   area: 'coastal southeast Florida' },
  { county: 'Broward',      area: 'coastal southeast Florida' },
  { county: 'Palm Beach',   area: 'coastal southeast Florida' },
  { county: 'Hillsborough', area: 'Tampa Bay'                 },
  { county: 'Pinellas',     area: 'Tampa Bay'                 },
  { county: 'Orange',       area: 'central Florida'           },
  { county: 'Lee',          area: 'southwest Florida'         },
  { county: 'Collier',      area: 'southwest Florida'         },
  { county: 'Duval',        area: 'northeast Florida'         },
  { county: 'Polk',         area: 'central Florida'           },
  { county: 'Volusia',      area: 'east-central Florida'      },
  { county: 'Brevard',      area: 'Space Coast'               },
  { county: 'Sarasota',     area: 'southwest Florida'         },
  { county: 'Charlotte',    area: 'southwest Florida'         },
  { county: 'Monroe',       area: 'Florida Keys'              },
];

interface LossData {
  description: string;
  policyForm: string;
  label: string;
  area: string;
  resolutionWeeks: string;
  laeOpportunity: string;
}
const LOSSES: LossData[] = [
  {
    description: 'water damage to the kitchen and adjoining rooms from a burst supply line',
    policyForm: 'HO3', label: 'water damage', area: 'Kitchen, Dining room', resolutionWeeks: '6–10',
    laeOpportunity: '24/7 mitigation within 24 hours limits secondary damage — dispatch drying contractor before estimate review.',
  },
  {
    description: 'wind damage to the roof covering with interior water intrusion',
    policyForm: 'HO3', label: 'wind damage', area: 'Roof, Attic', resolutionWeeks: '8–14',
    laeOpportunity: 'Roof age and payment-schedule terms drive severity — early roof surface review prevents over-payment.',
  },
  {
    description: 'hurricane wind and rain damage to the roof, windows and interior',
    policyForm: 'HO5', label: 'hurricane damage', area: 'Roof, Windows, Interior', resolutionWeeks: '14–26',
    laeOpportunity: 'Catastrophe event — CAT response team and surge capacity should be engaged before volume peaks.',
  },
  {
    description: 'flood damage to the ground floor from storm surge',
    policyForm: 'SFIP', label: 'flood damage', area: 'Ground floor, Utilities', resolutionWeeks: '10–20',
    laeOpportunity: 'NFIP authorised adjuster and early proof-of-loss follow-up keep the 60-day deadline on track.',
  },
  {
    description: 'fire damage originating in the kitchen with smoke throughout the home',
    policyForm: 'HO3', label: 'fire damage', area: 'Kitchen, Living areas', resolutionWeeks: '16–28',
    laeOpportunity: 'Cause and origin specialist plus pack-out and contents cleaning should start within 3 days.',
  },
  {
    description: 'hail damage to the roof and exterior gutters',
    policyForm: 'DF3-DO', label: 'hail damage', area: 'Roof, Gutters', resolutionWeeks: '6–10',
    laeOpportunity: 'Estimate and invoice review plus roof surface assessment recommended before approving full replacement.',
  },
  {
    description: 'theft of personal property following a forced entry',
    policyForm: 'HO4', label: 'theft', area: 'Bedroom, Living room', resolutionWeeks: '4–8',
    laeOpportunity: 'Contents inventory and valuation with police report verification should be completed within 14 days.',
  },
  {
    description: 'tenant-caused water leak damaging a rental unit',
    policyForm: 'DF3-DL', label: 'water leak', area: 'Bathroom, Unit below', resolutionWeeks: '6–12',
    laeOpportunity: 'Subrogation against the responsible tenant should be evaluated before payment is finalized.',
  },
  {
    description: 'tree fall through the roof during a tropical storm',
    policyForm: 'HO3', label: 'tree impact', area: 'Roof, Bedroom', resolutionWeeks: '8–14',
    laeOpportunity: 'Emergency tarping and temporary housing review within 48 hours reduces loss-of-use exposure.',
  },
  {
    description: 'mold growth following a slow leak in the bathroom wall',
    policyForm: 'HO6', label: 'mold damage', area: 'Bathroom, Hallway', resolutionWeeks: '8–16',
    laeOpportunity: 'Coverage verification and a mold remediation protocol should be settled before work begins.',
  },
  {
    description: 'lightning strike causing electrical and appliance damage',
    policyForm: 'HO3', label: 'lightning damage', area: 'Electrical panel, Appliances', resolutionWeeks: '4–8',
    laeOpportunity: 'Electrical inspection and appliance repair-versus-replace review can close this claim quickly.',
  },
  {
    description: 'water damage to a vacant dwelling from an unnoticed pipe failure',
    policyForm: 'DF1', label: 'vacancy water loss', area: 'Entire dwelling', resolutionWeeks: '10–18',
    laeOpportunity: 'Vacancy review is needed — policy conditions may limit coverage after 60 days vacant.',
  },
];

interface ReserveData {
  amount: string;
  amountK: string;
  priorPayments: string;
  benchmarkNote: string;
  action: string;
}
const RESERVES: ReserveData[] = [
  { amount: '$18,500',  amountK: '$18.5K', priorPayments: '$2,500',  benchmarkNote: 'aligns with the county median',                  action: 'reassess if drying extends beyond 10 days'            },
  { amount: '$42,000',  amountK: '$42K',   priorPayments: '$6,000',  benchmarkNote: 'is above the county median by 15%',              action: 'estimate review recommended before approval'           },
  { amount: '$96,000',  amountK: '$96K',   priorPayments: '$15,000', benchmarkNote: 'is within the hurricane high-severity band',     action: 'reserve adequacy review recommended at 60 days'        },
  { amount: '$27,750',  amountK: '$27.8K', priorPayments: '$3,500',  benchmarkNote: 'is below the regional median — may be under-reserved', action: 'reassess reserve at the 30-day mark'            },
  { amount: '$64,000',  amountK: '$64K',   priorPayments: '$9,500',  benchmarkNote: 'aligns with the fire-loss benchmark',            action: 'monitor contents and loss-of-use for growth'           },
  { amount: '$215,000', amountK: '$215K',  priorPayments: '$40,000', benchmarkNote: 'reflects total-loss severity classification',    action: 'ICC and limits exposure should be reviewed'            },
  { amount: '$9,800',   amountK: '$9.8K',  priorPayments: '$1,200',  benchmarkNote: 'is within the low-severity range',               action: 'conservative handling is appropriate'                  },
  { amount: '$73,400',  amountK: '$73.4K', priorPayments: '$14,200', benchmarkNote: 'is 12% above the regional average',              action: 'contractor estimate should be reconciled by week 4'    },
  { amount: '$31,200',  amountK: '$31.2K', priorPayments: '$4,100',  benchmarkNote: 'is within the roof-replacement band',            action: 'roof payment schedule should be confirmed'             },
  { amount: '$152,000', amountK: '$152K',  priorPayments: '$32,000', benchmarkNote: 'exceeds the county CAT median by 22%',           action: 'engage CAT response team and confirm deductible'       },
];

// Offsets (days before "today"), not fixed calendar dates — so the intake
// date shown always stays recent no matter when this mock data is viewed,
// instead of drifting further into the past as real time moves on. Kept
// within a 2-3 day window so every claim reads as "just intaken".
interface BaseDateOffset { offsetDays: number; hour: number; min: number; }
const BASE_DATE_OFFSETS: BaseDateOffset[] = [
  { offsetDays: 2, hour: 9,  min: 0  },
  { offsetDays: 3, hour: 10, min: 14 },
  { offsetDays: 2, hour: 8,  min: 45 },
  { offsetDays: 3, hour: 11, min: 30 },
  { offsetDays: 2, hour: 9,  min: 55 },
  { offsetDays: 3, hour: 14, min: 22 },
  { offsetDays: 2, hour: 8,  min: 10 },
  { offsetDays: 3, hour: 13, min: 5  },
];

interface BaseDateEntry { date: string; hour: number; min: number; }

// ─── Utilities ────────────────────────────────────────────────────────────────

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(arr: T[], h: number, salt: number): T {
  return arr[((h * salt) >>> 0) % arr.length];
}

function resolveBaseDate(offset: BaseDateOffset): BaseDateEntry {
  const d = new Date();
  d.setDate(d.getDate() - offset.offsetDays);
  return { date: d.toISOString().slice(0, 10), hour: offset.hour, min: offset.min };
}

function makeTs(d: BaseDateEntry, offsetMin: number): string {
  const total = d.hour * 60 + d.min + offsetMin;
  const hh    = Math.floor(total / 60) % 24;
  const mm    = total % 60;
  return `Intake · ${d.date} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function getClaimSummaryData(
  claimNumber: string,
  insuredName?: string | null,
  realCauseOfLoss?: string | null,
  realDamagedAreas?: string | null,
): ClaimSummaryData {
  const h        = djb2(claimNumber || 'default');
  const jx       = pick(COUNTIES,   h, 7);
  const baseLoss = pick(LOSSES,     h, 11);
  const reserve  = pick(RESERVES,   h, 17);
  const base     = resolveBaseDate(pick(BASE_DATE_OFFSETS, h, 23));
  const insured  = insuredName?.trim() || 'The insured';

  // When the claim record carries a real cause of loss, it takes precedence
  // over the hashed mock pick — every section that describes "this claim's
  // loss" (Claims Summary here, and ISO ClaimSearch via the returned `loss`
  // field) must agree with the claim's own real data when it exists.
  const realLabel = realCauseOfLoss?.trim();
  const realPart  = realDamagedAreas?.trim();
  const loss: LossData = realLabel
    ? {
        ...baseLoss,
        label:       realLabel.toLowerCase(),
        area:        realPart || baseLoss.area,
        description: realPart ? `${realLabel.toLowerCase()} affecting the ${realPart.toLowerCase()}` : realLabel.toLowerCase(),
      }
    : baseLoss;

  const ts = (offset: number) => makeTs(base, offset);

  const items: ClaimSummaryItem[] = [
    {
      text: `${insured} holds a ${loss.policyForm} policy for a property in ${jx.county} County, Florida.`,
      popup: {
        source:          'Policy data',
        comparedAgainst: `Policy records · ${loss.policyForm} · ${jx.county} County`,
        fetched:          ts(0),
      },
    },
    {
      text: `Claim number ${claimNumber} is open in ${jx.county} County (${jx.area}).`,
      popup: {
        source:          'Policy data',
        comparedAgainst: `Florida claim-handling timelines (s. 627.70131)`,
        fetched:          ts(1),
      },
    },
    {
      text: `The reported loss is ${loss.description}.`,
      popup: {
        source:          'Policy data',
        comparedAgainst: `${loss.label} loss profiles · ${jx.county} County`,
        fetched:          ts(1),
      },
    },
    {
      text: `Total reserve is set at ${reserve.amount} with prior payments totaling ${reserve.priorPayments}.`,
      popup: {
        source:          'Policy data',
        comparedAgainst: `${jx.county} County ${loss.label} reserve averages`,
        fetched:          ts(2),
      },
    },
  ];

  const signals: ClaimSignal[] = [
    {
      text:    `${cap(loss.label)} in ${jx.area} typically resolves within ${loss.resolutionWeeks} weeks — monitor for extension.`,
      badge:   'Duration Risk · High',
      variant: 'duration',
      popup: {
        source:          'Internal cycle-time benchmarks (demo data)',
        comparedAgainst: `${loss.label} cycle time · ${jx.county} County`,
        fetched:          ts(3),
      },
    },
    {
      text:    `Total reserve of ${reserve.amountK} ${reserve.benchmarkNote} — ${reserve.action}.`,
      badge:   'Reserve Risk · High',
      variant: 'reserve',
      popup: {
        source:          'Regional property reserve benchmarks (demo data)',
        comparedAgainst: `${jx.county} County ${loss.label} severity benchmarks`,
        fetched:          ts(3),
      },
    },
    {
      text:    loss.laeOpportunity,
      badge:   'LAE Opportunity · High',
      variant: 'lae',
      popup: {
        source:          'Internal LAE playbook (demo data)',
        comparedAgainst: `${jx.county} County ${loss.label} intervention outcomes`,
        fetched:          ts(4),
      },
    },
  ];

  const footerNote = `Generated by Intake Agent · ${loss.policyForm} · ${jx.county} County ${loss.label} benchmarks · ${base.date}`;

  return {
    items, signals, footerNote,
    loss: { label: loss.label, policyForm: loss.policyForm, area: loss.area, description: loss.description },
  };
}
