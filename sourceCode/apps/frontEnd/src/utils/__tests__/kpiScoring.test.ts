import { describe, it, expect } from 'vitest';
import {
  getKpiConfig,
  vendorRatingForRole,
  vendorKpiScores,
  vendorRoleScorecard,
  SERVICE_KPI_CONFIG,
} from '../kpiScoring';

// ─── getKpiConfig ─────────────────────────────────────────────────────────────

describe('getKpiConfig', () => {
  it('returns correct config for exact match "Bill Review"', () => {
    const config = getKpiConfig('Bill Review');
    const names = config.map((c) => c.name);
    expect(names).toContain('Historical outcomes');
    expect(names).toContain('Cost efficiency');
  });

  it('returns correct config for exact match "IME / Peer Review"', () => {
    const config = getKpiConfig('IME / Peer Review');
    expect(config.length).toBeGreaterThan(0);
    const names = config.map((c) => c.name);
    expect(names).toContain('Injury specialization');
  });

  it('returns DEFAULT_KPI_CONFIG for completely unknown role', () => {
    const config = getKpiConfig('Totally Unknown Service');
    expect(config).toHaveLength(11);
    const names = config.map((c) => c.name);
    expect(names).toContain('Injury specialization');
    expect(names).toContain('Historical outcomes');
  });

  it('resolves alias "RTW / JFA" to the same config as "RTW / Job Fit"', () => {
    expect(getKpiConfig('RTW / JFA')).toBe(getKpiConfig('RTW / Job Fit'));
  });

  it('resolves alias "RTW / Job Fit Analysis"', () => {
    expect(getKpiConfig('RTW / Job Fit Analysis')).toBe(getKpiConfig('RTW / Job Fit'));
  });

  it('resolves alias "Records Production (Adverse-Party)"', () => {
    expect(getKpiConfig('Records Production (Adverse-Party)')).toBe(getKpiConfig('Records Production'));
  });

  it('resolves alias "Records Retrieval (Defense)"', () => {
    expect(getKpiConfig('Records Retrieval (Defense)')).toBe(getKpiConfig('Records Retrieval'));
  });

  it('performs case-insensitive match for known roles', () => {
    expect(getKpiConfig('bill review')).toBe(getKpiConfig('Bill Review'));
    expect(getKpiConfig('BILL REVIEW')).toBe(getKpiConfig('Bill Review'));
  });

  it('trims leading/trailing whitespace', () => {
    expect(getKpiConfig('  Bill Review  ')).toBe(getKpiConfig('Bill Review'));
  });

  it('all known service keys have 11 KPI categories', () => {
    for (const key of Object.keys(SERVICE_KPI_CONFIG)) {
      expect(SERVICE_KPI_CONFIG[key]).toHaveLength(11);
    }
  });
});

// ─── vendorRatingForRole ──────────────────────────────────────────────────────

describe('vendorRatingForRole', () => {
  it('returns a number between 3.5 and 5.0 inclusive', () => {
    const rating = vendorRatingForRole('Acme Corp', 'Bill Review');
    expect(rating).toBeGreaterThanOrEqual(3.5);
    expect(rating).toBeLessThanOrEqual(5.0);
  });

  it('is deterministic — same inputs produce the same rating', () => {
    const a = vendorRatingForRole('Acme Corp', 'Bill Review');
    const b = vendorRatingForRole('Acme Corp', 'Bill Review');
    expect(a).toBe(b);
  });

  it('produces different ratings for different vendors', () => {
    const a = vendorRatingForRole('Vendor Alpha', 'Bill Review');
    const b = vendorRatingForRole('Vendor Beta', 'Bill Review');
    expect(a).not.toBe(b);
  });

  it('produces at least some variation across known roles', () => {
    const roles = ['Bill Review', 'IME / Peer Review', 'Nurse Case Management', 'Transportation', 'Subrogation'];
    const ratings = roles.map((r) => vendorRatingForRole('Acme Corp', r));
    const unique = new Set(ratings);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('returns a value with at most 1 decimal place', () => {
    const rating = vendorRatingForRole('Test Vendor', 'Transportation');
    expect(rating.toString()).toMatch(/^\d+(\.\d)?$/);
  });
});

// ─── vendorKpiScores ──────────────────────────────────────────────────────────

describe('vendorKpiScores', () => {
  it('returns an array of KPI rows', () => {
    const rows = vendorKpiScores('Acme Corp', 'Bill Review', 4.0);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('each row has name, weight, score, and contribution', () => {
    const rows = vendorKpiScores('Acme Corp', 'Bill Review', 4.0);
    for (const row of rows) {
      expect(row).toHaveProperty('name');
      expect(row).toHaveProperty('weight');
      expect(row).toHaveProperty('score');
      expect(row).toHaveProperty('contribution');
    }
  });

  it('all scores are between 0 and 5.0', () => {
    const rows = vendorKpiScores('Acme Corp', 'Bill Review', 4.0);
    for (const row of rows) {
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(5.0);
    }
  });

  it('excludes rows with null weight (non-applicable categories)', () => {
    const rows = vendorKpiScores('Acme Corp', 'Bill Review', 4.0);
    for (const row of rows) {
      expect(row.weight).not.toBeNull();
      expect(row.weight).toBeGreaterThan(0);
    }
  });

  it('is deterministic', () => {
    const a = vendorKpiScores('Acme Corp', 'Bill Review', 4.0);
    const b = vendorKpiScores('Acme Corp', 'Bill Review', 4.0);
    expect(a).toEqual(b);
  });

  it('produces different scores for different vendors', () => {
    const a = vendorKpiScores('Vendor A', 'Bill Review', 4.0);
    const b = vendorKpiScores('Vendor B', 'Bill Review', 4.0);
    expect(a).not.toEqual(b);
  });
});

// ─── vendorRoleScorecard ──────────────────────────────────────────────────────

describe('vendorRoleScorecard', () => {
  it('returns object with kpis array and numeric aggregate', () => {
    const sc = vendorRoleScorecard('Acme Corp', 'Bill Review');
    expect(Array.isArray(sc.kpis)).toBe(true);
    expect(typeof sc.aggregate).toBe('number');
  });

  it('includes a "Risk" row', () => {
    const sc = vendorRoleScorecard('Acme Corp', 'Bill Review');
    expect(sc.kpis.some((k) => k.name === 'Risk')).toBe(true);
  });

  it('excludes "Geographic proximity" (always removed)', () => {
    const sc = vendorRoleScorecard('Acme Corp', 'Bill Review');
    expect(sc.kpis.some((k) => k.name === 'Geographic proximity')).toBe(false);
  });

  it('aggregate equals sum of contributions (within floating point tolerance)', () => {
    const sc = vendorRoleScorecard('Acme Corp', 'Bill Review');
    const sum = sc.kpis.reduce((s, k) => s + (k.contribution ?? 0), 0);
    expect(Math.abs(sc.aggregate - sum)).toBeLessThan(0.001);
  });

  it('Compliance row always has score 5.0', () => {
    const sc = vendorRoleScorecard('Acme Corp', 'Bill Review');
    const compliance = sc.kpis.find((k) => k.name === 'Compliance');
    expect(compliance).toBeDefined();
    expect(compliance!.score).toBe(5.0);
  });

  it('Compliance row weight is always 5', () => {
    const sc = vendorRoleScorecard('Acme Corp', 'Bill Review');
    const compliance = sc.kpis.find((k) => k.name === 'Compliance');
    expect(compliance!.weight).toBe(5);
  });

  it('Risk row weight is always 10', () => {
    const sc = vendorRoleScorecard('Acme Corp', 'Bill Review');
    const risk = sc.kpis.find((k) => k.name === 'Risk');
    expect(risk!.weight).toBe(10);
  });

  it('is deterministic', () => {
    const a = vendorRoleScorecard('Acme Corp', 'Bill Review');
    const b = vendorRoleScorecard('Acme Corp', 'Bill Review');
    expect(a).toEqual(b);
  });

  it('produces different scorecards for different vendors', () => {
    const a = vendorRoleScorecard('Vendor X', 'IME / Peer Review');
    const b = vendorRoleScorecard('Vendor Y', 'IME / Peer Review');
    expect(a.aggregate).not.toBe(b.aggregate);
  });

  it('works for all known service types without throwing', () => {
    const roles = Object.keys(SERVICE_KPI_CONFIG);
    for (const role of roles) {
      expect(() => vendorRoleScorecard('Test Vendor', role)).not.toThrow();
    }
  });
});
