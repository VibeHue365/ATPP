function normalizeAddressPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Joins structured address fields without repeating fields already present in addressLine. */
export function composeLocationAddress(
  ...values: Array<string | null | undefined>
): string {
  const parts: string[] = [];
  for (const raw of values) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) continue;
    const normalized = normalizeAddressPart(value);
    const alreadyCovered = parts.some((part) => {
      const existing = normalizeAddressPart(part);
      return existing === normalized || existing.includes(normalized);
    });
    if (!alreadyCovered) parts.push(value);
  }
  return parts.join(', ');
}
