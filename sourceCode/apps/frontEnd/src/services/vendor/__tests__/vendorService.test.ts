import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../config/apolloClient', () => ({ getApolloClient: vi.fn() }));
vi.mock('../../../utils/logError', () => ({ logError: vi.fn() }));

import {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  getVendorPanelVendors,
  activateVendorFromPanel,
} from '../vendorService';
import { getApolloClient } from '../../../config/apolloClient';
import type { VendorFormValues } from '../../../models/vendor/vendorModel';

const mockQuery  = vi.fn();
const mockMutate = vi.fn();

beforeEach(() => {
  vi.mocked(getApolloClient).mockReturnValue({ query: mockQuery, mutate: mockMutate } as unknown as ReturnType<typeof getApolloClient>);
  mockQuery.mockReset();
  mockMutate.mockReset();
});

const sampleVendor = {
  vendorId: 'v1', companyName: 'MedReview Inc', emailId: 'med@review.com',
  rating: 4.5, address: '123 Main St', city: 'Austin', state: 'TX',
  country: 'USA', coverage: 'National', status: 'Active', vendorSource: 'Manual',
  requalDue: '', phoneNumber: '555-0001', turnaroundTime: 7,
  serviceRequestRoleId: 'r1', serviceRequestRoleName: 'Bill Review',
  serviceRequestRoleNames: [], createdBy: 'admin', createdAt: '2026-01-01',
  uploadedBy: 'admin', uploadedAt: '2026-01-01',
};

const sampleFormValues: VendorFormValues = {
  companyName: 'MedReview Inc',
  emailId: 'med@review.com',
  phoneNumber: '555-0001',
  serviceRequestRoleId: 'r1',
  rating: '4.5',
  address: '123 Main St',
  city: 'Austin',
  state: 'TX',
  country: 'USA',
  turnaroundTime: '7',
};

// ─── getVendors ───────────────────────────────────────────────────────────────

describe('getVendors', () => {
  it('returns list of vendors', async () => {
    mockQuery.mockResolvedValue({ data: { getVendors: [sampleVendor] } });
    const result = await getVendors();
    expect(result).toHaveLength(1);
    expect(result[0].vendorId).toBe('v1');
  });

  it('returns empty array when data is null', async () => {
    mockQuery.mockResolvedValue({ data: null });
    const result = await getVendors();
    expect(result).toEqual([]);
  });

  it('throws when query rejects', async () => {
    mockQuery.mockRejectedValue(new Error('Network'));
    await expect(getVendors()).rejects.toThrow('Network');
  });
});

// ─── getVendorById ────────────────────────────────────────────────────────────

describe('getVendorById', () => {
  it('returns the matching vendor', async () => {
    mockQuery.mockResolvedValue({ data: { getVendorById: sampleVendor } });
    const result = await getVendorById('v1');
    expect(result.vendorId).toBe('v1');
  });

  it('throws when vendor is not found', async () => {
    mockQuery.mockResolvedValue({ data: { getVendorById: null } });
    await expect(getVendorById('missing')).rejects.toThrow('Vendor not found');
  });

  it('passes vendorId as variable', async () => {
    mockQuery.mockResolvedValue({ data: { getVendorById: sampleVendor } });
    await getVendorById('v1');
    expect(mockQuery.mock.calls[0][0].variables.vendorId).toBe('v1');
  });
});

// ─── createVendor ─────────────────────────────────────────────────────────────

describe('createVendor', () => {
  it('returns success response on creation', async () => {
    mockMutate.mockResolvedValue({ data: { createVendor: { success: true, message: 'Created', vendorId: 'v-new' } } });
    const result = await createVendor(sampleFormValues);
    expect(result.success).toBe(true);
    expect(result.vendorId).toBe('v-new');
  });

  it('converts rating string to float in the input', async () => {
    mockMutate.mockResolvedValue({ data: { createVendor: { success: true, message: '', vendorId: 'v2' } } });
    await createVendor({ ...sampleFormValues, rating: '3.7' });
    const input = mockMutate.mock.calls[0][0].variables.input;
    expect(input.rating).toBe(3.7);
  });

  it('throws when mutation returns no data', async () => {
    mockMutate.mockResolvedValue({ data: null });
    await expect(createVendor(sampleFormValues)).rejects.toThrow();
  });
});

// ─── updateVendor ─────────────────────────────────────────────────────────────

describe('updateVendor', () => {
  it('returns success response', async () => {
    mockMutate.mockResolvedValue({ data: { updateVendor: { success: true, message: 'Updated', vendorId: 'v1' } } });
    const result = await updateVendor('v1', sampleFormValues);
    expect(result.success).toBe(true);
  });

  it('passes vendorId as variable', async () => {
    mockMutate.mockResolvedValue({ data: { updateVendor: { success: true, message: '', vendorId: 'v1' } } });
    await updateVendor('v1', sampleFormValues);
    expect(mockMutate.mock.calls[0][0].variables.vendorId).toBe('v1');
  });

  it('throws on no data', async () => {
    mockMutate.mockResolvedValue({ data: null });
    await expect(updateVendor('v1', sampleFormValues)).rejects.toThrow();
  });
});

// ─── deleteVendor ─────────────────────────────────────────────────────────────

describe('deleteVendor', () => {
  it('returns success response', async () => {
    mockMutate.mockResolvedValue({ data: { deleteVendor: { success: true, message: 'Deleted', vendorId: 'v1' } } });
    const result = await deleteVendor('v1');
    expect(result.success).toBe(true);
  });

  it('passes vendorId as variable', async () => {
    mockMutate.mockResolvedValue({ data: { deleteVendor: { success: true, message: '', vendorId: 'v1' } } });
    await deleteVendor('v1');
    expect(mockMutate.mock.calls[0][0].variables.vendorId).toBe('v1');
  });
});

// ─── getVendorPanelVendors ────────────────────────────────────────────────────

describe('getVendorPanelVendors', () => {
  it('returns vendor panel list', async () => {
    mockQuery.mockResolvedValue({ data: { getVendorPanelVendors: [sampleVendor] } });
    const result = await getVendorPanelVendors();
    expect(result).toHaveLength(1);
  });

  it('returns empty array when null', async () => {
    mockQuery.mockResolvedValue({ data: null });
    const result = await getVendorPanelVendors();
    expect(result).toEqual([]);
  });
});

// ─── activateVendorFromPanel ──────────────────────────────────────────────────

describe('activateVendorFromPanel', () => {
  it('returns success response', async () => {
    mockMutate.mockResolvedValue({ data: { activateVendorFromPanel: { success: true, message: 'Activated', vendorId: 'v1' } } });
    const result = await activateVendorFromPanel('v1');
    expect(result.success).toBe(true);
  });

  it('throws when no data returned', async () => {
    mockMutate.mockResolvedValue({ data: null });
    await expect(activateVendorFromPanel('v1')).rejects.toThrow();
  });
});
