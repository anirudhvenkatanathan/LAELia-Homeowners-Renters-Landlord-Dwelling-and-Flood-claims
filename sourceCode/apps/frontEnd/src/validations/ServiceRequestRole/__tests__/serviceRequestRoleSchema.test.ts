import { describe, it, expect } from 'vitest';
import {
  validateUpload,
  validateRole,
  validateCondition,
} from '../serviceRequestRoleSchema';
import type { ServiceRequestRole, RoleCondition } from '../../../models/ServiceRequestRole/serviceRequestRoleModel';

// ─── validateUpload ───────────────────────────────────────────────────────────

describe('validateUpload', () => {
  it('returns invalid when file is null', () => {
    const result = validateUpload(null);
    expect(result.valid).toBe(false);
    expect(result.errors['file']).toMatch(/choose a file/i);
  });

  it('returns invalid when file is empty', () => {
    const file = new File([], 'empty.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const result = validateUpload(file);
    expect(result.valid).toBe(false);
    expect(result.errors['file']).toMatch(/empty/i);
  });

  it('returns invalid when file exceeds 10 MB', () => {
    const bigContent = new Uint8Array(11 * 1024 * 1024);
    const file = new File([bigContent], 'huge.xlsx');
    const result = validateUpload(file);
    expect(result.valid).toBe(false);
    expect(result.errors['file']).toMatch(/10 MB/i);
  });

  it('returns invalid for non-Excel file types', () => {
    const file = new File(['data'], 'doc.csv');
    const result = validateUpload(file);
    expect(result.valid).toBe(false);
    expect(result.errors['file']).toMatch(/\.xlsx/i);
  });

  it('returns valid for a proper .xlsx file', () => {
    const file = new File(['data'], 'roles.xlsx');
    const result = validateUpload(file);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('returns valid for a proper .xls file', () => {
    const file = new File(['data'], 'roles.xls');
    const result = validateUpload(file);
    expect(result.valid).toBe(true);
  });
});

// ─── validateRole ─────────────────────────────────────────────────────────────

const baseRole: ServiceRequestRole = {
  roleId: 'r1',
  uploadId: 'u1',
  roleName: 'Bill Review',
  description: 'Reviews medical bills',
  status: 'Active',
  nlpCondition: '',
  conditionExpression: '',
  nlpConditionInWords: '',
};

describe('validateRole', () => {
  it('returns invalid when roleName is empty', () => {
    const result = validateRole({ ...baseRole, roleName: '' }, []);
    expect(result.valid).toBe(false);
    expect(result.errors['roleName']).toMatch(/required/i);
  });

  it('returns invalid when description is empty', () => {
    const result = validateRole({ ...baseRole, description: '' }, []);
    expect(result.valid).toBe(false);
    expect(result.errors['description']).toMatch(/required/i);
  });

  it('returns invalid for a duplicate role name (case-insensitive)', () => {
    const existing: ServiceRequestRole[] = [{ ...baseRole, roleId: 'r99', roleName: 'BILL REVIEW' }];
    const result = validateRole({ ...baseRole, roleId: 'r-new' }, existing);
    expect(result.valid).toBe(false);
    expect(result.errors['roleName']).toMatch(/already exists/i);
  });

  it('does not flag duplicate when editing the same role', () => {
    const existing: ServiceRequestRole[] = [baseRole];
    const result = validateRole({ ...baseRole }, existing);
    expect(result.valid).toBe(true);
  });

  it('returns valid when all fields are present and unique', () => {
    const result = validateRole({ ...baseRole, roleId: 'r-new', roleName: 'New Role' }, [baseRole]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });
});

// ─── validateCondition ────────────────────────────────────────────────────────

const baseCondition: RoleCondition = {
  conditionId: 'c1',
  roleId: 'r1',
  fieldName: 'claimAmount',
  operator: '>',
  value: '5000',
  conditionType: 'Simple',
  sortOrder: 1,
};

describe('validateCondition', () => {
  it('returns invalid when fieldName is missing', () => {
    const result = validateCondition({ ...baseCondition, fieldName: '' }, []);
    expect(result.valid).toBe(false);
    expect(result.errors['fieldName']).toMatch(/required/i);
  });

  it('returns invalid when operator is missing', () => {
    const result = validateCondition({ ...baseCondition, operator: '' }, []);
    expect(result.valid).toBe(false);
    expect(result.errors['operator']).toMatch(/required/i);
  });

  it('returns invalid when value is missing', () => {
    const result = validateCondition({ ...baseCondition, value: '' }, []);
    expect(result.valid).toBe(false);
    expect(result.errors['value']).toMatch(/required/i);
  });

  it('returns invalid for a duplicate condition (case-insensitive)', () => {
    const existing: RoleCondition[] = [{ ...baseCondition, conditionId: 'c99' }];
    const result = validateCondition({ ...baseCondition, conditionId: 'c-new' }, existing);
    expect(result.valid).toBe(false);
    expect(result.errors['fieldName']).toMatch(/already exists/i);
  });

  it('does not flag duplicate when editing the same condition', () => {
    const existing: RoleCondition[] = [baseCondition];
    const result = validateCondition({ ...baseCondition }, existing);
    expect(result.valid).toBe(true);
  });

  it('returns valid when all fields are present and unique', () => {
    const result = validateCondition({ ...baseCondition, conditionId: 'c-new', value: '9999' }, [baseCondition]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });
});
