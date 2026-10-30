import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// ─── Mock react-router-dom ────────────────────────────────────────────────────

const { mockNavigate, mockLocationState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLocationState: { current: null as { clientName?: string } | null },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ vendorId: 'vendor-123' }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/vendors/active/performance/vendor-123', state: mockLocationState.current }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

// ─── Mock services + the (heavy) performance metrics component ──────────────

vi.mock('../../../../services/vendorOnboarding/vendorOnboardingService', () => ({
  getOnboardingDetails: vi.fn(),
}));

vi.mock('../../../../components/vendorOnboarding/VendorPerformanceMetrics', () => ({
  VendorPerformanceMetrics: () => <div data-testid="performance-metrics" />,
}));

import { getOnboardingDetails } from '../../../../services/vendorOnboarding/vendorOnboardingService';
import MyPerformance from '../index';

describe('MyPerformance screen', () => {
  beforeEach(() => {
    mockLocationState.current = null;
    vi.mocked(getOnboardingDetails).mockResolvedValue({
      companyName: 'Careworks',
      roleSummary: [],
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title and subtitle', async () => {
    render(<MyPerformance />);
    await waitFor(() => {
      expect(screen.getByText('My Performance')).toBeInTheDocument();
      expect(screen.getByText('Performance metrics for your active service categories.')).toBeInTheDocument();
    });
  });

  it('shows a "Back to Client Management" button', async () => {
    render(<MyPerformance />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to client management/i })).toBeInTheDocument();
    });
  });

  it('navigates back to the Client Management screen when clicked', async () => {
    const user = userEvent.setup();
    render(<MyPerformance />);

    const backButton = await screen.findByRole('button', { name: /back to client management/i });
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/vendors/active/clients/vendor-123');
  });

  it('shows the generic breadcrumb and title when reached without a client context', async () => {
    render(<MyPerformance />);
    await waitFor(() => {
      expect(screen.getByText('Service Provider Portal')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'My Performance' })).toBeInTheDocument();
    });
  });

  it('shows the client name in the breadcrumb and title when reached via View', async () => {
    mockLocationState.current = { clientName: 'Acme Insurance Co.' };
    render(<MyPerformance />);
    await waitFor(() => {
      expect(screen.getByText('Client Management › Acme Insurance Co.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Acme Insurance Co.' })).toBeInTheDocument();
    });
  });
});
