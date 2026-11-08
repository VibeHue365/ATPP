import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAutoUserPosition } from '@/utils/geo';

export interface DestinationCity {
  code: string;
  name: string;
  shortName: string;
  tagline: string;
  lat: number;
  lng: number;
  badge: string;
  heroSpot: string;
  highlights: string[];
}

export const DESTINATION_CITIES: DestinationCity[] = [
  {
    code: 'hue',
    name: 'Cố đô Huế',
    shortName: 'Huế',
    tagline: 'Cố đô Di sản & Quần thể Lăng tẩm',
    lat: 16.4637,
    lng: 107.5909,
    badge: 'Di sản UNESCO',
    heroSpot: 'Đại Nội Huế & Cung An Định',
    highlights: ['Đại Nội Huế', 'Cung An Định', 'Lăng Tự Đức', 'Chùa Thiên Mụ'],
  },
  {
    code: 'da-nang',
    name: 'Đà Nẵng',
    shortName: 'Đà Nẵng',
    tagline: 'Thành phố Biển & Cầu Rồng biểu tượng',
    lat: 16.0544,
    lng: 108.2022,
    badge: 'Thành phố Biển',
    heroSpot: 'Bán đảo Sơn Trà & Cầu Rồng',
    highlights: ['Sơn Trà & Chùa Linh Ứng', 'Cầu Rồng', 'Biển Mỹ Khê', 'Bảo tàng Chăm'],
  },
  {
    code: 'hoi-an',
    name: 'Phố cổ Hội An',
    shortName: 'Hội An',
    tagline: 'Phố cổ Đèn lồng & Sông Hoài thơ mộng',
    lat: 15.8801,
    lng: 108.338,
    badge: 'Phố cổ Di sản',
    heroSpot: 'Chùa Cầu & Bờ sông Hoài',
    highlights: ['Chùa Cầu', 'Hội quán Phúc Kiến', 'Bờ sông Hoài', 'Phố cổ đèn lồng'],
  },
  {
    code: 'ha-noi',
    name: 'Thủ đô Hà Nội',
    shortName: 'Hà Nội',
    tagline: 'Thủ đô Nghìn năm Văn hiến & 36 Phố phường',
    lat: 21.0285,
    lng: 105.8542,
    badge: 'Trái tim Văn hiến',
    heroSpot: 'Hoàng thành Thăng Long & Văn Miếu',
    highlights: ['Hoàng thành Thăng Long', 'Văn Miếu', 'Hồ Hoàn Kiếm', 'Phố cổ Ba Đình'],
  },
  {
    code: 'hcm',
    name: 'TP. Hồ Chí Minh',
    shortName: 'TP.HCM',
    tagline: 'Sài Gòn Hoa lệ, Năng động & Đa sắc',
    lat: 10.7769,
    lng: 106.7009,
    badge: 'Đô thị Hiện đại',
    heroSpot: 'Bưu điện Trung tâm & Bảo tàng Áo Dài',
    highlights: ['Dinh Độc Lập', 'Bảo tàng Áo Dài', 'Bưu điện Trung tâm', 'Lăng Ông'],
  },
  {
    code: 'da-lat',
    name: 'Đà Lạt',
    shortName: 'Đà Lạt',
    tagline: 'Xứ sở Sương mù & Thành phố Ngàn hoa',
    lat: 11.9404,
    lng: 108.4583,
    badge: 'Xứ sở Ngàn hoa',
    heroSpot: 'Dinh I Bảo Đại & Ga Cổ Đà Lạt',
    highlights: ['Dinh I Bảo Đại', 'Ga Cổ Đà Lạt', 'Hồ Xuân Hương'],
  },
];

const STORAGE_KEY = 'tago_selected_destination_code';

export interface UserDetectedLocation {
  code: string;
  label: string;
  lat: number;
  lng: number;
}

interface DestinationContextValue {
  destination: DestinationCity;
  allDestinations: DestinationCity[];
  isPickerOpen: boolean;
  userDetectedCity: UserDetectedLocation | null;
  openDestinationPicker: () => void;
  closeDestinationPicker: () => void;
  selectDestination: (code: string) => void;
  resetToDetectedLocation: () => void;
}

const DestinationContext = createContext<DestinationContextValue | null>(null);

export function DestinationProvider({ children }: { children: React.ReactNode }) {
  const [destination, setDestination] = useState<DestinationCity>(DESTINATION_CITIES[0]); // default Hue
  const [userDetectedCity, setUserDetectedCity] = useState<UserDetectedLocation | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Initialize destination from storage or auto-detected network location
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const storedCode = await AsyncStorage.getItem(STORAGE_KEY);

        // Fetch auto user position (e.g. Da Nang IP)
        const pos = await fetchAutoUserPosition();
        if (!active) return;

        const detected = {
          code: pos.cityCode,
          label: pos.label,
          lat: pos.lat,
          lng: pos.lng,
        };
        setUserDetectedCity(detected);

        if (storedCode) {
          const found = DESTINATION_CITIES.find(
            (c) => c.code.toLowerCase() === storedCode.toLowerCase(),
          );
          if (found) {
            setDestination(found);
            return;
          }
        }

        // If no stored preference, align with detected city
        const matchingCity = DESTINATION_CITIES.find(
          (c) => c.code.toLowerCase() === pos.cityCode.toLowerCase(),
        );
        if (matchingCity) {
          setDestination(matchingCity);
        }
      } catch {
        // fallback to default Hue
      }
    }

    void init();

    return () => {
      active = false;
    };
  }, []);

  const openDestinationPicker = useCallback(() => setIsPickerOpen(true), []);
  const closeDestinationPicker = useCallback(() => setIsPickerOpen(false), []);

  const selectDestination = useCallback((code: string) => {
    const target = DESTINATION_CITIES.find(
      (c) => c.code.toLowerCase() === code.toLowerCase(),
    );
    if (target) {
      setDestination(target);
      void AsyncStorage.setItem(STORAGE_KEY, target.code);
    }
    setIsPickerOpen(false);
  }, []);

  const resetToDetectedLocation = useCallback(() => {
    if (userDetectedCity) {
      const target = DESTINATION_CITIES.find(
        (c) => c.code.toLowerCase() === userDetectedCity.code.toLowerCase(),
      );
      if (target) {
        setDestination(target);
        void AsyncStorage.setItem(STORAGE_KEY, target.code);
      }
    }
    setIsPickerOpen(false);
  }, [userDetectedCity]);

  const value = useMemo<DestinationContextValue>(
    () => ({
      destination,
      allDestinations: DESTINATION_CITIES,
      isPickerOpen,
      userDetectedCity,
      openDestinationPicker,
      closeDestinationPicker,
      selectDestination,
      resetToDetectedLocation,
    }),
    [
      destination,
      isPickerOpen,
      userDetectedCity,
      openDestinationPicker,
      closeDestinationPicker,
      selectDestination,
      resetToDetectedLocation,
    ],
  );

  return (
    <DestinationContext.Provider value={value}>
      {children}
    </DestinationContext.Provider>
  );
}

export function useDestination(): DestinationContextValue {
  const ctx = useContext(DestinationContext);
  if (!ctx) {
    throw new Error('useDestination must be used within a DestinationProvider');
  }
  return ctx;
}
