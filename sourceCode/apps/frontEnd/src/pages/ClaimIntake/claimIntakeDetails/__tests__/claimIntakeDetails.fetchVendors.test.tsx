import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';

// ── vi.mock calls are hoisted to the top by Vitest ───────────────────────────

vi.mock('react-router-dom', () => ({
  useParams:   vi.fn(() => ({ uploadId: 'upload-1' })),
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({
    key: 'key-1',
    state: { recordIndex: 0 },
    pathname: '/claim-intake-details/upload-1',
    search: '',
    hash: '',
  })),
}));

vi.mock('../../../../hooks/claimIntakeMaster/useClaimDetails', () => ({
  useClaimDetails: vi.fn(),
}));

vi.mock('../../../../services/claimIntakeMaster/claimIntakeService', () => ({
  getAllVendorNames:               vi.fn(() => Promise.resolve([])),
  getVendorsByRoleIdsWithDetails: vi.fn(() => Promise.resolve([])),
  getChangeLogEntries:            vi.fn(() => Promise.resolve([])),
  savePlanServices:               vi.fn(),
  saveDraftPlanServices:          vi.fn(),
  saveVendorServices:             vi.fn(),
  getVendorsByRoleIds:            vi.fn(() => Promise.resolve([])),
  saveChangeLogEntry:             vi.fn(),
  completeClaim:                  vi.fn(),
  fetchKpiMetricsForClaim:        vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../../../services/ServiceRequestRole/serviceRequestRoleService', () => ({
  getAllServiceRequestRoles: vi.fn(),
}));

vi.mock('../../../../components/layout/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

vi.mock('../../../../utils/logError',            () => ({ logError: vi.fn() }));
vi.mock('../../../../utils/kpiScoring',          () => ({
  vendorKpiScores:     vi.fn(() => []),
  vendorRoleScorecard: vi.fn(() => ({ kpis: [], aggregate: 0 })),
}));
vi.mock('../../../../utils/claimSummaryMockData', () => ({
  getClaimSummaryData: vi.fn(() => ({
    items: [], signals: [], footerNote: '',
    injury: { label: 'lumbar strain', icd: 'M54.5', bodyPart: 'Lumbar spine', description: 'lumbar strain to the lower back' },
  })),
}));

// ── imports (after mocks so the mocked versions are used) ────────────────────

import { useLocation } from 'react-router-dom';
import { useClaimDetails } from '../../../../hooks/claimIntakeMaster/useClaimDetails';
import { getAllServiceRequestRoles } from '../../../../services/ServiceRequestRole/serviceRequestRoleService';
import { getVendorsByRoleIdsWithDetails } from '../../../../services/claimIntakeMaster/claimIntakeService';
import ClaimIntakeDetails from '../index';

// ── fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_ROLES = [
  {
    roleId: 'role-1',
    uploadId: 'upload-1',
    roleName: 'Bill Review',
    description: '',
    status: 'Active',
    nlpCondition: '',
    conditionExpression: '',
    nlpConditionInWords: '',
  },
];

const SAMPLE_RECORD = {
  recordIndex: 0,
  claimNumber: 'CLM-001',
  policyNumber: 'POL-001',
  insuredName: 'John Doe',
  claimType: 'Homeowners',
  lossDate: '2026-01-01',
  reportedDate: '2026-01-02',
  claimAmount: '5000',
  claimStatus: 'Open',
  validationStatus: 'Valid',
  validationMessage: '',
  planServices: ['role-1'],
  planServiceNames: ['Bill Review'],
  confirmedPlanServices: ['role-1'],
  confirmedPlanServiceNames: ['Bill Review'],
  planServiceStatus: 'Pending Selection',
  planServiceComments: '',
  vendorServices: [],
  vendorServiceComments: '',
  suggestedVendors: [],
};

const SAMPLE_DETAIL = {
  uploadId: 'upload-1',
  fileName: 'claims.json',
  uploadType: 'JSON',
  totalClaims: 1,
  successCount: 1,
  failedCount: 0,
  uploadedBy: 'admin',
  uploadDate: '2026-01-01',
  status: 'Processed',
  records: [SAMPLE_RECORD],
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ClaimIntakeDetails — fetchVendorsForRoles consistency', () => {
  beforeEach(() => {
    vi.mocked(useClaimDetails).mockReturnValue({
      detail: SAMPLE_DETAIL as any,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    vi.mocked(useLocation).mockReturnValue({
      key: 'key-1',
      state: { recordIndex: 0 },
      pathname: '/claim-intake-details/upload-1',
      search: '',
      hash: '',
    } as any);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── 1. Empty-allRoles guard ───────────────────────────────────────────────

  it('does not call vendor API while allRoles is still loading (guard prevents empty-role fetch)', async () => {
    // getAllServiceRequestRoles never resolves — allRoles stays empty
    vi.mocked(getAllServiceRequestRoles).mockReturnValue(new Promise(() => {}));

    render(<ClaimIntakeDetails />);

    // Give effects time to run; selectedRecord is set (detail is immediate) but
    // allRoles is still [] so the guard in the main effect returns early
    await act(async () => { await new Promise(r => setTimeout(r, 60)); });

    expect(getVendorsByRoleIdsWithDetails).not.toHaveBeenCalled();
  });

  // ── 2. Race-condition fix: allRoles.length retry effect ──────────────────

  it('retries vendor fetch once allRoles arrives after selectedRecord (race-condition fix)', async () => {
    let resolveRoles!: (v: typeof SAMPLE_ROLES) => void;
    vi.mocked(getAllServiceRequestRoles).mockReturnValue(
      new Promise(resolve => { resolveRoles = resolve; })
    );

    render(<ClaimIntakeDetails />);

    // detail resolves immediately → main effect fires → allRoles empty → guard blocks
    await act(async () => { await new Promise(r => setTimeout(r, 30)); });
    expect(getVendorsByRoleIdsWithDetails).not.toHaveBeenCalled();

    // allRoles finally arrives → allRoles.length dep changes → retry effect fires
    await act(async () => {
      resolveRoles(SAMPLE_ROLES);
      await new Promise(r => setTimeout(r, 60));
    });

    expect(getVendorsByRoleIdsWithDetails).toHaveBeenCalledWith(['role-1']);
  });

  // ── 3. Normal (non-race) flow ─────────────────────────────────────────────

  it('calls vendor API when allRoles and selectedRecord are both available', async () => {
    vi.mocked(getAllServiceRequestRoles).mockResolvedValue(SAMPLE_ROLES);

    render(<ClaimIntakeDetails />);

    await waitFor(() => {
      expect(getVendorsByRoleIdsWithDetails).toHaveBeenCalledWith(['role-1']);
    });
  });

  // ── 4. Navigation via location.key ────────────────────────────────────────

  it('re-invokes vendor API on navigation even when record data has not changed', async () => {
    vi.mocked(getAllServiceRequestRoles).mockResolvedValue(SAMPLE_ROLES);

    const { rerender } = render(<ClaimIntakeDetails />);

    // Wait for the initial vendor fetch to complete
    await waitFor(() => expect(getVendorsByRoleIdsWithDetails).toHaveBeenCalled());
    vi.mocked(getVendorsByRoleIdsWithDetails).mockClear();

    // Simulate re-navigation: same record, new location.key (as React Router provides)
    vi.mocked(useLocation).mockReturnValue({
      key: 'key-2',
      state: { recordIndex: 0 },
      pathname: '/claim-intake-details/upload-1',
      search: '',
      hash: '',
    } as any);

    await act(async () => {
      rerender(<ClaimIntakeDetails />);
      await new Promise(r => setTimeout(r, 60));
    });

    // location.key dep triggers the main fetchVendors effect even though record
    // primitive values (recordIndex, planServiceStatus, planServiceNames) are identical
    expect(getVendorsByRoleIdsWithDetails).toHaveBeenCalledWith(['role-1']);
  });

  // ── 5. Tab visibility handler ─────────────────────────────────────────────

  it('calls vendor API via vendorFetchRef when the tab becomes visible after idle', async () => {
    vi.mocked(getAllServiceRequestRoles).mockResolvedValue(SAMPLE_ROLES);

    render(<ClaimIntakeDetails />);

    // Wait for initial load and vendor fetch
    await waitFor(() => expect(getVendorsByRoleIdsWithDetails).toHaveBeenCalled());
    vi.mocked(getVendorsByRoleIdsWithDetails).mockClear();

    // Simulate the user returning to the tab after idling.
    // JSDOM defaults visibilityState to 'visible', so just dispatching the event
    // is enough to trigger the handler's `document.visibilityState === 'visible'` check.
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(r => setTimeout(r, 60));
    });

    // vendorFetchRef.current() calls fetchVendorsForRoles(activeServiceRoles, confirmed)
    // which in turn calls getVendorsByRoleIdsWithDetails for each active role
    expect(getVendorsByRoleIdsWithDetails).toHaveBeenCalled();
  });
});
