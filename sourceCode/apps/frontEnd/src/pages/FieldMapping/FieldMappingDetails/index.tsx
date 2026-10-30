import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import AppShell from '../../../components/layout/AppShell';
import { useFieldMappingDetails } from '../../../hooks/FieldMappingMaster/useFieldMappingDetails';
import { styles } from '../FieldMappingMaster/styles';
import { DATA_TYPE_OPTIONS } from '../FieldMappingMaster/types';
import type { MappingConfiguration } from '../../../models/FieldMappingMaster/fieldMappingModel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeClass(s: string): string {
  const v = s?.toLowerCase() ?? '';
  if (v === 'processed' || v === 'completed' || v === 'success') return 'badge-green';
  if (v === 'partial')                                            return 'badge-yellow';
  if (v === 'failed'    || v === 'error')                         return 'badge-red';
  return 'badge-gray';
}


// ─── Screen ───────────────────────────────────────────────────────────────────

const FieldMappingDetails: React.FC = () => {
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate     = useNavigate();

  const {
    detail,
    editingRows,
    newRows,
    isLoading,
    isSaving,
    errors,
    rowErrors,
    loadDetail,
    handleAddRow,
    handleEditRow,
    handleUpdateRow,
    handleSaveRow,
    handleCancelEdit,
    handleSaveAll,
    handleDeleteRow,
  } = useFieldMappingDetails();

  const [isDownloading,  setIsDownloading]  = useState(false);
  const [notification,   setNotification]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    if (uploadId) loadDetail(uploadId);
  }, [uploadId, loadDetail]);


  // ── All mappings rows (confirmed + new being added) ────────────────────────

  const allMappingRows = useMemo<MappingConfiguration[]>(() => {
    const confirmed = detail?.mappings ?? [];
    return [...confirmed, ...newRows];
  }, [detail, newRows]);

  return (
    <AppShell>
      <div className="page-card">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="page-header page-header--with-action">
          <div>
            <h1 className={styles.pageTitle}>Field Mapping Details</h1>
            <p className={styles.pageSubtitle}>View and configure field mappings for this upload</p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/field-mapping')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Field Mapping
          </button>
        </div>

        {/* ── Header Info Strip ─────────────────────────────────────────── */}
        <div className={styles.detailInfoStrip}>
          <div className={styles.detailInfoField}>
            <span className={styles.detailInfoLabel}>File Name</span>
            <span className={styles.detailInfoValue}>{detail?.fileName ?? '—'}</span>
          </div>
          <div className={styles.detailInfoDivider} aria-hidden="true" />

          <div className={styles.detailInfoField}>
            <span className={styles.detailInfoLabel}>Upload Type</span>
            <span className={styles.detailInfoValue}>{detail?.uploadType ?? '—'}</span>
          </div>
          <div className={styles.detailInfoDivider} aria-hidden="true" />

          <div className={styles.detailInfoField}>
            <span className={styles.detailInfoLabel}>Upload Date</span>
            <span className={styles.detailInfoValue}>
              {detail?.uploadDate
                ? new Date(detail.uploadDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                : '—'}
            </span>
          </div>
          <div className={styles.detailInfoDivider} aria-hidden="true" />

          <div className={styles.detailInfoField}>
            <span className={styles.detailInfoLabel}>Status</span>
            {detail?.status
              ? <span className={`badge ${statusBadgeClass(detail.status)}`}>{detail.status}</span>
              : <span className={styles.detailInfoValue}>—</span>}
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

        {/* ── Upload Stats ───────────────────────────────────────────────── */}
        {detail && (
          <div className="fm-stat-row">
            <div className="fm-stat">
              <span className="fm-stat__label">Total Records</span>
              <span className="fm-stat__value">{detail.totalRecords}</span>
            </div>
            <div className="fm-stat">
              <span className="fm-stat__label">Failed</span>
              <span className="fm-stat__value">
                {detail.status === 'Failed' || detail.status === 'Error' ? detail.totalRecords : 0}
              </span>
            </div>
          </div>
        )}

        {/* ── Mapping Configuration Section ──────────────────────────────── */}
        <div className={styles.sectionBlock}>
          <div className="grid-toolbar">
            <div className="grid-toolbar__left">
              <h2 className={styles.sectionTitle}>Mapping Configuration</h2>
            </div>
            <div className="grid-toolbar__right">
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleAddRow}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Mapping
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleSaveAll}
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save All'}
              </button>
            </div>
          </div>

          {errors['saveAll'] && <div className="alert alert--error" role="alert">{errors['saveAll']}</div>}
          {errors['download'] && <div className="alert alert--error" role="alert">{errors['download']}</div>}

          {/* Mapping Table */}
          <div className={styles.mappingTableWrap}>
            <table className={styles.mappingTable}>
              <thead>
                <tr>
                  <th>Source Field</th>
                  <th>Target Field</th>
                  <th>Data Type</th>
                  <th>Mandatory</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allMappingRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className={styles.mappingEmpty}>
                      No mappings configured. Click <strong>Add Mapping</strong> to create one.
                    </td>
                  </tr>
                )}
                {allMappingRows.map((row) => {
                  const isEditing = editingRows.has(row.mappingId);
                  const editData  = editingRows.get(row.mappingId) ?? row;
                  const rErr      = rowErrors[row.mappingId] ?? {};

                  if (isEditing) {
                    return (
                      <tr key={row.mappingId} className="mapping-table__row--editing">
                        <td>
                          <input
                            type="text"
                            className={styles.mappingInput}
                            value={editData.sourceField}
                            onChange={(e) => handleUpdateRow(row.mappingId, 'sourceField', e.target.value)}
                            placeholder="e.g. claim_number"
                            aria-label="Source field"
                          />
                          {rErr['sourceField'] && <span className={styles.mappingError}>{rErr['sourceField']}</span>}
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.mappingInput}
                            value={editData.targetField}
                            onChange={(e) => handleUpdateRow(row.mappingId, 'targetField', e.target.value)}
                            placeholder="e.g. claimNumber"
                            aria-label="Target field"
                          />
                          {rErr['targetField'] && <span className={styles.mappingError}>{rErr['targetField']}</span>}
                        </td>
                        <td>
                          <select
                            className={styles.mappingSelect}
                            value={editData.dataType}
                            onChange={(e) => handleUpdateRow(row.mappingId, 'dataType', e.target.value)}
                            aria-label="Data type"
                          >
                            {DATA_TYPE_OPTIONS.map((dt) => (
                              <option key={dt} value={dt}>{dt}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={editData.isMandatory}
                            onChange={(e) => handleUpdateRow(row.mappingId, 'isMandatory', e.target.checked)}
                            aria-label="Is mandatory"
                          />
                        </td>
                        <td>
                          <div className={styles.mappingActions}>
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              onClick={() => handleSaveRow(row.mappingId)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => handleCancelEdit(row.mappingId)}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.mappingId}>
                      <td>{row.sourceField || '—'}</td>
                      <td>{row.targetField || '—'}</td>
                      <td>{row.dataType || 'String'}</td>
                      <td>{row.isMandatory ? 'Yes' : 'No'}</td>
                      <td>
                        <div className={styles.mappingActions}>
                          <button
                            type="button"
                            className="srr-icon-btn"
                            title="Edit"
                            aria-label="Edit mapping"
                            onClick={() => handleEditRow(row.mappingId)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="srr-icon-btn srr-icon-btn--danger"
                            title="Delete"
                            aria-label="Delete mapping"
                            onClick={() => handleDeleteRow(row.mappingId)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/>
                              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppShell>
  );
};

export default FieldMappingDetails;
