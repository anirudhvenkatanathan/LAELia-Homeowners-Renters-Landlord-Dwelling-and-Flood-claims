import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import AppShell from '../../../components/layout/AppShell';
import { useServiceRequestRoleDetails } from '../../../hooks/ServiceRequestRole/useServiceRequestRoleDetails';
import { downloadTemplateFile } from '../../../utils/downloadTemplate';
import { styles } from '../ServiceRequestRoleMaster/styles';
import { CONDITION_TYPES, ROLE_STATUS_OPTIONS, resolveStatusBadge } from '../ServiceRequestRoleMaster/types';
import type { ServiceRequestRole, RoleCondition } from '../ServiceRequestRoleMaster/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusClass(s: string) {
  const v = s?.toLowerCase() ?? '';
  if (v === 'processed' || v === 'active'   || v === 'success') return 'badge-green';
  if (v === 'pending'   || v === 'processing')                   return 'badge-yellow';
  if (v === 'failed'    || v === 'error'    || v === 'inactive') return 'badge-red';
  return 'badge-gray';
}

function buildPreviewText(conditions: RoleCondition[]): string {
  if (conditions.length === 0) return 'No conditions configured.';
  return conditions.map((c, i) => {
    const prefix = i === 0 ? 'IF' : c.conditionType;
    return `${prefix} ${c.fieldName} ${c.operator.replace(/_/g, ' ')} "${c.value}"`;
  }).join('\n');
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{ label: string; value: number; iconColor: string; icon: React.ReactNode }> = ({ label, value, iconColor, icon }) => (
  <div className="kpi-card">
    <div className="kpi-header"><span className="kpi-label">{label}</span><span className={`kpi-icon ${iconColor}`}>{icon}</span></div>
    <div className="kpi-value">{value}</div>
    <div className="kpi-sub">{label}</div>
  </div>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

const ServiceRequestRoleDetails: React.FC = () => {
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate = useNavigate();

  const {
    detail, selectedRoleId,
    editingRoles, newRoles, editingConditions, newConditions, fieldOptions, operators,
    isLoading, isSavingRoles, isSavingConditions, errors, rowErrors,
    loadDetail, selectRole,
    handleAddRole, handleEditRole, handleUpdateRole, handleSaveRole, handleCancelEditRole, handleDeleteRole, handleSaveAllRoles,
    handleAddCondition, handleEditCondition, handleUpdateCondition, handleSaveCondition, handleCancelCondition, handleDeleteCondition, handleSaveAllConditions,
  } = useServiceRequestRoleDetails();

  const [isDownloading, setIsDownloading] = useState(false);
  const [notification,  setNotification]  = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => { if (uploadId) loadDetail(uploadId); }, [uploadId, loadDetail]);

  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const r = await downloadTemplateFile('service-request-role-template.xlsx');
      if (r.success) showNotification('success', 'Template downloaded.');
      else showNotification('error', (r as { success: false; message: string }).message);
    } finally { setIsDownloading(false); }
  };

  // ── All role rows ─────────────────────────────────────────────────────────

  const allRoleRows = useMemo<ServiceRequestRole[]>(() => {
    return [...(detail?.roles ?? []), ...newRoles];
  }, [detail, newRoles]);

  // ── Conditions for the selected role (confirmed + new) ────────────────────

  const allConditionRows = useMemo<RoleCondition[]>(() => {
    if (!selectedRoleId) return [];
    const confirmed = detail?.conditions.filter((c) => c.roleId === selectedRoleId) ?? [];
    const pending   = newConditions.filter((c) => c.roleId === selectedRoleId);
    return [...confirmed, ...pending];
  }, [detail, newConditions, selectedRoleId]);

  const selectedRole = useMemo(() => allRoleRows.find((r) => r.roleId === selectedRoleId), [allRoleRows, selectedRoleId]);

  return (
    <AppShell>
      <div className="page-card">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="page-header page-header--with-action">
          <div>
            <h1 className={styles.pageTitle}>Service Request Rule Details</h1>
            <p className={styles.pageSubtitle}>Manage roles and configure conditions</p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/service-request-role')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>
        </div>

        {/* ── Header Info Strip ─────────────────────────────────────────── */}
        <div className={styles.detailInfoStrip}>
          {[
            { label: 'Upload ID',    value: detail?.uploadId ?? '—',    mono: true },
            { label: 'File Name',    value: detail?.fileName ?? '—',    mono: false },
            { label: 'Upload Type',  value: detail?.uploadType ?? '—',  mono: false },
            { label: 'Upload Date',  value: detail?.uploadDate ? new Date(detail.uploadDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—', mono: false },
          ].map((f, i) => (
            <React.Fragment key={f.label}>
              {i > 0 && <div className={styles.detailInfoDivider} aria-hidden="true" />}
              <div className={styles.detailInfoField}>
                <span className={styles.detailInfoLabel}>{f.label}</span>
                <span className={`${styles.detailInfoValue}${f.mono ? ` ${styles.detailInfoMono}` : ''}`}>{f.value}</span>
              </div>
            </React.Fragment>
          ))}
          <div className={styles.detailInfoDivider} aria-hidden="true" />
          <div className={styles.detailInfoField}>
            <span className={styles.detailInfoLabel}>Status</span>
            {detail?.status
              ? <span className={`badge ${statusClass(detail.status)}`}>{detail.status}</span>
              : <span className={styles.detailInfoValue}>—</span>}
          </div>
        </div>

        {notification && (
          <div className={`alert ${notification.type === 'success' ? 'alert--success' : 'alert--error'} notification-bar`} role="alert">
            {notification.text}
          </div>
        )}

        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        {!isLoading && detail && (
          <div className={styles.kpiSection}>
            <div className={styles.kpiGrid3}>
              <KpiCard label="Total Roles" value={detail.totalRecords} iconColor="blue"
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>} />
              <KpiCard label="Active" value={detail.roles.filter((r) => r.status === 'Active').length} iconColor="green"
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>} />
              <KpiCard label="Conditions" value={detail.conditions.length} iconColor="orange"
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>} />
            </div>
          </div>
        )}

        {isLoading && <div className="detail-loading"><p className="text-sm-muted">Loading role details…</p></div>}

        {!isLoading && (
          <div className={styles.sectionBlock}>

            {/* ── Rule Library ──────────────────────────────────────────── */}
            <div className="grid-toolbar">
              <div className="grid-toolbar__left">
                <h2 className={styles.sectionTitle}>Rule Library</h2>
              </div>
              <div className="grid-toolbar__right">
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleDownloadTemplate} disabled={isDownloading}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {isDownloading ? 'Downloading…' : 'Template'}
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleAddRole}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Rule
                </button>
                <button type="button" className="btn btn--primary btn--sm" onClick={handleSaveAllRoles} disabled={isSavingRoles}>
                  {isSavingRoles ? 'Saving…' : 'Save All'}
                </button>
              </div>
            </div>

            {errors['saveRoles'] && <div className="alert alert--error" role="alert">{errors['saveRoles']}</div>}

            <div className={styles.mappingTableWrap}>
              <table className={styles.mappingTable}>
                <thead>
                  <tr><th>Rule Name</th><th>Description</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {allRoleRows.length === 0 && (
                    <tr><td colSpan={4} className={styles.mappingEmpty}>No roles. Click <strong>Add Rule</strong> to create one.</td></tr>
                  )}
                  {allRoleRows.map((row) => {
                    const isEditing = editingRoles.has(row.roleId);
                    const editData  = editingRoles.get(row.roleId) ?? row;
                    const rErr      = rowErrors[row.roleId] ?? {};
                    const isSelected = selectedRoleId === row.roleId;

                    if (isEditing) {
                      return (
                        <tr key={row.roleId} className="mapping-table__row--editing">
                          <td>
                            <input type="text" className={styles.mappingInput} value={editData.roleName}
                              onChange={(e) => handleUpdateRole(row.roleId, 'roleName', e.target.value)} placeholder="Rule Name" aria-label="Rule Name" />
                            {rErr['roleName'] && <span className={styles.mappingError}>{rErr['roleName']}</span>}
                          </td>
                          <td>
                            <input type="text" className={styles.mappingInput} value={editData.description}
                              onChange={(e) => handleUpdateRole(row.roleId, 'description', e.target.value)} placeholder="Description" aria-label="Description" />
                            {rErr['description'] && <span className={styles.mappingError}>{rErr['description']}</span>}
                          </td>
                          <td>
                            <select className={styles.mappingSelect} value={editData.status}
                              onChange={(e) => handleUpdateRole(row.roleId, 'status', e.target.value)} aria-label="Status">
                              {ROLE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td>
                            <div className={styles.mappingActions}>
                              <button type="button" className="btn btn--primary btn--sm" onClick={() => handleSaveRole(row.roleId)}>Save</button>
                              <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleCancelEditRole(row.roleId)}>Cancel</button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={row.roleId} style={{ background: isSelected ? '#f5f3ff' : undefined, cursor: 'pointer' }}
                        onClick={() => selectRole(row.roleId)}>
                        <td style={{ fontWeight: isSelected ? 700 : undefined }}>{row.roleName || '—'}</td>
                        <td>{row.description || '—'}</td>
                        <td><span className={`badge ${resolveStatusBadge(row.status)}`}>{row.status}</span></td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className={styles.mappingActions}>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleEditRole(row.roleId)}>Edit</button>
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleDeleteRole(row.roleId)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Rule Conditions (nested inside Rule Library) ───────────── */}
            <div style={{ marginTop: 24, borderTop: '1px solid var(--color-border)', paddingTop: 20 }}>
              <div className="grid-toolbar">
                <div className="grid-toolbar__left">
                  <h2 className={styles.sectionTitle}>
                    Rule Conditions
                    {selectedRole && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8 }}>— {selectedRole.roleName}</span>}
                  </h2>
                </div>
                {selectedRoleId && (
                  <div className="grid-toolbar__right">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={handleAddCondition}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Add Condition
                    </button>
                    <button type="button" className="btn btn--primary btn--sm" onClick={handleSaveAllConditions} disabled={isSavingConditions}>
                      {isSavingConditions ? 'Saving…' : 'Save All'}
                    </button>
                  </div>
                )}
              </div>

              {errors['saveConditions'] && <div className="alert alert--error" role="alert">{errors['saveConditions']}</div>}

              {!selectedRoleId ? (
                <p className="text-sm-muted" style={{ padding: '24px 0' }}>Select a rule from the Rule Library to view and manage its conditions.</p>
              ) : (
                <div className={styles.mappingTableWrap}>
                  <table className={styles.mappingTable}>
                    <thead>
                      <tr><th>Field</th><th>Operator</th><th>Value</th><th>Condition</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {allConditionRows.length === 0 && (
                        <tr><td colSpan={5} className={styles.mappingEmpty}>No conditions. Click <strong>Add Condition</strong> to create one.</td></tr>
                      )}
                      {allConditionRows.map((row, idx) => {
                        const isEditing = editingConditions.has(row.conditionId);
                        const editData  = editingConditions.get(row.conditionId) ?? row;
                        const rErr      = rowErrors[row.conditionId] ?? {};

                        if (isEditing) {
                          return (
                            <tr key={row.conditionId} className="mapping-table__row--editing">
                              <td>
                                {fieldOptions.length > 0 ? (
                                  <select className={styles.mappingSelect} value={editData.fieldName}
                                    onChange={(e) => handleUpdateCondition(row.conditionId, 'fieldName', e.target.value)} aria-label="Field">
                                    <option value="">Select field…</option>
                                    {fieldOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                                  </select>
                                ) : (
                                  <input type="text" className={styles.mappingInput} value={editData.fieldName}
                                    onChange={(e) => handleUpdateCondition(row.conditionId, 'fieldName', e.target.value)} placeholder="Field name" aria-label="Field" />
                                )}
                                {rErr['fieldName'] && <span className={styles.mappingError}>{rErr['fieldName']}</span>}
                              </td>
                              <td>
                                <select className={styles.mappingSelect} value={editData.operator}
                                  onChange={(e) => handleUpdateCondition(row.conditionId, 'operator', e.target.value)} aria-label="Operator">
                                  {operators.map((o) => <option key={o.operatorId} value={o.value}>{o.label}</option>)}
                                </select>
                                {rErr['operator'] && <span className={styles.mappingError}>{rErr['operator']}</span>}
                              </td>
                              <td>
                                <input type="text" className={styles.mappingInput} value={editData.value}
                                  onChange={(e) => handleUpdateCondition(row.conditionId, 'value', e.target.value)} placeholder="Value" aria-label="Value" />
                                {rErr['value'] && <span className={styles.mappingError}>{rErr['value']}</span>}
                              </td>
                              <td>
                                {idx === 0 ? (
                                  <span className="text-sm-muted">IF</span>
                                ) : (
                                  <select className={styles.mappingSelect} value={editData.conditionType}
                                    onChange={(e) => handleUpdateCondition(row.conditionId, 'conditionType', e.target.value)} aria-label="Condition type">
                                    {CONDITION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                )}
                              </td>
                              <td>
                                <div className={styles.mappingActions}>
                                  <button type="button" className="btn btn--primary btn--sm" onClick={() => handleSaveCondition(row.conditionId)}>Save</button>
                                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleCancelCondition(row.conditionId)}>Cancel</button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={row.conditionId}>
                            <td>{row.fieldName || '—'}</td>
                            <td>{row.operator.replace(/_/g, ' ')}</td>
                            <td>{row.value || '—'}</td>
                            <td><span className="badge badge-gray">{idx === 0 ? 'IF' : row.conditionType}</span></td>
                            <td>
                              <div className={styles.mappingActions}>
                                <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleEditCondition(row.conditionId)}>Edit</button>
                                <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleDeleteCondition(row.conditionId)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Preview Logic ─────────────────────────────────────────── */}
              {selectedRoleId && allConditionRows.length > 0 && (
                <div style={{ marginTop: 20, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                  <h2 className={styles.sectionTitle}>Preview Logic</h2>
                  <pre className="payload-block">{buildPreviewText(allConditionRows)}</pre>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </AppShell>
  );
};

export default ServiceRequestRoleDetails;
