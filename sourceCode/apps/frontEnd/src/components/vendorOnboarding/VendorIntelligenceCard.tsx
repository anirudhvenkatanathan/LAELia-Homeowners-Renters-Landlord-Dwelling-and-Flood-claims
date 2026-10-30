import React from 'react';
import type { VendorRedFlag, VendorIntelligenceResult } from '../../services/vendorOnboarding/vendorOnboardingService';

// Flags AI insights that recommend against a service (currently only Bill
// Review's) so the UI can show a red negative indicator next to them.
function isNegativeInsight(insight: string): boolean {
  return insight.startsWith('Not recommended');
}

const NegativeFlagIcon: React.FC = () => (
  <svg
    width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626"
    strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}
    role="img" aria-label="Negative AI recommendation"
  >
    <title>Negative AI recommendation</title>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

// ─── Vendor Intelligence (static, vendor-name-interpolated) ───────────────────

export function buildVendorIntelligence(companyName: string): VendorIntelligenceResult {
  const company = companyName || 'This service provider';
  return {
    summary: `${company} is a regional SIU and field investigations firm operating across CA, OR, WA. The firm specializes in workers' comp and general liability surveillance with a reported staff of 12 investigators. No adverse litigation history located — OSHA record is clean and no regulatory sanctions found.`,
    redFlags: [
      {
        severity:    'HIGH',
        category:    'LICENSING',
        description: 'Confirm active PI license in each applied state — CA, OR, WA each require separate licensure for investigative firms and lead investigators.',
        reference:   'myfloridalicense.com',
      },
      {
        severity:    'MODERATE',
        category:    'INSURANCE',
        description: 'Verify E&O and general liability certificates match the coverage thresholds required under L1 — investigative firms are frequently underinsured on cyber liability.',
        reference:   'acord.org',
      },
      {
        severity:    'LOW',
        category:    'REGULATORY',
        description: 'No OSHA citations or BBB complaints located. No adverse court judgments found in public records search.',
        reference:   '',
      },
    ],
  };
}

function severityClass(s: VendorRedFlag['severity']): string {
  if (s === 'HIGH')     return 'vi-flag__badge vi-flag__badge--high';
  if (s === 'MODERATE') return 'vi-flag__badge vi-flag__badge--moderate';
  return 'vi-flag__badge vi-flag__badge--low';
}

function severityBorderClass(s: VendorRedFlag['severity']): string {
  if (s === 'HIGH')     return 'vi-flag vi-flag--high';
  if (s === 'MODERATE') return 'vi-flag vi-flag--moderate';
  return 'vi-flag vi-flag--low';
}

export interface ServiceInsight {
  name:    string;
  checked: boolean;
  insight: string;
}

interface VendorIntelligenceCardProps {
  result:          VendorIntelligenceResult;
  company:         string;
  serviceInsights?: ServiceInsight[];
}

export const VendorIntelligenceCard: React.FC<VendorIntelligenceCardProps> = ({ result, company, serviceInsights }) => (
  <div className="vi-card">
    {/* Header */}
    <div className="vi-card__header">
      <span className="vi-card__label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        Q-AI HELPER
      </span>
    </div>

    {/* Company name */}
    <h3 className="vi-card__company">{company || '—'}</h3>

    <p className="vi-card__summary">{result.summary}</p>

    {serviceInsights && serviceInsights.length > 0 && (
      <div className="vi-service-insights">
        <div className="vi-service-insights__header">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#f59e0b', flexShrink: 0 }}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          Service Insights
        </div>
        {serviceInsights.map((s, i) => (
          <div key={i} className={`vi-insight-row${!s.checked ? ' vi-insight-row--dimmed' : ''}`}>
            <span className="vi-insight-row__name">{s.name}</span>
            <span className="vi-insight-row__text" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {isNegativeInsight(s.insight) && <NegativeFlagIcon />}
              {s.insight}
            </span>
          </div>
        ))}
      </div>
    )}

    {result.redFlags.length > 0 && (
      <div className="vi-flags-section">
        <div className="vi-flags-header">
          <span className="vi-flags-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f59e0b' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Red Flags &amp; Adverse Findings
          </span>
          <span className="vi-flags-count">{result.redFlags.length} finding{result.redFlags.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="vi-flags-list">
          {result.redFlags.map((flag, i) => (
            <div key={i} className={severityBorderClass(flag.severity)}>
              <div className="vi-flag__top">
                <span className={severityClass(flag.severity)}>{flag.severity}</span>
                <span className="vi-flag__category">{flag.category}</span>
              </div>
              <p className="vi-flag__desc">{flag.description}</p>
              {flag.reference && (
                <span className="vi-flag__ref">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  {flag.reference}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    )}

    {result.redFlags.length === 0 && (
      <div className="vi-clean">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        No adverse findings detected.
      </div>
    )}
  </div>
);
