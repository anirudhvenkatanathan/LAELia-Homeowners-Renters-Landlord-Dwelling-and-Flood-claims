import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, RowClickedEvent, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import AppShell from '../../../components/layout/AppShell';
import UploadClaimModal from '../../../components/claimIntakeMaster/UploadClaimModal';
import { useAllClaimRecords } from '../../../hooks/claimIntakeMaster/useAllClaimRecords';
import { useAuth } from '../../../context/AuthContext';
import { isAdjusterTypeRole } from '../../../utils/permissions';
import type { IndividualClaimRecord } from '../../../models/claimIntakeMaster/claimIntakeModel';

// UI-only display name for Claims Adjusters — route, API, and DB records are unchanged.
const CLAIMS_ADJUSTER_TITLE = 'Claims Command Center';
const DEFAULT_TITLE = 'Claims Orchestrator';

// ─── View mode — remembered for the session only (sessionStorage, not localStorage) ──

type ViewMode = 'kanban' | 'list';
const VIEW_MODE_KEY = 'cim-view-mode';

function getInitialViewMode(): ViewMode {
  try {
    return sessionStorage.getItem(VIEW_MODE_KEY) === 'kanban' ? 'kanban' : 'list';
  } catch {
    return 'list';
  }
}

// ─── Swimlane / stage column config ───────────────────────────────────────────
// Colors from docs/Common/DESIGN.md § Kanban Columns. Shared by both the
// Kanban board and the List View's status filter pills + status badge.

interface BoardColumn { key: string; label: string; bg: string; header: string; fill: string; }

// "Pending Review" — vendor override awaiting Claims Supervisor approval.
// Its POSITION in the column/pill order is role-dependent (getStageColumns
// below): first for Claims Supervisor (their normal review queue), last for
// adjuster-type roles (matches the "sinks to the end" List view ordering).
// LAElia teal re-theme (2026-07-23): recolored to the reference "KanBan BG
// Colors" tile — each column is its named token's base hex at ~10% (bg) and
// ~20% (fill/left-border) opacity over white; header is the token's base hex
// used directly as text, same convention the app's existing badges/values
// already use for moderately-saturated colors as legible text-on-light-bg.
const PENDING_REVIEW_COLUMN: BoardColumn =
  { key: 'pending-review', label: 'Pending Review', bg: '#FCF4E9', header: '#DD9226', fill: '#F8E9D4' }; // Accent Gold

const OTHER_STAGE_COLUMNS: BoardColumn[] = [
  { key: 'pending-selection',   label: 'Pending Selection',       bg: '#E7F2F2', header: '#0B807B', fill: '#CEE6E5' }, // Primary (teal)
  { key: 'finalized-selection', label: 'Finalized Selection',     bg: '#EBF2FB', header: '#3A7BD5', fill: '#D8E5F7' }, // Accent Info
  { key: 'completed',           label: 'Completed',               bg: '#EEF6EC', header: '#56A33C', fill: '#DDEDD8' }, // Accent Success
];

// Canonical set (key-validity checks / lookups only — order here is irrelevant,
// see getStageColumns for the role-ordered array actually used for rendering).
const STAGE_COLUMNS: BoardColumn[] = [PENDING_REVIEW_COLUMN, ...OTHER_STAGE_COLUMNS];

// Rendering order for the Kanban swimlanes + status filter pills: Claims
// Supervisor sees "Pending Review" first (their review queue); adjuster-type
// roles see "Pending Supervisor Approval" last (2026-07-23: briefly unified
// to the same order for both roles, reverted the same day back to this
// role-dependent order per explicit follow-up).
function getStageColumns(isAdjuster: boolean): BoardColumn[] {
  return isAdjuster
    ? [...OTHER_STAGE_COLUMNS, PENDING_REVIEW_COLUMN]
    : [PENDING_REVIEW_COLUMN, ...OTHER_STAGE_COLUMNS];
}

const OTHER_COLUMN: BoardColumn = { key: 'other', label: 'Other', bg: '#F3F5F5', header: '#5B6D6A', fill: '#E3E9E8' }; // Closed Lost / Dead — neutral, not part of the reference's 4-column palette

const ALL_COLUMNS = [...STAGE_COLUMNS, OTHER_COLUMN];

// "Pending Service Selection" and "Pending Service Provider Selection" are both
// shown under the single combined "Pending Selection" column.
const PENDING_SLUGS = new Set(['pending-service-selection', 'pending-service-provider-selection']);
// Raw DB status "Service Provider Finalized" slugifies to
// 'service-provider-finalized', which no longer matches the
// 'finalized-selection' column key above — map it explicitly, same as
// PENDING_SLUGS, instead of relying on the slug happening to equal the key.
const FINALIZED_SLUGS = new Set(['service-provider-finalized']);

function stageKey(planServiceStatus: string | undefined): string {
  const slug = (planServiceStatus ?? '').toLowerCase().replace(/\s+/g, '-');
  if (PENDING_SLUGS.has(slug)) return 'pending-selection';
  if (FINALIZED_SLUGS.has(slug)) return 'finalized-selection';
  return STAGE_COLUMNS.some((c) => c.key === slug) ? slug : 'other';
}

function columnFor(planServiceStatus: string | undefined): BoardColumn {
  const key = stageKey(planServiceStatus);
  return ALL_COLUMNS.find((c) => c.key === key) ?? OTHER_COLUMN;
}

// Claims Adjuster / Senior Adjuster / Junior Adjuster see "Pending Supervisor
// Approval" instead of "Pending Review" for the vendor-override review stage —
// UI label only, the underlying 'Pending Review' DB status/business logic is
// unchanged (Claims Supervisor still sees "Pending Review").
function displayLabel(column: BoardColumn, isAdjuster: boolean): string {
  return isAdjuster && column.key === 'pending-review' ? 'Pending Supervisor Approval' : column.label;
}

function formatCurrency(amount: string | undefined): string {
  const n = parseFloat(amount ?? '');
  if (!Number.isFinite(n)) return amount || '—';
  return `$${n.toLocaleString('en-US')}`;
}

// ─── Board Card (Kanban) ───────────────────────────────────────────────────────

// A claim is "reprocessed" when it was previously finalized/completed (leaving
// behind existingplanservices from that round) and a re-upload has just reset
// it back to the pending column for a new services/providers pass — see
// uploadClaim's status-reset logic in apps/api/graphQL/claimIntakeEntity.ts.
function isReprocessedClaim(record: IndividualClaimRecord): boolean {
  return (record.existingplanservices?.length ?? 0) > 0
    && stageKey(record.planServiceStatus) === 'pending-selection';
}

interface BoardCardProps { record: IndividualClaimRecord; onOpen: (r: IndividualClaimRecord) => void; }

const BoardCard: React.FC<BoardCardProps> = ({ record, onOpen }) => (
  <div
    className="cim-board-card"
    role="button"
    tabIndex={0}
    onClick={() => onOpen(record)}
    onKeyDown={(e) => e.key === 'Enter' && onOpen(record)}
  >
    <div className="cim-board-card__top">
      <span className="cim-board-card__number">{record.claimNumber || '—'}</span>
      <span className="cim-board-card__type">{record.claimType || ''}</span>
    </div>
    {isReprocessedClaim(record) && (
      <span
        className="cim-board-card__reprocessed"
        title="Reprocessed claim — new services & providers need to be selected"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
        Reprocessed
      </span>
    )}
    <div className="cim-board-card__insured">{record.insuredName || '—'}</div>
    <div className="cim-board-card__meta">
      <span>{record.policyNumber || '—'}</span>
      <span>{record.lossDate || '—'}</span>
    </div>
    <div className="cim-board-card__footer">
      <span className="cim-board-card__amount">{record.claimAmount || '—'}</span>
    </div>
  </div>
);

// ─── Claim Summary Drawer ──────────────────────────────────────────────────────

interface ClaimSummaryDrawerProps {
  record:        IndividualClaimRecord | null;
  isAdjuster:    boolean;
  onClose:       () => void;
  onMoreDetails: (record: IndividualClaimRecord) => void;
}

const ClaimSummaryDrawer: React.FC<ClaimSummaryDrawerProps> = ({ record, isAdjuster, onClose, onMoreDetails }) => {
  useEffect(() => {
    if (!record) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [record, onClose]);

  if (!record) return null;

  const column = columnFor(record.planServiceStatus);

  return createPortal(
    <div className="csdr-overlay" onClick={onClose}>
      <div className="csdr" role="dialog" aria-modal="true" aria-label="Claim summary" onClick={(e) => e.stopPropagation()}>
        <div className="csdr__header">
          <span>{record.claimNumber || 'Claim Summary'}</span>
          <button type="button" className="csdr__close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="csdr__body">
          <div className="csdr__status-row">
            <span className="csdr__status-dot" style={{ background: column.header }} />
            <span style={{ color: column.header }}>{displayLabel(column, isAdjuster)}</span>
          </div>

          <div className="csdr__fields">
            <div className="csdr__field">
              <span className="csdr__field-label">Claim Number</span>
              <span className="csdr__field-value">{record.claimNumber || '—'}</span>
            </div>
            <div className="csdr__field">
              <span className="csdr__field-label">Insured Name</span>
              <span className="csdr__field-value">{record.insuredName || '—'}</span>
            </div>
            <div className="csdr__field">
              <span className="csdr__field-label">Policy Number</span>
              <span className="csdr__field-value">{record.policyNumber || '—'}</span>
            </div>
            <div className="csdr__field">
              <span className="csdr__field-label">Claim Type</span>
              <span className="csdr__field-value">{record.claimType || '—'}</span>
            </div>
            <div className="csdr__field">
              <span className="csdr__field-label">Loss Date</span>
              <span className="csdr__field-value">{record.lossDate || '—'}</span>
            </div>
            <div className="csdr__field">
              <span className="csdr__field-label">Reported Date</span>
              <span className="csdr__field-value">{record.reportedDate || '—'}</span>
            </div>
            <div className="csdr__divider" />
            <div className="csdr__field">
              <span className="csdr__field-label">Claim Amount</span>
              <span className="csdr__field-value csdr__field-value--amount">{formatCurrency(record.claimAmount)}</span>
            </div>
            <div className="csdr__field">
              <span className="csdr__field-label">Claim Status</span>
              <span className="csdr__field-value">{record.claimStatus || '—'}</span>
            </div>
          </div>
        </div>

        <div className="csdr__footer">
          <button type="button" className="csdr__btn-ghost" onClick={onClose}>Close</button>
          <button type="button" className="csdr__btn-primary" onClick={() => onMoreDetails(record)}>More Details</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── List View (AG Grid) ────────────────────────────────────────────────────────

const StatusCellRenderer: React.FC<ICellRendererParams<IndividualClaimRecord>> = ({ data, context }) => {
  const column = columnFor(data?.planServiceStatus);
  const isAdjuster = !!(context as { isAdjuster?: boolean } | undefined)?.isAdjuster;
  return (
    <span className="cim-status-badge" style={{ background: column.fill, color: column.header }}>
      {displayLabel(column, isAdjuster)}
    </span>
  );
};

const AmountCellRenderer: React.FC<ICellRendererParams<IndividualClaimRecord>> = ({ data }) => (
  <span style={{ fontWeight: 600 }}>{formatCurrency(data?.claimAmount)}</span>
);

const ClaimNumberCellRenderer: React.FC<ICellRendererParams<IndividualClaimRecord>> = ({ data }) => (
  <span style={{ color: '#2563eb', fontWeight: 600 }}>{data?.claimNumber || '—'}</span>
);

const listColumnDefs: ColDef<IndividualClaimRecord>[] = [
  { headerName: 'CLAIM #',       field: 'claimNumber',       flex: 1,   minWidth: 120, sortable: true, filter: false, cellRenderer: ClaimNumberCellRenderer },
  { headerName: 'INSURED NAME',  field: 'insuredName',       flex: 1.3, minWidth: 160, sortable: true, filter: false },
  { headerName: 'POLICY #',      field: 'policyNumber',      flex: 1,   minWidth: 130, sortable: true, filter: false },
  { headerName: 'CLAIM TYPE',    field: 'claimType',         flex: 0.9, minWidth: 110, sortable: true, filter: false },
  { headerName: 'LOSS DATE',     field: 'lossDate',          flex: 0.9, minWidth: 110, sortable: true, filter: false },
  { headerName: 'AMOUNT',        field: 'claimAmount',       flex: 0.9, minWidth: 110, sortable: true, filter: false, cellRenderer: AmountCellRenderer },
  { headerName: 'STATUS',        field: 'planServiceStatus', flex: 1.4, minWidth: 170, sortable: true, filter: false, cellRenderer: StatusCellRenderer },
];

const defaultColDef: ColDef = { resizable: true };

// ─── Main Screen ──────────────────────────────────────────────────────────────

const ClaimIntakeMaster: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdjuster = isAdjusterTypeRole(user?.roleName);
  const { records, loading, error, refresh } = useAllClaimRecords();

  const [showModal,    setShowModal]    = useState(false);
  const [quickFilter,  setQuickFilter]  = useState('');
  const [stageFilter,  setStageFilter]  = useState<string>('all');
  const [viewMode,     setViewMode]     = useState<ViewMode>(getInitialViewMode);
  const [drawerRecord, setDrawerRecord] = useState<IndividualClaimRecord | null>(null);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try { sessionStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* sessionStorage unavailable — view choice just won't persist */ }
  }, []);

  // Browser tab title — only overridden for Claims Adjusters, restored on unmount
  // so navigating away doesn't leave a stale title for other screens/roles.


  // ── Search + stage filter — shared by both views ─────────────────────────
  // Claims Command Center screen only: "Completed" claims are excluded from
  // the list/kanban entirely (no filter pill for it either, see
  // orderedStageColumns below) — they still count toward the "Completed" stat
  // tile above, which reads from `records` directly and is unaffected.
  const filteredRecords = useMemo(() => {
    const q = quickFilter.trim().toLowerCase();
    const base = records.filter((r) => {
      if (stageKey(r.planServiceStatus) === 'completed') return false;
      if (stageFilter !== 'all' && stageKey(r.planServiceStatus) !== stageFilter) return false;
      if (!q) return true;
      return (
        (r.claimNumber ?? '').toLowerCase().includes(q) ||
        (r.insuredName ?? '').toLowerCase().includes(q) ||
        (r.policyNumber ?? '').toLowerCase().includes(q)
      );
    });
    if (!isAdjuster) return base;
    // Adjuster roles: claims awaiting Supervisor approval sink to the end of
    // the list (display-order only — stageFilter/search results are unaffected).
    const rest: IndividualClaimRecord[] = [];
    const awaitingApproval: IndividualClaimRecord[] = [];
    base.forEach((r) => (stageKey(r.planServiceStatus) === 'pending-review' ? awaitingApproval : rest).push(r));
    return [...rest, ...awaitingApproval];
  }, [records, quickFilter, stageFilter, isAdjuster]);

  const gridContext = useMemo(() => ({ isAdjuster }), [isAdjuster]);

  // Role-ordered columns — Claims Supervisor sees "Pending Review" first,
  // adjuster-type roles see "Pending Supervisor Approval" last (§13). Used by
  // the stat tiles, which still report the "Completed" count.
  const orderedStageColumns = useMemo(() => getStageColumns(isAdjuster), [isAdjuster]);

  // Claims Command Center screen only: no "Completed" filter pill / Kanban
  // swimlane — completed claims are excluded from filteredRecords above, so
  // a "Completed" lane would always render empty.
  const visibleStageColumns = useMemo(
    () => orderedStageColumns.filter((col) => col.key !== 'completed'),
    [orderedStageColumns],
  );

  // ── Group into swimlane columns by pipeline status (Kanban view) ─────────
  // "Other" is intentionally excluded as its own swimlane — see ALL_COLUMNS
  // comment above; any record with an unrecognized status is still fully
  // visible in the List view, just without a dedicated Kanban lane.
  const boardColumns = useMemo(() => {
    const byKey = new Map<string, IndividualClaimRecord[]>();
    filteredRecords.forEach((r) => {
      const key = stageKey(r.planServiceStatus);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(r);
    });
    return visibleStageColumns.map((col) => ({ column: col, records: byKey.get(col.key) ?? [] }));
  }, [filteredRecords, visibleStageColumns]);

  // ── Stat tiles (all records, independent of the stage filter/search) ─────
  const stats = useMemo(() => {
    const countFor = (key: string) => records.filter((r) => stageKey(r.planServiceStatus) === key).length;
    return {
      total: records.length,
      pending: countFor('pending-selection'),
      pendingReview: countFor('pending-review'),
      finalized: countFor('finalized-selection'),
    };
  }, [records]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  // Opens the summary drawer; navigation to the details page now only happens
  // via the drawer's "More Details" button (handleGoToDetails).
  const handleOpenCard = useCallback((record: IndividualClaimRecord) => {
    setDrawerRecord(record);
  }, []);

  const handleGoToDetails = useCallback((record: IndividualClaimRecord) => {
    setDrawerRecord(null);
    if (record.uploadId) navigate(`/claim-intake/details/${record.uploadId}`, {
      state: { claimNumber: record.claimNumber, recordIndex: record.recordIndex },
    });
  }, [navigate]);

  const onRowClicked = useCallback((event: RowClickedEvent<IndividualClaimRecord>) => {
    if (event.data) handleOpenCard(event.data);
  }, [handleOpenCard]);

  return (
    <AppShell>
      <div className="dash-page">

        {/* ── Header card ───────────────────────────────────────────────── */}
        <div className="dash-header-card">
          <div className="dash-title-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h1 className="page-title">Claims Command Center</h1>
              <p className="page-subtitle">Upload and review Claims Command Center records</p>
            </div>
            <button type="button" className="btn btn--primary" style={{ flexShrink: 0 }} onClick={() => setShowModal(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload Claim
            </button>
          </div>
        </div>

        {/* ── Content area (gray background) ───────────────────────────── */}
        <div className="dash-content-area">

          {/* Stat tiles */}
          <div className="dash-section">
            <div className="dash-metric-row">
              <div className="dash-metric-card">
                <div className="dash-metric-card__header"><span className="dash-metric-card__label">Total Claims</span></div>
                <div className="dash-metric-card__value">{stats.total.toLocaleString()}</div>
                <div className="dash-metric-card__footer"><span className="dash-metric-card__sub">All statuses</span></div>
              </div>
              {/* Same role-based ordering as the Kanban columns/filter pills
                  (visibleStageColumns, §13) — Pending Review leads for Claims
                  Supervisor, Pending Supervisor Approval trails for adjuster
                  roles. "Total Claims" stays fixed first since it's a grand
                  total, not one of the 3 status-stage tiles. No "Completed"
                  tile — Claims Command Center screen only, completed claims
                  are excluded from this screen entirely (filter pill, Kanban
                  swimlane, and stat tile). */}
              {visibleStageColumns.map((column) => {
                const tile = column.key === 'pending-review'
                  ? { label: isAdjuster ? 'Pending Supervisor Approval' : 'Pending Review', value: stats.pendingReview, sub: isAdjuster ? 'Awaiting Supervisor decision' : 'Vendor override awaiting review' }
                  : column.key === 'pending-selection'
                  ? { label: 'Pending Selection', value: stats.pending, sub: 'Awaiting service/provider' }
                  : { label: 'Finalized Selection', value: stats.finalized, sub: 'Vendor confirmed' };
                return (
                  <div className="dash-metric-card" key={column.key}>
                    <div className="dash-metric-card__header"><span className="dash-metric-card__label">{tile.label}</span></div>
                    <div className="dash-metric-card__value">{tile.value.toLocaleString()}</div>
                    <div className="dash-metric-card__footer"><span className="dash-metric-card__sub">{tile.sub}</span></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Toolbar: stage filter pills + search + view toggle */}
          <div className="dash-section" style={{ paddingBottom: 0 }}>
            <div className="vs-toolbar">
              <div className="vs-filter-pills" role="group" aria-label="Filter by claim status" style={{ margin: 0 }}>
                <button type="button" className={`vs-filter-pill${stageFilter === 'all' ? ' vs-filter-pill--active' : ''}`}
                  onClick={() => setStageFilter('all')} aria-pressed={stageFilter === 'all'}>
                  All Claims
                </button>
                {visibleStageColumns.map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    className={`vs-filter-pill${stageFilter === col.key ? ' vs-filter-pill--active' : ''}`}
                    onClick={() => setStageFilter(col.key)}
                    aria-pressed={stageFilter === col.key}
                  >
                    {displayLabel(col, isAdjuster)}
                  </button>
                ))}
              </div>

              <div className="cim-search-bar" role="search" style={{ marginLeft: 'auto', flex: 1, minWidth: 200, maxWidth: 420 }}>
                <span className="cim-search-bar__icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
                <input
                  type="text"
                  className="cim-search-bar__input"
                  placeholder="Search claim number, insured name, policy number…"
                  value={quickFilter}
                  onChange={(e) => setQuickFilter(e.target.value)}
                  aria-label="Search claim records"
                />
                {quickFilter && (
                  <button type="button" onClick={() => setQuickFilter('')}
                    style={{ color: 'var(--color-text-light)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>

              <div className="cim-view-toggle" role="group" aria-label="Switch view">
                <button
                  type="button"
                  className={`cim-view-toggle__btn${viewMode === 'list' ? ' cim-view-toggle__btn--active' : ''}`}
                  onClick={() => handleViewModeChange('list')}
                  aria-pressed={viewMode === 'list'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  List
                </button>
                <button
                  type="button"
                  className={`cim-view-toggle__btn${viewMode === 'kanban' ? ' cim-view-toggle__btn--active' : ''}`}
                  onClick={() => handleViewModeChange('kanban')}
                  aria-pressed={viewMode === 'kanban'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="6" height="18" rx="1"/><rect x="10" y="3" width="6" height="12" rx="1"/><rect x="17" y="3" width="4" height="8" rx="1"/>
                  </svg>
                  Kanban
                </button>
              </div>
            </div>
          </div>

          {/* Board / List */}
          <div className="dash-section" style={{ paddingBottom: 28 }}>
            <div className="cim-board-card">

              <div className="cim-grid-card__header">
                <span className="cim-grid-card__count">
                  {loading ? 'Loading…'
                    : filteredRecords.length > 0
                    ? `${filteredRecords.length} claim${filteredRecords.length !== 1 ? 's' : ''}`
                    : 'No claims yet'}
                </span>
                <div className="cim-grid-card__actions">
                  <button type="button" className="btn btn--ghost btn--sm"
                    onClick={() => refresh()} title="Refresh" aria-label="Refresh">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                    </svg>
                  </button>
                </div>
              </div>

              {error && <div className="alert alert--error" role="alert" style={{ margin: '12px 18px 0' }}>{error}</div>}

              {!loading && filteredRecords.length === 0 ? (
                <p className="cim-board-empty">No claim records found. Click <strong>Upload Claim</strong> to get started.</p>
              ) : viewMode === 'list' ? (
                <div className="ag-theme-alpine cim-ag-grid">
                  <AgGridReact<IndividualClaimRecord>
                    rowData={filteredRecords}
                    columnDefs={listColumnDefs}
                    defaultColDef={defaultColDef}
                    context={gridContext}
                    onRowClicked={onRowClicked}
                    rowHeight={52}
                    headerHeight={40}
                    animateRows
                    pagination
                    paginationPageSize={10}
                    paginationPageSizeSelector={[10, 20, 50]}
                    suppressCellFocus
                    overlayNoRowsTemplate='<span style="color:#9ca3af;font-size:13px">No claims match the current filters.</span>'
                  />
                </div>
              ) : (
                <div className="cim-board">
                  {boardColumns.map(({ column, records: colRecords }) => (
                    <div key={column.key} className="cim-board-column" style={{ background: column.bg }}>
                      <div className="cim-board-column__header">
                        <span className="cim-board-column__label" style={{ color: column.header }}>{displayLabel(column, isAdjuster)}</span>
                        <span className="cim-board-column__count" style={{ background: column.fill, color: column.header }}>
                          {colRecords.length}
                        </span>
                      </div>
                      <div className="cim-board-column__cards">
                        {colRecords.map((r) => (
                          <BoardCard key={`${r.uploadId}-${r.recordIndex}`} record={r} onOpen={handleOpenCard} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      <UploadClaimModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => refresh()}
      />

      <ClaimSummaryDrawer
        record={drawerRecord}
        isAdjuster={isAdjuster}
        onClose={() => setDrawerRecord(null)}
        onMoreDetails={handleGoToDetails}
      />
    </AppShell>
  );
};

export default ClaimIntakeMaster;
