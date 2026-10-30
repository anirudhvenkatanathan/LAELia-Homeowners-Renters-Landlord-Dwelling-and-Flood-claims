/**
 * styles.ts — CSS class name map for FieldMappingMaster screen.
 *
 * All values are existing class names from:
 *   - skin/css/main.css
 *   - skin/css/custom.css
 *
 * No inline styles. No page-specific CSS. No invented class names.
 */
export const styles = {
  // Page layout
  pageHeader:        'page-header',
  pageTitle:         'page-title',
  pageSubtitle:      'page-subtitle',
  sectionBlock:      'section-block',
  sectionTitle:      'section-title',
  pageHeaderActions: 'page-header-actions',

  // Buttons
  btnPrimary:  'btn btn--primary',
  btnGhost:    'btn btn--ghost',
  btnSm:       'btn btn--ghost btn--sm',

  // Alerts
  alertSuccess: 'alert alert--success',
  alertError:   'alert alert--error',

  // AG Grid
  agTheme:      'ag-theme-alpine',
  agGridInCard: 'ag-grid-in-card',

  // Status badges
  badgeGreen:  'badge badge-green',
  badgeYellow: 'badge badge-yellow',
  badgeRed:    'badge badge-red',
  badgeGray:   'badge badge-gray',

  // Details
  detailInfoStrip:  'detail-info-strip',
  detailInfoField:  'detail-info-field',
  detailInfoLabel:  'detail-info-field__label',
  detailInfoValue:  'detail-info-field__value',
  detailInfoMono:   'detail-info-field__value--mono',
  detailInfoDivider:'detail-info-divider',
  kpiSection:       'kpi-section',
  kpiGrid3:         'kpi-grid kpi-grid--3col',

  // Mapping table
  mappingTableWrap: 'mapping-table-wrap',
  mappingTable:     'mapping-table',
  mappingInput:     'mapping-table__input',
  mappingSelect:    'mapping-table__select',
  mappingActions:   'mapping-table__actions',
  mappingEmpty:     'mapping-table__empty',
  mappingError:     'mapping-table__error',
} as const;

export type StyleKey = keyof typeof styles;
