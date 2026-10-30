import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../config/apolloClient', () => ({ getApolloClient: vi.fn() }));
vi.mock('../../../utils/logError', () => ({ logError: vi.fn() }));

import {
  uploadServiceRequestRole,
  getServiceRequestRoleUploads,
  getServiceRequestRoleDetails,
  saveServiceRequestRole,
  saveRoleConditions,
  getAllServiceRequestRoles,
  getServiceRequestRoleById,
  getRoleConditions,
  createServiceRequestRole,
  updateServiceRequestRole,
  deleteServiceRequestRole,
  getOperatorOptions,
  getFieldOptions,
  getNlpFieldMappings,
} from '../serviceRequestRoleService';
import { getApolloClient } from '../../../config/apolloClient';

const mockQuery  = vi.fn();
const mockMutate = vi.fn();

beforeEach(() => {
  vi.mocked(getApolloClient).mockReturnValue({ query: mockQuery, mutate: mockMutate } as unknown as ReturnType<typeof getApolloClient>);
  mockQuery.mockReset();
  mockMutate.mockReset();
});

// ─── uploadServiceRequestRole ─────────────────────────────────────────────────

describe('uploadServiceRequestRole', () => {
  it('returns the upload response on success', async () => {
    const payload = { uploadId: 'u1', totalRecords: 5, status: 'Processed', message: 'ok', success: true };
    mockMutate.mockResolvedValue({ data: { uploadServiceRequestRole: payload } });

    const result = await uploadServiceRequestRole('base64', 'roles.xlsx', 'Admin');
    expect(result).toEqual(payload);
  });

  it('defaults uploadedBy to Admin', async () => {
    mockMutate.mockResolvedValue({ data: { uploadServiceRequestRole: { uploadId: 'u2', totalRecords: 0, status: 'Processed', message: '', success: true } } });
    await uploadServiceRequestRole('b64');
    expect(mockMutate.mock.calls[0][0].variables.uploadedBy).toBe('Admin');
  });

  it('throws when no data is returned', async () => {
    mockMutate.mockResolvedValue({ data: null });
    await expect(uploadServiceRequestRole('b64')).rejects.toThrow();
  });

  it('throws when mutation rejects', async () => {
    mockMutate.mockRejectedValue(new Error('Network'));
    await expect(uploadServiceRequestRole('b64')).rejects.toThrow('Network');
  });
});

// ─── getServiceRequestRoleUploads ─────────────────────────────────────────────

describe('getServiceRequestRoleUploads', () => {
  it('returns the list of uploads', async () => {
    const rows = [{ uploadId: 'u1', fileName: 'a.xlsx', uploadType: 'Roles', totalRecords: 3, uploadedBy: 'Admin', uploadDate: '2026-01-01', status: 'Processed' }];
    mockQuery.mockResolvedValue({ data: { getServiceRequestRoleUploads: rows } });

    const result = await getServiceRequestRoleUploads();
    expect(result).toEqual(rows);
  });

  it('returns empty array when data is null', async () => {
    mockQuery.mockResolvedValue({ data: null });
    const result = await getServiceRequestRoleUploads();
    expect(result).toEqual([]);
  });
});

// ─── getServiceRequestRoleDetails ─────────────────────────────────────────────

describe('getServiceRequestRoleDetails', () => {
  const detail = {
    uploadId: 'u1', fileName: 'a.xlsx', uploadType: 'Roles', totalRecords: 2,
    uploadedBy: 'Admin', uploadDate: '2026-01-01', status: 'Processed',
    roles: [], conditions: [],
  };

  it('returns the detail object', async () => {
    mockQuery.mockResolvedValue({ data: { getServiceRequestRoleDetails: detail } });
    const result = await getServiceRequestRoleDetails('u1');
    expect(result).toEqual(detail);
  });

  it('throws when no detail is returned', async () => {
    mockQuery.mockResolvedValue({ data: { getServiceRequestRoleDetails: null } });
    await expect(getServiceRequestRoleDetails('u1')).rejects.toThrow();
  });
});

// ─── saveServiceRequestRole ───────────────────────────────────────────────────

describe('saveServiceRequestRole', () => {
  it('returns success response', async () => {
    const resp = { success: true, message: 'Saved', savedCount: 2 };
    mockMutate.mockResolvedValue({ data: { saveServiceRequestRole: resp } });

    const result = await saveServiceRequestRole('u1', []);
    expect(result.success).toBe(true);
  });

  it('throws on no data', async () => {
    mockMutate.mockResolvedValue({ data: null });
    await expect(saveServiceRequestRole('u1', [])).rejects.toThrow();
  });
});

// ─── saveRoleConditions ───────────────────────────────────────────────────────

describe('saveRoleConditions', () => {
  it('returns success response', async () => {
    const resp = { success: true, message: 'Conditions saved', savedCount: 1 };
    mockMutate.mockResolvedValue({ data: { saveRoleConditions: resp } });

    const result = await saveRoleConditions('r1', []);
    expect(result.success).toBe(true);
    expect(result.savedCount).toBe(1);
  });
});

// ─── getAllServiceRequestRoles ─────────────────────────────────────────────────

describe('getAllServiceRequestRoles', () => {
  it('returns all roles', async () => {
    const roles = [{ roleId: 'r1', uploadId: 'u1', roleName: 'Bill Review', description: 'desc', status: 'Active', nlpCondition: '', conditionExpression: '', nlpConditionInWords: '' }];
    mockQuery.mockResolvedValue({ data: { getAllServiceRequestRoles: roles } });

    const result = await getAllServiceRequestRoles();
    expect(result).toEqual(roles);
  });

  it('throws on query rejection', async () => {
    mockQuery.mockRejectedValue(new Error('GraphQL error'));
    await expect(getAllServiceRequestRoles()).rejects.toThrow();
  });
});

// ─── getServiceRequestRoleById ────────────────────────────────────────────────

describe('getServiceRequestRoleById', () => {
  it('returns the role', async () => {
    const role = { roleId: 'r1', uploadId: 'u1', roleName: 'NCM', description: 'desc', status: 'Active', nlpCondition: '', conditionExpression: '', nlpConditionInWords: '' };
    mockQuery.mockResolvedValue({ data: { getServiceRequestRoleById: role } });

    const result = await getServiceRequestRoleById('r1');
    expect(result?.roleId).toBe('r1');
  });

  it('returns null on error instead of throwing', async () => {
    mockQuery.mockRejectedValue(new Error('Not found'));
    const result = await getServiceRequestRoleById('bad-id');
    expect(result).toBeNull();
  });
});

// ─── getRoleConditions ────────────────────────────────────────────────────────

describe('getRoleConditions', () => {
  it('returns array of conditions', async () => {
    const conditions = [{ conditionId: 'c1', roleId: 'r1', fieldName: 'claimAmount', operator: '>', value: '5000', conditionType: 'Simple', sortOrder: 1 }];
    mockQuery.mockResolvedValue({ data: { getRoleConditions: conditions } });

    const result = await getRoleConditions('r1');
    expect(result).toHaveLength(1);
  });

  it('throws on error', async () => {
    mockQuery.mockRejectedValue(new Error('error'));
    await expect(getRoleConditions('r1')).rejects.toThrow();
  });
});

// ─── createServiceRequestRole ─────────────────────────────────────────────────

describe('createServiceRequestRole', () => {
  it('returns success and roleId on creation', async () => {
    mockMutate.mockResolvedValue({ data: { createServiceRequestRole: { success: true, roleId: 'r-new', message: 'Created' } } });

    const result = await createServiceRequestRole('New Role', 'Desc', 'amount > 5000', 'AMOUNT_GT_5000', 'Admin', undefined, ['WCM']);
    expect(result.success).toBe(true);
    expect(result.roleId).toBe('r-new');
  });

  it('throws on no data', async () => {
    mockMutate.mockResolvedValue({ data: null });
    await expect(createServiceRequestRole('R', 'D', '', '', 'Admin', undefined, ['WCM'])).rejects.toThrow();
  });
});

// ─── updateServiceRequestRole ─────────────────────────────────────────────────

describe('updateServiceRequestRole', () => {
  it('returns success response', async () => {
    mockMutate.mockResolvedValue({ data: { updateServiceRequestRole: { success: true, message: 'Updated' } } });

    const result = await updateServiceRequestRole('r1', 'Updated Role', 'New desc', 'Active', '', '', undefined, ['WCM']);
    expect(result.success).toBe(true);
  });
});

// ─── deleteServiceRequestRole ─────────────────────────────────────────────────

describe('deleteServiceRequestRole', () => {
  it('returns success on deletion', async () => {
    mockMutate.mockResolvedValue({ data: { deleteServiceRequestRole: { success: true, message: 'Deleted' } } });

    const result = await deleteServiceRequestRole('r1');
    expect(result.success).toBe(true);
  });
});

// ─── getOperatorOptions ───────────────────────────────────────────────────────

describe('getOperatorOptions', () => {
  it('returns operator options', async () => {
    const ops = [{ operatorId: 'op1', label: 'Greater Than', value: '>', sortOrder: 1 }];
    mockQuery.mockResolvedValue({ data: { getOperatorOptions: ops } });

    const result = await getOperatorOptions();
    expect(result).toEqual(ops);
  });

  it('returns empty array on error', async () => {
    mockQuery.mockRejectedValue(new Error('error'));
    const result = await getOperatorOptions();
    expect(result).toEqual([]);
  });
});

// ─── getFieldOptions ──────────────────────────────────────────────────────────

describe('getFieldOptions', () => {
  it('returns array of field names', async () => {
    mockQuery.mockResolvedValue({ data: { getFieldOptions: ['claimAmount', 'claimType'] } });

    const result = await getFieldOptions();
    expect(result).toContain('claimAmount');
  });

  it('returns empty array on error', async () => {
    mockQuery.mockRejectedValue(new Error('error'));
    const result = await getFieldOptions();
    expect(result).toEqual([]);
  });
});

// ─── getNlpFieldMappings ──────────────────────────────────────────────────────

describe('getNlpFieldMappings', () => {
  it('returns NLP field mappings', async () => {
    const mappings = [{ sourceField: 'claimAmount', nlpAlias: 'amount' }];
    mockQuery.mockResolvedValue({ data: { getNlpFieldMappings: mappings } });

    const result = await getNlpFieldMappings();
    expect(result).toEqual(mappings);
  });

  it('returns empty array on error', async () => {
    mockQuery.mockRejectedValue(new Error('error'));
    const result = await getNlpFieldMappings();
    expect(result).toEqual([]);
  });
});
