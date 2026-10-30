// Deterministic Client Management demo data — shown only as a fallback when
// a vendor has no real client assignment history yet. Same technique as
// vendorRoleScorecard (kpiScoring.ts) and getClaimSummaryData
// (claimSummaryMockData.ts): the client names are a fixed pool, but the
// Active/Completed/Total values are derived from a hash of vendorId + client
// name, computed live in the browser — never written to the database, so it
// can never accumulate or duplicate, and works identically against any DB.

export interface DemoClientRow {
  companyName: string;
  active:      number;
  completed:   number;
  total:       number;
}

const DEMO_CLIENT_NAMES = [
  'Acme Insurance Co.',
  'Beacon Mutual Group',
  'Cornerstone Casualty',
  'Northwind Indemnity',
  'Summit Risk Partners',
];

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

export function getDemoClientRows(vendorId: string): DemoClientRow[] {
  return DEMO_CLIENT_NAMES.map((companyName) => {
    const h = djb2(`${vendorId}|${companyName}`);
    const active    = 1 + (h % 4);              // 1–4
    const completed = (h >>> 8) % 4;             // 0–3
    return { companyName, active, completed, total: active + completed };
  });
}
