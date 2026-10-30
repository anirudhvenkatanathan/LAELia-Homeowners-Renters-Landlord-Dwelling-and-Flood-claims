import React, { useState, useMemo } from 'react';

import AppShell from '../../../components/layout/AppShell';
import DateRangePicker from '../../../components/dashboard/DateRangePicker';
import SpecificDatePicker from '../../../components/dashboard/SpecificDatePicker';
import { useAuth } from '../../../context/AuthContext';
import { useSupervisorReviewedClaims } from '../../../hooks/claimIntakeMaster/useSupervisorReviewedClaims';
import type { SupervisorReviewedClaim } from '../../../models/claimIntakeMaster/claimIntakeModel';
import { DATE_RANGE_OPTIONS } from '../../../models/dashboard/executiveOverviewModel';
import type { DateRangeValue } from '../../../models/dashboard/executiveOverviewModel';

/** Supervisor Comments' own Date Range values — adds "All" on top of the shared dashboard options. */
type SupervisorDateRangeValue = 'all' | DateRangeValue;

const SUPERVISOR_DATE_RANGE_OPTIONS: { label: string; value: SupervisorDateRangeValue }[] = [
  { label: 'All', value: 'all' },
  ...DATE_RANGE_OPTIONS,
];

const DEFAULT_SUPERVISOR_DATE_RANGE: SupervisorDateRangeValue = 'all';

const TONE: Record<string, { badge: string }> = {
  Modified: { badge: 'badge-orange' },
  Included: { badge: 'badge-blue' },
  Rejected: { badge: 'badge-red' },
};

/** Whether `iso` falls within the selected date range, measured back from now. */
function isWithinDateRange(iso: string, range: SupervisorDateRangeValue): boolean {
  if (range === 'all') return true;
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();

  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startOfToday = startOfDay(now);

  switch (range) {
    case 'today': {
      return d >= startOfToday;
    }
    case 'this-week': {
      const dow = now.getDay(); // 0 = Sunday
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - dow);
      return d >= startOfWeek;
    }
    case 'this-month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= startOfMonth;
    }
    case 'this-quarter': {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const startOfQuarter = new Date(now.getFullYear(), quarterStartMonth, 1);
      return d >= startOfQuarter;
    }
    case 'this-year': {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return d >= startOfYear;
    }
    default:
      return true;
  }
}

/** Whether `iso` falls on the given local calendar date ('YYYY-MM-DD'). */
function isOnSpecificDate(iso: string, dateIso: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}` === dateIso;
}

function formatReviewedAt(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function countsFor(claim: SupervisorReviewedClaim): Record<string, number> {
  const counts: Record<string, number> = { Modified: 0, Included: 0, Rejected: 0 };
  claim.items.forEach(i => { counts[i.finalBadge] = (counts[i.finalBadge] ?? 0) + 1; });
  return counts;
}

const ClockIcon: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const ArrowIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

const QuoteIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
  </svg>
);

const FilterIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const SupervisorComments: React.FC = () => {
  const { user } = useAuth();
  const { claims, loading, error } = useSupervisorReviewedClaims(user?.fullName || user?.username);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState<SupervisorDateRangeValue>(DEFAULT_SUPERVISOR_DATE_RANGE);
  // A specific calendar date, picked via the popover — takes precedence over
  // `dateRange` when set. Picking a `dateRange` option again clears it, so
  // the two controls never silently fight over which one is "active".
  const [specificDate, setSpecificDate] = useState<string | null>(null);
  const [statusPill, setStatusPill] = useState<'all' | 'Rejected' | 'Included' | 'Modified'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClaims = useMemo(() => claims.filter(claim => {
    if (specificDate ? !isOnSpecificDate(claim.lastReviewedAt, specificDate) : !isWithinDateRange(claim.lastReviewedAt, dateRange)) return false;
    if (statusPill !== 'all' && !claim.items.some(i => i.finalBadge === statusPill)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (!claim.claimNumber.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [claims, dateRange, specificDate, statusPill, searchQuery]);

  const selected: SupervisorReviewedClaim | null = useMemo(() => {
    if (filteredClaims.length === 0) return null;
    return filteredClaims.find(c => `${c.uploadId}-${c.recordIndex}` === selectedKey) ?? filteredClaims[0];
  }, [filteredClaims, selectedKey]);

  return (
    <AppShell>
      <div className="page-card">
        <div className="page-header csc-header" style={{ paddingBottom: 20 }}>
          <div>
            <h1 className="page-title">Authority Reviewer Comments</h1>
            <p className="page-subtitle">Meaningful Supervisor changes on claims where you submitted an override</p>
          </div>
          {!loading && claims.length > 0 && (
            <span className="csc-header__count">{filteredClaims.length} claim{filteredClaims.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {!loading && claims.length > 0 && (
          <>
            <div className="kpi-filter-bar" style={{ padding: '16px 28px' }}>
              <span className="kpi-filter-bar__label"><FilterIcon />Date Range:</span>
              <DateRangePicker
                value={dateRange}
                onChange={(next) => { setDateRange(next); setSpecificDate(null); }}
                options={SUPERVISOR_DATE_RANGE_OPTIONS}
              />
              <SpecificDatePicker value={specificDate} onChange={setSpecificDate} />
            </div>

            <div className="dash-section" style={{ padding: '18px 28px 22px' }}>
              <div className="vs-toolbar" style={{ marginBottom: 0 }}>
                <div className="vs-filter-pills" role="group" aria-label="Filter by status" style={{ margin: 0 }}>
                  <button type="button" className={`vs-filter-pill${statusPill === 'all' ? ' vs-filter-pill--active' : ''}`}
                    onClick={() => setStatusPill('all')} aria-pressed={statusPill === 'all'}>
                    All Claims
                  </button>
                  <button type="button" className={`vs-filter-pill${statusPill === 'Included' ? ' vs-filter-pill--active' : ''}`}
                    onClick={() => setStatusPill('Included')} aria-pressed={statusPill === 'Included'}>
                    Service Included
                  </button>
                  <button type="button" className={`vs-filter-pill${statusPill === 'Rejected' ? ' vs-filter-pill--active' : ''}`}
                    onClick={() => setStatusPill('Rejected')} aria-pressed={statusPill === 'Rejected'}>
                    Service Rejected
                  </button>
                  <button type="button" className={`vs-filter-pill${statusPill === 'Modified' ? ' vs-filter-pill--active' : ''}`}
                    onClick={() => setStatusPill('Modified')} aria-pressed={statusPill === 'Modified'}>
                    Provider Modified
                  </button>
                </div>

                <div className="cim-search-bar" role="search" style={{ marginLeft: 'auto', flex: 1, minWidth: 200, maxWidth: 420 }}>
                  <span className="cim-search-bar__icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="cim-search-bar__input"
                    placeholder="Search by claim number"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search by claim number"
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')}
                      style={{ color: 'var(--color-text-light)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="section-block">
          {error && <div className="alert alert--error" role="alert" style={{ margin: '0 20px 14px' }}>{error}</div>}

          {loading ? (
            <div className="detail-loading" style={{ padding: 24 }}><p className="text-sm-muted">Loading…</p></div>
          ) : claims.length === 0 ? (
            <div className="csc-empty">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <p className="csc-empty__title">No Supervisor reviews yet</p>
              <p className="csc-empty__sub">Once a Claims Supervisor reviews an override you submitted, it will show up here.</p>
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="csc-empty">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <p className="csc-empty__title">No claims match your filters</p>
              <p className="csc-empty__sub">Try a wider date range or clearing your filters.</p>
            </div>
          ) : (
            <div className="csc-body">
              <div className="csc-list" role="listbox" aria-label="Commented claims">
                {filteredClaims.map(claim => {
                  const key = `${claim.uploadId}-${claim.recordIndex}`;
                  const counts = countsFor(claim);
                  const isActive = selected ? `${selected.uploadId}-${selected.recordIndex}` === key : false;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`csc-list__row${isActive ? ' csc-list__row--active' : ''}`}
                      onClick={() => setSelectedKey(key)}
                    >
                      <span className="csc-list__claim-number">{claim.claimNumber || '—'}</span>
                      <span className="csc-list__sub">{claim.claimType || '—'}</span>
                      <span className="csc-list__badges">
                        {counts.Rejected > 0 && <span className="badge badge-red">{counts.Rejected} Rejected</span>}
                        {counts.Included > 0 && <span className="badge badge-blue">{counts.Included} Included</span>}
                        {counts.Modified > 0 && <span className="badge badge-orange">{counts.Modified} Modified</span>}
                      </span>
                      <span className="csc-list__date"><ClockIcon /> Reviewed {formatReviewedAt(claim.lastReviewedAt)}</span>
                    </button>
                  );
                })}
              </div>

              <div className="csc-detail">
                {selected && (
                  <div className="csc-detail__section">
                    <div className="csc-detail__header">
                      <h2 className="csc-detail__claim-number">{selected.claimNumber || 'Claim'}</h2>
                      <span className="csc-detail__sub">{selected.insuredName || '—'} · {selected.claimType || '—'}</span>
                    </div>
                    <div className="csc-detail__items">
                      {selected.items.map((item, idx) => {
                        const tone = TONE[item.finalBadge] ?? TONE.Modified;
                        return (
                          <div key={`${item.roleName}-${idx}`} className="csc-item">
                            <div className="csc-item__top">
                              <div className="csc-item__heading">
                                <span className="csc-item__type">{item.displayChangeType}</span>
                                <span className="csc-item__role">{item.roleName}</span>
                              </div>
                              <span className={`badge ${tone.badge}`}>{item.finalBadge}</span>
                            </div>
                            <div className="csc-item__values">
                              <span className="csc-item__value">{item.originalValue}</span>
                              <span className="csc-item__arrow"><ArrowIcon /></span>
                              <span className="csc-item__value csc-item__value--final">{item.finalValue}</span>
                            </div>
                            {item.supervisorComment && (
                              <div className="csc-item__comment">
                                <span className="csc-item__comment-icon"><QuoteIcon /></span>
                                <span>{item.supervisorComment}</span>
                              </div>
                            )}
                            <div className="csc-item__meta">
                              <span className="csc-item__avatar">{initials(item.reviewedBy || '?')}</span>
                              <span>Reviewed by <strong>{item.reviewedBy || '—'}</strong> · {formatReviewedAt(item.reviewedAt)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default SupervisorComments;
