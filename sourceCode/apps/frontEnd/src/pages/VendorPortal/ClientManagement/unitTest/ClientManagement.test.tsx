import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import type { VendorPerformance } from '../../../../models/activeVendor/activeVendorModel';

// ─── Mock react-router-dom ────────────────────────────────────────────────────

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ vendorId: 'vendor-123' }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/vendors/active/clients/vendor-123' }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

// ─── Mock services ────────────────────────────────────────────────────────────

vi.mock('../../../../services/activeVendor/activeVendorService', () => ({
  getPerformance: vi.fn(),
}));

vi.mock('../../../../services/vendorOnboarding/vendorOnboardingService', () => ({
  getOnboardingDetails: vi.fn(),
}));

import { getPerformance } from '../../../../services/activeVendor/activeVendorService';
import { getOnboardingDetails } from '../../../../services/vendorOnboarding/vendorOnboardingService';
import ClientManagement from '../index';

function buildPerformance(byClient: VendorPerformance['byClient']): VendorPerformance {
  return {
    overallScore: 4.5,
    panelMedian: 4.1,
    totalAssignments: byClient.reduce((s, c) => s + c.total, 0),
    completedAssignments: byClient.reduce((s, c) => s + c.completed, 0),
    inProgressAssignments: 0,
    activeAssignments: 0,
    slaCompliance: 100,
    avgCycleTime: 7,
    byClient,
    byService: [],
    requalDue: null,
  };
}

describe('ClientManagement screen', () => {
  beforeEach(() => {
    vi.mocked(getOnboardingDetails).mockResolvedValue({ companyName: 'Careworks' } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title and subtitle', async () => {
    vi.mocked(getPerformance).mockResolvedValue(buildPerformance([]));
    render(<ClientManagement />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Client Management' })).toBeInTheDocument();
      expect(screen.getByText('Clients you currently service.')).toBeInTheDocument();
    });
  });

  it('shows a loading state before data arrives', () => {
    vi.mocked(getPerformance).mockReturnValue(new Promise(() => {}));
    render(<ClientManagement />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders the table with CLIENT / ACTIVE / COMPLETED / TOTAL columns', async () => {
    vi.mocked(getPerformance).mockResolvedValue(buildPerformance([
      { companyName: 'Acme Insurance Co.', total: 4, completed: 1, slaHit: 100, avgCycle: 7, score: null },
    ]));
    render(<ClientManagement />);

    await waitFor(() => {
      expect(screen.getByText('CLIENT')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
      expect(screen.getByText('TOTAL')).toBeInTheDocument();
    });
  });

  it('computes Active as total minus completed for each client', async () => {
    vi.mocked(getPerformance).mockResolvedValue(buildPerformance([
      { companyName: 'Acme Insurance Co.', total: 4, completed: 1, slaHit: 100, avgCycle: 7, score: null },
      { companyName: 'Beacon Mutual Group', total: 3, completed: 2, slaHit: 100, avgCycle: 7, score: null },
    ]));
    render(<ClientManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Insurance Co.')).toBeInTheDocument();
    });

    const acmeRow = screen.getByText('Acme Insurance Co.').closest('tr');
    expect(acmeRow).not.toBeNull();
    // Active = 4 - 1 = 3, Completed = 1, Total = 4
    expect(acmeRow!.textContent).toContain('3');
    expect(acmeRow!.textContent).toContain('1');
    expect(acmeRow!.textContent).toContain('4');

    const beaconRow = screen.getByText('Beacon Mutual Group').closest('tr');
    // Active = 3 - 2 = 1, Completed = 2, Total = 3
    expect(beaconRow!.textContent).toContain('1');
    expect(beaconRow!.textContent).toContain('2');
    expect(beaconRow!.textContent).toContain('3');
  });

  it('sorts clients alphabetically by name', async () => {
    vi.mocked(getPerformance).mockResolvedValue(buildPerformance([
      { companyName: 'Summit Risk Partners', total: 2, completed: 1, slaHit: 100, avgCycle: 7, score: null },
      { companyName: 'Acme Insurance Co.',   total: 4, completed: 1, slaHit: 100, avgCycle: 7, score: null },
    ]));
    render(<ClientManagement />);

    await waitFor(() => {
      expect(screen.getByText('Summit Risk Partners')).toBeInTheDocument();
    });

    const names = screen.getAllByRole('row')
      .map((row) => row.textContent ?? '')
      .filter((text) => text.includes('Acme') || text.includes('Summit'));

    expect(names[0]).toContain('Acme Insurance Co.');
    expect(names[1]).toContain('Summit Risk Partners');
  });

  it('falls back to deterministic demo clients when there is no real client activity', async () => {
    vi.mocked(getPerformance).mockResolvedValue(buildPerformance([]));
    render(<ClientManagement />);

    await waitFor(() => {
      expect(screen.getByText('Acme Insurance Co.')).toBeInTheDocument();
      expect(screen.getByText('Beacon Mutual Group')).toBeInTheDocument();
      expect(screen.getByText('Cornerstone Casualty')).toBeInTheDocument();
      expect(screen.getByText('Northwind Indemnity')).toBeInTheDocument();
      expect(screen.getByText('Summit Risk Partners')).toBeInTheDocument();
    });
  });

  it('shows the same demo clients on every load for the same vendor (deterministic)', async () => {
    vi.mocked(getPerformance).mockResolvedValue(buildPerformance([]));
    const { unmount } = render(<ClientManagement />);
    await screen.findByText('Acme Insurance Co.');
    const firstRun = screen.getByText('Acme Insurance Co.').closest('tr')!.textContent;
    unmount();

    render(<ClientManagement />);
    await screen.findByText('Acme Insurance Co.');
    const secondRun = screen.getByText('Acme Insurance Co.').closest('tr')!.textContent;

    expect(firstRun).toBe(secondRun);
  });

  it('shows an error message when the performance fetch fails', async () => {
    vi.mocked(getPerformance).mockRejectedValue(new Error('Network error'));
    render(<ClientManagement />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load client data. Please refresh.')).toBeInTheDocument();
    });
  });

  it('navigates to the My Performance screen with the client name when View is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(getPerformance).mockResolvedValue(buildPerformance([
      { companyName: 'Acme Insurance Co.', total: 4, completed: 1, slaHit: 100, avgCycle: 7, score: null },
    ]));
    render(<ClientManagement />);

    const viewButton = await screen.findByRole('button', { name: /view/i });
    await user.click(viewButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/vendors/active/performance/vendor-123',
      { state: { clientName: 'Acme Insurance Co.' } },
    );
  });
});