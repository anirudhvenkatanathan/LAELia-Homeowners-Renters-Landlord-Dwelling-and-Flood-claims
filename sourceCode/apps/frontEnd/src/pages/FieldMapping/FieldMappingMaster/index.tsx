import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  GridReadyEvent,
  GridApi,
  RowClickedEvent,
  ICellRendererParams,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import AppShell from '../../../components/layout/AppShell';
import UploadFieldMappingModal from '../../../components/FieldMappingMaster/UploadFieldMappingModal';
import { useFieldMapping } from '../../../hooks/FieldMappingMaster/useFieldMapping';
import { downloadTemplateFile } from '../../../utils/downloadTemplate';
import { resolveStatusBadge } from './types';
import { styles } from './styles';
import type { UploadedFileRow } from './types';

// ─── Grid context type ────────────────────────────────────────────────────────

interface GridContext {
  onViewClick:   (role: UploadedFileRow) => void;
  onDeleteClick: (role: UploadedFileRow) => void;
}

// ─── Cell Renderers ───────────────────────────────────────────────────────────

const StatusBadgeCellRenderer: React.FC<ICellRendererParams> = ({ value }) => (
  <span className={`badge ${resolveStatusBadge(String(value ?? ''))}`}>{value}</span>
);

const ActionCellRenderer: React.FC<ICellRendererParams<UploadedFileRow, unknown, GridContext>> = ({ node, context }) => (
  <button
    type="button"
    className="grid-action-btn"
    title="View details"
    onClick={(e) => { e.stopPropagation(); if (node.data) context?.onViewClick(node.data); }}
    aria-label="View field mapping details"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  </button>
);

// ─── Icons ────────────────────────────────────────────────────────────────────

const UploadIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

const FieldMappingMaster: React.FC = () => {
  const navigate = useNavigate();
  const {
    uploadedFiles,
    errors,
    fetchUploadedFiles,
    handleUploadSuccess,
  } = useFieldMapping();

  const [showModal,      setShowModal]      = useState(false);
  const [quickFilter,    setQuickFilter]    = useState('');
  const [isDownloading,  setIsDownloading]  = useState(false);
  const [notification,   setNotification]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const gridApiRef = useRef<GridApi | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  // ── Column Definitions ────────────────────────────────────────────────────

  const columnDefs = useMemo<ColDef<UploadedFileRow>[]>(() => [
    { headerName: 'Upload ID',     field: 'uploadId',     flex: 2, minWidth: 200, sortable: true, filter: true,
      hide: true, cellClass: 'cell--mono' },
    { headerName: 'File Name',     field: 'fileName',     flex: 2, minWidth: 150, sortable: true, filter: true },
    { headerName: 'Upload Type',   field: 'uploadType',   flex: 1, minWidth: 120, sortable: true, filter: true },
    { headerName: 'Total Records', field: 'totalRecords', flex: 1, minWidth: 120, sortable: true, filter: false,
      cellClass: 'cell--bold' },
    { headerName: 'Uploaded By',   field: 'uploadedBy',   flex: 1, minWidth: 120, sortable: true, filter: true },
    {
      headerName:     'Upload Date',
      field:          'uploadDate',
      flex:           1,
      minWidth:       160,
      sortable:       true,
      sort:           'desc',
      valueFormatter: (p) => {
        if (!p.value) return '';
        try { return new Date(p.value as string).toLocaleString(); } catch { return String(p.value); }
      },
    },
    {
      headerName:   'Status',
      field:        'status',
      flex:         1,
      minWidth:     110,
      sortable:     true,
      filter:       true,
      cellRenderer: StatusBadgeCellRenderer,
    },
    {
      headerName: '',
      colId:      'actions',
      width: 52, minWidth: 52, maxWidth: 52,
      sortable: false, filter: false, resizable: false, suppressMovable: true,
      cellRenderer: ActionCellRenderer,
      cellClass: 'cell--center',
    },
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({ resizable: true }), []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onGridReady = useCallback((p: GridReadyEvent) => { gridApiRef.current = p.api; }, []);

  const onUploadSuccess = useCallback(() => {
    handleUploadSuccess();
  }, [handleUploadSuccess]);

  const handleViewClick = useCallback((row: UploadedFileRow) => {
    navigate(`/field-mapping/details/${row.uploadId}`);
  }, [navigate]);

  const gridContext = useMemo(() => ({
    onViewClick:   handleViewClick,
    onDeleteClick: (_row: UploadedFileRow) => {},
  }), [handleViewClick]);

  const handleDownloadTemplate = useCallback(async () => {
    setIsDownloading(true);
    try {
      const result = await downloadTemplateFile('field-mapping-template.xlsx');
      if (result.success) {
        showNotification('success', 'Template downloaded successfully.');
      } else {
        showNotification('error', result.message);
      }
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const rowCount = uploadedFiles.length;

  return (
    <AppShell>
      <div className="page-card">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="page-header page-header--with-action">
          <div>
            <h1 className={styles.pageTitle}>Field Mapping</h1>
            <p className={styles.pageSubtitle}>Upload and configure field mappings</p>
          </div>
          <div className={styles.pageHeaderActions}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleDownloadTemplate}
              disabled={isDownloading}
            >
              <DownloadIcon />
              {isDownloading ? 'Downloading…' : 'Download Template'}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setShowModal(true)}
            >
              <UploadIcon />
              Upload File
            </button>
          </div>
        </div>

        {/* ── Notification ─────────────────────────────────────────────── */}
        {notification && (
          <div
            className={`alert ${notification.type === 'success' ? 'alert--success' : 'alert--error'} notification-bar`}
            role="alert"
          >
            {notification.text}
          </div>
        )}

        {/* ── Grid Section ──────────────────────────────────────────────── */}
        <div className={styles.sectionBlock}>

          {/* Toolbar */}
          <div className="grid-toolbar">
            <div className="grid-toolbar__left">
              <div className="grid-search">
                <span className="grid-search__icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
                <input
                  type="text"
                  className="grid-search__input"
                  placeholder="Search uploads…"
                  value={quickFilter}
                  onChange={(e) => setQuickFilter(e.target.value)}
                  aria-label="Search uploaded field mapping files"
                />
              </div>
              {rowCount > 0 && (
                <span className="grid-row-count">{rowCount} record{rowCount !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="grid-toolbar__right">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => fetchUploadedFiles().catch(() => {})}
                title="Refresh"
                aria-label="Refresh grid"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
              </button>
            </div>
          </div>

          {errors['grid'] && <div className="alert alert--error" role="alert">{errors['grid']}</div>}

          {rowCount > 0 && (
            <p className="grid-row-hint">Click any row to view field mapping details.</p>
          )}

          <div className={`${styles.agTheme} ${styles.agGridInCard}`}>
            <AgGridReact<UploadedFileRow>
              rowData={uploadedFiles}
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
              overlayNoRowsTemplate='<span class="text-sm-muted">No uploads found. Click <strong>Upload File</strong> to get started.</span>'
            />
          </div>
        </div>

      </div>

      <UploadFieldMappingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={onUploadSuccess}
      />
    </AppShell>
  );
};

export default FieldMappingMaster;
