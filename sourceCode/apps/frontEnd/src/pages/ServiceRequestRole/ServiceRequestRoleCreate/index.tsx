import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import AppShell from '../../../components/layout/AppShell';
import { useServiceRequestRoleCreate } from '../../../hooks/ServiceRequestRole/useServiceRequestRoleCreate';
import { ROLE_STATUS_OPTIONS, LINE_OF_BUSINESS_OPTIONS } from '../../../models/ServiceRequestRole/serviceRequestRoleModel';
import type { NlpFieldMapping } from '../../../models/ServiceRequestRole/serviceRequestRoleModel';

// ─── Icons ────────────────────────────────────────────────────────────────────

const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const BackIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="spin">
    <path d="M21 12a9 9 0 11-6.22-8.56"/>
  </svg>
);

// ─── Autocomplete helpers ─────────────────────────────────────────────────────

function capitalizeWords(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function getWordRangeAtCursor(
  text: string,
  cursor: number,
): { word: string; start: number; end: number } {
  const boundary = /[\s()'"><!=,]/;
  let start = cursor;
  while (start > 0 && !boundary.test(text[start - 1])) start--;
  let end = cursor;
  while (end < text.length && !boundary.test(text[end])) end++;
  return { word: text.slice(start, cursor), start, end };
}

function filterSuggestions(word: string, mappings: NlpFieldMapping[]): NlpFieldMapping[] {
  if (word.length < 2) return [];
  const lower = word.toLowerCase();
  return mappings
    .filter((m) =>
      m.nlpAlias.startsWith(lower) ||
      m.nlpAlias.split(' ').some((w) => w.startsWith(lower)) ||
      m.sourceField.toLowerCase().startsWith(lower),
    )
    .slice(0, 8);
}

/**
 * Sync font and spacing from the textarea to the hidden measure div so text
 * wraps identically — a prerequisite for accurate cursor-pixel calculation.
 */
function syncMeasureStyles(textarea: HTMLTextAreaElement, measure: HTMLDivElement): void {
  const s = window.getComputedStyle(textarea);
  const m = measure.style;
  m.fontFamily     = s.fontFamily;
  m.fontSize       = s.fontSize;
  m.fontWeight     = s.fontWeight;
  m.lineHeight     = s.lineHeight;
  m.letterSpacing  = s.letterSpacing;
  m.paddingTop     = s.paddingTop;
  m.paddingRight   = s.paddingRight;
  m.paddingBottom  = s.paddingBottom;
  m.paddingLeft    = s.paddingLeft;
  m.borderTopWidth    = s.borderTopWidth;
  m.borderRightWidth  = s.borderRightWidth;
  m.borderBottomWidth = s.borderBottomWidth;
  m.borderLeftWidth   = s.borderLeftWidth;
}

/**
 * Calculate the pixel position of the cursor inside the textarea wrapper.
 * Fills the hidden measure div with the text up to the cursor, appends a
 * zero-width caret span, and reads its bounding rect relative to the wrapper.
 *
 * The returned coordinates position the popup just below the current line.
 */
function getCursorPixelPos(
  textarea: HTMLTextAreaElement,
  measure: HTMLDivElement,
  cursorIndex: number,
): { top: number; left: number } {
  const wrapper = textarea.parentElement!;

  // Match measure div width so wrapping is identical to the textarea
  measure.style.width = `${textarea.clientWidth}px`;

  // Fill with text up to cursor (preserves newlines via pre-wrap)
  measure.textContent = '';
  measure.appendChild(document.createTextNode(textarea.value.slice(0, cursorIndex)));

  // A zero-width span marks the exact caret position
  const caret = document.createElement('span');
  caret.textContent = '​';
  measure.appendChild(caret);

  const wrapRect  = wrapper.getBoundingClientRect();
  const caretRect = caret.getBoundingClientRect();
  const lineH     = parseFloat(window.getComputedStyle(textarea).lineHeight) || 20;

  // Popup appears one line below the cursor; subtract textarea scroll offset
  let top  = caretRect.top  - wrapRect.top  - textarea.scrollTop + lineH;
  let left = caretRect.left - wrapRect.left;

  // Clamp left so popup doesn't overflow the right edge of the wrapper
  const POPUP_W = 240;
  if (left + POPUP_W > wrapper.clientWidth) {
    left = Math.max(0, wrapper.clientWidth - POPUP_W);
  }

  // Clean up the caret span to avoid stale content
  measure.removeChild(caret);

  return { top, left };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const ServiceRequestRoleCreate: React.FC = () => {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    roles, selectedRoleId, roleForm, nlpFieldMappings,
    isLoading, isSaving, errors, isDirty, nlpSaveSuccess,
    selectRole, startNewRole, updateForm,
    generateConditionsFromNlp,
    saveRole, cancel,
  } = useServiceRequestRoleCreate();

  const [isEditMode, setIsEditMode] = useState(false);

  // ── Autocomplete state ─────────────────────────────────────────────────────
  const textareaRef                       = useRef<HTMLTextAreaElement>(null);
  const measureRef                        = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions]     = useState<NlpFieldMapping[]>([]);
  const [activeSuggIdx, setActiveSuggIdx] = useState(-1);
  const [wordRange, setWordRange]         = useState<{ start: number; end: number } | null>(null);
  const [popupPos, setPopupPos]           = useState<{ top: number; left: number } | null>(null);

  // ── Derived state ──────────────────────────────────────────────────────────
  const isNewRole = !selectedRoleId;
  const isEditing = isNewRole || isEditMode;

  const screenTitle = isNewRole
    ? 'Create Service Request Rule'
    : isEditMode ? 'Edit Service Request Rule' : 'View Service Request Rule';

  // ── Load role from ?roleId= query param ───────────────────────────────────
  const queryRoleId = searchParams.get('roleId');
  useEffect(() => {
    if (queryRoleId && roles.length > 0 && !selectedRoleId) {
      selectRole(queryRoleId).catch(() => {});
      setIsEditMode(false);
    }
  }, [queryRoleId, roles, selectedRoleId, selectRole]);

  // Sync measure div font metrics once after the textarea mounts
  useEffect(() => {
    if (textareaRef.current && measureRef.current) {
      syncMeasureStyles(textareaRef.current, measureRef.current);
    }
  }, []);

  const handleAddRole = useCallback(() => {
    startNewRole(); setIsEditMode(false);
  }, [startNewRole]);

  const handleCancelEdit = useCallback(() => {
    cancel(); setIsEditMode(false);
  }, [cancel]);

  const handleSave = useCallback(async () => {
    const ok = await saveRole();
    if (ok) navigate('/service-request-role');
  }, [saveRole, navigate]);

  // ── Autocomplete: change handler — filters suggestions + computes popup pos ──
  const handleNlpChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isEditing) return;
      const value  = e.target.value;
      const cursor = e.target.selectionStart ?? value.length;
      updateForm('nlpCondition', value);

      const { word, start, end } = getWordRangeAtCursor(value, cursor);
      const matches = filterSuggestions(word, nlpFieldMappings);

      if (matches.length > 0 && textareaRef.current && measureRef.current) {
        setSuggestions(matches);
        setActiveSuggIdx(-1);
        setWordRange({ start, end });
        setPopupPos(getCursorPixelPos(textareaRef.current, measureRef.current, cursor));
      } else {
        setSuggestions([]);
        setActiveSuggIdx(-1);
        setWordRange(null);
        setPopupPos(null);
      }
    },
    [isEditing, updateForm, nlpFieldMappings],
  );

  // ── Autocomplete: insert selected suggestion ───────────────────────────────
  const insertSuggestion = useCallback(
    (mapping: NlpFieldMapping) => {
      if (!wordRange) return;
      const text    = roleForm.nlpCondition;
      const newText = text.slice(0, wordRange.start) + mapping.nlpAlias + text.slice(wordRange.end);
      updateForm('nlpCondition', newText);
      setSuggestions([]);
      setActiveSuggIdx(-1);
      setWordRange(null);
      setPopupPos(null);
      const newCursor = wordRange.start + mapping.nlpAlias.length;
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(newCursor, newCursor);
      }, 0);
    },
    [wordRange, roleForm.nlpCondition, updateForm],
  );

  const dismissSuggestions = useCallback(() => {
    setSuggestions([]);
    setActiveSuggIdx(-1);
    setPopupPos(null);
  }, []);

  // ── Autocomplete: keyboard navigation ─────────────────────────────────────
  const handleNlpKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (suggestions.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggIdx((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggIdx((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Enter' && activeSuggIdx >= 0) {
        e.preventDefault();
        insertSuggestion(suggestions[activeSuggIdx]);
      } else if (e.key === 'Escape') {
        dismissSuggestions();
      }
    },
    [suggestions, activeSuggIdx, insertSuggestion, dismissSuggestions],
  );

  return (
    <AppShell>
      <div className="page-card">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="page-header page-header--with-action">
          <div>
            <div className="srr-breadcrumb">
              <span className="srr-breadcrumb__link" role="button" tabIndex={0}
                onClick={() => navigate('/service-request-role')}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate('/service-request-role'); }}>
                Home
              </span>
              <span className="srr-breadcrumb__sep">/</span>
              <span className="srr-breadcrumb__link" role="button" tabIndex={0}
                onClick={() => navigate('/service-request-role')}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate('/service-request-role'); }}>
                {screenTitle}
              </span>
            </div>
            <h1 className="page-title">{screenTitle}</h1>
            <p className="page-subtitle">Configure roles, conditions and rules for service request assignment.</p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/service-request-role')}>
              <BackIcon /> Back
            </button>
            {isNewRole && (
              <button type="button" className="btn btn--primary" onClick={handleAddRole}>
                <PlusIcon /> Add Rule
              </button>
            )}
            {!isNewRole && !isEditMode && (
              <button type="button" className="btn btn--primary" onClick={() => setIsEditMode(true)}>
                <PencilIcon /> Edit Rule
              </button>
            )}
          </div>
        </div>

        {/* ── Notifications ─────────────────────────────────────────────── */}
        {errors['load'] && <div className="alert alert--error notification-bar" role="alert">{errors['load']}</div>}
        {errors['save'] && <div className="alert alert--error notification-bar" role="alert">{errors['save']}</div>}

        {/* ── Rule Library Panel ────────────────────────────────────────── */}
        <div style={{ padding: '20px' }}>
          <div className="srr-panel">

            <div className="srr-tabs">
              <span className="srr-tab srr-tab--active" style={{ cursor: 'default' }}>Rule Library</span>
            </div>

            {/* ── Role Details Form ──────────────────────────────────────── */}
            <div className="srr-role-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <h3 className="srr-role-details__title" style={{ margin: 0 }}>
                  {isNewRole ? 'New Rule' : 'Rule Details'}
                </h3>
                {!isNewRole && !isEditMode && (
                  <span className="srr-view-badge">View Mode</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                {/* Left column — Rule Name + Status stacked */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div className="form-group">
                    <label className="form-label form-label--required">Rule Name</label>
                    <input type="text"
                      className={`form-input${errors['roleName'] ? ' form-input--error' : ''}${!isEditing ? ' form-input--readonly' : ''}`}
                      placeholder="e.g. Medical Review Rule"
                      value={roleForm.roleName}
                      onChange={(e) => isEditing && updateForm('roleName', e.target.value)}
                      readOnly={!isEditing}
                      aria-label="Rule Name"
                    />
                    {errors['roleName'] && <span className="form-error">{errors['roleName']}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className={`form-input${!isEditing ? ' form-input--readonly' : ''}`}
                      value={roleForm.status}
                      onChange={(e) => isEditing && updateForm('status', e.target.value)}
                      disabled={!isEditing}
                      aria-label="Status"
                    >
                      {ROLE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label--required">Line of Business</label>
                    <div
                      role="group"
                      aria-label="Line of Business"
                      style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', padding: isEditing ? 0 : '2px 0' }}
                    >
                      {LINE_OF_BUSINESS_OPTIONS.map((l) => {
                        const checked = roleForm.lineOfBusiness.includes(l);
                        if (!isEditing && !checked) return null;
                        return (
                          <label key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text)', cursor: isEditing ? 'pointer' : 'default' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!isEditing}
                              onChange={() => {
                                if (!isEditing) return;
                                const next = checked
                                  ? roleForm.lineOfBusiness.filter((v) => v !== l)
                                  : [...roleForm.lineOfBusiness, l];
                                updateForm('lineOfBusiness', next);
                              }}
                            />
                            {l}
                          </label>
                        );
                      })}
                      {!isEditing && roleForm.lineOfBusiness.length === 0 && <span className="text-sm-muted">—</span>}
                    </div>
                    {errors['lineOfBusiness'] && <span className="form-error">{errors['lineOfBusiness']}</span>}
                  </div>
                </div>

                {/* Right column — Description */}
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label className="form-label form-label--required">Description</label>
                  <textarea
                    className={`form-textarea${errors['description'] ? ' form-input--error' : ''}${!isEditing ? ' form-input--readonly' : ''}`}
                    placeholder="Describe what this rule does…"
                    rows={3}
                    value={roleForm.description}
                    onChange={(e) => isEditing && updateForm('description', e.target.value)}
                    readOnly={!isEditing}
                    aria-label="Description"
                    style={{ minHeight: 72, resize: isEditing ? 'vertical' : 'none' }}
                  />
                  {errors['description'] && <span className="form-error">{errors['description']}</span>}
                </div>
              </div>

              {/* QAI Intelligence Label — shown in Claim Orchestrator */}
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">QAI Intelligence Description</label>
                <textarea
                  className={`form-textarea${!isEditing ? ' form-input--readonly' : ''}`}
                  placeholder="Plain-English explanation shown in the Claim Orchestrator QAI Intelligence panel for this service…"
                  rows={2}
                  value={roleForm.nlpConditionInWords}
                  onChange={(e) => isEditing && updateForm('nlpConditionInWords', e.target.value)}
                  readOnly={!isEditing}
                  aria-label="QAI Intelligence Description"
                  style={{ minHeight: 56, resize: isEditing ? 'vertical' : 'none' }}
                />
              </div>
            </div>

            {/* ── NLP Rule Builder ──────────────────────────────────────── */}
            <div className="srr-conditions-section" style={{ borderTop: '1px solid var(--color-border)' }}>
              <h3 className="srr-conditions-title">NLP Rule Builder</h3>

              <div className="srr-nlp-builder">
                <div className="srr-nlp-builder__labels">
                  <label className="form-label form-label--required">NLP Rule Condition</label>
                  <label className="form-label">Condition Expression</label>
                </div>
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, marginTop: 0 }}>
                  Describe your rule in plain English, then click the arrow to generate the condition expression.
                  You may also type a condition expression directly.
                </p>

                <div className="srr-nlp-builder__row">

                  {/* ── NLP textarea with cursor-anchored popup ───────────── */}
                  <div className="srr-nlp-builder__textarea-wrap">

                    {/* Hidden mirror — used only to compute cursor pixel position */}
                    <div ref={measureRef} className="srr-nlp-measure" aria-hidden="true" />

                    {/* IDE-style popup anchored to the cursor coordinates */}
                    {isEditing && suggestions.length > 0 && popupPos && (
                      <div
                        className="srr-nlp-popup"
                        role="listbox"
                        aria-label="Field suggestions"
                        style={{ top: popupPos.top, left: popupPos.left }}
                      >
                        {suggestions.map((m, i) => (
                          <div
                            key={m.sourceField}
                            role="option"
                            aria-selected={i === activeSuggIdx}
                            className={`srr-nlp-popup__item${i === activeSuggIdx ? ' srr-nlp-popup__item--active' : ''}`}
                            onMouseDown={(e) => { e.preventDefault(); insertSuggestion(m); }}
                          >
                            <span className="srr-nlp-popup__label">{capitalizeWords(m.nlpAlias)}</span>
                            <span className="srr-nlp-popup__hint">{m.sourceField}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <textarea
                      ref={textareaRef}
                      className={`form-textarea srr-nlp-builder__textarea${errors['nlpCondition'] ? ' form-input--error' : ''}${!isEditing ? ' form-input--readonly' : ''}`}
                      rows={4}
                      placeholder="e.g. Claim amount greater than 10000 and injury type contains soft tissue"
                      value={roleForm.nlpCondition}
                      readOnly={!isEditing}
                      onChange={handleNlpChange}
                      onKeyDown={handleNlpKeyDown}
                      onBlur={() => setTimeout(dismissSuggestions, 150)}
                      onCopy={(e)        => { if (isEditing) e.preventDefault(); }}
                      onCut={(e)         => { if (isEditing) e.preventDefault(); }}
                      onPaste={(e)       => { if (isEditing) e.preventDefault(); }}
                      onContextMenu={(e) => { if (isEditing) e.preventDefault(); }}
                      aria-label="NLP Rule Condition"
                      aria-autocomplete="list"
                      aria-expanded={suggestions.length > 0}
                    />
                  </div>

                  {isEditing && (
                    <button
                      type="button"
                      className="srr-nlp-builder__arrow"
                      title="Parse NLP statement into condition expression"
                      disabled={!roleForm.nlpCondition.trim()}
                      onClick={() => generateConditionsFromNlp()}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </button>
                  )}

                  <textarea
                    className={`form-textarea srr-nlp-builder__condition${!isEditing ? ' form-input--readonly' : ''}`}
                    rows={4}
                    placeholder="Generated condition expression will appear here…"
                    value={roleForm.conditionExpression}
                    readOnly={!isEditing}
                    onChange={(e) => isEditing && updateForm('conditionExpression', e.target.value)}
                    aria-label="Condition Expression"
                  />
                </div>

                {errors['nlpCondition'] && <span className="form-error">{errors['nlpCondition']}</span>}
                {errors['nlp'] && <div className="srr-nlp-builder__error">{errors['nlp']}</div>}
                {nlpSaveSuccess && (
                  <div className="srr-nlp-builder__success" role="status">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    {nlpSaveSuccess}
                  </div>
                )}
              </div>

              {!isEditing && roleForm.nlpCondition && (
                <div className="srr-nlp-hint">
                  The condition expression was generated from the NLP statement. Switch to Edit mode to regenerate.
                </div>
              )}
            </div>

            {/* ── Footer ────────────────────────────────────────────────── */}
            {isEditing && (
              <div className="srr-footer">
                <button type="button" className="btn btn--ghost"
                  onClick={isNewRole ? () => navigate('/service-request-role') : handleCancelEdit}>
                  Cancel
                </button>
                <button type="button" className="btn btn--primary"
                  onClick={handleSave}
                  disabled={isSaving || (!isDirty && !isNewRole)}>
                  {isSaving ? <><SpinnerIcon /> Saving…</> : isNewRole ? 'Save Role' : 'Save Changes'}
                </button>
              </div>
            )}

          </div>
        </div>

      </div>
    </AppShell>
  );
};

export default ServiceRequestRoleCreate;
