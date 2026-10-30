import React from 'react';
import { VENDOR_SORT_OPTIONS } from '../../models/dashboard/executiveOverviewModel';
import type { VendorRow, VendorSortField } from '../../models/dashboard/executiveOverviewModel';

interface VendorPerformanceTableProps {
  vendors: VendorRow[];
  sortBy: VendorSortField;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: VendorSortField) => void;
}

const VendorPerformanceTable: React.FC<VendorPerformanceTableProps> = ({ vendors, sortBy, sortOrder, onSortChange }) => (
  <div className="dash-activity-widget">
    <div className="dash-activity-widget__header">
      <div>
        <div className="dash-activity-widget__title">Service Provider Performance Overview</div>
        <div className="dash-activity-widget__subtitle">Top providers by overall performance</div>
      </div>
      <div className="kpi-filter-item">
        <select
          className="kpi-filter-select"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as VendorSortField)}
          aria-label="Sort providers by"
        >
          {VENDOR_SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
        </select>
        <span className="kpi-filter-select__chevron">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>
      <button
        type="button"
        className="eo-sort-toggle"
        onClick={() => onSortChange(sortBy)}
        title={sortOrder === 'desc' ? 'Sorted descending — click for ascending' : 'Sorted ascending — click for descending'}
        aria-label="Toggle sort order"
      >
        {sortOrder === 'desc' ? '↓' : '↑'}
      </button>
      <span className="dash-activity-widget__link">View All →</span>
    </div>
    <div style={{ overflowX: 'auto' }}>
      <table className="dash-activity-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Service Provider</th>
            <th>Overall Score</th>
            <th>SLA Compliance</th>
            <th>Cycle Time (Days)</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v) => (
            <tr key={v.id}>
              <td>{v.rank}</td>
              <td>{v.vendorName}</td>
              <td>{v.overallScore.toFixed(1)}</td>
              <td>{v.slaCompliance.toFixed(1)}%</td>
              <td>{v.cycleTimeDays.toFixed(1)}</td>
              <td>
                <span className={`dash-metric-card__trend dash-metric-card__trend--${v.trendDirection}`}>
                  {v.trendDirection === 'up' ? '↑' : '↓'} {v.trendValue.toFixed(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default VendorPerformanceTable;
