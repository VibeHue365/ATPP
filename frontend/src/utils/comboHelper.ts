import type { CartItem } from '../context/CartContext';
import { getDayMonth } from './dateHelper';

export const normalizeCity = (city?: string | null): string => {
  if (!city) return '';
  return city.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(thanh pho|tp\.?|tinh)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const isSameCity = (city1?: string | null, city2?: string | null): boolean => {
  const c1 = normalizeCity(city1 || 'Thừa Thiên Huế');
  const c2 = normalizeCity(city2 || 'Thừa Thiên Huế');
  return c1.includes(c2) || c2.includes(c1);
};

export interface ComboGroup {
  id: string;
  title: string;
  type: 'SUCCESS' | 'MISMATCH' | 'OTHERS';
  items: CartItem[];
  syncDate?: string | null;
  warning?: string;
  isCityMismatch?: boolean;
}

export interface FindCombosResult {
  listGroups: ComboGroup[];
  remaining: CartItem[];
  nextIndex: number;
}

export const findCombos = (itemsList: CartItem[], startIndex: number): FindCombosResult => {
  const listGroups: ComboGroup[] = [];
  const photographersList = itemsList.filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE');
  const productsList = itemsList.filter(item => item.itemType === 'PRODUCT' && (item.rentalFrom || item.startDate));
  const groupedIdsInList = new Set<string>();

  let idx = startIndex;

  // A. Match success combos (overlapping dates AND overlapping time slots if hourly, AND matching city location)
  photographersList.forEach(photo => {
    if (groupedIdsInList.has(photo.id)) return;

    const matchingProduct = productsList.find(prod => {
      if (groupedIdsInList.has(prod.id)) return false;
      
      // City match check is mandatory for a successful combo
      const isCityMatch = isSameCity(prod.providerCity, photo.photographerCity);
      if (!isCityMatch) return false;
      
      const rentalFrom = prod.rentalFrom || prod.startDate;
      const rentalTo = prod.rentalTo || prod.endDate;
      const shootDate = photo.shootDate;
      if (!rentalFrom || !rentalTo || !shootDate) return false;
      
      const start = new Date(rentalFrom);
      const end = new Date(rentalTo);
      const shoot = new Date(shootDate);
      
      // Date overlap check
      const isDateOverlap = shoot >= start && shoot <= end;
      if (!isDateOverlap) return false;

      // Time slot overlap check (only if hourly rental)
      if (prod.startTime && prod.endTime && photo.shootTimeSlot) {
        const parts = photo.shootTimeSlot.split('-');
        const photoStart = parts[0]?.trim();
        const photoEnd = parts[1]?.trim();
        if (photoStart && photoEnd) {
          // Check if photo is within prod rental period
          const isTimeOverlap = photoStart >= prod.startTime && photoEnd <= prod.endTime;
          return isTimeOverlap;
        }
      }
      
      return true;
    });

    if (matchingProduct) {
      listGroups.push({
        id: `combo_${idx++}`,
        title: `NHÓM COMBO ${idx - 1} - ĐỒNG BỘ THÀNH CÔNG`,
        type: 'SUCCESS',
        items: [matchingProduct, photo],
        syncDate: matchingProduct.rentalFrom || matchingProduct.startDate
      });
      groupedIdsInList.add(photo.id);
      groupedIdsInList.add(matchingProduct.id);
    }
  });

  // B. Match mismatched combos
  photographersList.forEach(photo => {
    if (groupedIdsInList.has(photo.id)) return;

    const matchingProduct = productsList.find(prod => !groupedIdsInList.has(prod.id));

    if (matchingProduct) {
      const rentalFrom = matchingProduct.rentalFrom || matchingProduct.startDate;
      const shootDate = photo.shootDate;
      const prodDateFormatted = getDayMonth(rentalFrom);
      const photoDateFormatted = getDayMonth(shootDate);
      const prodCity = matchingProduct.providerCity || 'Thừa Thiên Huế';
      const photoCity = photo.photographerCity || 'Thừa Thiên Huế';
      const isCityMatch = isSameCity(prodCity, photoCity);
      
      let warning = '';
      let isCityMismatch = false;
      
      if (!isCityMatch) {
        warning = `Không thể đi chung Combo: Áo dài nhận tại ${prodCity} nhưng Thợ ảnh hoạt động ở ${photoCity}.`;
        isCityMismatch = true;
      } else if (rentalFrom !== shootDate) {
        warning = `Ngày thuê Áo dài (${prodDateFormatted}) và Ngày chụp (${photoDateFormatted}) đang không trùng khớp.`;
      } else if (matchingProduct.startTime && matchingProduct.endTime && photo.shootTimeSlot) {
        const parts = photo.shootTimeSlot.split('-');
        const photoStart = parts[0]?.trim();
        const photoEnd = parts[1]?.trim();
        warning = `Khung giờ thuê Áo dài (${matchingProduct.startTime} - ${matchingProduct.endTime}) và Giờ chụp (${photoStart} - ${photoEnd}) đang không trùng khớp.`;
      } else {
        warning = `Khung giờ thuê Áo dài và Lịch chụp ảnh đang không trùng khớp.`;
      }

      listGroups.push({
        id: `combo_${idx++}`,
        title: isCityMismatch ? `NHÓM COMBO ${idx - 1} - LỆCH KHU VỰC ĐỊA LÝ` : `NHÓM COMBO ${idx - 1} - LỆCH LỊCH TRÌNH`,
        type: 'MISMATCH',
        items: [matchingProduct, photo],
        warning,
        isCityMismatch
      });
      groupedIdsInList.add(photo.id);
      groupedIdsInList.add(matchingProduct.id);
    }
  });

  // C. Standalone items
  const remaining = itemsList.filter(item => !groupedIdsInList.has(item.id));

  return { listGroups, remaining, nextIndex: idx };
};
