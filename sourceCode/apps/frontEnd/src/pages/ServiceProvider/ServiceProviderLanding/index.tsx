import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../../components/layout/AppShell';

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconAdmin: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconOnboarding: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);

const IconNetwork: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="4"  r="2"/>
    <circle cx="4"  cy="20" r="2"/>
    <circle cx="20" cy="20" r="2"/>
    <line x1="12" y1="6"  x2="4"  y2="18"/>
    <line x1="12" y1="6"  x2="20" y2="18"/>
    <line x1="6"  y1="20" x2="18" y2="20"/>
  </svg>
);

const IconAnalytics: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
    <line x1="2"  y1="20" x2="22" y2="20"/>
  </svg>
);

const IconRequest: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="12" x2="12" y2="18"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
);

const IconMetricsConfig: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14"/>
    <line x1="4" y1="10" x2="4" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12" y2="3"/>
    <line x1="20" y1="21" x2="20" y2="16"/>
    <line x1="20" y1="12" x2="20" y2="3"/>
    <line x1="1" y1="14" x2="7" y2="14"/>
    <line x1="9" y1="8" x2="15" y2="8"/>
    <line x1="17" y1="16" x2="23" y2="16"/>
  </svg>
);

const IconABTest: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5"/>
    <path d="M4 20L21 3"/>
    <path d="M21 16v5h-5"/>
    <path d="M15 15l6 6"/>
    <path d="M4 4l5 5"/>
  </svg>
);

const IconBaseline: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const ArrowIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

// ─── Tile data ────────────────────────────────────────────────────────────────

interface TileConfig {
  id:       string;
  color:    'purple' | 'green' | 'blue' | 'orange' | 'teal' | 'indigo';
  icon:     React.ReactNode;
  title:    string;
  subtitle: string;
  cta:      string;
  route?:   string;
  disabled?: boolean;
}

const TILES: TileConfig[] = [
  {
    id:       'admin',
    color:    'purple',
    icon:     <IconAdmin />,
    title:    'Provider Administration',
    subtitle: 'Manage provider profiles, assignments, qualifications, and day-to-day administrative operations.',
    cta:      'Open Administration',
    route:    '/vendor/search',
  },
  {
    id:       'onboarding',
    color:    'green',
    icon:     <IconOnboarding />,
    title:    'Provider Onboarding',
    subtitle: 'Review onboarding requests, verify documents, manage qualifications, and complete provider onboarding.',
    cta:      'Open Onboarding',
    route:    '/vendor/onboarding',
  },
  {
    id:       'network',
    color:    'blue',
    icon:     <IconNetwork />,
    title:    'Curated Provider Network',
    subtitle: 'Access and manage the curated provider panel, trusted partners, and pre-vetted service providers.',
    cta:      'Explore Network',
    route:    '/vendor/panel',
  },
  {
    id:       'analytics',
    color:    'orange',
    icon:     <IconAnalytics />,
    title:    'Service Provider Scoreboard',
    subtitle: 'Analyze Q-AI provider scores, KPI metrics, operational performance, and provider insights.',
    cta:      'View Scoreboard',
    route:    '/service-provider-analytics',
  },
  {
    id:       'request',
    color:    'teal',
    icon:     <IconRequest />,
    title:    'Service Provider Request',
    subtitle: 'Submit a new service provider request with company details and contact information.',
    cta:      'New Request',
    route:    '/vendor-request/new',
  },];

// ─── Tile ─────────────────────────────────────────────────────────────────────

const Tile: React.FC<TileConfig & { index: number }> = ({
  color, icon, title, subtitle, cta, route, index, disabled,
}) => {
  const navigate = useNavigate();
  const isDisabled = disabled || !route;
  const go = () => { if (!isDisabled && route) navigate(route); };
  return (
    <div
      className={`sp-tile sp-tile--${color}${isDisabled ? ' sp-tile--disabled' : ''}`}
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={go}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
      onKeyDown={(e) => e.key === 'Enter' && go()}
    >
      <div className="sp-tile__icon-wrap">{icon}</div>
      <div className="sp-tile__title">{title}</div>
      <div className="sp-tile__subtitle">{subtitle}</div>
      <button
        type="button"
        className="sp-cta"
        disabled={isDisabled}
        onClick={(e) => { e.stopPropagation(); go(); }}
        tabIndex={-1}
      >
        <span className="sp-cta__text">{cta}</span>
        <span className="sp-cta__circle"><ArrowIcon /></span>
      </button>
    </div>
  );
};

// ─── A/B Testing panel data ──────────────────────────────────────────────────
// Same card shape as the tiles above (icon, title, subtitle, CTA) — no
// destination screen exists yet, so each card's CTA is rendered disabled.

const AB_TEST_TILES: TileConfig[] = [
  {
    id:       'ab-testing',
    color:    'teal',
    icon:     <IconABTest />,
    title:    'A/B Testing',
    subtitle: 'A/B testing for suspended, reactivation, disqualified vendors.',
    cta:      'Open A/B Testing',
    disabled: true,
  },
  {
    id:       'base-line',
    color:    'indigo',
    icon:     <IconBaseline />,
    title:    'Base Line Testing',
    subtitle: 'Base Line testing for any newly onboarded vendors.',
    cta:      'Open Base Line Testing',
    disabled: true,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

const ServiceProviderLanding: React.FC = () => (
  <AppShell>
    <div className="sp-landing">
      <div className="dash-header-card sp-header">
        <div className="dash-title-row">
          <h1 className="sp-header__title">Service Provider</h1>
          <p className="sp-header__subtitle">
            Select a module to manage provider operations, onboarding, curated networks, and performance insights.
          </p>
        </div>
      </div>
      <div className="sp-grid">
        {TILES.map((tile, i) => (
          <Tile key={tile.id} {...tile} index={i} />
        ))}
      </div>
      <div className="sp-abtest">
        <div className="sp-abtest__title">A/B testing</div>
        <div className="sp-grid">
          {AB_TEST_TILES.map((tile, i) => (
            <Tile key={tile.id} {...tile} index={i} />
          ))}
        </div>
      </div>
    </div>
  </AppShell>
);

export default ServiceProviderLanding;
