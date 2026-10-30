import React from 'react';
import type { AlertItem } from '../../models/dashboard/executiveOverviewModel';

interface AlertsPanelProps {
  alerts: AlertItem[];
}

const SEVERITY_LABELS: Record<AlertItem['severity'], string> = {
  critical: 'Critical',
  high: 'High',
  warning: 'Warning',
  info: 'Info',
};

const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts }) => (
  <div className="dash-activity-widget">
    <div className="dash-activity-widget__header">
      <div>
        <div className="dash-activity-widget__title">Top Alerts &amp; Exceptions</div>
        <div className="dash-activity-widget__subtitle">Items needing attention, by severity</div>
      </div>
      <span className="dash-activity-widget__link">View All →</span>
    </div>
    <div className="alert-list">
      {alerts.map((alert) => (
        <div className="alert-row" key={alert.id}>
          <span className={`alert-row__icon alert-row__icon--${alert.severity}`} />
          <div className="alert-row__body">
            <div className="alert-row__title">{SEVERITY_LABELS[alert.severity]}: {alert.title}</div>
            <div className="alert-row__desc">{alert.description}</div>
          </div>
          <div className="alert-row__count">
            <span className={`alert-row__count-badge alert-row__count-badge--${alert.severity}`}>{alert.count}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default AlertsPanel;
