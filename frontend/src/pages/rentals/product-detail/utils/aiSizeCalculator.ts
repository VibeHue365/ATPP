import type { FitPreference } from '../types';

export const calculateSizeLocally = (
  h: number,
  w: number,
  c: number,
  e: number,
  fit: FitPreference,
  availableSizes?: string[],
): string => {
  if (w > 85 || e > 95) {
    return 'CUSTOM';
  }

  let sizeH = 'XS';
  if (h < 150) sizeH = 'XS';
  else if (h < 155) sizeH = 'S';
  else if (h < 162) sizeH = 'M';
  else if (h < 168) sizeH = 'L';
  else if (h < 173) sizeH = 'XL';
  else sizeH = 'XXL';

  let sizeW = 'XS';
  if (w < 43) sizeW = 'XS';
  else if (w < 48) sizeW = 'S';
  else if (w < 54) sizeW = 'M';
  else if (w < 60) sizeW = 'L';
  else if (w < 68) sizeW = 'XL';
  else sizeW = 'XXL';

  let sizeC = 'XS';
  if (c <= 81) sizeC = 'XS';
  else if (c <= 85) sizeC = 'S';
  else if (c <= 89) sizeC = 'M';
  else if (c <= 93) sizeC = 'L';
  else if (c <= 97) sizeC = 'XL';
  else sizeC = 'XXL';

  let sizeE = 'XS';
  if (e <= 63) sizeE = 'XS';
  else if (e <= 67) sizeE = 'S';
  else if (e <= 71) sizeE = 'M';
  else if (e <= 75) sizeE = 'L';
  else if (e <= 79) sizeE = 'XL';
  else sizeE = 'XXL';

  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const idxH = sizeOrder.indexOf(sizeH);
  const idxW = sizeOrder.indexOf(sizeW);
  const idxC = sizeOrder.indexOf(sizeC);
  const idxE = sizeOrder.indexOf(sizeE);

  let maxIdx = Math.max(idxH, idxW, idxC, idxE);
  if (fit === 'COMFORT') {
    maxIdx = maxIdx + 1;
  }

  if (maxIdx >= sizeOrder.length) {
    return 'CUSTOM';
  }

  const calculatedSize = sizeOrder[maxIdx];
  const sizesList = availableSizes || ['S', 'M', 'L'];

  if (sizesList.includes(calculatedSize)) {
    return calculatedSize;
  }

  const validSizes = sizesList.filter((s) => sizeOrder.includes(s));
  if (validSizes.length === 0) {
    return 'CUSTOM';
  }

  const availableIndices = validSizes.map((s) => sizeOrder.indexOf(s));
  const maxAvailableIdx = Math.max(...availableIndices);
  const minAvailableIdx = Math.min(...availableIndices);

  if (maxIdx > maxAvailableIdx) {
    return 'CUSTOM';
  }

  if (maxIdx < minAvailableIdx) {
    return sizeOrder[minAvailableIdx];
  }

  const fitIndices = availableIndices.filter((idx) => idx >= maxIdx);
  if (fitIndices.length > 0) {
    const nextSizeIdx = Math.min(...fitIndices);
    return sizeOrder[nextSizeIdx];
  }

  return 'CUSTOM';
};
