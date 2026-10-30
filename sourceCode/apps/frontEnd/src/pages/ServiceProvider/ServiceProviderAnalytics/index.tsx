import React, { useCallback, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import AppShell from '../../../components/layout/AppShell';
import { ServiceProviderTabs } from '../../../components/layout/ServiceProviderTabs';
import { useVendorSearch } from '../../../hooks/vendor/useVendorSearch';
import { vendorRoleScorecard } from '../../../utils/kpiScoring';

// ─── Row type — one row per (provider, service type) pair ─────────────────────
// Providers are rated and ranked *within* their own service type only — a
// Pharmacy provider and an IME provider are never compared against each other.

interface ProviderPpiRow {
  vendorId:    string;
  companyName: string;
  legalEntity: string;
  status:      string;
  ppi:         number;
}

// ─── PPI badge (replaces the old 5-star rating) ────────────────────────────────
// Shown as "X.XX/5" only — no repeated "PPI" text per row; "Provider
// Performance Index" appears once, as the column heading, above the group.

const PpiBadge: React.FC<{ value: number }> = ({ value }) => {
  const rounded = Math.round(value * 10) / 10;
  const tier = value >= 4.2 ? 'good' : value >= 3.8 ? 'fair' : 'low';
  return (
    <span className={`ppi-badge ppi-badge--${tier}`} title="Provider Performance Index">
      {rounded.toFixed(1)}/5
    </span>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const ServiceProviderAnalytics: React.FC = () => {
  const navigate   = useNavigate();
  const { vendors, loading, error, refresh } = useVendorSearch();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const activeVendors = useMemo(
    () => vendors.filter((v) => v.status === 'Active' || v.status === 'Requalification Due'),
    [vendors],
  );

  // Total distinct providers, for the header count badge.
  const uniqueProviderCount = useMemo(
    () => new Set(activeVendors.map((v) => v.companyName)).size,
    [activeVendors],
  );

  // Group providers by service type. A provider offering multiple service
  // types appears once per type, each with its own PPI for that type.
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, ProviderPpiRow[]>();
    for (const v of activeVendors) {
      const roleNames: string[] =
        v.serviceRequestRoleNames && v.serviceRequestRoleNames.length > 0
          ? v.serviceRequestRoleNames
          : v.serviceRequestRoleName ? [v.serviceRequestRoleName] : [];
      for (const role of roleNames) {
        if (!map.has(role)) map.set(role, []);
        const bucket = map.get(role)!;
        if (bucket.some((r) => r.companyName === v.companyName)) continue;
        bucket.push({
          vendorId:    v.vendorId,
          companyName: v.companyName,
          legalEntity: v.legalEntity ?? '',
          status:      v.status ?? '',
          // Same computation "View Performance" uses for this vendor+role, so
          // the two screens never show a different number for the same service.
          ppi:         vendorRoleScorecard(v.companyName, role).aggregate,
        });
      }
    }
    for (const rows of map.values()) rows.sort((a, b) => b.ppi - a.ppi);
    return map;
  }, [activeVendors]);

  // Category groups, alphabetical, filtered by search (matches category name
  // or a provider name within it).
  const filteredGroups = useMemo(() => {
    const entries = [...groupedByCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const q = searchQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries
      .map(([category, rows]): [string, ProviderPpiRow[]] => {
        const categoryMatches = category.toLowerCase().includes(q);
        return [category, categoryMatches ? rows : rows.filter((r) => r.companyName.toLowerCase().includes(q))];
      })
      .filter(([, rows]) => rows.length > 0);
  }, [groupedByCategory, searchQuery]);

  const toggleGroup = (category: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  };

  const handleViewPerformance = useCallback((row: ProviderPpiRow) => {
    navigate(`/vendor/onboarding/details/${row.vendorId}`, {
      state: { from: 'analytics' },
    });
  }, [navigate]);

  return (
    <AppShell>
      <ServiceProviderTabs />
      <div className="page-card">

        <div className="page-header" style={{ paddingBottom: 20 }}>
          <h1 className="page-title">Provider Scoreboard</h1>
          <p className="page-subtitle">
            Providers are grouped by service type and ranked by Provider Performance Index (PPI) within their own type — providers of different service types are not compared against each other.
          </p>
        </div>

        <div className="section-block">
          <div className="vs-toolbar">
            {!loading && (
              <span style={{
                fontSize: '0.78rem', fontWeight: 600, color: '#ffffff',
                background: 'var(--color-primary-lt)', borderRadius: 20, padding: '4px 12px',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {uniqueProviderCount} active provider{uniqueProviderCount !== 1 ? 's' : ''}
              </span>
            )}
            <div className="cim-search-bar" role="search"
              style={{ marginLeft: 'auto', minWidth: 220, maxWidth: 440, flex: 1 }}>
              <span className="cim-search-bar__icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </span>
              <input type="text" className="cim-search-bar__input"
                placeholder="Search by provider or service type…"
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search active providers"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={refresh}
              title="Refresh" aria-label="Refresh list">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
            </button>
          </div>

          {error && (
            <div className="alert alert--error" role="alert" style={{ marginBottom: 14 }}>{error}</div>
          )}

          {loading ? (
            <div className="detail-loading"><p className="text-sm-muted">Loading providers…</p></div>
          ) : filteredGroups.length === 0 ? (
            <p className="ppi-empty">
              {searchQuery ? 'No providers match your search.' : 'No active providers found.'}
            </p>
          ) : (
            <div className="ppi-groups">
              {filteredGroups.map(([category, rows]) => {
                const isCollapsed = collapsedGroups.has(category);
                return (
                  <div key={category} className="ppi-group">
                    <div
                      className="ppi-group__header"
                      role="button" tabIndex={0} aria-expanded={!isCollapsed}
                      onClick={() => toggleGroup(category)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGroup(category); } }}
                    >
                      <span className="ppi-group__title">{category}</span>
                      <span className="ppi-group__count">{rows.length} provider{rows.length !== 1 ? 's' : ''}</span>
                      <svg className={`ppi-group__chevron${isCollapsed ? '' : ' ppi-group__chevron--open'}`}
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>

                    {!isCollapsed && (
                      <div className="ppi-group__body">
                        <div className="ppi-row ppi-row--head">
                          <span>Service Provider</span>
                          <span>Provider Performance Index</span>
                          <span />
                        </div>
                        <div className="ppi-group__rows">
                          {rows.map((row) => (
                            <div key={row.vendorId} className="ppi-row">
                              <div className="ppi-provider">
                                <span className="ppi-provider__name">{row.companyName}</span>
                                {row.legalEntity && <span className="ppi-provider__legal">{row.legalEntity}</span>}
                              </div>
                              <PpiBadge value={row.ppi} />
                              <button
                                type="button"
                                className="ppi-view-btn"
                                onClick={() => handleViewPerformance(row)}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                </svg>
                                View Performance
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default ServiceProviderAnalytics;
