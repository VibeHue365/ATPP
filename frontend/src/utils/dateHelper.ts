/**
 * Định dạng khoảng ngày thuê (ví dụ: DD/MM - DD/MM/YYYY)
 */
export const formatDateRange = (fromStr?: string | null, toStr?: string | null): string => {
  if (!fromStr) return '';
  const formatSingle = (str: string) => {
    const parts = str.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    if (str.includes('/')) {
      const p = str.split('/');
      if (p.length === 3) return `${p[1]}/${p[0]}`;
    }
    return str;
  };
  
  const formattedFrom = formatSingle(fromStr);
  if (!toStr) return formattedFrom;
  const formattedTo = formatSingle(toStr);
  const year = fromStr.split('-')[0] || new Date().getFullYear().toString();
  return `${formattedFrom} - ${formattedTo}/${year}`;
};

/**
 * Định dạng ngày đơn (ví dụ: DD/MM/YYYY)
 */
export const formatSingleDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  if (dateStr.includes('/')) return dateStr;
  return dateStr;
};

/**
 * Lấy ngày/tháng (ví dụ: DD/MM)
 */
export const getDayMonth = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  if (dateStr.includes('/')) {
    const p = dateStr.split('/');
    if (p.length === 3) return `${p[1]}/${p[0]}`;
  }
  return dateStr;
};
