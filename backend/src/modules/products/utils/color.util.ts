/**
 * Chuẩn hoá mã màu về một dạng duy nhất.
 *
 * Hàm này là KHOÁ dùng chung cho: biến thể tồn kho (size+màu+chất liệu), thuộc tính
 * `product.colors`, và ảnh theo màu (`product.colorImages`). Vì vậy chỉ được có MỘT bản —
 * trước đây nó bị nhân bản ở products.service và inventory.service, hai bản lệch nhau
 * là dữ liệu ảnh và tồn kho khớp sai mà không báo lỗi.
 */
export function normalizeColor(colorStr?: string | null): string {
  if (!colorStr) return 'WHITE';
  const norm = colorStr.trim().toUpperCase();
  if (norm === 'ĐỎ' || norm === 'RED') return 'RED';
  if (norm === 'TRẮNG' || norm === 'WHITE') return 'WHITE';
  if (norm === 'VÀNG' || norm === 'GOLD') return 'GOLD';
  if (norm === 'ĐEN' || norm === 'BLACK') return 'BLACK';
  return norm;
}
