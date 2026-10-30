import React from 'react';
import laeliaLogoSrc from '../../assets/brand/laelia-logo.svg';

export type LaeliaTone = 'on-dark' | 'on-light';

const LOGO_ASPECT = 1920 / 539.98;

interface LaeliaLogoProps {
  variant: LaeliaTone;
  size?: number;
}

/**
 * Shared LAElia brand mark (src/assets/brand/laelia-logo.svg) — white wordmark +
 * leaf icon, rendered at a given height with its natural aspect ratio. Sits directly
 * on the brand-teal header fill with no card/background of its own. Used on the
 * Login screen and every sidebar/shell brand mark so the logo reads identically
 * everywhere. `variant` is kept for call-site compatibility.
 */
export const LaeliaLogo: React.FC<LaeliaLogoProps> = ({ size = 22 }) => (
  <img
    className="laelia-logo"
    src={laeliaLogoSrc}
    alt="LAElia"
    style={{ height: size, width: size * LOGO_ASPECT }}
  />
);

export default LaeliaLogo;
