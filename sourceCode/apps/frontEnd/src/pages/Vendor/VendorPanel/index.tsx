import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../../components/layout/AppShell';
import { ServiceProviderTabs } from '../../../components/layout/ServiceProviderTabs';
import { useVendorPanel } from '../../../hooks/vendor/useVendorPanel';
import type { PanelStatusFilter } from '../../../hooks/vendor/useVendorPanel';
import type { Vendor } from '../../../models/vendor/vendorModel';

// ─── Status pills ─────────────────────────────────────────────────────────────

const STATUS_PILLS: { key: PanelStatusFilter; label: (n: number) => string }[] = [
  { key: 'all',                label: (n) => `All (${n})` },
  { key: 'active',             label: (n) => `Active (${n})` },
  { key: 'readyForActivation', label: (n) => `Ready for Activation (${n})` },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

const BriefcaseIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const PinIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// ─── Vendor Card ──────────────────────────────────────────────────────────────

interface VendorCardProps {
  vendor: Vendor;
  onOpen: () => void;
}

function cardBadgeClass(status: string): string {
  if (status === 'Ready for Activation') return 'badge-orange';
  if (status === 'Suspended')            return 'badge-red';
  return 'badge-green';
}

const VendorCard: React.FC<VendorCardProps> = ({ vendor, onOpen }) => {
  const categories = vendor.serviceRequestRoleNames?.filter(Boolean).length
    ? vendor.serviceRequestRoleNames.filter(Boolean)
    : vendor.serviceRequestRoleName ? [vendor.serviceRequestRoleName] : [];

  const coverage = vendor.coverage || [vendor.city, vendor.state].filter(Boolean).join(', ');
  const isReadyForActivation = vendor.status === 'Ready for Activation';

  return (
    <div
      className="vp-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
      }}
    >
      <div className="vp-card__header">
        <div className="vp-card__titles">
          <div className="vp-card__name">{vendor.companyName}</div>
          {vendor.legalEntity && (
            <div className="vp-card__legal">{vendor.legalEntity}</div>
          )}
        </div>
        <span className={`badge vp-card__badge ${cardBadgeClass(vendor.status || '')}`}>
          {vendor.status || '—'}
        </span>
      </div>

      {categories.length > 0 && (
        <div className="vp-card__section">
          <div className="vp-card__label"><BriefcaseIcon /> Service Category</div>
          <div className="vp-card__tags">
            {categories.map((name) => (
              <span key={name} className="vp-card__tag">{name}</span>
            ))}
          </div>
        </div>
      )}

      {coverage && (
        <div className="vp-card__section">
          <div className="vp-card__label"><PinIcon /> Coverage States</div>
          <div className="vp-card__coverage">{coverage}</div>
        </div>
      )}

      <div className="vp-card__footer">
        <button
          type="button"
          className={isReadyForActivation ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
        >
          {isReadyForActivation ? 'Activate' : 'View Details'}
        </button>
      </div>
    </div>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

const VendorPanel: React.FC = () => {
  const navigate = useNavigate();
  const {
    filteredVendors, statusCounts, statusFilter, setStatusFilter,
    loading, error,
  } = useVendorPanel();

  const [search, setSearch] = useState('');

  const displayVendors = search.trim()
    ? filteredVendors.filter((v) =>
        v.companyName.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : filteredVendors;

  const handleCardClick = (vendor: Vendor) => {
    navigate(`/vendor/onboarding/details/${vendor.vendorId}`, { state: { from: 'vendor-panel' } });
  };

  return (
    <AppShell>
      <ServiceProviderTabs />
      <div className="page-card">
        <div className="page-header">
          <h1 className="page-title">Curated Provider Network</h1>
          <p className="page-subtitle">Manage and activate service providers</p>
        </div>

        {/* Status filter pills + Search bar */}
        <div className="section-block">
          <div className="vs-toolbar">
            <div className="vs-filter-pills" role="group" aria-label="Filter by provider status">
              {STATUS_PILLS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`vs-filter-pill${statusFilter === key ? ' vs-filter-pill--active' : ''}`}
                  onClick={() => setStatusFilter(key)}
                  aria-pressed={statusFilter === key}
                >
                  {label(statusCounts[key])}
                </button>
              ))}
            </div>

            <div className="cim-search-bar" role="search" style={{ marginLeft: 'auto', minWidth: 220, maxWidth: 360, flex: 1 }}>
              <span className="cim-search-bar__icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                className="cim-search-bar__input"
                placeholder="Search service providers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search service providers"
              />
              {search && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="detail-loading" style={{ marginTop: 24 }}>
            <p className="text-sm-muted">Loading providers…</p>
          </div>
        )}

        {error && (
          <div className="alert alert--error" role="alert" style={{ marginTop: 16 }}>{error}</div>
        )}

        {!loading && !error && displayVendors.length === 0 && (
          <div className="detail-loading" style={{ marginTop: 24 }}>
            <p className="text-sm-muted">No providers found.</p>
          </div>
        )}

        {!loading && displayVendors.length > 0 && (
          <div className="vp-grid">
            {displayVendors.map((v) => (
              <VendorCard
                key={v.vendorId}
                vendor={v}
                onOpen={() => handleCardClick(v)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default VendorPanel;
