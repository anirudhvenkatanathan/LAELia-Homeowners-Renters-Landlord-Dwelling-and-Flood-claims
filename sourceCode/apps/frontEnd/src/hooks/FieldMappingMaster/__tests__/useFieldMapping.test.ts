import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../../../services/FieldMappingMaster/fieldMappingService', () => ({
  getUploadedFiles: vi.fn(),
  uploadFieldMappingFile: vi.fn(),
  getFieldMappingDetails: vi.fn(),
  saveFieldMapping: vi.fn(),
  downloadTemplate: vi.fn(),
}));
vi.mock('../../../utils/logError', () => ({ logError: vi.fn() }));

import { useFieldMapping } from '../useFieldMapping';
import * as fieldMappingService from '../../../services/FieldMappingMaster/fieldMappingService';

const sampleFiles = [
  { uploadId: 'u1', fileName: 'a.xlsx', uploadType: 'Claims', totalRecords: 5, uploadedBy: 'Admin', uploadDate: '2026-01-01', status: 'Processed' },
  { uploadId: 'u2', fileName: 'b.xlsx', uploadType: 'Claims', totalRecords: 3, uploadedBy: 'Admin', uploadDate: '2026-01-02', status: 'Failed' },
];

beforeEach(() => {
  vi.mocked(fieldMappingService.getUploadedFiles).mockResolvedValue(sampleFiles);
});

afterEach(() => { vi.clearAllMocks(); });

// ─── useFieldMapping ──────────────────────────────────────────────────────────

describe('useFieldMapping', () => {
  it('fetches uploaded files on mount', async () => {
    const { result } = renderHook(() => useFieldMapping());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.uploadedFiles).toHaveLength(2);
    expect(fieldMappingService.getUploadedFiles).toHaveBeenCalledTimes(1);
  });

  it('starts in loading state before files are fetched', () => {
    vi.mocked(fieldMappingService.getUploadedFiles).mockImplementation(
      () => new Promise(() => {})
    );
    const { result } = renderHook(() => useFieldMapping());
    expect(result.current.isLoading).toBe(true);
  });

  it('stores uploaded files after successful fetch', async () => {
    const { result } = renderHook(() => useFieldMapping());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.uploadedFiles[0].uploadId).toBe('u1');
    expect(result.current.uploadedFiles[1].uploadId).toBe('u2');
  });

  it('sets error when fetch fails', async () => {
    vi.mocked(fieldMappingService.getUploadedFiles).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFieldMapping());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.errors['grid']).toMatch(/failed to load/i);
    expect(result.current.uploadedFiles).toHaveLength(0);
  });

  it('clears errors after a successful fetch', async () => {
    vi.mocked(fieldMappingService.getUploadedFiles)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue(sampleFiles);

    const { result } = renderHook(() => useFieldMapping());
    await waitFor(() => expect(result.current.errors['grid']).toBeDefined());

    await act(async () => { await result.current.fetchUploadedFiles(); });
    expect(result.current.errors['grid']).toBeUndefined();
  });

  it('handleUploadSuccess re-fetches the file list', async () => {
    const { result } = renderHook(() => useFieldMapping());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCount = vi.mocked(fieldMappingService.getUploadedFiles).mock.calls.length;

    await act(async () => { result.current.handleUploadSuccess(); });

    await waitFor(() => {
      expect(vi.mocked(fieldMappingService.getUploadedFiles).mock.calls.length).toBeGreaterThan(callCount);
    });
  });

  it('exposes fetchUploadedFiles as a callable function', async () => {
    const { result } = renderHook(() => useFieldMapping());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(typeof result.current.fetchUploadedFiles).toBe('function');
  });
});
