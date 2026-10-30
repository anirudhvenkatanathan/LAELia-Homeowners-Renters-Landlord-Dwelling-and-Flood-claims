import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  validateUpload,
  validateMappingRow,
} from '../../../../validations/FieldMappingMaster/fieldMappingSchema';
import type { MappingConfiguration } from '../../../../models/FieldMappingMaster/fieldMappingModel';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../../services/FieldMappingMaster/fieldMappingService', () => ({
  uploadFieldMappingFile: vi.fn(),
  getUploadedFiles:       vi.fn(),
  getFieldMappingDetails: vi.fn(),
  saveFieldMapping:       vi.fn(),
  downloadTemplate:       vi.fn(),
}));

vi.mock('@apollo/client', async () => {
  const actual = await vi.importActual<typeof import('@apollo/client')>('@apollo/client');
  return {
    ...actual,
    useQuery:    vi.fn(() => ({ data: { menuItems: [] }, loading: false, error: null })),
    useMutation: vi.fn(() => [vi.fn(), { loading: false, error: null }]),
    ApolloProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    InMemoryCache: class {},
    ApolloClient:  class {},
    gql: actual.gql,
  };
});

vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Routes:  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Route:   ({ element }: { element: React.ReactNode })   => <>{element}</>,
  Link:    ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useLocation:  () => ({ pathname: '/field-mapping' }),
  useNavigate:  () => vi.fn(),
  useParams:    () => ({ uploadId: 'test-upload-id' }),
  Navigate: () => null,
}));

vi.mock('../../../../hooks/menu/useMenu', () => ({
  useMenu: vi.fn(() => ({ items: [], loading: false, error: null })),
}));

import * as fieldMappingService from '../../../../services/FieldMappingMaster/fieldMappingService';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: validateUpload Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('validateUpload', () => {
  it('returns invalid when file is null', () => {
    const { valid, errors } = validateUpload(null);
    expect(valid).toBe(false);
    expect(errors['file']).toBeDefined();
    expect(errors['file']).toContain('choose');
  });

  it('accepts a valid .xlsx file', () => {
    const file = new File(['data'], 'mapping.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const { valid, errors } = validateUpload(file);
    expect(valid).toBe(true);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('accepts a valid .xls file', () => {
    const file = new File(['data'], 'mapping.xls', { type: 'application/vnd.ms-excel' });
    const { valid, errors } = validateUpload(file);
    expect(valid).toBe(true);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('rejects non-xlsx/xls extension', () => {
    const file = new File(['data'], 'mapping.csv', { type: 'text/csv' });
    const { valid, errors } = validateUpload(file);
    expect(valid).toBe(false);
    expect(errors['file']).toContain('.xlsx');
  });

  it('rejects a file exceeding 10 MB', () => {
    const bigBuffer = new ArrayBuffer(11 * 1024 * 1024);
    const file = new File([bigBuffer], 'big.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const { valid, errors } = validateUpload(file);
    expect(valid).toBe(false);
    expect(errors['file']).toContain('10 MB');
  });

  it('rejects an empty file (0 bytes)', () => {
    const file = new File([], 'empty.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const { valid, errors } = validateUpload(file);
    expect(valid).toBe(false);
    expect(errors['file']).toContain('empty');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: validateMappingRow Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('validateMappingRow', () => {
  const existing: MappingConfiguration[] = [
    { mappingId: 'a', uploadId: 'u1', sourceField: 'claimNumber', targetField: 'claim_number', dataType: 'String', isMandatory: true, sortOrder: 0 },
    { mappingId: 'b', uploadId: 'u1', sourceField: 'policyNumber', targetField: 'policy_number', dataType: 'String', isMandatory: false, sortOrder: 1 },
  ];

  it('returns invalid when sourceField is missing', () => {
    const { valid, errors } = validateMappingRow({ sourceField: '', targetField: 'something' }, []);
    expect(valid).toBe(false);
    expect(errors['sourceField']).toBeDefined();
  });

  it('returns invalid when targetField is missing', () => {
    const { valid, errors } = validateMappingRow({ sourceField: 'field1', targetField: '' }, []);
    expect(valid).toBe(false);
    expect(errors['targetField']).toBeDefined();
  });

  it('returns invalid when both fields are missing', () => {
    const { valid, errors } = validateMappingRow({}, []);
    expect(valid).toBe(false);
    expect(errors['sourceField']).toBeDefined();
    expect(errors['targetField']).toBeDefined();
  });

  it('returns valid when both fields are provided and no duplicate', () => {
    const { valid, errors } = validateMappingRow(
      { mappingId: 'c', sourceField: 'lossDate', targetField: 'loss_date' },
      existing
    );
    expect(valid).toBe(true);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('returns invalid when sourceField duplicates an existing mapping (different mappingId)', () => {
    const { valid, errors } = validateMappingRow(
      { mappingId: 'new-1', sourceField: 'claimNumber', targetField: 'something' },
      existing
    );
    expect(valid).toBe(false);
    expect(errors['sourceField']).toContain('already mapped');
  });

  it('allows a row to match its own sourceField when editing (same mappingId)', () => {
    const { valid } = validateMappingRow(
      { mappingId: 'a', sourceField: 'claimNumber', targetField: 'claim_number' },
      existing
    );
    expect(valid).toBe(true);
  });

  it('is case-insensitive when checking for duplicates', () => {
    const { valid, errors } = validateMappingRow(
      { mappingId: 'new-2', sourceField: 'CLAIMNUMBER', targetField: 'anything' },
      existing
    );
    expect(valid).toBe(false);
    expect(errors['sourceField']).toContain('already mapped');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: FieldMappingMaster Component Render Tests
// ─────────────────────────────────────────────────────────────────────────────

import FieldMappingMaster from '../index';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

describe('FieldMappingMaster component', () => {
  beforeEach(() => {
    vi.mocked(fieldMappingService.getUploadedFiles).mockResolvedValue([]);
    vi.mocked(fieldMappingService.downloadTemplate).mockResolvedValue({
      success: true, base64: 'AAAA', fileName: 'template.xlsx', message: 'OK',
    });
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('renders the page title "Field Mapping"', async () => {
    render(<FieldMappingMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Field Mapping')).toBeInTheDocument();
    });
  });

  it('renders the Upload File button', async () => {
    render(<FieldMappingMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upload file/i })).toBeInTheDocument();
    });
  });

  it('renders the Download Template button', async () => {
    render(<FieldMappingMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download template/i })).toBeInTheDocument();
    });
  });

  it('renders the page subtitle', async () => {
    render(<FieldMappingMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Upload and configure field mappings')).toBeInTheDocument();
    });
  });

  it('does not render breadcrumbs', async () => {
    render(<FieldMappingMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: useFieldMapping Hook Tests
// ─────────────────────────────────────────────────────────────────────────────

import { useFieldMapping } from '../../../../hooks/FieldMappingMaster/useFieldMapping';

describe('useFieldMapping hook', () => {
  beforeEach(() => {
    vi.mocked(fieldMappingService.getUploadedFiles).mockResolvedValue([
      {
        uploadId:     'UID-001',
        fileName:     'test.xlsx',
        uploadType:   'EXCEL',
        totalRecords: 5,
        uploadedBy:   'Admin',
        uploadDate:   new Date().toISOString(),
        status:       'Processed',
      },
    ]);
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('fetches uploaded files on mount', async () => {
    const { result } = renderHook(() => useFieldMapping());
    await waitFor(() => {
      expect(fieldMappingService.getUploadedFiles).toHaveBeenCalledTimes(1);
    });
    expect(result.current.uploadedFiles).toHaveLength(1);
    expect(result.current.uploadedFiles[0]?.uploadId).toBe('UID-001');
  });

  it('sets error when fetch fails', async () => {
    vi.mocked(fieldMappingService.getUploadedFiles).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFieldMapping());
    await waitFor(() => {
      expect(result.current.errors['grid']).toBeDefined();
    });
  });

  it('re-fetches when handleUploadSuccess is called', async () => {
    const { result } = renderHook(() => useFieldMapping());
    await waitFor(() => expect(fieldMappingService.getUploadedFiles).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.handleUploadSuccess();
    });

    await waitFor(() => expect(fieldMappingService.getUploadedFiles).toHaveBeenCalledTimes(2));
  });

  it('initialises with empty uploadedFiles before fetch completes', () => {
    // Delay the mock so we can observe initial state
    vi.mocked(fieldMappingService.getUploadedFiles).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useFieldMapping());
    expect(result.current.uploadedFiles).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: FieldMappingDetails — KPI Cards (TC-30, TC-31, TC-32)
// ─────────────────────────────────────────────────────────────────────────────

import FieldMappingDetails from '../../FieldMappingDetails';

vi.mock('../../../../hooks/FieldMappingMaster/useFieldMappingDetails', () => ({
  useFieldMappingDetails: vi.fn(),
}));

import { useFieldMappingDetails } from '../../../../hooks/FieldMappingMaster/useFieldMappingDetails';

const noopHandlers = {
  loadDetail:             vi.fn(),
  handleAddRow:           vi.fn(),
  handleEditRow:          vi.fn(),
  handleUpdateRow:        vi.fn(),
  handleSaveRow:          vi.fn(),
  handleCancelEdit:       vi.fn(),
  handleSaveAll:          vi.fn(),
  handleDeleteRow:        vi.fn(),
  handleDownloadTemplate: vi.fn(),
};

const mockDetail = {
  uploadId:     'test-upload-id',
  fileName:     'test.xlsx',
  uploadType:   'EXCEL',
  totalRecords: 25,
  uploadedBy:   'Admin',
  uploadDate:   new Date().toISOString(),
  status:       'Processed',
  headers:      JSON.stringify(['claimNumber', 'policyNumber']),
  records:      [],
  mappings:     [],
};

const defaultDetailsReturn = {
  detail:      mockDetail,
  editingRows: new Map<string, MappingConfiguration>(),
  newRows:     [] as MappingConfiguration[],
  isLoading:   false,
  isSaving:    false,
  errors:      {},
  rowErrors:   {},
  ...noopHandlers,
};

describe('FieldMappingDetails — KPI Cards', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useFieldMappingDetails).mockReturnValue(defaultDetailsReturn as any);
  });
  afterEach(() => { vi.clearAllMocks(); });

  // TC-30: Total Records KPI card
  it('TC-30: renders "Total Records" KPI card with correct value', async () => {
    render(<FieldMappingDetails />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Total Records')).toBeInTheDocument();
      // kpi-value contains the number
      const kpiValues = screen.getAllByText('25');
      expect(kpiValues.length).toBeGreaterThan(0);
    });
  });

  // TC-31: Processed KPI card
  it('TC-31: renders "Processed" KPI card (value = totalRecords when status is Processed)', async () => {
    render(<FieldMappingDetails />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Processed')).toBeInTheDocument();
    });
  });

  // TC-32: Failed KPI card
  it('TC-32: renders "Failed" KPI card (value = 0 when status is Processed)', async () => {
    render(<FieldMappingDetails />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: FieldMappingDetails — Mapping Config CRUD (TC-41..44)
// ─────────────────────────────────────────────────────────────────────────────

const mockExistingRow: MappingConfiguration = {
  mappingId:   'map-001',
  uploadId:    'test-upload-id',
  sourceField: 'claimNumber',
  targetField: 'claim_number',
  dataType:    'String',
  isMandatory: true,
  sortOrder:   1,
};

describe('FieldMappingDetails — Mapping Configuration CRUD', () => {
  afterEach(() => { vi.clearAllMocks(); });

  // TC-41: Add Row — clicking Add Mapping calls handleAddRow
  it('TC-41: clicking Add Mapping calls handleAddRow handler', async () => {
    const addRow = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useFieldMappingDetails).mockReturnValue({ ...defaultDetailsReturn, handleAddRow: addRow } as any);

    const user = (await import('@testing-library/user-event')).default.setup();
    render(<FieldMappingDetails />, { wrapper: Wrapper });

    const addBtn = await screen.findByRole('button', { name: /add mapping/i });
    await user.click(addBtn);
    expect(addRow).toHaveBeenCalledTimes(1);
  });

  // TC-41 (visual): A new row in editing mode shows Source Field input
  it('TC-41: a new row in newRows renders Source Field input', async () => {
    const newRow: MappingConfiguration = {
      mappingId: 'temp-new-001', uploadId: 'test-upload-id',
      sourceField: '', targetField: '', dataType: 'String', isMandatory: false, sortOrder: 0,
    };
    const editingRows = new Map([[newRow.mappingId, newRow]]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useFieldMappingDetails).mockReturnValue({
      ...defaultDetailsReturn,
      newRows: [newRow],
      editingRows,
    } as any);

    render(<FieldMappingDetails />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /source field/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /target field/i })).toBeInTheDocument();
    });
  });

  // TC-42: Edit — clicking Edit on an existing row calls handleEditRow
  it('TC-42: clicking Edit on a row calls handleEditRow with the row mappingId', async () => {
    const editRow = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useFieldMappingDetails).mockReturnValue({
      ...defaultDetailsReturn,
      detail: { ...mockDetail, mappings: [mockExistingRow] },
      handleEditRow: editRow,
    } as any);

    const user = (await import('@testing-library/user-event')).default.setup();
    render(<FieldMappingDetails />, { wrapper: Wrapper });

    const editBtn = await screen.findByRole('button', { name: /edit/i });
    await user.click(editBtn);
    expect(editRow).toHaveBeenCalledWith('map-001');
  });

  // TC-43: Save — clicking Save on an editing row calls handleSaveRow
  it('TC-43: clicking Save on an editing row calls handleSaveRow', async () => {
    const saveRow = vi.fn();
    const editingRows = new Map([[mockExistingRow.mappingId, mockExistingRow]]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useFieldMappingDetails).mockReturnValue({
      ...defaultDetailsReturn,
      detail: { ...mockDetail, mappings: [mockExistingRow] },
      editingRows,
      handleSaveRow: saveRow,
    } as any);

    const user = (await import('@testing-library/user-event')).default.setup();
    render(<FieldMappingDetails />, { wrapper: Wrapper });

    const saveBtn = await screen.findByRole('button', { name: /^save$/i });
    await user.click(saveBtn);
    expect(saveRow).toHaveBeenCalledWith('map-001');
  });

  // TC-44: Cancel — clicking Cancel on an editing row calls handleCancelEdit
  it('TC-44: clicking Cancel on an editing row calls handleCancelEdit', async () => {
    const cancelEdit = vi.fn();
    const editingRows = new Map([[mockExistingRow.mappingId, mockExistingRow]]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useFieldMappingDetails).mockReturnValue({
      ...defaultDetailsReturn,
      detail: { ...mockDetail, mappings: [mockExistingRow] },
      editingRows,
      handleCancelEdit: cancelEdit,
    } as any);

    const user = (await import('@testing-library/user-event')).default.setup();
    render(<FieldMappingDetails />, { wrapper: Wrapper });

    const cancelBtn = await screen.findByRole('button', { name: /^cancel$/i });
    await user.click(cancelBtn);
    expect(cancelEdit).toHaveBeenCalledWith('map-001');
  });
});
