/**
 * Utility functions for safe Regular Expression handling and ReDoS prevention.
 */

/**
 * Escapes all regular expression special characters in a string.
 * Characters escaped: . * + ? ^ $ { } ( ) | [ ] \ /
 */
export function escapeRegex(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * Creates a safe RegExp object from untrusted user input:
 * 1. Truncates input to maxLength (default 100) to mitigate ReDoS.
 * 2. Escapes all regex meta-characters.
 * 3. Catches any unexpected syntax error and returns null instead of throwing.
 */
export function createSafeRegex(
  text?: string | null,
  flags: string = 'i',
  maxLength: number = 100,
): RegExp | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const safeText = escapeRegex(trimmed.slice(0, maxLength));
  try {
    return new RegExp(safeText, flags);
  } catch {
    return null;
  }
}
