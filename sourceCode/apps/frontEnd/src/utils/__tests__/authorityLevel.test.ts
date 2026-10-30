import { describe, it, expect } from 'vitest';
import { calculateAuthorityLevel } from '../authorityLevel';

describe('calculateAuthorityLevel', () => {
  it('Rule 1 — both controlling permissions disabled → Review Required', () => {
    expect(calculateAuthorityLevel(false, false)).toBe('Adjuster – Review Required');
  });

  it('Rule 2 — only "Access to updating Service Provider" enabled → Limited Authority', () => {
    expect(calculateAuthorityLevel(true, false)).toBe('Adjuster – Limited Authority');
  });

  it('Rule 2 — only "Access to updating Services" enabled → Limited Authority', () => {
    expect(calculateAuthorityLevel(false, true)).toBe('Adjuster – Limited Authority');
  });

  it('Rule 3 — both controlling permissions enabled → Independent Authority', () => {
    expect(calculateAuthorityLevel(true, true)).toBe('Adjuster – Independent Authority');
  });
});
