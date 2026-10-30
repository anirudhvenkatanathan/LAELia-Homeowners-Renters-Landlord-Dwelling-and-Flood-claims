import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// ── vi.mock calls are hoisted to the top by Vitest ───────────────────────────

vi.mock('react-router-dom', () => ({
  useParams:   vi.fn(() => ({ vendorId: 'vendor-1' })),
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({ state: null, pathname: '/vendors/onboarding/vendor-1', search: '', hash: '' })),
}));

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../../hooks/vendorOnboarding/useVendorOnboardingDetails', () => ({
  useVendorOnboardingDetails: vi.fn(),
}));

vi.mock('../../../../components/layout/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

// ── imports (after mocks so the mocked versions are used) ────────────────────

import { useAuth } from '../../../../context/AuthContext';
import { useVendorOnboardingDetails } from '../../../../hooks/vendorOnboarding/useVendorOnboardingDetails';
import VendorOnboardingDetails from '../index';
import type { VendorOnboardingDetails as VendorOnboardingDetailsModel } from '../../../../models/vendorOnboarding/vendorOnboardingModel';

// ── fixtures ─────────────────────────────────────────────────────────────────
// Exercises the simplified Activate flow: clicking "Activate Service
// Provider" for In Progress / Suspended / Requalification Due opens the
// EXISTING Priority Boost modal directly (no separate confirmation dialog),
// with three footer actions — Activate with Boost / Activate without Boost /
// Cancel — replacing the old standalone "Apply Priority Boost" button.

function makeDetails(overrides: Partial<VendorOnboardingDetailsModel> = {}): VendorOnboardingDetailsModel {
  return {
    vendorId: 'vendor-1',
    companyName: 'Acme Rehab Services',
    emailId: 'contact@acme.test',
    phoneNumber: '555-0100',
    address: '123 Main St',
    website: '',
    contactPersonName: '',
    contactPersonPhone: '',
    contactPersonEmail: '',
    coverage: '',
    city: '',
    state: '',
    country: '',
    vendorStatus: 'Suspended',
    vendorSource: '',
    boostApplied: false,
    priorityBoost: null,
    suspendedReason: '',
    disqualifiedReason: '',
    rating: null,
    requalDue: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    memberSince: '2025-01-01T00:00:00.000Z',
    stages: [],
    serviceRoles: [{ roleId: 'role-1', roleName: 'Nurse case management' }],
    roleSummary: [],
    lockedServiceRoleIds: [],
    ...overrides,
  };
}

const ADMIN_USER = { fullName: 'Priya Admin', username: 'admin1', roleName: 'Admin', email: 'admin@test.com', permissions: {} };

let finalApproveMock: ReturnType<typeof vi.fn>;
let applyBoostMock: ReturnType<typeof vi.fn>;

function mockHookWith(details: VendorOnboardingDetailsModel) {
  finalApproveMock = vi.fn().mockResolvedValue({ success: true, message: 'Service Provider activated successfully.' });
  applyBoostMock = vi.fn().mockResolvedValue({ success: true, message: 'Priority Boost applied successfully.' });
  vi.mocked(useVendorOnboardingDetails).mockReturnValue({
    details, loading: false, error: null, saving: false, notification: null,
    waiveReasons: [], statusHistory: [],
    uploadDoc: vi.fn(), approveDoc: vi.fn(), rejectDoc: vi.fn(), sendBackDoc: vi.fn(), recallDoc: vi.fn(),
    finalApprove: finalApproveMock, applyBoost: applyBoostMock,
    suspend: vi.fn(), disqualify: vi.fn(), setAvailability: vi.fn(),
    waiveItem: vi.fn(), clearWaiveItem: vi.fn(), activateFromPanel: vi.fn(),
    updateServiceRoles: vi.fn(), patchDetails: vi.fn(), refresh: vi.fn(), showNote: vi.fn(),
  } as any);
}

function clickActivate() {
  fireEvent.click(screen.getByRole('button', { name: 'Activate Service Provider' }));
}

describe('VendorOnboardingDetails — Activate Vendor (Priority Boost modal)', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: ADMIN_USER, token: 'fake-token' } as any);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('removes the standalone Apply Priority Boost button', async () => {
    mockHookWith(makeDetails());
    render(<VendorOnboardingDetails />);
    await waitFor(() => expect(screen.getByText('Activate Service Provider')).toBeInTheDocument());
    expect(screen.queryByText('Apply Priority Boost')).not.toBeInTheDocument();
  });

  it('opens the existing Priority Boost modal directly when clicking Activate Service Provider — no separate confirmation dialog', async () => {
    mockHookWith(makeDetails());
    render(<VendorOnboardingDetails />);
    await waitFor(() => expect(screen.getByText('Activate Service Provider')).toBeInTheDocument());

    clickActivate();

    expect(await screen.findByText('States')).toBeInTheDocument();
    expect(screen.getByText('Service Disciplines')).toBeInTheDocument();
    expect(screen.getByText('Reason for Boost')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate with Boost' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate without Boost' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(finalApproveMock).not.toHaveBeenCalled();
    expect(applyBoostMock).not.toHaveBeenCalled();
  });

  it('Cancel closes the modal without activating or saving anything', async () => {
    mockHookWith(makeDetails());
    render(<VendorOnboardingDetails />);
    await waitFor(() => expect(screen.getByText('Activate Service Provider')).toBeInTheDocument());
    clickActivate();
    await screen.findByText('Reason for Boost');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText('Reason for Boost')).not.toBeInTheDocument());
    expect(finalApproveMock).not.toHaveBeenCalled();
    expect(applyBoostMock).not.toHaveBeenCalled();
  });

  it('Activate with Boost requires a Reason for Boost and blocks activation until provided', async () => {
    mockHookWith(makeDetails());
    render(<VendorOnboardingDetails />);
    await waitFor(() => expect(screen.getByText('Activate Service Provider')).toBeInTheDocument());
    clickActivate();
    await screen.findByText('Reason for Boost');

    fireEvent.click(screen.getByRole('button', { name: 'Activate with Boost' }));

    expect(await screen.findByText('Reason for Boost is required.')).toBeInTheDocument();
    expect(applyBoostMock).not.toHaveBeenCalled();
    expect(finalApproveMock).not.toHaveBeenCalled();
  });

  it('Activate without Boost ignores an empty Reason for Boost, saves nothing, and activates with resetBoost', async () => {
    mockHookWith(makeDetails());
    render(<VendorOnboardingDetails />);
    await waitFor(() => expect(screen.getByText('Activate Service Provider')).toBeInTheDocument());
    clickActivate();
    await screen.findByText('Reason for Boost');

    // Reason for Boost left blank on purpose — must not block this path.
    fireEvent.click(screen.getByRole('button', { name: 'Activate without Boost' }));

    await waitFor(() => expect(finalApproveMock).toHaveBeenCalledTimes(1));
    expect(applyBoostMock).not.toHaveBeenCalled();
    // resetBoost:true — Boost must read No even if a prior boost had set it Yes.
    expect(finalApproveMock).toHaveBeenCalledWith(ADMIN_USER.username, true);
    expect(screen.queryByText('Reason for Boost')).not.toBeInTheDocument();
  });

  it('Activate with Boost pre-populates from an existing Priority Boost record, validates, saves the boost, then activates', async () => {
    mockHookWith(makeDetails({
      priorityBoost: {
        states: ['CA'],
        serviceDisciplines: ['Nurse case management'],
        assignmentLimit: 5,
        reasonForBoost: 'Existing fast-track reason',
      },
    }));
    render(<VendorOnboardingDetails />);
    await waitFor(() => expect(screen.getByText('Activate Service Provider')).toBeInTheDocument());
    clickActivate();

    // Pre-populated from the existing Priority Boost record.
    expect(await screen.findByDisplayValue('Existing fast-track reason')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Activate with Boost' }));

    await waitFor(() => expect(applyBoostMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(finalApproveMock).toHaveBeenCalledTimes(1));
    // Boost must be saved before activation is attempted.
    expect(applyBoostMock.mock.invocationCallOrder[0]).toBeLessThan(finalApproveMock.mock.invocationCallOrder[0]);
    // Activate-with-Boost path must not reset the flag it's about to set true.
    expect(finalApproveMock).toHaveBeenCalledWith(ADMIN_USER.username);
  });
});
