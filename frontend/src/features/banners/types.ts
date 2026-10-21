export type BannerPlacement = 'HOME' | 'AODAI' | 'PHOTOGRAPHER' | 'COMBO';

export interface Banner {
  _id?: string;
  placement: BannerPlacement;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  linkUrl?: string;
  isActive: boolean;
  updatedBy?: {
    _id?: string;
    fullName?: string;
    email?: string;
  } | null;
  updatedAt?: string;
  createdAt?: string;
}

export interface UpdateBannerPayload {
  placement: BannerPlacement;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  linkUrl?: string;
  isActive?: boolean;
}
