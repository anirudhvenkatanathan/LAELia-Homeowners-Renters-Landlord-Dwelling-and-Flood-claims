/**
 * styles.ts — CSS class name map for the Executive Overview dashboard screen.
 *
 * All values are existing class names from:
 *   - skin/css/main.css
 *   - skin/css/custom.css
 *
 * No inline styles. No page-specific CSS. No invented class names.
 */
export const styles = {
  // Page layout
  dashPage:    'dash-page',
  headerCard:  'dash-header-card',
  titleRow:    'dash-title-row',
  pageTitle:   'page-title',
  pageSubtitle:'page-subtitle',
  contentArea: 'dash-content-area',
  section:     'dash-section',
  sectionLabel:'dash-section-label',

  // Filter bar
  filterBar:        'kpi-filter-bar',
  filterBarLabel:   'kpi-filter-bar__label',
  filterSummary:    'kpi-filter-summary',
  filterSummaryClear: 'kpi-filter-summary__clear',

  // Buttons / badges
  btnPrimary: 'btn btn--primary',
  btnGhost:   'btn btn--ghost',
  badgeBlue:  'badge-blue',

  // Metric / KPI cards
  metricRow: 'dash-metric-row',

  // Charts
  chartRow3:       'dash-chart-row--3col',
  chartWidget:     'dash-chart-widget',
  chartWidgetTitle:'dash-chart-widget__title',
  chartWidgetSub:  'dash-chart-widget__sub',
  chartWidgetBody: 'dash-chart-widget__body',
  chartHeroValue:  'chart-hero-value',
  infoIcon:        'eo-info-icon',
  infoTooltip:     'eo-info-tooltip',

  // Misc
  textMuted: 'text-sm-muted',
} as const;

export type StyleKey = keyof typeof styles;
