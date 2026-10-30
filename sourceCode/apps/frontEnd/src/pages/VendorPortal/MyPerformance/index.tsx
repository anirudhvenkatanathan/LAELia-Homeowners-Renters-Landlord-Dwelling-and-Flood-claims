import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ActiveVendorShell from '../../../components/layout/ActiveVendorShell';
import { getOnboardingDetails } from '../../../services/vendorOnboarding/vendorOnboardingService';
import { VendorPerformanceMetrics } from '../../../components/vendorOnboarding/VendorPerformanceMetrics';

// ─── Page ─────────────────────────────────────────────────────────────────────

const MyPerformance: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const clientName = (location.state as { clientName?: string } | null)?.clientName;

  const [companyName,    setCompanyName]    = useState<string | undefined>();
  const [qualifiedRoles, setQualifiedRoles] = useState<{ roleId: string; roleName: string }[]>([]);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    if (!vendorId) return;
    getOnboardingDetails(vendorId)
      .then(d => {
        setCompanyName(d?.companyName ?? vendorId);
        setQualifiedRoles((d?.roleSummary ?? []).filter(r => r.isVendorRole).map(r => ({ roleId: r.roleId, roleName: r.roleName })));
      })
      .catch(() => { setCompanyName(vendorId); })
      .finally(() => setLoading(false));
  }, [vendorId]);

  if (!vendorId) return null;

  return (
    <ActiveVendorShell vendorId={vendorId} activeTab="performance" companyName={companyName}>
      <div className="vpo-page">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p className="vpo-breadcrumb">
              {clientName ? `Client Management › ${clientName}` : 'Service Provider Portal'}
            </p>
            <h1 className="vpo-page-title">
              {clientName || 'My Performance'}
            </h1>
            <p className="vpo-page-sub">Performance metrics for your active service categories.</p>
          </div>
          <button
            type="button"
            aria-label="Back to Client Management"
            onClick={() => navigate(`/vendors/active/clients/${vendorId}`)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
              color: 'var(--color-text-muted)', fontSize: '0.82rem', fontWeight: 400,
              marginTop: 2,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Client Management
          </button>
        </div>

        {loading && <div className="vpo-loading">Loading…</div>}

        {!loading && companyName && (
          <VendorPerformanceMetrics companyName={companyName} qualifiedRoles={qualifiedRoles} />
        )}
      </div>
    </ActiveVendorShell>
  );
};

export default MyPerformance;
