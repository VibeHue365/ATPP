import { httpClient } from '../../../services/httpClient';
import type { Banner, PopularLocationItem } from '../constants/landing.constants';

export const landingCmsApi = {
  getPublicBanners: async (): Promise<Banner[]> => {
    return httpClient.get<Banner[]>('/landing/banners/public');
  },

  getPublicLocations: async (): Promise<PopularLocationItem[]> => {
    return httpClient.get<PopularLocationItem[]>('/landing/locations/public');
  },
};
