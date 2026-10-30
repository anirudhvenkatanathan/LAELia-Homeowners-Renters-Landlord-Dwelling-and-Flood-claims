import { describe, it, expect } from 'vitest';
import { validatePasswordPolicy } from '../passwordPolicy';

describe('validatePasswordPolicy', () => {
  it('rejects passwords under 6 characters', () => {
    expect(validatePasswordPolicy('a1!')).toBe('Password must be at least 6 characters.');
  });

  it('rejects passwords with no digit', () => {
    expect(validatePasswordPolicy('abcdef!')).toBe('Password must contain at least one number.');
  });

  it('rejects passwords with no special character', () => {
    expect(validatePasswordPolicy('abcdef1')).toBe('Password must contain at least one special character.');
  });

  it('accepts a password satisfying all rules', () => {
    expect(validatePasswordPolicy('Adjuster@123')).toBeNull();
  });
});
