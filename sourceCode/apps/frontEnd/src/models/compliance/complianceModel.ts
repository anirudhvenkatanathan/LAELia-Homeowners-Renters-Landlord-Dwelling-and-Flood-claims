export interface CatEvent {
  eventId: string; eventName: string; eventType: string; states: string[]; lossDateFrom: string; lossDateTo: string; counties: string[];
  emergencyDeclared: boolean; crfApplicable: boolean; crfForm: string; dataCallStatus: string; note: string; claimCount: number;
}
export interface CrfCounts { claims: number; openPay: number; openNoPay: number; closedPay: number; closedNoPay: number; paidLoss: number; paidAlae: number; incurred: number; }
export interface CrfRow extends CrfCounts { lob: string; lobName: string; county: string; zip: string; }
export interface CrfLine extends CrfCounts { lob: string; lobName: string; }
export interface SurveyData {
  closedWithPaymentByDays: number[]; closedWithoutPaymentByDays: number[]; openInAppraisal: number; openInLitigation: number; openAttorneyRepresented: number;
  openPublicAdjuster: number; openWaitingOnContractors: number; openWindVsFlood: number; reopened: number; supplemental: number;
}
export interface VendorWorkloadRow {
  vendor: string; services: string; rating: number; assignedInScope: number; activeAssignments: number; capacity: number; utilizationPct: number; status: string;
}
export interface PaClaimRow {
  claimNumber: string; insured: string; county: string; submittedAmount: number; publicAdjusterFirm: string; settlementAmount: number | null;
  independentAdjuster: string; status: string; catNumber: string;
}
export interface ComplianceSummary {
  event: CatEvent | null; eventId: string; totalRecords: number; crfEligibleCount: number; excluded: { claimNumber: string; reason: string }[];
  totals: CrfCounts; byLine: CrfLine[]; rows: CrfRow[]; survey: SurveyData; surveyByLine: Record<string, SurveyData>;
  timeline: { date: string; count: number }[]; vendorWorkload: VendorWorkloadRow[]; paClaims: PaClaimRow[];
  validations: { id: number; label: string; ok: boolean }[];
}
export interface ComplianceEventsResponse { totalClaims: number; nonCatClaims: number; data: CatEvent[]; }
