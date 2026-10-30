import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import AppShell from '../../../components/layout/AppShell';
import { useVendorSelectionLogic } from '../../../hooks/vendorSelectionLogic/useVendorSelectionLogic';
import { styles } from '../../ServiceRequestRole/ServiceRequestRoleMaster/styles';
import type { VendorSelectionLogic } from '../../../models/vendorSelectionLogic/vendorSelectionLogicModel';

// ─── Grid context ─────────────────────────────────────────────────────────────

interface GridContext {
  onViewClick:   (rule: VendorSelectionLogic) => void;
  onDeleteClick: (rule: VendorSelectionLogic) => void;
}

// ─── Cell Renderers ───────────────────────────────────────────────────────────

const StatusBadgeCellRenderer: React.FC<ICellRendererParams> = ({ value }) => {
  const s = String(value ?? '').toLowerCase();
  const cls = s === 'active' ? 'badge-green' : s === 'inactive' ? 'badge-red' : 'badge-gray';
  return <span className={`badge ${cls}`}>{value}</span>;
};

const ActionCellRenderer: React.FC<ICellRendererParams<VendorSelectionLogic, unknown, GridContext>> = ({ node, context }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
    <button type="button" className="grid-action-btn" title="View" aria-label="View logic"
      onClick={(e) => { e.stopPropagation(); if (node.data) context?.onViewClick(node.data); }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
    <button type="button" className="grid-action-btn grid-action-btn--danger" title="Delete" aria-label="Delete logic"
      onClick={(e) => { e.stopPropagation(); if (node.data) context?.onDeleteClick(node.data); }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
      </svg>
    </button>
  </div>
);

// ─── Page Component ───────────────────────────────────────────────────────────

const VendorSelectionLogicMaster: React.FC = () => {
  const navigate = useNavigate();
  const { items, loading, error, handleDelete, refresh } = useVendorSelectionLogic();

  const [quickFilter,   setQuickFilter]   = useState('');
  const [notification,  setNotification]  = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<VendorSelectionLogic | null>(null);
  const [isDeleting,    setIsDeleting]    = useState(false);
  const gridApiRef = useRef<GridApi | null>(null);

  const showNotification = useCallback((type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const handleViewClick = useCallback((rule: VendorSelectionLogic) => {
    navigate(`/vendor/vendor-selection-logic/${rule.ruleId}`);
  }, [navigate]);

  const handleDeleteClick = useCallback((rule: VendorSelectionLogic) => {
    setDeleteTarget(rule);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await handleDelete(deleteTarget.ruleId);
    setIsDeleting(false);
    setDeleteTarget(null);
    showNotification(result.success ? 'success' : 'error', result.message);
  }, [deleteTarget, handleDelete, showNotification]);

  const gridContext = useMemo<GridContext>(() => ({
    onViewClick:   handleViewClick,
    onDeleteClick: handleDeleteClick,
  }), [handleViewClick, handleDeleteClick]);

  const columnDefs = useMemo<ColDef<VendorSelectionLogic>[]>(() => [
    { headerName: 'Logic Name',  field: 'name',        flex: 2, minWidth: 160, sortable: true, filter: true, cellClass: 'cell--bold' },
    { headerName: 'Category',    field: 'category',    flex: 2, minWidth: 160, sortable: true, filter: true },
    { headerName: 'Status',      field: 'status',      flex: 1, minWidth: 110, sortable: true, filter: true, cellRenderer: StatusBadgeCellRenderer },
    {
      headerName: 'Actions', colId: 'actions',
      width: 88, minWidth: 88, maxWidth: 88,
      sortable: false, filter: false, resizable: false, suppressMovable: true,
      cellRenderer: ActionCellRenderer,
      cellClass: 'cell--center',
    },
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({ resizable: true }), []);

  const onGridReady = useCallback((p: GridReadyEvent) => { gridApiRef.current = p.api; }, []);

  const rowCount = items.length;

  return (
    <AppShell>
      <div className="page-card">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="page-header page-header--with-action">
          <div>
            <h1 className={styles.pageTitle}>Service Provider Assignment</h1>
            <p className={styles.pageSubtitle}>Defines logic for automated service provider selection.</p>
          </div>
          <div className={styles.pageHeaderActions}>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/vendor/vendor-selection-logic/new')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Logic
            </button>
          </div>
        </div>

        {notification && (
          <div className={`alert ${notification.type === 'success' ? 'alert--success' : 'alert--error'} notification-bar`} role="alert">
            {notification.text}
          </div>
        )}

        {/* ── Grid ──────────────────────────────────────────────────────── */}
        <div className={styles.sectionBlock}>
          <div className="grid-toolbar">
            <div className="grid-toolbar__left">
              <div className="grid-search">
                <span className="grid-search__icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
                <input type="text" className="grid-search__input" placeholder="Search logic…" value={quickFilter}
                  onChange={(e) => setQuickFilter(e.target.value)} aria-label="Search logic" />
              </div>
              {rowCount > 0 && <span className="grid-row-count">{rowCount} record{rowCount !== 1 ? 's' : ''}</span>}
            </div>
            <div className="grid-toolbar__right">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => refresh()} title="Refresh" aria-label="Refresh grid">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
              </button>
            </div>
          </div>

          {error && <div className="alert alert--error" role="alert">{error}</div>}
          {rowCount > 0 && <p className="grid-row-hint">Click a row to view. Use the delete icon to remove a logic entry.</p>}

          {loading ? (
            <div className="detail-loading">
              <p className="text-sm-muted">Loading provider selection logic…</p>
            </div>
          ) : (
            <div className={`${styles.agTheme} ${styles.agGridInCard}`}>
              <AgGridReact<VendorSelectionLogic>
                rowData={items}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                context={gridContext}
                rowSelection="single"
                suppressRowClickSelection={false}
                quickFilterText={quickFilter}
                onGridReady={onGridReady}
                animateRows
                pagination
                paginationPageSize={10}
                paginationPageSizeSelector={[5, 10, 20, 50]}
                suppressCellFocus
                rowHeight={44}
                headerHeight={42}
                overlayNoRowsTemplate='<span class="text-sm-muted">No logic entries found. Click <strong>New Logic</strong> to create one.</span>'
              />
            </div>
          )}
        </div>

      </div>

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      {deleteTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title"
          onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) setDeleteTarget(null); }}>
          <div className="modal" style={{ maxWidth: 420 }}>

            <div className="modal__header">
              <h2 className="modal__title" id="delete-confirm-title">Delete Logic</h2>
              <button type="button" className="modal__close" onClick={() => setDeleteTarget(null)} disabled={isDeleting} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal__body">
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>?
              </p>
            </div>

            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>No</button>
              <button type="button" className="btn btn--danger" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Yes'}
              </button>
            </div>

          </div>
        </div>
      )}

    </AppShell>
  );
};

export default VendorSelectionLogicMaster;
