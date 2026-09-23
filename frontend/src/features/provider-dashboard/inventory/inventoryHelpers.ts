
import { colorLabels, materialLabels } from '../constants';

export const variantKeyOf = (row: any) => ({
  productId: row.productId,
  size: row.size,
  color: row.color,
  ...(row.material ? { material: row.material } : {}),
});

export const variantLabelOf = (row: any) =>
  `${row.size} / ${colorLabels[row.color] || row.color}${row.material ? ` / ${materialLabels[row.material] || row.material}` : ''}`;
