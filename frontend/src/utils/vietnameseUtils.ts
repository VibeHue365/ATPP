/**
 * Chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu, chuyển chữ thường, bỏ khoảng trắng dư thừa
 */
export function removeVietnameseAccents(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Kiểm tra xem chuỗi nguồn có chứa chuỗi tìm kiếm không (không phân biệt dấu và hoa thường)
 */
export function includesVietnamese(source?: string | null, target?: string | null): boolean {
  if (!target || !target.trim()) return true;
  if (!source) return false;
  return removeVietnameseAccents(source).includes(removeVietnameseAccents(target));
}
