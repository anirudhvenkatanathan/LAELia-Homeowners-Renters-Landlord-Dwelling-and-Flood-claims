import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { logError } from '../services/errorLogService';

const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] ?? '' });

const SYSTEM_PROMPT = `
SYSTEM PROMPT — CLAIM SUMMARY GENERATOR

You are a claim summarization assistant. Read the claim payload and output exactly 4 bullet points — no more, no less — summarizing the claim for an adjuster.

NEVER include: vendor names, service recommendations, platform logic, system statuses, forward-looking statements, section headers, or prose paragraphs.

ALWAYS: one fact per bullet, each bullet starting with "- " and written as a single short, crisp natural-language sentence (no line breaks, no sub-bullets, max ~15 words). Write full sentences, e.g. "Claimant John Doe is employed by Acme Corp." or "Total reserve is set at $50,000." — NEVER as "Label: Value" pairs (e.g. do not write "Claimant Name: John Doe" or "Total Reserve: $50,000"). Prioritize the most material facts present in the payload, such as: claimant name, employer, jurisdiction, DOL, reported date, claim number, status, policy number, AWW, indemnity exposure, medical exposure, total reserve, claim amount, prior payments, and key claim indicators.

Never write "N/A" or "Not available." State only what the data shows — never what will happen, what is recommended, or what has been engaged.
 `;

export async function generateClaimSummary(req: Request, res: Response): Promise<void> {
  try {
    const claim = req.body as Record<string, unknown>;

    if (!claim || typeof claim !== 'object') {
      res.status(400).json({ success: false, message: 'Claim payload is required.' });
      return;
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
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
