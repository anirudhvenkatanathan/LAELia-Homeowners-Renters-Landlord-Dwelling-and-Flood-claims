import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { logError } from '../services/errorLogService';

// Optional key: without it the endpoint answers 503 with a clear message.
let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}
const AI_MODEL = process.env['ANTHROPIC_MODEL'] || 'claude-sonnet-4-6';

export interface RedFlag {
  severity:    'HIGH' | 'MODERATE' | 'LOW';
  category:    string;
  description: string;
  reference:   string;
}

export interface VendorIntelligenceResult {
  summary:   string;
  redFlags:  RedFlag[];
}

export async function generateVendorIntelligence(req: Request, res: Response): Promise<void> {
  try {
    const vendor = req.body as Record<string, unknown>;

    if (!vendor || typeof vendor !== 'object') {
      res.status(400).json({ success: false, message: 'Vendor payload is required.' });
      return;
    }

    const prompt = `You are a vendor risk intelligence system for a Florida residential property insurance carrier (Homeowners, Renters, Landlord, Dwelling and Flood). Vendors include adjusters, restoration and repair contractors, roofers, engineers, appraisers and flood (NFIP) adjusters. Analyze the following vendor profile and return a structured JSON response.

Vendor Data:
${JSON.stringify(vendor, null, 2)}

Return ONLY valid JSON (no markdown, no code fences) in this exact shape:
{
  "summary": "2-4 sentence business-friendly overview covering company type, geographic coverage, specialization, staff size, and compliance standing",
  "redFlags": [
    {
      "severity": "HIGH" | "MODERATE" | "LOW",
      "category": "UPPERCASE CATEGORY NAME",
      "description": "1-2 sentence specific action or finding",
      "reference": "domain.com (relevant reference source, no https://)"
    }
  ]
}

Rules:
- summary must be factual, derived only from the provided data
- redFlags should surface real concerns about licensing (Florida adjuster or contractor licence), insurance (general liability, workers' compensation), regulatory standing, qualifications (for example NFIP authorization or restoration certifications), or documentation gaps based on the data
- If vendor status is Active and all qualifications are complete, redFlags can be empty []
- severity HIGH = blocks operations, MODERATE = needs attention, LOW = informational
- category values: LICENSING, INSURANCE, REGULATORY, QUALIFICATION, DOCUMENTATION, COMPLIANCE, FINANCIAL
- reference must be a real authoritative domain relevant to the category (e.g. myfloridalicense.com, floir.com, fema.gov, acord.org)
- Return 0–5 red flags maximum
- Output ONLY the JSON object, nothing else`;

    const ai = getClient();
    if (!ai) {
      res.status(503).json({ success: false, message: 'Vendor intelligence is unavailable: no Anthropic API key is configured.' });
      return;
    }

    const message = await ai.messages.create({
      model:      AI_MODEL,
      max_tokens: 1024,
      messages:   [{ role: 'user', content: prompt }],
    });

    const block = message.content.find((b) => b.type === 'text');
    const raw   = block ? (block as { type: 'text'; text: string }).text.trim() : '{}';

    let result: VendorIntelligenceResult;
    try {
      result = JSON.parse(raw) as VendorIntelligenceResult;
    } catch {
      result = { summary: raw, redFlags: [] };
    }

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[aiVendorIntelligence] Error:', errMsg);
    await logError(err as Error, 'aiVendorIntelligenceController.generateVendorIntelligence');
    res.status(500).json({ success: false, message: 'Vendor intelligence service is currently unavailable.' });
  }
}
