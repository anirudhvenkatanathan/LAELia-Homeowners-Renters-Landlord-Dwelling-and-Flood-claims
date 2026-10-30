import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import AppShell from '../../../components/layout/AppShell';
import { useAuth } from '../../../context/AuthContext';
import { useClaimDetails } from '../../../hooks/claimIntakeMaster/useClaimDetails';
import type { IndividualClaimRecord, ClaimChangeLogEntry, VendorOption, ServiceVendorReview } from '../../../models/claimIntakeMaster/claimIntakeModel';
import {
  savePlanServices, saveDraftPlanServices, saveVendorServices, getAllVendorNames, getVendorsByRoleIds,
  getVendorsByRoleIdsWithDetails, saveChangeLogEntry, getChangeLogEntries,
} from '../../../services/claimIntakeMaster/claimIntakeService';
import { getAllServiceRequestRoles } from '../../../services/ServiceRequestRole/serviceRequestRoleService';
import { logError } from '../../../utils/logError';
import { vendorRoleScorecard } from '../../../utils/kpiScoring';
import { getClaimSummaryData } from '../../../utils/claimSummaryMockData';
import { getIsoClaimSearchData, type IsoClaimSearchData } from '../../../utils/isoClaimSearchMockData';
import { resolveHideVendorRating, resolveCanOverrideService, resolveCanOverrideProvider, isAdjusterTypeRole } from '../../../utils/permissions';
import { mapClaimTypeToLOB } from '../../../utils/lineOfBusiness';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function planStatusBadgeCls(status: string): string {
  const v = (status ?? '').toLowerCase();
  if (v === 'completed') return 'badge badge-coral';
  if (v.includes('Finalized Selection') || v.includes('finalized')) return 'badge badge-coral';
  if (v === 'pending review') return 'badge badge-coral';
  if (v.includes('pending')) return 'badge badge-coral';
  return 'badge badge-gray';
}

function uploadStatusBadgeCls(s: string): string {
  const v = (s ?? '').toLowerCase();
  if (v === 'processed' || v === 'completed' || v === 'success') return 'badge-green';
  if (v === 'partial') return 'badge-yellow';
  if (v === 'failed' || v === 'error') return 'badge-red';
  return 'badge-gray';
}

function exportExcel(rows: IndividualClaimRecord[], fileName: string): void {
  const headers = ['#','Claim Number','Policy Number','Insured Name','Loss Date','Reported Date','Claim Amount','Status','Plan Services','Service Provider Services'];
  const esc = (v: unknown) => `<Cell><Data ss:Type="String">${String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Data></Cell>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles><Style ss:ID="H"><Font ss:Bold="1"/></Style></Styles>
  <Worksheet ss:Name="Claim Records"><Table>
    <Row ss:StyleID="H">${headers.map(esc).join('')}</Row>
    ${rows.map(r=>`<Row>${[r.recordIndex,r.claimNumber,r.policyNumber,r.insuredName,r.claimType,r.lossDate,r.reportedDate,r.claimAmount,r.planServiceStatus,(r.planServiceNames??[]).join(', '),(r.vendorServices??[]).join(', ')].map(esc).join('')}</Row>`).join('\n')}
  </Table></Worksheet></Workbook>`;
  const blob = new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'),{href:url,download:`${fileName}.xlsx`});
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Change log types ─────────────────────────────────────────────────────────

interface LocalChangeEntry { id:string; timestamp:Date; type:'role'|'vendor'; previousValue:string; updatedValue:string; reason:string; }
interface PendingToggle     { type:'role'|'vendor'; item:string; action:'add'|'remove'; previousValue:string; updatedValue:string; }

// ─── Reason for Change Modal ──────────────────────────────────────────────────

interface ReasonModalProps { pending:PendingToggle|null; value:string; error:string; onChange:(v:string)=>void; onConfirm:()=>void; onCancel:()=>void; }
const ReasonModal: React.FC<ReasonModalProps> = ({pending,value,error,onChange,onConfirm,onCancel}) => {
  if (!pending) return null;
  const desc = pending.action==='remove' ? `Deselecting "${pending.item}"` : `Selecting "${pending.item}"`;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={e=>{if(e.target===e.currentTarget)onCancel();}}>
      <div className="modal" style={{maxWidth:440}}>
        <div className="modal__header">
          <h2 className="modal__title">Reason for Change</h2>
          <button type="button" className="modal__close" onClick={onCancel} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal__body">
          <p style={{fontSize:'var(--text-sm)',color:'var(--color-text-muted)',marginTop:-4,marginBottom:8}}>{desc}</p>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label form-label--required">Reason for Change</label>
            <textarea className={`form-textarea${error?' form-input--error':''}`} value={value} rows={3} placeholder="Provide a reason for this change…" autoFocus onChange={e=>onChange(e.target.value)} />
            {error && <span className="form-error" role="alert">{error}</span>}
          </div>
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn--accept" onClick={onConfirm}>Save Change</button>
        </div>
      </div>
    </div>
  );
};


// ─── CheckIcon ────────────────────────────────────────────────────────────────

// ─── Vendor Switch Modal ──────────────────────────────────────────────────────

interface PendingVendorChange {
  roleName: string;
  roleIdx:  number;
  fromVendor: string;
  toVendor:   string;
}

interface VSMProps {
  pending: PendingVendorChange | null;
  reason: string; error: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel:  () => void;
}

const VendorSwitchModal: React.FC<VSMProps> = ({ pending, reason, error, onChange, onConfirm, onCancel }) => {
  if (!pending) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" style={{ maxWidth: 480 }}>

        <div className="modal__header">
          <div>
            <h2 className="modal__title">Switch provider — S-{String(pending.roleIdx + 1).padStart(2, '0')}</h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 3 }}>
              Service Provider changes are logged. Please explain why you're switching.
            </p>
          </div>
          <button type="button" className="modal__close" onClick={onCancel} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal__body">
          {/* FROM → TO comparison box */}
          <div className="vsm-change-box">
            <div className="vsm-change-box__side">
              <span className="vsm-change-box__label">FROM</span>
              <span className="vsm-change-box__value">{pending.fromVendor || '(none)'}</span>
            </div>
            <span className="vsm-change-box__arrow">→</span>
            <div className="vsm-change-box__side vsm-change-box__side--to">
              <span className="vsm-change-box__label">TO</span>
              <span className="vsm-change-box__value">{pending.toVendor}</span>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <textarea
              className={`form-textarea${error ? ' form-input--error' : ''}`}
              value={reason} rows={3}
              placeholder="Reason for switching provider…"
              autoFocus
              onChange={e => onChange(e.target.value)}
            />
            {error && <span className="form-error" role="alert">{error}</span>}
          </div>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn--accept" onClick={onConfirm}>Confirm switch</button>
        </div>

      </div>
    </div>
  );
};
// ─── Supervisor Review Comment Modal ───────────────────────────────────────────
// FRD §6/§7: every Supervisor decision on a Pending Review service (keep/change
// a provider, keep/remove an added service) is captured through this popup —
// nothing is edited inline on the row itself. Confirming here both applies the
// staged decision (vendor pick / active-flag) and records the mandatory comment;
// Cancel discards the decision entirely, leaving the row exactly as it was.

interface PendingSupervisorReview {
  role: string;
  changeType: 'ProviderChange' | 'ServiceAdded';
  toVendor?: string;     // ProviderChange — the vendor about to be applied
  keep?: boolean;        // ServiceAdded — true = keep active (Included), false = remove (Rejected)
}

interface SupervisorReviewModalProps {
  pending: PendingSupervisorReview | null;
  fromVendor?: string;
  comment: string;
  error: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const SupervisorReviewModal: React.FC<SupervisorReviewModalProps> = ({ pending, fromVendor, comment, error, onChange, onConfirm, onCancel }) => {
  if (!pending) return null;
  const isProviderChange = pending.changeType === 'ProviderChange';
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Review — {pending.role}</h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 3 }}>
              This decision is staged and only takes effect once you click Confirm Selection.
            </p>
          </div>
          <button type="button" className="modal__close" onClick={onCancel} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal__body">
          {isProviderChange ? (
            <div className="vsm-change-box">
              <div className="vsm-change-box__side">
                <span className="vsm-change-box__label">CURRENT</span>
                <span className="vsm-change-box__value">{fromVendor || '(none)'}</span>
              </div>
              <span className="vsm-change-box__arrow">→</span>
              <div className="vsm-change-box__side vsm-change-box__side--to">
                <span className="vsm-change-box__label">FINAL</span>
                <span className="vsm-change-box__value">{pending.toVendor}</span>
              </div>
            </div>
          ) : (
            <div className="vsm-change-box">
              <div className="vsm-change-box__side vsm-change-box__side--to" style={{ flex: 1 }}>
                <span className="vsm-change-box__label">DECISION</span>
                <span className="vsm-change-box__value">{pending.keep ? 'Keep this service (Included)' : 'Remove this service (Rejected)'}</span>
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0, marginTop: 14 }}>
            <label className="form-label form-label--required">Supervisor Comment</label>
            <textarea
              className={`form-textarea${error ? ' form-input--error' : ''}`}
              value={comment} rows={3}
              placeholder="Explain the reasoning behind this decision…"
              autoFocus
              onChange={e => onChange(e.target.value)}
            />
            {error && <span className="form-error" role="alert">{error}</span>}
          </div>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn--accept" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

// ─── ISO ClaimSearch Flyout ────────────────────────────────────────────────────

interface TriggerRect { left: number; right: number; top: number; bottom: number; }
interface IsoClaimSearchFlyoutProps {
  data: IsoClaimSearchData | null;
  claimantName: string;
  claimNumber: string;
  policyNumber: string;
  claimStatus: string;
  jurisdiction: string;
  triggerRect: TriggerRect;
  onClose: () => void; onEnter: () => void; onLeave: () => void;
}
const IsoClaimSearchFlyout: React.FC<IsoClaimSearchFlyoutProps> = ({
  data, claimantName, claimNumber, policyNumber, claimStatus, jurisdiction, triggerRect, onClose, onEnter, onLeave,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  // Starts hidden at a guessed spot, then repositions from the panel's real
  // (rendered) size once it's actually laid out — content height varies a
  // lot by claim (no match vs. 1 vs. 2 matches, how many fields each has),
  // so a fixed guess used to misjudge which side had room and clip content
  // off the bottom of the viewport. useLayoutEffect runs before paint, so
  // this correction never flashes the wrong position on screen first.
  const [pos, setPos] = useState<{ top: number; left: number; ready: boolean }>({
    top: triggerRect.bottom, left: triggerRect.left, ready: false,
  });

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = 10;
    const left = triggerRect.left >= w + gap
      ? triggerRect.left - w - gap
      : Math.max(12, Math.min(triggerRect.right + gap, window.innerWidth - w - 12));
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const top = spaceBelow >= h + 12 || spaceBelow >= spaceAbove
      ? Math.max(12, Math.min(triggerRect.bottom + 6, window.innerHeight - h - 12))
      : Math.max(12, triggerRect.top - h - 6);
    setPos({ top, left, ready: true });
    // Re-measure whenever the trigger moves (re-hover) or the claim's own
    // content changes (different flag/matches would render a different height).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerRect.left, triggerRect.right, triggerRect.top, triggerRect.bottom, data]);

  return createPortal(
    <div
      ref={panelRef}
      className="iso-flyout"
      style={{ position: 'fixed', top: pos.top, left: pos.left, visibility: pos.ready ? 'visible' : 'hidden', zIndex: 999 }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
        <div className="iso-flyout__header">
          <div className="iso-flyout__title-row">
            <span className="iso-flyout__eyebrow">ISO CLAIMSEARCH</span>
            <button type="button" className="iso-flyout__close" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="iso-flyout__claimant">{claimantName}</div>
          <div className="iso-flyout__desc">Cross-referenced against every claim filed with any other participating insurer</div>
          {data ? (
            <div className="iso-flyout__meta">
              Masked ID: {data.maskedId} · {data.flags.reduce((n, c) => n + c.matches.length, 0)} match{data.flags.reduce((n, c) => n + c.matches.length, 0) === 1 ? '' : 'es'} found
              {data.flags.length > 1 ? ` across ${data.flags.length} flags` : ''}
            </div>
          ) : (
            <div className="iso-flyout__meta">Claim {claimNumber} · Policy {policyNumber} · {claimStatus} · {jurisdiction}</div>
          )}
        </div>

        <div className="iso-flyout__body">
          {data ? (
            data.flags.map(card => (
              <div className="iso-flyout__flag-card" key={card.flagType}>
                {card.matches.map((m, i) => (
                  <div className="iso-flyout__match" key={m.isoFileNumber}>
                    <div className="iso-flyout__match-title-row">
                      <span className="iso-flyout__match-title">MATCH {i + 1} — ISO FILE #{m.isoFileNumber}</span>
                      {m.sameDayAsCurrent && <span className="iso-flyout__same-day-badge">SAME DAY</span>}
                    </div>
                    <table className="iso-flyout__table">
                      <tbody>
                        {m.fields.map(f => (
                          <tr key={f.label}>
                            <td className="iso-flyout__field-label">{f.label}</td>
                            <td className="iso-flyout__field-value">{f.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                <div className="iso-flyout__flag-box">
                  <div className="iso-flyout__flag-heading">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {card.flagHeading}
                  </div>
                  <p className="iso-flyout__flag-desc">{card.flagDescription}</p>
                  <div className="iso-flyout__flag-divider" />
                  <p className="iso-flyout__flag-insight">{card.claimSpecificInsight}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="iso-flyout__no-match">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>
              </svg>
              <p>No ISO ClaimSearch matches found for this claim.</p>
            </div>
          )}
        </div>
    </div>,
    document.body
  );
};

const CheckIcon: React.FC<{color?:string}> = ({color='#2563eb'}) => (
  <span style={{width:16,height:16,borderRadius:4,background:color,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  </span>
);
// ─── Change Log Grid columns ──────────────────────────────────────────────────


// ─── Vendor matching % ─────────────────────────────────────────────────────────
// Same source as the Provider Scoreboard's PPI (vendorRoleScorecard.aggregate,
// 0–5 scale) so a vendor's matching % here always agrees with its score there —
// just rescaled to a 0–100 percentage for display.

const vendorMatchPercent = (vendorName: string, role: string): number =>
  Math.round(vendorRoleScorecard(vendorName, role).aggregate * 20);

// Ranking used everywhere a role's vendor list is ordered (auto-select default,
// "Recommended Service Provider" label, dropdown list/"Best Fit" tag): vendors
// with an active Priority Boost (Service Provider Administration → Apply
// Priority Boost) always outrank non-boosted vendors for that role, regardless
// of FitIQ %; within each group (boosted / non-boosted), rank by FitIQ % desc.
// The displayed FitIQ % itself is never altered by boost — it stays each
// vendor's real computed score, so it keeps agreeing with the Provider
// Scoreboard/View Performance screens.
function vendorRankCompare(a: VendorOption, b: VendorOption, role: string): number {
  const boostDiff = (b.boostApplied === true ? 1 : 0) - (a.boostApplied === true ? 1 : 0);
  if (boostDiff !== 0) return boostDiff;
  return vendorMatchPercent(b.companyName, role) - vendorMatchPercent(a.companyName, role);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const ClaimIntakeDetails: React.FC = () => {
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate     = useNavigate();
  const location     = useLocation();
  const { user } = useAuth();
  // Adjusters shouldn't see service provider rating data (stars/numeric score/
  // matching breakdown) unless a Claims Supervisor has explicitly granted it
  // via Edit Access (User Management). Defaults preserve today's behavior
  // exactly until a Supervisor changes something for this specific user.
  const hideVendorRating    = resolveHideVendorRating(user?.roleName, user?.permissions);
  const canOverrideService  = resolveCanOverrideService(user?.permissions);
  const canOverrideProvider = resolveCanOverrideProvider(user?.permissions);

  const routeState = (location.state ?? {}) as { claimNumber?: string; recordIndex?: number };
  const selectedClaimNumber = routeState.claimNumber ?? '';
  const selectedRecordIndex = routeState.recordIndex ?? null;

  const { detail, loading, error, refresh } = useClaimDetails(uploadId, location.key);
  const [localRecords, setLocalRecords] = useState<IndividualClaimRecord[]>([]);
  useEffect(() => { if (detail?.records) setLocalRecords(detail.records); }, [detail]);
  console.log('ClaimIntakeDetails: detail', detail, 'localRecords', localRecords, 'selectedRecordIndex', selectedRecordIndex);
  const selectedRecord = selectedRecordIndex != null
    ? localRecords.find(r => r.recordIndex === selectedRecordIndex) ?? localRecords[0] ?? null
    : localRecords[0] ?? null;

  console.log('selectedRecord', selectedRecord);

  const claimSummaryData = getClaimSummaryData(selectedRecord?.claimNumber ?? '', selectedRecord?.insuredName, selectedRecord?.causeOfLoss, selectedRecord?.damagedAreas);
  const isoClaimSearchData = getIsoClaimSearchData(selectedRecord);
  // Stores the trigger's own rect, not a pre-computed panel position — the
  // panel's real (rendered) size is only known once its actual content has
  // laid out, which varies a lot by claim (1 vs 2 matches, how many fields).
  // A fixed height guess used to underestimate this and get clipped off the
  // bottom of the viewport; IsoClaimSearchFlyout now measures itself after
  // mount and positions off the real height — see its useLayoutEffect.
  const [isoFlyout, setIsoFlyout] = useState<{ left: number; right: number; top: number; bottom: number } | null>(null);
  const isoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelIsoHide = () => { if (isoHideTimer.current) { clearTimeout(isoHideTimer.current); isoHideTimer.current = null; } };
  const scheduleIsoHide = () => { cancelIsoHide(); isoHideTimer.current = setTimeout(() => setIsoFlyout(null), 150); };

  const openIsoFlyout = (el: HTMLElement) => {
    cancelIsoHide();
    const r = el.getBoundingClientRect();
    setIsoFlyout({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
  };

  const snapshotRecords = selectedRecord ? [selectedRecord] : [];

  // ── Roles & vendors ────────────────────────────────────────────────────────
  const [allRoles, setAllRoles] = useState<Array<{roleId:string;roleName:string;nlpCondition:string;nlpConditionInWords:string;lineOfBusiness:string[]}>>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  // Claim Command Center shows only the Service Request Rules configured for
  // this claim's LOB (derived from claimType) — a rule may now be configured
  // for more than one LOB. Other lookups below stay on the unfiltered
  // allRoles array so already-confirmed/legacy roles still resolve even if a
  // claim's LOB classification changes later.
  const claimLOB = mapClaimTypeToLOB(selectedRecord?.claimType);
  const allRoleNames = claimLOB ? allRoles.filter(r => r.lineOfBusiness.includes(claimLOB)).map(r => r.roleName) : [];

  const loadRoles = () => {
    setRolesLoading(true);
    getAllServiceRequestRoles()
      .then(r => setAllRoles(r.filter(x=>x.status==='Active').map(x=>({roleId:x.roleId,roleName:x.roleName,nlpCondition:x.nlpCondition??'',nlpConditionInWords:x.nlpConditionInWords??'',lineOfBusiness:x.lineOfBusiness??[]})).filter(x=>x.roleName)))
      .catch(err => logError(err, 'CID.loadRoles'))
      .finally(() => setRolesLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadRoles(); }, [location.key]);

  const [allVendorNamesList, setAllVendorNamesList] = useState<string[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);

  const loadVendors = () => {
    setVendorsLoading(true);
    getAllVendorNames()
      .then(setAllVendorNamesList)
      .catch(err => logError(err, 'CID.loadVendors'))
      .finally(() => setVendorsLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadVendors(); }, [location.key]);

  // Ref always holds the latest fetchVendorsForRoles closure so the visibility
  // handler (which runs with a [] dep and cannot be recreated) always invokes
  // the current version without stale closures over allRoles / activeServiceRoles.
  const vendorFetchRef = useRef<() => void>(() => {});

  // Updated every render (see assignment near hasUnconfirmedServices below) so
  // the visibility handler's stale [] closure can still see whether there's
  // unsaved local work (a toggled role, a staged Supervisor decision) right
  // now. Without this, refresh() below silently replaces selectedRecord with
  // the server's still-unconfirmed snapshot the instant the tab regains focus
  // — activeServiceRoles is then re-derived from that snapshot's
  // confirmedPlanServiceNames, which still contains whatever role the user
  // just toggled off locally, resurrecting it in the UI before Confirm
  // Selection was ever clicked.
  const hasUnconfirmedRef = useRef(false);

  // Re-fetch all data when the user returns to the tab after idling
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (!hasUnconfirmedRef.current) refresh();
        loadRoles();
        loadVendors();
        vendorFetchRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Plan Services ──────────────────────────────────────────────────────────
  const [psSaving, setPsSaving] = useState(false);
  const [psError,  setPsError]  = useState<string|null>(null);

  const savePlan = async (record: IndividualClaimRecord, names: string[], comments: string) => {
    if (!uploadId) return;
    setPsSaving(true); setPsError(null);
    try {
      const ids = names.map(n => allRoles.find(r => r.roleName === n)?.roleId ?? n);
      const res = await savePlanServices({ uploadId, recordIndex: record.recordIndex, planServices: ids, comments });
      if (!res.success) { setPsError(res.message ?? 'Save failed.'); return; }
      // Mirror the backend's savePlanServices resolver exactly — it writes
      // confirmedPlanServices to the SAME value as planServices, not just
      // planServices. Leaving confirmedPlanServiceNames out of this
      // optimistic update used to change selectedRecord.planServiceStatus/
      // planServiceNames (both now correct) while confirmedPlanServiceNames
      // stayed one step behind (still listing a role just removed here) —
      // that mismatch alone is enough to trigger the activeServiceRoles
      // recompute effect (it depends on both), whose
      // [...confirmedNames, ...newMatches] union then resurrected the
      // removed role mid-sequence, before confirmVendorSelection even ran.
      setLocalRecords(prev => prev.map(r => r.recordIndex === record.recordIndex
        ? { ...r, planServices: ids, planServiceNames: names, confirmedPlanServices: ids, confirmedPlanServiceNames: names, planServiceComments: comments, planServiceStatus: 'Pending Selection', suggestedVendors: [] } : r));
      const sug = await getVendorsByRoleIds(ids);
      setLocalRecords(prev => prev.map(r => r.recordIndex === record.recordIndex ? { ...r, suggestedVendors: sug } : r));
    } catch (err) { logError(err, 'CID.savePlan'); setPsError('Failed to save plan services.'); }
    finally { setPsSaving(false); }
  };

  // ── Vendor Services ─────────────────────────────────────────────────────────
  const [vsSaving, setVsSaving] = useState(false);
  const [vsError,  setVsError]  = useState<string|null>(null);

  // Locks the "Confirm Selection" button for the ENTIRE confirmServiceProviderSelection
  // cycle (both saves plus the closing refresh), not just whichever of
  // psSaving/vsSaving happens to be true at a given instant. Those two flip on/off
  // at different points inside the sequence (confirmPlanSelection finishes and
  // clears psSaving *before* confirmVendorSelection has set vsSaving), leaving a
  // brief window where neither is true and the button would re-enable mid-submit —
  // exactly the gap a fast double-click (or an automated retry) could slip through
  // and fire a second, duplicate submission for the same review cycle.
  const [confirmingSelection, setConfirmingSelection] = useState(false);

  // Claim-wide status derived from the per-service array — mirrors the backend's
  // deriveClaimStatus() in claimIntakeEntity.ts, kept in sync for the optimistic
  // local update below (refresh() reconciles against the server afterward).
  const deriveClaimStatus = (review: ServiceVendorReview[]): string =>
    review.some(e => e.status === 'Pending Review') ? 'Pending Review' : 'Finalized Selection';

  const saveVendors = async (
    record: IndividualClaimRecord, vendors: string[], comments: string,
    serviceVendorReview: ServiceVendorReview[],
    adjuster?: { comments: string; submittedBy: string },
  ) => {
    if (!uploadId) return;
    setVsSaving(true); setVsError(null);
    try {
      // Use the currently active roles (not record.planServices) so a plan-selection
      // confirmed moments earlier in the same combined action is reflected immediately.
      const planServiceIds = activeServiceRoles.map(n => allRoles.find(r => r.roleName === n)?.roleId ?? n);
      const res = await saveVendorServices({
        uploadId, recordIndex: record.recordIndex, vendorServices: vendors, planServices: planServiceIds, comments,
        serviceVendorReview,
        // Omitted entirely (undefined) for a Supervisor's own Confirm Selection —
        // the resolver only touches the stored Adjuster comment when this is sent.
        ...(adjuster ? { adjusterComments: adjuster.comments, adjusterSubmittedBy: adjuster.submittedBy } : {}),
      });
      if (!res.success) { setVsError(res.message ?? 'Save failed.'); return; }
      setLocalRecords(prev => prev.map(r => {
        if (r.recordIndex !== record.recordIndex) return r;
        const mergedByRole = new Map((r.serviceVendorReview ?? []).map(e => [e.roleName, e]));
        for (const entry of serviceVendorReview) mergedByRole.set(entry.roleName, entry);
        const mergedReview = [...mergedByRole.values()];
        return {
          ...r, vendorServices: vendors, vendorServiceComments: comments,
          planServiceStatus: deriveClaimStatus(mergedReview),
          serviceVendorReview: mergedReview,
          ...(adjuster ? {
            adjusterComments: adjuster.comments,
            adjusterSubmittedBy: adjuster.submittedBy,
            adjusterSubmittedAt: new Date().toISOString(),
          } : {}),
        };
      }));
    } catch (err) { logError(err, 'CID.saveVendors'); setVsError('Failed to save vendor services.'); }
    finally { setVsSaving(false); }
  };

  // ── Active selections + local change log ───────────────────────────────────
  const [activeServiceRoles, setActiveServiceRoles] = useState<string[]>([]);
  const draftLoadedRef = useRef(false); // ensure localStorage draft loads only once per record
  const [activeVendors,      setActiveVendors]      = useState<string[]>([]);
  // Per-role vendor selection: roleName → selected vendor name
  const [roleVendorMap,     setRoleVendorMap]     = useState<Record<string, string>>({});
  // Per-role vendor options: VendorOption[] sorted by rating desc (only vendors mapped to that role)
  const [roleToVendorsMap, setRoleToVendorsMap] = useState<Record<string, VendorOption[]>>({});
  // Rule Engine's top pick for a role — same ranking used by the recommended-vendor label
  // and the dropdown's "Best Fit" tag, reused here to detect vendor overrides.
  const getRecommendedVendor = (role: string): string => {
    const mapped = [...(roleToVendorsMap[role] ?? [])].sort((a, b) => vendorRankCompare(a, b, role));
    return mapped[0]?.companyName ?? '';
  };
  // Per-service vendor state: 'Unconfirmed' (never confirmed yet, freely editable),
  // 'Pending Review' (Adjuster override/addition awaiting Supervisor), 'Locked'
  // (matched on confirm — never was under review), or one of the 3 terminal
  // Supervisor-review outcomes ('Modified'/'Included'/'Rejected') — all four of
  // the latter are equally "done, no longer editable by anyone."
  const getServiceVendorEntry = (role: string): ServiceVendorReview | undefined =>
    selectedRecord?.serviceVendorReview?.find(e => e.roleName === role);
  const getServiceStatus = (role: string): 'Unconfirmed' | 'Pending Review' | 'Locked' | 'Modified' | 'Included' | 'Rejected' => {
    const entry = getServiceVendorEntry(role);
    if (entry) return entry.status;
    // Backward-compat fallback for claims confirmed before this per-service model
    // existed — they have no serviceVendorReview entries but are already finalized.
    if (isClaimCompleted || isVendorConfirmed) return 'Locked';
    return 'Unconfirmed';
  };
  // A service that's been fully reviewed one way or another (matched, or a
  // Supervisor-decided outcome) — frozen for everyone, contrast with 'Pending Review'.
  const isServiceLockedStatus = (status: ReturnType<typeof getServiceStatus>): boolean =>
    status === 'Locked' || status === 'Modified' || status === 'Included';
  // AI Summary eye-icon popup tracker
  const [activePopup, setActivePopup] = useState<{ section: string; idx: number } | null>(null);
  // Vendor card dropdown open state: role name of the open dropdown, null if all closed
  const [openVendorDropdown, setOpenVendorDropdown] = useState<string | null>(null);
  // Score breakdown popup: which vendor's popup is visible + its fixed viewport position
  const [scorePopup, setScorePopup] = useState<{ role: string; vendorName: string; rating: number; x: number; y: number } | null>(null);
  const popupHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPopupHide = () => { if (popupHideTimer.current) { clearTimeout(popupHideTimer.current); popupHideTimer.current = null; } };
  const schedulePopupHide = () => { cancelPopupHide(); popupHideTimer.current = setTimeout(() => setScorePopup(null), 150); };
  // Capture initial plan names on first load (for computing added/removed in the log)
  const initialPlanNamesRef = useRef<{ recordIndex: number; names: string[] } | null>(null);
  if (selectedRecord &&
      (initialPlanNamesRef.current === null ||
       initialPlanNamesRef.current.recordIndex !== selectedRecord.recordIndex)) {
    // Baseline = union of whatever was already confirmed AND the latest rule-recommended
    // names, snapshotted once at load (before any toggle can pollute planServiceNames via
    // saveDraftPlanServices). Both sets count as "recommended" — only a role that is in
    // neither should be treated as a new, non-recommended addition needing supervisor review.
    const baselineNames = Array.from(new Set([
      ...(selectedRecord.confirmedPlanServiceNames ?? []),
      ...(selectedRecord.planServiceNames ?? []),
    ]));
    initialPlanNamesRef.current = { recordIndex: selectedRecord.recordIndex, names: baselineNames };
  }
  const initialPlanNames = initialPlanNamesRef.current?.names ?? [];

  // Per-role change reason (displayed below each service role card)
  const [roleReasonMap, setRoleReasonMap] = useState<Record<string, string>>({});
  // Per-role vendor change reason (displayed below the vendor dropdown)
  const [roleVendorReasonMap, setRoleVendorReasonMap] = useState<Record<string, string>>({});
  // Pending vendor switch (awaiting reason)
  const [pendingVendorChange, setPendingVendorChange]       = useState<PendingVendorChange | null>(null);
  const [vendorChangeReason,  setVendorChangeReason]        = useState('');
  const [vendorChangeReasonError, setVendorChangeReasonError] = useState('');
  const [localChangeLog,     setLocalChangeLog]     = useState<LocalChangeEntry[]>([]);
  const [dbChangeLog,        setDbChangeLog]        = useState<ClaimChangeLogEntry[]>([]);
  const [chlPage,            setChlPage]            = useState(1);
  const CHL_PAGE_SIZE = 5;
  const [pendingToggle,      setPendingToggle]      = useState<PendingToggle|null>(null);
  const [reasonInput,        setReasonInput]        = useState('');
  const [reasonError,        setReasonError]        = useState('');
  const [existingRoles, setExistingRoles] = useState<Array<{roleName:string}>>([]);

  // Fetch vendors mapped to specific roles (one query per role using that role's ID)
  // Persist active roles to localStorage whenever they change
  useEffect(() => {
    if (uploadId && selectedRecord && draftLoadedRef.current) {
      const draftKey = `claim_roles_${uploadId}_${selectedRecord.recordIndex}`;
      localStorage.setItem(draftKey, JSON.stringify({ roles: activeServiceRoles, ts: Date.now() }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServiceRoles]);

  const fetchVendorsForRoles = async (roleNames: string[], confirmedVendors: string[]) => {
    if (!roleNames.length) return {};
    const newEntries: Record<string, VendorOption[]> = {};
    await Promise.all(
      roleNames.map(async (roleName) => {
        const roleId = allRoles.find(r => r.roleName === roleName)?.roleId;
        if (roleId) {
          try {
            // API returns vendors sorted by its own `rating` field, but the FitIQ %
            // shown everywhere in this screen (recommended label, dropdown "Best
            // Fit" tag, eye-icon breakdown) is computed separately via
            // vendorMatchPercent/vendorRoleScorecard, and boosted vendors (§ Priority
            // Boost) must outrank everyone else regardless of FitIQ %. Re-sort by
            // vendorRankCompare here, once, so the auto-selected default below — and
            // every other "first in the list" spot — always agrees with what's
            // actually displayed as the top/recommended vendor.
            const vendors = [...(await getVendorsByRoleIdsWithDetails([roleId]))]
              .sort((a, b) => vendorRankCompare(a, b, roleName));
            newEntries[roleName] = vendors;
            // Restore confirmed vendor selection from DB. Prefer this role's OWN
            // serviceVendorReview entry (authoritative, per-role) over the flat,
            // claim-wide `confirmedVendors` (vendorServices) intersect below — that
            // intersect just picks the first vendor in THIS role's ranked list that
            // also happens to appear ANYWHERE in the claim's vendor set, which is
            // wrong whenever another role's confirmed vendor also ranks high for
            // this role (e.g. a Supervisor switching this role to A or C kept
            // showing whichever vendor a sibling role had confirmed instead).
            const ownEntry = getServiceVendorEntry(roleName);
            if (ownEntry?.selectedVendor) {
              setRoleVendorMap(prev => ({ ...prev, [roleName]: ownEntry.selectedVendor }));
            } else if (confirmedVendors.length > 0) {
              // Backward-compat fallback for records with no serviceVendorReview entry yet.
              const confirmedVendor = vendors.find(v => confirmedVendors.includes(v.companyName))?.companyName
              if (confirmedVendor && vendors.some(v => v.companyName === confirmedVendor)) {
                setRoleVendorMap(prev => ({ ...prev, [roleName]: confirmedVendor }));
              }
            }
          } catch (err) {
            logError(err, `fetchVendorsForRoles.${roleName}`);
            newEntries[roleName] = [];
          }
        } else {
          newEntries[roleName] = [];
        }
      })
    );
    setRoleToVendorsMap(prev => ({ ...prev, ...newEntries }));
    // Auto-select highest-rated vendor per role (only if not already set by user)
    setRoleVendorMap(prev => {
      const map = { ...prev };
      roleNames.forEach(role => {
        if (!map[role]) {
          map[role] = newEntries[role]?.[0]?.companyName ?? '';
        }
      });
      return map;
    });
    // Returned so a caller that needs the data *this tick* (Confirm
    // Selection, closing the add-then-immediately-confirm race) can read it
    // directly — the setState calls above only take effect on the next
    // render, which a function already mid-execution in this same click
    // will never see via its own roleToVendorsMap/roleVendorMap closures.
    return newEntries;
  };

  // Update on every render so the visibility handler always has the latest
  // allRoles / activeServiceRoles / selectedRecord without needing [] → [deps]
  vendorFetchRef.current = () => {
    if (selectedRecord && activeServiceRoles.length > 0) {
      const confirmed = selectedRecord.vendorServices ?? [];
      fetchVendorsForRoles(activeServiceRoles, confirmed)
        .catch(err => logError(err, 'visibility.fetchVendorsForRoles'));
    }
  };

  useEffect(() => {
    if (selectedRecord) {
      const planStatus = selectedRecord.planServiceStatus ?? '';

      const confirmedNames = selectedRecord.confirmedPlanServiceNames ?? [];
      const latestNames    = selectedRecord.planServiceNames ?? [];
      const newMatches     = latestNames.filter(r => !confirmedNames.includes(r));
      const dbInitial      = [...confirmedNames, ...newMatches];

      // Restore from localStorage if a draft was saved within the last 2 hours
      const draftKey = `claim_roles_${uploadId}_${selectedRecord.recordIndex}`;
      let allActive  = dbInitial;
      if (!draftLoadedRef.current) {
        try {
          const raw = localStorage.getItem(draftKey);
          if (raw) {
            const { roles, ts } = JSON.parse(raw) as { roles: string[]; ts: number };
            if (Date.now() - ts < 7_200_000 && Array.isArray(roles)) {
              // Always keep confirmed roles locked; merge draft on top
              allActive = [...new Set([...confirmedNames,...latestNames, ...roles])];
            }
          }
        } catch { /* ignore malformed draft */ }
        draftLoadedRef.current = true;
      }
      setActiveServiceRoles(allActive);
      const confirmed = selectedRecord.vendorServices ?? [];
      const existingrecord: string[] = [];
      setActiveVendors(confirmed.length > 0 ? confirmed : []);

      // Guard: allRoles may still be loading (detail API often resolves faster than
      // the roles API on a cold start / long-idle remount). Calling fetchVendorsForRoles
      // with an empty allRoles array causes every roleId lookup to return undefined,
      // which sets empty vendor lists and renders "No provider mapped".
      // The dedicated allRoles.length effect below will retry once roles arrive.
      if (!allRoles.length) return;

      // Fetch per-role vendors for all active roles
      if (planStatus === 'Pending Selection' || planStatus === 'Finalized Selection') {
        selectedRecord?.existingplanservices?.forEach(r => {
          if (allRoles?.some((role) => role.roleId === r)) {
            const matchingRoleNames = allRoles?.filter((role) => role.roleId === r).map((role) => role.roleName) ?? [];
            setExistingRoles(matchingRoleNames.map((roleName) => ({ roleName })));
            existingrecord.push(...matchingRoleNames);
          }
        });

        selectedRecord?.existingplanservices?.forEach(r => {
        if (allRoles?.some((role) => role.roleId === r)) {
          setExistingRoles(allRoles?.filter((role) => role.roleId === r).map((role) => ({ roleName: role.roleName })));
        }
      }, [existingRoles]);
              fetchVendorsForRoles(allActive,confirmed).catch(err => logError(err, 'useEffect.fetchVendorsForRoles'));

      }
      fetchVendorsForRoles(allActive,confirmed).catch(err => logError(err, 'useEffect.fetchVendorsForRoles'));
    }
  // Re-run on every navigation (location.key) and whenever record data changes.
  // location.key ensures the effect fires even when the server returns identical
  // primitive values after an idle period, which would otherwise leave the deps
  // unchanged and skip the vendor fetch entirely.
  // confirmedPlanServiceNames is included on its own — not just derived
  // through dbInitial inside the effect — because an intermediate
  // optimistic update (e.g. savePlan's local record patch) can legitimately
  // leave planServiceNames/planServiceStatus already at their FINAL values
  // slightly before confirmedPlanServiceNames catches up on the same
  // patch, or before the follow-up refresh() lands. If confirmedPlanServiceNames
  // isn't its own dependency, the real, corrected data arriving via refresh()
  // can go unnoticed — planServiceNames/planServiceStatus, the only two
  // record fields actually watched, may already match their prior (stale)
  // values, so the effect never re-fires and activeServiceRoles stays stuck
  // on whatever it computed from the earlier, still-inconsistent snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    location.key,
    selectedRecord?.recordIndex,
    selectedRecord?.planServiceStatus,
    (selectedRecord?.planServiceNames ?? []).join(','),
    (selectedRecord?.confirmedPlanServiceNames ?? []).join(','),
  ]);

  // Fallback: fires when allRoles finishes loading AFTER selectedRecord was already set.
  // This covers the race condition where the claim detail API resolves faster than the
  // roles API (common after long idle / cold remount), causing the main effect above to
  // skip the vendor fetch because allRoles was empty. Once allRoles.length > 0 this
  // effect retries with the already-initialised activeServiceRoles state.
  useEffect(() => {
    if (!allRoles.length || !selectedRecord || !activeServiceRoles.length) return;
    const confirmed = selectedRecord.vendorServices ?? [];
    fetchVendorsForRoles(activeServiceRoles, confirmed)
      .catch(err => logError(err, 'allRolesReady.fetchVendors'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRoles.length]);

  // Load DB change log
  const loadDbChangeLog = () => {
    if (uploadId && selectedRecord) {
      getChangeLogEntries(uploadId, selectedRecord.recordIndex)
        .then(data => { setDbChangeLog(data); setChlPage(1); })
        .catch(err => logError(err, 'CID.loadChangeLog'));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDbChangeLog(); }, [uploadId, selectedRecord?.recordIndex]);

  // Supervisor Review (2026-07-23, reverted to staged — was briefly
  // "apply immediately" earlier the same day): every decision (switch/keep
  // a provider, keep/remove an added service) opens SupervisorReviewModal to
  // collect the mandatory comment, but confirming it only stages the
  // decision locally (updates roleVendorMap/activeServiceRoles so the UI
  // reflects it instantly, and records the decision+comment) — nothing is
  // sent to the server, and the claim's status does not change, until the
  // Supervisor clicks the page's single "Confirm Selection" button, same as
  // every other unsaved change on this screen. confirmVendorSelection reads
  // supervisorStagedDecisions when building what to submit. A
  // provider-override service the Supervisor never opens the popup for
  // simply stays Pending Review — no forced decision on it.
  const [pendingSupervisorReview, setPendingSupervisorReview] = useState<PendingSupervisorReview | null>(null);
  const [supervisorReviewComment, setSupervisorReviewComment] = useState('');
  const [supervisorReviewCommentError, setSupervisorReviewCommentError] = useState('');
  const [supervisorStagedDecisions, setSupervisorStagedDecisions] = useState<Record<string, {
    decision: 'Modified' | 'Included' | 'Rejected'; finalVendor?: string; comment: string;
  }>>({});
  const openSupervisorReviewModal = (pending: PendingSupervisorReview) => {
    setPendingSupervisorReview(pending);
    setSupervisorReviewComment('');
    setSupervisorReviewCommentError('');
  };
  const cancelSupervisorReviewDecision = () => {
    setPendingSupervisorReview(null); setSupervisorReviewComment(''); setSupervisorReviewCommentError('');
  };
  const confirmSupervisorReviewDecision = () => {
    if (!supervisorReviewComment.trim()) { setSupervisorReviewCommentError('A comment is required.'); return; }
    if (!pendingSupervisorReview) return;
    const { role, changeType, toVendor, keep } = pendingSupervisorReview;
    const decision: 'Modified' | 'Included' | 'Rejected' = changeType === 'ProviderChange' ? 'Modified' : (keep ? 'Included' : 'Rejected');
    setSupervisorStagedDecisions(prev => ({
      ...prev,
      [role]: { decision, finalVendor: changeType === 'ProviderChange' ? toVendor : undefined, comment: supervisorReviewComment.trim() },
    }));
    // Reflect the decision in the UI immediately, same local-only pattern the
    // Adjuster's own toggle/dropdown already use (confirmToggle/handleVendorDropdownChange).
    if (changeType === 'ProviderChange' && toVendor) {
      setRoleVendorMap(prev => ({ ...prev, [role]: toVendor }));
    }
    if (changeType === 'ServiceAdded') {
      if (keep) {
        // Enabling a role (recommended-but-removed, or a brand new one the
        // Supervisor is adding themselves) — without this, the row's toggle
        // never actually switches on, since staging a decision above only
        // records it; nothing else in this function used to touch
        // activeServiceRoles for the "turn on" direction at all.
        setActiveServiceRoles(prev => prev.includes(role) ? prev : [...prev, role]);
        if (!roleToVendorsMap[role] || roleToVendorsMap[role].length === 0) {
          fetchVendorsForRoles([role], []).catch(err => logError(err, 'confirmSupervisorReviewDecision.fetchVendors'));
        }
      } else {
        setActiveServiceRoles(prev => prev.filter(r => r !== role));
        // Same cleanup the Adjuster's own removal (confirmToggle) already does —
        // without it, this role's stale vendor lingers in roleVendorMap and
        // confirmVendorSelection's vendorsFromMap (which reads ALL of
        // roleVendorMap's values, not filtered by activeServiceRoles) would
        // still send it as a "confirmed" vendor even though the role itself
        // is being rejected.
        setRoleVendorMap(prev => { const n = { ...prev }; delete n[role]; return n; });
      }
    }
    setPendingSupervisorReview(null); setSupervisorReviewComment(''); setSupervisorReviewCommentError('');
  };

  const handleRoleToggle = (role: string) => {
    const isActive = activeServiceRoles.includes(role);
    // A Claims Supervisor's toggle on ANY row — not just one still 'Pending
    // Review' — must go through the staged review popup, never the plain
    // Adjuster reason-modal/confirmToggle path below. supervisorCanToggle
    // (the row-clickable gate) deliberately lets a Supervisor click an
    // already-Locked/Modified/Included/Rejected row too (FRD: "can remove
    // ANY active service"), but confirmToggle persists to the server
    // *immediately* via saveDraftPlanServices — it was written for the
    // Adjuster's own unreviewed plan, where nothing is staged yet. Routing a
    // Supervisor's click on a second, already-resolved row through it broke
    // two things at once: it showed the wrong dialog (a bare "reason for
    // change" box instead of the mandatory-comment Supervisor Review popup),
    // and it computed its new role list from activeServiceRoles as it stood
    // at that click — which, if a DIFFERENT role had already been staged
    // off locally moments earlier via the popup, was already one role short,
    // so this second, unstaged toggle silently persisted a planServices list
    // missing BOTH roles instead of just the one actually being toggled.
    if (isSupervisor) {
      openSupervisorReviewModal({ role, changeType: 'ServiceAdded', keep: !isActive });
      return;
    }
    setPendingToggle({ type:'role', item:role, action:isActive?'remove':'add', previousValue:isActive?role:'—', updatedValue:isActive?'—':role });
    setReasonInput(''); setReasonError('');
  };

  const handleVendorToggle = (vendor: string) => {
    const isActive = activeVendors.includes(vendor);
    setPendingToggle({ type:'vendor', item:vendor, action:isActive?'remove':'add', previousValue:isActive?vendor:'—', updatedValue:isActive?'—':vendor });
    setReasonInput(''); setReasonError('');
  };

  const confirmToggle = async () => {
    if (!reasonInput.trim()) { setReasonError('Reason for change is required.'); return; }
    if (!pendingToggle) return;
    if (pendingToggle.type === 'role') {
      if (pendingToggle.action === 'add') setActiveServiceRoles(p => [...p, pendingToggle.item]);
      else                               setActiveServiceRoles(p => p.filter(r => r !== pendingToggle.item));
    } else {
      if (pendingToggle.action === 'add') setActiveVendors(p => [...p, pendingToggle.item]);
      else                               setActiveVendors(p => p.filter(v => v !== pendingToggle.item));
    }
    // Store change locally
    setLocalChangeLog(p => [...p, {
      id: `${Date.now()}`, timestamp: new Date(),
      type: pendingToggle.type,
      previousValue: pendingToggle.previousValue,
      updatedValue:  pendingToggle.updatedValue,
      reason:        reasonInput.trim(),
    }]);

    // For role changes: save to DB immediately and sync all related display maps
    if (pendingToggle.type === 'role') {
      // Compute the new role list immediately (state update is async)
      const newRoles = pendingToggle.action === 'add'
        ? [...activeServiceRoles, pendingToggle.item]
        : activeServiceRoles.filter(r => r !== pendingToggle.item);

      if (pendingToggle.action === 'add') {
        setRoleReasonMap(prev => ({ ...prev, [pendingToggle.item]: reasonInput.trim() }));
        fetchVendorsForRoles([pendingToggle.item],[]).catch(err => logError(err, 'confirmToggle.fetchVendors'));
      } else {
        setRoleReasonMap(prev => { const n = { ...prev }; delete n[pendingToggle.item]; return n; });
        setRoleVendorMap(prev => { const n = { ...prev }; delete n[pendingToggle.item]; return n; });
        setRoleVendorReasonMap(prev => { const n = { ...prev }; delete n[pendingToggle.item]; return n; });
      }

      if (uploadId && selectedRecord) {
        // Immediately persist current selections to planServices (draft save)
        // ONLY — deliberately no refresh() here. saveDraftPlanServices writes
        // only the `planServices` field, never `confirmedPlanServices` (that
        // only happens on a full Confirm Selection, via savePlanServices).
        // A refresh() right after this draft save re-derives
        // activeServiceRoles from the fresh record as
        // [...confirmedPlanServiceNames, ...newMatches] — since
        // confirmedPlanServiceNames is untouched by this draft save, a role
        // just removed here (but previously part of a prior confirmed
        // selection) would still be in it, silently resurrecting the very
        // role the user just toggled off, right back into
        // activeServiceRoles. The local setActiveServiceRoles() above is
        // already sufficient for the UI; this call exists purely as a
        // session-restore backup, not something that needs to sync back
        // into the page immediately.
        const roleIds = newRoles.map(n => allRoles.find(r => r.roleName === n)?.roleId ?? n);
        saveDraftPlanServices({ uploadId, recordIndex: selectedRecord.recordIndex, planServices: roleIds })
          .catch(err => logError(err, 'confirmToggle.saveDraft'));

        // Audit log entry
        saveChangeLogEntry({
          uploadId, recordIndex: selectedRecord.recordIndex, claimNumber: selectedRecord.claimNumber,
          type: 'role', changedItem: pendingToggle.item,
          previousValue: pendingToggle.previousValue, updatedValue: pendingToggle.updatedValue,
          reason: reasonInput.trim(), updatedBy: user?.fullName || user?.username,
        }).then(() => loadDbChangeLog()).catch(err => logError(err, 'CID.saveRoleChangeLog'));
      }
    }

    setPendingToggle(null); setReasonInput(''); setReasonError('');
  };

  // Helper: look up the reason a user gave for a specific item toggle
  // Called when the user picks a different vendor from the dropdown
  const handleVendorDropdownChange = (roleName: string, roleIdx: number, newVendor: string) => {
    const fromVendor = roleVendorMap[roleName] ?? '';
    if (!fromVendor || fromVendor === newVendor) {
      // First-time selection or same vendor — just update silently
      setRoleVendorMap(prev => ({ ...prev, [roleName]: newVendor }));
      return;
    }
    // Supervisor reviewing a provider override (FRD §5/§6): open the staged
    // review popup instead of the Adjuster-facing reason modal below, for ANY
    // role — not just one still 'Pending Review' — same reasoning as
    // handleRoleToggle above: a Supervisor must never take the
    // immediately-persisted Adjuster path, even on an already-Locked role.
    if (isSupervisor) {
      openSupervisorReviewModal({ role: roleName, changeType: 'ProviderChange', toVendor: newVendor });
      return;
    }
    // Vendor is being changed — require a reason
    setPendingVendorChange({ roleName, roleIdx, fromVendor, toVendor: newVendor });
    setVendorChangeReason('');
    setVendorChangeReasonError('');
  };

  const confirmVendorChange = async () => {
    if (!vendorChangeReason.trim()) { setVendorChangeReasonError('Reason is required.'); return; }
    if (!pendingVendorChange) return;
    const { roleName, fromVendor, toVendor } = pendingVendorChange;

    // Update selection
    setRoleVendorMap(prev => ({ ...prev, [roleName]: toVendor }));
    // Store reason to display below the dropdown
    setRoleVendorReasonMap(prev => ({ ...prev, [roleName]: vendorChangeReason.trim() }));
    // Add to local change log
    setLocalChangeLog(p => [...p, {
      id: `${Date.now()}`, timestamp: new Date(), type: 'vendor',
      previousValue: fromVendor, updatedValue: toVendor,
      reason: vendorChangeReason.trim(),
    }]);
    // Persist to DB immediately
    if (uploadId && selectedRecord) {
      await saveChangeLogEntry({
        uploadId, recordIndex: selectedRecord.recordIndex, claimNumber: selectedRecord.claimNumber,
        type: 'vendor', changedItem: roleName,
        previousValue: fromVendor, updatedValue: toVendor,
        reason: vendorChangeReason.trim(), updatedBy: user?.fullName || user?.username,
      });
      loadDbChangeLog();
    }
    setPendingVendorChange(null); setVendorChangeReason(''); setVendorChangeReasonError('');
  };

  const reasonForItem = (type: 'role'|'vendor', item: string, action: 'add'|'remove') => {
    const entry = [...localChangeLog].reverse().find(
      e => e.type === type && (action === 'remove' ? e.previousValue === item : e.updatedValue === item)
    );
    return entry?.reason ?? (type === 'role' ? 'Plan services confirmed' : 'Vendor selection confirmed');
  };

  // Batch-log every diff between current selections and stored state, then save
  const confirmPlanSelection = async () => {
    if (!uploadId || !selectedRecord || activeServiceRoles.length === 0) return;
    // Diff against previously CONFIRMED (not rule-eval suggestions) so newly
    // eligible roles from a re-upload are logged as "Added", not "Removed"
    const prevConfirmed = selectedRecord.confirmedPlanServiceNames ?? [];
    const added   = activeServiceRoles.filter(r => !prevConfirmed.includes(r));
    const removed = prevConfirmed.filter(r => !activeServiceRoles.includes(r));

    // Combined reason for savePlan comment
    const combinedReason = localChangeLog.length > 0
      ? [...new Set(localChangeLog.filter(e => e.type === 'role').map(e => e.reason))].join('; ')
      : 'Plan services confirmed';

    await savePlan(selectedRecord, activeServiceRoles, combinedReason);
    // Clear draft — confirmed state is now persisted in DB
    if (uploadId && selectedRecord)
      localStorage.removeItem(`claim_roles_${uploadId}_${selectedRecord.recordIndex}`);

    // Persist each add/remove as a separate audit log entry
    if (added.length > 0 || removed.length > 0) {
      const entries = [
        ...removed.map(role => ({
          uploadId, recordIndex: selectedRecord.recordIndex, claimNumber: selectedRecord.claimNumber,
          type: 'role', changedItem: role,
          previousValue: role, updatedValue: '—',
          reason: reasonForItem('role', role, 'remove'), updatedBy: user?.fullName || user?.username,
        })),
        ...added.map(role => ({
          uploadId, recordIndex: selectedRecord.recordIndex, claimNumber: selectedRecord.claimNumber,
          type: 'role', changedItem: role,
          previousValue: '—', updatedValue: role,
          reason: reasonForItem('role', role, 'add'), updatedBy: user?.fullName || user?.username,
        })),
      ];
      await Promise.all(entries.map(e => saveChangeLogEntry(e)));
      setLocalChangeLog(p => p.filter(e => e.type !== 'role'));
      loadDbChangeLog();
    }
    // No refresh() here — this only ever runs as the first half of
    // confirmServiceProviderSelection, which refreshes once at the end. An
    // unawaited refresh() fired here used to race the vendor-save that follows:
    // it reads the DB before the vendor write lands, and if its (slower,
    // heavier uploadedClaimDetails) response arrives after the vendor save's
    // own local update, it silently overwrites the finalized status back to
    // "Pending Selection" — requiring a second click to fix.
  };

  const confirmVendorSelection = async (freshVendorEntries: Record<string, VendorOption[]> = {}) => {
    // Resolve a role's vendor from, in order: the user's own confirmed
    // selection (roleVendorMap), a vendor list this exact click just fetched
    // (freshVendorEntries — see confirmServiceProviderSelection's
    // race-closing pre-fetch), or the closure's own roleToVendorsMap/
    // getRecommendedVendor as a last resort. All three can independently be
    // stale/empty right after a role is toggled on and confirmed quickly, so
    // this only returns '' if genuinely nothing is available anywhere.
    const resolveVendor = (role: string): string =>
      roleVendorMap[role] || freshVendorEntries[role]?.[0]?.companyName || getRecommendedVendor(role);
    // Collect vendors from per-role map, deduplicated — plus every currently
    // active role's resolved vendor, so one just-added via the race above is
    // never missing from the claim's overall vendorServices list either.
    const vendorsFromMap = [...new Set([
      ...Object.values(roleVendorMap).filter(Boolean),
      ...activeServiceRoles.map(resolveVendor).filter(Boolean),
    ])];
    if (!uploadId || !selectedRecord || vendorsFromMap.length === 0) return;
    const activeVendorsFinal = vendorsFromMap;
    const storedVendors = selectedRecord.vendorServices ?? [];
    const added   = activeVendorsFinal.filter(v => !storedVendors.includes(v));
    const removed = storedVendors.filter(v => !activeVendorsFinal.includes(v));

    const combinedReason = localChangeLog.length > 0
      ? [...new Set(localChangeLog.filter(e => e.type === 'vendor').map(e => e.reason))].join('; ')
      : 'Vendor selection confirmed';

    // What the Supervisor sees as "Adjuster Comments" on Pending Review is not a
    // separate free-typed field — it's the same mandatory "Reason for Change"
    // text the Adjuster already had to enter for every role/vendor change in
    // this submission (localChangeLog, both types — role toggles and provider
    // switches). Empty when nothing was actually changed (a plain re-confirm),
    // which correctly falls back to "No comments provided." for the Supervisor.
    const adjusterSubmissionReason = [...new Set(localChangeLog.map(e => e.reason))].join('; ');

    // Pending Review is evaluated per service, not for the entire claim (FR-001..FR-004).
    // Only (re)compute/send entries for roles that aren't already reviewed-and-done —
    // a Locked/Modified/Included role's dropdown is disabled so its vendor can't have
    // changed, and skipping it here is what lets the backend merge (not overwrite)
    // per-service state safely.
    const confirmedBy = user?.fullName || user?.username || '';
    const isAdjuster = isAdjusterTypeRole(user?.roleName);
    // selectedRecord.planServiceNames gets polluted the moment ANY role is
    // toggled this session — handleRoleToggle's confirmToggle() calls
    // saveDraftPlanServices() immediately per toggle, which overwrites
    // planServices (and therefore planServiceNames on the next refresh) with
    // the CURRENT active set, manually-added roles included. initialPlanNames
    // is captured once per record load, before any toggle this session can
    // touch it (union of confirmedPlanServiceNames + planServiceNames as they
    // stood at load), so it stays a true "recommended at session start"
    // baseline — regardless of role toggles that happen afterward.
    const recommendedRoleNames = new Set([
      ...(selectedRecord.confirmedPlanServiceNames ?? []),
      ...initialPlanNames,
    ]);
    const serviceVendorReview: ServiceVendorReview[] = activeServiceRoles
      // A role already Locked/Modified/Included is normally done and skipped
      // here (the backend preserves it unless explicitly overwritten) — but
      // if the Supervisor just staged a NEW decision on it via the now-open
      // dropdown (FRD §6: Supervisor authority isn't bounded by a service's
      // current status), it must still go through, or the staged change is
      // silently dropped from the payload entirely.
      .filter(role => !isServiceLockedStatus(getServiceStatus(role)) || supervisorStagedDecisions[role])
      .map(role => {
        // See resolveVendor above — never silently drop this role from the
        // review payload just because roleVendorMap/roleToVendorsMap hadn't
        // caught up yet (the add-then-immediately-confirm race).
        const selectedVendor = resolveVendor(role);
        if (!selectedVendor) return null;
        const confirmedAt = new Date().toISOString();
        // Two independent Pending Review triggers (FRD §2/§3): a service the
        // Adjuster added that wasn't recommended at all, regardless of vendor;
        // or a recommended service whose provider was overridden.
        if (isAdjuster && !recommendedRoleNames.has(role)) {
          return {
            roleName: role, changeType: 'ServiceAdded', recommendedVendor: '',
            proposedVendor: selectedVendor, selectedVendor,
            status: 'Pending Review', confirmedBy, confirmedAt,
            // The mandatory "Reason for Change" text this role's own toggle
            // popup collected — roleReasonMap is keyed by role name, set in
            // confirmToggle when this exact role was switched on.
            ...(roleReasonMap[role] ? { adjusterComment: roleReasonMap[role] } : {}),
          } as ServiceVendorReview;
        }
        // Same race as resolveVendor above: fall back to this click's own
        // fresh fetch before the closure's possibly-stale roleToVendorsMap.
        const recommendedVendor = freshVendorEntries[role]?.[0]?.companyName || getRecommendedVendor(role);
        // Two cases the branches below were never written for: a staged
        // decision on an already-resolved (Locked/Modified/Included) role
        // (Supervisor edited its provider directly), and a staged decision
        // on a role with no serviceVendorReview entry at all yet —
        // 'Unconfirmed' — the Supervisor enabling a role themselves rather
        // than reviewing one the Adjuster already touched. Neither case was
        // "still Pending Review", so build the entry straight from the
        // staged decision instead of falling through to the generic
        // catch-all below, which would silently discard the decision/
        // comment and mislabel the status 'Locked'.
        const lockedStatusStaged = supervisorStagedDecisions[role];
        if (!isAdjuster && lockedStatusStaged && getServiceStatus(role) !== 'Pending Review') {
          const existingEntry = getServiceVendorEntry(role);
          const entryChangeType = existingEntry?.changeType ?? (recommendedRoleNames.has(role) ? 'ProviderChange' : 'ServiceAdded');
          return {
            roleName: role, changeType: entryChangeType,
            recommendedVendor: entryChangeType === 'ServiceAdded' ? '' : recommendedVendor,
            proposedVendor: selectedVendor, selectedVendor: lockedStatusStaged.finalVendor ?? selectedVendor,
            status: lockedStatusStaged.decision,
            confirmedBy: existingEntry?.confirmedBy || confirmedBy, confirmedAt: existingEntry?.confirmedAt || confirmedAt,
            reviewedBy: confirmedBy, reviewedAt: confirmedAt,
            ...(lockedStatusStaged.comment ? { supervisorComment: lockedStatusStaged.comment } : {}),
            // Never overwritten by a Supervisor's own review — the Adjuster's
            // original reason for this service stays visible regardless of
            // what decision the Supervisor makes on it.
            ...(existingEntry?.adjusterComment ? { adjusterComment: existingEntry.adjusterComment } : {}),
          } as ServiceVendorReview;
        }
        // A Supervisor's Confirm Selection accepts an untouched Pending
        // Review role as-is — the claim shouldn't stay stuck in Pending
        // Review just because the Supervisor didn't explicitly act on it.
        // A "Service Added" role that WAS deselected is already resolved
        // (Rejected, and no longer in activeServiceRoles) by the time this
        // runs, via its own toggle popup — so any Pending Review
        // "Service Added" role reaching here is, by definition, untouched
        // and still active, i.e. accepted → Included. A provider-override
        // role reaching here → Modified, same as an explicit switch.
        if (!isAdjuster && getServiceStatus(role) === 'Pending Review') {
          const existingEntry = getServiceVendorEntry(role);
          const entryChangeType = existingEntry?.changeType ?? 'ProviderChange';
          // Preserve the original Adjuster's confirmedBy/confirmedAt — this
          // entry is being replaced wholesale (not merged), and confirmedBy
          // is what getSupervisorReviewedClaims scopes "this Adjuster's
          // claims" by. Using the current (Supervisor) user here would
          // silently drop the item off the Adjuster's Supervisor Comments
          // page the moment it's accepted as-is.
          const originalConfirmedBy = existingEntry?.confirmedBy || confirmedBy;
          const originalConfirmedAt = existingEntry?.confirmedAt || confirmedAt;
          // reviewedBy/reviewedAt record the current (Supervisor) user and
          // moment — confirmedBy/confirmedAt above stay the original
          // Adjuster's, so "Reviewed by" on this page and the Supervisor
          // Comments page shows the Supervisor, not a blank dash.
          // A role the Supervisor explicitly staged a decision for (via the
          // popup) uses that decision's final vendor/comment; an untouched
          // role reaching here (Supervisor never opened the popup for it)
          // falls through to the silent-accept default below.
          const staged = supervisorStagedDecisions[role];
          return entryChangeType === 'ServiceAdded'
            ? {
                roleName: role, changeType: 'ServiceAdded', recommendedVendor: '',
                proposedVendor: selectedVendor, selectedVendor: staged?.finalVendor ?? selectedVendor,
                status: staged?.decision ?? 'Included', confirmedBy: originalConfirmedBy, confirmedAt: originalConfirmedAt,
                reviewedBy: confirmedBy, reviewedAt: confirmedAt,
                ...(staged?.comment ? { supervisorComment: staged.comment } : {}),
                ...(existingEntry?.adjusterComment ? { adjusterComment: existingEntry.adjusterComment } : {}),
              } as ServiceVendorReview
            : {
                roleName: role, changeType: 'ProviderChange', recommendedVendor,
                proposedVendor: selectedVendor, selectedVendor: staged?.finalVendor ?? selectedVendor,
                status: staged?.decision ?? 'Modified', confirmedBy: originalConfirmedBy, confirmedAt: originalConfirmedAt,
                reviewedBy: confirmedBy, reviewedAt: confirmedAt,
                ...(staged?.comment ? { supervisorComment: staged.comment } : {}),
                ...(existingEntry?.adjusterComment ? { adjusterComment: existingEntry.adjusterComment } : {}),
              } as ServiceVendorReview;
        }
        const isOverridden = isAdjuster && !!recommendedVendor && recommendedVendor !== selectedVendor;
        const priorEntry = getServiceVendorEntry(role);
        return {
          roleName: role, changeType: 'ProviderChange', recommendedVendor,
          proposedVendor: selectedVendor, selectedVendor,
          status: isOverridden ? 'Pending Review' : 'Locked',
          confirmedBy, confirmedAt,
          // The reason given in this role's own vendor-switch popup
          // (roleVendorReasonMap) when overridden; otherwise carry forward
          // whatever this role's prior entry already had, if any.
          ...(isOverridden
            ? (roleVendorReasonMap[role] ? { adjusterComment: roleVendorReasonMap[role] } : {})
            : (priorEntry?.adjusterComment ? { adjusterComment: priorEntry.adjusterComment } : {})),
        } as ServiceVendorReview;
      })
      .filter((e): e is ServiceVendorReview => e !== null);

    // A staged Rejected decision (Supervisor toggled a "Service Added" role
    // off) already removed the role from activeServiceRoles when it was
    // staged, so the map above never visits it — add its entry separately
    // here so saveVendorServices' merge-by-roleName actually flips its
    // status to Rejected server-side (otherwise it would stay "Pending
    // Review" forever, since nothing else ever revisits a role that's no
    // longer active).
    const stagedRejectedEntries: ServiceVendorReview[] = Object.entries(supervisorStagedDecisions)
      .filter(([role, staged]) => staged.decision === 'Rejected' && !activeServiceRoles.includes(role))
      .map(([role, staged]) => {
        const existingEntry = getServiceVendorEntry(role);
        const confirmedAt = new Date().toISOString();
        return {
          roleName: role, changeType: existingEntry?.changeType ?? 'ServiceAdded', recommendedVendor: '',
          proposedVendor: existingEntry?.proposedVendor || existingEntry?.selectedVendor || '',
          selectedVendor: existingEntry?.selectedVendor || '',
          status: 'Rejected',
          confirmedBy: existingEntry?.confirmedBy || confirmedBy, confirmedAt: existingEntry?.confirmedAt || confirmedAt,
          reviewedBy: confirmedBy, reviewedAt: confirmedAt,
          supervisorComment: staged.comment,
          ...(existingEntry?.adjusterComment ? { adjusterComment: existingEntry.adjusterComment } : {}),
        } as ServiceVendorReview;
      });

    await saveVendors(
      selectedRecord, activeVendorsFinal, combinedReason, [...serviceVendorReview, ...stagedRejectedEntries],
      isAdjuster ? { comments: adjusterSubmissionReason, submittedBy: confirmedBy } : undefined,
    );
    if (Object.keys(supervisorStagedDecisions).length > 0) setSupervisorStagedDecisions({});

    // Persist each add/remove as a separate audit log entry
    const entries = [
      ...removed.map(vendor => ({
        uploadId, recordIndex: selectedRecord.recordIndex, claimNumber: selectedRecord.claimNumber,
        type: 'vendor', changedItem: vendor,
        previousValue: vendor, updatedValue: '—',
        reason: reasonForItem('vendor', vendor, 'remove'), updatedBy: user?.fullName || user?.username,
      })),
      ...added.map(vendor => ({
        uploadId, recordIndex: selectedRecord.recordIndex, claimNumber: selectedRecord.claimNumber,
        type: 'vendor', changedItem: vendor,
        previousValue: '—', updatedValue: vendor,
        reason: reasonForItem('vendor', vendor, 'add'), updatedBy: user?.fullName || user?.username,
      })),
    ];
    if (entries.length > 0) {
      await Promise.all(entries.map(e => saveChangeLogEntry(e)));
      setLocalChangeLog(p => p.filter(e => e.type !== 'vendor'));
      loadDbChangeLog();
    }
  };

  // Single combined action: confirms plan services and service provider (vendor)
  // selections together in one click, so the claim goes straight to
  // 'Finalized Selection' without a separate intermediate confirmation step.
  // Guarded by confirmingSelection (see declaration above) so this can only
  // ever be running once at a time per review cycle — a second call while
  // one is already in flight is a no-op, not a duplicate submission.
  const confirmServiceProviderSelection = async () => {
    if (confirmingSelection) return;
    setConfirmingSelection(true);
    try {
      // Close the add-then-immediately-confirm race at its source: a role
      // toggled active moments ago may still have no roleToVendorsMap entry
      // (the background fetch fired by confirmToggle is never awaited) —
      // wait for exactly those roles here, and thread the freshly-fetched
      // data straight into confirmVendorSelection. setRoleVendorMap/
      // setRoleToVendorsMap from that fetch wouldn't be visible to this
      // same click's closures until a re-render, which won't happen mid-
      // function, so passing the fetch's own return value is the only way
      // this click can actually see it in time.
      const missingVendorRoles = activeServiceRoles.filter(
        role => !roleToVendorsMap[role] || roleToVendorsMap[role].length === 0
      );
      const freshVendorEntries = missingVendorRoles.length > 0
        ? await fetchVendorsForRoles(missingVendorRoles, selectedRecord?.vendorServices ?? [])
        : {};
      await confirmPlanSelection();
      await confirmVendorSelection(freshVendorEntries);
      // Single refresh, after both saves have landed, so the server snapshot
      // can only reflect the final ('Finalized Selection' / 'Pending
      // Review') state — never the transient 'Pending Service Provider
      // Selection' state in between.
      await refresh();
    } finally {
      setConfirmingSelection(false);
    }
  };

  // Claims Supervisor review: each decision (switch/keep a provider, keep/
  // remove an added service) is staged locally the moment the popup's
  // comment is confirmed (see supervisorStagedDecisions above) and only
  // submitted when the page's "Confirm Selection" button is clicked. A
  // provider-override service the Supervisor never touches simply stays
  // Pending Review — nothing forces a decision on it (the Supervisor can
  // still Complete the claim regardless).

  // ── Derived ────────────────────────────────────────────────────────────────
  // isClaimCompleted stays live (not removed) — it still gates read-only/
  // locked rendering for any claim already marked Completed prior to the
  // "Completed" status being retired from this screen's action set (see
  // claimIntakeMaster/index.tsx, which excludes Completed claims from the
  // list/kanban entirely). There is just no longer any UI action on this
  // page that can set it.
  const isClaimCompleted  = selectedRecord?.isCompleted === true || selectedRecord?.planServiceStatus === 'Completed';
  const isPlanConfirmed   = isClaimCompleted || selectedRecord?.planServiceStatus === 'Pending Selection' || selectedRecord?.planServiceStatus === 'Finalized Selection' || selectedRecord?.planServiceStatus === 'Finalized Selection';
  const isVendorConfirmed = isClaimCompleted || selectedRecord?.planServiceStatus === 'Finalized Selection';
  // Vendor Override Approval Workflow: a vendor override by an adjuster-type role
  // holds the claim here until a Claims Supervisor completes it (FR-002/FR-004).
  const isPendingReview = selectedRecord?.planServiceStatus === 'Pending Review';
  const isSupervisor    = user?.roleName === 'Claims Supervisor';
  // Role-Based Status Display: while a claim is awaiting Supervisor approval
  // (one or more overridden services), the whole claim is read-only for
  // adjuster-type roles — not just the overridden service — until a
  // Claims Supervisor approves/completes it. Supervisors are unaffected.
  const isReadOnlyForAdjuster = isPendingReview && !isSupervisor;
  // Pending Review is evaluated per service, not for the entire claim (FR-001..FR-004) —
  // Confirm stays enabled as long as some active service hasn't been confirmed yet,
  // regardless of whether another service is already Locked or Pending Review.
  // For a Supervisor, an untouched provider-override Pending Review role also
  // counts — clicking Confirm Selection silently accepts it as-is (Locked),
  // since there's nothing to review if they're fine with the Adjuster's pick.
  const hasUnconfirmedServices = activeServiceRoles.some(role => {
    const status = getServiceStatus(role);
    if (status === 'Unconfirmed') return true;
    // A Supervisor's Confirm Selection also resolves an untouched Pending
    // Review "Service Added" role (accepted → Included), not just a
    // provider-override one (accepted → Modified) — see confirmVendorSelection.
    if (isSupervisor && status === 'Pending Review') return true;
    return false;
  })
    // A staged Rejected decision already removed its role from
    // activeServiceRoles, so the check above alone would miss it — without
    // this, the Confirm Selection button could disappear while a staged
    // rejection is still waiting to be submitted.
    || Object.keys(supervisorStagedDecisions).length > 0;
  hasUnconfirmedRef.current = hasUnconfirmedServices;

  // Only compare the non-confirmed (user-modifiable) portion of activeServiceRoles
  const hasPendingPlanChanges = (() => {
    const confirmed   = new Set(selectedRecord?.confirmedPlanServiceNames ?? []);
    const latestNew   = (selectedRecord?.planServiceNames ?? []).filter(r => !confirmed.has(r));
    const currentNew  = activeServiceRoles.filter(r => !confirmed.has(r));
    if (currentNew.length !== latestNew.length) return true;
    return currentNew.some(r => !latestNew.includes(r)) || latestNew.some(r => !currentNew.includes(r));
  })();

  // Show the single "Confirm Service Provider Selection" action until vendor selection
  // is finalized, or again if the user modifies services/vendors after finalizing, or
  // if some active service still has no per-service review entry at all yet.
  const showConfirmButton = !isVendorConfirmed || hasPendingPlanChanges || hasUnconfirmedServices;
// "Previously Selected" card: confirmed selections (fallback to planServiceNames for old records)
  const confirmedPlanServices =
    [...new Set(localRecords.flatMap(r => {
      const confirmed = r.confirmedPlanServiceNames ?? [];
      // Fallback for records confirmed before confirmedPlanServiceNames field was added
      return confirmed.length > 0 ? confirmed : (r.planServiceStatus === 'Pending Selection' || r.planServiceStatus === 'Finalized Selection' ? (r.planServiceNames ?? []) : []);
    }))].filter(Boolean);
  const confirmedVendors      = [...new Set(localRecords.flatMap(r=>r.vendorServices??[]))].filter(Boolean);
  // Audit Trail pagination
  const chlTotalPages  = Math.max(1, Math.ceil(dbChangeLog.length / CHL_PAGE_SIZE));
  const chlSafePage    = Math.min(chlPage, chlTotalPages);
  const chlPageEntries = dbChangeLog.slice((chlSafePage - 1) * CHL_PAGE_SIZE, chlSafePage * CHL_PAGE_SIZE);
  const primaryRecord = selectedRecord ?? localRecords[0];
  const fileName = `claim-records-${uploadId??'export'}`;

  return (
    <AppShell>
      <div className="cid-ref-page">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="cid-ref-header">
          <div className="cid-ref-header__top">
            <div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:3}}>
                <h1 className="cid-ref-header__name">{selectedClaimNumber || selectedRecord?.claimNumber || detail?.fileName || 'Claim Details'}</h1>
                {detail?.status && <span className={`badge ${uploadStatusBadgeCls(detail.status)}`}>Claim Update</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isClaimCompleted && (
                <span className="badge badge-blue" style={{ padding: '7px 14px', fontWeight: 600 }}>
                  ✓ Completed
                </span>
              )}
              <button type="button" className="cid-ref-back" onClick={() => navigate('/claim-intake')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back to queue
              </button>
            </div>
          </div>

        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <>
            <div className="cid-ref-body">

              {/* LEFT: main content — sized to fit its content; page scrolls naturally into Audit Trail below.
                  No overflow style here: setting overflow-x alone (even to 'hidden') makes browsers compute
                  overflow-y as 'auto', which would clip the absolutely-positioned vendor dropdown list. */}
              <div className="cid-ref-main">

                {(psError || vsError || error) && (
                  <div className="alert alert--error" role="alert" style={{margin:'0 0 14px'}}>{psError||vsError||error}</div>
                )}
                {(loading || rolesLoading || vendorsLoading) && (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 0', gap:12 }}>
                    <span className="vi-spinner" style={{ width:28, height:28, borderWidth:3, borderTopColor:'var(--color-primary)' }} role="status" aria-label="Loading" />
                    <span style={{ fontSize:'var(--text-sm)', color:'var(--color-text-muted)' }}>Loading claim data…</span>
                  </div>
                )}

                
                {/* Claim Snapshot */}
                {!(loading || rolesLoading || vendorsLoading) && snapshotRecords.map(record => (
                  <div className="cid-snapshot" key={record.recordIndex}>
                    <div className="cid-snapshot__header">
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                        <div><div className="cid-snapshot__title">Claim Snapshot</div><div className="cid-snapshot__sub">Pull data from the claim record — read-only</div></div>
                        <span className={planStatusBadgeCls(record.planServiceStatus)}>{record.planServiceStatus||'Pending Selection'}</span>
                      </div>
                    </div>
                    <div className="cid-snapshot__body">
                      <div className="cid-snapshot__fields">
                        {[{label:'Claim Number',value:record.claimNumber},{label:'Insured Name',value:record.insuredName},{label:'Policy Number',value:record.policyNumber},{label:'Loss Date',value:record.lossDate},{label:'Reported Date',value:record.reportedDate},{label:'Claim Amount',value:record.claimAmount},{label:'Claim Status',value:record.claimStatus}].map(({label,value})=>(
                          <div key={label}><div className="cid-snapshot__field-label">{label}</div><div className="cid-snapshot__field-value">{value||'—'}</div></div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {/* AI Claim Summary */}
                {!(loading || rolesLoading || vendorsLoading) && selectedRecord && (
                  <div className="cid-ai-summary">
                    <div className="cid-ai-summary__header">
                      <span className="cid-ai-summary__title">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                        Q-AI Insights
                      </span>
                      <span className="cid-ai-summary__ai-badge">AI</span>
                    </div>

                    <div className="cid-ai-summary__body">
                      {/* ── SUMMARY ── */}
                      <div className="cid-ai-sum__section-label">CLAIMS SUMMARY</div>
                      <ul className="cid-ai-sum-section__list">
                        {claimSummaryData.items.map((item, i) => (
                          <li key={i} className="cid-ai-sum-section__item">
                            <span className="cid-ai-sum-section__text">{item.text}</span>
                            <div className="cid-ai-eye-wrap">
                              <button
                                type="button"
                                className="cid-ai-eye-btn"
                                onMouseEnter={() => setActivePopup({ section: 'summary', idx: i })}
                                onMouseLeave={() => setActivePopup(null)}
                                aria-label="View source"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                </svg>
                              </button>
                              {activePopup?.section === 'summary' && activePopup.idx === i && (
                                <div className="cid-ai-eye-popup">
                                  <div className="cid-ai-eye-popup__row"><span className="cid-ai-eye-popup__label">SOURCE</span><span className="cid-ai-eye-popup__val">{item.popup.source}</span></div>
                                  <div className="cid-ai-eye-popup__row"><span className="cid-ai-eye-popup__label">FIELD(S)</span><span className="cid-ai-eye-popup__val">{item.popup.comparedAgainst}</span></div>
                                  <div className="cid-ai-eye-popup__row"><span className="cid-ai-eye-popup__label">FETCHED</span><span className="cid-ai-eye-popup__val">{item.popup.fetched}</span></div>
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>

                      {/* ── SIGNALS ── */}
                      <div className="cid-ai-sum__section-label" style={{ marginTop: 14 }}>SIGNALS</div>
                      <ul className="cid-ai-sum-section__list cid-ai-signals">
                        {selectedRecord && (
                          <li className="cid-ai-sum-section__item cid-ai-signal">
                            <span className="cid-ai-signal__text">
                              {isoClaimSearchData
                                ? (() => {
                                    const totalMatches = isoClaimSearchData.flags.reduce((n, c) => n + c.matches.length, 0);
                                    const headings = isoClaimSearchData.flags
                                      .map(f => f.flagHeading.replace(/\b\w/g, c => c.toUpperCase()))
                                      .join(' + ');
                                    return `${totalMatches} matching claim${totalMatches === 1 ? '' : 's'} — ${headings}`;
                                  })()
                                : 'No ISO ClaimSearch matches found'}
                            </span>
                            <span className={`cid-ai-signal__badge ${isoClaimSearchData ? 'cid-ai-signal__badge--iso' : 'cid-ai-signal__badge--iso-clear'}`}>
                              {isoClaimSearchData ? 'ISO Flags' : 'ISO Clear'}
                            </span>
                            <div className="cid-ai-eye-wrap">
                              <button
                                type="button"
                                className="cid-ai-eye-btn"
                                onMouseEnter={e => openIsoFlyout(e.currentTarget)}
                                onMouseLeave={() => scheduleIsoHide()}
                                aria-label="View ISO ClaimSearch details"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                </svg>
                              </button>
                            </div>
                          </li>
                        )}
                        {claimSummaryData.signals.map((sig, i) => (
                          <li key={i} className="cid-ai-sum-section__item cid-ai-signal">
                            <span className="cid-ai-signal__text">{sig.text}</span>
                            <span className={`cid-ai-signal__badge cid-ai-signal__badge--${sig.variant}`}>{sig.badge}</span>
                            <div className="cid-ai-eye-wrap">
                              <button
                                type="button"
                                className="cid-ai-eye-btn"
                                onMouseEnter={() => setActivePopup({ section: 'signal', idx: i })}
                                onMouseLeave={() => setActivePopup(null)}
                                aria-label="View source"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                </svg>
                              </button>
                              {activePopup?.section === 'signal' && activePopup.idx === i && (
                                <div className="cid-ai-eye-popup">
                                  <div className="cid-ai-eye-popup__row"><span className="cid-ai-eye-popup__label">SOURCE</span><span className="cid-ai-eye-popup__val">{sig.popup.source}</span></div>
                                  <div className="cid-ai-eye-popup__row"><span className="cid-ai-eye-popup__label">FIELD(S)</span><span className="cid-ai-eye-popup__val">{sig.popup.comparedAgainst}</span></div>
                                  <div className="cid-ai-eye-popup__row"><span className="cid-ai-eye-popup__label">FETCHED</span><span className="cid-ai-eye-popup__val">{sig.popup.fetched}</span></div>
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>

                      {/* ── QAI INTELLIGENCE ── */}
                      {(selectedRecord.planServiceNames ?? []).length > 0 && (() => {
                        const QAI_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f97316','#22c55e','#6366f1','#ec4899','#0ea5e9'];
                        const svcCards = (selectedRecord.planServiceNames ?? []).map((svcName, i) => {
                          const roleIdx = allRoles.findIndex(r => r.roleName === svcName);
                          const role    = roleIdx >= 0 ? allRoles[roleIdx] : undefined;
                          return {
                            svcName,
                            svcNum:      roleIdx >= 0 ? `S-${String(roleIdx + 1).padStart(2, '0')}` : `S-${String(i + 1).padStart(2, '0')}`,
                            explanation: role?.nlpConditionInWords || role?.nlpCondition || '',
                            color:       QAI_COLORS[i % QAI_COLORS.length],
                          };
                        });
                        return (
                          <>
                            <div className="cid-ai-sum__section-label" style={{ marginTop: 14 }}>Services Enabled</div>
                            <ul className="cid-ai-sum-section__list">
                              {svcCards.map(({ svcName, svcNum, explanation, color }, i) => (
                                <li key={i} className="cid-ai-sum-section__item cid-ai-sum-section__item--no-bullet" style={{ alignItems: 'flex-start' }}>
                                  <span className="cid-ai-sum-section__text">
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#111827' }}>
                                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.68rem', color: '#94a3b8' }}>{svcNum}</span>
                                      {svcName}
                                    </span>
                                    {explanation && <div style={{ marginTop: 2, color }}>{explanation}</div>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Add Services & Vendors */}
                {!(loading || rolesLoading || vendorsLoading) && (allRoleNames.length > 0 || (isPlanConfirmed && allVendorNamesList.length > 0)) && (
                  <div className="cid-vendors-card">
                    <div className="cid-vendors-card__header">
                      <div>
                        <div className="cid-vendors-card__title">Select Services &amp; Service Providers</div>
                        <div className="cid-vendors-card__sub">Suggested plan based on rule evaluation — toggle to modify, reason required for changes</div>
                      </div>
                      <span className="cid-vendors-card__active">{activeServiceRoles.length} / {allRoleNames.length} active</span>
                    </div>
                    <div className="cid-vendors-body">

                      {/* Service Request Roles — three categories: Selected / Active / Suggested */}
                      {allRoleNames.length > 0 && (
                        <>
                          <div className="cid-vendor-group-label">Service Request Rules</div>
                          <div className="cid-vendor-items-grid">
                            {allRoleNames.map((role, idx) => {
                              const isActive           = activeServiceRoles.includes(role);
                              const isConfirmedLocked  = (selectedRecord?.confirmedPlanServiceNames ?? []).includes(role);
                              const isNewMatch         = (selectedRecord?.planServiceNames ?? []).includes(role) && !isConfirmedLocked;
                              // Category labels
                              const categoryLabel = isConfirmedLocked ? 'SELECTED' : isNewMatch ? 'ACTIVE' : (isActive ? 'ACTIVE' : 'SUGGESTED');
                              const isSuggested = !isActive && !isConfirmedLocked;
                              const selectedVendor = roleVendorMap[role] ?? '';
                              const vendorsForRole = selectedRecord?.planServiceStatus === 'Finalized Selection' ?true:false;
                              const disableplanChange = existingRoles?.some((existingRole) => existingRole.roleName === role);
                              // Supervisor Review (FRD §4): light-highlight any service still
                              // awaiting this Supervisor's decision, so it stands out from
                              // unchanged services on the same claim.
                              const needsReview = isSupervisor && getServiceStatus(role) === 'Pending Review';
                              // A Supervisor can toggle a Pending-Review "Service Added" role
                              // off/back-on regardless of disableplanChange/vendorsForRole — those
                              // guards exist to freeze an Adjuster's already-confirmed plan, not to
                              // block the Supervisor's own review decision on a role awaiting it.
                              const adjusterCanToggle = !isClaimCompleted && !vendorsForRole && !disableplanChange && canOverrideService && !isReadOnlyForAdjuster;
                              // 2026-07-23: reversed from "a Supervisor can remove ANY active
                              // service, even after Finalized Selection" — the claim's service
                              // selection and provider choices must be fully locked the moment
                              // Confirm Selection succeeds and the status reaches 'Finalized
                              // Selection', for every role including the Claims Supervisor.
                              // Before Finalized Selection (e.g. while a role is still Pending
                              // Review, or the claim hasn't been confirmed at all yet) a
                              // Supervisor can still toggle any row regardless of
                              // disableplanChange/canOverrideService — those two guards exist to
                              // freeze the ADJUSTER's own already-submitted plan, not the
                              // Supervisor's separate review authority — vendorsForRole
                              // (true once planServiceStatus === 'Finalized Selection') is the
                              // one guard that now applies to both roles equally.
                              const supervisorCanToggle = isSupervisor && !isClaimCompleted && !vendorsForRole && !isReadOnlyForAdjuster;
                              const rowClickable = needsReview || adjusterCanToggle || supervisorCanToggle;
                              return (
                                <div key={role}
                                  className={`cid-vendor-item${
                                    needsReview
                                      ? ' cid-vendor-item--needs-review'
                                      : (isConfirmedLocked)
                                      ? ' cid-vendor-item--selected'   // confirmed/locked — own styling
                                      : isActive
                                        ? ' cid-vendor-item--active'   // newly eligible active
                                        : ''                            // suggested / inactive
                                  }`}
                                  style={{ cursor: 'default' }}>

                                  {/* Role header row */}
                                  <div className="cid-vendor-item__row"
                                    onClick={() => rowClickable && handleRoleToggle(role)}
                                    style={{ cursor: rowClickable ? 'pointer' : 'default' }}>
                                    <span className="cid-vendor-item__num">S-{String(idx + 1).padStart(2, '0')}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div className="cid-vendor-item__name">{role}</div>
                                      </div>
                                    {!rowClickable ? (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                                      </svg>
                                    ) : (
                                      <span className={`cid-vendor-toggle${isActive ? ' cid-vendor-toggle--on' : ''}`}>
                                        <span className="cid-vendor-toggle__track" />
                                      </span>
                                    )}
                                  </div>

                                  {/* Reason label — shown below active role card after a change */}
                                  
                                  {/* Vendor sub-section — shown for any active service, selected together with services in one stretch */}
                                  {isActive && (
                                    <div className="cid-vendor-sub" onClick={e => e.stopPropagation()}>
                                      {/* Recommended vendor — first vendor mapped to this specific role */}
                                      {(() => {
                                        // Boosted vendors first, then by matching % desc — see vendorRankCompare.
                                        // The FitIQ % itself is never altered by boost, so it always agrees
                                        // with the Provider Scoreboard's score for the same vendor+role.
                                        const mappedVendors = [...(roleToVendorsMap[role] ?? [])]
                                          .sort((a, b) => vendorRankCompare(a, b, role));
                                        const serviceStatus = getServiceStatus(role);
                                        const reviewEntry   = getServiceVendorEntry(role);
                                        // Per-service, not claim-wide (FR-001..FR-004): a service reads
                                        // "Confirmed" once ITS OWN vendor is Locked/Modified/Included,
                                        // independent of siblings.
                                        const isConfirmed   = isServiceLockedStatus(serviceStatus) || isClaimCompleted;
                                        const recommended   = isConfirmed
                                          ? (mappedVendors.find((map) => map.companyName === selectedVendor) ?? mappedVendors[0])
                                          : mappedVendors[0];
                                        // Adjusters can no longer touch a Locked or Pending Review service.
                                        // Once the claim itself is awaiting Supervisor approval, an adjuster
                                        // can't edit ANY service on it — even one still 'Unconfirmed'.
                                        // A Supervisor's authority is not bounded by a service's status —
                                        // Pending Review only flags which items need review, it doesn't
                                        // limit what else can be edited (FRD §6) — so every enabled service's
                                        // dropdown, including an already-Locked/Modified/Included one, stays
                                        // open to the Supervisor until vendorsForRole (Finalized Selection)
                                        // freezes the whole screen, mirroring supervisorCanToggle above.
                                        const dropdownEditable = isReadOnlyForAdjuster
                                          ? false
                                          : isSupervisor
                                            ? !vendorsForRole
                                            : serviceStatus === 'Unconfirmed';
                                        return (
                                          <>
                                            <div className="cid-vendor-sub__recommended">
                                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                                                <polyline points="9 22 9 12 15 12 15 22"/>
                                              </svg>
                                              <span className="cid-vendor-sub__label">{isConfirmed ? 'Confirmed Service Provider:' : 'Recommended Service Provider:'}</span>
                                              <span className="cid-vendor-sub__name">
                                                {recommended
                                                  ? `${recommended.companyName}${!hideVendorRating ? ` (FitIQ: ${vendorMatchPercent(recommended.companyName, role)}%)` : ''}`
                                                  : 'No provider mapped'}
                                              </span>
                                            </div>
                                            {serviceStatus === 'Pending Review' && reviewEntry && (
                                              <>
                                                {reviewEntry.changeType === 'ServiceAdded' ? (
                                                  <div className="cid-vendor-sub__recommended" style={{ gap: 6 }}>
                                                    <span className="badge badge-orange">Pending Review</span>
                                                    <span className="badge badge-blue">Added</span>
                                                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                                                      by {reviewEntry.confirmedBy} — not originally recommended
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <>
                                                    <div className="cid-vendor-sub__recommended">
                                                      <span className="cid-vendor-sub__label">Selected Service Provider:</span>
                                                      <span className="cid-vendor-sub__name">{roleVendorMap[role] || reviewEntry.selectedVendor}</span>
                                                    </div>
                                                    <div className="cid-vendor-sub__recommended" style={{ gap: 6 }}>
                                                      <span className="badge badge-orange">Pending Review</span>
                                                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                                                        Overridden by {reviewEntry.confirmedBy}
                                                      </span>
                                                    </div>
                                                  </>
                                                )}
                                                {reviewEntry.adjusterComment && (
                                                  <div className="cid-vendor-sub__recommended" style={{ alignItems: 'flex-start' }}>
                                                    <span className="cid-vendor-sub__label">Adjuster Comment:</span>
                                                    <span className="cid-vendor-sub__name" style={{ fontWeight: 400, whiteSpace: 'pre-wrap' }}>{reviewEntry.adjusterComment}</span>
                                                  </div>
                                                )}
                                              </>
                                            )}
                                           
                                            {/* Dropdown — vendors sorted by matching % desc, card-style */}
                                            {mappedVendors.length > 0 && canOverrideProvider && !isClaimCompleted && dropdownEditable ? (
                                              <>
                                                <span className="cid-vendor-sub__label cid-vendor-sub__label--alt">Alternate Service Provider</span>
                                                <div className="cid-vdrop">
                                                {/* Transparent backdrop closes dropdown on outside click */}
                                                {openVendorDropdown === role && (
                                                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => { setOpenVendorDropdown(null); setScorePopup(null); }} />
                                                )}
                                                {/* Trigger button */}
                                                <button
                                                  type="button"
                                                  className="cid-vdrop__trigger"
                                                  onClick={() => {
                                                    if (openVendorDropdown === role) setScorePopup(null);
                                                    setOpenVendorDropdown(p => p === role ? null : role);
                                                  }}
                                                >
                                                  <span className="cid-vdrop__trigger-name">
                                                    {selectedVendor || '— Select Vendor —'}
                                                  </span>
                                                  {!hideVendorRating && selectedVendor && (() => {
                                                    const sv = mappedVendors.find(x => x.companyName === selectedVendor);
                                                    if (!sv) return null;
                                                    return (
                                                      <span className="cid-vdrop__trigger-rating">{vendorMatchPercent(sv.companyName, role)}% FitIQ</span>
                                                    );
                                                  })()}
                                                  <svg
                                                    className={`cid-vdrop__chevron${openVendorDropdown === role ? ' cid-vdrop__chevron--open' : ''}`}
                                                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                                                    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="6 9 12 15 18 9"/>
                                                  </svg>
                                                </button>
                                                {/* Dropdown list + score breakdown popup */}
                                                {openVendorDropdown === role && (
                                                  <>
                                                    <div className="cid-vdrop__list">
                                                      {/* Recommended vendors first (top 3 by rating), then any additional */}
                                                      {[...mappedVendors.slice(0, 3), ...mappedVendors.slice(3)].map((v, vi) => {
                                                        const isSel         = v.companyName === selectedVendor;
                                                        const isRecommended = vi < 3;
                                                        const fitLabel      = vi === 0 ? 'Best Fit' : isRecommended ? `Fit #${vi + 1}` : null;
                                                        const fitBg         = vi === 0 ? '#dcfce7' : '#dbeafe';
                                                        const fitClr        = vi === 0 ? '#15803d' : '#1d4ed8';
                                                        const isPopupOpen   = scorePopup?.role === role && scorePopup?.vendorName === v.companyName;
                                                        return (
                                                          <div
                                                            key={v.companyName}
                                                            className={`cid-vdrop__item${isSel ? ' cid-vdrop__item--selected' : ''}`}
                                                            onClick={() => { handleVendorDropdownChange(role, idx, v.companyName); setOpenVendorDropdown(null); setScorePopup(null); }}
                                                          >
                                                            <div className="cid-vdrop__item-left">
                                                              {isSel ? (
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                                  <polyline points="20 6 9 17 4 12"/>
                                                                </svg>
                                                              ) : <span style={{ width: 13, display: 'inline-block', flexShrink: 0 }} />}
                                                              <span className="cid-vdrop__item-name">{v.companyName}</span>
                                                            </div>
                                                            <div className="cid-vdrop__item-right">
                                                              {!hideVendorRating && (
                                                                <span className="cid-vdrop__item-rating">{vendorMatchPercent(v.companyName, role)}% FitIQ</span>
                                                              )}
                                                              {!hideVendorRating && (
                                                              <button
                                                                type="button"
                                                                className="cid-vdrop__eye"
                                                                style={isPopupOpen ? { background: '#eff6ff', color: '#2563eb' } : undefined}
                                                                onClick={e => e.stopPropagation()}
                                                                onMouseEnter={e => {
                                                                  e.stopPropagation();
                                                                  cancelPopupHide();
                                                                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                                  const popupW = 340, popupH = 340;
                                                                  const x = r.right + popupW + 8 > window.innerWidth  ? r.left - popupW - 8 : r.right + 8;
                                                                  const y = r.top  + popupH + 8 > window.innerHeight ? window.innerHeight - popupH - 8 : r.top;
                                                                  setScorePopup({ role, vendorName: v.companyName, rating: vendorRoleScorecard(v.companyName, role).aggregate, x, y });
                                                                }}
                                                                onMouseLeave={() => schedulePopupHide()}
                                                                title="View FitIQ breakdown"
                                                              >
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                                                </svg>
                                                              </button>
                                                              )}
                                                              {fitLabel && (
                                                                <span className="cid-vdrop__fit" style={{ background: fitBg, color: fitClr }}>{fitLabel}</span>
                                                              )}
                                                            </div>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                    {/* Service provider matching breakdown popup — rendered via portal into document.body so transforms on ancestors cannot shift it */}
                                                    {scorePopup?.role === role && (() => {
                                                      // Same canonical breakdown used for the vendor's FitIQ % (and the
                                                      // Provider Scoreboard / View Performance rating) — weights always
                                                      // sum to 100. Contribution is rescaled x20 here (0–5 → 0–100) so it
                                                      // also sums to 100, matching this screen's percentage-based FitIQ.
                                                      const { kpis } = vendorRoleScorecard(scorePopup.vendorName, scorePopup.role);
                                                      const displayKpis = kpis.map((k) => ({ ...k, contribution: k.contribution !== null ? k.contribution * 20 : null }));
                                                      return createPortal(
                                                        <div
                                                          onClick={e => e.stopPropagation()}
                                                          onMouseEnter={() => cancelPopupHide()}
                                                          onMouseLeave={() => schedulePopupHide()}
                                                          style={{
                                                            position: 'fixed',
                                                            top: scorePopup.y,
                                                            left: scorePopup.x,
                                                            width: 340,
                                                            background: '#fff',
                                                            border: '1px solid #e5e7eb',
                                                            borderRadius: 8,
                                                            boxShadow: '0 6px 20px rgba(0,0,0,0.14)',
                                                            zIndex: 9999,
                                                            overflow: 'hidden',
                                                          }}
                                                        >
                                                          <div style={{ padding: '7px 12px 5px', borderBottom: '1px solid #f3f4f6' }}>
                                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', color: '#9ca3af', textTransform: 'uppercase', marginBottom: 1 }}>
                                                              Service Provider FitIQ
                                                            </div>
                                                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                              {scorePopup.vendorName}
                                                            </div>
                                                          </div>
                                                          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                                            <colgroup>
                                                              <col style={{ width: '44%' }} />
                                                              <col style={{ width: '12%' }} />
                                                              <col style={{ width: '13%' }} />
                                                              <col style={{ width: '31%' }} />
                                                            </colgroup>
                                                            <thead>
                                                              <tr style={{ background: '#f9fafb' }}>
                                                                {(['Category', 'Wt', 'Score', 'Contribution'] as const).map(col => (
                                                                  <th key={col} style={{ padding: '3px 8px', textAlign: col === 'Category' ? 'left' : 'right', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', color: '#6b7280', textTransform: 'uppercase', overflow: 'hidden' }}>{col}</th>
                                                                ))}
                                                              </tr>
                                                            </thead>
                                                            <tbody>
                                                              {displayKpis.map((kpi, ki) => (
                                                                <tr key={ki} style={{ borderTop: '1px solid #f3f4f6' }}>
                                                                  <td style={{ padding: '3px 8px', fontSize: '0.68rem', color: '#374151', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}>{kpi.name}</td>
                                                                  <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: '0.68rem', color: '#6b7280' }}>{kpi.weight !== null ? `${kpi.weight}%` : '–'}</td>
                                                                  <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: '0.68rem', color: '#111827', fontWeight: 600 }}>{kpi.score !== null ? kpi.score.toFixed(1) : '–'}</td>
                                                                  <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: '0.68rem', color: '#111827', fontWeight: 600 }}>{kpi.contribution !== null ? kpi.contribution.toFixed(2) : '–'}</td>
                                                                </tr>
                                                              ))}
                                                              <tr style={{ borderTop: '1px solid #d1d5db', background: '#f9fafb' }}>
                                                                <td style={{ padding: '4px 8px', fontSize: '0.68rem', fontWeight: 700, color: '#111827' }}>FitIQ</td>
                                                                <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '0.68rem', color: '#9ca3af' }}>—</td>
                                                                <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '0.68rem', color: '#9ca3af' }}>—</td>
                                                                <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, color: '#15803d' }}>
                                                                  {Math.round(scorePopup.rating * 20)}%
                                                                </td>
                                                              </tr>
                                                            </tbody>
                                                          </table>
                                                          <div style={{ padding: '4px 8px', background: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
                                                            <span style={{ fontSize: '0.58rem', color: '#9ca3af' }}>
                                                              {kpis.length} KPI categories · Platform KPI DB · {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </span>
                                                          </div>
                                                        </div>,
                                                        document.body
                                                      );
                                                    })()}
                                                  </>
                                                )}
                                              </div>
                                              </>
                                            ) : (
                                              <div />
                                            )}
                                          </>
                                        );
                                      })()}

                                      {/* Reason displayed below dropdown after a vendor switch */}
                                      </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}

                    </div>
                  </div>
                )}

                {/* Action bar — inside main column. Single "Confirm Selection" action,
                    shared by Adjuster and Supervisor profiles — this is the ONLY point
                    at which anything (plan/vendor changes, and the Supervisor's own
                    staged per-service decisions from SupervisorReviewModal) is actually
                    submitted and the claim's status can change. Clickable whenever
                    there's something to submit (no "already confirmed" disabling
                    while genuinely unconfirmed work remains — showConfirmButton
                    itself already hides the button entirely once there's nothing
                    left) — but locked for the full duration of a submission
                    (confirmingSelection) so it can't be double-clicked/re-triggered
                    mid-cycle. */}
                <div className="cid-action-bar">
                  {!isClaimCompleted && !isReadOnlyForAdjuster && showConfirmButton && (
                    <button type="button" className="btn btn--accept"
                      disabled={activeServiceRoles.length===0 || Object.values(roleVendorMap).filter(Boolean).length===0 || confirmingSelection}
                      onClick={confirmServiceProviderSelection}>
                      {confirmingSelection ? 'Saving…' : 'Confirm Selection'}
                    </button>
                  )}
                  {!isClaimCompleted && isVendorConfirmed && !hasPendingPlanChanges && (
                    <span className="badge badge-coral" style={{padding:'6px 14px',fontSize:'var(--text-sm)'}}>✓ Finalized Selection</span>
                  )}
                  {isClaimCompleted && (
                    <span className="badge badge-blue" style={{padding:'6px 14px',fontSize:'var(--text-sm)'}}>✓ Claim Completed</span>
                  )}
                </div>

              </div>

            {/* Change History Log — Audit Trail card */}
            <div style={{ padding: '20px 0px 32px' }}>
              <div className="chl-card">

                {/* Header */}
                <div className="chl-card__header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    <span className="chl-card__title">Audit Trail</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {dbChangeLog.length > 0 && <span className="chl-card__count">{dbChangeLog.length}</span>}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={loadDbChangeLog} title="Refresh">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Timeline entries */}
                <div className="chl-card__body">
                  {dbChangeLog.length === 0 ? (
                    <div style={{ padding: '20px 18px' }}>
                      <p className="cid-log-item__empty">No change history yet. Modifications will appear here once you confirm changes.</p>
                    </div>
                  ) : chlPageEntries.map((entry, idx) => {
                    const isRole    = entry.type === 'role';
                    const action    = entry.previousValue === '—' ? 'Added' : entry.updatedValue === '—' ? 'Removed' : 'Updated';
                    const formatted = entry.updatedAt
                      ? new Date(entry.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—';
                    return (
                      <div key={entry.id || idx}
                        className={`chl-entry${idx < chlPageEntries.length - 1 ? ' chl-entry--bordered' : ''}`}>
                        <div className={`chl-entry__accent${isRole ? '' : ' chl-entry__accent--vendor'}`} />
                        <div className="chl-entry__content">
                          <div className="chl-entry__row">
                            <span className={`chl-entry__type${isRole ? '' : ' chl-entry__type--vendor'}`}>
                              {isRole ? 'ROLE' : 'VENDOR'}
                            </span>
                            <span className="chl-entry__title">{entry.changedItem} {action}</span>
                          </div>
                          <div className="chl-entry__body">
                            <span className="chl-entry__val chl-entry__val--from" title={entry.previousValue}>{entry.previousValue}</span>
                            <span className="chl-entry__arrow">→</span>
                            <span className="chl-entry__val chl-entry__val--to" title={entry.updatedValue}>{entry.updatedValue}</span>
                          </div>
                          {entry.reason && <div className="chl-entry__reason">"{entry.reason}"</div>}
                          <div className="chl-entry__footer">{formatted} · {entry.updatedBy || 'admin'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {chlTotalPages > 1 && (
                  <div className="chl-pagination">
                    <button type="button" className="chl-pg-btn" disabled={chlSafePage <= 1}
                      onClick={() => setChlPage(p => Math.max(1, p - 1))}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                      Prev
                    </button>
                    <div className="chl-pg-numbers">
                      {Array.from({ length: chlTotalPages }, (_, i) => i + 1).map(pg => {
                        const show = pg === 1 || pg === chlTotalPages || Math.abs(pg - chlSafePage) <= 1;
                        if (!show) {
                          const prevPg = pg - 1;
                          if (prevPg >= 1 && Math.abs(prevPg - chlSafePage) > 1 && prevPg !== 1)
                            return <span key={`e${pg}`} className="chl-pg-ellipsis">…</span>;
                          return null;
                        }
                        return (
                          <button key={pg} type="button"
                            className={`chl-pg-btn chl-pg-btn--num${chlSafePage === pg ? ' chl-pg-btn--active' : ''}`}
                            onClick={() => setChlPage(pg)}>{pg}</button>
                        );
                      })}
                    </div>
                    <button type="button" className="chl-pg-btn" disabled={chlSafePage >= chlTotalPages}
                      onClick={() => setChlPage(p => Math.min(chlTotalPages, p + 1))}>
                      Next
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    <span className="chl-pg-info">
                      {(chlSafePage - 1) * CHL_PAGE_SIZE + 1}–{Math.min(chlSafePage * CHL_PAGE_SIZE, dbChangeLog.length)} of {dbChangeLog.length}
                    </span>
                  </div>
                )}

              </div>
            </div>
            </div>
          </>

      </div>

      <ReasonModal pending={pendingToggle} value={reasonInput} error={reasonError} onChange={setReasonInput} onConfirm={confirmToggle} onCancel={()=>{setPendingToggle(null);setReasonInput('');setReasonError('');}}/>
      <VendorSwitchModal
        pending={pendingVendorChange}
        reason={vendorChangeReason} error={vendorChangeReasonError}
        onChange={setVendorChangeReason}
        onConfirm={confirmVendorChange}
        onCancel={() => { setPendingVendorChange(null); setVendorChangeReason(''); setVendorChangeReasonError(''); }}
      />
      <SupervisorReviewModal
        pending={pendingSupervisorReview}
        fromVendor={pendingSupervisorReview ? (roleVendorMap[pendingSupervisorReview.role] ?? '') : ''}
        comment={supervisorReviewComment} error={supervisorReviewCommentError}
        onChange={setSupervisorReviewComment}
        onConfirm={confirmSupervisorReviewDecision}
        onCancel={cancelSupervisorReviewDecision}
      />
      {(vsError||psError) && <div className="alert alert--error" style={{position:'fixed',bottom:20,right:20,zIndex:600,maxWidth:340}}>{vsError||psError}</div>}
      {isoFlyout && selectedRecord && (
        <IsoClaimSearchFlyout
          data={isoClaimSearchData}
          claimantName={selectedRecord.insuredName?.trim() || 'The claimant'}
          claimNumber={selectedRecord.claimNumber ?? ''}
          policyNumber={selectedRecord.policyNumber?.trim() || '—'}
          claimStatus={selectedRecord.claimStatus?.trim() || '—'}
          jurisdiction={selectedRecord.jurisdiction?.trim() || '—'}
          triggerRect={isoFlyout}
          onClose={() => setIsoFlyout(null)}
          onEnter={cancelIsoHide}
          onLeave={scheduleIsoHide}
        />
      )}

    </AppShell>
  );
};

export default ClaimIntakeDetails;