import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import type { SupervisorReviewedClaim } from '../../../../models/claimIntakeMaster/claimIntakeModel';

// ─── Mock useSupervisorReviewedClaims ──────────────────────────────────────────

vi.mock('../../../../hooks/claimIntakeMaster/useSupervisorReviewedClaims', () => ({
  useSupervisorReviewedClaims: vi.fn(),
}));

// ─── Mock react-router-dom ────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Routes: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Route: ({ element }: { element: React.ReactNode }) => <>{element}</>,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/claim-supervisor-comments' }),
  useNavigate: () => vi.fn(),
  Navigate: () => null,
}));

// ─── Mock useMenu ─────────────────────────────────────────────────────────────

vi.mock('../../../../hooks/menu/useMenu', () => ({
  useMenu: vi.fn(() => ({ items: [], loading: false, error: null })),
}));

// ─── Mock useAuth ─────────────────────────────────────────────────────────────

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { fullName: 'Priya Nair', username: 'claimsadj' } })),
}));

// ─── Mock Apollo Client (pulled in transitively via AppShell/config) ──────────

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

import { useSupervisorReviewedClaims } from '../../../../hooks/claimIntakeMaster/useSupervisorReviewedClaims';
import SupervisorComments from '../index';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
//
// System clock is fixed to Wed 2026-08-19 so each fixture claim lands in
// exactly one more/less-inclusive date-range bucket than the last:
//   today            >= 2026-08-19
//   this week        >= 2026-08-16 (Sun)
//   this month       >= 2026-08-01
//   this quarter     >= 2026-07-01
//   this year        >= 2026-01-01
//   all              no lower bound
//
// CLM-MONTH and CLM-MONTH-2 share the same calendar day (2026-08-05) but
// differ in final badge — used to test the specific-date picker in
// combination with the status-pill filter.

const NOW = new Date('2026-08-19T12:00:00');

function makeClaim(claimNumber: string, reviewedAt: string, finalBadge: 'Modified' | 'Included' | 'Rejected'): SupervisorReviewedClaim {
  return {
    uploadId: `upload-${claimNumber}`,
    recordIndex: 1,
    claimNumber,
    insuredName: `Insured ${claimNumber}`,
    claimType: 'Workers Compensation',
    lastReviewedAt: reviewedAt,
    items: [
      {
        roleName: 'RTW / JFA',
        changeType: 'ProviderChange',
        displayChangeType: 'Provider Change',
        originalValue: 'Vendor A',
        finalValue: 'Vendor B',
        finalBadge,
        supervisorComment: `Comment for ${claimNumber}`,
        reviewedBy: 'claimssupervisor',
        reviewedAt,
      },
    ],
  };
}

const sampleClaims: SupervisorReviewedClaim[] = [
  makeClaim('CLM-TODAY',    '2026-08-19T09:00:00.000Z', 'Included'),
  makeClaim('CLM-WEEK',     '2026-08-17T09:00:00.000Z', 'Rejected'),
  makeClaim('CLM-MONTH',    '2026-08-05T09:00:00.000Z', 'Modified'),
  makeClaim('CLM-MONTH-2',  '2026-08-05T15:00:00.000Z', 'Rejected'),
  makeClaim('CLM-QUARTER',  '2026-07-15T09:00:00.000Z', 'Included'),
  makeClaim('CLM-YEAR',     '2026-04-10T09:00:00.000Z', 'Modified'),
  makeClaim('CLM-OLD',      '2025-12-01T09:00:00.000Z', 'Rejected'),
];

function mockClaims(claims: SupervisorReviewedClaim[]): void {
  vi.mocked(useSupervisorReviewedClaims).mockReturnValue({
    claims,
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
}

/** The in-month day cell for `day` (1-31) — excludes prev/next-month padding cells. */
function getInMonthDayCell(container: HTMLElement, day: number): HTMLElement {
  const cells = Array.from(container.querySelectorAll('.dp-picker__day:not(.dp-picker__day--outside)'));
  const match = cells.find((c) => c.textContent === String(day));
  if (!match) throw new Error(`No in-month day cell found for ${day}`);
  return match as HTMLElement;
}

/** Scopes queries to the claim list panel — the detail panel echoes the
 * selected (first-filtered) claim's number too, so an unscoped `getByText`
 * on a claim number can match twice once only one/a few claims remain. */
function listPanel(container: HTMLElement) {
  const list = container.querySelector('.csc-list');
  if (!list) throw new Error('.csc-list not found');
  return within(list as HTMLElement);
}

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

// ─────────────────────────────────────────────────────────────────────────────

describe('SupervisorComments — Date Range filter', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterAll(() => { vi.useRealTimers(); });

  beforeEach(() => { mockClaims(sampleClaims); });
  afterEach(() => { vi.clearAllMocks(); mockClaims(sampleClaims); });

  // ── Regression: dropdown-only behavior, unchanged by the calendar addition ──

  describe('Date Range dropdown (regression — unaffected by the calendar picker)', () => {
    it('lists "All" as the first option, ahead of the existing options', async () => {
      render(<SupervisorComments />, { wrapper: Wrapper });
      const select = await screen.findByLabelText('Date range') as HTMLSelectElement;
      const optionLabels = Array.from(select.options).map((o) => o.textContent);
      expect(optionLabels).toEqual(['All', 'Today', 'This week', 'This Month', 'This Quarter', 'This Year']);
    });

    it('defaults to "All" on initial load, showing every claim unfiltered', async () => {
      render(<SupervisorComments />, { wrapper: Wrapper });
      const select = await screen.findByLabelText('Date range') as HTMLSelectElement;
      expect(select.value).toBe('all');
      await waitFor(() => expect(screen.getByText('7 claims')).toBeInTheDocument());
      expect(screen.getByText('CLM-OLD')).toBeInTheDocument();
    });

    it('narrows the claims list and count badge as a stricter range is selected', async () => {
      const user = userEvent.setup({ delay: null });
      const { container } = render(<SupervisorComments />, { wrapper: Wrapper });
      const select = await screen.findByLabelText('Date range') as HTMLSelectElement;

      await user.selectOptions(select, 'this-year');
      await waitFor(() => expect(screen.getByText('6 claims')).toBeInTheDocument());
      expect(screen.queryByText('CLM-OLD')).not.toBeInTheDocument();

      await user.selectOptions(select, 'today');
      await waitFor(() => expect(screen.getByText('1 claim')).toBeInTheDocument());
      expect(listPanel(container).getByText('CLM-TODAY')).toBeInTheDocument();
    });

    it('shows the empty-state message when a narrow range matches nothing, and clears it back to "All"', async () => {
      mockClaims(sampleClaims.filter((c) => c.claimNumber !== 'CLM-TODAY'));
      const user = userEvent.setup({ delay: null });
      render(<SupervisorComments />, { wrapper: Wrapper });
      const select = await screen.findByLabelText('Date range') as HTMLSelectElement;

      await user.selectOptions(select, 'today');
      await waitFor(() => expect(screen.getByText('No claims match your filters')).toBeInTheDocument());

      await user.selectOptions(select, 'all');
      await waitFor(() => {
        expect(screen.queryByText('No claims match your filters')).not.toBeInTheDocument();
        expect(screen.getByText('6 claims')).toBeInTheDocument();
      });
    });
  });

  // ── New: specific-date calendar popup ───────────────────────────────────────

  describe('Specific-date calendar picker', () => {
    it('renders next to the Date Range dropdown, not in place of it', async () => {
      render(<SupervisorComments />, { wrapper: Wrapper });
      await screen.findByLabelText('Date range');
      expect(screen.getByLabelText('Pick a specific date')).toBeInTheDocument();
    });

    it('opens a month calendar popup when the icon is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      render(<SupervisorComments />, { wrapper: Wrapper });

      await user.click(screen.getByLabelText('Pick a specific date'));
      expect(screen.getByRole('dialog', { name: 'Select a date' })).toBeInTheDocument();
      expect(screen.getByText('August 2026')).toBeInTheDocument();
    });

    it('selecting a date overrides the Date Range dropdown filter, without changing the dropdown\'s own value', async () => {
      const user = userEvent.setup({ delay: null });
      const { container } = render(<SupervisorComments />, { wrapper: Wrapper });

      const select = await screen.findByLabelText('Date range') as HTMLSelectElement;
      expect(select.value).toBe('all');

      await user.click(screen.getByLabelText('Pick a specific date'));
      await user.click(getInMonthDayCell(container, 15)); // 2026-08-15 — no claims on this day

      expect(select.value).toBe('all'); // dropdown display is untouched
      await waitFor(() => expect(screen.getByText('No claims match your filters')).toBeInTheDocument());
    });

    it('narrows to exactly the claims reviewed on the picked date', async () => {
      const user = userEvent.setup({ delay: null });
      const { container } = render(<SupervisorComments />, { wrapper: Wrapper });

      await user.click(screen.getByLabelText('Pick a specific date'));
      await user.click(getInMonthDayCell(container, 5)); // 2026-08-05 — CLM-MONTH + CLM-MONTH-2

      await waitFor(() => expect(screen.getByText('2 claims')).toBeInTheDocument());
      expect(listPanel(container).getByText('CLM-MONTH')).toBeInTheDocument();
      expect(listPanel(container).getByText('CLM-MONTH-2')).toBeInTheDocument();
      expect(screen.queryByText('CLM-TODAY')).not.toBeInTheDocument();
      expect(screen.queryByText('CLM-YEAR')).not.toBeInTheDocument();
    });

    it('composes with the status-pill filter (specific date AND status), same as the dropdown always has', async () => {
      const user = userEvent.setup({ delay: null });
      const { container } = render(<SupervisorComments />, { wrapper: Wrapper });

      await user.click(screen.getByLabelText('Pick a specific date'));
      await user.click(getInMonthDayCell(container, 5));
      await waitFor(() => expect(screen.getByText('2 claims')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: 'Service Rejected' }));
      await waitFor(() => expect(screen.getByText('1 claim')).toBeInTheDocument());
      expect(listPanel(container).getByText('CLM-MONTH-2')).toBeInTheDocument();
      expect(screen.queryByText('CLM-MONTH')).not.toBeInTheDocument();
    });

    it('changing the Date Range dropdown clears an active specific-date selection', async () => {
      const user = userEvent.setup({ delay: null });
      const { container } = render(<SupervisorComments />, { wrapper: Wrapper });

      await user.click(screen.getByLabelText('Pick a specific date'));
      await user.click(getInMonthDayCell(container, 5));
      await waitFor(() => expect(screen.getByText('2 claims')).toBeInTheDocument());
      expect(screen.getByLabelText('Clear selected date')).toBeInTheDocument();

      const select = screen.getByLabelText('Date range') as HTMLSelectElement;
      await user.selectOptions(select, 'today');

      expect(screen.queryByLabelText('Clear selected date')).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('1 claim')).toBeInTheDocument());
      expect(listPanel(container).getByText('CLM-TODAY')).toBeInTheDocument();
    });

    it('clearing the picked date via the trigger reverts to whatever the dropdown is set to', async () => {
      const user = userEvent.setup({ delay: null });
      const { container } = render(<SupervisorComments />, { wrapper: Wrapper });

      await user.click(screen.getByLabelText('Pick a specific date'));
      await user.click(getInMonthDayCell(container, 5));
      await waitFor(() => expect(screen.getByText('2 claims')).toBeInTheDocument());

      await user.click(screen.getByLabelText('Clear selected date'));
      // Dropdown was never changed from its default ("All") — clearing the
      // specific date should fall back to that, i.e. everything again.
      await waitFor(() => expect(screen.getByText('7 claims')).toBeInTheDocument());
    });
  });
});
