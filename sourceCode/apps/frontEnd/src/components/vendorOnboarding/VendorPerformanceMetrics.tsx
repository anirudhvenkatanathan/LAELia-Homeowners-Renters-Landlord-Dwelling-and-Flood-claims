import React, { useState, useEffect, useCallback } from 'react';
import { fetchKpiMetricsForClaim } from '../../services/claimIntakeMaster/claimIntakeService';
import type { KpiGroup } from '../../models/kpiMetrics/kpiMetricsModel';
import { vendorRoleScorecard } from '../../utils/kpiScoring';

// Shared performance view — used by both the admin "Provider Scoreboard
// → View Performance" screen (VendorOnboardingDetails, Metrics tab)
// and the active vendor's own "My Performance" screen, so any future change
// to this view lands in both places at once instead of drifting apart.

// ─── Chart helpers ──────────────────────────────────────────────────────────

const KPI_MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getKpiMonthLabels(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return `${KPI_MONTH_NAMES[d.getMonth()]} '${d.getFullYear().toString().slice(2)}`;
  });
}

// Deterministic hash + seeded PRNG so each metric's trend shape is stable across
// re-renders (same metric always draws the same bars) but distinct from every
// other metric's shape — unlike a fixed factor sequence applied to every metric.
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// seedKey should be something that varies per metric (e.g. its name) so two
// metrics that happen to share a value still draw different-looking trends.
function kpiTrendPoints(rawValue: string | number | null | undefined, seedKey: string): number[] {
  let num = Number(rawValue);
  if (isNaN(num) || !isFinite(num)) {
    const match = String(rawValue ?? '').match(/\d+(?:\.\d+)?/);
    num = match ? Number(match[0]) : NaN;
  }
  if (isNaN(num) || !isFinite(num)) return [];

  const base = Math.abs(num) || 100;
  const rand = mulberry32(hashSeed(`${seedKey}::${num}`));
  const POINTS = 7;
  const points: number[] = [];
  for (let i = 0; i < POINTS; i++) {
    // Both the swing size and its direction are drawn from this metric's own
    // seed, so the rise/fall shape differs from every other metric's chart.
    const spread = 0.1 + rand() * 0.3;
    const delta  = (rand() - 0.5) * 2 * spread;
    points.push(Math.max(0, Math.round((num + base * delta) * 100) / 100));
  }
  points[POINTS - 1] = Math.round(num * 100) / 100; // anchor the final point to the actual current value
  return points;
}

// ─── Inline trend chart ───────────────────────────────────────────────────────

const KpiMiniGraph: React.FC<{ rawValue: string | number | null | undefined; seedKey: string }> = ({ rawValue, seedKey }) => {
  const uid = React.useId();
  const pts = kpiTrendPoints(rawValue, seedKey);
  if (!pts.length) return <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>No data</span>;

  const labels = getKpiMonthLabels(pts.length);
  const N = pts.length;

  const W = 300, H = 185;
  // MT/MR carry extra headroom (beyond the plotted data padding) so the highest
  // point's label and the widest point's label always stay inside the viewBox
  // instead of being clipped at the top/right edge.
  const ML = 44, MR = 26, MT = 28, MB = 40;
  const CW = W - ML - MR;
  const CH = H - MT - MB;

  const rawMin = Math.min(...pts);
  const rawMax = Math.max(...pts);
  const pad = (rawMax - rawMin) * 0.2 || Math.abs(rawMin) * 0.1 || 5;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;
  const yRange = yMax - yMin || 1;

  const Y_TICKS = 5;
  const yTicks = Array.from({ length: Y_TICKS }, (_, i) => yMin + (i / (Y_TICKS - 1)) * yRange);

  const toX = (i: number) => ML + (N > 1 ? i / (N - 1) : 0.5) * CW;
  const toY = (v: number) => MT + CH - ((v - yMin) / yRange) * CH;
  const fmt = (v: number) => v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1);

  const polyPoints = pts.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const gradId = `kpiInlineGrad${uid.replace(/:/g, '')}`;

  return (
    <div className="kpi-trend-inline">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minWidth: W }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A7BD5" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#3A7BD5" stopOpacity={0} />
          </linearGradient>
        </defs>

        {yTicks.map((v, i) => (
          <line key={`hg${i}`} x1={ML} y1={toY(v).toFixed(1)} x2={ML + CW} y2={toY(v).toFixed(1)}
            stroke="rgba(15,23,42,0.08)" strokeWidth={1} />
        ))}
        {pts.map((_, i) => (
          <line key={`vg${i}`} x1={toX(i).toFixed(1)} y1={MT} x2={toX(i).toFixed(1)} y2={MT + CH}
            stroke="rgba(15,23,42,0.06)" strokeWidth={1} strokeDasharray="3 3" />
        ))}

        <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#94a3b8" strokeWidth={1.5} />
        <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="#94a3b8" strokeWidth={1.5} />

        {yTicks.map((v, i) => (
          <text key={`yt${i}`} x={ML - 6} y={(toY(v) + 4).toFixed(1)}
            textAnchor="end" fontSize={8} fill="#334155"
            stroke="#fff" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke">{fmt(v)}</text>
        ))}
        {labels.map((l, i) => (
          <text key={`xl${i}`} x={toX(i).toFixed(1)} y={MT + CH + 13}
            textAnchor="middle" fontSize={7} fill="#334155"
            transform={`rotate(-35,${toX(i).toFixed(1)},${MT + CH + 13})`}>{l}</text>
        ))}

        <polygon
          points={`${toX(0).toFixed(1)},${(MT + CH).toFixed(1)} ${polyPoints} ${toX(N - 1).toFixed(1)},${(MT + CH).toFixed(1)}`}
          fill={`url(#${gradId})`} />
        <polyline points={polyPoints} fill="none" stroke="#2C61AA" strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round" />

        {pts.map((v, i) => {
          const cx = toX(i), cy = toY(v);
          const isLast = i === N - 1;
          const isFirst = i === 0;
          // Edge points anchor outward from the point instead of centering, so a
          // wide label never extends past the left/right edge of the viewBox;
          // the label's Y is clamped so it can never sit above the plot's top edge.
          const labelAnchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
          const labelX = isFirst ? cx + 4 : isLast ? cx - 4 : cx;
          const labelY = Math.max(MT - 12, cy - 9);
          return (
            <g key={`dp${i}`}>
              <text x={labelX.toFixed(1)} y={labelY.toFixed(1)} textAnchor={labelAnchor} fontSize={8} fontWeight={700} fill="#334155"
                stroke="#fff" strokeWidth={3.5} strokeLinejoin="round" paintOrder="stroke">
                {fmt(v)}
              </text>
              <circle
                cx={cx.toFixed(1)} cy={cy.toFixed(1)}
                r={isLast ? 5 : 3.5}
                fill={isLast ? '#2C61AA' : '#3A7BD5'}
                stroke="#f8fafc"
                strokeWidth={1.5}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export interface VendorPerformanceMetricsProps {
  companyName:    string;
  qualifiedRoles: { roleId: string; roleName: string }[];
}

export const VendorPerformanceMetrics: React.FC<VendorPerformanceMetricsProps> = ({ companyName, qualifiedRoles }) => {
  const [kpiGroups,          setKpiGroups]          = useState<KpiGroup[]>([]);
  const [kpiLoading,         setKpiLoading]         = useState(false);
  const [kpiError,           setKpiError]           = useState<string | null>(null);
  const [collapsedServices,  setCollapsedServices]  = useState<Set<string>>(new Set());
  const [expandedScoreRoles, setExpandedScoreRoles] = useState<Set<string>>(new Set());
  const [expandedKpiGroups,  setExpandedKpiGroups]  = useState<Set<string>>(new Set());

  const qualifiedRoleIds = qualifiedRoles.map((r) => r.roleId);

  useEffect(() => {
    if (!qualifiedRoleIds.length) return;
    setKpiLoading(true);
    setKpiError(null);
    fetchKpiMetricsForClaim(qualifiedRoleIds)
      .then((data) => setKpiGroups(data.filter((g) => g.isActive === true)))
      .catch(() => setKpiError('Failed to load KPI metrics.'))
      .finally(() => setKpiLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualifiedRoleIds.join(',')]);

  const toggleServiceSection = useCallback((rid: string) => {
    setCollapsedServices((prev) => {
      const next = new Set(prev);
      if (next.has(rid)) next.delete(rid); else next.add(rid);
      return next;
    });
  }, []);

  const toggleKpiGroup = useCallback((groupId: string) => {
    setExpandedKpiGroups((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  }, []);

  if (qualifiedRoles.length === 0) return null;

  const overallRating = qualifiedRoles.reduce((s, r) => s + vendorRoleScorecard(companyName, r.roleName).aggregate, 0) / qualifiedRoles.length;
  const overallFilled = Math.round(overallRating);

  const byRole = new Map<string, KpiGroup[]>();
  for (const g of kpiGroups) {
    const rid = g.serviceRequestRoleId ?? '';
    if (!byRole.has(rid)) byRole.set(rid, []);
    byRole.get(rid)!.push(g);
  }
  const orderedRoleIds = qualifiedRoleIds.filter((rid) => byRole.has(rid));
  for (const rid of byRole.keys()) {
    if (!orderedRoleIds.includes(rid)) orderedRoleIds.push(rid);
  }

  return (
    <>
      {/* ── Overall Rating ── */}
      <div style={{
        background: '#fff', border: '1px solid var(--color-border)',
        borderRadius: 12, padding: '18px 24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Overall PPI</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', gap: 3 }}>
              {[1,2,3,4,5].map((n) => (
                <svg key={n} width="20" height="20" viewBox="0 0 24 24"
                  fill={n <= overallFilled ? '#f59e0b' : 'none'}
                  stroke={n <= overallFilled ? '#f59e0b' : '#d1d5db'} strokeWidth={1.5}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              ))}
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>{overallRating.toFixed(1)}</span>
            <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 500 }}>/ 5</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {qualifiedRoles.map((r) => {
            const ratingVal = vendorRoleScorecard(companyName, r.roleName).aggregate;
            const f = Math.round(ratingVal);
            return (
              <div key={r.roleId} style={{
                background: '#E6F5F4', borderRadius: 10,
                padding: '8px 14px', textAlign: 'center', minWidth: 120,
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0B807B', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{r.roleName}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  {[1,2,3,4,5].map((n) => (
                    <svg key={n} width="13" height="13" viewBox="0 0 24 24"
                      fill={n <= f ? '#f59e0b' : 'none'}
                      stroke={n <= f ? '#f59e0b' : '#d1d5db'} strokeWidth={1.5}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', marginLeft: 3 }}>{ratingVal.toFixed(1)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Vendor Score Breakdown ── */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '20px 24px 24px',
        margin: '0 0 20px',
      }}>
        {/* Card header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          paddingBottom: 14, marginBottom: 18,
          borderBottom: '2px solid var(--color-primary-lt)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--color-primary-lt)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111827' }}>Provider Score Breakdown</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 1 }}>KPI category weights per qualified service</div>
          </div>
        </div>

        {/* One collapsible card per role */}
        {qualifiedRoles.map((role, idx) => {
          // Single source of truth shared with the Overall Rating summary above —
          // the row badge and the Aggregate cell below both read off this same
          // scorecard, so they can never drift apart.
          const { kpis, aggregate } = vendorRoleScorecard(companyName, role.roleName);
          const rating    = aggregate;
          const isLast    = idx === qualifiedRoles.length - 1;
          const isExpanded = expandedScoreRoles.has(role.roleId);
          const toggleRole = () => setExpandedScoreRoles((prev) => {
            const next = new Set(prev);
            next.has(role.roleId) ? next.delete(role.roleId) : next.add(role.roleId);
            return next;
          });
          return (
            <div key={role.roleId} style={{
              background: '#F0F8F7',
              border: '1px solid #C7E2DF',
              borderRadius: 10,
              marginBottom: isLast ? 0 : 16,
              overflow: 'hidden',
            }}>
              {/* Role header — click to expand/collapse */}
              <button
                type="button"
                onClick={toggleRole}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 14px',
                  background: '#E6F5F4',
                  borderBottom: isExpanded ? '1px solid #BFE0DD' : 'none',
                  border: 'none', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#0B807B' }}>{role.roleName}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    color: '#fff', background: 'var(--color-primary)',
                    borderRadius: 20, padding: '2px 10px',
                  }}>
                    {rating.toFixed(1)} / 5.0
                  </span>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="#0B807B" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Score table — shown only when expanded */}
              {isExpanded && <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: '#DFF2F0' }}>
                    <th style={{ textAlign: 'left',   padding: '6px 14px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #BFE0DD' }}>Category</th>
                    <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #BFE0DD', width: 52 }}>Wt</th>
                    <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #BFE0DD', width: 60 }}>Score</th>
                    <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #BFE0DD', width: 90 }}>Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((kpi, ki) => (
                    <tr key={kpi.name} style={{ background: ki % 2 === 0 ? '#F0F8F7' : '#fff', borderBottom: '1px solid #D2EBE8' }}>
                      <td style={{ padding: '5px 14px', color: kpi.weight === null ? '#9ca3af' : '#374151' }}>{kpi.name}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', color: kpi.weight === null ? '#9ca3af' : '#374151' }}>
                        {kpi.weight !== null ? `${kpi.weight}%` : '–'}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', color: kpi.score === null ? '#9ca3af' : '#374151' }}>
                        {kpi.score !== null ? kpi.score.toFixed(1) : '–'}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'center', color: kpi.contribution === null ? '#9ca3af' : '#374151' }}>
                        {kpi.contribution !== null ? kpi.contribution.toFixed(2) : '–'}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#DFF2F0', borderTop: '1px solid #BFE0DD' }}>
                    <td style={{ padding: '6px 14px', fontWeight: 700, color: '#111827' }}>Aggregate</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#111827' }}>100%</td>
                    <td style={{ padding: '6px 10px' }} />
                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#2C61AA' }}>{aggregate.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>}
            </div>
          );
        })}
      </div>

      {/* ── KPI Metrics ── */}
      <div className="cid-kpi-tab">
        <div className="cid-kpi-tab__header">
          <div>
            <h2 className="cid-kpi-tab__title">Metrics</h2>
            <p className="cid-kpi-tab__sub">Performance metrics for the provider's qualified service categories</p>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            {qualifiedRoleIds.length} qualified service{qualifiedRoleIds.length !== 1 ? 's' : ''}
          </span>
        </div>

        {kpiError && <div className="alert alert--error" style={{ margin: '0 0 16px' }}>{kpiError}</div>}

        {kpiLoading && (
          <div className="cid-kpi-tab__loading">
            <span className="vi-spinner" style={{ borderTopColor: 'var(--color-primary)' }} />
            Loading KPI metrics…
          </div>
        )}

        {!kpiLoading && kpiGroups.length === 0 && !kpiError && (
          <div className="cid-kpi-tab__empty">
            <p>No Service Provider KPI metrics are configured for the qualified service categories.</p>
          </div>
        )}

        {!kpiLoading && orderedRoleIds.map((rid) => {
          const groups      = byRole.get(rid) ?? [];
          const roleName    = qualifiedRoles.find((r) => r.roleId === rid)?.roleName ?? rid;
          const isCollapsed = collapsedServices.has(rid);

          return (
            <div key={rid} className="cid-kpi-service-section">
              <div className="cid-kpi-service-section__header"
                role="button" tabIndex={0} aria-expanded={!isCollapsed}
                onClick={() => toggleServiceSection(rid)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleServiceSection(rid); } }}>
                <div className="cid-kpi-service-section__header-left">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                  <span className="cid-kpi-service-section__name">{roleName}</span>
                </div>
                <svg className={`cid-kpi-service-section__chevron${isCollapsed ? '' : ' cid-kpi-service-section__chevron--open'}`}
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>

              {!isCollapsed && (
                <div className="cid-kpi-service-section__body">
                  {groups.map((group) => {
                    const activeMetrics = group.metrics.filter((m) => m.isVendorKPI === true);
                    if (activeMetrics.length === 0) return null;
                    const groupKey   = group.kpiMatricsId;
                    const isExpanded = expandedKpiGroups.has(groupKey);
                    return (
                      <div key={groupKey} className="cid-kpi-group">
                        {/* Group header with down/up chevron to collapse the graph */}
                        <div className="cid-kpi-group__header cid-kpi-group__header--toggleable">
                          <span className="cid-kpi-group__label">{group.kpiGroupTracking}</span>
                          <button
                            type="button"
                            className="cid-kpi-graph-toggle"
                            aria-label={isExpanded ? 'Hide graphs' : 'Show graphs'}
                            aria-expanded={isExpanded}
                            onClick={() => toggleKpiGroup(groupKey)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                              style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            >
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </button>
                        </div>

                        {/* Metric cards — name + value always visible; graph shown only when group expanded */}
                        <div className="cid-kpi-cards">
                          {activeMetrics.map((metric) => {
                            const displayConditions = metric.conditions
                              .slice().sort((a, b) => a.sortOrder - b.sortOrder)
                              .filter((c) => c.ShowValue);
                            const primaryCond = displayConditions[0];
                            const { section } = metric;
                            const showGoodTag = section?.thresholdsGood
                              ? metric.conditions.some((c) => c.ShowValue?.toLowerCase().includes('days'))
                              : false;
                            return (
                              <div
                                key={metric.kpiMatricsGroupTrackingId}
                                className={`cid-kpi-card${metric.isActive ? '' : ' cid-kpi-card--inactive'}`}
                              >
                                <div className="cid-kpi-card__header">
                                  <span className="cid-kpi-card__name">{metric.kpiGroupTrackingSuggestion}</span>
                                </div>

                                {displayConditions.length > 0 && (
                                  <div className="cid-kpi-card__section">
                                    {displayConditions.map((c, i) => (
                                      <div key={i} className="cid-kpi-card__formula">
                                        {c.ShowValue}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {section && (section.thresholdsGood || section.thresholdsModerate || section.thresholdsPoor) && (
                                  <div className="cid-kpi-card__section">
                                    <div className="cid-kpi-card__thresholds">
                                      {showGoodTag && (
                                        <span className="cid-kpi-thresh cid-kpi-thresh--good">
                                          <span className="cid-kpi-thresh__dot" style={{ background: '#22c55e' }} />
                                          Good
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {primaryCond && (
                                  <div className="cid-kpi-card__graph-area" style={{ display: isExpanded ? 'block' : 'none' }}>
                                    <KpiMiniGraph rawValue={primaryCond.ShowValue} seedKey={metric.kpiMatricsGroupTrackingId} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

export default VendorPerformanceMetrics;
