import { formatThreshold, applySuggestedThreshold, extractNumericThreshold } from '../kpiThresholdUtils';

// ─── formatThreshold ──────────────────────────────────────────────────────────

describe('formatThreshold', () => {
  it('returns empty string for empty input', () => {
    expect(formatThreshold('')).toBe('');
  });

  it('prefixes plain integer with "Good ≥" and appends "%"', () => {
    expect(formatThreshold('92')).toBe('Good ≥ 92%');
  });

  it('prefixes plain float with "Good ≥" and appends "%"', () => {
    expect(formatThreshold('18.5')).toBe('Good ≥ 18.5%');
  });

  it('returns an already-prefixed string unchanged', () => {
    expect(formatThreshold('Good ≥ 95%')).toBe('Good ≥ 95%');
  });

  it('returns any string containing letters unchanged', () => {
    expect(formatThreshold('Excellent ≥ 90%')).toBe('Excellent ≥ 90%');
  });

  it('handles single-digit threshold', () => {
    expect(formatThreshold('3')).toBe('Good ≥ 3%');
  });

  it('handles zero', () => {
    expect(formatThreshold('0')).toBe('Good ≥ 0%');
  });
});

// ─── applySuggestedThreshold ──────────────────────────────────────────────────

describe('applySuggestedThreshold', () => {
  it('reduces "Good ≥ 95%" by 3 → "Good ≥ 92%"', () => {
    expect(applySuggestedThreshold('Good ≥ 95%', 3)).toBe('Good ≥ 92%');
  });

  it('reduces "Good ≥ 18%" by 4 → "Good ≥ 14%"', () => {
    expect(applySuggestedThreshold('Good ≥ 18%', 4)).toBe('Good ≥ 14%');
  });

  it('reduces "Good ≥ 75%" by 5 → "Good ≥ 70%"', () => {
    expect(applySuggestedThreshold('Good ≥ 75%', 5)).toBe('Good ≥ 70%');
  });

  it('handles float threshold', () => {
    expect(applySuggestedThreshold('Good ≥ 18.5%', 2)).toBe('Good ≥ 16.5%');
  });

  it('handles zero reduction', () => {
    expect(applySuggestedThreshold('Good ≥ 90%', 0)).toBe('Good ≥ 90%');
  });

  it('only modifies the first numeric value in the string', () => {
    expect(applySuggestedThreshold('Good ≥ 100% (max 200)', 10)).toBe('Good ≥ 90% (max 200)');
  });
});

// ─── extractNumericThreshold ──────────────────────────────────────────────────

describe('extractNumericThreshold', () => {
  it('extracts integer from "Good ≥ 70%"', () => {
    expect(extractNumericThreshold('Good ≥ 70%')).toBe('70');
  });

  it('extracts integer from "Good ≥ 18%"', () => {
    expect(extractNumericThreshold('Good ≥ 18%')).toBe('18');
  });

  it('extracts bare integer without percent', () => {
    expect(extractNumericThreshold('Good ≥ 3')).toBe('3');
  });

  it('extracts float', () => {
    expect(extractNumericThreshold('Good ≥ 18.5%')).toBe('18.5');
  });

  it('returns original string when no numeric is found', () => {
    expect(extractNumericThreshold('no-number')).toBe('no-number');
  });

  it('returns empty string when input is empty', () => {
    expect(extractNumericThreshold('')).toBe('');
  });

  it('extracts first numeric when multiple numbers present', () => {
    expect(extractNumericThreshold('Good ≥ 92% (was 95%)')).toBe('92');
  });
});
