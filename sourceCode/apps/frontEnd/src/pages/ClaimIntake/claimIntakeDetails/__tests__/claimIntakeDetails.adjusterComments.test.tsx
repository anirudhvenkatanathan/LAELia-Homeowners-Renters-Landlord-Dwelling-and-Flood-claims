import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const savePlanServicesMock  = vi.fn();
const saveVendorServicesMock = vi.fn();
const saveDraftPlanServicesMock = vi.fn();

vi.mock('../../../../services/claimIntakeMaster/claimIntakeService', () => ({
  getAllVendorNames:               vi.fn(() => Promise.resolve([])),
  getVendorsByRoleIdsWithDetails: vi.fn(() => Promise.resolve([])),
  getChangeLogEntries:            vi.fn(() => Promise.resolve([])),
  savePlanServices:               (...args: unknown[]) => savePlanServicesMock(...args),
  saveDraftPlanServices:          (...args: unknown[]) => saveDraftPlanServicesMock(...args),
  saveVendorServices:             (...args: unknown[]) => saveVendorServicesMock(...args),
  getVendorsByRoleIds:            vi.fn(() => Promise.resolve([])),
  saveChangeLogEntry:             vi.fn(() => Promise.resolve()),
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
import { useAuth } from '../../../../context/AuthContext';
import { getAllServiceRequestRoles } from '../../../../services/ServiceRequestRole/serviceRequestRoleService';
import { getVendorsByRoleIdsWithDetails } from '../../../../services/claimIntakeMaster/claimIntakeService';
import ClaimIntakeDetails from '../index';

// ── fixtures ─────────────────────────────────────────────────────────────────

const NURSE_ROLE_ID = 'role-nurse';
const PT_ROLE_ID     = 'role-pt';

const SAMPLE_ROLES = [
  { roleId: NURSE_ROLE_ID, uploadId: 'upload-1', roleName: 'Nurse case management', description: '', status: 'Active', nlpCondition: '', conditionExpression: '', nlpConditionInWords: '' },
  // Not part of the record's recommended plan at all — starts SUGGESTED/
  // inactive, so toggling it on is the "add a new/additional service" trigger.
  { roleId: PT_ROLE_ID,    uploadId: 'upload-1', roleName: 'Physical Therapy',       description: '', status: 'Active', nlpCondition: '', conditionExpression: '', nlpConditionInWords: '' },
];

function makeRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    recordIndex: 0,
    claimNumber: 'WCM-TEST-002',
    policyNumber: 'POL-002',
    insuredName: 'Jane Roe',
    claimType: 'Medical',
    lossDate: '2026-01-01',
    reportedDate: '2026-01-02',
    claimAmount: '5000',
    claimStatus: 'Open',
    validationStatus: 'Valid',
    validationMessage: '',
    planServices: [NURSE_ROLE_ID],
    planServiceNames: ['Nurse case management'],
    confirmedPlanServices: [NURSE_ROLE_ID],
    confirmedPlanServiceNames: ['Nurse case management'],
    existingplanservices: [NURSE_ROLE_ID],
    planServiceStatus: 'Pending Selection',
    planServiceComments: '',
    vendorServices: ['Careworks'],
    vendorServiceComments: '',
    suggestedVendors: [],
    adjusterComments: '',
    adjusterSubmittedBy: '',
    adjusterSubmittedAt: '',
    serviceVendorReview: [
      { roleName: 'Nurse case management', changeType: 'ProviderChange', recommendedVendor: 'Careworks', proposedVendor: 'Careworks', selectedVendor: 'Careworks', status: 'Locked', confirmedBy: 'Priya Nair', confirmedAt: '2026-01-01T00:00:00.000Z' },
    ],
    ...overrides,
  };
}

function makeDetail(record: ReturnType<typeof makeRecord>) {
  return {
    uploadId: 'upload-1',
    fileName: 'claims.json',
    uploadType: 'JSON',
    totalClaims: 1,
    successCount: 1,
    failedCount: 0,
    uploadedBy: 'admin',
    uploadDate: '2026-01-01',
    status: 'Processed',
    records: [record],
  };
}

const ADJUSTER_USER    = { fullName: 'Priya Nair', username: 'priya.nair', roleName: 'Claims Adjuster', permissions: {} };
const SUPERVISOR_USER  = { fullName: 'Claims Supervisor', username: 'claimssupervisor', roleName: 'Claims Supervisor', permissions: {} };

function getRoleRowName(role: string): HTMLElement {
  const match = screen.getAllByText(role).find(el => el.className === 'cid-vendor-item__name');
  if (!match) throw new Error(`Role grid row not found for "${role}"`);
  return match;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ClaimIntakeDetails — Adjuster Comments surfaced from Reason for Change', () => {
  beforeEach(() => {
    vi.mocked(useLocation).mockReturnValue({
      key: 'key-1',
      state: { recordIndex: 0 },
      pathname: '/claim-intake-details/upload-1',
      search: '',
      hash: '',
    } as any);
    vi.mocked(getAllServiceRequestRoles).mockResolvedValue(SAMPLE_ROLES);
    vi.mocked(getVendorsByRoleIdsWithDetails).mockImplementation((roleIds: string[]) => {
      if (roleIds[0] === NURSE_ROLE_ID) return Promise.resolve([{ companyName: 'Careworks', rating: 5 }]);
      if (roleIds[0] === PT_ROLE_ID)    return Promise.resolve([{ companyName: 'Motion Rehab', rating: 5 }]);
      return Promise.resolve([]);
    });
    savePlanServicesMock.mockResolvedValue({ success: true, message: 'ok' });
    saveVendorServicesMock.mockResolvedValue({ success: true, message: 'ok' });
    saveDraftPlanServicesMock.mockResolvedValue({ success: true, message: 'ok' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('sends the mandatory "Reason for Change" text as adjusterComments when an Adjuster adds a new service and clicks Confirm Selection', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: ADJUSTER_USER, token: 'fake-token' } as any);
    vi.mocked(useClaimDetails).mockReturnValue({
      detail: makeDetail(makeRecord()) as any,
      loading: false, error: null, refresh: vi.fn(),
    });

    render(<ClaimIntakeDetails />);
    await waitFor(() => expect(getRoleRowName('Physical Therapy')).toBeInTheDocument());

    // Toggle on the new/additional service — Adjuster path opens the plain
    // "Reason for Change" modal (not the Supervisor's staged-review popup).
    fireEvent.click(getRoleRowName('Physical Therapy'));
    const reasonBox = await screen.findByPlaceholderText('Provide a reason for this change…');
    fireEvent.change(reasonBox, { target: { value: 'Adding physical therapy per updated treatment plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Change' }));
    await waitFor(() => expect(screen.queryByPlaceholderText('Provide a reason for this change…')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    await waitFor(() => expect(saveVendorServicesMock).toHaveBeenCalledTimes(1));

    const vendorServicesArg = saveVendorServicesMock.mock.calls[0][0];
    expect(vendorServicesArg.adjusterComments).toBe('Adding physical therapy per updated treatment plan');
    expect(vendorServicesArg.adjusterSubmittedBy).toBe('Priya Nair');

    // The same reason must also land on this specific service's own
    // serviceVendorReview entry (adjusterComment) — not just the claim-level
    // summary — so the Supervisor sees it right next to that service's
    // Recommended/Selected Provider and "Added by" details.
    const ptEntry = vendorServicesArg.serviceVendorReview.find((e: { roleName: string }) => e.roleName === 'Physical Therapy');
    expect(ptEntry?.adjusterComment).toBe('Adding physical therapy per updated treatment plan');
  });

  it('does not send adjusterComments/adjusterSubmittedBy when a Supervisor clicks their own Confirm Selection', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: SUPERVISOR_USER, token: 'fake-token' } as any);
    vi.mocked(useClaimDetails).mockReturnValue({
      detail: makeDetail(makeRecord({
        planServiceStatus: 'Pending Review',
        serviceVendorReview: [
          { roleName: 'Nurse case management', changeType: 'ProviderChange', recommendedVendor: 'Careworks', proposedVendor: 'Careworks', selectedVendor: 'Careworks', status: 'Locked', confirmedBy: 'Priya Nair', confirmedAt: '2026-01-01T00:00:00.000Z' },
          { roleName: 'Physical Therapy', changeType: 'ServiceAdded', recommendedVendor: '', proposedVendor: 'Motion Rehab', selectedVendor: 'Motion Rehab', status: 'Pending Review', confirmedBy: 'Priya Nair', confirmedAt: '2026-01-01T00:00:00.000Z' },
        ],
        planServices: [NURSE_ROLE_ID, PT_ROLE_ID],
        planServiceNames: ['Nurse case management', 'Physical Therapy'],
        confirmedPlanServices: [NURSE_ROLE_ID, PT_ROLE_ID],
        confirmedPlanServiceNames: ['Nurse case management', 'Physical Therapy'],
        existingplanservices: [NURSE_ROLE_ID, PT_ROLE_ID],
        vendorServices: ['Careworks', 'Motion Rehab'],
      })) as any,
      loading: false, error: null, refresh: vi.fn(),
    });

    render(<ClaimIntakeDetails />);
    await waitFor(() => expect(getRoleRowName('Physical Therapy')).toBeInTheDocument());

    // Supervisor accepts the untouched Pending Review "Service Added" role
    // as-is — no popup needed, straight to Confirm Selection.
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    await waitFor(() => expect(saveVendorServicesMock).toHaveBeenCalledTimes(1));

    const vendorServicesArg = saveVendorServicesMock.mock.calls[0][0];
    expect(vendorServicesArg.adjusterComments).toBeUndefined();
    expect(vendorServicesArg.adjusterSubmittedBy).toBeUndefined();
  });
});
