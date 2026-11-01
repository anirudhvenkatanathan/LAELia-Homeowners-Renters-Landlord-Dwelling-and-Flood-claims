import React, { useEffect, useMemo, useState } from 'react';
import { fetchCatEvents, fetchComplianceSummary } from '../../services/compliance/complianceService';
import type { CatEvent, ComplianceSummary } from '../../models/compliance/complianceModel';
import { buildCrfWorkbook, type CrfContact } from '../../utils/crfWorkbook';

const IRFS_URL = 'https://irfs.fldfs.com';
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (n: number, d: number) => (d === 0 ? '0%' : `${Math.round((n / d) * 100)}%`);

const DEFAULT_CONTACT: CrfContact = {
  preparer: '', email: '', phone: '', companyName: 'Demo Carrier (enter legal name)', naicCode: '', floridaCompanyCode: '', fein: '', groupCode: '', domicile: 'FL',
  grossPayable: 0, reinsurance: 0, model: 'N/A', howEvaluated: 'Case reserves plus payments to date, by claim',
};

const ComplianceReport: React.FC = () => {
  const [events, setEvents] = useState<CatEvent[]>([]);
  const [counts, setCounts] = useState({ total: 0, nonCat: 0 });
  const [eventId, setEventId] = useState('CAT-2026-ISAIAS');
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<CrfContact>(DEFAULT_CONTACT);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fetchCatEvents()
      .then((r) => { setEvents(r.data); setCounts({ total: r.totalClaims, nonCat: r.nonCatClaims }); if (r.data.length && !r.data.some((e) => e.eventId === 'CAT-2026-ISAIAS')) setEventId(r.data[0].eventId); })
      .catch(() => setError('Could not load catastrophe events.'));
  }, []);

  useEffect(() => {
    setLoading(true); setError('');
    fetchComplianceSummary(eventId)
      .then((s) => { setSummary(s); setContact((c) => ({ ...c, grossPayable: Math.round(s.totals.incurred) })); })
      .catch(() => setError('Could not load compliance data.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const maxDay = useMemo(() => Math.max(1, ...(summary?.timeline ?? []).map((d) => d.count)), [summary]);
  const event = summary?.event ?? null;
  const crfOk = !!event?.crfApplicable && !!summary && summary.validations.every((v) => v.ok);
  const upd = (k: keyof CrfContact, v: string | number) => setContact((c) => ({ ...c, [k]: v }));

  const download = async () => {
    if (!summary) return;
    const blob = await buildCrfWorkbook(summary, contact, asOf);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `CRF-26A_${(event?.eventName ?? 'All events').replace(/\s+/g, '-')}_${asOf}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="cmp-page">
      <div className="cmp-toolbar">
        <label className="cmp-field">
          <span>Catastrophe event</span>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => <option key={e.eventId} value={e.eventId}>{e.eventName} ({e.claimCount} claims)</option>)}
            <option value="ALL">All claims ({counts.total})</option>
          </select>
        </label>
        {event && (
          <div className="cmp-event">
            <div><strong>CAT number:</strong> {event.eventId}</div>
            <div><strong>Loss window:</strong> {event.lossDateFrom} to {event.lossDateTo} · <strong>States:</strong> {event.states.join(', ')} · <strong>Counties:</strong> {event.counties.length}</div>
            <div className="cmp-muted">{event.dataCallStatus}. {event.note}</div>
          </div>
        )}
      </div>

      {error && <div className="cmp-error">{error}</div>}
      {loading && !summary && <p className="cmp-muted">Loading compliance data…</p>}

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
          <h3>Claims reported per day</h3>
          <p className="cmp-muted">Losses arrive in clumps. {event ? `${summary.totalRecords} claims tie to ${event.eventName}` : `${counts.nonCat} of ${counts.total} claims are not tied to any event`}; non-event claims trickle in a few at a time.</p>
          <div className="cmp-bars">
            {summary.timeline.map((d) => (
              <div key={d.date} className="cmp-bar" title={`${d.date}: ${d.count} claims`}>
                <div className="cmp-bar__fill" style={{ height: `${Math.max(6, (d.count / maxDay) * 100)}%` }} />
                <div className="cmp-bar__n">{d.count}</div>
                <div className="cmp-bar__d">{d.date.slice(5)}</div>
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
          <h3>Public adjuster and investigator exposure</h3>
          <p className="cmp-muted">Florida s.626.854(11) caps public adjuster fees at 10% within a year of a declared emergency and 20% otherwise. These claims need a senior independent adjuster and second-level claims manager review.</p>
          <div className="cmp-scroll">
            <table className="cmp-table">
              <thead><tr><th>Claim</th><th>Insured</th><th>County</th><th>Claim amount</th><th>Public adjuster</th><th>Fee</th><th>Cap</th><th>Fee check</th><th>Investigator</th><th>Second-level review</th></tr></thead>
              <tbody>
                {summary.paClaims.map((p) => (
                  <tr key={p.claimNumber}>
                    <td>{p.claimNumber}</td><td>{p.insured}</td><td>{p.county}</td><td>{money(p.claimAmount)}</td><td>{p.publicAdjusterFirm || '—'}</td>
                    <td>{p.feePct == null ? '—' : `${p.feePct}%`}</td><td>{p.feeCapPct ? `${p.feeCapPct}%` : '—'}</td>
                    <td>{p.feeStatus ? <span className={`cmp-pill cmp-pill--${p.feeStatus === 'Exceeds cap' ? 'over' : 'ok'}`}>{p.feeStatus}</span> : '—'}</td>
                    <td>{p.investigatorFirm || '—'}</td><td>{p.reviewStatus || '—'}</td>
                  </tr>
                ))}
                {summary.paClaims.length === 0 && <tr><td colSpan={10} className="cmp-muted">No public adjuster or investigator claims in this selection.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="cmp-card">
          <h3>CRF-26A filing</h3>
          {!event?.crfApplicable ? (
            <p className="cmp-muted">{event ? `${event.eventName} is not a Florida event, so no CRF-26A applies.` : 'Select a Florida catastrophe event to prepare a CRF-26A.'}</p>
          ) : (<>
            <ul className="cmp-checks">
              {summary.validations.map((v) => <li key={v.id} className={v.ok ? 'cmp-ok' : 'cmp-bad'}>{v.ok ? 'TRUE' : 'FALSE'} · Check #{v.id}: {v.label}</li>)}
              <li className="cmp-ok">TRUE · Checks #1 and #2 (line, county and ZIP valid) are calculated inside the workbook</li>
            </ul>
            <div className="cmp-form">
              {([['preparer', 'Completed by'], ['email', 'Email'], ['phone', 'Phone'], ['companyName', 'Company name'], ['naicCode', 'NAIC code'], ['floridaCompanyCode', 'Florida company code'], ['fein', 'FEIN'], ['groupCode', 'Group code']] as [keyof CrfContact, string][]).map(([k, label]) => (
                <label key={k} className="cmp-field"><span>{label}</span><input value={String(contact[k])} onChange={(e) => upd(k, e.target.value)} /></label>
              ))}
              <label className="cmp-field"><span>As-of date</span><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></label>
              <label className="cmp-field"><span>Estimated gross payable loss ($)</span><input type="number" value={contact.grossPayable} onChange={(e) => upd('grossPayable', Number(e.target.value))} /></label>
              <label className="cmp-field"><span>Covered by reinsurance ($)</span><input type="number" value={contact.reinsurance} onChange={(e) => upd('reinsurance', Number(e.target.value))} /></label>
            </div>
            <div className="cmp-actions">
              <button type="button" className="btn btn--primary" onClick={() => void download()} disabled={!crfOk}>Download CRF-26A (.xlsx)</button>
              <a className="btn btn--ghost" href={IRFS_URL} target="_blank" rel="noopener noreferrer">Open IRFS filing portal</a>
            </div>
            <p className="cmp-muted">Filing is done in the Florida OIR Insurance Regulation Filing System (IRFS) after you sign in; it has no public upload service, so the file is uploaded by hand. IRFS rejects a CRF unless every validation tab shows TRUE, and OIR may re-issue the template with each data call: if so, paste the downloaded figures into that template. Each company files on its own, and a company with no Florida claims files a "No Data" form. Questions: DisasterReporting@floir.gov, (850) 413-3147.</p>
          </>)}
        </div>
      </>)}
    </div>
  );
};

export default ComplianceReport;
