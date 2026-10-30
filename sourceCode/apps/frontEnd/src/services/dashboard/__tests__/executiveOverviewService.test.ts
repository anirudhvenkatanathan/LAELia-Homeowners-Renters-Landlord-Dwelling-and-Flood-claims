import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  getKpis,
  getLaeRatioTrend,
  getSubrogationTrend,
  getMedicalSavingsTrend,
  getIndemnitySavingsTrend,
  getSavingsByService,
  getVendors,
  getSlaCompliance,
  getAlerts,
  getAiInsight,
} from '../executiveOverviewService';

beforeAll(() => { vi.useFakeTimers(); });
afterAll(() => { vi.useRealTimers(); });

async function resolved<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

// ─── getKpis ─────────────────────────────────────────────────────────────────

describe('getKpis', () => {
  it('returns 4 KPI cards for "today"', async () => {
    const kpis = await resolved(getKpis('today'));
    expect(kpis).toHaveLength(4);
  });

  it('every KPI card has id, label, value, trendPercent, trendDirection', async () => {
    const kpis = await resolved(getKpis('today'));
    for (const k of kpis) {
      expect(k).toHaveProperty('id');
      expect(k).toHaveProperty('label');
      expect(k).toHaveProperty('value');
      expect(k).toHaveProperty('trendPercent');
      expect(k).toHaveProperty('trendDirection');
    }
  });

  it('currency values are formatted with $ prefix', async () => {
    const kpis = await resolved(getKpis('today'));
    const lae = kpis.find((k) => k.id === 'total-lae');
    expect(lae?.value).toMatch(/^\$/);
  });

  it('SLA compliance value ends with %', async () => {
    const kpis = await resolved(getKpis('today'));
    const sla = kpis.find((k) => k.id === 'sla-compliance');
    expect(sla?.value).toMatch(/%$/);
  });

  it('this-year range returns scaled-up count values compared to today', async () => {
    const kpisShort = await resolved(getKpis('today'));
    const kpisYear  = await resolved(getKpis('this-year'));
    const claimsShort = kpisShort.find((k) => k.id === 'total-claims')!;
    const claimsYear  = kpisYear.find((k) => k.id === 'total-claims')!;
    const numShort = parseInt(claimsShort.value.replace(/,/g, ''), 10);
    const numYear  = parseInt(claimsYear.value.replace(/,/g, ''), 10);
    expect(numYear).toBeGreaterThan(numShort);
  });
});

// ─── getLaeRatioTrend ─────────────────────────────────────────────────────────

describe('getLaeRatioTrend', () => {
  it('returns a currentValue string and data array', async () => {
    const result = await resolved(getLaeRatioTrend());
    expect(typeof result.currentValue).toBe('string');
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('each data point has month, allocated, unallocated', async () => {
    const result = await resolved(getLaeRatioTrend());
    for (const point of result.data) {
      expect(point).toHaveProperty('month');
      expect(point).toHaveProperty('allocated');
      expect(point).toHaveProperty('unallocated');
    }
  });
});

// ─── trend chart services ─────────────────────────────────────────────────────

describe('getSubrogationTrend', () => {
  it('returns currentValue and data array with month/value points', async () => {
    const result = await resolved(getSubrogationTrend());
    expect(result.currentValue).toMatch(/^\$/);
    expect(result.data[0]).toHaveProperty('month');
    expect(result.data[0]).toHaveProperty('value');
  });
});

describe('getMedicalSavingsTrend', () => {
  it('returns currentValue and non-empty data array', async () => {
    const result = await resolved(getMedicalSavingsTrend());
    expect(result.currentValue).toMatch(/^\$/);
    expect(result.data.length).toBeGreaterThan(0);
  });
});

describe('getIndemnitySavingsTrend', () => {
  it('returns currentValue and non-empty data array', async () => {
    const result = await resolved(getIndemnitySavingsTrend());
    expect(result.currentValue).toMatch(/^\$/);
    expect(result.data.length).toBeGreaterThan(0);
  });
});

// ─── getSavingsByService ──────────────────────────────────────────────────────

describe('getSavingsByService', () => {
  const emptyFilters = { service: [], vendor: [], region: [], claimType: [], severity: [] };

  it('returns at most 5 rows by default', async () => {
    const rows = await resolved(getSavingsByService('today', emptyFilters));
    expect(rows.length).toBeLessThanOrEqual(5);
  });

  it('rows are sorted descending by savings', async () => {
    const rows = await resolved(getSavingsByService('today', emptyFilters));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].savings).toBeGreaterThanOrEqual(rows[i].savings);
    }
  });

  it('filters by service name when provided', async () => {
    const rows = await resolved(getSavingsByService('today', {
      ...emptyFilters,
      service: ['Medical Bill Review'],
    }));
    expect(rows.every((r) => r.service === 'Medical Bill Review')).toBe(true);
  });

  it('each row has service, savings, and formatted fields', async () => {
    const rows = await resolved(getSavingsByService('today', emptyFilters));
    for (const row of rows) {
      expect(row).toHaveProperty('service');
      expect(row).toHaveProperty('savings');
      expect(row).toHaveProperty('formatted');
    }
  });
});

// ─── getVendors ───────────────────────────────────────────────────────────────

describe('getVendors', () => {
  const emptyFilters = { service: [], vendor: [], region: [], claimType: [], severity: [] };

  it('returns at most 5 vendors by default', async () => {
    const rows = await resolved(getVendors(emptyFilters));
    expect(rows.length).toBeLessThanOrEqual(5);
  });

  it('assigns sequential rank starting at 1', async () => {
    const rows = await resolved(getVendors(emptyFilters));
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(2);
  });

  it('sortBy cycleTime asc returns lowest cycleTime first', async () => {
    const rows = await resolved(getVendors(emptyFilters, 'cycleTime', 'asc'));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].cycleTimeDays).toBeLessThanOrEqual(rows[i].cycleTimeDays);
    }
  });

  it('filters by vendor name when provided', async () => {
    const all = await resolved(getVendors(emptyFilters));
    if (all.length === 0) return;
    const firstName = all[0].vendorName;
    const filtered = await resolved(getVendors({ ...emptyFilters, vendor: [firstName] }));
    expect(filtered.every((v) => v.vendorName === firstName)).toBe(true);
  });
});

// ─── getSlaCompliance ─────────────────────────────────────────────────────────

describe('getSlaCompliance', () => {
  const emptyFilters = { service: [], vendor: [], region: [], claimType: [], severity: [] };

  it('returns at most 5 rows by default', async () => {
    const rows = await resolved(getSlaCompliance(emptyFilters));
    expect(rows.length).toBeLessThanOrEqual(5);
  });

  it('each row has serviceId, serviceName, compliance, status', async () => {
    const rows = await resolved(getSlaCompliance(emptyFilters));
    for (const row of rows) {
      expect(row).toHaveProperty('serviceId');
      expect(row).toHaveProperty('serviceName');
      expect(row).toHaveProperty('compliance');
      expect(['green', 'amber', 'red']).toContain(row.status);
    }
  });

  it('rows are sorted descending by compliance', async () => {
    const rows = await resolved(getSlaCompliance(emptyFilters));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].compliance).toBeGreaterThanOrEqual(rows[i].compliance);
    }
  });
});

// ─── getAlerts ────────────────────────────────────────────────────────────────

describe('getAlerts', () => {
  const emptyFilters = { service: [], vendor: [], region: [], claimType: [], severity: [] };

  it('returns at most 5 alerts by default', async () => {
    const alerts = await resolved(getAlerts('today', emptyFilters));
    expect(alerts.length).toBeLessThanOrEqual(5);
  });

  it('filters by severity when provided', async () => {
    const alerts = await resolved(getAlerts('today', { ...emptyFilters, severity: ['critical'] }));
    expect(alerts.every((a) => a.severity === 'critical')).toBe(true);
  });

  it('each alert has id, severity, title, description, count', async () => {
    const alerts = await resolved(getAlerts('today', emptyFilters));
    for (const a of alerts) {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('severity');
      expect(a).toHaveProperty('title');
      expect(a).toHaveProperty('description');
      expect(a).toHaveProperty('count');
    }
  });
});

// ─── getAiInsight ─────────────────────────────────────────────────────────────

describe('getAiInsight', () => {
  it('returns an object with insightText and generatedAt', async () => {
    const insight = await resolved(getAiInsight());
    expect(typeof insight.insightText).toBe('string');
    expect(insight.insightText.length).toBeGreaterThan(0);
    expect(typeof insight.generatedAt).toBe('string');
  });
});
