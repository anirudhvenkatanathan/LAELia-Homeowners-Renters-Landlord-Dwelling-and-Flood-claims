import React, { useRef, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  GridReadyEvent,
  GridApi,
  ICellRendererParams,
  RowClickedEvent,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import AppShell from '../../../components/layout/AppShell';
import { ServiceProviderTabs } from '../../../components/layout/ServiceProviderTabs';
import { useVendorSearch, daysUntilRequalDue } from '../../../hooks/vendor/useVendorSearch';
import type { StatusFilter } from '../../../hooks/vendor/useVendorSearch';
import type { Vendor, VendorFormValues } from '../../../models/vendor/vendorModel';
import { useVendorForm } from '../../../hooks/vendor/useVendorForm';
import type { FormMode } from '../../../hooks/vendor/useVendorForm';
import { deleteVendor } from '../../../services/vendor/vendorService';
import { logError } from '../../../utils/logError';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeClass(status?: string): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'active')              return 'badge badge-green';
  if (s === 'suspended')           return 'badge badge-red';
  if (s === 'disqualified')        return 'badge badge-red';
  if (s === 'requalification due') return 'badge badge-blue';
  return 'badge badge-gray';
}

function boostBadgeClass(applied?: boolean): string {
  return applied ? 'badge badge-green' : 'badge badge-gray';
}

// Vendors that are still Active but within the requalification window are
// shown as "Active/Requalification Due" — mirrors the label used on the
// Vendor Onboarding screen for the same underlying status.
function statusDisplayLabel(status?: string): string {
  if ((status ?? '').toLowerCase() === 'requalification due') return 'Active/Requalification Due';
  return status ?? '—';
}

// ─── Cell Renderers ───────────────────────────────────────────────────────────

const VendorCellRenderer: React.FC<ICellRendererParams<Vendor>> = ({ data }) => (
  <div className="vs-vendor-cell">
    <span className="vs-vendor-cell__name">{data?.companyName ?? '—'}</span>
    {data?.legalEntity && (
      <span className="vs-vendor-cell__legal">{data.legalEntity}</span>
    )}
  </div>
);

const CoverageCellRenderer: React.FC<ICellRendererParams<Vendor>> = ({ data }) => {
  const cov = data?.coverage;
  return (
    <span style={{ color: cov ? undefined : 'var(--color-text-muted)' }}>
      {cov || '—'}
    </span>
  );
};

// Deterministic pastel color per category name, so the same category always
// renders the same chip color without maintaining a manual per-category map.
// Colors themselves live in custom.css as .vs-category-chip--palette-N.
const CATEGORY_PALETTE_SIZE = 8;

function categoryColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return `vs-category-chip--palette-${hash % CATEGORY_PALETTE_SIZE}`;
}

const MAX_VISIBLE_CATEGORY_CHIPS = 2;

const CategoryCellRenderer: React.FC<ICellRendererParams<Vendor>> = ({ data }) => {
  const [trayOpen, setTrayOpen] = useState(false);
  const [trayPos,  setTrayPos]  = useState<{ top: number; left: number } | null>(null);
  const moreRef = useRef<HTMLSpanElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const names = data?.serviceRequestRoleNames?.filter(Boolean) ?? [];

  // Small delay on close so moving the cursor from the "+N" chip down into the
  // tray itself (a few px gap) doesn't flicker it shut before the tray's own
  // onMouseEnter cancels the pending close.
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setTrayOpen(false), 120);
  };
  const cancelScheduledClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };

  useEffect(() => () => cancelScheduledClose(), []);

  if (names.length === 0) {
    return <span className="vs-category-chip--empty">—</span>;
  }

  const visible      = names.slice(0, MAX_VISIBLE_CATEGORY_CHIPS);
  const overflowNames = names.slice(MAX_VISIBLE_CATEGORY_CHIPS);

  const openTray = () => {
    cancelScheduledClose();
    const rect = moreRef.current?.getBoundingClientRect();
    if (rect) setTrayPos({ top: rect.bottom + 6, left: rect.left });
    setTrayOpen(true);
  };

  return (
    <div className="vs-category-chips">
      {visible.map((name) => (
        <span key={name} className={`vs-category-chip ${categoryColorClass(name)}`}>
          {name}
        </span>
      ))}
      {overflowNames.length > 0 && (
        <span
          ref={moreRef}
          className="vs-category-chip vs-category-chip--more"
          onMouseEnter={openTray}
          onMouseLeave={scheduleClose}
        >
          +{overflowNames.length}
        </span>
      )}
      {trayOpen && trayPos && createPortal(
        <div
          className="vs-category-tray"
          style={{ top: trayPos.top, left: trayPos.left }}
          onMouseEnter={cancelScheduledClose}
          onMouseLeave={scheduleClose}
        >
          {overflowNames.map((name) => (
            <span key={name} className={`vs-category-chip ${categoryColorClass(name)}`}>
              {name}
            </span>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

const StatusCellRenderer: React.FC<ICellRendererParams<Vendor>> = ({ data }) => (
  <span className={statusBadgeClass(data?.status)}>{statusDisplayLabel(data?.status)}</span>
);

const BoostCellRenderer: React.FC<ICellRendererParams<Vendor>> = ({ data }) => (
  <span className={boostBadgeClass(data?.boostApplied)}>{data?.boostApplied ? 'Yes' : 'No'}</span>
);

// ─── Column Definitions ───────────────────────────────────────────────────────

const columnDefs: ColDef<Vendor>[] = [
  { headerName: 'SERVICE PROVIDER',   field: 'companyName', flex: 1.3, minWidth: 160, sortable: true, filter: false, cellRenderer: VendorCellRenderer },
  { headerName: 'CATEGORY',   field: 'serviceRequestRoleNames', flex: 2,   minWidth: 220, sortable: false, filter: false, cellRenderer: CategoryCellRenderer },
  { headerName: 'BOOST',      field: 'boostApplied',           flex: 0.8, minWidth: 90,  sortable: true, filter: false, cellRenderer: BoostCellRenderer },
  { headerName: 'COVERAGE',   field: 'coverage',               flex: 1.5, minWidth: 150, sortable: true, filter: false, cellRenderer: CoverageCellRenderer },
  { headerName: 'STATUS',     field: 'status',      flex: 1.3, minWidth: 170, sortable: true, filter: false, cellRenderer: StatusCellRenderer },
];

const defaultColDef: ColDef = { resizable: true };

// ─── Filter pills ─────────────────────────────────────────────────────────────

const STATUS_PILLS: { key: StatusFilter; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'active',       label: 'Active' },
  { key: 'requal',       label: 'Requal' },
  { key: 'suspended',    label: 'Suspended' },
  { key: 'disqualified', label: 'Disqualified' },
];

// ─── Shared sub-components ────────────────────────────────────────────────────

const Field: React.FC<{ label: string; required?: boolean; error?: string; children: React.ReactNode }> = (
  { label, required, error, children }
) => (
  <div className="form-group" style={{ marginBottom: 0 }}>
    <label className={`form-label${required ? ' form-label--required' : ''}`}>{label}</label>
    {children}
    {error && <span className="form-error" role="alert">{error}</span>}
  </div>
);

const DetailField: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
  <div className="vs-detail-row">
    <span className="vs-detail-label">{label}</span>
    <span className={`vs-detail-value${!value && value !== 0 ? ' vs-detail-value--empty' : ''}`}>
      {value || value === 0 ? value : '—'}
    </span>
  </div>
);

// ─── Vendor Panel (slide-over drawer) ─────────────────────────────────────────

interface VendorPanelProps {
  vendorId:        string | null;
  initialMode:     FormMode;
  onClose:         () => void;
  onSaved:         (isCreate: boolean) => void;
  onDeleteRequest: (vendorId: string, vendorName: string) => void;
}

const VendorPanel: React.FC<VendorPanelProps> = ({
  vendorId, initialMode, onClose, onSaved, onDeleteRequest,
}) => {
  const {
    mode, setMode, values, errors, loading, saving, roles, submitError, updateField, handleSubmit,
  } = useVendorForm(vendorId, initialMode);

  const isView   = mode === 'view';
  const isCreate = !vendorId;

  const inputCls = (field: keyof VendorFormValues) =>
    `form-input${errors[field] ? ' form-input--error' : ''}`;

  const onSubmit = async () => {
    const result = await handleSubmit();
    if (result.success) onSaved(isCreate);
  };

  const titleMap: Record<FormMode, string> = {
    create: 'Add Service Provider',
    edit:   'Edit Service Provider',
    view:   'Service Provider Details',
  };

  const roleLabel = roles.find((r) => r.roleId === values.serviceRequestRoleId)?.roleName
    ?? values.serviceRequestRoleId;

  const fullAddress = [values.address, values.city, values.state, values.country]
    .filter(Boolean).join(', ');

  return (
    <>
      {/* Backdrop */}
      <div
        className="vs-panel-backdrop"
        onClick={!saving ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside className="vs-panel" role="dialog" aria-modal="true" aria-label={titleMap[mode]}>

        {/* Header */}
        <div className="vs-panel__header">
          <div className="vs-panel__header-text">
            <h2 className="vs-panel__title">{titleMap[mode]}</h2>
            {isView && values.companyName && (
              <p className="vs-panel__subtitle">{values.companyName}</p>
            )}
          </div>
          <div className="vs-panel__header-actions">
            {isView && vendorId && (
              <>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setMode('edit')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => onDeleteRequest(vendorId, values.companyName)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                  </svg>
                  Delete
                </button>
              </>
            )}
            <button
              type="button"
              className="vs-panel__close"
              onClick={onClose}
              disabled={saving}
              aria-label="Close panel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <line x1="18" y1="6"  x2="6"  y2="18"/>
                <line x1="6"  y1="6"  x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="vs-panel__body">

          {loading && (
            <p className="text-sm-muted" style={{ padding: '12px 0' }}>Loading provider details…</p>
          )}

          {!loading && (
            <>
              {submitError && (
                <div className="alert alert--error" role="alert" style={{ marginBottom: 16 }}>
                  {submitError}
                </div>
              )}

              {isView ? (
                <div className="vs-panel__form-grid">
                  <DetailField label="Company Name"         value={values.companyName} />
                  <DetailField label="Email ID"             value={values.emailId} />
                  <DetailField label="Phone Number"         value={values.phoneNumber} />
                  <DetailField label="Service Request Role" value={roleLabel} />
                  <DetailField label="Rating"               value={values.rating ? `${values.rating} / 5` : null} />
                  <DetailField label="Turnaround Time"      value={values.turnaroundTime} />
                  <div className="vs-panel__form-full">
                    <DetailField label="Address" value={fullAddress || null} />
                  </div>
                </div>
              ) : (
                <div className="vs-panel__form-grid">

                  <Field label="Company Name" required error={errors['companyName']}>
                    <input
                      className={inputCls('companyName')}
                      value={values.companyName}
                      placeholder="e.g. ABC Medical Services"
                      onChange={(e) => updateField('companyName', e.target.value)}
                    />
                  </Field>

                  <Field label="Email ID" required error={errors['emailId']}>
                    <input
                      type="email"
                      className={inputCls('emailId')}
                      value={values.emailId}
                      placeholder="e.g. contact@example.com"
                      onChange={(e) => updateField('emailId', e.target.value)}
                    />
                  </Field>

                  <Field label="Phone Number" required error={errors['phoneNumber']}>
                    <input
                      className={inputCls('phoneNumber')}
                      value={values.phoneNumber}
                      placeholder="e.g. +91 9876543210"
                      onChange={(e) => updateField('phoneNumber', e.target.value)}
                    />
                  </Field>

                  <Field label="Service Request Role" required error={errors['serviceRequestRoleId']}>
                    <select
                      className={`form-input${errors['serviceRequestRoleId'] ? ' form-input--error' : ''}`}
                      value={values.serviceRequestRoleId}
                      onChange={(e) => updateField('serviceRequestRoleId', e.target.value)}
                    >
                      <option value="">— Select a role —</option>
                      {roles.map((r) => (
                        <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Rating (0 – 5)" error={errors['rating']}>
                    <input
                      type="number"
                      className={inputCls('rating')}
                      value={values.rating}
                      min={0} max={5} step={0.5}
                      placeholder="e.g. 4.5"
                      onChange={(e) => updateField('rating', e.target.value)}
                    />
                  </Field>

                  <Field label="Turnaround Time" error={errors['turnaroundTime']}>
                    <input
                      className={inputCls('turnaroundTime')}
                      value={values.turnaroundTime}
                      placeholder="e.g. 24 Hours"
                      onChange={(e) => updateField('turnaroundTime', e.target.value)}
                    />
                  </Field>

                  <div className="vs-panel__form-full">
                    <Field label="Address" error={errors['address']}>
                      <input
                        className={inputCls('address')}
                        value={values.address}
                        placeholder="Street address"
                        onChange={(e) => updateField('address', e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field label="City" error={errors['city']}>
                    <input
                      className={inputCls('city')}
                      value={values.city}
                      placeholder="e.g. Chennai"
                      onChange={(e) => updateField('city', e.target.value)}
                    />
                  </Field>

                  <Field label="State" error={errors['state']}>
                    <input
                      className={inputCls('state')}
                      value={values.state}
                      placeholder="e.g. Tamil Nadu"
                      onChange={(e) => updateField('state', e.target.value)}
                    />
                  </Field>

                  <Field label="Country" error={errors['country']}>
                    <input
                      className={inputCls('country')}
                      value={values.country}
                      placeholder="e.g. India"
                      onChange={(e) => updateField('country', e.target.value)}
                    />
                  </Field>

                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — only in edit/create mode */}
        {!isView && !loading && (
          <div className="vs-panel__footer">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={onSubmit}
              disabled={saving}
            >
              {saving ? 'Saving…' : isCreate ? 'Create Service Provider' : 'Save Changes'}
            </button>
          </div>
        )}

      </aside>
    </>
  );
};

// ─── Page Component ───────────────────────────────────────────────────────────

const VendorSearch: React.FC = () => {
  const {
    filteredVendors,
    attentionVendors,
    statusCounts,
    categories,
    loading,
    error,
    searchQuery,
    statusFilter,
    selectedCategories,
    setSearchQuery,
    setStatusFilter,
    toggleCategory,
    clearCategories,
    refresh,
  } = useVendorSearch();

  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);

  const navigate = useNavigate();
  const gridApiRef = useRef<GridApi | null>(null);

  // Panel & delete state
  const [panelState,   setPanelState]   = useState<{ vendorId: string | null; mode: FormMode } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ vendorId: string; name: string } | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNote = useCallback((type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const onGridReady = useCallback((e: GridReadyEvent) => {
    gridApiRef.current = e.api;
  }, []);

  const getRowClass = useCallback(() => undefined, []);

  const onRowClicked = useCallback((event: RowClickedEvent<Vendor>) => {
    if (event.data?.vendorId) {
      navigate(`/vendor/onboarding/details/${event.data.vendorId}`, { state: { from: 'vendor-search' } });
    }
  }, [navigate]);

  const handlePanelSaved = useCallback((isCreate: boolean) => {
    setPanelState(null);
    refresh();
    showNote('success', isCreate ? 'Service Provider created successfully.' : 'Service Provider updated successfully.');
  }, [refresh, showNote]);

  const handleDeleteRequest = useCallback((vendorId: string, vendorName: string) => {
    setDeleteTarget({ vendorId, name: vendorName });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteVendor(deleteTarget.vendorId);
      if (result.success) {
        setPanelState(null);
        setDeleteTarget(null);
        refresh();
        showNote('success', `"${deleteTarget.name}" deleted.`);
      } else {
        showNote('error', result.message ?? 'Delete failed.');
        setDeleteTarget(null);
      }
    } catch (err) {
      logError(err, 'VendorSearch.handleDeleteConfirm');
      showNote('error', 'Failed to delete provider.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, refresh, showNote]);

  return (
    <AppShell>
      <ServiceProviderTabs />
      <div className="page-card">

        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div className="page-header" style={{ paddingBottom: 20 }}>
          <h1 className="page-title">Service Provider Administration</h1>
          <p className="page-subtitle">
            Active and suspended service providers. Click a row to view or edit. Requalification-due rows are highlighted.
          </p>
        </div>

        {/* ── Notification toast ───────────────────────────────────────────── */}
        {notification && (
          <div
            className={`alert alert--${notification.type === 'success' ? 'success' : 'error'}`}
            role="alert"
            style={{ margin: '0 28px 16px' }}
          >
            {notification.text}
          </div>
        )}


        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="section-block">
          <div className="vs-toolbar">

            {/* Status filter pills */}
            <div className="vs-filter-pills" role="group" aria-label="Filter by provider status">
              {STATUS_PILLS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`vs-filter-pill${statusFilter === key ? ' vs-filter-pill--active' : ''}`}
                  onClick={() => setStatusFilter(key)}
                  aria-pressed={statusFilter === key}
                >
                  {label} ({statusCounts[key]})
                </button>
              ))}
            </div>

            {/* Category filter toggle */}
            <button
              type="button"
              className={`vs-filter-pill vs-category-toggle${selectedCategories.length > 0 ? ' vs-filter-pill--active' : ''}`}
              onClick={() => setCategoryPanelOpen((o) => !o)}
              aria-expanded={categoryPanelOpen}
            >
              Category{selectedCategories.length > 0 ? ` (${selectedCategories.length})` : ''}
              <svg className={`vs-category-toggle__chevron${categoryPanelOpen ? ' vs-category-toggle__chevron--open' : ''}`}
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* Search */}
            <div className="cim-search-bar" role="search" style={{ marginLeft: 'auto',flex:1, minWidth: 200, maxWidth: 520 }}>
              <span className="cim-search-bar__icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </span>
              <input
                type="text"
                className="cim-search-bar__input"
                placeholder="Search by service provider name, coverage, or category…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search service providers"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="vs-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <line x1="18" y1="6"  x2="6"  y2="18"/>
                    <line x1="6"  y1="6"  x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>

          </div>

          {/* Collapsible category checkbox panel */}
          {categoryPanelOpen && (
            <div className="vs-category-panel">
              <div className="vs-category-panel__header">
                <span>Filter by Service Category</span>
                {selectedCategories.length > 0 && (
                  <button type="button" className="vs-category-panel__clear" onClick={clearCategories}>
                    Clear ({selectedCategories.length})
                  </button>
                )}
              </div>
              <div className="vs-category-panel__grid">
                {categories.map(({ name }) => {
                  const checked = selectedCategories.includes(name);
                  return (
                    <label key={name} className={`vs-category-checkbox${checked ? ' vs-category-checkbox--checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(name)}
                      />
                      <span className="vs-category-checkbox__label">{name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert--error" role="alert">{error}</div>
          )}
          {loading && (
            <div className="detail-loading">
              <p className="text-sm-muted">Loading providers…</p>
            </div>
          )}

          {!loading && (
            <div className="ag-theme-alpine cim-ag-grid">
              <AgGridReact<Vendor>
                rowData={filteredVendors}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                onGridReady={onGridReady}
                onRowClicked={onRowClicked}
                getRowClass={getRowClass}
                rowHeight={60}
                headerHeight={40}
                animateRows
                pagination
                paginationPageSize={10}
                paginationPageSizeSelector={[10, 20, 50]}
                suppressCellFocus
                overlayNoRowsTemplate='<span style="color:#9ca3af;font-size:13px">No providers match the current filters.</span>'
              />
            </div>
          )}

        </div>
      </div>

      {/* ── Vendor Panel (slide-over) ─────────────────────────────────────── */}
      {panelState && (
        <VendorPanel
          vendorId={panelState.vendorId}
          initialMode={panelState.mode}
          onClose={() => setPanelState(null)}
          onSaved={handlePanelSaved}
          onDeleteRequest={handleDeleteRequest}
        />
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {deleteTarget && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 400 }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null); }}
        >
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal__header">
              <h2 className="modal__title">Delete Service Provider</h2>
              <button
                type="button"
                className="modal__close"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <line x1="18" y1="6"  x2="6"  y2="18"/>
                  <line x1="6"  y1="6"  x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text)' }}>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
};

export default VendorSearch;
