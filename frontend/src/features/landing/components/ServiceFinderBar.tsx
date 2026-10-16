import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ROUTES } from '../../../config/routes';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { ServiceDatePicker, type ServiceDateValue } from '../../../components/common/ServiceDatePicker';

export const ServiceFinderBar: React.FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [serviceType, setServiceType] = useState<'aodai' | 'photographer' | 'combo'>('aodai');
  const [concept, setConcept] = useState('');
  const [dateValue, setDateValue] = useState<ServiceDateValue>({
    rentalType: 'DAILY',
    startDate: '',
    endDate: '',
    singleDate: '',
    startTime: '08:00',
    endTime: '11:00',
    timeSlot: '08:00 - 11:00',
  });
  const [location, setLocation] = useState('all');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const queryParams = new URLSearchParams();

    if (keyword.trim()) {
      queryParams.append('q', keyword.trim());
    }
    if (location && location !== 'all') {
      queryParams.append('location', location);
    }
    if (concept) {
      queryParams.append('concept', concept);
    }

    if (serviceType === 'aodai') {
      if (dateValue.rentalType === 'DAILY') {
        if (dateValue.startDate) {
          queryParams.append('startDate', dateValue.startDate);
          queryParams.append('date', dateValue.startDate);
        }
        if (dateValue.endDate) {
          queryParams.append('endDate', dateValue.endDate);
        }
        queryParams.append('rentalType', 'DAILY');
      } else {
        const d = dateValue.singleDate || dateValue.startDate;
        if (d) {
          queryParams.append('date', d);
          queryParams.append('startDate', d);
        }
        if (dateValue.startTime) queryParams.append('startTime', dateValue.startTime);
        if (dateValue.endTime) queryParams.append('endTime', dateValue.endTime);
        queryParams.append('rentalType', 'HOURLY');
      }
    } else {
      // photographer or combo
      const d = dateValue.singleDate || dateValue.startDate;
      if (d) queryParams.append('date', d);
      if (dateValue.timeSlot) queryParams.append('timeSlot', dateValue.timeSlot);
      if (dateValue.startTime) queryParams.append('startTime', dateValue.startTime);
      if (dateValue.endTime) queryParams.append('endTime', dateValue.endTime);
    }

    const qs = queryParams.toString();
    const targetQuery = qs ? `?${qs}` : '';

    if (serviceType === 'photographer') {
      navigate(`${ROUTES.PHOTOGRAPHERS}${targetQuery}`);
    } else if (serviceType === 'combo') {
      navigate(`${ROUTES.COMBOS}${targetQuery}`);
    } else {
      // serviceType === 'aodai'
      navigate(`${ROUTES.RENTALS}${targetQuery}`);
    }
  };

  return (
    <section id="service-finder" className="w-full mt-6 md:mt-8">
      <form
        onSubmit={handleSearch}
        className="w-full rounded-2xl p-3 bg-[#F3EBEC] border border-[#E8DEDF] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-center shadow-2xs"
      >
        {/* Field 1: DỊCH VỤ */}
        <div className="flex flex-col justify-center bg-white rounded-xl px-3.5 py-2.5 border border-stone-200 shadow-2xs min-w-0">
          <label htmlFor="finder-service" className="text-[10px] font-bold uppercase tracking-wider text-[#7D3543] leading-none mb-1 whitespace-nowrap">
            Dịch vụ
          </label>
          <CustomSelect
            id="finder-service"
            size="sm"
            value={serviceType}
            onChange={(val) => setServiceType(val as 'aodai' | 'photographer' | 'combo')}
            options={[
              { value: 'aodai', label: 'Thuê áo dài' },
              { value: 'photographer', label: 'Gói chụp ảnh' },
              { value: 'combo', label: 'Combo trọn gói' },
            ]}
          />
        </div>

        {/* Field 2: TỪ KHÓA TÌM KIẾM */}
        <div className="flex flex-col justify-center bg-white rounded-xl px-3.5 py-2.5 border border-stone-200 shadow-2xs min-w-0">
          <label htmlFor="finder-keyword" className="text-[10px] font-bold uppercase tracking-wider text-[#7D3543] leading-none mb-1 whitespace-nowrap">
            Từ khóa
          </label>
          <input
            id="finder-keyword"
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tên áo, thợ ảnh..."
            className="text-xs font-semibold bg-transparent border-none outline-none p-0 text-[#292324] w-full truncate placeholder:text-stone-400 placeholder:font-normal"
          />
        </div>

        {/* Field 3: NHU CẦU */}
        <div className="flex flex-col justify-center bg-white rounded-xl px-3.5 py-2.5 border border-stone-200 shadow-2xs min-w-0">
          <label htmlFor="finder-concept" className="text-[10px] font-bold uppercase tracking-wider text-[#7D3543] leading-none mb-1 whitespace-nowrap">
            Nhu cầu
          </label>
          <CustomSelect
            id="finder-concept"
            size="sm"
            value={concept}
            onChange={(val) => setConcept(val)}
            options={[
              { value: '', label: 'Tất cả nhu cầu' },
              { value: 'ky-yeu', label: 'Kỷ yếu / Sự kiện' },
              { value: 'ngoai-canh', label: 'Chụp ngoại cảnh' },
              { value: 'studio', label: 'Chụp studio' },
              { value: 'cuoi', label: 'Áo dài cưới / Cưới hỏi' },
              { value: 'cap-doi', label: 'Cặp đôi' },
            ]}
          />
        </div>

        {/* Field 4: NGÀY CHỤP/THUÊ (Traveloka Dual Month & Hourly) */}
        <div className="flex flex-col justify-center bg-white rounded-xl px-3.5 py-2 border border-stone-200 shadow-2xs min-w-0">
          <label htmlFor="finder-date" className="text-[10px] font-bold uppercase tracking-wider text-[#7D3543] leading-none mb-1 whitespace-nowrap">
            {serviceType === 'photographer'
              ? 'Ngày & Ca chụp'
              : serviceType === 'combo'
                ? 'Lịch Combo'
                : dateValue.rentalType === 'HOURLY'
                  ? 'Ngày & Giờ thuê'
                  : 'Ngày nhận - trả'}
          </label>
          <ServiceDatePicker
            id="finder-date"
            serviceType={serviceType}
            value={dateValue}
            onChange={setDateValue}
          />
        </div>

        {/* Field 5: ĐỊA ĐIỂM */}
        <div className="flex flex-col justify-center bg-white rounded-xl px-3.5 py-2.5 border border-stone-200 shadow-2xs min-w-0">
          <label htmlFor="finder-location" className="text-[10px] font-bold uppercase tracking-wider text-[#7D3543] leading-none mb-1 whitespace-nowrap">
            Địa điểm
          </label>
          <CustomSelect
            id="finder-location"
            size="sm"
            value={location}
            onChange={(val) => setLocation(val)}
            options={[
              { value: 'all', label: 'Tất cả khu vực' },
              { value: 'Huế', label: 'Thành phố Huế' },
              { value: 'Hội An', label: 'Hội An' },
              { value: 'Đà Nẵng', label: 'Đà Nẵng' },
              { value: 'Hà Nội', label: 'Hà Nội' },
              { value: 'Đà Lạt', label: 'Đà Lạt' },
            ]}
          />
        </div>

        {/* Submit Button: Tìm dịch vụ */}
        <button
          type="submit"
          className="w-full sm:col-span-2 lg:col-span-1 h-full min-h-[44px] py-2.5 px-6 rounded-xl text-xs md:text-sm font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:opacity-95 hover:shadow-md active:scale-95 border-none shrink-0 whitespace-nowrap"
          style={{ backgroundColor: 'var(--landing-primary)' }}
        >
          <Search size={16} />
          <span>Tìm dịch vụ</span>
        </button>
      </form>
    </section>
  );
};
