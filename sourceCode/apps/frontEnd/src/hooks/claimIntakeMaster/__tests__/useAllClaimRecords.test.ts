import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../../../services/claimIntakeMaster/claimIntakeService', () => ({
  getAllClaimRecords: vi.fn(),
  uploadClaim: vi.fn(),
  getUploadedClaims: vi.fn(),
  getUploadedClaimDetails: vi.fn(),
}));
vi.mock('../../../utils/logError', () => ({ logError: vi.fn() }));

import { useAllClaimRecords } from '../useAllClaimRecords';
import * as claimIntakeService from '../../../services/claimIntakeMaster/claimIntakeService';
import type { IndividualClaimRecord } from '../../../models/claimIntakeMaster/claimIntakeModel';

const baseRecordFields = {
  validationMessage:         '',
  planServices:              [],
  planServiceNames:          [],
  confirmedPlanServices:     [],
  confirmedPlanServiceNames: [],
  planServiceComments:       '',
  vendorServices:            [],
  vendorServiceComments:     '',
  suggestedVendors:          [],
};

const sampleRecords: IndividualClaimRecord[] = [
  { ...baseRecordFields, uploadId: 'u1', recordIndex: 0, claimNumber: 'CLM-001', policyNumber: 'P001', insuredName: 'Alice', claimType: 'Medical', lossDate: '', reportedDate: '', claimAmount: '5000', claimStatus: 'Open', validationStatus: 'Valid', planServiceStatus: 'Pending' },
  { ...baseRecordFields, uploadId: 'u1', recordIndex: 1, claimNumber: 'CLM-002', policyNumber: 'P002', insuredName: 'Bob',   claimType: 'Auto',    lossDate: '', reportedDate: '', claimAmount: '2500', claimStatus: 'Closed', validationStatus: 'Valid', planServiceStatus: 'Completed' },
];

beforeEach(() => {
  vi.mocked(claimIntakeService.getAllClaimRecords).mockResolvedValue(sampleRecords);
});

afterEach(() => { vi.clearAllMocks(); });

// ─── useAllClaimRecords ───────────────────────────────────────────────────────

describe('useAllClaimRecords', () => {
  it('starts in loading state', () => {
    vi.mocked(claimIntakeService.getAllClaimRecords).mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useAllClaimRecords());
    expect(result.current.loading).toBe(true);
  });

  it('loads all claim records on mount', async () => {
    const { result } = renderHook(() => useAllClaimRecords());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.records).toHaveLength(2);
    expect(result.current.error).toBeNull();
    expect(claimIntakeService.getAllClaimRecords).toHaveBeenCalledTimes(1);
  });

  it('populates records with correct data', async () => {
    const { result } = renderHook(() => useAllClaimRecords());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.records[0].claimNumber).toBe('CLM-001');
    expect(result.current.records[1].claimNumber).toBe('CLM-002');
  });

  it('sets error message when the fetch fails', async () => {
    vi.mocked(claimIntakeService.getAllClaimRecords).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAllClaimRecords());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/failed to load/i);
    expect(result.current.records).toHaveLength(0);
  });

  it('exposes a refresh function that reloads the data', async () => {
    const { result } = renderHook(() => useAllClaimRecords());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const extraRecord = { ...sampleRecords[0], claimNumber: 'CLM-003', recordIndex: 2 };
    vi.mocked(claimIntakeService.getAllClaimRecords).mockResolvedValue([...sampleRecords, extraRecord]);

    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.records).toHaveLength(3);
  });

  it('clears the error state on a successful refresh after failure', async () => {
    vi.mocked(claimIntakeService.getAllClaimRecords)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue(sampleRecords);

    const { result } = renderHook(() => useAllClaimRecords());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.records).toHaveLength(2);
  });
});
