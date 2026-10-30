/**
 * styles.ts — CSS class name map for ClaimIntakeMaster screen.
 *
 * All values are existing class names from:
 *   - skin/css/main.css
 *   - skin/css/custom.css
 *
 * No inline styles. No page-specific CSS. No invented class names.
 */
export const styles = {
  // Page layout — single page-card wraps header + all content (matches skin)
  pageHeader:      'page-header',
  pageTitle:       'page-title',
  pageSubtitle:    'page-subtitle',
  sectionBlock:    'section-block',
  sectionTitle:    'section-title',

  // Upload form
  formGroup:       'form-group',
  formLabel:       'form-label',
  formLabelReq:    'form-label form-label--required',
  formInput:       'form-input',
  formTextarea:    'form-textarea',
  formError:       'form-error',
  radioGroup:      'radio-group',
  radioOption:     'radio-option',
  radioLabel:      'radio-option__label',
  fileWrapper:     'file-input-wrapper',
  fileLabel:       'file-input-label',
  fileName:        'file-input-name',
  uploadRow:       'upload-row',

  // Buttons
  btnPrimary:      'btn btn--primary',
  btnGhost:        'btn btn--ghost',
  btnSm:           'btn btn--ghost btn--sm',

  // Alerts
  alertSuccess:    'alert alert--success',
  alertError:      'alert alert--error',

  // AG Grid
  agTheme:         'ag-theme-alpine',
  agGridInCard:    'ag-grid-in-card',

  // Status badges
  badgeGreen:      'badge badge-green',
  badgeYellow:     'badge badge-yellow',
  badgeRed:        'badge badge-red',
  badgeGray:       'badge badge-gray',

  // Claim details
  detailsGrid:     'details-grid',
  detailField:     'detail-field',
  detailLabel:     'detail-field__label',
  detailValue:     'detail-field__value',
  payloadBlock:    'payload-block',
} as const;

export type StyleKey = keyof typeof styles;
