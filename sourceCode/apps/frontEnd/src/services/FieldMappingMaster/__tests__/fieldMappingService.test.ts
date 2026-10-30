import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../config/apolloClient', () => ({ getApolloClient: vi.fn() }));
vi.mock('../../../utils/logError', () => ({ logError: vi.fn() }));

import {
  uploadFieldMappingFile,
  getUploadedFiles,
  getFieldMappingDetails,
  saveFieldMapping,
  downloadTemplate,
} from '../fieldMappingService';
import { getApolloClient } from '../../../config/apolloClient';

const mockQuery  = vi.fn();
const mockMutate = vi.fn();

beforeEach(() => {
  vi.mocked(getApolloClient).mockReturnValue({ query: mockQuery, mutate: mockMutate } as unknown as ReturnType<typeof getApolloClient>);
  mockQuery.mockReset();
  mockMutate.mockReset();
});

// ─── uploadFieldMappingFile ───────────────────────────────────────────────────

describe('uploadFieldMappingFile', () => {
  it('returns the upload response on success', async () => {
    const payload = { uploadId: 'u1', totalRecords: 10, status: 'Processed', message: 'ok', success: true };
    mockMutate.mockResolvedValue({ data: { uploadFieldMappingFile: payload } });

    const result = await uploadFieldMappingFile('base64data', 'file.xlsx', 'Admin');
    expect(result).toEqual(payload);
  });

  it('passes excelBase64, fileName and uploadedBy as variables', async () => {
    const payload = { uploadId: 'u2', totalRecords: 5, status: 'Processed', message: '', success: true };
    mockMutate.mockResolvedValue({ data: { uploadFieldMappingFile: payload } });

    await uploadFieldMappingFile('abc123', 'test.xlsx', 'user1');
    const variables = mockMutate.mock.calls[0][0].variables;
    expect(variables.excelBase64).toBe('abc123');
    expect(variables.fileName).toBe('test.xlsx');
    expect(variables.uploadedBy).toBe('user1');
  });

  it('defaults uploadedBy to Admin when not provided', async () => {
    mockMutate.mockResolvedValue({ data: { uploadFieldMappingFile: { uploadId: 'u3', totalRecords: 0, status: 'Processed', message: '', success: true } } });
    await uploadFieldMappingFile('b64');
    expect(mockMutate.mock.calls[0][0].variables.uploadedBy).toBe('Admin');
  });

  it('throws when no data is returned', async () => {
    mockMutate.mockResolvedValue({ data: null });
    await expect(uploadFieldMappingFile('b64')).rejects.toThrow();
  });

  it('throws when the mutation itself rejects', async () => {
    mockMutate.mockRejectedValue(new Error('Network error'));
    await expect(uploadFieldMappingFile('b64')).rejects.toThrow('Network error');
  });
});

// ─── getUploadedFiles ─────────────────────────────────────────────────────────

describe('getUploadedFiles', () => {
  it('returns the array of uploaded files', async () => {
    const rows = [{ uploadId: 'u1', fileName: 'a.xlsx', uploadType: 'Claims', totalRecords: 10, uploadedBy: 'Admin', uploadDate: '2026-01-01', status: 'Processed' }];
    mockQuery.mockResolvedValue({ data: { getUploadedFiles: rows } });

    const result = await getUploadedFiles();
    expect(result).toEqual(rows);
  });

  it('returns empty array when data is undefined', async () => {
    mockQuery.mockResolvedValue({ data: null });
    const result = await getUploadedFiles();
    expect(result).toEqual([]);
  });

  it('throws when query rejects', async () => {
    mockQuery.mockRejectedValue(new Error('GraphQL error'));
    await expect(getUploadedFiles()).rejects.toThrow('GraphQL error');
  });
});

// ─── getFieldMappingDetails ───────────────────────────────────────────────────

describe('getFieldMappingDetails', () => {
  const detail = {
    uploadId: 'u1', fileName: 'a.xlsx', uploadType: 'Claims', totalRecords: 5,
    uploadedBy: 'Admin', uploadDate: '2026-01-01', status: 'Processed',
    headers: ['col1'], records: [], mappings: [],
  };

  it('returns the detail object', async () => {
    mockQuery.mockResolvedValue({ data: { getFieldMappingDetails: detail } });
    const result = await getFieldMappingDetails('u1');
    expect(result).toEqual(detail);
  });

  it('passes uploadId as a variable', async () => {
    mockQuery.mockResolvedValue({ data: { getFieldMappingDetails: detail } });
    await getFieldMappingDetails('uid-xyz');
    expect(mockQuery.mock.calls[0][0].variables.uploadId).toBe('uid-xyz');
  });

  it('throws when no details are returned', async () => {
    mockQuery.mockResolvedValue({ data: { getFieldMappingDetails: null } });
    await expect(getFieldMappingDetails('u1')).rejects.toThrow();
  });
});

// ─── saveFieldMapping ─────────────────────────────────────────────────────────

describe('saveFieldMapping', () => {
  it('returns the save response on success', async () => {
    const resp = { success: true, message: 'Saved', savedCount: 3 };
    mockMutate.mockResolvedValue({ data: { saveFieldMapping: resp } });

    const mappings = [{ mappingId: 'm1', uploadId: 'u1', sourceField: 'col1', targetField: 'field1', dataType: 'String', isMandatory: true, sortOrder: 1 }];
    const result = await saveFieldMapping('u1', mappings);
    expect(result).toEqual(resp);
  });

  it('throws when mutation returns no data', async () => {
    mockMutate.mockResolvedValue({ data: null });
    await expect(saveFieldMapping('u1', [])).rejects.toThrow();
  });
});

// ─── downloadTemplate ─────────────────────────────────────────────────────────

describe('downloadTemplate', () => {
  it('returns success response with base64 data', async () => {
    const resp = { success: true, base64: 'abc==', fileName: 'template.xlsx', message: '' };
    mockMutate.mockResolvedValue({ data: { downloadTemplate: resp } });

    const result = await downloadTemplate('u1');
    expect(result.success).toBe(true);
    expect(result.base64).toBe('abc==');
  });

  it('passes null uploadId when not provided', async () => {
    const resp = { success: true, base64: '', fileName: 'template.xlsx', message: '' };
    mockMutate.mockResolvedValue({ data: { downloadTemplate: resp } });

    await downloadTemplate();
    expect(mockMutate.mock.calls[0][0].variables.uploadId).toBeNull();
  });

  it('throws when no data is returned', async () => {
    mockMutate.mockResolvedValue({ data: null });
    await expect(downloadTemplate()).rejects.toThrow();
  });
});
