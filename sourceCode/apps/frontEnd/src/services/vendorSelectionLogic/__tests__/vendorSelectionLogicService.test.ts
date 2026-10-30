import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../config/apolloClient', () => ({ getApolloClient: vi.fn() }));
vi.mock('../../../utils/logError', () => ({ logError: vi.fn() }));

import {
  getVendorSelectionLogicList,
  getVendorSelectionLogicDetails,
  createVendorSelectionLogic,
  updateVendorSelectionLogic,
  deleteVendorSelectionLogic,
} from '../vendorSelectionLogicService';
import { getApolloClient } from '../../../config/apolloClient';
import type { VendorSelectionLogicFormValues } from '../../../models/vendorSelectionLogic/vendorSelectionLogicModel';

const mockQuery  = vi.fn();
const mockMutate = vi.fn();

beforeEach(() => {
  vi.mocked(getApolloClient).mockReturnValue({ query: mockQuery, mutate: mockMutate } as unknown as ReturnType<typeof getApolloClient>);
  mockQuery.mockReset();
  mockMutate.mockReset();
});

const sampleLogic = {
  ruleId: 'rule-1', name: 'High Value Claim', category: 'Medical',
  description: 'Route high-value claims', status: 'Active',
  conditions: 'amount > 10000', createdBy: 'admin', createdOn: '2026-01-01',
  updatedBy: 'admin', updatedOn: '2026-01-01',
};

const sampleFormValues: VendorSelectionLogicFormValues = {
  name: 'High Value Claim',
  category: 'Medical',
  description: 'Route high-value claims',
  status: 'Active',
  conditions: 'amount > 10000',
};

// ─── getVendorSelectionLogicList ──────────────────────────────────────────────

describe('getVendorSelectionLogicList', () => {
  it('returns the list of logic rules', async () => {
    mockQuery.mockResolvedValue({ data: { getVendorSelectionLogicList: [sampleLogic] } });
    const result = await getVendorSelectionLogicList();
    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe('rule-1');
  });

  it('returns empty array when data is empty', async () => {
    mockQuery.mockResolvedValue({ data: { getVendorSelectionLogicList: [] } });
    const result = await getVendorSelectionLogicList();
    expect(result).toEqual([]);
  });

  it('throws when query rejects', async () => {
    mockQuery.mockRejectedValue(new Error('GraphQL error'));
    await expect(getVendorSelectionLogicList()).rejects.toThrow();
  });
});

// ─── getVendorSelectionLogicDetails ──────────────────────────────────────────

describe('getVendorSelectionLogicDetails', () => {
  it('returns the logic detail', async () => {
    mockQuery.mockResolvedValue({ data: { getVendorSelectionLogicDetails: sampleLogic } });
    const result = await getVendorSelectionLogicDetails('rule-1');
    expect(result?.ruleId).toBe('rule-1');
  });

  it('returns null when not found', async () => {
    mockQuery.mockResolvedValue({ data: { getVendorSelectionLogicDetails: null } });
    const result = await getVendorSelectionLogicDetails('missing');
    expect(result).toBeNull();
  });

  it('passes ruleId as variable', async () => {
    mockQuery.mockResolvedValue({ data: { getVendorSelectionLogicDetails: sampleLogic } });
    await getVendorSelectionLogicDetails('rule-1');
    expect(mockQuery.mock.calls[0][0].variables.ruleId).toBe('rule-1');
  });

  it('throws when query rejects', async () => {
    mockQuery.mockRejectedValue(new Error('Not found'));
    await expect(getVendorSelectionLogicDetails('rule-1')).rejects.toThrow();
  });
});

// ─── createVendorSelectionLogic ───────────────────────────────────────────────

describe('createVendorSelectionLogic', () => {
  it('returns success response with ruleId', async () => {
    mockMutate.mockResolvedValue({ data: { createVendorSelectionLogic: { success: true, message: 'Created', ruleId: 'rule-new' } } });
    const result = await createVendorSelectionLogic(sampleFormValues, 'Admin');
    expect(result.success).toBe(true);
    expect(result.ruleId).toBe('rule-new');
  });

  it('trims whitespace from string fields in the input', async () => {
    mockMutate.mockResolvedValue({ data: { createVendorSelectionLogic: { success: true, message: '', ruleId: 'r' } } });
    await createVendorSelectionLogic({ ...sampleFormValues, name: '  Padded Name  ' }, 'Admin');
    const input = mockMutate.mock.calls[0][0].variables.input;
    expect(input.name).toBe('Padded Name');
  });

  it('throws when mutation rejects', async () => {
    mockMutate.mockRejectedValue(new Error('Mutation error'));
    await expect(createVendorSelectionLogic(sampleFormValues)).rejects.toThrow();
  });
});

// ─── updateVendorSelectionLogic ───────────────────────────────────────────────

describe('updateVendorSelectionLogic', () => {
  it('returns success response', async () => {
    mockMutate.mockResolvedValue({ data: { updateVendorSelectionLogic: { success: true, message: 'Updated', ruleId: 'rule-1' } } });
    const result = await updateVendorSelectionLogic('rule-1', sampleFormValues, 'Admin');
    expect(result.success).toBe(true);
  });

  it('passes ruleId as variable', async () => {
    mockMutate.mockResolvedValue({ data: { updateVendorSelectionLogic: { success: true, message: '', ruleId: 'rule-1' } } });
    await updateVendorSelectionLogic('rule-1', sampleFormValues);
    expect(mockMutate.mock.calls[0][0].variables.ruleId).toBe('rule-1');
  });
});

// ─── deleteVendorSelectionLogic ───────────────────────────────────────────────

describe('deleteVendorSelectionLogic', () => {
  it('returns success response', async () => {
    mockMutate.mockResolvedValue({ data: { deleteVendorSelectionLogic: { success: true, message: 'Deleted', ruleId: 'rule-1' } } });
    const result = await deleteVendorSelectionLogic('rule-1');
    expect(result.success).toBe(true);
  });

  it('throws when mutation rejects', async () => {
    mockMutate.mockRejectedValue(new Error('Delete failed'));
    await expect(deleteVendorSelectionLogic('rule-1')).rejects.toThrow();
  });
});
