import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('../../../config/apolloClient', () => ({ getApolloClient: vi.fn() }));
vi.mock('../../../utils/logError', () => ({ logError: vi.fn() }));

import {
  uploadClaim,
  getUploadedClaims,
  getUploadedClaimDetails,
  getAllClaimRecords,
  saveVendorServices,
  getAllVendorNames,
  getVendorsByRoleIds,
  completeClaim,
  generateAiClaimSummary,
} from '../claimIntakeService';
import { getApolloClient } from '../../../config/apolloClient';
import { UploadType } from '../../../models/claimIntakeMaster/claimIntakeModel';

const mockQuery  = vi.fn();
const mockMutate = vi.fn();
const mockFetch  = vi.fn();

vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.mocked(getApolloClient).mockReturnValue({ query: mockQuery, mutate: mockMutate } as unknown as ReturnType<typeof getApolloClient>);
  mockQuery.mockReset();
  mockMutate.mockReset();
  mockFetch.mockReset();
});

afterEach(() => { vi.clearAllMocks(); });

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
}

// ─── uploadClaim ──────────────────────────────────────────────────────────────

describe('uploadClaim', () => {
  it('returns the upload response on success', async () => {
    const payload = { uploadId: 'u1', totalClaims: 10, successCount: 10, failedCount: 0, status: 'Processed', validationResult: '', message: 'ok', success: true };
    mockMutate.mockResolvedValue({ data: { uploadClaim: payload } });

    const result = await uploadClaim({ uploadType: UploadType.JSON, jsonPayload: '{}' });
    expect(result.uploadId).toBe('u1');
    expect(result.success).toBe(true);
  });

  it('passes uploadType and payload as variables', async () => {
    mockMutate.mockResolvedValue({ data: { uploadClaim: { uploadId: 'u2', totalClaims: 1, successCount: 1, failedCount: 0, status: 'Processed', validationResult: '', message: '', success: true } } });
    await uploadClaim({ uploadType: UploadType.XML, xmlPayload: '<xml/>' });
    const vars = mockMutate.mock.calls[0][0].variables;
    expect(vars.uploadType).toBe('XML');
    expect(vars.xmlPayload).toBe('<xml/>');
  });

  it('throws when no data is returned', async () => {
    mockMutate.mockResolvedValue({ data: null });
    await expect(uploadClaim({ uploadType: UploadType.JSON })).rejects.toThrow();
  });
});

// ─── getUploadedClaims ────────────────────────────────────────────────────────

describe('getUploadedClaims', () => {
  it('returns the claims grid rows', async () => {
    const rows = [{ uploadId: 'u1', fileName: 'a.json', claimNumber: 'CLM-001', uploadType: 'JSON', totalClaims: 5, uploadedBy: 'Admin', uploadDate: '2026-01-01', status: 'Processed' }];
    mockQuery.mockResolvedValue({ data: { uploadedClaims: rows } });

    const result = await getUploadedClaims();
    expect(result).toHaveLength(1);
    expect(result[0].claimNumber).toBe('CLM-001');
  });

  it('returns empty array when data is null', async () => {
    mockQuery.mockResolvedValue({ data: null });
    const result = await getUploadedClaims();
    expect(result).toEqual([]);
  });

  it('throws when query rejects', async () => {
    mockQuery.mockRejectedValue(new Error('GraphQL error'));
    await expect(getUploadedClaims()).rejects.toThrow('GraphQL error');
  });
});

// ─── getUploadedClaimDetails ──────────────────────────────────────────────────

describe('getUploadedClaimDetails', () => {
  const detail = {
    uploadId: 'u1', fileName: 'a.json', uploadType: 'JSON', totalClaims: 1,
    successCount: 1, failedCount: 0, uploadedBy: 'Admin', uploadDate: '2026-01-01',
    status: 'Processed', records: [],
  };

  it('returns the claim details', async () => {
    mockQuery.mockResolvedValue({ data: { uploadedClaimDetails: detail } });
    const result = await getUploadedClaimDetails('u1');
    expect(result.uploadId).toBe('u1');
  });

  it('passes uploadId as variable', async () => {
    mockQuery.mockResolvedValue({ data: { uploadedClaimDetails: detail } });
    await getUploadedClaimDetails('uid-xyz');
    expect(mockQuery.mock.calls[0][0].variables.uploadId).toBe('uid-xyz');
  });

  it('throws when no details are returned', async () => {
    mockQuery.mockResolvedValue({ data: { uploadedClaimDetails: null } });
    await expect(getUploadedClaimDetails('u1')).rejects.toThrow();
  });
});

// ─── getAllClaimRecords ───────────────────────────────────────────────────────

describe('getAllClaimRecords', () => {
  it('returns all claim records', async () => {
    const records = [{ uploadId: 'u1', recordIndex: 0, claimNumber: 'CLM-001', policyNumber: 'P001', insuredName: 'John', claimType: 'Medical', lossDate: '', reportedDate: '', claimAmount: 5000, claimStatus: 'Open', validationStatus: 'Valid', planServiceStatus: 'Pending' }];
    mockQuery.mockResolvedValue({ data: { getAllClaimRecords: records } });

    const result = await getAllClaimRecords();
    expect(result).toHaveLength(1);
    expect(result[0].claimNumber).toBe('CLM-001');
  });

  it('returns empty array when data is null', async () => {
    mockQuery.mockResolvedValue({ data: null });
    const result = await getAllClaimRecords();
    expect(result).toEqual([]);
  });
});

// ─── saveVendorServices ───────────────────────────────────────────────────────

describe('saveVendorServices', () => {
  it('returns success response', async () => {
    mockMutate.mockResolvedValue({ data: { saveVendorServices: { success: true, message: 'Saved' } } });
    const result = await saveVendorServices({ uploadId: 'u1', recordIndex: 0, vendorServices: ['v1'], planServices: ['Bill Review'], comments: 'ok' });
    expect(result.success).toBe(true);
  });

  it('throws when no data returned', async () => {
    mockMutate.mockResolvedValue({ data: null });
    await expect(saveVendorServices({ uploadId: 'u1', recordIndex: 0, vendorServices: [], planServices: [], comments: '' })).rejects.toThrow();
  });
});

// ─── getAllVendorNames ────────────────────────────────────────────────────────

describe('getAllVendorNames', () => {
  it('returns array of vendor names', async () => {
    mockQuery.mockResolvedValue({ data: { getAllVendorNames: ['MedReview', 'Care Network'] } });
    const result = await getAllVendorNames();
    expect(result).toContain('MedReview');
  });

  it('returns empty array on error', async () => {
    mockQuery.mockRejectedValue(new Error('error'));
    const result = await getAllVendorNames();
    expect(result).toEqual([]);
  });
});

// ─── getVendorsByRoleIds ──────────────────────────────────────────────────────

describe('getVendorsByRoleIds', () => {
  it('returns vendor names for given role IDs', async () => {
    mockQuery.mockResolvedValue({ data: { getVendorsByRoleIds: ['VendorA', 'VendorB'] } });
    const result = await getVendorsByRoleIds(['role-1']);
    expect(result).toContain('VendorA');
  });

  it('returns empty array when no roleIds provided', async () => {
    const result = await getVendorsByRoleIds([]);
    expect(result).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns empty array on error', async () => {
    mockQuery.mockRejectedValue(new Error('error'));
    const result = await getVendorsByRoleIds(['role-1']);
    expect(result).toEqual([]);
  });
});

// ─── completeClaim ────────────────────────────────────────────────────────────

describe('completeClaim', () => {
  it('returns success response', async () => {
    mockMutate.mockResolvedValue({ data: { completeClaim: { success: true, message: 'Completed', completedAt: '2026-07-02T12:00:00Z' } } });
    const result = await completeClaim({ uploadId: 'u1', recordIndex: 0, completedBy: 'admin' });
    expect(result.success).toBe(true);
    expect(result.completedAt).toBe('2026-07-02T12:00:00Z');
  });

  it('returns no-response fallback on null data', async () => {
    mockMutate.mockResolvedValue({ data: null });
    const result = await completeClaim({ uploadId: 'u1', recordIndex: 0 });
    expect(result.success).toBe(false);
  });

  it('returns failure message on mutation rejection', async () => {
    mockMutate.mockRejectedValue(new Error('error'));
    const result = await completeClaim({ uploadId: 'u1', recordIndex: 0 });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/failed/i);
  });
});

// ─── generateAiClaimSummary ───────────────────────────────────────────────────

describe('generateAiClaimSummary', () => {
  it('returns the AI summary string', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, summary: 'Claim is valid and high priority.' }));
    const result = await generateAiClaimSummary({ claimNumber: 'CLM-001' });
    expect(result).toBe('Claim is valid and high priority.');
  });

  it('sends the claim as POST body', async () => {
    mockFetch.mockReturnValue(okJson({ success: true, summary: 'ok' }));
    await generateAiClaimSummary({ claimNumber: 'CLM-001', claimAmount: 5000 });
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.claimNumber).toBe('CLM-001');
  });

  it('throws when AI returns success false', async () => {
    mockFetch.mockReturnValue(Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: false, message: 'AI failed' }),
    } as Response));
    await expect(generateAiClaimSummary({})).rejects.toThrow('AI failed');
  });
});
