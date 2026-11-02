import { describe, it, expect } from 'vitest';
import { buildCrfWorkbook, LOB_LIST } from '../crfWorkbook';
import type { ComplianceSummary } from '../../models/compliance/complianceModel';

const summary = {
  event: { eventId: '26B-FL', eventName: 'Hurricane Isaias' },
  byLine: [{ lob: 'HO', lobName: 'Homeowners', claims: 2, openPay: 1, openNoPay: 0, closedPay: 1, closedNoPay: 0, paidLoss: 1000, paidAlae: 60, incurred: 1500 }],
  rows: [{ lob: 'HO', lobName: 'Homeowners', county: 'Escambia', zip: '32502', claims: 2, openPay: 1, openNoPay: 0, closedPay: 1, closedNoPay: 0, paidLoss: 1000, paidAlae: 60, incurred: 1500 }],
  surveyByLine: {},
} as unknown as ComplianceSummary;

describe('buildCrfWorkbook', () => {
  it('writes the template tabs and every template line of business', async () => {
    const blob = await buildCrfWorkbook(summary, { preparer: 'A', email: 'a@b.c', phone: '1', companyName: 'X', naicCode: '1', floridaCompanyCode: '1', fein: '1',
      groupCode: '1', domicile: 'FL', grossPayable: 1000, reinsurance: 0, model: 'N/A', howEvaluated: 'Case reserves' }, '2026-11-02');
    const buf: ArrayBuffer = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as ArrayBuffer); fr.readAsArrayBuffer(blob); });
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames).toEqual(['Version', 'Instructions', 'Claims Data Extract', 'Contact and Statewide Modeling', 'Validation Checks', 'Survey', 'Valid Responses']);
    expect(LOB_LIST.map(([c]) => c)).toContain('PF');
    const vc = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Validation Checks'], { header: 1 });
    expect(vc).toHaveLength(38); // header + questions 1-37
  });
});
