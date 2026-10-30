// Generates seed/ClaimDB/claim_triage.<collection>.json (Extended JSON) from the
// definitions in seed/data. Deterministic: same input -> same IDs and dates.
// Login/credential collections are NOT generated here (see seed.ts, seed/private).
//   run:  npx tsx seed/generate.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { RULES, type RuleDef } from './data/rules';
import { PROVIDERS, type ProviderDef } from './data/providers';
import { L1_BY_RULE, L2_UNIVERSAL, L3_TECHNOLOGY, L4_TRACK_RECORD } from './data/onboarding';
import { CLAIMS, CLAIM_PREFIX, type ClaimSpec } from './data/claims';
import { evaluateRoleConditions, type ConditionData } from '../utils/ruleEvaluator';
import { mapClaimTypeToLOB, type LineOfBusiness } from '../utils/lineOfBusiness';

const OUT = path.resolve(__dirname, 'ClaimDB');
const TODAY = new Date('2026-10-30T12:00:00Z');
const DAY = 86400000;

// ── deterministic helpers ──────────────────────────────────────────────────────
const h = (s: string) => crypto.createHash('sha1').update(s).digest('hex');
const uuid = (s: string) => { const x = h(s); return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-a${x.slice(17, 20)}-${x.slice(20, 32)}`; };
const oid = (s: string) => ({ $oid: h('oid' + s).slice(0, 24) });
const hex24 = (s: string) => h('hex' + s).slice(0, 24);
const dt = (d: Date | string) => ({ $date: new Date(d).toISOString() });
const ago = (days: number) => new Date(TODAY.getTime() - days * DAY);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const camel = (f: string) => /\s/.test(f) ? f : f.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const files: Record<string, unknown[]> = {};
const put = (name: string, rows: unknown[]) => { files[name] = rows; };

// ── 1. Rules ───────────────────────────────────────────────────────────────────
const roleId = (r: RuleDef) => uuid('role:' + r.name);
const ROLE_BY_NAME = new Map(RULES.map((r) => [r.name, roleId(r)]));
const conds: ConditionData[] = [];
const expr = (r: RuleDef) => '(' + r.conds.map((c, i) => `${i ? ' ' + (c[3] ?? 'AND') + ' ' : ''}${c[0]} ${c[1]} ${c[2] === '' ? "''" : c[2]}`).join('') + ')';

put('service_request_roles', RULES.map((r, i) => ({
  _id: oid('role' + r.name), roleId: roleId(r), uploadId: 'manual', roleName: r.name, description: r.description,
  status: 'Active', __v: 0, conditionExpression: expr(r), nlpCondition: expr(r).slice(1, -1), nlpConditionInWords: r.description,
  lineOfBusiness: r.lobs,
})));
put('service_request_role_conditions', RULES.flatMap((r) => r.conds.map((c, i) => {
  const row = { _id: oid(`cond:${r.name}:${i}`), conditionId: uuid(`cond:${r.name}:${i}`), roleId: roleId(r), fieldName: c[0], operator: c[1],
    value: c[2], conditionType: i === 0 ? 'AND' : (c[3] ?? 'AND'), sortOrder: i, __v: 0 };
  conds.push({ roleId: row.roleId, fieldName: row.fieldName, operator: row.operator, value: row.value, conditionType: row.conditionType, sortOrder: i });
  return row;
})));
put('service_request_role_audits', RULES.map((r, i) => ({
  _id: oid('raudit' + r.name), auditId: uuid('raudit' + r.name), roleId: roleId(r), action: 'CREATE', user: 'Admin',
  timestamp: dt(ago(60 - (i % 20))), __v: 0,
})));

// ── 2. KPI chain (3 vendor KPIs per rule) ──────────────────────────────────────
const KPI_SETS: Array<[string, string, string, string, string, 'Higher' | 'Lower', string]> = [
  ['Turnaround Time', 'SLA Compliance %', '90', '80', '70', 'Higher', 'Jobs Delivered On Time / Total Jobs * 100'],
  ['Report Quality', 'First Pass Acceptance Rate', '90', '80', '70', 'Higher', 'Reports Accepted First Time / Reports Submitted * 100'],
  ['Cost Efficiency', 'Estimate Variance %', '5', '10', '15', 'Lower', 'Abs(Vendor Estimate - Final Cost) / Final Cost * 100'],
];
const kM: unknown[] = [], kG: unknown[] = [], kS: unknown[] = [], kC: unknown[] = [];
RULES.forEach((r, ri) => {
  const mid = `KPI${String(ri + 1).padStart(3, '0')}`;
  const stamp = dt(ago(40));
  kM.push({ _id: oid('km' + mid), kpiMatricsId: mid, serviceRequestRoleId: roleId(r), kpiGroupTracking: 'Historical Outcomes', isActive: true, createdBy: 'admin', createdAt: stamp, updatedBy: 'admin', updatedAt: stamp });
  KPI_SETS.forEach(([group, name, good, mod, poor, better, formula], k) => {
    const gid = uuid(`kg:${mid}:${k}`), sid = uuid(`ks:${mid}:${k}`), cid = uuid(`kc:${mid}:${k}`);
    kG.push({ _id: oid('kg' + gid), kpiMatricsGroupTrackingId: gid, kpiMatricsId: mid, kpiGroupTracking: group, kpiGroupTrackingSuggestion: name, isVendorKPI: true, isActive: true, createdBy: 'Admin', createdAt: stamp, updatedBy: 'Admin', updatedAt: stamp });
    kS.push({ _id: oid('ks' + sid), kpiMatricsFieldAndSectionsId: sid, kpiMatricsGroupTrackingId: gid, thresholdsGood: good, thresholdsModerate: mod, thresholdsPoor: poor, betterWhen: better, createdBy: 'Admin', createdAt: stamp, updatedBy: 'Admin', updatedAt: stamp });
    const [num, den] = formula.split(' / ');
    kC.push({ _id: oid('kc' + cid), kpiMatricsFieldAndConditionId: cid, kpiMatricsFieldAndSectionsId: sid, fieldName: num, operator: '/', value: den, conditionType: '', sortOrder: 0, ShowValue: better === 'Higher' ? '88%' : '7%', createdBy: 'Admin', createdAt: stamp, updatedBy: 'Admin', updatedAt: stamp });
  });
});
put('kpi_matrics', kM); put('kpi_matrics_group_trackings', kG); put('kpi_matrics_field_and_sections', kS); put('kpi_matrics_field_and_conditions', kC);

// ── 3. Providers ───────────────────────────────────────────────────────────────
const STATUS_ID: Record<string, string> = {
  Active: '6841a101f1a23c0012343451', requalDue: '6841a101f1a23c0012343452', Suspended: '6841a101f1a23c0012343453',
  PendingApproval: '6841a101f1a23c0012343454', InProgress: '6841a101f1a23c0012343455', Disqualified: '6841a101f1a23c0012343456', ReadyForActivation: '6841a101f1a23c0012343457',
};
const STATUS_NAME: Record<string, string> = { requalDue: 'Requalification Due', PendingApproval: 'Pending Approval', ReadyForActivation: 'Ready for Activation' };
const STREETS = ['Harbor Blvd', 'Palm Ave', 'Cypress Way', 'Bayshore Dr', 'Magnolia St', 'Gulf Breeze Pkwy', 'Citrus Grove Rd', 'Sawgrass Ln'];
const ph = (i: number) => `+1 (${['305', '407', '813', '904', '239', '941'][i % 6]}) 555-01${String(10 + (i % 80)).padStart(2, '0')}`;
const vid = (p: ProviderDef) => hex24('vendor:' + p.company);
const vendorDetails = PROVIDERS.map((p, i) => {
  const roleIds = p.rules.map((n) => { const id = ROLE_BY_NAME.get(n); if (!id) throw new Error(`Provider ${p.company}: unknown rule "${n}"`); return id; });
  const row: Record<string, unknown> = {
    _id: hex24('vd:' + p.company), vendorId: vid(p), companyName: p.company, emailId: `claims@${slug(p.company)}.example`, rating: p.rating,
    address: `${100 + i * 7} ${STREETS[i % STREETS.length]}`, city: p.city, state: 'Florida', country: 'USA', Status: STATUS_ID[p.status],
    RequalificationStartDate: ago(p.status === 'requalDue' ? 372 : 120).toISOString(), RequalificationEndDate: ago(p.status === 'requalDue' ? 7 : -245).toISOString(),
    Coverage: p.coverage, phoneNumber: ph(i), turnaroundTime: p.turnaround, serviceRequestRoleId: roleIds, serviceRequestRoleName: p.rules.join(', '),
    createdBy: 'admin', createdAt: ago(150).toISOString(), uploadedBy: 'admin', uploadedAt: ago(150).toISOString(),
    vendorStatus: STATUS_NAME[p.status] ?? p.status, vendorStatusId: STATUS_ID[p.status],
  };
  if (p.status === 'Suspended') { row['suspendedReason'] = 'Open licence renewal'; row['manualStatusOverride'] = true; }
  if (p.status === 'Disqualified') row['disqualifiedReason'] = 'Insurance lapsed';
  if (p.boosted) row['boostApplied'] = true;
  return row;
});
put('vendor_details', vendorDetails);
put('vendor_priority_boost', PROVIDERS.filter((p) => p.boosted).map((p) => ({
  _id: oid('boost' + p.company), vendorId: vid(p), __v: 0, assignmentLimit: null, boostApplied: true, createdAt: dt(ago(30)), createdBy: 'claimssupervisor',
  reasonForBoost: 'Boost for 90 days: CAT season capacity', serviceDisciplines: p.rules, states: ['FL'], updatedAt: dt(ago(30)),
})));
put('vendor_status_history', PROVIDERS.filter((p) => ['Suspended', 'Disqualified'].includes(p.status)).map((p) => ({
  _id: oid('vsh' + p.company), historyId: uuid('vsh' + p.company), vendorId: vid(p), action: p.status,
  reason: p.status === 'Suspended' ? 'Open licence renewal' : 'Insurance lapsed', remarks: '', performedBy: 'claimsmanager', performedAt: dt(ago(21)), __v: 0,
})));
const pending = PROVIDERS.filter((p) => ['PendingApproval', 'InProgress'].includes(p.status));
put('vendor_service_requests', pending.map((p, i) => ({
  _id: oid('vsr' + p.company), requestId: uuid('vsr' + p.company), companyName: p.company, address: `${p.city}, FL`, email: `claims@${slug(p.company)}.example`, phone: ph(i),
  services: p.rules.map((n) => ROLE_BY_NAME.get(n)), coverage: ['FL'], status: 'submitted', vendorDetailId: hex24('vd:' + p.company),
  submittedBy: 'Admin', submittedAt: dt(ago(14 + i)), reviewedBy: '', reviewedAt: null, notes: '', createdAt: dt(ago(14 + i)), updatedAt: dt(ago(14 + i)), __v: 0,
})));

// ── 4. Onboarding checklist ────────────────────────────────────────────────────
const STAGE = { L1: '6841a101f1a23c0012342455', L2: '6841a101f1a23c0012342452', L3: '6841a101f1a23c0012342453', L4: '6841a101f1a23c0012342454' };
const l1 = new Map<string, boolean>();
for (const items of Object.values(L1_BY_RULE)) for (const [n, m] of items) l1.set(n, (l1.get(n) ?? false) || m);
const stageRows: Array<{ _id: string; vendorStageId: string; vendorConfirmationId: string; vendorConfirmationName: string; isMandatory: boolean }> = [];
const addStage = (stage: string, items: Array<[string, boolean]>) => items.forEach(([n, m]) => {
  const id = hex24(`vcs:${stage}:${n}`);
  stageRows.push({ _id: id, vendorStageId: stage, vendorConfirmationId: id, vendorConfirmationName: n, isMandatory: m });
});
addStage(STAGE.L1, [...l1.entries()]); addStage(STAGE.L2, L2_UNIVERSAL); addStage(STAGE.L3, L3_TECHNOLOGY); addStage(STAGE.L4, L4_TRACK_RECORD);
put('vendor_confirmation_stage', stageRows);
const docs: unknown[] = [];
PROVIDERS.forEach((p, pi) => {
  if (['PendingApproval'].includes(p.status)) return;           // nothing submitted yet
  stageRows.forEach((s, si) => {
    if (!s.isMandatory || s.vendorStageId === STAGE.L1) return;
    const partial = p.status === 'InProgress' && si % 3 === 0;
    const status = partial ? 'Pending' : 'Approved';
    docs.push({
      _id: oid(`vcd:${p.company}:${s.vendorConfirmationId}`), vendorId: vid(p), vendorStageId: s.vendorStageId, vendorConfirmationId: s.vendorConfirmationId,
      fileName: `${slug(s.vendorConfirmationName).slice(0, 40)}.pdf`, filePath: '', fileBase64: '', approvalStatus: status, comments: '',
      uploadedBy: 'admin', uploadedAt: dt(ago(100 - (pi % 30))), waiveReasonId: '', waiveReasonName: '', __v: 0,
    });
  });
});
put('vendor_confirmation_documents', docs);

// ── 5. Vendor selection rules ──────────────────────────────────────────────────
const VSR: Array<[string, string, string, string]> = [
  ['Conflict Check', 'Compliance', 'Prevents vendor assignment when conflict of interest is detected.', 'IF vendor.conflict_flag = TRUE THEN exclude vendor'],
  ['Geographic Eligibility', 'Coverage', 'Restricts vendor selection based on service area coverage.', 'IF vendor.states CONTAINS claim.state THEN include vendor'],
  ['Capacity Limit', 'Capacity', 'Limits vendor selection when capacity exceeds threshold.', 'IF vendor.utilization > 80% THEN exclude vendor'],
  ['KPI Sort', 'Ranking', 'Sorts eligible vendors by KPI performance score.', 'ORDER BY vendor.kpi_score DESC'],
  ['ROI Threshold', 'Financial', 'Excludes vendors below ROI threshold.', 'IF vendor.roi >= 30% THEN include vendor'],
  ['License Valid for Claim State', 'Compliance', 'Vendor must hold a current Florida licence for the service.', 'IF vendor.license_state = claim.state AND vendor.license_status = ACTIVE THEN include vendor'],
  ['NFIP Authorization Required', 'Compliance', 'Flood claims go only to adjusters holding a current NFIP certification.', 'IF claim.lob = Flood AND vendor.nfip_certified = FALSE THEN exclude vendor'],
  ['CAT Surge Capacity', 'Capacity', 'During a declared catastrophe, prefer vendors with a surge attestation and boost.', 'IF claim.cat_event_flag = TRUE THEN prefer vendor.cat_surge_attested = TRUE'],
];
put('vendor_selection_rules', VSR.map(([name, category, description, c], i) => ({
  _id: oid('vsr' + name), ruleId: uuid('vsrule' + name), name, category, description, status: 'Active', conditions: c, createdBy: 'Admin',
  createdOn: dt(ago(90 - i)), updatedBy: 'Admin', updatedOn: dt(ago(90 - i)), isDeleted: false, __v: 0,
})));
put('vendor_selection_audit', VSR.slice(5).map(([name]) => ({ _id: oid('vsa' + name), auditId: uuid('vsa' + name), ruleId: uuid('vsrule' + name), action: 'CREATE', user: 'Admin', timestamp: dt(ago(20)), __v: 0 })));

// ── 6. Field mappings ──────────────────────────────────────────────────────────
const STD = ['claimNumber', 'policyNumber', 'insuredName', 'claimType', 'lossDate', 'reportedDate', 'claimAmount', 'claimStatus', 'validationStatus', 'validationMessage'];
const ruleFields = [...new Set(RULES.flatMap((r) => r.conds.map((c) => c[0])))];
const mapFields = [...STD, ...ruleFields.map(camel), 'causeOfLoss', 'policyForm', 'floodZone', 'coverageALimit', 'buildingExposure', 'contentsExposure', 'propertyAddress', 'assignedAdjuster', 'contractorName'];
const MAP_UP = uuid('mapping-upload');
put('field_mapping_uploads', [{ _id: oid('fmu'), uploadId: MAP_UP, fileName: 'property-field-mapping-template.xlsx', uploadType: 'EXCEL', uploadedBy: 'Admin', uploadDate: dt(ago(45)), totalRecords: mapFields.length, status: 'Processed', headers: '["Payload Fields","Field Mapping"]', validationResults: 'PASS', processingMessages: `Processed ${mapFields.length} record(s), ${mapFields.length} mapping(s).`, createdAt: dt(ago(45)), updatedAt: dt(ago(45)), __v: 0 }]);
put('field_mapping_configurations', mapFields.map((f, i) => ({ _id: oid('fmc' + f), mappingId: uuid('fmc' + f), uploadId: MAP_UP, sourceField: f, targetField: f, dataType: /Amount|Days|Pct|Years|Score|Limit|Exposure/.test(f) ? 'Number' : 'String', isMandatory: STD.slice(0, 7).includes(f), sortOrder: i, __v: 0 })));
put('field_mapping_audits', [{ _id: oid('fma'), auditId: uuid('fma'), uploadId: MAP_UP, action: 'UPLOAD', performedBy: 'Admin', performedDate: dt(ago(45)), remarks: 'Property field mapping loaded', __v: 0 }]);
put('field_mapping_records', []);

// ── 7. Claims ──────────────────────────────────────────────────────────────────
const ADJUSTERS = ['Priya Nair', 'Sarah Mitchell', 'James Okoro', 'Derek Chan'];
const SUPERVISOR = 'claimssupervisor';
const FORM_TYPE = (c: ClaimSpec) => c.form;
const active = RULES.map((r) => ({ roleId: roleId(r), roleName: r.name, lineOfBusiness: r.lobs as string[] }));
const condsByRole = new Map<string, ConditionData[]>();
conds.forEach((c) => { (condsByRole.get(c.roleId) ?? condsByRole.set(c.roleId, []).get(c.roleId)!).push(c); });
const bestProvider = (ruleName: string, skip = 0) => PROVIDERS.filter((p) => p.status === 'Active' && p.rules.includes(ruleName)).sort((a, b) => b.rating - a.rating)[skip]?.company ?? '';

const uploads = (['Homeowners', 'Renters', 'Landlord', 'Dwelling', 'Flood'] as LineOfBusiness[]).map((lob) => ({ lob, uploadId: uuid('upload:' + lob) }));
const uploadOf = (lob: LineOfBusiness) => uploads.find((u) => u.lob === lob)!.uploadId;

const records: Array<Record<string, unknown>> = [];
const changeLogs: unknown[] = [];
const SEVSCORE = { low: 3, moderate: 5, high: 8, catastrophic: 10 };

for (const c of CLAIMS) {
  const num = `${CLAIM_PREFIX[c.lob]}-2026-${String(100000 + c.n + ['Homeowners', 'Renters', 'Landlord', 'Dwelling', 'Flood'].indexOf(c.lob) * 100)}`;
  const sev = c.sev ?? (c.amount > 100000 ? 'high' : c.amount > 25000 ? 'moderate' : 'low');
  const adj = ADJUSTERS[(c.n + c.lob.length) % ADJUSTERS.length];
  const flat: Record<string, unknown> = {
    claimNumber: num, policyNumber: `POL-${c.form.replace(/\W/g, '')}-${300000 + c.n * 37 + c.lob.length * 1000}`, insuredName: c.insured,
    claimType: FORM_TYPE(c), lossDate: ymd(ago(c.lossAgo)), reportedDate: ymd(ago(c.reportedAgo)), claimAmount: String(c.amount),
    claimStatus: c.stage === 'DN' ? 'Denied' : c.stage === 'CP' ? 'Closed' : 'Active', validationStatus: 'Passed', validationMessage: 'Passed',
    severityCategory: sev, severityScore: SEVSCORE[sev], jurisdiction: 'FL', fraudScore: 20 + (c.n * 7) % 25,
    statusIntervalDays: 10, totalReserveAmount: Math.round(c.amount * 1.15), potentialRecoveryAmount: 0,
    daysSinceLoss: c.lossAgo, daysSinceNotice: c.reportedAgo,
    acknowledgedFlag: 'present', paymentDecisionIssuedFlag: 'present',
  };
  if (c.lob === 'Flood') flat['proofOfLossReceivedFlag'] = 'present';
  for (const f of c.flags ?? []) flat[camel(f)] = 'present';
  for (const [k, v] of Object.entries(c.ov ?? {})) {
    const key = camel(k);
    if (v === '') delete flat[key]; else flat[key] = v;
  }
  // legacy alias used by the rule: status_interval_days -> statusIntervalDays (set above)
  const nested = {
    lossInformation: { causeOfLoss: c.cause, damagedAreas: c.areas, lossDate: flat['lossDate'] },
    policyInformation: { policyForm: c.form, floodZone: c.lob === 'Flood' ? (flat['sfhaFlag'] ? 'AE' : 'X') : '', coverageALimit: c.lob === 'Flood' ? 250000 : Math.round(c.amount * 4 / 1000) * 1000 + 150000 },
    claimInformation: { jurisdiction: 'FL', claimSeverity: sev, severityScore: SEVSCORE[sev] },
    financialExposure: { buildingExposure: Number(flat['buildingLossAmount'] ?? flat['contractorEstimateAmount'] ?? c.amount), contentsExposure: Number(flat['contentsLossAmount'] ?? 0) },
    property: { address: `${100 + c.n * 13} ${STREETS[c.n % STREETS.length]}, ${c.city}, FL`, county: c.county },
    assignment: { assignedAdjuster: adj, contractorName: '' },
  };

  const planServices = active.filter((r) => { const lob = mapClaimTypeToLOB(String(flat['claimType'])); return lob && r.lineOfBusiness.includes(lob) && evaluateRoleConditions(flat, condsByRole.get(r.roleId) ?? []); }).map((r) => r.roleId);
  const nameOf = (id: string) => RULES.find((r) => roleId(r) === id)!.name;

  let planServiceStatus = 'Pending Selection';
  let svr: Array<Record<string, unknown>> = [];
  let confirmed: string[] = [];
  const extra: Record<string, unknown> = {};
  const submittedAt = ago(Math.max(1, c.reportedAgo - 3)).toISOString();
  const entry = (id: string, status: string, o: Record<string, unknown> = {}) => {
    const name = nameOf(id); const rec = bestProvider(name);
    return { roleName: name, changeType: 'ProviderChange', recommendedVendor: rec, proposedVendor: rec, selectedVendor: rec, status, confirmedBy: adj, confirmedAt: submittedAt, _id: oid(`svr:${num}:${name}`), ...o };
  };

  if (c.stage !== 'PS') {
    if (c.stage === 'PR') {
      planServiceStatus = 'Pending Review';
      svr = planServices.map((id, i) => i === 0 ? entry(id, 'Pending Review', { selectedVendor: bestProvider(nameOf(id), 1) || bestProvider(nameOf(id)), adjusterComment: 'Closer to the loss location and faster on site' })
        : i === 1 && planServices.length > 2 ? entry(id, 'Pending Review') : entry(id, 'Locked'));
      if (c.n % 3 === 0) svr.push({ roleName: 'Legal', changeType: 'ServiceAdded', recommendedVendor: '', proposedVendor: bestProvider('Legal'), selectedVendor: bestProvider('Legal'), status: 'Pending Review', confirmedBy: adj, confirmedAt: submittedAt, adjusterComment: 'Coverage position needs counsel', _id: oid(`svr:${num}:Legal`) });
    } else {
      planServiceStatus = c.stage === 'FS' ? 'Finalized Selection' : 'Completed';
      const reviewed = { reviewedBy: SUPERVISOR, reviewedAt: ago(Math.max(1, c.reportedAgo - 6)).toISOString() };
      svr = planServices.map((id, i) => {
        if (c.stage === 'FS' && i === 0) return entry(id, 'Modified', { selectedVendor: bestProvider(nameOf(id), 1) || bestProvider(nameOf(id)), adjusterComment: 'Faster arrival time', supervisorComment: 'Approved: closer to the risk', ...reviewed });
        if (c.stage === 'FS' && i === 1 && planServices.length > 2) return entry(id, 'Locked');
        return entry(id, 'Locked');
      });
      if (c.stage === 'FS') {
        svr.push({ roleName: 'Forensic Accountant', changeType: 'ServiceAdded', recommendedVendor: '', proposedVendor: bestProvider('Forensic Accountant'), selectedVendor: bestProvider('Forensic Accountant'), status: c.n % 2 ? 'Included' : 'Rejected', confirmedBy: adj, confirmedAt: submittedAt, adjusterComment: 'Rent loss needs validating', supervisorComment: c.n % 2 ? 'Agreed, include' : 'Not warranted at this exposure', ...reviewed, _id: oid(`svr:${num}:FA`) });
      }
    }
    confirmed = svr.filter((e) => ['Locked', 'Modified', 'Included'].includes(String(e['status']))).map((e) => ROLE_BY_NAME.get(String(e['roleName']))!);
    extra['adjusterSubmittedBy'] = adj; extra['adjusterSubmittedAt'] = submittedAt;
    extra['adjusterComments'] = svr.find((e) => e['adjusterComment'])?.['adjusterComment'] ?? 'Plan services confirmed';
    if (c.stage !== 'PR') { extra['vendorServiceComments'] = 'Vendor selection confirmed'; }
    if (c.stage === 'CP') { extra['isCompleted'] = true; extra['completedAt'] = ago(2).toISOString(); extra['completedBy'] = adj; }
    if (c.stage === 'DN') { extra['isCompleted'] = true; extra['completedAt'] = ago(3).toISOString(); extra['completedBy'] = adj; }
  }
  if (c.stage === 'DN') {          // coverage declined: decision letter only, finalized
    planServiceStatus = 'Completed';
    const dl = ROLE_BY_NAME.get('Decision letters')!;
    svr = [entry(dl, 'Locked')];
    confirmed = [dl]; extra['adjusterComments'] = 'Coverage declined; decision letter issued'; extra['adjusterSubmittedBy'] = adj; extra['adjusterSubmittedAt'] = submittedAt;
    extra['vendorServiceComments'] = 'Vendor selection confirmed';
  }

  const rec: Record<string, unknown> = {
    _id: oid('rec' + num), ...flat, ...nested, uploadId: uploadOf(c.lob), recordIndex: c.n,
    planServices: c.stage === 'DN' ? [...new Set([...planServices, ROLE_BY_NAME.get('Decision letters')!])] : planServices,
    existingplanservices: planServices, confirmedPlanServices: confirmed, planServiceStatus,
    planServiceComments: c.stage === 'PS' ? '' : 'Plan services confirmed', isCompleted: false, completedAt: null, completedBy: '',
    serviceVendorReview: svr, vendorServices: svr.filter((e) => e['status'] !== 'Rejected').map((e) => e['selectedVendor']), servicesTriggered: planServices.length,
    __v: 0, ...extra,
  };
  records.push(rec);

  if (c.stage !== 'PS') {
    for (const e of svr) {
      changeLogs.push({ _id: oid(`cl:${num}:${e['roleName']}:r`), uploadId: uploadOf(c.lob), recordIndex: c.n, claimNumber: num, type: 'role', changedItem: e['roleName'], previousValue: '—', updatedValue: e['roleName'], reason: 'Plan services confirmed', updatedBy: adj, updatedAt: dt(submittedAt), __v: 0 });
      if (e['status'] !== 'Rejected') changeLogs.push({ _id: oid(`cl:${num}:${e['roleName']}:v`), uploadId: uploadOf(c.lob), recordIndex: c.n, claimNumber: num, type: 'vendor', changedItem: e['selectedVendor'], previousValue: e['recommendedVendor'] || '—', updatedValue: e['selectedVendor'], reason: e['adjusterComment'] ?? 'Vendor selection confirmed', updatedBy: adj, updatedAt: dt(submittedAt), __v: 0 });
    }
  }
}
put('claim_intake_records', records);
put('claim_change_logs', changeLogs);
put('claim_intakes', uploads.map((u, i) => ({ _id: oid('up' + u.lob), uploadId: u.uploadId, fileName: `${u.lob}-claims-demo.json`, uploadType: 'JSON', uploadedBy: 'Admin', uploadDate: dt(ago(35 - i)), status: 'Processed', totalClaims: 15, successCount: 15, failedCount: 0, validationResults: 'PASS', processingMessages: 'Processed 15 claim(s). All succeeded.', createdAt: dt(ago(35 - i)), updatedAt: dt(ago(35 - i)), __v: 0 })));
put('claim_intake_audits', uploads.map((u, i) => ({ _id: oid('ua' + u.lob), uploadId: u.uploadId, action: 'UPLOAD', user: 'Admin', timestamp: dt(ago(35 - i)), status: 'Processed', remarks: 'JSON upload — 15 record(s)', __v: 0 })));

// ── write ──────────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true });
for (const [name, rows] of Object.entries(files)) fs.writeFileSync(path.join(OUT, `claim_triage.${name}.json`), JSON.stringify(rows, null, 2) + '\n');
console.log(Object.entries(files).map(([n, r]) => `${n}: ${r.length}`).join('\n'));
