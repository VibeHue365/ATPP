import { useEffect, useState } from 'react';
import { LoaderCircle, MapPin } from 'lucide-react';

interface AdministrativeUnit {
  code: number;
  name: string;
}

interface PhotographyLocationPickerProps {
  providerCity: string;
  onSelect: (location: string) => void;
}

const normalizeLocation = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/đ/g, 'd')
    .replace(/^(tinh|thanh pho|tp\.?|thanh pho truc thuoc trung uong)\s+/i, '')
    .trim();

const locationApi = 'https://provinces.open-api.vn/api';

export const PhotographyLocationPicker = ({
  providerCity,
  onSelect,
}: PhotographyLocationPickerProps) => {
  const [districts, setDistricts] = useState<AdministrativeUnit[]>([]);
  const [wards, setWards] = useState<AdministrativeUnit[]>([]);
  const [province, setProvince] = useState<AdministrativeUnit | null>(null);
  const [districtCode, setDistrictCode] = useState<number | null>(null);
  const [wardCode, setWardCode] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const loadProvince = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${locationApi}/p/`);
        if (!response.ok) throw new Error('Không thể tải danh sách tỉnh, thành phố.');
        const data = (await response.json()) as AdministrativeUnit[];
        if (!isCurrent) return;
        const city = normalizeLocation(providerCity);
        const matchedProvince = data.find((item) => {
          const candidate = normalizeLocation(item.name);
          return candidate === city || candidate.includes(city) || city.includes(candidate);
        });
        if (!matchedProvince) {
          setError(`Chưa xác định được khu vực ${providerCity} của nhiếp ảnh gia.`);
          return;
        }
        setProvince(matchedProvince);
      } catch (requestError) {
        if (isCurrent) {
          setError(requestError instanceof Error ? requestError.message : 'Không thể tải địa điểm.');
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    void loadProvince();
    return () => {
      isCurrent = false;
    };
  }, [providerCity]);

  useEffect(() => {
    if (!province) return;
    let isCurrent = true;
    const loadDistricts = async () => {
      try {
        const response = await fetch(`${locationApi}/p/${province.code}?depth=2`);
        if (!response.ok) throw new Error('Không thể tải quận, huyện.');
        const data = (await response.json()) as { districts?: AdministrativeUnit[] };
        if (isCurrent) setDistricts(data.districts ?? []);
      } catch (requestError) {
        if (isCurrent) setError(requestError instanceof Error ? requestError.message : 'Không thể tải quận, huyện.');
      }
    };
    void loadDistricts();
    return () => {
      isCurrent = false;
    };
  }, [province]);

  const handleDistrictChange = async (nextDistrictCode: number) => {
    setDistrictCode(nextDistrictCode);
    setWardCode(null);
    setWards([]);
    try {
      const response = await fetch(`${locationApi}/d/${nextDistrictCode}?depth=2`);
      if (!response.ok) throw new Error('Không thể tải phường, xã.');
      const data = (await response.json()) as { wards?: AdministrativeUnit[] };
      setWards(data.wards ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải phường, xã.');
    }
  };

  const handleWardChange = (nextWardCode: number) => {
    setWardCode(nextWardCode);
    const district = districts.find((item) => item.code === districtCode);
    const ward = wards.find((item) => item.code === nextWardCode);
    if (province && district && ward) {
      onSelect([ward.name, district.name, province.name].join(', '));
    }
  };

  if (isLoading) {
    return <p className="pd-location-picker-note"><LoaderCircle size={15} className="pd-location-picker-spinner" /> Đang tải khu vực chụp...</p>;
  }

  if (error || !province) {
    return <p className="pd-location-picker-error">{error ?? 'Không thể chọn địa điểm lúc này.'}</p>;
  }

  return (
    <div className="pd-location-picker">
      <div className="pd-location-picker-heading"><MapPin size={17} /><span>Chọn địa điểm trong phạm vi hoạt động</span></div>
      <p className="pd-location-picker-hint">Nhiếp ảnh gia hiện nhận lịch tại {province.name}. Hãy chọn quận/huyện và phường/xã để lưu địa điểm chính xác.</p>
      <div className="pd-location-picker-fields">
        <label>
          Tỉnh/Thành phố
          <input value={province.name} readOnly aria-label="Tỉnh hoặc thành phố hoạt động của nhiếp ảnh gia" />
        </label>
        <label>
          Quận/Huyện
          <select value={districtCode ?? ''} onChange={(event) => void handleDistrictChange(Number(event.target.value))}>
            <option value="" disabled>Chọn quận/huyện</option>
            {districts.map((district) => <option key={district.code} value={district.code}>{district.name}</option>)}
          </select>
        </label>
        <label>
          Phường/Xã
          <select value={wardCode ?? ''} disabled={!districtCode} onChange={(event) => handleWardChange(Number(event.target.value))}>
            <option value="" disabled>Chọn phường/xã</option>
            {wards.map((ward) => <option key={ward.code} value={ward.code}>{ward.name}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
};
