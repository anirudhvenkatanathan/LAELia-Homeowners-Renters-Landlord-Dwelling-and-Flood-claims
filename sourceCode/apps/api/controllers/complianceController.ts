// Compliance & catastrophe reporting: CAT events, CRF-26A data (Florida OIR), vendor workload by incident,
// and public adjuster / investigator exposure. Reads claim_intake_records, cat_events and vendor_details.
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { logError } from '../services/errorLogService';

type Doc = Record<string, unknown>;
const db = () => mongoose.connection.db!;
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown): string => (v == null ? '' : String(v));

export const CRF_LINES: Record<string, string> = { HO: 'Homeowners', DW: 'Dwelling', PF: 'Private Flood' };

interface Counts { claims: number; openPay: number; openNoPay: number; closedPay: number; closedNoPay: number; paidLoss: number; paidAlae: number; incurred: number; }
const zero = (): Counts => ({ claims: 0, openPay: 0, openNoPay: 0, closedPay: 0, closedNoPay: 0, paidLoss: 0, paidAlae: 0, incurred: 0 });
function add(c: Counts, r: Doc): void {
  c.claims += 1;
  const s = str(r['crfStatus']);
  if (s === 'open_payment') c.openPay += 1; else if (s === 'open_no_payment') c.openNoPay += 1;
  else if (s === 'closed_payment') c.closedPay += 1; else if (s === 'closed_no_payment') c.closedNoPay += 1;
  c.paidLoss += num(r['paidLossAmount']); c.paidAlae += num(r['paidAlaeAmount']); c.incurred += num(r['incurredLossAmount']);
}

export async function listEvents(_req: Request, res: Response): Promise<void> {
  try {
    const [events, claims] = await Promise.all([
      db().collection('cat_events').find({}).sort({ lossDateFrom: -1 }).toArray(),
      db().collection('claim_intake_records').find({}, { projection: { catEventId: 1 } }).toArray(),
    ]);
    const counts = new Map<string, number>();
    claims.forEach((c) => { const id = str(c['catEventId']); if (id) counts.set(id, (counts.get(id) ?? 0) + 1); });
    res.status(200).json({ success: true, totalClaims: claims.length, nonCatClaims: claims.length - [...counts.values()].reduce((a, b) => a + b, 0),
      data: events.map((e) => ({ eventId: e['eventId'], eventName: e['eventName'], eventType: e['eventType'], states: e['states'], lossDateFrom: e['lossDateFrom'], lossDateTo: e['lossDateTo'],
        counties: e['counties'], emergencyDeclared: e['emergencyDeclared'], crfApplicable: e['crfApplicable'], crfForm: e['crfForm'], dataCallStatus: e['dataCallStatus'], note: e['note'], claimCount: counts.get(str(e['eventId'])) ?? 0 })) });
  } catch (err) {
    await logError(err as Error, 'complianceController.listEvents');
    res.status(500).json({ success: false, message: 'Failed to load catastrophe events.' });
  }
}

export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const eventId = str(req.query['eventId'] || 'ALL');
    const [events, allRecords, vendors] = await Promise.all([
      db().collection('cat_events').find({}).toArray(),
      db().collection('claim_intake_records').find({}).toArray(),
      db().collection('vendor_details').find({}, { projection: { companyName: 1, capacity: 1, rating: 1, serviceRequestRoleName: 1 } }).toArray(),
    ]);
    const event = events.find((e) => e['eventId'] === eventId) ?? null;
    // scope: one event, or all claims narrowed by loss-date range and/or event type (CAT claims only when a type is chosen)
    const from = str(req.query['from']); const to = str(req.query['to']); const eventType = str(req.query['eventType']);
    const eventOf = (r: Doc) => events.find((e) => e['eventId'] === r['catEventId']);
    let records = eventId === 'ALL' ? allRecords : allRecords.filter((r) => r['catEventId'] === eventId);
    if (from) records = records.filter((r) => str(r['lossDate']) >= from);
    if (to) records = records.filter((r) => str(r['lossDate']) <= to);
    if (eventType) records = records.filter((r) => str(eventOf(r)?.['eventType']) === eventType);

    // ── totals / CRF eligibility: Florida, tied to a catastrophe event with an OIR data call, not NFIP ──
    const crfEligible = records.filter((r) => str(r['crfLine']) !== '' && str(r['jurisdiction']) === 'FL' && eventOf(r)?.['crfApplicable'] === true);
    const excluded = records.filter((r) => !crfEligible.includes(r)).map((r) => ({
      claimNumber: str(r['claimNumber']),
      reason: !str(r['catEventId']) ? 'Not tied to a catastrophe event (Non-CAT)'
        : str(r['jurisdiction']) !== 'FL' ? 'Outside Florida (CRF-26A is a Florida data call)'
        : eventOf(r)?.['crfApplicable'] !== true ? 'Event has no OIR data call on file'
        : 'NFIP (SFIP) claim: federal program, not reported to the OIR' }));
    const totals = zero(); crfEligible.forEach((r) => add(totals, r));

    // ── by line, by county / zip ──
    const byLine = new Map<string, Counts>();
    const byCountyZip = new Map<string, { lob: string; county: string; zip: string; c: Counts }>();
    const closedReasons: Record<string, number> = { noFlood: 0, exclusions: 0, belowDeductible: 0, fraud: 0, administrative: 0 };
    crfEligible.forEach((r) => {
      const line = str(r['crfLine']);
      add(byLine.get(line) ?? byLine.set(line, zero()).get(line)!, r);
      const k = `${line}|${str(r['lossCounty'])}|${str(r['lossZip'])}`;
      const row = byCountyZip.get(k) ?? byCountyZip.set(k, { lob: line, county: str(r['lossCounty']), zip: str(r['lossZip']), c: zero() }).get(k)!;
      add(row.c, r);
      if (str(r['crfStatus']) === 'closed_no_payment') closedReasons['exclusions'] += 1;
    });

    // ── survey (enhanced data call), per line and in total ──
    const bucket = (rs: Doc[]) => { const b = [0, 0, 0, 0]; rs.forEach((r) => { const d = num(r['crfDaysToClose']); b[d <= 30 ? 0 : d <= 60 ? 1 : d <= 90 ? 2 : 3] += 1; }); return b; };
    const surveyFor = (rs: Doc[]) => {
      const o = rs.filter((r) => str(r['crfStatus']).startsWith('open')), cl = rs.filter((r) => str(r['crfStatus']).startsWith('closed'));
      return {
        closedWithPaymentByDays: bucket(cl.filter((r) => r['crfStatus'] === 'closed_payment')),
        closedWithoutPaymentByDays: bucket(cl.filter((r) => r['crfStatus'] === 'closed_no_payment')),
        openInAppraisal: o.filter((r) => r['crfInAppraisal'] === true).length,
        openInLitigation: 0,
        openAttorneyRepresented: o.filter((r) => r['crfAttorneyRepresented'] === true).length,
        openPublicAdjuster: o.filter((r) => !!str(r['publicAdjusterFirm'])).length,
        openWaitingOnContractors: o.filter((r) => r['crfWaitingOnContractors'] === true).length,
        openWindVsFlood: o.filter((r) => r['crfWindVsFlood'] === true).length,
        reopened: 0, supplemental: 0,
      };
    };
    const survey = surveyFor(crfEligible);
    const surveyByLine = Object.fromEntries(Object.keys(CRF_LINES).map((l) => [l, surveyFor(crfEligible.filter((r) => r['crfLine'] === l))]));

    // ── timeline: claims reported per day (clumping) ──
    const days = new Map<string, number>();
    records.forEach((r) => { const d = str(r['reportedDate']); if (d) days.set(d, (days.get(d) ?? 0) + 1); });
    const timeline = [...days.entries()].sort().map(([date, count]) => ({ date, count }));

    // ── vendor workload (all open assignments vs this scope) ──
    const capacity = new Map(vendors.map((v) => [str(v['companyName']), num(v['capacity']) || 10]));
    const rating = new Map(vendors.map((v) => [str(v['companyName']), num(v['rating'])]));
    const roles = new Map(vendors.map((v) => [str(v['companyName']), str(v['serviceRequestRoleName'])]));
    const scope = new Map<string, Set<string>>(), openAll = new Map<string, Set<string>>();
    const tally = (m: Map<string, Set<string>>, vend: string, claim: string) => (m.get(vend) ?? m.set(vend, new Set()).get(vend)!).add(claim);
    allRecords.forEach((r) => {
      const isOpen = r['planServiceStatus'] !== 'Completed';
      ((r['serviceVendorReview'] as Doc[] | undefined) ?? []).forEach((e) => {
        const v = str(e['selectedVendor']); if (!v || e['status'] === 'Rejected') return;
        if (isOpen) tally(openAll, v, str(r['claimNumber']));
        if (records.includes(r)) tally(scope, v, str(r['claimNumber']));
      });
    });
    const vendorWorkload = [...openAll.keys()].map((v) => {
      const active = openAll.get(v)!.size, cap = capacity.get(v) ?? 10, util = Math.round((active / cap) * 100);
      return { vendor: v, services: roles.get(v) ?? '', rating: rating.get(v) ?? 0, assignedInScope: scope.get(v)?.size ?? 0, activeAssignments: active, capacity: cap, utilizationPct: util,
        status: util > 100 ? 'Over capacity' : util >= 80 ? 'Near capacity' : util < 40 ? 'Under-used' : 'Healthy' };
    }).filter((v) => v.assignedInScope > 0).sort((a, b) => b.utilizationPct - a.utilizationPct);

    // ── public adjuster / investigator exposure ──
    const paClaims = records.filter((r) => str(r['publicAdjusterFirm'])).map((r) => {
      const settled = r['claimSettlementAmount'] !== '' && r['claimSettlementAmount'] != null;
      return {
        claimNumber: str(r['claimNumber']), insured: str(r['insuredName']), county: str(r['lossCounty']), submittedAmount: num(r['claimAmount']),
        publicAdjusterFirm: str(r['publicAdjusterFirm']), settlementAmount: settled ? num(r['claimSettlementAmount']) : null,
        independentAdjuster: str(r['independentAdjusterName']), status: str(r['claimStatus']), catNumber: str(r['catNumber']),
      };
    });

    // ── CRF-26A row validation checks 3-5 (1 and 2 are list checks done at export) ──
    const rows = [...byCountyZip.values()].map((x) => ({ lob: x.lob, lobName: CRF_LINES[x.lob] ?? x.lob, county: x.county, zip: x.zip, ...x.c }));
    const check3 = rows.every((x) => x.openPay + x.openNoPay + x.closedPay + x.closedNoPay === x.claims);
    const check4 = rows.every((x) => x.claims > 0 || x.paidLoss === 0);
    const check5 = rows.every((x) => x.openPay + x.closedPay > 0 || x.paidLoss === 0);

    res.status(200).json({ success: true, data: {
      event, eventId, totalRecords: records.length, crfEligibleCount: crfEligible.length, excluded, totals,
      byLine: [...byLine.entries()].map(([lob, c]) => ({ lob, lobName: CRF_LINES[lob] ?? lob, ...c })),
      rows, survey, surveyByLine, closedReasons, timeline, vendorWorkload, paClaims,
      validations: [
        { id: 3, label: 'Open + closed claim categories equal Number of Claims Reported', ok: check3 },
        { id: 4, label: 'If Number of Claims Reported = 0, Paid Loss = 0', ok: check4 },
        { id: 5, label: 'If no claims with payment, Paid Loss = 0', ok: check5 },
      ],
    } });
  } catch (err) {
    await logError(err as Error, 'complianceController.getSummary');
    res.status(500).json({ success: false, message: 'Failed to build compliance summary.' });
  }
}
