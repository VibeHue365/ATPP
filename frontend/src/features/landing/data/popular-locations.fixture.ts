/**
 * UI fixture for Landing Page visual development.
 * Replace or validate against real location data later.
 */

import { ROUTES } from '../../../config/routes';

export interface PopularLocationItem {
  id: string;
  name: string;
  description: string;
  image: string;
  destination: string;
}

export const POPULAR_LOCATIONS_FIXTURE: PopularLocationItem[] = [
  {
    id: 'hue',
    name: 'Huế',
    description: 'Cổ kính và thơ mộng',
    image: '/images/location-hue-v2.webp',
    destination: `${ROUTES.PHOTOGRAPHERS}?location=Hu%E1%BA%BF`,
  },
  {
    id: 'da-nang',
    name: 'Đà Nẵng',
    description: 'Biển và không gian hiện đại',
    image: '/images/location-da-nang-v2.webp',
    destination: `${ROUTES.PHOTOGRAPHERS}?location=%C4%90%C3%A0+N%E1%BA%B5ng`,
  },
  {
    id: 'ha-noi',
    name: 'Hà Nội',
    description: 'Phố cổ và nét văn hóa',
    image: '/images/location-ha-noi-v2.webp',
    destination: ROUTES.PHOTOGRAPHERS,
  },
];
