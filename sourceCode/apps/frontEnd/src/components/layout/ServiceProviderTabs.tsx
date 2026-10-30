import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Static, self-contained tab bar shown on the top-level Service Provider
// pages — replaces the sidebar's old expandable "Service Provider" group
// (see Sidebar.tsx's FLATTENED_GROUP_IDS) with in-page navigation between the
// same existing routes, no new pages, no route changes.
// Note: Service Metrics Configuration is deliberately NOT included here — it's
// a child of menu-admin-vendor-group (seedMenu.ts) and therefore hidden from
// the sidebar too; it's reachable only via the tile link on the existing
// ServiceProviderLanding page (/service-provider).
const TABS: { label: string; path: string }[] = [
  { label: 'Provider Administration',  path: '/vendor/search' },
  { label: 'Provider Onboarding',      path: '/vendor/onboarding' },
  { label: 'Curated Provider Network', path: '/vendor/panel' },
  { label: 'Provider Scoreboard',      path: '/service-provider-analytics' },
  { label: 'Service Provider Request', path: '/vendor-request/new' },
];

export const ServiceProviderTabs: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <div className="sp-tabs" role="tablist" aria-label="Service Provider sections">
      {TABS.map((tab) => {
        const active = pathname === tab.path;
        return (
          <button
            key={tab.path}
            type="button"
            role="tab"
            aria-selected={active}
            className={`sp-tab${active ? ' sp-tab--active' : ''}`}
            onClick={() => { if (!active) navigate(tab.path); }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default ServiceProviderTabs;
