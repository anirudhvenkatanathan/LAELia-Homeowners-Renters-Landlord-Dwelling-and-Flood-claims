import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { logError } from '../services/errorLogService';

// The key is optional: without it the AI endpoints answer 503 with a clear
// message instead of failing on every call. Created lazily so the key is read
// at request time (serverless cold starts, env changes).
let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}
const AI_MODEL = process.env['ANTHROPIC_MODEL'] || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `
SYSTEM PROMPT — CLAIM SUMMARY GENERATOR

You are a claim summarization assistant for residential property insurance (Homeowners, Renters, Landlord, Dwelling and Flood). Read the claim payload and output exactly 4 bullet points — no more, no less — summarizing the claim for an adjuster.

NEVER include: vendor names, service recommendations, platform logic, system statuses, forward-looking statements, section headers, or prose paragraphs.

ALWAYS: one fact per bullet, each bullet starting with "- " and written as a single short, crisp natural-language sentence (no line breaks, no sub-bullets, max ~15 words). Write full sentences, e.g. "Insured Jane Doe holds an HO3 policy for a home in Lee County." or "Total reserve is set at $50,000." — NEVER as "Label: Value" pairs (e.g. do not write "Insured Name: Jane Doe" or "Total Reserve: $50,000"). Prioritize the most material facts present in the payload, such as: insured name, policy form (HO3, HO4, HO5, HO6, DF1, DF3, SFIP), property address or county, date of loss, cause of loss, damaged areas, flood zone, reported date, claim number, status, policy number, dwelling and contents exposure, deductible, total reserve, claim amount, prior payments, and key claim indicators (catastrophe event, displaced insured, public adjuster, proof of loss).

Never write "N/A" or "Not available." State only what the data shows — never what will happen, what is recommended, or what has been engaged.
 `;

export async function generateClaimSummary(req: Request, res: Response): Promise<void> {
  try {
    const claim = req.body as Record<string, unknown>;

    if (!claim || typeof claim !== 'object') {
      res.status(400).json({ success: false, message: 'Claim payload is required.' });
      return;
    }

    const ai = getClient();
    if (!ai) {
      res.status(503).json({ success: false, message: 'AI summaries are unavailable: no Anthropic API key is configured.' });
      return;
    }

    const message = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Summarize the following claim:\n\n${JSON.stringify(claim, null, 2)}` }],
    });

    const summaryBlock = message.content.find(b => b.type === 'text');
    const summary = summaryBlock ? (summaryBlock as { type: 'text'; text: string }).text.trim() : '';

    res.status(200).json({ success: true, summary });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[aiSummary] Error:', errMsg);
    await logError(err as Error, 'aiSummaryController.generateClaimSummary');
    res.status(500).json({ success: false, message: 'AI summary service is currently unavailable.' });
  }
}
