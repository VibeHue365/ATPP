/**
 * Chuẩn hóa đối tượng hoặc chuỗi địa chỉ cửa hàng / địa điểm nhận-trả thành chuỗi hiển thị an toàn.
 * Tránh lỗi React render trực tiếp object `{ addressLine, ward, district, city }` hoặc `{ address, geo }`.
 */
function normalizeAddressPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function formatLocationAddress(input: unknown, fallback = ''): string {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed || fallback;
  }

  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const street = obj.addressLine ?? obj.address ?? obj.fullAddress;
    const rawParts = [street, obj.ward, obj.district, obj.city].filter(
      (part): part is string => typeof part === 'string' && part.trim().length > 0,
    );
    const deduped: string[] = [];
    for (const raw of rawParts) {
      const value = raw.trim();
      const normalized = normalizeAddressPart(value);
      const alreadyCovered = deduped.some((existingPart) => {
        const existing = normalizeAddressPart(existingPart);
        return existing === normalized || existing.includes(normalized);
      });
      if (!alreadyCovered) deduped.push(value);
    }
    return deduped.join(', ') || fallback;
  }

  return fallback;
}
