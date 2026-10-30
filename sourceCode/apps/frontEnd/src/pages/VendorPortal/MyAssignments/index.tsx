import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import ActiveVendorShell from '../../../components/layout/ActiveVendorShell';
import { getAssignments, updateAssignment } from '../../../services/activeVendor/activeVendorService';
import { getOnboardingDetails } from '../../../services/vendorOnboarding/vendorOnboardingService';
import type { VendorAssignment, AssignmentStatus } from '../../../models/activeVendor/activeVendorModel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AssignmentStatus }) {
  const styles: Record<AssignmentStatus, React.CSSProperties> = {
    New:         { background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' },
    Accepted:    { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
    'In Progress': { background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a' },
    Completed:   { background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' },
    Declined:    { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
  };
  return (
    <span style={{
      ...styles[status],
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {status}
    </span>
  );
}

// ─── Assignment row ───────────────────────────────────────────────────────────

interface RowProps {
  assignment: VendorAssignment;
  busy:       string | null;
  onAction:   (id: string, action: 'accept' | 'decline' | 'start' | 'end') => void;
}

const AssignmentRow: React.FC<RowProps> = ({ assignment, busy, onAction }) => {
  const isRowBusy = busy === assignment.assignmentId;
  const { status } = assignment;

  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td style={{ padding: '14px 16px', fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
        {assignment.claimNumber}
      </td>
      <td style={{ padding: '14px 16px', fontSize: '0.88rem' }}>{assignment.service || '—'}</td>
      <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{fmtDate(assignment.assignedDate)}</td>
      <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{fmtDate(assignment.dueDate)}</td>
      <td style={{ padding: '14px 16px' }}><StatusBadge status={status} /></td>
      <td style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {status === 'New' && (
            <>
              <button
                type="button" className="btn btn--primary btn--sm"
                disabled={isRowBusy}
                onClick={() => onAction(assignment.assignmentId, 'accept')}
              >
                {isRowBusy ? '…' : 'Accept'}
              </button>
              <button
                type="button" className="btn btn--ghost btn--sm"
                style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                disabled={isRowBusy}
                onClick={() => onAction(assignment.assignmentId, 'decline')}
              >
                Decline
              </button>
            </>
          )}
          {status === 'Accepted' && (
            <button
              type="button" className="btn btn--primary btn--sm"
              disabled={isRowBusy}
              onClick={() => onAction(assignment.assignmentId, 'start')}
            >
              {isRowBusy ? '…' : 'Start'}
            </button>
          )}
          {status === 'In Progress' && (
            <button
              type="button" className="btn btn--primary btn--sm"
              disabled={isRowBusy}
              onClick={() => onAction(assignment.assignmentId, 'end')}
            >
              {isRowBusy ? '…' : 'End'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// ─── Company group ────────────────────────────────────────────────────────────

interface GroupProps {
  companyName:  string;
  assignments:  VendorAssignment[];
  busy:         string | null;
  onAction:     (id: string, action: 'accept' | 'decline' | 'start' | 'end') => void;
}

const CompanyGroup: React.FC<GroupProps> = ({ companyName, assignments, busy, onAction }) => (
  <div style={{ marginBottom: 36 }}>
    <div style={{
      background: '#f8fafc', borderBottom: '2px solid var(--color-border)',
      padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>{companyName}</span>
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{assignments.length} claim{assignments.length !== 1 ? 's' : ''}</span>
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
          {['CLAIM REFERENCE', 'SERVICE', 'ASSIGNED', 'DUE', 'STATUS', 'ACTIONS'].map((h) => (
            <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {assignments.map((a) => (
          <AssignmentRow key={a.assignmentId} assignment={a} busy={busy} onAction={onAction} />
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Tab type ─────────────────────────────────────────────────────────────────

type TabKey = 'All' | AssignmentStatus;
const TABS: TabKey[] = ['All', 'New', 'Accepted', 'In Progress', 'Completed', 'Declined'];

// ─── Page ─────────────────────────────────────────────────────────────────────

const MyAssignments: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [companyName,  setCompanyName]  = useState<string | undefined>();
  const [assignments,  setAssignments]  = useState<VendorAssignment[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<TabKey>('All');
  const [busyId,       setBusyId]       = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!vendorId) return;
    try {
      const [data, details] = await Promise.all([
        getAssignments(vendorId),
        getOnboardingDetails(vendorId).catch(() => null),
      ]);
      setAssignments(data);
      setCompanyName(details?.companyName);
    } catch {
      setError('Failed to load assignments. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { void load(); }, [load]);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleAction = useCallback(async (
    assignmentId: string,
    action: 'accept' | 'decline' | 'start' | 'end',
  ) => {
    if (!vendorId) return;
    setBusyId(assignmentId);
    try {
      const result = await updateAssignment(vendorId, assignmentId, action);
      if (result.success) {
        showToast('success', result.message);
        await load();
      } else {
        showToast('error', result.message);
      }
    } catch {
      showToast('error', 'Action failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  }, [vendorId, load, showToast]);

  // Counts per tab
  const counts = useMemo(() => {
    const c: Partial<Record<TabKey, number>> = { All: assignments.length };
    for (const s of ['New', 'Accepted', 'In Progress', 'Completed', 'Declined'] as AssignmentStatus[]) {
      c[s] = assignments.filter((a) => a.status === s).length;
    }
    return c;
  }, [assignments]);

  // Filter + group
  const filtered = useMemo(() =>
    activeTab === 'All' ? assignments : assignments.filter((a) => a.status === activeTab),
  [assignments, activeTab]);

  const grouped = useMemo(() => {
    const map = new Map<string, VendorAssignment[]>();
    for (const a of filtered) {
      if (!map.has(a.companyName)) map.set(a.companyName, []);
      map.get(a.companyName)!.push(a);
    }
    return [...map.entries()];
  }, [filtered]);

  if (!vendorId) return null;

  return (
    <ActiveVendorShell vendorId={vendorId} activeTab="assignments" companyName={companyName}>
      <div className="vpo-page">
        <p className="vpo-breadcrumb">Service Provider Portal</p>
        <h1 className="vpo-page-title">My Assignments</h1>
        <p className="vpo-page-sub">Service requests assigned to you. Accept within 24 hours.</p>

        {toast && (
          <div className={`alert alert--${toast.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>
            {toast.text}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)', marginBottom: 28 }}>
          {TABS.map((tab) => {
            const count = counts[tab] ?? 0;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '12px 20px',
                  fontSize: '0.9rem', fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                  marginBottom: -2,
                  display: 'flex', alignItems: 'center', gap: 7,
                  whiteSpace: 'nowrap',
                }}
              >
                {tab}
                {count > 0 && (
                  <span style={{
                    background: isActive ? 'var(--color-primary)' : '#e5e7eb',
                    color: isActive ? '#fff' : 'var(--color-text-muted)',
                    borderRadius: 10, padding: '1px 7px',
                    fontSize: '0.7rem', fontWeight: 700,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading && <div className="vpo-loading">Loading assignments…</div>}
        {error   && <div className="alert alert--error">{error}</div>}

        {!loading && !error && (
          grouped.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px 0', fontSize: '0.9rem' }}>
              No assignments in this category.
            </div>
          ) : (
            <div className="vod-main-card" style={{ padding: 0, overflow: 'hidden' }}>
              {grouped.map(([company, items]) => (
                <CompanyGroup
                  key={company}
                  companyName={company || 'Unknown Company'}
                  assignments={items}
                  busy={busyId}
                  onAction={handleAction}
                />
              ))}
            </div>
          )
        )}
      </div>
    </ActiveVendorShell>
  );
};

export default MyAssignments;
