/**
 * LAElia teal theme tokens for the Login screen, matched to the
 * "LAElia Styles" Color Guide reference (Brand teal → near-black teal).
 * Scoped to this screen only — the shared app theme (sourceCode/skin) is unaffected.
 * All Login page styling itself lives in skin/css/custom.css (.login-* classes);
 * these tokens are kept here only because VendorSignup also imports them.
 */
export const loginTheme = {
  tealDarkest: '#1F726A',
  tealDark:    '#16867F',
  teal700:     '#0E9A94',
  teal500:     '#3DB3AC',
  teal400:     '#A8D9D5',
  teal300:     '#E6F5F4',
  accent:      '#0B807B',
  accentHover: '#0B7A75',
  accentLight: '#E6F5F4',
  textMuted:   '#5B6D6A',
  textMutedLt: '#8A9997',
  border:      '#E3E9E8',
} as const;
