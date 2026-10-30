import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import AppShell from '../../../components/layout/AppShell';
import { useVendor } from '../../../hooks/vendor/useVendor';
import type { Vendor } from '../../../models/vendor/vendorModel';

// ─── Rating renderer ──────────────────────────────────────────────────────────

const RatingCellRenderer: React.FC<ICellRendererParams> = ({ value }) => {
  const v = Number(value ?? 0);
  return (
    <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>
      {'★'.repeat(Math.floor(v))}{'☆'.repeat(Math.max(0, 5 - Math.floor(v)))}
      <span style={{ color: 'var(--color-text-muted)', marginLeft: 4 }}>{v > 0 ? v.toFixed(1) : '—'}</span>
    </span>
  );
};

// ─── Actions renderer ─────────────────────────────────────────────────────────

interface GridCtx { onView: (v: Vendor) => void; onEdit: (v: Vendor) => void; onDelete: (v: Vendor) => void; }

const ActionsCellRenderer: React.FC<ICellRendererParams<Vendor, unknown, GridCtx>> = ({ node, context }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <button type="button" className="grid-action-btn" title="View"
      onClick={(e) => { e.stopPropagation(); if (node.data) context?.onView(node.data); }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
    <button type="button" className="grid-action-btn" title="Edit"
      onClick={(e) => { e.stopPropagation(); if (node.data) context?.onEdit(node.data); }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
    <button type="button" className="grid-action-btn grid-action-btn--danger" title="Delete"
      onClick={(e) => { e.stopPropagation(); if (node.data) context?.onDelete(node.data); }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
      </svg>
    </button>
  </div>
);

// ─── Column Definitions ───────────────────────────────────────────────────────

const columnDefs: ColDef<Vendor>[] = [
  {
    headerName: '#', valueGetter: 'node.rowIndex + 1',
    width: 58, minWidth: 58, maxWidth: 58,
    sortable: false, filter: false, resizable: false, pinned: 'left',
    cellStyle: { color: '#9ca3af', fontWeight: 600 },
  },
  { headerName: 'Company Name',         field: 'companyName',            flex: 2, minWidth: 160, sortable: true, filter: true, cellStyle: { fontWeight: 600 } },
  { headerName: 'Email ID',             field: 'emailId',                flex: 2, minWidth: 180, sortable: true, filter: true },
  { headerName: 'Phone Number',         field: 'phoneNumber',            flex: 1, minWidth: 140, sortable: true, filter: true },
  { headerName: 'Rating',               field: 'rating',                 flex: 1, minWidth: 130, sortable: true, filter: false, cellRenderer: RatingCellRenderer },
  { headerName: 'Service Request Role', field: 'serviceRequestRoleName', flex: 1, minWidth: 160, sortable: true, filter: true },
  { headerName: 'City',                 field: 'city',                   flex: 1, minWidth: 110, sortable: true, filter: true },
  { headerName: 'State',                field: 'state',                  flex: 1, minWidth: 110, sortable: true, filter: true },
  { headerName: 'Turnaround Time',      field: 'turnaroundTime',         flex: 1, minWidth: 140, sortable: true, filter: true },
  {
    headerName: 'Created At', field: 'createdAt', flex: 1, minWidth: 150, sortable: true, filter: false,
    valueFormatter: ({ value }) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—',
  },
  {
    headerName: 'Actions', field: 'vendorId',
    width: 100, minWidth: 100, maxWidth: 100,
    sortable: false, filter: false, resizable: false,
    cellRenderer: ActionsCellRenderer,
  },
];

const defaultColDef: ColDef = { resizable: true };

// ─── Screen ───────────────────────────────────────────────────────────────────

const VendorMaster: React.FC = () => {
  const navigate     = useNavigate();
  const { vendors, loading, error, deleting, refresh, handleDelete } = useVendor();
  const gridApiRef   = useRef<GridApi | null>(null);
  const [quickFilter,   setQuickFilter]   = useState('');
  const [deleteTarget,  setDeleteTarget]  = useState<Vendor | null>(null);
  const [notification,  setNotification]  = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const onGridReady = useCallback((e: GridReadyEvent) => { gridApiRef.current = e.api; }, []);

  const showNote = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const result = await handleDelete(deleteTarget.vendorId);
    setDeleteTarget(null);
    if (result.success) showNote('success', `"${deleteTarget.companyName}" deleted successfully.`);
    else showNote('error', result.message ?? 'Delete failed.');
  }, [deleteTarget, handleDelete]);

  const gridContext: GridCtx = {
    onView:   (v) => navigate(`/vendor/form?vendorId=${v.vendorId}&mode=view`),
    onEdit:   (v) => navigate(`/vendor/form?vendorId=${v.vendorId}&mode=edit`),
    onDelete: (v) => setDeleteTarget(v),
  };

  return (
    <AppShell>
      <div className="page-card">

        {/* Header */}
        <div className="page-header page-header--with-action">
          <div>
            <h1 className="page-title">Service Provider Management</h1>
            <p className="page-subtitle">Manage providers and their service request role assignments</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/vendor/form')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Service Provider
          </button>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`alert alert--${notification.type === 'success' ? 'success' : 'error'}`} role="alert" style={{ margin: '0 28px 16px' }}>
            {notification.text}
          </div>
        )}

        {/* Grid */}
        <div className="section-block">
          <div className="grid-toolbar">
            <div className="grid-toolbar__left">
              <div className="grid-search">
                <span className="grid-search__icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
                <input type="text" className="grid-search__input" placeholder="Search service providers…"
                  value={quickFilter} onChange={(e) => setQuickFilter(e.target.value)} aria-label="Search service providers" />
              </div>
              {vendors.length > 0 && (
                <span className="grid-row-count">{vendors.length} provider{vendors.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="grid-toolbar__right">
              <button type="button" className="btn btn--ghost btn--sm" onClick={refresh} title="Refresh" aria-label="Refresh">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
              </button>
            </div>
          </div>

          {error   && <div className="alert alert--error" role="alert">{error}</div>}
          {loading && <div className="detail-loading"><p className="text-sm-muted">Loading providers…</p></div>}

          {!loading && (
            <div className="ag-theme-alpine ag-grid-in-card">
              <AgGridReact<Vendor>
                rowData={vendors}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                context={gridContext}
                quickFilterText={quickFilter}
                onGridReady={onGridReady}
                animateRows
                pagination
                paginationPageSize={10}
                paginationPageSizeSelector={[5, 10, 20, 50]}
                suppressCellFocus
                rowHeight={44}
                headerHeight={42}
                overlayNoRowsTemplate='<span style="color:#9ca3af;font-size:13px">No service providers found. Click "Add Service Provider" to create one.</span>'
              />
            </div>
          )}
        </div>

      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null); }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal__header">
              <h2 className="modal__title">Delete Service Provider</h2>
              <button type="button" className="modal__close" onClick={() => setDeleteTarget(null)} disabled={deleting} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text)' }}>
                Are you sure you want to delete <strong>{deleteTarget.companyName}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
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

export default VendorMaster;
