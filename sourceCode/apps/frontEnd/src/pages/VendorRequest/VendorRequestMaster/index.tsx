import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ICellRendererParams, RowClickedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import AppShell from '../../../components/layout/AppShell';
import { useVendorServiceRequestList } from '../../../hooks/vendorServiceRequest/useVendorServiceRequestList';
import type { StatusFilter } from '../../../hooks/vendorServiceRequest/useVendorServiceRequestList';
import {
  resolveStatusBadge,
  resolveStatusLabel,
  VENDOR_SERVICE_REQUEST_STATUSES,
} from '../../../models/vendorServiceRequest/vendorServiceRequestModel';
import type { VendorServiceRequestListItem } from '../../../models/vendorServiceRequest/vendorServiceRequestModel';
import { styles } from './styles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

// ─── Filter pills ─────────────────────────────────────────────────────────────

const STATUS_PILLS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  ...VENDOR_SERVICE_REQUEST_STATUSES.map((s) => ({ key: s, label: resolveStatusLabel(s) })),
];

// ─── Cell Renderers ───────────────────────────────────────────────────────────

const ServicesCellRenderer: React.FC<ICellRendererParams<VendorServiceRequestListItem>> = ({ data }) => {
  const names = data?.services?.map((s) => s.name).join(', ');
  return <span>{names || '—'}</span>;
};

const CoverageCellRenderer: React.FC<ICellRendererParams<VendorServiceRequestListItem>> = ({ data }) => {
  const coverage = data?.coverage?.join(', ');
  return <span style={{ color: coverage ? undefined : 'var(--color-text-muted)' }}>{coverage || '—'}</span>;
};

const StatusCellRenderer: React.FC<ICellRendererParams<VendorServiceRequestListItem>> = ({ data }) => {
  const status = data?.status ?? '';
  return <span className={`badge ${resolveStatusBadge(status)}`}>{resolveStatusLabel(status)}</span>;
};

const CreatedAtCellRenderer: React.FC<ICellRendererParams<VendorServiceRequestListItem>> = ({ data }) => (
  <span>{formatDate(data?.createdAt ?? null)}</span>
);

// ─── Column Definitions ───────────────────────────────────────────────────────

const columnDefs: ColDef<VendorServiceRequestListItem>[] = [
  { headerName: 'Company Name',   field: 'companyName',   flex: 2,   minWidth: 200, sortable: true, filter: false },
  { headerName: 'Website',        field: 'website',       flex: 1.2, minWidth: 140, sortable: true, filter: false },
  { headerName: 'Contact Person', field: 'contactPerson', flex: 1.2, minWidth: 140, sortable: true, filter: false },
  { headerName: 'Services',                              flex: 2,   minWidth: 200, sortable: false, filter: false, cellRenderer: ServicesCellRenderer },
  { headerName: 'Coverage',                              flex: 1.4, minWidth: 140, sortable: false, filter: false, cellRenderer: CoverageCellRenderer },
  { headerName: 'Status',       field: 'status',         flex: 1,   minWidth: 130, sortable: true,  filter: false, cellRenderer: StatusCellRenderer },
  { headerName: 'Submitted By', field: 'submittedBy',    flex: 1,   minWidth: 130, sortable: true,  filter: false },
  { headerName: 'Created',                               flex: 1,   minWidth: 120, sortable: true,  filter: false, cellRenderer: CreatedAtCellRenderer, sort: 'desc' },
];

const defaultColDef: ColDef = { resizable: true };

// ─── Page Component ───────────────────────────────────────────────────────────

const VendorRequestMaster: React.FC = () => {
  const navigate = useNavigate();
  const {
    requests,
    loading,
    error,
    searchQuery,
    statusFilter,
    setSearchQuery,
    setStatusFilter,
  } = useVendorServiceRequestList();

  const onRowClicked = useCallback((event: RowClickedEvent<VendorServiceRequestListItem>) => {
    if (event.data?.requestId) {
      navigate(`/vendor-request/${event.data.requestId}`);
    }
  }, [navigate]);

  const rowCount = requests.length;

  const overlayNoRowsTemplate = useMemo(
    () => '<span style="color:#9ca3af;font-size:13px">No provider service requests match the current filters.</span>',
    [],
  );

  return (
    <AppShell>
      <div className="page-card">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="page-header page-header--with-action">
          <div>
            <h1 className={styles.pageTitle}>Service Provider Requests</h1>
            <p className={styles.pageSubtitle}>Manage incoming provider service requests and onboarding pipeline</p>
          </div>
          <div className={styles.pageHeaderActions}>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/vendor-request/new')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Request
            </button>
          </div>
        </div>

        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <div className={styles.sectionBlock}>
          <div className="vs-toolbar">

            {/* Status filter pills */}
            <div className="vs-filter-pills" role="group" aria-label="Filter by request status">
              {STATUS_PILLS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`vs-filter-pill${statusFilter === key ? ' vs-filter-pill--active' : ''}`}
                  onClick={() => setStatusFilter(key)}
                  aria-pressed={statusFilter === key}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="cim-search-bar" role="search" style={{ marginLeft: 'auto', flex: 1, minWidth: 200, maxWidth: 420 }}>
              <span className="cim-search-bar__icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </span>
              <input
                type="text"
                className="cim-search-bar__input"
                placeholder="Search by company name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search provider service requests"
              />
              {searchQuery && (
                <button type="button" className="vs-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {error && <div className="alert alert--error" role="alert">{error}</div>}
          {!loading && rowCount > 0 && <span className="grid-row-count">{rowCount} record{rowCount !== 1 ? 's' : ''}</span>}

          {loading ? (
            <div className="detail-loading">
              <p className="text-sm-muted">Loading provider service requests…</p>
            </div>
          ) : (
            <div className={`${styles.agTheme} ${styles.agGridInCard}`}>
              <AgGridReact<VendorServiceRequestListItem>
                rowData={requests}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                onRowClicked={onRowClicked}
                rowHeight={48}
                headerHeight={42}
                animateRows
                pagination
                paginationPageSize={10}
                paginationPageSizeSelector={[10, 20, 50]}
                suppressCellFocus
                overlayNoRowsTemplate={overlayNoRowsTemplate}
              />
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
};

export default VendorRequestMaster;
