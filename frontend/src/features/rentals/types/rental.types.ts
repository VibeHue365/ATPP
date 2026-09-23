import type { PublicSmartTagBadge } from '../../smart-tagging/types/smartTag.types';

export interface PublicCustomTag {
  label: string;
  normalizedLabel: string;
  mappedTagCode?: string | null;
}

export interface ProductFromDb {
  _id: string;
  name: string;
  basePrice: number;
  depositAmount: number;
  images: string[];
  sizes: string[];
  colors: string[];
  materials: string[];
  status: string;
  badges?: PublicSmartTagBadge[];
  customTags?: PublicCustomTag[];
}

export interface AoDaiItem {
  id: string;
  name: string;
  material: string;
  price: number;
  status: 'AVAILABLE' | 'RESERVED';
  image: string;
  badges?: PublicSmartTagBadge[];
  customTags?: PublicCustomTag[];
}
