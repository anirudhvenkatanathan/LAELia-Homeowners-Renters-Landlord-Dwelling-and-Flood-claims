import React from 'react';
import AppShell from '../../../components/layout/AppShell';

const AnalyticsInsights: React.FC = () => {
  return (
    <AppShell>
      <div style={{ padding: '32px 40px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text, #111827)', margin: '0 0 6px' }}>
          Analytics &amp; Insights
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted, #6b7280)', margin: 0 }}>
          Claims analytics and performance insights coming soon.
        </p>
      </div>
    </AppShell>
  );
};

export default AnalyticsInsights;
