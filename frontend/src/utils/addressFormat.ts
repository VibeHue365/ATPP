/**
 * Chuẩn hóa đối tượng hoặc chuỗi địa chỉ cửa hàng / địa điểm nhận-trả thành chuỗi hiển thị an toàn.
 * Tránh lỗi React render trực tiếp object `{ addressLine, ward, district, city }` hoặc `{ address, geo }`.
 */
export function formatLocationAddress(input: unknown, fallback = ''): string {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed || fallback;
  }

  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const street = obj.addressLine ?? obj.address ?? obj.fullAddress;
    const parts = [street, obj.ward, obj.district, obj.city].filter(
      (part): part is string => typeof part === 'string' && part.trim().length > 0,
    );
    const joined = parts.map((part) => part.trim()).join(', ');
    return joined || fallback;
  }

  return fallback;
}
