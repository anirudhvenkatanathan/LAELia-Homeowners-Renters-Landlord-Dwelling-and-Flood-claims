import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridReadyEvent, GridApi, RowClickedEvent, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import AppShell from '../../../components/layout/AppShell';
import { useServiceRequestRole } from '../../../hooks/ServiceRequestRole/useServiceRequestRole';
import { deleteServiceRequestRole, updateServiceRequestRole } from '../../../services/ServiceRequestRole/serviceRequestRoleService';
import { resolveStatusBadge } from './types';
import { styles } from './styles';
import { logError } from '../../../utils/logError';
import type { ServiceRequestRole } from './types';

// ─── AI Recommendations ───────────────────────────────────────────────────────

interface AiRec {
  id:                            string;
  ruleName:                      string;
  direction:                     'loosen' | 'tighten';
  perfBadge:                     string;
  // What gets written to ServiceRequestRole.conditionExpression / nlpCondition /
  // nlpConditionInWords on Accept. The "CURRENT" side shown in the UI is never
  // stored here — it's always read live off the matching role from the DB.
  suggestedConditionExpression:  string;
  suggestedNlpCondition:         string;
  suggestedNlpConditionInWords:  string;
  source:                        string;
  status:                        'pending' | 'accepted' | 'dismissed';
}

const INITIAL_RECS: AiRec[] = [
  {
    id: 'ncm', ruleName: 'Nurse Case Management', direction: 'loosen',
    perfBadge: '+14% earlier intervention',
    suggestedConditionExpression: '(Severity_score >= 6) AND (Disability_duration_days > 14)',
    suggestedNlpCondition:        'severity_score >= 6 and disability_duration_days > 14',
    suggestedNlpConditionInWords: 'Trigger if severity is 6 or more and disability lasts more than 14 days',
    source: '91% of claims with severity score 6 and disability duration between 10–14 days that bypassed NCM referral still required case management at a later, more costly stage. Applying both proposed thresholds reduces average claim duration by 18 days. · Last updated this week',
    status: 'pending',
  },
  {
    id: 'rtw', ruleName: 'RTW / JFA', direction: 'loosen',
    perfBadge: '+9% indemnity savings',
    suggestedConditionExpression: "(employer_cooperation_score >= 10) AND (claimant_willingness_flag != '')",
    suggestedNlpCondition:        'employer_cooperation_score >= 10 and claimant_willingness_flag not empty',
    suggestedNlpConditionInWords: 'Trigger if employer cooperation is 10 or more and claimant is willing',
    source: '88% of claims where employer cooperation scored exactly 7 and the claimant was willing resulted in successful RTW outcomes — equivalent to cases that triggered under the current ≥ 8 threshold. Lowering to ≥ 7 captures the 1 in 4 viable cases currently excluded. · Last updated this week',
    status: 'pending',
  },
  {
    id: 'pharma', ruleName: 'Pharmacy Carve-Out', direction: 'loosen',
    perfBadge: '+22% leakage prevention',
    suggestedConditionExpression: "(total_reserve_amount > 450000) AND (claimType = 'Workers compensation')",
    suggestedNlpCondition:        'total_reserve_amount > 450000 and claim type = Workers compensation',
    suggestedNlpConditionInWords: "Trigger if reserve exceeds 450k and claim is worker's comp",
    source: '87% of WC claims valued between $300K and $500K required active pharmacy intervention — but the current $500K trigger excludes them at intake. Lowering to $300K catches these cases before pharmacy costs compound mid-claim. · Last updated this week',
    status: 'pending',
  },
  {
    id: 'subrogation', ruleName: 'Subrogation', direction: 'loosen',
    perfBadge: '+$1.2M est. annual recovery',
    suggestedConditionExpression: "(liability_evidence_flag != '') AND (potential_recovery_amount > 35000) AND (jurisdiction IN ('CA','TX','FL'))",
    suggestedNlpCondition:        'liability_evidence_flag is not empty and potential_recovery_amount > 35000 and jurisdiction in CA, TX, FL',
    suggestedNlpConditionInWords: 'Trigger if liability evidence exists, recovery is above 35k, and jurisdiction is CA, TX, or FL',
    source: '78% of WC claims in CA, TX, and FL with partial liability evidence and recovery potential between $25K–$50K — currently below the referral threshold — successfully recovered subrogation. Adding jurisdiction as a condition at the $25K floor captures an estimated $1.2M in annual recoveries missed by the dollar-only rule. · Last updated this week',
    status: 'pending',
  },
  {
    id: 'billreview', ruleName: 'Bill Review', direction: 'tighten',
    perfBadge: '−28% review overhead',
    suggestedConditionExpression: "(Medical_bill_amount > 400) OR (out_of_network_provider_flag != '')",
    suggestedNlpCondition:        'medical_bill_amount > 400 or out_of_network_provider_flag is not empty',
    suggestedNlpConditionInWords: 'Trigger if the bill exceeds $400 or the provider is out-of-network',
    source: 'In-network bills under $250 had a 0.4% adjustment rate — well below the cost of review itself. Routing only bills above $250 or from out-of-network providers frees ~30% of review capacity for cases with a meaningful adjustment likelihood. · Last updated this week',
    status: 'pending',
  },
];

const DIRECTION_ICON: Record<AiRec['direction'], { iconBg: string; iconColor: string; label: string }> = {
  loosen:  { iconBg: '#dcfce7', iconColor: '#16a34a', label: 'LOOSEN' },
  tighten: { iconBg: '#fef3c7', iconColor: '#d97706', label: 'TIGHTEN' },
};

// ─── Grid context type ────────────────────────────────────────────────────────

interface GridContext {
  onViewClick:   (role: ServiceRequestRole) => void;
  onDeleteClick: (role: ServiceRequestRole) => void;
}

// ─── Cell Renderers ───────────────────────────────────────────────────────────

const StatusBadgeCellRenderer: React.FC<ICellRendererParams> = ({ value }) => (
  <span className={`badge ${resolveStatusBadge(String(value ?? ''))}`}>{value}</span>
);

const ActionCellRenderer: React.FC<ICellRendererParams<ServiceRequestRole, unknown, GridContext>> = ({ node, context }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
    {/* View */}
    <button type="button" className="grid-action-btn" title="View"
      onClick={(e) => { e.stopPropagation(); if (node.data) context?.onViewClick(node.data); }}
      aria-label="View role">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
    {/* Delete */}
    <button type="button" className="grid-action-btn grid-action-btn--danger" title="Delete"
      onClick={(e) => { e.stopPropagation(); if (node.data) context?.onDeleteClick(node.data); }}
      aria-label="Delete role">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
      </svg>
    </button>
  </div>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

const ServiceRequestRoleMaster: React.FC = () => {
  const navigate = useNavigate();
  const { roles, errors, fetchRoles } = useServiceRequestRole();

  const [quickFilter,   setQuickFilter]   = useState('');
  const [notification,  setNotification]  = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<ServiceRequestRole | null>(null);
  const [isDeleting,    setIsDeleting]    = useState(false);
  const gridApiRef = useRef<GridApi | null>(null);

  // ── AI Recommendations ─────────────────────────────────────────────────────
  const [recs,        setRecs]        = useState<AiRec[]>(INITIAL_RECS);
  const [aiExpanded,  setAiExpanded]  = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  // Accepted recs drop out of the panel entirely, same as dismissed ones.
  const pendingRecs  = recs.filter(r => r.status === 'pending');
  const pendingCount = pendingRecs.length;

  const showNotification = useCallback((type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const handleAccept = useCallback(async (rec: AiRec) => {
    const matchedRole = roles.find(r => r.roleName.trim().toLowerCase() === rec.ruleName.trim().toLowerCase());
    if (!matchedRole) {
      showNotification('error', `No matching rule named "${rec.ruleName}" was found to update.`);
      return;
    }
    setAcceptingId(rec.id);
    try {
      const result = await updateServiceRequestRole(
        matchedRole.roleId,
        matchedRole.roleName,
        matchedRole.description,
        matchedRole.status,
        rec.suggestedNlpCondition,
        rec.suggestedConditionExpression,
        rec.suggestedNlpConditionInWords,
        matchedRole.lineOfBusiness?.length ? matchedRole.lineOfBusiness : ['WCM'],
      );
      if (result.success) {
        setRecs(prev => prev.map(r => r.id === rec.id ? { ...r, status: 'accepted' } : r));
        await fetchRoles();
        showNotification('success', `"${rec.ruleName}" rule updated with the suggested condition.`);
      } else {
        showNotification('error', result.message || 'Failed to update the rule.');
      }
    } catch (err) {
      logError(err, 'ServiceRequestRoleMaster.handleAccept');
      showNotification('error', 'An unexpected error occurred while updating the rule.');
    } finally {
      setAcceptingId(null);
    }
  }, [roles, fetchRoles, showNotification]);

  const handleDismiss = useCallback((id: string) => setRecs(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' } : r)), []);

  // ── Delete handlers ────────────────────────────────────────────────────────

  const handleViewClick = useCallback((role: ServiceRequestRole) => {
    navigate(`/service-request-role/create?roleId=${role.roleId}`);
  }, [navigate]);

  const handleDeleteClick = useCallback((role: ServiceRequestRole) => {
    setDeleteTarget(role);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await deleteServiceRequestRole(deleteTarget.roleId);
      if (result.success) {
        setDeleteTarget(null);
        await fetchRoles();
        showNotification('success', `"${deleteTarget.roleName}" has been deleted.`);
      } else {
        showNotification('error', result.message || 'Failed to delete role.');
        setDeleteTarget(null);
      }
    } catch (err) {
      logError(err, 'ServiceRequestRoleMaster.handleDeleteConfirm');
      showNotification('error', 'An unexpected error occurred.');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, fetchRoles]);

  // ── AG Grid context (passes delete callback to cell renderer) ──────────────

  const gridContext = useMemo<GridContext>(() => ({
    onViewClick:   handleViewClick,
    onDeleteClick: handleDeleteClick,
  }), [handleViewClick, handleDeleteClick]);

  // ── Column definitions ─────────────────────────────────────────────────────

  const columnDefs = useMemo<ColDef<ServiceRequestRole>[]>(() => [
    { headerName: 'Rule Name',   field: 'roleName',    flex: 2, minWidth: 160, sortable: true, filter: true, cellClass: 'cell--bold' },
    { headerName: 'Description', field: 'description', flex: 3, minWidth: 200, sortable: true, filter: true },
    {
      headerName: 'Line of Business', field: 'lineOfBusiness', flex: 1, minWidth: 150, sortable: true, filter: true,
      valueGetter: (p) => (p.data?.lineOfBusiness ?? []).join(', '),
    },
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

  const onGridReady  = useCallback((p: GridReadyEvent) => { gridApiRef.current = p.api; }, []);

  const rowCount = roles.length;

  return (
    <AppShell>
      <div className="dash-page">

        {/* ── Page Header — its own separate heading tile, same treatment
            as Claims Command Center's .dash-header-card/.dash-title-row ── */}
        <div className="dash-header-card">
          <div className="dash-title-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h1 className={styles.pageTitle}>Claim Orchestration Engine</h1>
              <p className={styles.pageSubtitle}>Manage service request rules</p>
            </div>
            <div className={styles.pageHeaderActions}>
              <button type="button" className="btn btn--primary" onClick={() => navigate('/service-request-role/create')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Rule
              </button>
            </div>
          </div>
        </div>

        {/* ── Content — a second, separate tile below the heading tile ─── */}
        <div className="page-card" style={{ marginTop: 16 }}>

        {notification && (
          <div className={`alert ${notification.type === 'success' ? 'alert--success' : 'alert--error'} notification-bar`} role="alert">
            {notification.text}
          </div>
        )}

        {/* ── Roles Content ─────────────────────────────────────────────── */}
        <div className={styles.sectionBlock}>

          {/* ── AI Recommendations ──────────────────────────────────────── */}
          {pendingRecs.length > 0 && (
            <div className={`ai-rec${aiExpanded ? '' : ' ai-rec--collapsed'}`}>
              <div
                className="ai-rec__header"
                onClick={() => setAiExpanded(p => !p)}
                role="button"
                tabIndex={0}
                aria-expanded={aiExpanded}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAiExpanded(p => !p); } }}
              >
                <div className="ai-rec__header-left">
                  <div className="ai-rec__title-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#f59e0b', flexShrink: 0 }}>
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                    <span className="ai-rec__title">AI Recommendations</span>
                    {pendingCount > 0 && <span className="ai-rec__pending-badge">{pendingCount} pending</span>}
                  </div>
                  {aiExpanded && (
                    <p className="ai-rec__desc">Threshold preview — the current suggestions based on outcomes across recent claims. Review and accept to update the underlying rule.</p>
                  )}
                </div>
                <div className="ai-rec__header-controls" onClick={e => e.stopPropagation()}>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="#9ca3af" strokeWidth={2.5} strokeLinecap="round"
                    className={`ai-rec__chevron${aiExpanded ? ' ai-rec__chevron--open' : ''}`}
                    onClick={() => setAiExpanded(p => !p)}
                    style={{ cursor: 'pointer' }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                  {aiExpanded && (
                    <button
                      type="button"
                      className="ai-rec__close"
                      onClick={() => setAiExpanded(false)}
                      aria-label="Collapse AI recommendations"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {aiExpanded && (
                <div className="ai-rec__list">
                  {pendingRecs.map((rec) => {
                    const dir = DIRECTION_ICON[rec.direction];
                    const isAccepting = acceptingId === rec.id;
                    // CURRENT always reflects the live ServiceRequestRole.conditionExpression —
                    // never a copy stored on the recommendation — so it can't go stale.
                    const matchedRole = roles.find(r => r.roleName.trim().toLowerCase() === rec.ruleName.trim().toLowerCase());
                    const currentCondition   = matchedRole?.conditionExpression
                      ? `Triggers when ${matchedRole.conditionExpression}`
                      : 'No condition set';
                    const suggestedCondition = `Triggers when ${rec.suggestedConditionExpression}`;
                    return (
                      <div key={rec.id} className="ai-rec-card">
                        <div className="ai-rec-card__top">
                          <div className="ai-rec-card__top-left">
                            <span className="ai-rec-card__icon" style={{ background: dir.iconBg, color: dir.iconColor }}>
                              {rec.direction === 'loosen' ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                                </svg>
                              )}
                            </span>
                            <span className="ai-rec-card__name">{rec.ruleName}</span>
                            <span className="ai-rec-card__direction-badge">{dir.label}</span>
                            <span className="ai-rec-card__perf">{rec.perfBadge}</span>
                          </div>
                          <div className="ai-rec-card__btns">
                            <button type="button" className="ai-rec-card__btn-accept" onClick={() => handleAccept(rec)} disabled={isAccepting}>
                              {isAccepting ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="spin">
                                  <path d="M21 12a9 9 0 11-6.22-8.56"/>
                                </svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              )}
                              Accept
                            </button>
                            <button type="button" className="ai-rec-card__btn-dismiss" onClick={() => handleDismiss(rec.id)} disabled={isAccepting}>Dismiss</button>
                          </div>
                        </div>

                        <div className="ai-rec-card__body">
                          <div className="ai-rec-card__col">
                            <span className="ai-rec-card__col-label">CURRENT</span>
                            <p className="ai-rec-card__col-text">{currentCondition}</p>
                          </div>
                          <div className="ai-rec-card__col">
                            <span className="ai-rec-card__col-label ai-rec-card__col-label--sug">SUGGESTED</span>
                            <p className="ai-rec-card__col-text ai-rec-card__col-text--sug">{suggestedCondition}</p>
                          </div>
                        </div>

                        <p className="ai-rec-card__source">{rec.source}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid-toolbar">
            <div className="grid-toolbar__left">
              <div className="grid-search">
                <span className="grid-search__icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
                <input type="text" className="grid-search__input" placeholder="Search rules…" value={quickFilter}
                  onChange={(e) => setQuickFilter(e.target.value)} aria-label="Search rules" />
              </div>
              {rowCount > 0 && <span className="grid-row-count">{rowCount} record{rowCount !== 1 ? 's' : ''}</span>}
            </div>
            <div className="grid-toolbar__right">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => fetchRoles().catch(() => {})} title="Refresh" aria-label="Refresh grid">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
              </button>
            </div>
          </div>

          {errors['grid'] && <div className="alert alert--error" role="alert">{errors['grid']}</div>}
          {rowCount > 0 && <p className="grid-row-hint">Click a row to view or edit. Use the delete icon to remove a rule.</p>}

          <div className={`${styles.agTheme} ${styles.agGridInCard}`}>
            <AgGridReact<ServiceRequestRole>
              rowData={roles} columnDefs={columnDefs} defaultColDef={defaultColDef}
              context={gridContext}
              rowSelection="single" suppressRowClickSelection={false} quickFilterText={quickFilter}
              onGridReady={onGridReady}
              animateRows pagination paginationPageSize={10} paginationPageSizeSelector={[5, 10, 20, 50]}
              suppressCellFocus rowHeight={44} headerHeight={42}
              overlayNoRowsTemplate='<span class="text-sm-muted">No roles found. Click <strong>Add Rule</strong> to create one or <strong>Upload File</strong> to import.</span>'
            />
          </div>
        </div>

        </div>

      </div>

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      {deleteTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title"
          onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) setDeleteTarget(null); }}>
          <div className="modal" style={{ maxWidth: 420 }}>

            <div className="modal__header">
              <h2 className="modal__title" id="delete-confirm-title">Delete Role</h2>
              <button type="button" className="modal__close" onClick={() => setDeleteTarget(null)} disabled={isDeleting} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal__body">
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                Are you sure you want to delete this role?
              </p>
            </div>

            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                No
              </button>
              <button type="button" className="btn btn--danger" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="spin">
                      <path d="M21 12a9 9 0 11-6.22-8.56"/>
                    </svg>
                    Deleting…
                  </>
                ) : 'Yes'}
              </button>
            </div>

          </div>
        </div>
      )}

    </AppShell>
  );
};

export default ServiceRequestRoleMaster;
