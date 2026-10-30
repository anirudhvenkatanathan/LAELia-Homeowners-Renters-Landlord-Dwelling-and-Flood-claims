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
// Mirrors the exact scenario that produced the "removed service resurrects"
// bug this session: one already-Locked, originally-recommended role ("Nurse
// case management") plus one Adjuster-added role still Pending Review ("IME
// / peer review").

const NURSE_ROLE_ID = 'role-nurse';
const IME_ROLE_ID    = 'role-ime';
const PT_ROLE_ID     = 'role-pt';

const SAMPLE_ROLES = [
  { roleId: NURSE_ROLE_ID, uploadId: 'upload-1', roleName: 'Nurse case management', description: '', status: 'Active', lineOfBusiness: ['Homeowners'], nlpCondition: '', conditionExpression: '', nlpConditionInWords: '' },
  { roleId: IME_ROLE_ID,   uploadId: 'upload-1', roleName: 'IME / peer review',      description: '', status: 'Active', lineOfBusiness: ['Homeowners'], nlpCondition: '', conditionExpression: '', nlpConditionInWords: '' },
  // Not part of the record's plan at all — renders SUGGESTED/inactive, so a
  // Supervisor enabling it exercises the "turn a service on" path rather
  // than reviewing one the Adjuster already touched.
  { roleId: PT_ROLE_ID,    uploadId: 'upload-1', roleName: 'Physical Therapy',       description: '', status: 'Active', lineOfBusiness: ['Homeowners'], nlpCondition: '', conditionExpression: '', nlpConditionInWords: '' },
];

function makeRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    recordIndex: 0,
    claimNumber: 'HO-TEST-001',
    policyNumber: 'POL-001',
    insuredName: 'John Doe',
    claimType: 'Homeowners',
    lossDate: '2026-01-01',
    reportedDate: '2026-01-02',
    claimAmount: '5000',
    claimStatus: 'Open',
    validationStatus: 'Valid',
    validationMessage: '',
    planServices: [NURSE_ROLE_ID, IME_ROLE_ID],
    planServiceNames: ['Nurse case management', 'IME / peer review'],
    confirmedPlanServices: [NURSE_ROLE_ID, IME_ROLE_ID],
    confirmedPlanServiceNames: ['Nurse case management', 'IME / peer review'],
    existingplanservices: [NURSE_ROLE_ID, IME_ROLE_ID],
    planServiceStatus: 'Pending Review',
    planServiceComments: '',
    vendorServices: ['Careworks', 'AA Services'],
    vendorServiceComments: '',
    suggestedVendors: [],
    serviceVendorReview: [
      { roleName: 'Nurse case management', changeType: 'ProviderChange', recommendedVendor: 'Careworks', proposedVendor: 'Careworks', selectedVendor: 'Careworks', status: 'Locked', confirmedBy: 'Adjuster One', confirmedAt: '2026-01-01T00:00:00.000Z' },
      { roleName: 'IME / peer review', changeType: 'ServiceAdded', recommendedVendor: '', proposedVendor: 'AA Services', selectedVendor: 'AA Services', status: 'Pending Review', confirmedBy: 'Adjuster One', confirmedAt: '2026-01-01T00:00:00.000Z' },
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

const SUPERVISOR_USER = { fullName: 'Priya Supervisor', username: 'supervisor', roleName: 'Claims Supervisor', permissions: {} };

// The role name also appears in other summary sections (e.g. Q-AI
// Intelligence), so plain getByText(role) is ambiguous — this finds the
// specific role-grid row (.cid-vendor-item__name).
function getRoleRowName(role: string): HTMLElement {
  const match = screen.getAllByText(role).find(el => el.className === 'cid-vendor-item__name');
  if (!match) throw new Error(`Role grid row not found for "${role}"`);
  return match;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ClaimIntakeDetails — Claims Supervisor review workflow', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: SUPERVISOR_USER, token: 'fake-token' } as any);
    vi.mocked(useLocation).mockReturnValue({
      key: 'key-1',
      state: { recordIndex: 0 },
      pathname: '/claim-intake-details/upload-1',
      search: '',
      hash: '',
    } as any);
    vi.mocked(getAllServiceRequestRoles).mockResolvedValue(SAMPLE_ROLES);
    vi.mocked(getVendorsByRoleIdsWithDetails).mockImplementation((roleIds: string[]) => {
      if (roleIds[0] === NURSE_ROLE_ID) return Promise.resolve([{ companyName: 'Careworks', rating: 5 }, { companyName: 'MedStaff Partners', rating: 4 }]);
      if (roleIds[0] === IME_ROLE_ID)   return Promise.resolve([{ companyName: 'AA Services', rating: 5 }]);
      if (roleIds[0] === PT_ROLE_ID)    return Promise.resolve([{ companyName: 'Motion Rehab', rating: 5 }]);
      return Promise.resolve([]);
    });
    savePlanServicesMock.mockResolvedValue({ success: true, message: 'ok' });
    saveVendorServicesMock.mockResolvedValue({ success: true, message: 'ok' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── 1. Every Supervisor toggle — not just Pending Review rows — must go
  //       through the staged, comment-required popup, never the immediate-
  //       persist Adjuster path. ──────────────────────────────────────────

  it('opens the staged Supervisor Review popup (not the plain reason modal) when clicking an already-Locked row', async () => {
    vi.mocked(useClaimDetails).mockReturnValue({
      detail: makeDetail(makeRecord()) as any,
      loading: false, error: null, refresh: vi.fn(),
    });

    render(<ClaimIntakeDetails />);
    await waitFor(() => expect(getRoleRowName('Nurse case management')).toBeInTheDocument());

    fireEvent.click(getRoleRowName('Nurse case management'));

    // The comment-required Supervisor Review popup, not the generic
    // "Reason for Change" modal that used to fire here for any row whose
    // status wasn't literally 'Pending Review'.
    expect(await screen.findByText('Review — Nurse case management')).toBeInTheDocument();
    expect(screen.queryByText('Reason for Change')).not.toBeInTheDocument();

    // Nothing should have been persisted yet — a Supervisor's decision is
    // staged locally until Confirm Selection, and this row's click must
    // never reach the Adjuster's immediate-persist confirmToggle path.
    expect(saveDraftPlanServicesMock).not.toHaveBeenCalled();
  });

  // ── 2. Once the claim is Finalized Selection, every row locks — for the
  //       Supervisor too. ────────────────────────────────────────────────

  it('does not open any popup for a Supervisor once the claim is Finalized Selection', async () => {
    vi.mocked(useClaimDetails).mockReturnValue({
      detail: makeDetail(makeRecord({ planServiceStatus: 'Finalized Selection' })) as any,
      loading: false, error: null, refresh: vi.fn(),
    });

    render(<ClaimIntakeDetails />);
    await waitFor(() => expect(getRoleRowName('Nurse case management')).toBeInTheDocument());

    fireEvent.click(getRoleRowName('Nurse case management'));

    expect(screen.queryByText('Review — Nurse case management')).not.toBeInTheDocument();
    expect(saveDraftPlanServicesMock).not.toHaveBeenCalled();
  });

  // ── 3. The core regression test: removing a Pending Review "added"
  //       service and clicking Confirm Selection once must not resurrect
  //       it after the refresh() that follows. ──────────────────────────

  it('keeps a removed service removed after Confirm Selection + refresh (no resurrection)', async () => {
    const initialDetail = makeDetail(makeRecord());
    let currentReturn = {
      detail: initialDetail as any,
      loading: false, error: null,
      refresh: undefined as unknown as () => void,
    };
    const refreshMock = vi.fn(() => {
      // Simulate the server's post-confirm state: IME / peer review removed
      // from both planServices and confirmedPlanServices, status Rejected,
      // claim Finalized Selection — exactly what the real backend produces.
      const updatedRecord = makeRecord({
        planServices: [NURSE_ROLE_ID],
        planServiceNames: ['Nurse case management'],
        confirmedPlanServices: [NURSE_ROLE_ID],
        confirmedPlanServiceNames: ['Nurse case management'],
        existingplanservices: [NURSE_ROLE_ID],
        planServiceStatus: 'Finalized Selection',
        vendorServices: ['Careworks'],
        serviceVendorReview: [
          { roleName: 'Nurse case management', changeType: 'ProviderChange', recommendedVendor: 'Careworks', proposedVendor: 'Careworks', selectedVendor: 'Careworks', status: 'Locked', confirmedBy: 'Adjuster One', confirmedAt: '2026-01-01T00:00:00.000Z' },
          { roleName: 'IME / peer review', changeType: 'ServiceAdded', recommendedVendor: '', proposedVendor: 'AA Services', selectedVendor: 'AA Services', status: 'Rejected', confirmedBy: 'Adjuster One', confirmedAt: '2026-01-01T00:00:00.000Z', reviewedBy: 'supervisor', reviewedAt: '2026-01-02T00:00:00.000Z', supervisorComment: 'not needed' },
        ],
      });
      currentReturn = { detail: makeDetail(updatedRecord) as any, loading: false, error: null, refresh: refreshMock };
      vi.mocked(useClaimDetails).mockReturnValue(currentReturn);
      return Promise.resolve();
    });
    currentReturn.refresh = refreshMock;
    vi.mocked(useClaimDetails).mockReturnValue(currentReturn);

    render(<ClaimIntakeDetails />);
    await waitFor(() => expect(getRoleRowName('IME / peer review')).toBeInTheDocument());

    // Supervisor removes the added service via the staged popup.
    fireEvent.click(getRoleRowName('IME / peer review'));
    const commentBox = await screen.findByPlaceholderText('Explain the reasoning behind this decision…');
    fireEvent.change(commentBox, { target: { value: 'not needed for this claim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.queryByText('Review — IME / peer review')).not.toBeInTheDocument());

    // Nothing persisted yet — still staged only.
    expect(savePlanServicesMock).not.toHaveBeenCalled();
    expect(saveVendorServicesMock).not.toHaveBeenCalled();

    // Click Confirm Selection once.
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));

    await waitFor(() => expect(savePlanServicesMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(saveVendorServicesMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));

    // The removed service's row must not come back as active/selected —
    // it should render in the plain (SUGGESTED) bucket, not
    // cid-vendor-item--selected or --active.
    await waitFor(() => {
      const row = getRoleRowName('IME / peer review').closest('.cid-vendor-item');
      expect(row).not.toBeNull();
      expect(row?.className).not.toContain('cid-vendor-item--selected');
      expect(row?.className).not.toContain('cid-vendor-item--active');
    });

    // The payload actually sent must have excluded the removed role from
    // the plan and marked it Rejected in the vendor-review array.
    const planServicesArg = savePlanServicesMock.mock.calls[0][0];
    expect(planServicesArg.planServices).not.toContain(IME_ROLE_ID);
    const vendorServicesArg = saveVendorServicesMock.mock.calls[0][0];
    expect(vendorServicesArg.planServices).not.toContain(IME_ROLE_ID);
    const imeEntry = vendorServicesArg.serviceVendorReview.find((e: { roleName: string }) => e.roleName === 'IME / peer review');
    expect(imeEntry?.status).toBe('Rejected');
  });

  // ── 4. A Supervisor's authority isn't bounded by a service's status (FRD
  //       §6): the provider dropdown must be editable — and the change must
  //       actually reach the server on Confirm Selection — for an
  //       already-Locked, originally-recommended service, not only one still
  //       Pending Review. ───────────────────────────────────────────────────

  it('lets a Supervisor change the provider of an already-Locked (originally recommended) service, and submits it on Confirm Selection', async () => {
    vi.mocked(useClaimDetails).mockReturnValue({
      detail: makeDetail(makeRecord()) as any,
      loading: false, error: null, refresh: vi.fn(),
    });

    render(<ClaimIntakeDetails />);
    await waitFor(() => expect(getRoleRowName('Nurse case management')).toBeInTheDocument());

    // Nurse case management is 'Locked' (originally recommended, never
    // touched by the Adjuster) — its provider dropdown must still open for
    // the Supervisor.
    const trigger = await screen.findByRole('button', { name: /Careworks/ });
    fireEvent.click(trigger);
    const alternate = await screen.findByText('MedStaff Partners');
    fireEvent.click(alternate);

    // Switching an already-Locked role's provider goes through the same
    // staged, comment-required popup as everything else a Supervisor does.
    const commentBox = await screen.findByPlaceholderText('Explain the reasoning behind this decision…');
    fireEvent.change(commentBox, { target: { value: 'Switching to a closer-network provider' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.queryByText('Review — Nurse case management')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    await waitFor(() => expect(saveVendorServicesMock).toHaveBeenCalledTimes(1));

    // The staged provider change on this already-Locked role must not be
    // silently dropped just because its status wasn't 'Pending Review'.
    const vendorServicesArg = saveVendorServicesMock.mock.calls[0][0];
    const nurseEntry = vendorServicesArg.serviceVendorReview.find((e: { roleName: string }) => e.roleName === 'Nurse case management');
    expect(nurseEntry).toBeDefined();
    expect(nurseEntry?.selectedVendor).toBe('MedStaff Partners');
    expect(nurseEntry?.status).toBe('Modified');
    expect(nurseEntry?.supervisorComment).toBe('Switching to a closer-network provider');
  });

  // ── 5. Clicking a currently SUGGESTED (inactive) row to enable it must
  //       actually turn it on — confirmSupervisorReviewDecision used to only
  //       ever remove a role from activeServiceRoles (the "turn off" half),
  //       never add one, so this staged "keep" decision silently did
  //       nothing to the row. ────────────────────────────────────────────

  it('lets a Supervisor enable a currently suggested (inactive) service, and it stays enabled and is submitted on Confirm Selection', async () => {
    vi.mocked(useClaimDetails).mockReturnValue({
      detail: makeDetail(makeRecord()) as any,
      loading: false, error: null, refresh: vi.fn(),
    });

    render(<ClaimIntakeDetails />);
    await waitFor(() => expect(getRoleRowName('Physical Therapy')).toBeInTheDocument());

    // Starts inactive/SUGGESTED — neither active nor confirmed-locked.
    const rowBefore = getRoleRowName('Physical Therapy').closest('.cid-vendor-item');
    expect(rowBefore?.className).not.toContain('cid-vendor-item--active');
    expect(rowBefore?.className).not.toContain('cid-vendor-item--selected');

    fireEvent.click(getRoleRowName('Physical Therapy'));
    const commentBox = await screen.findByPlaceholderText('Explain the reasoning behind this decision…');
    fireEvent.change(commentBox, { target: { value: 'Adding physical therapy for this claim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.queryByText('Review — Physical Therapy')).not.toBeInTheDocument());

    // The row must now render as active — this is the exact bug: previously
    // nothing updated activeServiceRoles on the "enable" path, so the toggle
    // never visually switched on no matter how many times this was clicked.
    await waitFor(() => {
      const row = getRoleRowName('Physical Therapy').closest('.cid-vendor-item');
      expect(row?.className).toContain('cid-vendor-item--active');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    await waitFor(() => expect(saveVendorServicesMock).toHaveBeenCalledTimes(1));

    const vendorServicesArg = saveVendorServicesMock.mock.calls[0][0];
    expect(vendorServicesArg.planServices).toContain(PT_ROLE_ID);
    const ptEntry = vendorServicesArg.serviceVendorReview.find((e: { roleName: string }) => e.roleName === 'Physical Therapy');
    expect(ptEntry).toBeDefined();
    expect(ptEntry?.status).toBe('Included');
    expect(ptEntry?.supervisorComment).toBe('Adding physical therapy for this claim');
  });
});
