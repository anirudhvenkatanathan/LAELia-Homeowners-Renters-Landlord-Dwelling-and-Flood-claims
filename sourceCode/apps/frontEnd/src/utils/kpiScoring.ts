// LAElia KPI Scoring Tables v2 — shared scoring logic used by the Claim
// Orchestrator eye-icon popup and the Active Vendor Metrics tab.

export interface KpiCategory { name: string; weight: number | null; }
export interface KpiRow      { name: string; weight: number | null; score: number | null; contribution: number | null; }

export const SERVICE_KPI_CONFIG: Record<string, KpiCategory[]> = {
  'Bill Review': [
    { name: 'Injury specialization',    weight: null },
    { name: 'Historical outcomes',      weight: 22   },
    { name: 'Litigation effectiveness', weight: 8    },
    { name: 'Turnaround time',          weight: 15   },
    { name: 'Cost efficiency',          weight: 20   },
    { name: 'Geographic proximity',     weight: null },
    { name: 'Capacity',                 weight: 10   },
    { name: 'Report quality',           weight: 12   },
    { name: 'Compliance',               weight: 8    },
    { name: 'Adjuster satisfaction',    weight: 5    },
    { name: 'Claimant experience',      weight: null },
  ],
  'Records Production': [
    { name: 'Injury specialization',    weight: 8    },
    { name: 'Historical outcomes',      weight: 18   },
    { name: 'Litigation effectiveness', weight: 15   },
    { name: 'Turnaround time',          weight: 15   },
    { name: 'Cost efficiency',          weight: 8    },
    { name: 'Geographic proximity',     weight: 10   },
    { name: 'Capacity',                 weight: 8    },
    { name: 'Report quality',           weight: 10   },
    { name: 'Compliance',               weight: 5    },
    { name: 'Adjuster satisfaction',    weight: 3    },
    { name: 'Claimant experience',      weight: null },
  ],
  'Records Retrieval': [
    { name: 'Injury specialization',    weight: null },
    { name: 'Historical outcomes',      weight: 18   },
    { name: 'Litigation effectiveness', weight: 5    },
    { name: 'Turnaround time',          weight: 22   },
    { name: 'Cost efficiency',          weight: 12   },
    { name: 'Geographic proximity',     weight: 15   },
    { name: 'Capacity',                 weight: 10   },
    { name: 'Report quality',           weight: 8    },
    { name: 'Compliance',               weight: 5    },
    { name: 'Adjuster satisfaction',    weight: 3    },
    { name: 'Claimant experience',      weight: 2    },
  ],
  'Medical Canvassing': [
    { name: 'Injury specialization',    weight: 22   },
    { name: 'Historical outcomes',      weight: 15   },
    { name: 'Litigation effectiveness', weight: null },
    { name: 'Turnaround time',          weight: 12   },
    { name: 'Cost efficiency',          weight: 8    },
    { name: 'Geographic proximity',     weight: 18   },
    { name: 'Capacity',                 weight: 8    },
    { name: 'Report quality',           weight: 8    },
    { name: 'Compliance',               weight: 5    },
    { name: 'Adjuster satisfaction',    weight: 2    },
    { name: 'Claimant experience',      weight: 2    },
  ],
  'IME / Peer Review': [
    { name: 'Injury specialization',    weight: 22   },
    { name: 'Historical outcomes',      weight: 15   },
    { name: 'Litigation effectiveness', weight: 12   },
    { name: 'Turnaround time',          weight: 10   },
    { name: 'Cost efficiency',          weight: 7    },
    { name: 'Geographic proximity',     weight: 10   },
    { name: 'Capacity',                 weight: 7    },
    { name: 'Report quality',           weight: 8    },
    { name: 'Compliance',               weight: 5    },
    { name: 'Adjuster satisfaction',    weight: 2    },
    { name: 'Claimant experience',      weight: 2    },
  ],
  'Desk Investigations': [
    { name: 'Injury specialization',    weight: 15   },
    { name: 'Historical outcomes',      weight: 20   },
    { name: 'Litigation effectiveness', weight: 18   },
    { name: 'Turnaround time',          weight: 10   },
    { name: 'Cost efficiency',          weight: 8    },
    { name: 'Geographic proximity',     weight: 3    },
    { name: 'Capacity',                 weight: 8    },
    { name: 'Report quality',           weight: 12   },
    { name: 'Compliance',               weight: 5    },
    { name: 'Adjuster satisfaction',    weight: 1    },
    { name: 'Claimant experience',      weight: null },
  ],
  'Nurse Case Management': [
    { name: 'Injury specialization',    weight: 20   },
    { name: 'Historical outcomes',      weight: 22   },
    { name: 'Litigation effectiveness', weight: null },
    { name: 'Turnaround time',          weight: 8    },
    { name: 'Cost efficiency',          weight: 8    },
    { name: 'Geographic proximity',     weight: 12   },
    { name: 'Capacity',                 weight: 8    },
    { name: 'Report quality',           weight: 8    },
    { name: 'Compliance',               weight: 5    },
    { name: 'Adjuster satisfaction',    weight: 5    },
    { name: 'Claimant experience',      weight: 4    },
  ],
  'Catastrophic Case Management': [
    { name: 'Injury specialization',    weight: 25   },
    { name: 'Historical outcomes',      weight: 20   },
    { name: 'Litigation effectiveness', weight: 5    },
    { name: 'Turnaround time',          weight: 8    },
    { name: 'Cost efficiency',          weight: 10   },
    { name: 'Geographic proximity',     weight: 7    },
    { name: 'Capacity',                 weight: 8    },
    { name: 'Report quality',           weight: 8    },
    { name: 'Compliance',               weight: 4    },
    { name: 'Adjuster satisfaction',    weight: 3    },
    { name: 'Claimant experience',      weight: 2    },
  ],
  'Pharmacy Carve-Out': [
    { name: 'Injury specialization',    weight: 10   },
    { name: 'Historical outcomes',      weight: 20   },
    { name: 'Litigation effectiveness', weight: null },
    { name: 'Turnaround time',          weight: 12   },
    { name: 'Cost efficiency',          weight: 22   },
    { name: 'Geographic proximity',     weight: 3    },
    { name: 'Capacity',                 weight: 8    },
    { name: 'Report quality',           weight: 8    },
    { name: 'Compliance',               weight: 10   },
    { name: 'Adjuster satisfaction',    weight: 5    },
    { name: 'Claimant experience',      weight: 2    },
  ],
  'RTW / Job Fit': [
    { name: 'Injury specialization',    weight: 18   },
    { name: 'Historical outcomes',      weight: 22   },
    { name: 'Litigation effectiveness', weight: null },
    { name: 'Turnaround time',          weight: 10   },
    { name: 'Cost efficiency',          weight: 8    },
    { name: 'Geographic proximity',     weight: 12   },
    { name: 'Capacity',                 weight: 8    },
    { name: 'Report quality',           weight: 8    },
    { name: 'Compliance',               weight: 5    },
    { name: 'Adjuster satisfaction',    weight: 5    },
    { name: 'Claimant experience',      weight: 4    },
  ],
  'Transportation': [
    { name: 'Injury specialization',    weight: null },
    { name: 'Historical outcomes',      weight: 22   },
    { name: 'Litigation effectiveness', weight: null },
    { name: 'Turnaround time',          weight: 15   },
    { name: 'Cost efficiency',          weight: 18   },
    { name: 'Geographic proximity',     weight: 18   },
    { name: 'Capacity',                 weight: 12   },
    { name: 'Report quality',           weight: null },
    { name: 'Compliance',               weight: 5    },
    { name: 'Adjuster satisfaction',    weight: 3    },
    { name: 'Claimant experience',      weight: 7    },
  ],
  'Subrogation': [
    { name: 'Injury specialization',    weight: 8    },
    { name: 'Historical outcomes',      weight: 22   },
    { name: 'Litigation effectiveness', weight: 25   },
    { name: 'Turnaround time',          weight: 8    },
    { name: 'Cost efficiency',          weight: 15   },
    { name: 'Geographic proximity',     weight: 8    },
    { name: 'Capacity',                 weight: 5    },
    { name: 'Report quality',           weight: 5    },
    { name: 'Compliance',               weight: 3    },
    { name: 'Adjuster satisfaction',    weight: 1    },
    { name: 'Claimant experience',      weight: null },
  ],
  'Decision Letters': [
    { name: 'Injury specialization',    weight: null },
    { name: 'Historical outcomes',      weight: 15   },
    { name: 'Litigation effectiveness', weight: 15   },
    { name: 'Turnaround time',          weight: 20   },
    { name: 'Cost efficiency',          weight: 8    },
    { name: 'Geographic proximity',     weight: null },
    { name: 'Capacity',                 weight: 10   },
    { name: 'Report quality',           weight: 18   },
    { name: 'Compliance',               weight: 12   },
    { name: 'Adjuster satisfaction',    weight: 2    },
    { name: 'Claimant experience',      weight: null },
  ],
  'Telephonic Case Management': [
    { name: 'Injury specialization',    weight: 18   },
    { name: 'Historical outcomes',      weight: 18   },
    { name: 'Litigation effectiveness', weight: null },
    { name: 'Turnaround time',          weight: 12   },
    { name: 'Cost efficiency',          weight: 8    },
    { name: 'Geographic proximity',     weight: null },
    { name: 'Capacity',                 weight: 8    },
    { name: 'Report quality',           weight: 8    },
    { name: 'Compliance',               weight: 5    },
    { name: 'Adjuster satisfaction',    weight: 10   },
    { name: 'Claimant experience',      weight: 13   },
  ],
  'Field Investigations': [
    { name: 'Injury specialization',    weight: 18   },
    { name: 'Historical outcomes',      weight: 18   },
    { name: 'Litigation effectiveness', weight: 18   },
    { name: 'Turnaround time',          weight: 10   },
    { name: 'Cost efficiency',          weight: 8    },
    { name: 'Geographic proximity',     weight: 12   },
    { name: 'Capacity',                 weight: 5    },
    { name: 'Report quality',           weight: 8    },
    { name: 'Compliance',               weight: 3    },
    { name: 'Adjuster satisfaction',    weight: 0    },
    { name: 'Claimant experience',      weight: null },
  ],
};

// Aliases for alternate role name spellings used in the app
SERVICE_KPI_CONFIG['RTW / Job Fit Analysis']              = SERVICE_KPI_CONFIG['RTW / Job Fit'];
SERVICE_KPI_CONFIG['RTW / JFA']                           = SERVICE_KPI_CONFIG['RTW / Job Fit'];
SERVICE_KPI_CONFIG['Records Production (Adverse-Party)']  = SERVICE_KPI_CONFIG['Records Production'];
SERVICE_KPI_CONFIG['Records Retrieval (Defense)']         = SERVICE_KPI_CONFIG['Records Retrieval'];

const DEFAULT_KPI_CONFIG: KpiCategory[] = [
  { name: 'Injury specialization',    weight: 20 },
  { name: 'Historical outcomes',      weight: 18 },
  { name: 'Litigation effectiveness', weight: 12 },
  { name: 'Turnaround time',          weight: 10 },
  { name: 'Cost efficiency',          weight: 8  },
  { name: 'Geographic proximity',     weight: 5  },
  { name: 'Capacity',                 weight: 8  },
  { name: 'Report quality',           weight: 8  },
  { name: 'Compliance',               weight: 5  },
  { name: 'Adjuster satisfaction',    weight: 3  },
  { name: 'Claimant experience',      weight: 3  },
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
