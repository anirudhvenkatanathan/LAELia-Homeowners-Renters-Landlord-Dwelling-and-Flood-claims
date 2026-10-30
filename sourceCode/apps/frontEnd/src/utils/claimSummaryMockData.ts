// Deterministic claim summary mock data — keyed by claim number.
// Same claimNumber always produces the same summary; add new pool entries to expand variety.

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
  // The injury this claim number deterministically resolved to — exposed so
  // other mock-data modules (e.g. ISO ClaimSearch) can reuse the exact same
  // value instead of picking their own, independently-hashed one, so every
  // section on the page describing "this claim's injury" agrees.
  injury: { label: string; icd: string; bodyPart: string; description: string };
}

// ─── Data pools ───────────────────────────────────────────────────────────────

const EMPLOYERS = [
  'ABC Manufacturing Inc.',        'Pacific Construction LLC',      'Metro Health Systems',
  'Southern Logistics Co.',        'Allied Steel Works',            'Coastal Warehousing Corp.',
  'Tri-State Transport Ltd.',      'Peak Retail Group',             'Continental Foods Inc.',
  'Midwest Auto Parts Co.',        'Sunrise Hospitality Group',     'Atlantic Shipbuilding',
  'National Freight Services',     'Blue Ridge Mining Corp.',       'Summit Healthcare Network',
  'Heritage Farm Products',        'Cardinal Electric Co.',         'Horizon Distribution Inc.',
  'Pinnacle Security Services',    'Delta Chemical Corp.',
];

interface Jurisdiction { state: string; name: string; industry: string; }
const JURISDICTIONS: Jurisdiction[] = [
  { state: 'CA', name: 'California',     industry: 'manufacturing'  },
  { state: 'TX', name: 'Texas',          industry: 'construction'   },
  { state: 'FL', name: 'Florida',        industry: 'hospitality'    },
  { state: 'NY', name: 'New York',       industry: 'logistics'      },
  { state: 'IL', name: 'Illinois',       industry: 'warehousing'    },
  { state: 'PA', name: 'Pennsylvania',   industry: 'steel works'    },
  { state: 'OH', name: 'Ohio',           industry: 'auto parts'     },
  { state: 'GA', name: 'Georgia',        industry: 'distribution'   },
  { state: 'NC', name: 'North Carolina', industry: 'textiles'       },
  { state: 'MI', name: 'Michigan',       industry: 'automotive'     },
  { state: 'WA', name: 'Washington',     industry: 'healthcare'     },
  { state: 'AZ', name: 'Arizona',        industry: 'construction'   },
  { state: 'CO', name: 'Colorado',       industry: 'transportation' },
  { state: 'NJ', name: 'New Jersey',     industry: 'chemical'       },
  { state: 'VA', name: 'Virginia',       industry: 'mining'         },
];

interface InjuryData {
  description: string;
  icd: string;
  label: string;
  bodyPart: string;
  resolutionWeeks: string;
  laeOpportunity: string;
}
const INJURIES: InjuryData[] = [
  {
    description:    'lumbar strain to the lower back caused by lifting equipment',
    icd: 'M54.5',  label: 'lumbar strain',   bodyPart: 'Lumbar spine', resolutionWeeks: '12–16',
    laeOpportunity: 'Early FCE recommended for lumbar claims with lifting mechanism — intervention window is open.',
  },
  {
    description:    'rotator cuff tear to the right shoulder from repetitive overhead work',
    icd: 'M75.1',  label: 'rotator cuff tear', bodyPart: 'Right shoulder', resolutionWeeks: '16–24',
    laeOpportunity: 'Surgical referral for rotator cuff should be evaluated by week 8 — early orthopedic consult is cost-effective.',
  },
  {
    description:    'medial meniscus tear to the left knee sustained in a slip-and-fall',
    icd: 'M23.20', label: 'meniscus injury', bodyPart: 'Left knee', resolutionWeeks: '12–20',
    laeOpportunity: 'MRI-confirmed meniscus tear — arthroscopy referral within 6 weeks reduces long-term duration.',
  },
  {
    description:    'carpal tunnel syndrome in the right wrist from prolonged keyboard use',
    icd: 'G56.01', label: 'CTS',             bodyPart: 'Right wrist', resolutionWeeks: '8–12',
    laeOpportunity: 'Conservative splinting and nerve conduction study recommended — surgical candidacy to be assessed at 8 weeks.',
  },
  {
    description:    'cervical strain to the neck following a vehicle collision on site',
    icd: 'S13.4',  label: 'cervical strain', bodyPart: 'Neck', resolutionWeeks: '10–14',
    laeOpportunity: 'Cervical strain with collision mechanism — early physio referral within 2 weeks reduces chronicity risk.',
  },
  {
    description:    'fractured left wrist sustained when falling from a ladder',
    icd: 'S52.501A', label: 'wrist fracture', bodyPart: 'Left wrist', resolutionWeeks: '8–12',
    laeOpportunity: 'Fracture management — occupational therapy referral at 4–6 weeks post-cast removal is cost-effective.',
  },
  {
    description:    'herniated disc at L4–L5 resulting from a forklift incident',
    icd: 'M51.16', label: 'disc herniation', bodyPart: 'Lower back (L4–L5)', resolutionWeeks: '16–26',
    laeOpportunity: 'L4–L5 herniation — pain management specialist engagement recommended before surgical consideration.',
  },
  {
    description:    'bilateral knee aggravation from prolonged standing on the production floor',
    icd: 'M17.11', label: 'knee OA',         bodyPart: 'Bilateral knees', resolutionWeeks: '20–32',
    laeOpportunity: 'Bilateral knee aggravation — job modification review and FCE recommended to determine RTW capacity.',
  },
  {
    description:    'crush injury to the right hand from machinery entanglement',
    icd: 'S67.10XA', label: 'crush injury',  bodyPart: 'Right hand', resolutionWeeks: '14–20',
    laeOpportunity: 'Hand crush injury — early hand therapy referral within 2 weeks significantly improves functional outcomes.',
  },
  {
    description:    'chemical burns to the forearms sustained during solvent exposure',
    icd: 'T54.91XA', label: 'chemical burn', bodyPart: 'Forearms', resolutionWeeks: '6–10',
    laeOpportunity: 'Chemical burn — wound care specialist and burn nurse case management referral recommended within 7 days.',
  },
  {
    description:    'traumatic brain injury sustained in a warehouse vehicle accident',
    icd: 'S09.90XA', label: 'TBI',           bodyPart: 'Head', resolutionWeeks: '26–52',
    laeOpportunity: 'Moderate TBI — neuropsychological evaluation and catastrophic case management engagement recommended.',
  },
  {
    description:    'Achilles tendon rupture from stepping into an unguarded floor opening',
    icd: 'S86.011A', label: 'tendon rupture', bodyPart: 'Right ankle (Achilles)', resolutionWeeks: '20–28',
    laeOpportunity: 'Achilles rupture — surgical vs. conservative management decision point at 2 weeks is cost-critical.',
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
  { amount: '$37,000',   amountK: '$37K',    priorPayments: '$5,000',   benchmarkNote: 'aligns with CA median',                           action: 'reassess if PT extends beyond 8 weeks'                       },
  { amount: '$62,500',   amountK: '$62.5K',  priorPayments: '$8,200',   benchmarkNote: 'is above TX median by 18%',                       action: 'reserve adequacy review recommended at 90 days'               },
  { amount: '$115,000',  amountK: '$115K',   priorPayments: '$22,000',  benchmarkNote: 'is within the NY high-severity band',              action: 'surgical pathway costs should be modeled'                     },
  { amount: '$28,750',   amountK: '$28.75K', priorPayments: '$3,500',   benchmarkNote: 'is below FL median — may be under-reserved',       action: 'reassess reserve adequacy at 60-day mark'                     },
  { amount: '$84,000',   amountK: '$84K',    priorPayments: '$12,500',  benchmarkNote: 'aligns with IL construction benchmark',            action: 'monitor for extension beyond 16 weeks'                        },
  { amount: '$195,000',  amountK: '$195K',   priorPayments: '$45,000',  benchmarkNote: 'reflects catastrophic severity classification',    action: 'structured settlement evaluation recommended at 6 months'      },
  { amount: '$51,200',   amountK: '$51.2K',  priorPayments: '$9,800',   benchmarkNote: 'tracks with OH auto sector median',                action: 'IME recommended before 12-week mark'                          },
  { amount: '$73,400',   amountK: '$73.4K',  priorPayments: '$14,200',  benchmarkNote: 'is 12% above GA distribution average',            action: 'FCE results should drive RTW decision by week 14'             },
  { amount: '$22,000',   amountK: '$22K',    priorPayments: '$2,100',   benchmarkNote: 'is within AZ low-severity range',                  action: 'conservative management is appropriate — monitor bi-weekly'   },
  { amount: '$142,000',  amountK: '$142K',   priorPayments: '$38,000',  benchmarkNote: 'exceeds MI automotive median by 28%',              action: 'nurse case management engagement is recommended immediately'   },
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
  realInjuryType?: string | null,
  realBodyPart?: string | null,
): ClaimSummaryData {
  const h        = djb2(claimNumber || 'default');
  const employer = pick(EMPLOYERS,    h, 3);
  const jx       = pick(JURISDICTIONS, h, 7);
  const baseInjury = pick(INJURIES,   h, 11);
  const reserve  = pick(RESERVES,     h, 17);
  const base     = resolveBaseDate(pick(BASE_DATE_OFFSETS, h, 23));
  const claimant = insuredName?.trim() || 'The claimant';

  // When the claim record carries a real injury type, it takes precedence
  // over the hashed mock pick — every section that describes "this claim's
  // injury" (Claims Summary here, and ISO ClaimSearch via the returned
  // `injury` field) must agree with the claim's own real data when it exists.
  const realLabel = realInjuryType?.trim();
  const realPart  = realBodyPart?.trim();
  const injury: InjuryData = realLabel
    ? {
        ...baseInjury,
        label:       realLabel.toLowerCase(),
        bodyPart:    realPart || baseInjury.bodyPart,
        description: realPart ? `${realLabel.toLowerCase()} to the ${realPart.toLowerCase()}` : realLabel.toLowerCase(),
      }
    : baseInjury;

  const ts = (offset: number) => makeTs(base, offset);

  const items: ClaimSummaryItem[] = [
    {
      text: `${claimant} is employed by ${employer}.`,
      popup: {
        source:          'Policy data',
        comparedAgainst: `Employer records · ${employer}`,
        fetched:          ts(0),
      },
    },
    {
      text: `Claim number ${claimNumber} is open within the ${jx.name} jurisdiction.`,
      popup: {
        source:          'Policy data',
        comparedAgainst: `${jx.state} WC jurisdiction records`,
        fetched:          ts(1),
      },
    },
    {
      text: `The injury type is a ${injury.description}.`,
      popup: {
        source:          'Policy data',
        comparedAgainst: `ICD ${injury.icd} injury profiles · ${jx.state}`,
        fetched:          ts(1),
      },
    },
    {
      text: `Total reserve is set at ${reserve.amount} with prior payments totaling ${reserve.priorPayments}.`,
      popup: {
        source:          'Policy data',
        comparedAgainst: `${jx.state} ${injury.label} reserve averages`,
        fetched:          ts(2),
      },
    },
  ];

  const signals: ClaimSignal[] = [
    {
      text:    `${cap(injury.label)} in ${jx.state} ${jx.industry} typically resolves within ${injury.resolutionWeeks} weeks — monitor for extension.`,
      badge:   'Duration Risk · High',
      variant: 'duration',
      popup: {
        source:          'ODG by MCG (Official Disability Guidelines) — odgtwc.com',
        comparedAgainst: `ICD ${injury.icd} · Duration velocity · ${jx.state}`,
        fetched:          ts(3),
      },
    },
    {
      text:    `Total reserve of ${reserve.amountK} ${reserve.benchmarkNote} — ${reserve.action}.`,
      badge:   'Reserve Risk · High',
      variant: 'reserve',
      popup: {
        source:          'WCRI CompScope Benchmarks — wcri.org',
        comparedAgainst: `${jx.state} ${injury.label} settlement benchmarks`,
        fetched:          ts(3),
      },
    },
    {
      text:    injury.laeOpportunity,
      badge:   'LAE Opportunity · High',
      variant: 'lae',
      popup: {
        source:          'ACOEM Occupational Medicine Practice Guidelines — acoem.org',
        comparedAgainst: `${jx.state} ${injury.label} FCE intervention rates`,
        fetched:          ts(4),
      },
    },
  ];

  const footerNote = `Generated by Intake Agent · ICD ${injury.icd} · ${jx.state} ${injury.label} benchmarks · ${base.date}`;

  return {
    items, signals, footerNote,
    injury: { label: injury.label, icd: injury.icd, bodyPart: injury.bodyPart, description: injury.description },
  };
}
