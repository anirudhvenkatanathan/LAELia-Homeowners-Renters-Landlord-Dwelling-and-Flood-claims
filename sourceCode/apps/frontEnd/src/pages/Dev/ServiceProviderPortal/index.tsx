import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { getVendors } from '../../../services/vendor/vendorService';

// ─── Dev/demo shortcut ──────────────────────────────────────────────────────
// Route: /dev/service-provider
//
// Resolves an existing Active Service Provider and drops straight into the
// same Active Vendor portal (ActiveVendorShell + ClientManagement/MyDocuments/
// MyProfile) a real Vendor User lands on after logging in — no vendorId in
// the URL, no credentials required. Bootstraps the session via
// AuthContext.loginAsServiceProvider(), which is additive and does not touch
// the real login mutation, backend APIs, or DB. Never linked from the app's
// own navigation — reachable only by typing the URL directly.

// AmTrust Financial — the canonical "Active Service Provider" quick-login demo
// account (see apps/api/scripts/activateAmtrustDemo.ts). Preferred over just
// picking whichever Active vendor happens to sort first.
const DEMO_VENDOR_ID = 'cfeda500-ecea-4c96-ab51-f94a00956d40';

const ServiceProviderPortal: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsServiceProvider } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const vendors = await getVendors();
        const activeVendor =
          vendors.find((v) => v.vendorId === DEMO_VENDOR_ID && v.status === 'Active') ??
          vendors.find((v) => v.status === 'Active');

        if (!activeVendor) {
          if (!cancelled) setError('No Active Service Provider exists yet to demo this portal with.');
          return;
        }

        loginAsServiceProvider({
          vendorId:    activeVendor.vendorId,
          companyName: activeVendor.companyName,
          email:       activeVendor.emailId,
        });

        // TEMPORARY — auto-approves L1 documents so My Documents shows a fully
        // qualified demo account instead of Pending items with nothing uploaded.
        // Best-effort: never blocks the redirect if it fails.
        fetch(`${(import.meta as any).env.VITE_API_URL}/api/dev/approve-l1/${activeVendor.vendorId}`, { method: 'POST' }).catch(() => {});

        if (!cancelled) navigate(`/vendors/active/clients/${activeVendor.vendorId}`, { replace: true });
      } catch {
        if (!cancelled) setError('Failed to load an Active Service Provider. Please try again.');
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', color: '#6b7280', fontSize: '0.9rem',
    }}>
      {error ?? 'Loading Service Provider portal…'}
    </div>
  );
};

export default ServiceProviderPortal;
