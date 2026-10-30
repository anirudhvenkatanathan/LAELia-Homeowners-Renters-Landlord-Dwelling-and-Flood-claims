// LAElia KPI Scoring Tables v2 — shared scoring logic used by the Claim
// Orchestrator eye-icon popup and the Active Vendor Metrics tab.

export interface KpiCategory { name: string; weight: number | null; }
export interface KpiRow      { name: string; weight: number | null; score: number | null; contribution: number | null; }

const KPI_NAMES = [
  'Peril specialization',
  'Historical outcomes',
  'Dispute resolution',
  'Turnaround time',
  'Cost efficiency',
  'Geographic proximity',
  'Capacity',
  'Report quality',
  'Compliance',
  'Adjuster satisfaction',
  'Policyholder experience',
] as const;

/** Builds a config from weights in KPI_NAMES order; null = not applicable. */
function profile(weights: (number | null)[]): KpiCategory[] {
  return KPI_NAMES.map((name, i) => ({ name, weight: weights[i] }));
}

// Weighting profiles (each applicable weight set sums to 100).
const PROFILES = {
  //                         Peril Hist Disp Turn Cost Geo  Cap  Rpt  Comp Adj  PH
  estimateValuation: profile([8,   18,  8,   12,  22,  null, 8,  14,  5,   5,   null]),
  investigation:     profile([18,  18,  12,  10,  5,   12,  5,   12,  5,   3,   null]),
  recovery:          profile([8,   22,  25,  8,   15,  8,   5,   5,   3,   1,   null]),
  mitigationField:   profile([10,  12,  null, 22, 10,  15,  12,  8,   5,   3,   3]),
  legalCoverage:     profile([10,  15,  25,  12,  8,   null, 5,  10,  8,   7,   null]),
  floodCompliance:   profile([15,  12,  null, 15, 5,   null, 8,  15,  20,  5,   5]),
  letters:           profile([null, null, null, 15, null, null, null, 25, 20, 20, 20]),
};

const RULES_BY_PROFILE: Record<keyof typeof PROFILES, string[]> = {
  estimateValuation: ['Estimate & Invoice Review', 'Insurance-to-Value Review', 'Contents Inventory & Valuation', 'Roof Surface Review', 'Appraisers/Independent Adjusters'],
  investigation:     ['Cause & Origin Specialists', 'Forensic Engineers', 'Forensic Accountant', 'Desk investigations', 'Scene Investigation & Official Reports', 'Independent Adjusters', 'Vacancy Review'],
  recovery:          ['Subrogation', 'Tenant-Caused Loss Recovery'],
  mitigationField:   ['24/7 Loss Mitigation Contractors', 'CAT Response', 'Repair Network Referral', 'Pack-out & Contents Cleaning', 'Temporary Housing / ALE'],
  legalCoverage:     ['Legal', 'Coverage Verification & ROR', 'Public Adjuster / Appraisal', 'Deductible Waiver Review', 'Statutory Deadline Watch'],
  floodCompliance:   ['NFIP Authorized Adjuster', 'Proof of Loss Follow-up', 'Waiting Period Review', 'Substantial Damage Determination', 'ICC Claim Handling', 'NFIP Limit Exposure'],
  letters:           ['Decision letters'],
};

export const SERVICE_KPI_CONFIG: Record<string, KpiCategory[]> = {};
(Object.keys(RULES_BY_PROFILE) as (keyof typeof PROFILES)[]).forEach((key) => {
  RULES_BY_PROFILE[key].forEach((rule) => { SERVICE_KPI_CONFIG[rule] = PROFILES[key]; });
});

// Aliases for alternate role name spellings
SERVICE_KPI_CONFIG['Decision Letters'] = SERVICE_KPI_CONFIG['Decision letters'];
SERVICE_KPI_CONFIG['Desk Investigations'] = SERVICE_KPI_CONFIG['Desk investigations'];

const DEFAULT_KPI_CONFIG: KpiCategory[] = [
  { name: 'Peril specialization',    weight: 20 },
  { name: 'Historical outcomes',      weight: 18 },
  { name: 'Dispute resolution', weight: 12 },
  { name: 'Turnaround time',          weight: 10 },
  { name: 'Cost efficiency',          weight: 8  },
  { name: 'Geographic proximity',     weight: 5  },
  { name: 'Capacity',                 weight: 8  },
  { name: 'Report quality',           weight: 8  },
  { name: 'Compliance',               weight: 5  },
  { name: 'Adjuster satisfaction',    weight: 3  },
  { name: 'Policyholder experience',      weight: 3  },
];

export function getKpiConfig(role: string): KpiCategory[] {
  const key = role.trim();
  if (SERVICE_KPI_CONFIG[key]) return SERVICE_KPI_CONFIG[key];
  const lower = key.toLowerCase();
  for (const k of Object.keys(SERVICE_KPI_CONFIG)) {
    if (k.toLowerCase() === lower || k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())) {
      return SERVICE_KPI_CONFIG[k];
    }
  }
  return DEFAULT_KPI_CONFIG;
}

export function vendorKpiScores(vendorName: string, role: string, targetRating: number): KpiRow[] {
  const config = getKpiConfig(role);
  let h = 5381;
  for (let i = 0; i < vendorName.length; i++) {
    h = ((h * 33) ^ vendorName.charCodeAt(i)) >>> 0;
  }
  const applicable: { idx: number; raw: number; weight: number }[] = [];
  config.forEach((cat, i) => {
    if (!cat.weight) return;
    const rand = ((h * (i * 1664525 + 1013904223) + 12345) >>> 0) & 0xFFFF;
    applicable.push({ idx: i, raw: 2.5 + (rand / 0xFFFF) * 2.5, weight: cat.weight });
  });
  const rawSum = applicable.reduce((s, a) => s + (a.weight / 100) * a.raw, 0);
  const scale  = rawSum > 0 ? targetRating / rawSum : 1;
  const byIdx: Record<number, { score: number; contribution: number }> = {};
  applicable.forEach(({ idx, raw, weight }) => {
    const score = Math.min(5.0, raw * scale);
    byIdx[idx]  = { score, contribution: (weight / 100) * score };
  });
  return config
    .map((cat, i) => {
      if (cat.weight === null || cat.weight === 0) return null;
      const { score, contribution } = byIdx[i] ?? { score: 0, contribution: 0 };
      return { name: cat.name, weight: cat.weight, score, contribution };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export function vendorRatingForRole(vendorName: string, roleName: string): number {
  let h = 5381;
  const key = vendorName + '|' + roleName;
  for (let i = 0; i < key.length; i++) {
    h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  }
  return parseFloat((3.5 + ((h & 0xFF) / 255) * 1.5).toFixed(1));
}

// ─── Vendor Score Breakdown scorecard ──────────────────────────────────────
//
// Single source of truth for the "Vendor Score Breakdown" panel: any rating
// shown for a vendor+role (row badge, Aggregate cell, or summary chips
// elsewhere on the page) must come from this function so the numbers can
// never drift apart from one another.

export interface VendorRoleScorecard { kpis: KpiRow[]; aggregate: number; }

const SCORECARD_COMPLIANCE_WEIGHT = 5;
const SCORECARD_COMPLIANCE_SCORE  = 5.0;
const SCORECARD_RISK_WEIGHT       = 10;

export function vendorRoleScorecard(vendorName: string, roleName: string): VendorRoleScorecard {
  // Seed used only to vary vendorKpiScores' internal score spread.
  const seedRating = vendorRatingForRole(vendorName, roleName);
  const rawKpis = vendorKpiScores(vendorName, roleName, seedRating)
    .filter((k) => k.name !== 'Geographic proximity');

  // Deterministic Risk score per vendor+role
  const riskSeed = vendorName + '|' + roleName + '|Risk';
  let rh = 5381;
  for (let i = 0; i < riskSeed.length; i++) rh = ((rh * 33) ^ riskSeed.charCodeAt(i)) >>> 0;
  const riskScore = parseFloat((2.5 + ((rh & 0xFF) / 255) * 2.5).toFixed(2));

  // Compliance is always shown as a perfect score and Risk is a category
  // outside the base KPI config. Redistribute Geographic proximity's freed-up
  // weight across the remaining categories so the table sums to 100% — scores
  // are left untouched (no rescale), so nothing here can push a score past
  // 5.0 and silently undercut the aggregate.
  const flexible          = rawKpis.filter((k) => k.name !== 'Compliance');
  const flexibleWeightSum = flexible.reduce((s, k) => s + (k.weight ?? 0), 0);
  const flexibleBudget    = 100 - SCORECARD_COMPLIANCE_WEIGHT - SCORECARD_RISK_WEIGHT;
  const weightScale       = flexibleWeightSum > 0 ? flexibleBudget / flexibleWeightSum : 1;

  const baseKpis = rawKpis.map((k) => {
    if (k.name === 'Compliance') {
      return { ...k, weight: SCORECARD_COMPLIANCE_WEIGHT, score: SCORECARD_COMPLIANCE_SCORE, contribution: parseFloat(((SCORECARD_COMPLIANCE_WEIGHT / 100) * SCORECARD_COMPLIANCE_SCORE).toFixed(2)) };
    }
    const weight = parseFloat(((k.weight ?? 0) * weightScale).toFixed(1));
    const score  = k.score ?? 0;
    return { ...k, weight, score, contribution: parseFloat(((weight / 100) * score).toFixed(2)) };
  });
  const kpis = [...baseKpis, { name: 'Risk', weight: SCORECARD_RISK_WEIGHT, score: riskScore, contribution: parseFloat(((SCORECARD_RISK_WEIGHT / 100) * riskScore).toFixed(2)) }];
  const aggregate = kpis.reduce((s, k) => s + (k.contribution ?? 0), 0);

  return { kpis, aggregate };
}
