import { escapeRegex } from './regex.util';

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

const VIETNAMESE_CHAR_MAP: Record<string, string> = {
  a: '[aàáảãạăằắẳẵặâầấẩẫậ]',
  e: '[eèéẻẽẹêềếểễệ]',
  i: '[iìíỉĩị]',
  o: '[oòóỏõọôồốổỗộơờớởỡợ]',
  u: '[uùúủũụưừứửữự]',
  y: '[yỳýỷỹỵ]',
  d: '[dđ]',
};

/**
 * Xây dựng regex pattern cho tiếng Việt: cho phép gõ không dấu vẫn tìm ra có dấu.
 * Giới hạn maxLength = 100 ký tự và escape toàn bộ ký tự đặc biệt để chống ReDoS / Injection.
 */
export function buildVietnameseRegexPattern(text: string, maxLength: number = 100): string {
  if (!text) return '';
  const truncated = text.trim().slice(0, maxLength);
  const escaped = escapeRegex(truncated).toLowerCase();
  return escaped
    .split('')
    .map((char) => VIETNAMESE_CHAR_MAP[char] || char)
    .join('');
}
