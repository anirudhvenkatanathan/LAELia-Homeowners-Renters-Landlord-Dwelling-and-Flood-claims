import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ActiveVendorShell from '../../../components/layout/ActiveVendorShell';
import { useAuth } from '../../../context/AuthContext';
import { getPerformance } from '../../../services/activeVendor/activeVendorService';
import { getOnboardingDetails } from '../../../services/vendorOnboarding/vendorOnboardingService';
import type { ClientPerf } from '../../../models/activeVendor/activeVendorModel';
import { getDemoClientRows } from '../../../utils/clientManagementMockData';

// ─── Page ─────────────────────────────────────────────────────────────────────

const ClientManagement: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [companyName, setCompanyName] = useState<string | undefined>();
  const [clients,     setClients]     = useState<ClientPerf[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getPerformance(vendorId),
      getOnboardingDetails(vendorId).catch(() => null),
    ])
      .then(([perf, details]) => {
        // No real client history yet — show deterministic demo clients instead
        // of an empty screen. Computed live, never persisted to the database.
        const rows: ClientPerf[] = perf.byClient.length > 0
          ? perf.byClient
          : getDemoClientRows(vendorId).map((r) => ({
              companyName: r.companyName, total: r.total, completed: r.completed,
              slaHit: 100, avgCycle: 0, score: null,
            }));
        setClients([...rows].sort((a, b) => a.companyName.localeCompare(b.companyName)));
        setCompanyName(details?.companyName);
      })
      .catch(() => setError('Failed to load client data. Please refresh.'))
      .finally(() => setLoading(false));
  }, [vendorId]);

  const handleView = useCallback((clientName: string) => {
    navigate(`/vendors/active/performance/${vendorId}`, { state: { clientName } });
  }, [navigate, vendorId]);

  if (!vendorId) return null;

  return (
    <ActiveVendorShell vendorId={vendorId} activeTab="clients" companyName={companyName}>
      <div className="dash-page" style={{ padding: '28px 28px 60px', boxSizing: 'border-box' }}>
        <div className="dash-header-card">
          <div className="dash-title-row">
            <h2 className="vpo-welcome-heading">
              Welcome {companyName ?? user?.companyName ?? 'Service Provider'}...!!
            </h2>
            <h1 className="page-title">Client Management</h1>
            <p className="page-subtitle">Clients you currently service.</p>
          </div>
        </div>

        <div className="dash-content-area">
        {loading && <div className="vpo-loading">Loading…</div>}
        {error && <div className="alert alert--error">{error}</div>}

        {!loading && !error && (
          <div className="dash-section">
            <div style={{ background: '#fff', overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                    {['CLIENT', 'ACTIVE', 'COMPLETED', 'TOTAL', ''].map((h) => (
                      <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.companyName} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                        {c.companyName || 'Unknown Client'}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {c.total - c.completed}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '0.88rem', color: 'var(--color-text)' }}>
                        {c.completed}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '0.88rem', color: 'var(--color-text)' }}>
                        {c.total}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleView(c.companyName)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.85rem', padding: 0,
                          }}
                        >
                          View
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
      </div>
    </ActiveVendorShell>
  );
};

export default ClientManagement;
