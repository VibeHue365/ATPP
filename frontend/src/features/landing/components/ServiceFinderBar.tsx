import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ROUTES } from '../../../config/routes';

export const ServiceFinderBar: React.FC = () => {
  const navigate = useNavigate();
  const [serviceType, setServiceType] = useState<'aodai' | 'photographer' | 'combo'>('aodai');
  const [concept, setConcept] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const queryParams = new URLSearchParams();

    if (serviceType === 'photographer') {
      if (location) queryParams.append('location', location);
      const qs = queryParams.toString();
      navigate(qs ? `${ROUTES.PHOTOGRAPHERS}?${qs}` : ROUTES.PHOTOGRAPHERS);
    } else if (serviceType === 'combo') {
      navigate(ROUTES.COMBOS);
    } else {
      // serviceType === 'aodai'
      if (location) queryParams.append('location', location);
      const qs = queryParams.toString();
      navigate(qs ? `${ROUTES.RENTALS}?${qs}` : ROUTES.RENTALS);
    }
  };

  return (
    <section id="service-finder" className="w-full mt-6 md:mt-8">
      <form
        onSubmit={handleSearch}
        className="w-full rounded-2xl p-3 bg-[#F3EBEC] border border-[#E8DEDF] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center shadow-2xs"
      >
        {/* Field 1: DỊCH VỤ */}
        <div className="flex flex-col justify-center bg-white rounded-xl px-3.5 py-2.5 border border-stone-200 shadow-2xs min-w-0">
          <label htmlFor="finder-service" className="text-[10px] font-bold uppercase tracking-wider text-[#7D3543] leading-none mb-1 whitespace-nowrap">
            Dịch vụ
          </label>
          <select
            id="finder-service"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as 'aodai' | 'photographer' | 'combo')}
            className="text-xs font-semibold bg-transparent border-none outline-none p-0 cursor-pointer text-[#292324] w-full truncate"
          >
            <option value="aodai">Thuê áo dài</option>
            <option value="photographer">Gói chụp ảnh</option>
            <option value="combo">Combo trọn gói</option>
          </select>
        </div>

        {/* Field 2: NHU CẦU */}
        <div className="flex flex-col justify-center bg-white rounded-xl px-3.5 py-2.5 border border-stone-200 shadow-2xs min-w-0">
          <label htmlFor="finder-concept" className="text-[10px] font-bold uppercase tracking-wider text-[#7D3543] leading-none mb-1 whitespace-nowrap">
            Nhu cầu
          </label>
          <select
            id="finder-concept"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            className="text-xs font-semibold bg-transparent border-none outline-none p-0 cursor-pointer text-[#292324] w-full truncate"
          >
            <option value="">Kỷ yếu / Studio</option>
            <option value="ky-yeu">Kỷ yếu học sinh</option>
            <option value="ngoai-canh">Chụp ngoại cảnh</option>
            <option value="cuoi">Áo dài cưới</option>
          </select>
        </div>

        {/* Field 3: NGÀY CHỤP/THUÊ */}
        <div className="flex flex-col justify-center bg-white rounded-xl px-3.5 py-2.5 border border-stone-200 shadow-2xs min-w-0">
          <label htmlFor="finder-date" className="text-[10px] font-bold uppercase tracking-wider text-[#7D3543] leading-none mb-1 whitespace-nowrap">
            Ngày chụp/thuê
          </label>
          <input
            id="finder-date"
            type="text"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="Chọn ngày"
            onFocus={(e) => (e.target.type = 'date')}
            onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
            className="text-xs font-semibold bg-transparent border-none outline-none p-0 text-[#292324] w-full cursor-pointer truncate"
          />
        </div>

        {/* Field 4: ĐỊA ĐIỂM */}
        <div className="flex flex-col justify-center bg-white rounded-xl px-3.5 py-2.5 border border-stone-200 shadow-2xs min-w-0">
          <label htmlFor="finder-location" className="text-[10px] font-bold uppercase tracking-wider text-[#7D3543] leading-none mb-1 whitespace-nowrap">
            Địa điểm
          </label>
          <select
            id="finder-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="text-xs font-semibold bg-transparent border-none outline-none p-0 cursor-pointer text-[#292324] w-full truncate"
          >
            <option value="Huế">Thành phố Huế</option>
            <option value="Hội An">Hội An</option>
            <option value="Đà Nẵng">Đà Nẵng</option>
            <option value="Hà Nội">Hà Nội</option>
          </select>
        </div>

        {/* Submit Button: Tìm dịch vụ */}
        <button
          type="submit"
          className="w-full lg:w-auto h-full min-h-[44px] py-2.5 px-6 rounded-xl text-xs md:text-sm font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:opacity-95 border-none shrink-0 whitespace-nowrap"
          style={{ backgroundColor: 'var(--landing-primary)' }}
        >
          <Search size={16} />
          <span>Tìm dịch vụ</span>
        </button>
      </form>
    </section>
  );
};
