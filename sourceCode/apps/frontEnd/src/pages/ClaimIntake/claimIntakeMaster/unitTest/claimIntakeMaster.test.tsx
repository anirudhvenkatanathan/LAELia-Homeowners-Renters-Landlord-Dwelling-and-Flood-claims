import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { UploadType } from '../../../../models/claimIntakeMaster/claimIntakeModel';
import {
  validateClaimIntakeForm,
} from '../../../../validations/claimIntakeMaster/claimIntakeSchema';

// ─── Mock claimIntakeService ──────────────────────────────────────────────────

vi.mock('../../../../services/claimIntakeMaster/claimIntakeService', () => ({
  uploadClaim: vi.fn(),
  getUploadedClaims: vi.fn(),
  getUploadedClaimDetails: vi.fn(),
  getAllClaimRecords: vi.fn(),
}));

// ─── Mock Apollo Client ───────────────────────────────────────────────────────

vi.mock('@apollo/client', async () => {
  const actual = await vi.importActual<typeof import('@apollo/client')>('@apollo/client');
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: { menuItems: [] }, loading: false, error: null })),
    useMutation: vi.fn(() => [vi.fn(), { loading: false, error: null }]),
    ApolloProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    InMemoryCache: class {},
    ApolloClient: class {},
    gql: actual.gql,
  };
});

// ─── Mock react-router-dom ────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Routes: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Route: ({ element }: { element: React.ReactNode }) => <>{element}</>,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/claim-intake' }),
  useNavigate: () => vi.fn(),
  Navigate: () => null,
}));

// ─── Mock useMenu ─────────────────────────────────────────────────────────────

vi.mock('../../../../hooks/menu/useMenu', () => ({
  useMenu: vi.fn(() => ({ items: [], loading: false, error: null })),
}));

// ─── Mock useAuth ─────────────────────────────────────────────────────────────

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

import * as claimIntakeService from '../../../../services/claimIntakeMaster/claimIntakeService';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Validation Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('validateClaimIntakeForm', () => {
  it('returns invalid when uploadType is null', () => {
    const result = validateClaimIntakeForm({ uploadType: null });
    expect(result.valid).toBe(false);
    expect(result.errors['uploadType']).toBeDefined();
  });

  it('returns valid when uploadType is set with no other requirements', () => {
    // For EXCEL, file is also required — test EXCEL separately
    // For JSON with payload
    const result = validateClaimIntakeForm({
      uploadType: UploadType.JSON,
      jsonPayload: '{"claimNumber":"C1","policyNumber":"P1","insuredName":"Jane","lossDate":"2026-01-01","reportedDate":"2026-01-02","claimType":"Auto"}',
    });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  describe('EXCEL upload type', () => {
    it('requires file when uploadType is EXCEL', () => {
      const result = validateClaimIntakeForm({ uploadType: UploadType.EXCEL, file: null });
      expect(result.valid).toBe(false);
      expect(result.errors['file']).toContain('required');
    });

    it('rejects non-xlsx/xls file', () => {
      const file = new File(['data'], 'test.pdf', { type: 'application/pdf' });
      const result = validateClaimIntakeForm({ uploadType: UploadType.EXCEL, file });
      expect(result.valid).toBe(false);
      expect(result.errors['file']).toContain('.xlsx');
    });

    it('rejects file exceeding 10MB', () => {
      const bigBuffer = new ArrayBuffer(11 * 1024 * 1024);
      const file = new File([bigBuffer], 'big.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const result = validateClaimIntakeForm({ uploadType: UploadType.EXCEL, file });
      expect(result.valid).toBe(false);
      expect(result.errors['file']).toContain('10 MB');
    });

    it('rejects empty file', () => {
      const file = new File([], 'empty.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const result = validateClaimIntakeForm({ uploadType: UploadType.EXCEL, file });
      expect(result.valid).toBe(false);
      expect(result.errors['file']).toContain('empty');
    });

    it('accepts valid .xlsx file', () => {
      const file = new File(['workbook-data'], 'claims.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const result = validateClaimIntakeForm({ uploadType: UploadType.EXCEL, file });
      expect(result.valid).toBe(true);
    });

    it('accepts valid .xls file', () => {
      const file = new File(['workbook-data'], 'claims.xls', {
        type: 'application/vnd.ms-excel',
      });
      const result = validateClaimIntakeForm({ uploadType: UploadType.EXCEL, file });
      expect(result.valid).toBe(true);
    });
  });

  describe('JSON upload type', () => {
    it('requires jsonPayload when uploadType is JSON', () => {
      const result = validateClaimIntakeForm({ uploadType: UploadType.JSON, jsonPayload: '' });
      expect(result.valid).toBe(false);
      expect(result.errors['jsonPayload']).toContain('required');
    });

    it('rejects invalid JSON', () => {
      const result = validateClaimIntakeForm({
        uploadType: UploadType.JSON,
        jsonPayload: 'not-json{{{',
      });
      expect(result.valid).toBe(false);
      expect(result.errors['jsonPayload']).toContain('not valid JSON');
    });

    it('rejects JSON array (must be object)', () => {
      const result = validateClaimIntakeForm({
        uploadType: UploadType.JSON,
        jsonPayload: '[{"key":"value"}]',
      });
      expect(result.valid).toBe(false);
      expect(result.errors['jsonPayload']).toContain('non-null JSON object');
    });

    it('accepts valid JSON object', () => {
      const result = validateClaimIntakeForm({
        uploadType: UploadType.JSON,
        jsonPayload: '{"claimNumber":"C1","policyNumber":"P1","insuredName":"Jane","lossDate":"2026-01-01","reportedDate":"2026-01-02","claimType":"Auto"}',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('XML upload type', () => {
    it('requires xmlData when uploadType is XML', () => {
      const result = validateClaimIntakeForm({ uploadType: UploadType.XML, xmlData: '' });
      expect(result.valid).toBe(false);
      expect(result.errors['xmlData']).toContain('required');
    });

    it('rejects XML that does not start with <', () => {
      const result = validateClaimIntakeForm({
        uploadType: UploadType.XML,
        xmlData: 'plain text without XML',
      });
      expect(result.valid).toBe(false);
      expect(result.errors['xmlData']).toContain('tag element');
    });

    it('accepts XML starting with <', () => {
      const result = validateClaimIntakeForm({
        uploadType: UploadType.XML,
        xmlData: '<claim><claimNumber>C1</claimNumber></claim>',
      });
      expect(result.valid).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: useClaimIntake Hook Tests
// ─────────────────────────────────────────────────────────────────────────────

import { renderHook } from '@testing-library/react';
import { useClaimIntake } from '../../../../hooks/claimIntakeMaster/useClaimIntake';

describe('useClaimIntake hook', () => {
  beforeEach(() => {
    vi.mocked(claimIntakeService.getUploadedClaims).mockResolvedValue([]);
    vi.mocked(claimIntakeService.uploadClaim).mockResolvedValue({
      uploadId: 'test-upload-id',
      totalClaims: 1,
      successCount: 1,
      failedCount: 0,
      status: 'Processed',
      validationResult: 'PASS',
      message: 'Success',
      success: true,
    });
    vi.mocked(claimIntakeService.getUploadedClaimDetails).mockResolvedValue({
      uploadId:     'test-upload-id',
      fileName:     '',
      uploadType:   'JSON',
      totalClaims:  1,
      successCount: 1,
      failedCount:  0,
      uploadedBy:   'Admin',
      uploadDate:   new Date().toISOString(),
      status:       'Processed',
      records: [{
        recordIndex: 1, claimNumber: 'CLM-001', policyNumber: 'POL-001',
        insuredName: 'Jane Doe', claimType: 'Auto', lossDate: '2026-01-01',
        reportedDate: '2026-01-02', claimAmount: '', claimStatus: 'Active',
        validationStatus: 'Passed', validationMessage: 'Passed',
        planServices: [], planServiceNames: [], confirmedPlanServices: [],
        confirmedPlanServiceNames: [], planServiceStatus: '', planServiceComments: '',
        vendorServices: [], vendorServiceComments: '', suggestedVendors: [],
      }],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initialises with null uploadType', async () => {
    const { result } = renderHook(() => useClaimIntake());
    await waitFor(() => expect(claimIntakeService.getUploadedClaims).toHaveBeenCalled());
    expect(result.current.uploadType).toBeNull();
  });

  it('handleUploadTypeChange sets uploadType and clears other fields', async () => {
    const { result } = renderHook(() => useClaimIntake());
    await waitFor(() => expect(claimIntakeService.getUploadedClaims).toHaveBeenCalled());

    act(() => {
      result.current.handleUploadTypeChange(UploadType.JSON);
    });
    expect(result.current.uploadType).toBe(UploadType.JSON);
    expect(result.current.file).toBeNull();
    expect(result.current.jsonPayload).toBe('');
  });

  it('handleJsonChange updates jsonPayload', async () => {
    const { result } = renderHook(() => useClaimIntake());
    await waitFor(() => expect(claimIntakeService.getUploadedClaims).toHaveBeenCalled());

    act(() => {
      result.current.handleJsonChange('{"test":true}');
    });
    expect(result.current.jsonPayload).toBe('{"test":true}');
  });

  it('handleXmlChange updates xmlData', async () => {
    const { result } = renderHook(() => useClaimIntake());
    await waitFor(() => expect(claimIntakeService.getUploadedClaims).toHaveBeenCalled());

    act(() => {
      result.current.handleXmlChange('<root/>');
    });
    expect(result.current.xmlData).toBe('<root/>');
  });

  it('handleUpload sets validation errors when form is invalid', async () => {
    const { result } = renderHook(() => useClaimIntake());
    await waitFor(() => expect(claimIntakeService.getUploadedClaims).toHaveBeenCalled());

    await act(async () => {
      await result.current.handleUpload();
    });

    expect(result.current.errors['uploadType']).toBeDefined();
    expect(claimIntakeService.uploadClaim).not.toHaveBeenCalled();
  });

  it('handleUpload calls uploadClaim service and refreshes grid on success', async () => {
    const { result } = renderHook(() => useClaimIntake());
    await waitFor(() => expect(claimIntakeService.getUploadedClaims).toHaveBeenCalled());

    act(() => {
      result.current.handleUploadTypeChange(UploadType.JSON);
      result.current.handleJsonChange(
        '{"claimNumber":"C1","policyNumber":"P1","insuredName":"Jane","lossDate":"2026-01-01","reportedDate":"2026-01-02","claimType":"Auto"}'
      );
    });

    await act(async () => {
      await result.current.handleUpload();
    });

    expect(claimIntakeService.uploadClaim).toHaveBeenCalledTimes(1);
    expect(claimIntakeService.getUploadedClaims).toHaveBeenCalledTimes(2); // mount + after upload
    expect(result.current.successMessage).toContain('test-upload-id');
  });

  it('handleUpload sets submit error when service fails', async () => {
    vi.mocked(claimIntakeService.uploadClaim).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useClaimIntake());
    await waitFor(() => expect(claimIntakeService.getUploadedClaims).toHaveBeenCalled());

    act(() => {
      result.current.handleUploadTypeChange(UploadType.JSON);
      result.current.handleJsonChange(
        '{"claimNumber":"C1","policyNumber":"P1","insuredName":"Jane","lossDate":"2026-01-01","reportedDate":"2026-01-02","claimType":"Auto"}'
      );
    });

    await act(async () => {
      await result.current.handleUpload();
    });

    expect(result.current.errors['submit']).toBeDefined();
  });

  it('handleRowSelect fetches claim details', async () => {
    const { result } = renderHook(() => useClaimIntake());
    await waitFor(() => expect(claimIntakeService.getUploadedClaims).toHaveBeenCalled());

    const mockRow = {
      uploadId:    'test-upload-id',
      fileName:    'test.json',
      claimNumber: '',
      uploadType:  'JSON',
      totalClaims: 1,
      uploadedBy:  'Admin',
      uploadDate:  new Date().toISOString(),
      status:      'Processed',
    };

    await act(async () => {
      await result.current.handleRowSelect(mockRow);
    });

    expect(claimIntakeService.getUploadedClaimDetails).toHaveBeenCalledWith('test-upload-id');
    expect(result.current.selectedRow).toEqual(mockRow);
    expect(result.current.claimDetails?.records[0]?.claimNumber).toBe('CLM-001');
  });

  it('handleRowSelect sets error when details fetch fails', async () => {
    vi.mocked(claimIntakeService.getUploadedClaimDetails).mockRejectedValue(
      new Error('DB error')
    );

    const { result } = renderHook(() => useClaimIntake());
    await waitFor(() => expect(claimIntakeService.getUploadedClaims).toHaveBeenCalled());

    const mockRow = {
      uploadId:    'bad-id',
      fileName:    '',
      claimNumber: '',
      uploadType:  'JSON',
      totalClaims: 0,
      uploadedBy:  '',
      uploadDate:  '',
      status:      '',
    };

    await act(async () => {
      await result.current.handleRowSelect(mockRow);
    });

    expect(result.current.errors['details']).toBeDefined();
  });

  it('auto-fetches uploaded claims on mount', async () => {
    renderHook(() => useClaimIntake());
    await waitFor(() =>
      expect(claimIntakeService.getUploadedClaims).toHaveBeenCalledTimes(1)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: ClaimIntakeMaster Component Render Tests
// ─────────────────────────────────────────────────────────────────────────────

import ClaimIntakeMaster from '../index';
import { resolveStatusBadge } from '../types';
import { useAllClaimRecords } from '../../../../hooks/claimIntakeMaster/useAllClaimRecords';
import { useAuth } from '../../../../context/AuthContext';

// Wrap with necessary providers
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);

// ─── Mock hooks used by ClaimIntakeMaster ────────────────────────────────────

vi.mock('../../../../hooks/claimIntakeMaster/useAllClaimRecords', () => ({
  useAllClaimRecords: vi.fn(),
}));

vi.mock('../../../../components/claimIntakeMaster/UploadClaimModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Upload Claim Modal">
        <button type="button" onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

const defaultAllClaimsReturn = {
  records: [],
  loading: false,
  error:   null,
  refresh: vi.fn(),
};

describe('ClaimIntakeMaster component', () => {
  beforeEach(() => {
    vi.mocked(useAllClaimRecords).mockReturnValue(defaultAllClaimsReturn);
    vi.mocked(claimIntakeService.getAllClaimRecords).mockResolvedValue([]);
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

it('renders the page title "Claims Command Center"', async () => {
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Claims Command Center')).toBeInTheDocument();
    });
  });

  it('renders the page subtitle', async () => {
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(
        screen.getByText('Upload and review Claims Command Center records')
      ).toBeInTheDocument();
    });
  });

  it('shows "Claims Command Center" as the title for the Claims Adjuster role', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { roleName: 'Claims Adjuster' } } as ReturnType<typeof useAuth>);
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Claims Command Center')).toBeInTheDocument();
      expect(screen.getByText('Upload and review Claims Command Center records')).toBeInTheDocument();
    });
  });

  it('keeps "Claims Command Center" as the title for other roles', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { roleName: 'Admin' } } as ReturnType<typeof useAuth>);
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Claims Command Center')).toBeInTheDocument();
    });
  });

  it('renders swimlane board columns grouped by pipeline status', async () => {
    vi.mocked(useAllClaimRecords).mockReturnValue({
      ...defaultAllClaimsReturn,
      records: [
        {
          recordIndex: 1, uploadId: 'UP-001', claimNumber: 'CLM-001', policyNumber: 'POL-001',
          insuredName: 'Jane', claimType: 'Auto', lossDate: '2026-01-01', reportedDate: '2026-01-02',
          claimAmount: '', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: 'Pending Selection', planServiceComments: '', vendorServices: [],
          vendorServiceComments: '', suggestedVendors: [],
        },
        {
          // Both "Pending Service Selection" and "Pending Selection" fold into
          // the single "Pending Selection" column.
          recordIndex: 2, uploadId: 'UP-002', claimNumber: 'CLM-002', policyNumber: 'POL-002',
          insuredName: 'John', claimType: 'Auto', lossDate: '2026-01-03', reportedDate: '2026-01-04',
          claimAmount: '', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: 'Pending Selection', planServiceComments: '', vendorServices: [],
          vendorServiceComments: '', suggestedVendors: [],
        },
        {
          recordIndex: 3, uploadId: 'UP-003', claimNumber: 'CLM-003', policyNumber: 'POL-003',
          insuredName: 'Amy', claimType: 'Auto', lossDate: '2026-01-05', reportedDate: '2026-01-06',
          claimAmount: '', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: 'Completed', planServiceComments: '', vendorServices: [],
          vendorServiceComments: '', suggestedVendors: [],
        },
        {
          // Vendor Override Approval Workflow — a vendor override sends the claim
          // to its own "Pending Review" column, distinct from the other stages.
          recordIndex: 4, uploadId: 'UP-004', claimNumber: 'CLM-004', policyNumber: 'POL-004',
          insuredName: 'Sam', claimType: 'Auto', lossDate: '2026-01-07', reportedDate: '2026-01-08',
          claimAmount: '', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: 'Pending Review', planServiceComments: '', vendorServices: [],
          vendorServiceComments: '', suggestedVendors: [],
        },
      ],
    });
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      // These labels now also appear as status filter pills, so a column header
      // is one of (at least) two matches rather than the only one.
      expect(screen.getAllByText('Pending Selection').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Finalized Selection').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Pending Review').length).toBeGreaterThan(0);
      expect(screen.getByText('CLM-001')).toBeInTheDocument();
      expect(screen.getByText('CLM-002')).toBeInTheDocument();
      expect(screen.getByText('CLM-004')).toBeInTheDocument();
      // "Completed" claims are excluded from the Claims Command Center
      // list/kanban entirely — no filter pill/swimlane for that status.
      expect(screen.queryByRole('button', { name: 'Completed' })).not.toBeInTheDocument();
      expect(screen.queryByText('CLM-003')).not.toBeInTheDocument();
    });
  });

  it('folds legacy "Pending Service Selection" / "Pending Service Provider Selection" statuses into the "Pending Selection" column and stat count', async () => {
    vi.mocked(useAllClaimRecords).mockReturnValue({
      ...defaultAllClaimsReturn,
      records: [
        {
          recordIndex: 1, uploadId: 'UP-101', claimNumber: 'CLM-101', policyNumber: 'POL-101',
          insuredName: 'Jane', claimType: 'Auto', lossDate: '2026-01-01', reportedDate: '2026-01-02',
          claimAmount: '', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: 'Pending Selection', planServiceComments: '', vendorServices: [],
          vendorServiceComments: '', suggestedVendors: [],
        },
        {
          // Legacy DB values from before the "Pending Selection" rename —
          // must still fold into the same column/stat, not "Other".
          recordIndex: 2, uploadId: 'UP-102', claimNumber: 'CLM-102', policyNumber: 'POL-102',
          insuredName: 'John', claimType: 'Auto', lossDate: '2026-01-03', reportedDate: '2026-01-04',
          claimAmount: '', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: 'Pending Service Selection', planServiceComments: '', vendorServices: [],
          vendorServiceComments: '', suggestedVendors: [],
        },
        {
          recordIndex: 3, uploadId: 'UP-103', claimNumber: 'CLM-103', policyNumber: 'POL-103',
          insuredName: 'Amy', claimType: 'Auto', lossDate: '2026-01-05', reportedDate: '2026-01-06',
          claimAmount: '', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: 'Pending Service Provider Selection', planServiceComments: '', vendorServices: [],
          vendorServiceComments: '', suggestedVendors: [],
        },
      ],
    });
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      // "Pending Selection" stat tile must count all three records, not just
      // the literal "Pending Selection" one.
      const pendingLabel = screen.getByText('Pending Selection', { selector: '.dash-metric-card__label' });
      const pendingCard = pendingLabel.closest('.dash-metric-card') as HTMLElement;
      expect(pendingCard).not.toBeNull();
      expect(within(pendingCard).getByText('3')).toBeInTheDocument();
      // None of the three should have been dropped into "Other".
      expect(screen.queryByText('Other')).not.toBeInTheDocument();
    });
  });

  it('defaults to List view and switches to Kanban view on toggle click', async () => {
    const user = userEvent.setup();
    vi.mocked(useAllClaimRecords).mockReturnValue({
      ...defaultAllClaimsReturn,
      records: [{
        recordIndex: 1, uploadId: 'UP-010', claimNumber: 'CLM-010', policyNumber: 'POL-010',
        insuredName: 'Sam', claimType: 'Auto', lossDate: '2026-02-01', reportedDate: '2026-02-02',
        claimAmount: '5000', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
        planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
        planServiceStatus: 'Completed', planServiceComments: '', vendorServices: [],
        vendorServiceComments: '', suggestedVendors: [],
      }],
    });
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });

    const kanbanBtn = await screen.findByRole('button', { name: /kanban/i });
    const listBtn = screen.getByRole('button', { name: /^list$/i });
    expect(listBtn).toHaveAttribute('aria-pressed', 'true');
    expect(kanbanBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(kanbanBtn);

    await waitFor(() => {
      expect(kanbanBtn).toHaveAttribute('aria-pressed', 'true');
      expect(listBtn).toHaveAttribute('aria-pressed', 'false');
    });
    expect(sessionStorage.getItem('cim-view-mode')).toBe('kanban');
  });

  it('filters records by status when a filter pill is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useAllClaimRecords).mockReturnValue({
      ...defaultAllClaimsReturn,
      records: [
        {
          recordIndex: 1, uploadId: 'UP-020', claimNumber: 'CLM-020', policyNumber: 'POL-020',
          insuredName: 'Pat', claimType: 'Auto', lossDate: '2026-02-01', reportedDate: '2026-02-02',
          claimAmount: '1000', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: 'Pending Selection', planServiceComments: '', vendorServices: [],
          vendorServiceComments: '', suggestedVendors: [],
        },
        {
          recordIndex: 2, uploadId: 'UP-021', claimNumber: 'CLM-021', policyNumber: 'POL-021',
          insuredName: 'Lee', claimType: 'Auto', lossDate: '2026-02-03', reportedDate: '2026-02-04',
          claimAmount: '2000', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: 'Finalized Selection', planServiceComments: '', vendorServices: [],
          vendorServiceComments: '', suggestedVendors: [],
        },
      ],
    });
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });

    await screen.findByText('CLM-020');
    expect(screen.getByText('CLM-021')).toBeInTheDocument();

    const finalizedPill = screen.getByRole('button', { name: 'Finalized Selection' });
    await user.click(finalizedPill);

    await waitFor(() => {
      expect(screen.queryByText('CLM-020')).not.toBeInTheDocument();
      expect(screen.getByText('CLM-021')).toBeInTheDocument();
    });
  });

  it('excludes "Completed" claims from the list/kanban under "All Claims", with no "Completed" filter pill or stat tile', async () => {
    vi.mocked(useAllClaimRecords).mockReturnValue({
      ...defaultAllClaimsReturn,
      records: [
        {
          recordIndex: 1, uploadId: 'UP-030', claimNumber: 'CLM-030', policyNumber: 'POL-030',
          insuredName: 'Robin', claimType: 'Auto', lossDate: '2026-02-05', reportedDate: '2026-02-06',
          claimAmount: '3000', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: 'Completed', planServiceComments: '', vendorServices: [],
          vendorServiceComments: '', suggestedVendors: [],
        },
        {
          recordIndex: 2, uploadId: 'UP-031', claimNumber: 'CLM-031', policyNumber: 'POL-031',
          insuredName: 'Casey', claimType: 'Auto', lossDate: '2026-02-07', reportedDate: '2026-02-08',
          claimAmount: '4000', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: 'Pending Selection', planServiceComments: '', vendorServices: [],
          vendorServiceComments: '', suggestedVendors: [],
        },
      ],
    });
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });

    await screen.findByText('CLM-031');
    expect(screen.queryByText('CLM-030')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Completed' })).not.toBeInTheDocument();
    // No "Completed" stat tile card either.
    expect(screen.queryByText('Completed', { selector: '.dash-metric-card__label' })).not.toBeInTheDocument();
  });

  it('does not show the upload modal initially', async () => {
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows "No claims yet" when records are empty', async () => {
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('No claims yet')).toBeInTheDocument();
    });
  });

  it('does not show the details section initially', async () => {
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.queryByText('Uploaded Claim Details')).not.toBeInTheDocument();
    });
  });

  it('shows Upload Claim button', async () => {
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upload claim/i })).toBeInTheDocument();
    });
  });

  it('opens the upload modal when Upload Claim button is clicked', async () => {
    const user = userEvent.setup();
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });

    const uploadBtn = await screen.findByRole('button', { name: /upload claim/i });
    await user.click(uploadBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /upload claim modal/i })).toBeInTheDocument();
    });
  });

  it('shows claim count when records are present', async () => {
    vi.mocked(useAllClaimRecords).mockReturnValue({
      ...defaultAllClaimsReturn,
      records: [
        {
          recordIndex: 1, uploadId: 'UP-001', claimNumber: 'CLM-001', policyNumber: 'POL-001',
          insuredName: 'Jane', claimType: 'Auto', lossDate: '2026-01-01', reportedDate: '2026-01-02',
          claimAmount: '', claimStatus: 'Active', validationStatus: 'Passed', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: '', planServiceComments: '', vendorServices: [], vendorServiceComments: '',
          suggestedVendors: [],
        },
      ],
    });
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('1 claim')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: resolveStatusBadge — badge class mapping (TEST-48..50)
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveStatusBadge', () => {
  it('maps "processed" to badge-green', () => {
    expect(resolveStatusBadge('processed')).toBe('badge-green');
  });

  it('maps "Processed" (case-insensitive) to badge-green', () => {
    expect(resolveStatusBadge('Processed')).toBe('badge-green');
  });

  it('maps "success" to badge-green', () => {
    expect(resolveStatusBadge('success')).toBe('badge-green');
  });

  it('maps "pending" to badge-yellow', () => {
    expect(resolveStatusBadge('pending')).toBe('badge-yellow');
  });

  it('maps "processing" to badge-yellow', () => {
    expect(resolveStatusBadge('processing')).toBe('badge-yellow');
  });

  it('maps "Processing" (case-insensitive) to badge-yellow', () => {
    expect(resolveStatusBadge('Processing')).toBe('badge-yellow');
  });

  it('maps "failed" to badge-red', () => {
    expect(resolveStatusBadge('failed')).toBe('badge-red');
  });

  it('maps "error" to badge-red', () => {
    expect(resolveStatusBadge('error')).toBe('badge-red');
  });

  it('maps unknown status to badge-gray', () => {
    expect(resolveStatusBadge('unknown-status')).toBe('badge-gray');
  });

  it('maps empty string to badge-gray', () => {
    expect(resolveStatusBadge('')).toBe('badge-gray');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: ClaimIntakeMaster — loading and records state
// ─────────────────────────────────────────────────────────────────────────────

describe('ClaimIntakeMaster — loading and records state', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Loading…" in the grid when records are loading', async () => {
    vi.mocked(useAllClaimRecords).mockReturnValue({
      records: [],
      loading: true,
      error:   null,
      refresh: vi.fn(),
    });
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });
  });

  it('shows an error alert when useAllClaimRecords returns an error', async () => {
    vi.mocked(useAllClaimRecords).mockReturnValue({
      records: [],
      loading: false,
      error:   'Failed to load claims',
      refresh: vi.fn(),
    });
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load claims')).toBeInTheDocument();
    });
  });

  it('shows "No claims yet" when records array is empty and not loading', async () => {
    vi.mocked(useAllClaimRecords).mockReturnValue({ ...defaultAllClaimsReturn, records: [] });
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('No claims yet')).toBeInTheDocument();
    });
  });

  it('shows correct plural claim count when multiple records are present', async () => {
    vi.mocked(useAllClaimRecords).mockReturnValue({
      ...defaultAllClaimsReturn,
      records: [
        {
          recordIndex: 1, uploadId: 'UP-001', claimNumber: 'CLM-001', policyNumber: 'POL-001',
          insuredName: 'Jane', claimType: 'Auto', lossDate: '', reportedDate: '',
          claimAmount: '', claimStatus: '', validationStatus: '', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: '', planServiceComments: '', vendorServices: [], vendorServiceComments: '',
          suggestedVendors: [],
        },
        {
          recordIndex: 2, uploadId: 'UP-002', claimNumber: 'CLM-002', policyNumber: 'POL-002',
          insuredName: 'John', claimType: 'Auto', lossDate: '', reportedDate: '',
          claimAmount: '', claimStatus: '', validationStatus: '', validationMessage: '',
          planServices: [], planServiceNames: [], confirmedPlanServices: [], confirmedPlanServiceNames: [],
          planServiceStatus: '', planServiceComments: '', vendorServices: [], vendorServiceComments: '',
          suggestedVendors: [],
        },
      ],
    });
    render(<ClaimIntakeMaster />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('2 claims')).toBeInTheDocument();
    });
  });
});
