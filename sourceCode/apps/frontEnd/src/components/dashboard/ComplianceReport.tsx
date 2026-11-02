import React, { useEffect, useMemo, useState } from 'react';
import { fetchCatEvents, fetchComplianceSummary } from '../../services/compliance/complianceService';
import type { CatEvent, ComplianceSummary } from '../../models/compliance/complianceModel';
import { buildCrfWorkbook, type CrfContact } from '../../utils/crfWorkbook';

const IRFS_URL = 'https://irfs.fldfs.com';
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (n: number, d: number) => (d === 0 ? '0%' : `${Math.round((n / d) * 100)}%`);

const DEFAULT_CONTACT: CrfContact = {
  preparer: 'Claims Compliance (auto)', email: 'compliance@democarrier.example', phone: '(850) 555-0100', companyName: 'Demo Carrier', naicCode: '00000', floridaCompanyCode: '00000', fein: '00-0000000', groupCode: '0000', domicile: 'FL',
  grossPayable: 0, reinsurance: 0, model: 'N/A', howEvaluated: 'Case reserves plus payments to date, by claim',
};

const ComplianceReport: React.FC = () => {
  const [events, setEvents] = useState<CatEvent[]>([]);
  const [counts, setCounts] = useState({ total: 0, nonCat: 0 });
  const [eventId, setEventId] = useState('26B-FL');
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [asOf] = useState(new Date().toISOString().slice(0, 10));
  // CRF generation: pick by event or by loss-date range / event type, preview, then download
  const [crfMode, setCrfMode] = useState<'event' | 'date'>('event');
  const [crfEvent, setCrfEvent] = useState('26B-FL');
  const [crfFrom, setCrfFrom] = useState('2026-10-01');
  const [crfTo, setCrfTo] = useState('2026-10-31');
  const [crfType, setCrfType] = useState('');
  const [preview, setPreview] = useState<ComplianceSummary | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    fetchCatEvents()
      .then((r) => { setEvents(r.data); setCounts({ total: r.totalClaims, nonCat: r.nonCatClaims }); if (r.data.length && !r.data.some((e) => e.eventId === '26B-FL')) setEventId(r.data[0].eventId); })
      .catch(() => setError('Could not load catastrophe events.'));
  }, []);

  useEffect(() => {
    setLoading(true); setError('');
    fetchComplianceSummary(eventId)
      .then((s) => setSummary(s))
      .catch(() => setError('Could not load compliance data.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const event = summary?.event ?? null;
  const eventTypes = useMemo(() => [...new Set(events.map((e) => e.eventType))], [events]);
  const contactFor = (sm: ComplianceSummary): CrfContact => ({ ...DEFAULT_CONTACT, grossPayable: Math.round(sm.totals.incurred) });
  const previewOk = !!preview && preview.crfEligibleCount > 0 && preview.validations.every((v) => v.ok);

  const generate = async () => {
    setPreviewBusy(true); setError('');
    try {
      const sm = await fetchComplianceSummary(crfMode === 'event' ? { eventId: crfEvent } : { eventId: 'ALL', from: crfFrom, to: crfTo, eventType: crfType });
      setPreview(sm);
    } catch { setError('Could not generate the CRF-26A preview.'); } finally { setPreviewBusy(false); }
  };

  const download = async () => {
    if (!preview) return;
    const blob = await buildCrfWorkbook(preview, contactFor(preview), asOf);
    const label = preview.event?.eventName ?? `${crfFrom}_to_${crfTo}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `CRF-26A_${label.replace(/\s+/g, '-')}_${asOf}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="cmp-page">
      <div className="cmp-toolbar">
        <label className="cmp-field">
          <span>Catastrophe event</span>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => <option key={e.eventId} value={e.eventId}>{e.eventName} · {e.eventId} ({e.claimCount} claims)</option>)}
            <option value="ALL">All claims ({counts.total})</option>
          </select>
        </label>
        {event && (
          <div className="cmp-event">
            <div><strong>CAT code:</strong> {event.eventId} <span className="cmp-muted">(internal, Lloyd's-style)</span></div>
            <div><strong>Loss window:</strong> {event.lossDateFrom} to {event.lossDateTo} · <strong>States:</strong> {event.states.join(', ')} · <strong>Counties:</strong> {event.counties.length}</div>
            <div className="cmp-muted">{event.dataCallStatus}. {event.note}</div>
          </div>
        )}
      </div>

      {error && <div className="cmp-error">{error}</div>}
      {loading && !summary && <p className="cmp-muted">Loading compliance data…</p>}

      {events.length > 0 && (
        <div className="cmp-card">
          <h3>Catastrophe events</h3>
          <div className="cmp-scroll">
            <table className="cmp-table">
              <thead><tr><th>Event name</th><th>CAT code</th><th>Date range</th><th>Claims</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.eventId}><td>{e.eventName}</td><td>{e.eventId}</td><td>{e.lossDateFrom === e.lossDateTo ? e.lossDateFrom : `${e.lossDateFrom} to ${e.lossDateTo}`}</td><td>{e.claimCount}</td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}><strong>Total catastrophe claims</strong> ({events.length} events)</td><td><strong>{events.reduce((a, e) => a + e.claimCount, 0)}</strong></td></tr>
                <tr><td colSpan={3}>Non-CAT claims</td><td>{counts.nonCat}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {summary && (<>
        <div className="cmp-kpis">
          <div className="cmp-kpi"><div className="cmp-kpi__v">{summary.totalRecords}</div><div className="cmp-kpi__l">Claims in scope</div></div>
          <div className="cmp-kpi"><div className="cmp-kpi__v">{summary.crfEligibleCount}</div><div className="cmp-kpi__l">CRF-26A reportable</div></div>
          <div className="cmp-kpi"><div className="cmp-kpi__v">{summary.totals.openPay + summary.totals.openNoPay}</div><div className="cmp-kpi__l">Open claims</div></div>
          <div className="cmp-kpi"><div className="cmp-kpi__v">{summary.totals.closedPay + summary.totals.closedNoPay}</div><div className="cmp-kpi__l">Closed claims</div></div>
          <div className="cmp-kpi"><div className="cmp-kpi__v">{money(summary.totals.paidLoss)}</div><div className="cmp-kpi__l">Paid loss</div></div>
          <div className="cmp-kpi"><div className="cmp-kpi__v">{money(summary.totals.incurred)}</div><div className="cmp-kpi__l">Paid and case incurred</div></div>
        </div>

        <div className="cmp-card">
          <h3>Claims: CAT vs Non-CAT</h3>
          <p className="cmp-muted">All claims in the book, split by whether they are tied to a catastrophe event.</p>
          <div className="cmp-hbars">
            {[{ label: 'CAT claims', value: counts.total - counts.nonCat }, { label: 'Non-CAT claims', value: counts.nonCat }].map((r) => (
              <div key={r.label} className="cmp-hbar">
                <div className="cmp-hbar__label">{r.label}</div>
                <div className="cmp-hbar__track"><div className="cmp-hbar__fill" style={{ width: `${counts.total ? Math.max(2, (r.value / counts.total) * 100) : 0}%` }} /></div>
                <div className="cmp-hbar__value">{r.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="cmp-card">
          <h3>Claims by line, county and ZIP (CRF-26A Claims Data Extract)</h3>
          <div className="cmp-scroll">
            <table className="cmp-table">
              <thead><tr><th>Line</th><th>County</th><th>ZIP</th><th>Claims</th><th>Open, paid</th><th>Open, unpaid</th><th>Closed, paid</th><th>Closed, unpaid</th><th>Paid loss</th></tr></thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={`${r.lob}${r.county}${r.zip}`}><td>{r.lobName}</td><td>{r.county}</td><td>{r.zip}</td><td>{r.claims}</td><td>{r.openPay}</td><td>{r.openNoPay}</td><td>{r.closedPay}</td><td>{r.closedNoPay}</td><td>{money(r.paidLoss)}</td></tr>
                ))}
                {summary.rows.length === 0 && <tr><td colSpan={9} className="cmp-muted">No Florida claims reportable for this selection.</td></tr>}
              </tbody>
            </table>
          </div>
          {summary.excluded.length > 0 && (
            <p className="cmp-muted">{summary.excluded.length} claim{summary.excluded.length === 1 ? '' : 's'} not reportable: NFIP (SFIP) flood claims are federal, and claims outside Florida are outside this data call.</p>
          )}
        </div>

        <div className="cmp-card">
          <h3>Service provider workload by incident</h3>
          <p className="cmp-muted">Open assignments against capacity. Over-capacity providers are not recommended for new catastrophe claims; the next best provider is offered instead.</p>
          <div className="cmp-scroll">
            <table className="cmp-table">
              <thead><tr><th>Provider</th><th>Services</th><th>Rating</th><th>On this incident</th><th>All open</th><th>Capacity</th><th>Utilisation</th><th>Status</th></tr></thead>
              <tbody>
                {summary.vendorWorkload.map((v) => (
                  <tr key={v.vendor}>
                    <td>{v.vendor}</td><td className="cmp-cell-wrap">{v.services}</td><td>{v.rating.toFixed(1)}</td><td>{v.assignedInScope}</td><td>{v.activeAssignments}</td><td>{v.capacity}</td>
                    <td><div className="cmp-meter"><div className={`cmp-meter__fill cmp-meter__fill--${v.utilizationPct > 100 ? 'over' : v.utilizationPct >= 80 ? 'near' : 'ok'}`} style={{ width: `${Math.min(100, v.utilizationPct)}%` }} /></div> {v.utilizationPct}%</td>
                    <td><span className={`cmp-pill cmp-pill--${v.utilizationPct > 100 ? 'over' : v.utilizationPct >= 80 ? 'near' : 'ok'}`}>{v.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="cmp-card">
          <h3>Public adjuster claims</h3>
          <p className="cmp-muted">Claims where the insured retained a public adjuster. Each is assigned a top-rated independent adjuster and then passes to the claims manager for second-level review.</p>
          <div className="cmp-scroll">
            <table className="cmp-table">
              <thead><tr><th>Claim</th><th>Insured</th><th>County</th><th>Claim submitted amount</th><th>Public adjuster</th><th>Claim settlement amount</th><th>Independent adjuster</th><th>Status</th></tr></thead>
              <tbody>
                {summary.paClaims.map((p) => (
                  <tr key={p.claimNumber}>
                    <td>{p.claimNumber}</td><td>{p.insured}</td><td>{p.county}</td><td>{money(p.submittedAmount)}</td><td>{p.publicAdjusterFirm}</td>
                    <td>{p.settlementAmount == null ? 'Pending' : money(p.settlementAmount)}</td><td>{p.independentAdjuster || '—'}</td><td>{p.status || '—'}</td>
                  </tr>
                ))}
                {summary.paClaims.length === 0 && <tr><td colSpan={8} className="cmp-muted">No public adjuster claims in this selection.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="cmp-card">
          <h3>CRF-26A filing</h3>
          <p className="cmp-muted">Choose an event, or a loss-date range and event type. The workbook is built from the claim data and the filer details on file, so nothing is typed in. Preview it, then download.</p>
          <div className="cmp-form">
            <label className="cmp-field"><span>Select by</span>
              <select value={crfMode} onChange={(e) => setCrfMode(e.target.value as 'event' | 'date')}><option value="event">Event</option><option value="date">Date range and event type</option></select>
            </label>
            {crfMode === 'event' ? (
              <label className="cmp-field"><span>Event</span>
                <select value={crfEvent} onChange={(e) => setCrfEvent(e.target.value)}>{events.map((e) => <option key={e.eventId} value={e.eventId}>{e.eventName} · {e.eventId}</option>)}</select>
              </label>
            ) : (<>
              <label className="cmp-field"><span>Loss date from</span><input type="date" value={crfFrom} onChange={(e) => setCrfFrom(e.target.value)} /></label>
              <label className="cmp-field"><span>Loss date to</span><input type="date" value={crfTo} onChange={(e) => setCrfTo(e.target.value)} /></label>
              <label className="cmp-field"><span>Event type</span>
                <select value={crfType} onChange={(e) => setCrfType(e.target.value)}><option value="">All types</option>{eventTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select>
              </label>
            </>)}
          </div>
          <div className="cmp-actions">
            <button type="button" className="btn btn--primary" onClick={() => void generate()} disabled={previewBusy}>{previewBusy ? 'Preparing…' : 'Generate CRF-26A preview'}</button>
            <a className="btn btn--ghost" href={IRFS_URL} target="_blank" rel="noopener noreferrer">Open IRFS filing portal</a>
          </div>
          <p className="cmp-muted">Filing is done in the Florida OIR Insurance Regulation Filing System (IRFS) after you sign in; it has no public upload service, so the downloaded file is uploaded by hand. IRFS rejects a CRF unless every validation shows TRUE.</p>
        </div>

        {preview && (
          <div className="cmp-modal" role="dialog" aria-modal="true" aria-label="CRF-26A preview">
            <div className="cmp-modal__box">
              <div className="cmp-modal__head">
                <h3>CRF-26A preview{preview.event ? `: ${preview.event.eventName} (${preview.event.eventId})` : ''}</h3>
                <button type="button" className="btn btn--ghost" onClick={() => setPreview(null)} aria-label="Close preview">Close</button>
              </div>
              <div className="cmp-kpis">
                <div className="cmp-kpi"><div className="cmp-kpi__v">{preview.crfEligibleCount}</div><div className="cmp-kpi__l">Claims reported</div></div>
                <div className="cmp-kpi"><div className="cmp-kpi__v">{preview.totals.openPay + preview.totals.openNoPay}</div><div className="cmp-kpi__l">Open</div></div>
                <div className="cmp-kpi"><div className="cmp-kpi__v">{preview.totals.closedPay + preview.totals.closedNoPay}</div><div className="cmp-kpi__l">Closed</div></div>
                <div className="cmp-kpi"><div className="cmp-kpi__v">{money(preview.totals.paidLoss)}</div><div className="cmp-kpi__l">Paid loss</div></div>
              </div>
              <div className="cmp-scroll">
                <table className="cmp-table">
                  <thead><tr><th>Line</th><th>Claims</th><th>Open, paid</th><th>Open, unpaid</th><th>Closed, paid</th><th>Closed, unpaid</th><th>Paid loss</th><th>Incurred</th></tr></thead>
                  <tbody>
                    {preview.byLine.map((l) => <tr key={l.lob}><td>{l.lobName}</td><td>{l.claims}</td><td>{l.openPay}</td><td>{l.openNoPay}</td><td>{l.closedPay}</td><td>{l.closedNoPay}</td><td>{money(l.paidLoss)}</td><td>{money(l.incurred)}</td></tr>)}
                    {preview.byLine.length === 0 && <tr><td colSpan={8} className="cmp-muted">No reportable Florida claims for this selection.</td></tr>}
                  </tbody>
                </table>
              </div>
              <ul className="cmp-checks">
                {preview.validations.map((v) => <li key={v.id} className={v.ok ? 'cmp-ok' : 'cmp-bad'}>{v.ok ? 'TRUE' : 'FALSE'} · Check #{v.id}: {v.label}</li>)}
              </ul>
              {preview.excluded.length > 0 && <p className="cmp-muted">{preview.excluded.length} claim{preview.excluded.length === 1 ? '' : 's'} left out: {[...new Set(preview.excluded.map((x) => x.reason))].join('; ')}.</p>}
              {preview.crfEligibleCount === 0 && <p className="cmp-bad">Nothing to report for this selection. Events without an OIR data call, non-Florida claims and NFIP claims are not filed on a CRF.</p>}
              <div className="cmp-actions">
                <button type="button" className="btn btn--primary" onClick={() => void download()} disabled={!previewOk}>Download CRF-26A (.xlsx)</button>
                <button type="button" className="btn btn--ghost" onClick={() => setPreview(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </>)}
    </div>
  );
};

export default ComplianceReport;
