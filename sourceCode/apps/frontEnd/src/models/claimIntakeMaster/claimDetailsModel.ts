// ─── Row shape displayed in the Claim Details AG Grid ────────────────────────

export interface ClaimDetailRow {
  rowIndex:         number;
  claimNumber:      string;
  policyNumber:     string;
  insuredName:      string;
  claimType:        string;
  claimStatus:      string;
  lossDate:         string;
  reportedDate:     string;
  claimAmount:      string;
  validationStatus: string;
  processingStatus: string;
}

// ─── Summary counts shown in KPI cards ───────────────────────────────────────

export interface ClaimDetailStats {
  total:      number;
  successful: number;
  failed:     number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Try to read a field from a raw record using common key variations. */
function pick(raw: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const val = raw[k];
    if (val !== undefined && val !== null && val !== '') return String(val);
  }
  return '';
}

function normaliseRow(raw: Record<string, unknown>, idx: number, validationStatus: string): ClaimDetailRow {
  return {
    rowIndex:         idx + 1,
    claimNumber:      pick(raw, ['claimNumber', 'ClaimNumber', 'claim_number', 'CLAIM_NUMBER']),
    policyNumber:     pick(raw, ['policyNumber', 'PolicyNumber', 'policy_number', 'POLICY_NUMBER']),
    insuredName:      pick(raw, ['insuredName', 'InsuredName', 'insured_name', 'insured', 'INSURED_NAME']),
    claimType:        pick(raw, ['claimType', 'ClaimType', 'claim_type', 'CLAIM_TYPE']),
    claimStatus:      pick(raw, ['claimStatus', 'ClaimStatus', 'claim_status', 'status']) || 'Active',
    lossDate:         pick(raw, ['lossDate', 'LossDate', 'loss_date', 'LOSS_DATE']),
    reportedDate:     pick(raw, ['reportedDate', 'ReportedDate', 'reported_date', 'REPORTED_DATE']),
    claimAmount:      pick(raw, ['claimAmount', 'ClaimAmount', 'claim_amount', 'amount', 'CLAIM_AMOUNT']),
    validationStatus,
    processingStatus: pick(raw, ['processingStatus', 'ProcessingStatus', 'processing_status']) || 'Processed',
  };
}

/** Parse XML string using DOMParser — returns one row per <claim> element. */
function parseXml(xml: string, validationStatus: string): ClaimDetailRow[] {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.querySelector('parsererror')) return [];

    const get = (parent: Element, ...tags: string[]) => {
      for (const t of tags) {
        const el = parent.querySelector(t) ?? parent.querySelector(t.toLowerCase());
        if (el?.textContent?.trim()) return el.textContent.trim();
      }
      return '';
    };

    // Support <claims><claim>…</claim></claims> or bare <claim>…</claim>
    const claimEls = Array.from(doc.querySelectorAll('claim'));
    const root     = doc.documentElement;
    const targets  = claimEls.length > 0 ? claimEls : [root];

    return targets.map((el, idx) => ({
      rowIndex:         idx + 1,
      claimNumber:      get(el, 'claimNumber', 'ClaimNumber'),
      policyNumber:     get(el, 'policyNumber', 'PolicyNumber'),
      insuredName:      get(el, 'insuredName', 'InsuredName'),
      claimType:        get(el, 'claimType', 'ClaimType'),
      claimStatus:      get(el, 'claimStatus', 'ClaimStatus') || 'Active',
      lossDate:         get(el, 'lossDate', 'LossDate'),
      reportedDate:     get(el, 'reportedDate', 'ReportedDate'),
      claimAmount:      get(el, 'claimAmount', 'ClaimAmount'),
      validationStatus,
      processingStatus: 'Processed',
    }));
  } catch {
    return [];
  }
}

/** Main parser — tries JSON first, falls back to XML, then empty. */
export function parsePayload(
  payload:          string,
  uploadType:       string,
  validationResult: string
): ClaimDetailRow[] {
  if (!payload?.trim()) return [];

  const validationStatus = validationResult === 'PASS' ? 'Valid' : 'Invalid';

  // ── JSON (array or single object) ────────────────────────────────────────
  try {
    const parsed: unknown = JSON.parse(payload);
    if (Array.isArray(parsed)) {
      return parsed.map((row, i) =>
        normaliseRow(row as Record<string, unknown>, i, validationStatus)
      );
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return [normaliseRow(parsed as Record<string, unknown>, 0, validationStatus)];
    }
  } catch {
    // not JSON
  }

  // ── XML ───────────────────────────────────────────────────────────────────
  if (uploadType === 'XML' || payload.trimStart().startsWith('<')) {
    return parseXml(payload, validationStatus);
  }

  return [];
}

/** Derive stats from a row array. */
export function computeStats(rows: ClaimDetailRow[]): ClaimDetailStats {
  const successful = rows.filter((r) => r.validationStatus === 'Valid').length;
  return {
    total:      rows.length,
    successful,
    failed:     rows.length - successful,
  };
}
