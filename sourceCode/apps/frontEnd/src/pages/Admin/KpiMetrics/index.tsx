import React, { useState, useCallback, useMemo, useEffect } from 'react';
import AppShell from '../../../components/layout/AppShell';
import { useKpiMetrics } from '../../../hooks/kpiMetrics/useKpiMetrics';
import type { KpiCondition, KpiMetric, KpiGroup, NewMetricPayload, AiRecommendation } from '../../../models/kpiMetrics/kpiMetricsModel';
import { fetchAiRecommendations, acceptAiRecommendation as acceptAiRec } from '../../../services/kpiMetrics/kpiMetricsService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formulaDisplay(conditions: KpiCondition[]): string {
  return conditions
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => [c.fieldName, c.operator, c.value].filter(Boolean).join(' '))
    .join(' · ');
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const ArrowUpIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
  </svg>
);

// ─── AI Recommendations ───────────────────────────────────────────────────────

const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);

interface AiRecCardProps {
  rec:       AiRecommendation;
  accepting: boolean;
  onAccept:  () => void;
  onDecline: () => void;
}

const AiRecCard: React.FC<AiRecCardProps> = ({ rec, accepting, onAccept, onDecline }) => (
  <div className="kpim-ai-card">
    <span className="kpim-ai-card__ai-badge">AI</span>

    <div className="kpim-ai-card__head">
      <span className="kpim-ai-card__service">{rec.serviceName}</span>
      {rec.metricLabel && <span className="kpim-ai-card__meta">{rec.metricLabel}</span>}
    </div>

    <div className="kpim-ai-card__chips">
      <span className="kpim-ai-chip kpim-ai-chip--current">{rec.currentRule || '—'}</span>
      <svg className="kpim-ai-chip-arrow" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
      </svg>
      <span className="kpim-ai-chip kpim-ai-chip--suggested">{rec.suggestedRule || '—'}</span>
    </div>

    <p className="kpim-ai-card__desc">{rec.description}</p>

    <div className="kpim-ai-card__actions">
      <button type="button" className="kpim-ai-accept-btn" onClick={onAccept} disabled={accepting}>
        {accepting ? 'Applying…' : 'Accept'}
      </button>
      <button type="button" className="kpim-ai-decline-btn" onClick={onDecline} disabled={accepting}>
        Decline
      </button>
    </div>
  </div>
);

interface AiSectionProps {
  recs:      AiRecommendation[];
  loading:   boolean;
  accepting: Set<string>;
  declined:  Set<string>;
  onAccept:  (ruleId: string, kpiMatricsGroupTrackingId: string) => void;
  onDecline: (ruleId: string) => void;
}

const AiRecommendationsSection: React.FC<AiSectionProps> = ({
  recs, loading, accepting, declined, onAccept, onDecline,
}) => {
  const [expanded, setExpanded] = useState(true);
  const visible = recs.filter((r) => !declined.has(r.ruleId));
  if (!loading && visible.length === 0) return null;

  return (
    <div className="kpim-ai-section">
      <div
        className="kpim-ai-section__header"
        onClick={() => setExpanded(p => !p)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(p => !p); } }}
      >
        <span className="kpim-ai-section__icon"><SparkleIcon /></span>
        <span className="kpim-ai-section__title">AI Recommendations</span>
        {visible.length > 0 && (
          <span className="kpim-ai-section__badge">{visible.length} active</span>
        )}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#9ca3af" strokeWidth={2.5} strokeLinecap="round"
          className={`kpim-ai-section__chevron${expanded ? ' kpim-ai-section__chevron--open' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      <div className={`kpim-ai-collapse${expanded ? '' : ' kpim-ai-collapse--collapsed'}`}>
        <div className="kpim-ai-collapse__inner">
          {loading ? (
            <div className="kpim-ai-loading">
              <span className="vi-spinner" style={{ borderTopColor: '#3A7BD5' }} />
              Loading recommendations…
            </div>
          ) : (
            <div className="kpim-ai-cards">
              {visible.map((rec) => (
                <AiRecCard
                  key={rec.ruleId}
                  rec={rec}
                  accepting={accepting.has(rec.ruleId)}
                  onAccept={() => onAccept(rec.ruleId, rec.kpiMatricsGroupTrackingId)}
                  onDecline={() => onDecline(rec.ruleId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Condition Row ────────────────────────────────────────────────────────────

interface CondRowProps {
  cond:     KpiCondition;
  index:    number;
  onChange: (i: number, field: keyof KpiCondition, v: string) => void;
  onDelete: (i: number) => void;
}

const CondRow: React.FC<CondRowProps> = ({ cond, index, onChange, onDelete }) => (
  <div className="kpim-cond-row">
    <input className="kpim-cond-input" placeholder="Field" value={cond.fieldName}
      onChange={(e) => onChange(index, 'fieldName', e.target.value)} />
    <select className="kpim-cond-select" value={cond.operator}
      onChange={(e) => onChange(index, 'operator', e.target.value)}>
      <option value="">Op</option>
      {['==', '!=', '>', '<', '>=', '<=', '-', '+', '*', '/'].map((o) => <option key={o}>{o}</option>)}
    </select>
    <input className="kpim-cond-input" placeholder="Value" value={cond.value}
      onChange={(e) => onChange(index, 'value', e.target.value)} />
    <input className="kpim-cond-input kpim-cond-input--show" placeholder="Display Value (e.g. 57%)" value={cond.ShowValue}
      onChange={(e) => onChange(index, 'ShowValue', e.target.value)} />
    <select className="kpim-cond-select kpim-cond-select--type" value={cond.conditionType}
      onChange={(e) => onChange(index, 'conditionType', e.target.value)}>
      <option value="">Type</option>
      {['AND', 'OR', 'THEN', ''].map((t) => <option key={t} value={t}>{t || 'None'}</option>)}
    </select>
    <button type="button" className="kpim-cond-del" onClick={() => onDelete(index)} title="Remove">
      <CloseIcon />
    </button>
  </div>
);

// ─── Metric Form (modal popup) ───────────────────────────────────────────────

interface MetricFormProps {
  roles:              Array<{ roleId: string; roleName: string }>;
  selectedRoleId:     string;
  groups:             KpiGroup[];
  initial?:           KpiMetric & { groupName: string };
  initialVendorKPI?:  boolean;
  saving:             boolean;
  onSave:             (payload: NewMetricPayload) => void;
  onCancel:           () => void;
}

const emptyCondition = (): KpiCondition => ({
  kpiMatricsFieldAndConditionId: '',
  fieldName: '', operator: '', value: '', ShowValue: '', conditionType: '', sortOrder: 0,
});

const MetricForm: React.FC<MetricFormProps> = ({
  roles, selectedRoleId, groups, initial, initialVendorKPI = false, saving, onSave, onCancel,
}) => {
  const [roleInForm,     setRoleInForm]     = useState(selectedRoleId);
  const [isVendorKPI,    setIsVendorKPI]    = useState(initialVendorKPI);

  const filteredGroupOptions = useMemo(
    () => Array.from(new Set(groups.map((g) => g.kpiGroupTracking))),
    [groups, isVendorKPI],
  );

  const [groupTracking,  setGroupTracking]  = useState(() => {
    debugger;
    const initOpts = Array.from(new Set(
      groups.map((g) => g.kpiGroupTracking),
    ));
    return initial?.groupName ?? (initOpts[0] ?? '');
  });
  const [customGroup,    setCustomGroup]    = useState('');
  const [metricName,     setMetricName]     = useState(initial?.kpiGroupTrackingSuggestion ?? '');
  const [suggestion,     setSuggestion]     = useState(initial?.kpiGroupTrackingSuggestion ?? '');
  const [threshGood,     setThreshGood]     = useState(initial?.section?.thresholdsGood ?? '');
  const [threshModerate, setThreshModerate] = useState(initial?.section?.thresholdsModerate ?? '');
  const [threshPoor,     setThreshPoor]     = useState(initial?.section?.thresholdsPoor ?? '');
  const [betterWhen,     setBetterWhen]     = useState(initial?.section?.betterWhen ?? 'Lower');
  const [conditions,     setConditions]     = useState<KpiCondition[]>(
    initial?.conditions.length ? initial.conditions : [emptyCondition()],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setGroupTracking((prev) => {
      if (prev === '__new__') return prev;
      const valid = Array.from(new Set(
        groups.map((g) => g.kpiGroupTracking),
      ));
      return valid.includes(prev) ? prev : (valid[0] ?? '');
    });
  }, [isVendorKPI, groups]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!roleInForm) e['role'] = 'Service Request Role is required.';
    const group = groupTracking === '__new__' ? customGroup.trim() : groupTracking.trim();
    if (!group) e['group'] = 'KPI Group is required.';
    if (!metricName.trim()) e['name'] = 'Metric name is required.';
    if (!betterWhen) e['betterWhen'] = 'Better When is required.';
    if (conditions.every((c) => !c.fieldName.trim())) e['conditions'] = 'At least one field is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCondChange = useCallback((i: number, field: keyof KpiCondition, v: string) => {
    setConditions((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: v } : c));
  }, []);

  const handleCondDelete = useCallback((i: number) => {
    setConditions((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const addCondition = () =>
    setConditions((prev) => [...prev, { ...emptyCondition(), sortOrder: prev.length }]);

  const handleSubmit = () => {
    if (!validate()) return;
    const group = groupTracking === '__new__' ? customGroup.trim() : groupTracking.trim();
    onSave({
      serviceRequestRoleId: roleInForm,
      kpiGroupTracking: group,
      kpiGroupTrackingName: metricName.trim(),
      kpiGroupTrackingSuggestion: metricName.trim(),
      thresholdsGood: threshGood.trim(),
      thresholdsModerate: threshModerate.trim(),
      thresholdsPoor: threshPoor.trim(),
      betterWhen,
      isVendorKPI,
      conditions: conditions
        .filter((c) => c.fieldName.trim())
        .map((c, i) => ({ ...c, sortOrder: i })),
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal__header" style={{ background: '#562a9e', color: '#fff' }}>
          <h2 className="modal__title" style={{ color: '#fff' }}>{initial ? 'Edit Metric' : 'New Metric'}</h2>
          <button type="button" className="modal__close" onClick={onCancel} aria-label="Close" style={{ color: '#fff' }}>
            <CloseIcon />
          </button>
        </div>

        <div className="modal__body" style={{ gap: 0 }}>

          {/* 3-col grid — Row 1: Role | Type | KPI Group  ·  Row 2: Name | Description | Better When  ·  Row 3: Thresholds (full-width) */}
          <div className="vsr-form-grid" style={{ marginBottom: 16 }}>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label form-label--required">Service Request Role</label>
              <select
                className={`form-select${errors['role'] ? ' form-input--error' : ''}`}
                value={roleInForm}
                onChange={(e) => setRoleInForm(e.target.value)}
                disabled={!!initial}
              >
                <option value="">— Select a role —</option>
                {roles.map((r) => (
                  <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                ))}
              </select>
              {errors['role'] && <span className="form-error">{errors['role']}</span>}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label form-label--required">Type</label>
              <div className="kpim-type-radio-group">
                <label className="kpim-type-radio">
                  <input type="radio" name="kpiType" value="claim" checked={!isVendorKPI} onChange={() => setIsVendorKPI(false)} />
                  <span className="kpim-type-radio__label">Claim</span>
                </label>
                <label className="kpim-type-radio">
                  <input type="radio" name="kpiType" value="vendor" checked={isVendorKPI} onChange={() => setIsVendorKPI(true)} />
                  <span className="kpim-type-radio__label">Service Provider</span>
                </label>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label form-label--required">KPI Group</label>
              <select className={`form-select${errors['group'] ? ' form-input--error' : ''}`}
                value={groupTracking} onChange={(e) => setGroupTracking(e.target.value)}>
                {filteredGroupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              {groupTracking === '__new__' && (
                <input className="form-input" style={{ marginTop: 6 }}
                  placeholder="Enter new group name" value={customGroup}
                  onChange={(e) => setCustomGroup(e.target.value)} />
              )}
              {errors['group'] && <span className="form-error">{errors['group']}</span>}
            </div>

            <div className="form-group" style={{ gridColumn: '1 / 3', marginBottom: 0 }}>
              <label className="form-label form-label--required">Metric Name</label>
              <input className={`form-input${errors['name'] ? ' form-input--error' : ''}`}
                placeholder="e.g. Records Retrieval TAT" value={metricName}
                onChange={(e) => setMetricName(e.target.value)} />
              {errors['name'] && <span className="form-error">{errors['name']}</span>}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label form-label--required">Better When</label>
              <div className="kpim-bw-toggle">
                {(['Higher', 'Lower'] as const).map((v) => (
                  <button key={v} type="button"
                    className={`kpim-bw-btn${betterWhen === v ? ' kpim-bw-btn--active' : ''}`}
                    onClick={() => setBetterWhen(v)}>
                    {v === 'Higher' ? <ArrowUpIcon /> : <ArrowDownIcon />}
                    {v}
                  </button>
                ))}
              </div>
              {errors['betterWhen'] && <span className="form-error">{errors['betterWhen']}</span>}
            </div>

            {/* Description — full-width textarea directly below Metric Name */}
            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                placeholder="Brief description"
                value={suggestion}
                rows={3}
                style={{ resize: 'vertical' }}
                onChange={(e) => setSuggestion(e.target.value)}
              />
            </div>

            {/* Thresholds spans all 3 columns */}
            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
              <label className="form-label">Thresholds</label>
              <div className="kpim-thresh-inputs">
                <label className="kpim-thresh-input-label kpim-thresh-input-label--good">
                  <span className="kpim-thresh__dot kpim-thresh__dot--good" /> Good
                </label>
                <input className="form-input" style={{ flex: 1, minWidth: 60 }} placeholder="e.g. 3" value={threshGood}
                  onChange={(e) => setThreshGood(e.target.value)} />
                <label className="kpim-thresh-input-label kpim-thresh-input-label--moderate">
                  <span className="kpim-thresh__dot kpim-thresh__dot--moderate" /> Moderate
                </label>
                <input className="form-input" style={{ flex: 1, minWidth: 60 }} placeholder="e.g. 7" value={threshModerate}
                  onChange={(e) => setThreshModerate(e.target.value)} />
                <label className="kpim-thresh-input-label kpim-thresh-input-label--poor">
                  <span className="kpim-thresh__dot kpim-thresh__dot--poor" /> Poor
                </label>
                <input className="form-input" style={{ flex: 1, minWidth: 60 }} placeholder="e.g. 7" value={threshPoor}
                  onChange={(e) => setThreshPoor(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Formula Conditions — full-width, visually separated */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label form-label--required">Formula Conditions</label>
              <div className="kpim-cond-list">
                {conditions.map((c, i) => (
                  <CondRow key={i} cond={c} index={i} onChange={handleCondChange} onDelete={handleCondDelete} />
                ))}
              </div>
              {errors['conditions'] && <span className="form-error">{errors['conditions']}</span>}
              <button type="button" className="kpim-add-cond-btn" onClick={addCondition}>
                <PlusIcon /> Add Condition
              </button>
            </div>
          </div>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : (initial ? 'Update Metric' : 'Create Metric')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  metric:    KpiMetric;
  groupName: string;
  saving:    boolean;
  onToggle:  (id: string) => void;
  onEdit:    (metric: KpiMetric, groupName: string) => void;
  onDelete:  (id: string, name: string) => void;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric, groupName, saving, onToggle, onEdit, onDelete }) => {
  const formula = formulaDisplay(metric.conditions);
  const { section } = metric;
  const bw = section?.betterWhen ?? '';

  return (
    <div className={`kpim-card${metric.isActive ? '' : ' kpim-card--inactive'}`}>

      {/* Header: drag-handle · name · type badge · ACTIVE label + toggle */}
      <div className="kpim-card__header">
        <span className="kpim-card__drag" aria-hidden="true">⠿</span>
        <span className="kpim-card__name">{metric.kpiGroupTrackingSuggestion}</span>
        <span className={`kpim-card__type-badge kpim-card__type-badge--${metric.isVendorKPI ? 'vendor' : 'claim'}`}>
          {metric.isVendorKPI ? 'Provider' : 'Claim'}
        </span>
        <div className="kpim-card__toggle-group">
          <span className="kpim-card__active-label">ACTIVE</span>
          <button
            type="button"
            className={`kpim-toggle${metric.isActive ? ' kpim-toggle--on' : ''}`}
            onClick={() => onToggle(metric.kpiMatricsGroupTrackingId)}
            disabled={saving}
            title={metric.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
            aria-label="Toggle active"
          >
            <span className="kpim-toggle__thumb" />
          </button>
        </div>
      </div>

      {/* Formula */}
      {formula && (
        <div className="kpim-card__section">
          <span className="kpim-card__section-label">FORMULA</span>
          <div className="kpim-card__formula-box">
            {formula}
          </div>
        </div>
      )}

      {/* Thresholds */}
      {section && (section.thresholdsGood || section.thresholdsModerate || section.thresholdsPoor) && (
        <div className="kpim-card__section">
          <span className="kpim-card__section-label">THRESHOLDS</span>
          <div className="kpim-card__thresholds">
            {section.thresholdsGood && (
              <span className="kpim-thresh kpim-thresh--good">
                <span className="kpim-thresh__dot kpim-thresh__dot--good" />
                Good ≥ <span className="kpim-thresh__val">{section.thresholdsGood}</span> d
              </span>
            )}
            {section.thresholdsModerate && (
              <span className="kpim-thresh kpim-thresh--moderate">
                <span className="kpim-thresh__dot kpim-thresh__dot--moderate" />
                Moderate ≥ <span className="kpim-thresh__val">{section.thresholdsModerate}</span> d
              </span>
            )}
            {section.thresholdsPoor && (
              <span className="kpim-thresh kpim-thresh--poor">
                <span className="kpim-thresh__dot kpim-thresh__dot--poor" />
                Poor &lt; <span className="kpim-thresh__val">{section.thresholdsPoor}</span> d
              </span>
            )}
          </div>
        </div>
      )}

      {/* Better When */}
      {bw && (
        <div className="kpim-card__section">
          <span className="kpim-card__section-label">BETTER WHEN</span>
          <div className="kpim-card__bw-group">
            <span className={`kpim-bw-display${bw === 'Higher' ? ' kpim-bw-display--active' : ''}`}>
              <ArrowUpIcon /> Higher
            </span>
            <span className={`kpim-bw-display${bw === 'Lower' ? ' kpim-bw-display--active' : ''}`}>
              <ArrowDownIcon /> Lower
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="kpim-card__footer">
        <span className="kpim-card__meta">
          Last modified by {metric.updatedBy || 'Admin'} · {formatDate(metric.updatedAt)}
        </span>
        <div className="kpim-card__footer-actions">
          <button type="button" className="kpim-card__edit-btn" disabled={saving}
            onClick={() => onEdit(metric, groupName)}>
            <PencilIcon /> Edit
          </button>
          <button type="button" className="kpim-card__delete" disabled={saving}
            onClick={() => onDelete(metric.kpiMatricsGroupTrackingId, metric.kpiGroupTrackingSuggestion)}>
            <TrashIcon /> Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

type EditTarget  = { metric: KpiMetric; groupName: string } | null;
type DeleteTarget = { id: string; name: string } | null;

const KpiMetrics: React.FC = () => {
  const {
    roles, selectedRole, groups,
    rolesLoading, loading, saving, error, notification,
    selectRole, createMetric, updateMetric, toggleMetric, deleteMetric, refreshMetrics,
  } = useKpiMetrics();

  const [showForm,      setShowForm]      = useState(false);
  const [editTarget,    setEditTarget]    = useState<EditTarget>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<DeleteTarget>(null);

  // ── AI Recommendations ─────────────────────────────────────────────────────
  const [aiRecs,      setAiRecs]      = useState<AiRecommendation[]>([]);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiAccepting, setAiAccepting] = useState<Set<string>>(new Set());
  const [aiDeclined,  setAiDeclined]  = useState<Set<string>>(new Set());

  useEffect(() => {
    setAiLoading(true);
    fetchAiRecommendations()
      .then(setAiRecs)
      .catch(() => { /* silently skip if no recommendations data */ })
      .finally(() => setAiLoading(false));
  }, []);

  const handleAiAccept = useCallback(async (id: string, kpiMatricsGroupTrackingId: string) => {
    setAiAccepting((prev) => new Set(prev).add(id));
    try {
      // The accept endpoint only returns { success } — the new rule text is
      // already known locally as the recommendation's own suggestedRule.
      await acceptAiRec(id, kpiMatricsGroupTrackingId);
      setAiRecs((prev) =>
        prev.map((r) =>
          r.ruleId === id
            ? { ...r, currentRule: r.suggestedRule, suggestedRule: '' }
            : r,
        ),
      );
      setAiDeclined((prev) => new Set(prev).add(id));
      // Refresh main KPI list if the updated metric is in the current role view
      refreshMetrics();
    } catch {
      // accept failed — leave card in place
    } finally {
      setAiAccepting((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [refreshMetrics]);

  const handleAiDecline = useCallback((id: string) => {
    setAiDeclined((prev) => new Set(prev).add(id));
  }, []);

  const handleSave = useCallback(async (payload: NewMetricPayload) => {
    if (editTarget) {
      await updateMetric(editTarget.metric.kpiMatricsGroupTrackingId, payload);
    } else {
      await createMetric(payload);
    }
    setShowForm(false);
    setEditTarget(null);
  }, [editTarget, createMetric, updateMetric]);

  const openEdit = useCallback((metric: KpiMetric, groupName: string) => {
    setEditTarget({ metric, groupName });
    setShowForm(true);
  }, []);

  const openCreate = useCallback(() => {
    setEditTarget(null);
    setShowForm(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteMetric(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteMetric]);

  const totalMetrics = groups.reduce((sum, g) => sum + g.metrics.length, 0);

  const fieldChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: string[] = [];
    groups.forEach((g) =>
      g.metrics.forEach((m) =>
        m.conditions.forEach((c) => {
          if (c.fieldName && !seen.has(c.fieldName)) {
            seen.add(c.fieldName);
            chips.push(c.fieldName);
          }
        })
      )
    );
    return chips.slice(0, 6);
  }, [groups]);

  return (
    <AppShell>
      <div className="kpim-wrapper">

        {/* ── Page Header — its own separate heading tile, same treatment
            as Claims Command Center / Claim Orchestration Engine ──────── */}
        <div className="dash-header-card">
          <div className="dash-title-row">
            <h1 className="kpim-title">Service Metrics Configuration</h1>
            <p className="kpim-subtitle">
              Tune the metrics and thresholds that drive provider performance scoring.
            </p>
          </div>
        </div>

        {/* ── AI Recommendations + config sub-header (on gray background) ── */}
        <div className="kpim-header">
          <div>
            <AiRecommendationsSection
              recs={aiRecs}
              loading={aiLoading}
              accepting={aiAccepting}
              declined={aiDeclined}
              onAccept={handleAiAccept}
              onDecline={handleAiDecline}
            />
            <div className="kpim-config-header">
              <h2 className="kpim-config-header__title">Metrics Configuration</h2>
              <p className="kpim-config-header__desc">Define claim-level metrics per service. Changes apply to the Performance tab across all claim records.</p>
            </div>
            <div className="kpim-selected-services">
              {selectedRole ? (
                <>
                  <span className="kpim-selected-services__label">Selected Service:</span>
                  <span className="kpim-selected-service-chip">
                    <span className="kpim-selected-service-chip__dot" />
                    <span className="kpim-selected-service-chip__name">{selectedRole.roleName}</span>
                    {selectedRole.roleCode && (
                      <span className="kpim-selected-service-chip__code">{selectedRole.roleCode}</span>
                    )}
                  </span>
                </>
              ) : (
                <span className="kpim-selected-services__empty">No service selected — pick one from the left panel</span>
              )}
            <button type="button" className="kpim-new-btn" onClick={openCreate}
              disabled={!selectedRole} title={!selectedRole ? 'Select a service first' : 'Add new KPI metric'}>
              <PlusIcon /> New Metric
            </button>
            </div>

            {/* Services list + Content panel — side by side, still inside
                the same common section as AI Recommendations/Metrics
                Configuration */}
            <div className="kpim-layout">
              <aside className="kpim-services">
                <div className="kpim-services__header">SERVICES</div>
                {rolesLoading && <p className="kpim-services__loading">Loading…</p>}
                <ul className="kpim-services__list">
                  {roles.map((role) => {
                    const isActive = selectedRole?.roleId === role.roleId;
                    return (
                      <li key={role.roleId}
                        className={`kpim-service${isActive ? ' kpim-service--active' : ''}`}
                        onClick={() => selectRole(role)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') selectRole(role); }}
                      >
                        <span className="kpim-service__dot" />
                        <div className="kpim-service__body">
                          <span className="kpim-service__name">{role.roleName}</span>
                          {role.roleCode && <span className="kpim-service__code">{role.roleCode}</span>}
                        </div>
                        <span className="kpim-service__count">
                          {isActive ? totalMetrics : ''}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </aside>

          {/* Content panel */}
          <div className="kpim-content-panel">
            {!selectedRole ? (
              <div className="kpim-empty-panel">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={1.5} strokeLinecap="round" style={{ color: '#d1d5db', marginBottom: 8 }}>
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
                <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>No service selected</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>
                  Select a service from the left panel to view its KPI metrics.
                </p>
              </div>
            ) : (
              <>
                {/* Role header (white) */}
                <div className="kpim-role-header">
                  <div className="kpim-role-header__top">
                    <div className="kpim-role-header__left">
                      <h2 className="kpim-role-name">{selectedRole.roleName}</h2>
                      <div className="kpim-role-tags">
                        {selectedRole.roleCode && (
                          <span className="kpim-role-tag">{selectedRole.roleCode}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fields queried bar (dark) */}
                <div className="kpim-fields-bar">
                  <span className="kpim-fields-bar__label">FIELDS QUERIED</span>
                </div>

                {/* Notifications */}
                {notification && (
                  <div className={`alert alert--${notification.type === 'success' ? 'success' : 'error'}`}
                    role="alert" style={{ margin: '8px 16px 0' }}>
                    {notification.text}
                  </div>
                )}
                {error && (
                  <div className="alert alert--error" role="alert" style={{ margin: '8px 16px 0' }}>
                    {error}
                  </div>
                )}

                {/* Scrollable metrics body */}
                <div className="kpim-metrics-body">
                  {loading && (
                    <div className="kpim-metrics-loading">
                      <span className="vi-spinner" style={{ borderTopColor: 'var(--color-primary)' }} />
                      Loading KPI metrics…
                    </div>
                  )}

                  {!loading && groups.length === 0 && (
                    <div className="kpim-metrics-empty">
                      <p>No KPI metrics configured for this service.</p>
                      <button type="button" className="btn btn--primary" onClick={openCreate}>
                        <PlusIcon /> New Metric
                      </button>
                    </div>
                  )}

                  {!loading && groups.map((group) => (
                    <div key={group.kpiMatricsId} className="kpim-group">
                      <div className="kpim-group-header">
                        <span className="kpim-group-label">{group.kpiGroupTracking}</span>
                      </div>
                      {group.metrics.map((metric) => (
                        <MetricCard
                          key={metric.kpiMatricsGroupTrackingId}
                          metric={metric}
                          groupName={group.kpiGroupTracking}
                          saving={saving}
                          onToggle={toggleMetric}
                          onEdit={openEdit}
                          onDelete={(id, name) => setDeleteTarget({ id, name })}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Create / Edit Form (modal popup) ── */}
      {showForm && selectedRole && (
        <MetricForm
          roles={roles}
          selectedRoleId={selectedRole.roleId}
          groups={groups}
          initial={editTarget ? { ...editTarget.metric, groupName: editTarget.groupName } : undefined}
          initialVendorKPI={editTarget ? (editTarget.metric.isVendorKPI ?? false) : false}
          saving={saving}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal__header">
              <h2 className="modal__title">Delete Metric</h2>
              <button type="button" className="modal__close" onClick={() => setDeleteTarget(null)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <div className="modal__body">
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                Delete <strong>{deleteTarget.name}</strong>? This will also remove all associated
                thresholds and formula conditions. This action cannot be undone.
              </p>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--ghost"
                onClick={() => setDeleteTarget(null)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn--danger"
                onClick={confirmDelete} disabled={saving}>
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default KpiMetrics;
