/**
 * Pure threshold formatting/parsing helpers.
 * No external dependencies — safe to unit test without mocking.
 */

export function formatThreshold(raw: string): string {
  if (!raw) return '';
  if (/[a-zA-Z]/.test(raw)) return raw;
  return `Good ≥ ${raw}%`;
}

export function applySuggestedThreshold(formatted: string, reduction: number): string {
  return formatted.replace(/\d+(?:\.\d+)?/, (n) => String(parseFloat(n) - reduction));
}

export function extractNumericThreshold(formatted: string): string {
  const match = formatted.match(/\d+(?:\.\d+)?/);
  return match ? match[0] : formatted;
}
