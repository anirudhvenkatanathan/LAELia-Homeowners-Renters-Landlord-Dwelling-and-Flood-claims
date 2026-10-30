import React, { useRef, useCallback, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridReadyEvent, GridApi, ICellRendererParams, RowClickedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import AppShell from '../../../components/layout/AppShell';
import { ServiceProviderTabs } from '../../../components/layout/ServiceProviderTabs';
import { useVendorOnboarding } from '../../../hooks/vendorOnboarding/useVendorOnboarding';
import type { VendorOnboardingRow, VendorOnboardingTab } from '../../../models/vendorOnboarding/vendorOnboardingModel';


const StageCellRenderer: React.FC<ICellRendererParams<VendorOnboardingRow>> = ({ data }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: '0.78rem',
      fontWeight: 600,
      background: 'var(--color-bg-subtle, #f3f4f6)',
      color: 'var(--color-text, #111827)',
      border: '1px solid var(--color-border, #e5e7eb)',
    }}
  >
    {data?.currentStageName ?? '—'}
  </span>
);

const NextActionCellRenderer: React.FC<ICellRendererParams<VendorOnboardingRow>> = ({ data }) => (
  <span className="text-sm-muted" style={{ fontSize: '0.83rem' }}>
    {data?.nextStageName || '—'}
  </span>
);

const StatusCellRenderer: React.FC<ICellRendererParams<VendorOnboardingRow>> = ({ data }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: '0.78rem',
      fontWeight: 600,
      background: 'var(--color-bg-subtle, #f3f4f6)',
      color: 'var(--color-text, #111827)',
      border: '1px solid var(--color-border, #e5e7eb)',
    }}
  >
    {data?.vendorStatus || '—'}
  </span>
);

const BoostCellRenderer: React.FC<ICellRendererParams<VendorOnboardingRow>> = ({ data }) => (
  <span className={data?.boostApplied ? 'badge badge-green' : 'badge badge-gray'}>
    {data?.boostApplied ? 'Yes' : 'No'}
  </span>
);


const defaultColDef: ColDef = { resizable: true, suppressMovable: false };

const columnDefs: ColDef<VendorOnboardingRow>[] = [
  { headerName: 'SERVICE PROVIDER',    field: 'companyName',      flex: 2,   minWidth: 180, sortable: true,  filter: false, cellStyle: { fontWeight: 600 } },
  { headerName: 'COVERAGE',    field: 'coverage',          flex: 1.5, minWidth: 140, sortable: true,  filter: false },
  { headerName: 'STAGE',       field: 'currentStageName',  flex: 1.5, minWidth: 150, sortable: true,  filter: false, cellRenderer: StageCellRenderer },
  { headerName: 'NEXT ACTION', field: 'nextStageName',     flex: 1.5, minWidth: 150, sortable: false, filter: false, cellRenderer: NextActionCellRenderer },
  { headerName: 'STATUS',      field: 'vendorStatus',      flex: 1,   minWidth: 130, sortable: true,  filter: false, cellRenderer: StatusCellRenderer },
  { headerName: 'BOOST',       field: 'boostApplied',      flex: 0.8, minWidth: 90,  sortable: true,  filter: false, cellRenderer: BoostCellRenderer },
];

const VendorOnboardingSearch: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as VendorOnboardingTab | null;
  const initialTab: VendorOnboardingTab =
    tabParam === 'inProgress' || tabParam === 'requalification' ? tabParam : 'pending';
  const [activeTab, setActiveTab] = useState<VendorOnboardingTab>(initialTab);
  const { rows, loading, error, refresh } = useVendorOnboarding(activeTab);
  const gridApiRef = useRef<GridApi | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const onGridReady = useCallback((e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  }, []);

  const onRowClicked = useCallback((event: RowClickedEvent<VendorOnboardingRow>) => {
    if (!event.data?.vendorId) return;
    if (activeTab === 'pending') {
      navigate(`/vendor/onboarding/pending/${event.data.vendorId}`, { state: { from: 'vendor-onboarding' } });
    } else {
      navigate(`/vendor/onboarding/details/${event.data.vendorId}`, { state: { from: 'vendor-onboarding' } });
    }
  }, [navigate, activeTab]);

  const overlayMessage = activeTab === 'pending'
    ? 'No provider requests pending approval.'
    : activeTab === 'requalification'
    ? 'No providers with requalification due.'
    : 'No providers found in the onboarding pipeline.';

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.companyName?.toLowerCase().includes(q) ||
        r.coverage?.toLowerCase().includes(q) ||
        r.currentStageName?.toLowerCase().includes(q) ||
        r.vendorStatus?.toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  return (
    <AppShell>
      <ServiceProviderTabs />
      <div className="page-card">

        <div className="page-header" style={{ paddingBottom: 20 }}>
          <h1 className="page-title">Service Provider Onboarding</h1>
          <p className="page-subtitle">
            Track service provider onboarding stages and status.
          </p>
        </div>

        <div className="section-block">
          <div className="vs-toolbar">
            <div className="vs-filter-pills" role="group" aria-label="Filter by onboarding stage">
              <button type="button"
                className={`vs-filter-pill${activeTab === 'pending' ? ' vs-filter-pill--active' : ''}`}
                onClick={() => setActiveTab('pending')}
                aria-pressed={activeTab === 'pending'}>
                Pending Approval
              </button>
              <button type="button"
                className={`vs-filter-pill${activeTab === 'inProgress' ? ' vs-filter-pill--active' : ''}`}
                onClick={() => setActiveTab('inProgress')}
                aria-pressed={activeTab === 'inProgress'}>
                In Progress
              </button>
              <button type="button"
                className={`vs-filter-pill${activeTab === 'requalification' ? ' vs-filter-pill--active' : ''}`}
                onClick={() => setActiveTab('requalification')}
                aria-pressed={activeTab === 'requalification'}>
                Requalification Due
              </button>
            </div>
            <div className="cim-search-bar" role="search" style={{ marginLeft: 'auto', minWidth: 220, maxWidth: 520, flex: 1 }}>
              <span className="cim-search-bar__icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                className="cim-search-bar__input"
                placeholder="Search by service provider, stage, or status…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search provider onboarding"
              />
              {searchQuery && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={refresh}
              title="Refresh"
              aria-label="Refresh list"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="alert alert--error" role="alert" style={{ marginBottom: 14 }}>{error}</div>
          )}

          {loading ? (
            <div className="detail-loading">
              <p className="text-sm-muted">Loading provider onboarding list…</p>
            </div>
          ) : (
            <div className="ag-theme-alpine cim-ag-grid">
              <AgGridReact<VendorOnboardingRow>
                rowData={filteredRows}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                onGridReady={onGridReady}
                onRowClicked={onRowClicked}
                rowHeight={54}
                headerHeight={40}
                animateRows
                pagination
                paginationPageSize={20}
                paginationPageSizeSelector={[20, 50, 100]}
                suppressCellFocus
                overlayNoRowsTemplate={`<span style="color:#9ca3af;font-size:13px">${overlayMessage}</span>`}
              />
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
};

export default VendorOnboardingSearch;
