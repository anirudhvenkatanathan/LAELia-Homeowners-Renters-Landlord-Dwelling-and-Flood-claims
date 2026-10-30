import React, { useEffect, useState } from 'react';
import MultiSelect from './MultiSelect';
import {
  SERVICE_OPTIONS,
  VENDOR_OPTIONS,
  REGION_OPTIONS,
  CLAIM_TYPE_OPTIONS,
  SEVERITY_OPTIONS,
  EMPTY_FILTERS,
} from '../../models/dashboard/executiveOverviewModel';
import type { AlertSeverity, FilterState } from '../../models/dashboard/executiveOverviewModel';

interface FiltersPanelProps {
  isOpen: boolean;
  filters: FilterState;
  onApply: (next: FilterState) => void;
  onClear: () => void;
  onClose: () => void;
}

const SEVERITY_LABEL_BY_VALUE = new Map(SEVERITY_OPTIONS.map((o) => [o.value, o.label]));
const SEVERITY_VALUE_BY_LABEL = new Map(SEVERITY_OPTIONS.map((o) => [o.label, o.value]));
const SEVERITY_LABELS = SEVERITY_OPTIONS.map((o) => o.label);

const FiltersPanel: React.FC<FiltersPanelProps> = ({ isOpen, filters, onApply, onClear, onClose }) => {
  const [draft, setDraft] = useState<FilterState>(filters);

  useEffect(() => {
    if (isOpen) setDraft(filters);
  }, [isOpen, filters]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleClear = () => {
    setDraft(EMPTY_FILTERS);
    onClear();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Filters</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal__body">
          <div className="filters-panel__body">
            <div>
              <div className="filters-panel__group-label">Service</div>
              <MultiSelect
                options={SERVICE_OPTIONS}
                selected={draft.service}
                onChange={(v) => setDraft((d) => ({ ...d, service: v }))}
                placeholder="All services"
              />
            </div>
            <div>
              <div className="filters-panel__group-label">Service Provider</div>
              <MultiSelect
                options={VENDOR_OPTIONS}
                selected={draft.vendor}
                onChange={(v) => setDraft((d) => ({ ...d, vendor: v }))}
                placeholder="All providers"
              />
            </div>
            <div>
              <div className="filters-panel__group-label">Region</div>
              <MultiSelect
                options={REGION_OPTIONS}
                selected={draft.region}
                onChange={(v) => setDraft((d) => ({ ...d, region: v }))}
                placeholder="All regions"
              />
            </div>
            <div>
              <div className="filters-panel__group-label">Claim Type</div>
              <MultiSelect
                options={CLAIM_TYPE_OPTIONS}
                selected={draft.claimType}
                onChange={(v) => setDraft((d) => ({ ...d, claimType: v }))}
                placeholder="All claim types"
              />
            </div>
            <div>
              <div className="filters-panel__group-label">Severity</div>
              <MultiSelect
                options={SEVERITY_LABELS}
                selected={draft.severity.map((s) => SEVERITY_LABEL_BY_VALUE.get(s) ?? s)}
                onChange={(labels) => setDraft((d) => ({
                  ...d,
                  severity: labels
                    .map((l) => SEVERITY_VALUE_BY_LABEL.get(l))
                    .filter((v): v is AlertSeverity => Boolean(v)),
                }))}
                placeholder="All severities"
              />
            </div>
          </div>
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={handleClear}>Clear All Filters</button>
          <button type="button" className="btn btn--primary" onClick={handleApply}>Apply Filters</button>
        </div>
      </div>
    </div>
  );
};

export default FiltersPanel;
