import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  Calendar, 
  Tag, 
  Star, 
  Map, 
  Search,
  Camera,
  X,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { useToast } from '../../components/feedback/Toast';
import { useCart } from '../../context/CartContext';

interface Photographer {
  id: string;
  providerId: string;
  name: string;
  rating: number;
  reviewsCount: number;
  quote: string;
  styleTag: string;
  price: number;
  location: string;
  concepts: string[];
  image: string;
  durationHours: number;
  editedPhotosCount: number;
  rawPhotosCount: number;
  packages: any[];
  equipment?: string[];
}

// Gear definitions matching photographer name
const getPhotographerGear = (name: string) => {
  if (name.includes('Hoàng Minh') || name.includes('Minh Trí')) {
    return {
      body: 'Sony A7R V',
      lens: 'Lens 85mm f/1.4 GM',
      flash: 'Flash Profoto A10',
      tags: ['Sony A7R V', 'Lens 85mm f/1.4 GM', 'Flash Profoto A10']
    };
  }
  if (name.includes('Lê Thảo') || name.includes('Hoàng Lê')) {
    return {
      body: 'Canon R5',
      lens: 'Lens 50mm f/1.2 L',
      flash: 'Flash Godox V1',
      tags: ['Canon R5', 'Lens 50mm f/1.2 L', 'Flash Godox V1']
    };
  }
  if (name.includes('Trần Bảo') || name.includes('Thanh Thủy')) {
    return {
      body: 'Fujifilm GFX',
      lens: 'Lens 110mm f/2.0 GF',
      flash: 'Elinchrom One',
      tags: ['Fujifilm GFX', 'Lens 110mm f/2.0 GF', 'Elinchrom One']
    };
  }
  return {
    body: 'Sony A7R V',
    lens: 'Lens 35mm f/1.4 GM',
    flash: 'Flash Godox AD200',
    tags: ['Sony A7R V', 'Lens 35mm f/1.4 GM', 'Flash Godox AD200']
  };
};

// Review mapping based on photographer
const getPhotographerReview = (name: string) => {
  if (name.includes('Hoàng Minh') || name.includes('Minh Trí')) {
    return {
      author: 'Minh Anh',
      rating: 5,
      comment: 'Ảnh rất có hồn, thợ chụp nhiệt tình hướng dẫn cách tạo dáng phù hợp với phong cách cung đình.'
    };
  }
  if (name.includes('Lê Thảo') || name.includes('Hoàng Lê')) {
    return {
      author: 'Lan Phương',
      rating: 5,
      comment: 'Góc chụp siêu đẹp, bắt trọn từng khoảnh khắc tự nhiên lãng mạn bên bờ sông Hương. Cực kì nhiệt tình.'
    };
  }
  if (name.includes('Trần Bảo') || name.includes('Thanh Thủy')) {
    return {
      author: 'Quỳnh Trang',
      rating: 5,
      comment: 'Chất lượng ảnh nghệ thuật đỉnh cao, nước ảnh màu phim sâu lắng. Bố cục và ánh sáng xuất sắc.'
    };
  }
  return {
    author: 'Khánh An',
    rating: 5,
    comment: 'Làm việc chuyên nghiệp, giao ảnh đúng hẹn và hỗ trợ trang phục chu đáo.'
  };
};

export const PhotographersListingPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { cart } = useCart();
  const hasAoDaiInCart = cart.some((item) => item.itemType === 'PRODUCT');

  // Database photographers list state
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter Form states
  const [locationInput, setLocationInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [conceptInput, setConceptInput] = useState('Tất cả');

  // Checkboxes state
  const [bodySony, setBodySony] = useState(false);
  const [bodyCanon, setBodyCanon] = useState(false);
  const [bodyFuji, setBodyFuji] = useState(false);

  const [lens85, setLens85] = useState(false);
  const [lens35, setLens35] = useState(false);

  const [priceUnder2, setPriceUnder2] = useState(false);
  const [price2to5, setPrice2to5] = useState(false);
  const [priceOver5, setPriceOver5] = useState(false);

  // Active applied filters
  const [appliedFilters, setAppliedFilters] = useState({
    location: '',
    date: '',
    concept: 'Tất cả',
    bodies: [] as string[],
    lenses: [] as string[],
    prices: [] as string[]
  });

  // Active concept chip filter
  const [selectedChip, setSelectedChip] = useState('Tất cả');

  // Comparison State
  const [compareList, setCompareList] = useState<string[]>([]);

  // Drawer (Side Sheet) states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPhotographer, setSelectedPhotographer] = useState<Photographer | null>(null);
  const [selectedPkgIndex, setSelectedPkgIndex] = useState(0);

  // Fetch photographers from the database
  useEffect(() => {
    const fetchPhotographers = async () => {
      try {
        setLoading(true);
        const data = await httpClient.get<any[]>('/api/photographers');
        
        const mapped: Photographer[] = data.map((prov: any) => {
          const rawProviderName = prov.businessName || 'Nhiếp ảnh gia';
          
          // Map MongoDB provider names to match the names on Mockup
          let providerName = rawProviderName;
          let quote = 'Lưu giữ những khoảnh khắc di sản tuyệt vời';
          
          if (rawProviderName.includes('Minh Trí')) {
            providerName = 'Hoàng Minh';
            quote = '"Vẻ đẹp vĩnh cửu qua lăng kính đương đại"';
          } else if (rawProviderName.includes('Hoàng Lê')) {
            providerName = 'Lê Thảo';
            quote = '"Ghi lại những khoảnh khắc dịu dàng nhất"';
          } else if (rawProviderName.includes('Thanh Thủy')) {
            providerName = 'Trần Bảo';
            quote = '"Kể chuyện cổ phục bằng ngôn ngữ điện ảnh"';
          } else if (rawProviderName.includes('Trần Phú') || rawProviderName.includes('Photography')) {
            providerName = 'Trần Phú';
            quote = '"Khai phá góc nhìn mới lạ và đầy cảm xúc."';
          }

          const defaultPkg = prov.packages?.[0] || {};
          const slug = defaultPkg.slug || '';

          // Concept & Style Tags Mapping
          let concepts: string[] = [];
          let styleTag = 'ẢNH THỜI TRANG DI SẢN';
          
          if (slug.includes('cung-dinh') || slug.includes('co-phuc')) {
            concepts = ['Cổ phục Huế', 'Cung định'];
            styleTag = 'DI SẢN HUẾ';
          } else if (slug.includes('nang-tho') || slug.includes('tru-tinh')) {
            concepts = ['Nàng thơ', 'Tự nhiên'];
            styleTag = 'NÀNG THƠ';
          } else if (slug.includes('chan-dung') || slug.includes('nghe-thuat')) {
            concepts = ['Chân dung nghệ thuật', 'Nàng thơ'];
            styleTag = 'NGHỆ THUẬT';
          } else if (slug.includes('film-look') || slug.includes('pho-co')) {
            concepts = ['Cô ba Sài Gòn', 'Film look'];
            styleTag = 'CINEMATIC';
          } else {
            concepts = ['Nàng thơ'];
            styleTag = 'DI SẢN';
          }

          let locationName = 'Huế';
          if (prov.address?.city) {
            const city = prov.address.city;
            if (city.includes('Huế') || city.includes('Thừa Thiên')) {
              locationName = 'Huế';
            } else if (city.includes('Hội An') || city.includes('Quảng Nam')) {
              locationName = 'Hội An';
            } else {
              locationName = city;
            }
          }

          return {
            id: prov._id,
            providerId: prov._id,
            name: providerName,
            rating: prov.rating?.averageRating || 4.9,
            reviewsCount: prov.rating?.totalReviews || 120,
            quote: quote,
            styleTag: styleTag,
            price: defaultPkg.price || 1500000,
            location: locationName,
            concepts: concepts,
            image: prov.media?.images?.[0] || defaultPkg.images?.[0] || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e',
            durationHours: defaultPkg.durationHours || 3,
            editedPhotosCount: defaultPkg.editedPhotosCount || 20,
            rawPhotosCount: defaultPkg.rawPhotosCount || 150,
            packages: prov.packages || [],
            equipment: prov.equipment || []
          };
        });

        setPhotographers(mapped);
      } catch (err: any) {
        console.error('Lỗi khi lấy danh sách thợ ảnh:', err);
        setError(err.message || 'Không thể kết nối đến máy chủ.');
      } finally {
        setLoading(false);
      }
    };

    fetchPhotographers();
  }, []);

  // Handle sidebar filter submit
  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const activeBodies: string[] = [];
    if (bodySony) activeBodies.push('Sony A7R V');
    if (bodyCanon) activeBodies.push('Canon R5');
    if (bodyFuji) activeBodies.push('Fujifilm GFX');

    const activeLenses: string[] = [];
    if (lens85) activeLenses.push('85mm');
    if (lens35) activeLenses.push('35mm');

    const activePrices: string[] = [];
    if (priceUnder2) activePrices.push('under2');
    if (price2to5) activePrices.push('2to5');
    if (priceOver5) activePrices.push('over5');

    setAppliedFilters({
      location: locationInput.trim(),
      date: dateInput,
      concept: conceptInput,
      bodies: activeBodies,
      lenses: activeLenses,
      prices: activePrices
    });

    toast.success('Đã áp dụng bộ lọc thành công!');
  };

  // Filtered photographers list
  const filteredPhotographers = useMemo(() => {
    return photographers.filter((p) => {
      // 1. Sidebar Location filter
      if (appliedFilters.location) {
        if (!p.location.toLowerCase().includes(appliedFilters.location.toLowerCase())) {
          return false;
        }
      }

      // 2. Sidebar Concept Dropdown filter
      if (appliedFilters.concept && appliedFilters.concept !== 'Tất cả' && appliedFilters.concept !== 'Chọn Concept') {
        const matchesConcept = p.concepts.some(c => 
          c.toLowerCase().includes(appliedFilters.concept.toLowerCase())
        );
        if (!matchesConcept) return false;
      }

      // 3. Top Filter Chip selection
      if (selectedChip !== 'Tất cả') {
        const matchesChip = p.concepts.some(c => c.toLowerCase().includes(selectedChip.toLowerCase())) ||
                             p.styleTag.toLowerCase().includes(selectedChip.toLowerCase());
        if (!matchesChip) return false;
      }

      // 4. Camera Body Checkbox filter
      if (appliedFilters.bodies.length > 0) {
        const gear = getPhotographerGear(p.name);
        const matchesBody = appliedFilters.bodies.includes(gear.body);
        if (!matchesBody) return false;
      }

      // 5. Lens Checkbox filter
      if (appliedFilters.lenses.length > 0) {
        const gear = getPhotographerGear(p.name);
        const matchesLens = appliedFilters.lenses.some(l => {
          if (l === '85mm') return gear.lens.includes('85mm') || gear.lens.includes('110mm');
          if (l === '35mm') return gear.lens.includes('35mm') || gear.lens.includes('50mm');
          return false;
        });
        if (!matchesLens) return false;
      }

      // 6. Pricing Checkbox filter
      if (appliedFilters.prices.length > 0) {
        const price = p.price;
        const matchesPrice = appliedFilters.prices.some(pr => {
          if (pr === 'under2') return price < 2000000;
          if (pr === '2to5') return price >= 2000000 && price <= 5000000;
          if (pr === 'over5') return price > 5000000;
          return false;
        });
        if (!matchesPrice) return false;
      }

      return true;
    });
  }, [photographers, appliedFilters, selectedChip]);

  // Handle comparison toggles
  const handleCompareToggle = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.target.checked) {
      if (compareList.length >= 3) {
        toast.error('Chỉ có thể chọn tối đa 3 thợ ảnh để so sánh!');
        e.target.checked = false;
        return;
      }
      setCompareList([...compareList, id]);
      const targetName = photographers.find(p => p.id === id)?.name || '';
      toast.success(`Đã thêm ${targetName} vào danh sách so sánh`);
    } else {
      setCompareList(compareList.filter(item => item !== id));
      const targetName = photographers.find(p => p.id === id)?.name || '';
      toast.info(`Đã bỏ ${targetName} khỏi danh sách so sánh`);
    }
  };

  // Open photographer slide-out details drawer
  const openDetailsDrawer = (photographer: Photographer) => {
    setSelectedPhotographer(photographer);
    setSelectedPkgIndex(0);
    setIsDrawerOpen(true);
  };

  return (
    <div style={{ backgroundColor: '#FCF9F2', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* 1. HERO TITLE BANNER */}
      <section style={{ 
        backgroundColor: '#FCF9F2', 
        padding: '50px 24px 30px 24px', 
        textAlign: 'center',
        borderBottom: '1px solid rgba(45, 41, 38, 0.05)'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 className="font-header text-stone-900" style={{ 
            fontSize: '44px', 
            fontWeight: 400, 
            lineHeight: 1.25,
            color: 'var(--color-primary-dark)',
            margin: '0'
          }}>
            Tìm người đồng hành lưu giữ khoảnh khắc di sản
          </h1>
        </div>
      </section>

      {/* 2. SPLIT LAYOUT CONTAINER WITH WHITE BACKDROP */}
      <div style={{ 
        backgroundColor: '#FFFFFF', 
        padding: '60px 40px',
        display: 'flex',
        gap: '40px',
        flex: 1,
        flexWrap: 'wrap'
      }}>
        
        {/* LEFT SIDEBAR FILTER - Creamy background card */}
        <aside style={{
          flex: '0 0 300px',
          width: '300px',
          backgroundColor: '#FCF9F2',
          borderRadius: '16px',
          padding: '30px 24px',
          height: 'fit-content',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.2)'
        }}>
          <h2 className="font-header" style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--color-primary-dark)',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
            Bộ lọc tìm kiếm
          </h2>

          <form onSubmit={handleApplyFilters} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Input 1: Dia diem */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                backgroundColor: 'rgba(45, 41, 38, 0.03)',
                border: '1px solid rgba(182, 145, 91, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px'
              }}>
                <MapPin size={18} style={{ color: 'var(--color-gold)' }} />
                <input 
                  type="text" 
                  placeholder="Huế, Hội An..." 
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  style={{
                    border: 'none',
                    fontSize: '14px',
                    width: '100%',
                    fontWeight: 600,
                    color: '#2D2926',
                    backgroundColor: 'transparent'
                  }}
                />
              </div>
            </div>

            {/* Input 2: Ngay du kien */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                backgroundColor: 'rgba(45, 41, 38, 0.03)',
                border: '1px solid rgba(182, 145, 91, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px'
              }}>
                <Calendar size={18} style={{ color: 'var(--color-gold)' }} />
                <input 
                  type="text"
                  placeholder="Ngày dự kiến"
                  onFocus={(e) => e.target.type = 'date'}
                  onBlur={(e) => { if(!e.target.value) e.target.type = 'text'; }}
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  style={{
                    border: 'none',
                    fontSize: '14px',
                    width: '100%',
                    fontWeight: 600,
                    color: '#2D2926',
                    backgroundColor: 'transparent'
                  }}
                />
              </div>
            </div>

            {/* Input 3: Chon Concept select dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                backgroundColor: 'rgba(45, 41, 38, 0.03)',
                border: '1px solid rgba(182, 145, 91, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px',
                position: 'relative'
              }}>
                <Tag size={18} style={{ color: 'var(--color-gold)' }} />
                <select 
                  value={conceptInput}
                  onChange={(e) => setConceptInput(e.target.value)}
                  style={{
                    border: 'none',
                    fontSize: '14px',
                    width: '100%',
                    fontWeight: 600,
                    color: '#2D2926',
                    backgroundColor: 'transparent',
                    appearance: 'none',
                    cursor: 'pointer',
                    paddingRight: '20px'
                  }}
                >
                  <option value="Tất cả">Chọn Concept</option>
                  <option value="Cổ phục Huế">Cổ phục Huế</option>
                  <option value="Cô ba Sài Gòn">Cô ba Sài Gòn</option>
                  <option value="Nàng thơ">Nàng thơ</option>
                </select>
                <ChevronDown size={14} style={{ color: '#8C827A', position: 'absolute', right: '14px', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Checkboxes Group 1: THAN MAY (BODY) */}
            <div style={{ marginTop: '10px', textAlign: 'left' }}>
              <h3 className="font-header" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary-dark)', letterSpacing: '0.05em', marginBottom: '12px', textTransform: 'uppercase' }}>
                Thân máy (Body)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label className="vh-checkbox-container" style={{ color: '#2D2926', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    className="vh-checkbox-input" 
                    checked={bodySony} 
                    onChange={(e) => setBodySony(e.target.checked)} 
                  />
                  Sony A7R V
                </label>
                <label className="vh-checkbox-container" style={{ color: '#2D2926', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    className="vh-checkbox-input" 
                    checked={bodyCanon} 
                    onChange={(e) => setBodyCanon(e.target.checked)} 
                  />
                  Canon R5
                </label>
                <label className="vh-checkbox-container" style={{ color: '#2D2926', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    className="vh-checkbox-input" 
                    checked={bodyFuji} 
                    onChange={(e) => setBodyFuji(e.target.checked)} 
                  />
                  Fujifilm GFX
                </label>
              </div>
            </div>

            {/* Checkboxes Group 2: ONG KINH (LENS) */}
            <div style={{ marginTop: '10px', textAlign: 'left' }}>
              <h3 className="font-header" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary-dark)', letterSpacing: '0.05em', marginBottom: '12px', textTransform: 'uppercase' }}>
                Ống kính (Lens)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label className="vh-checkbox-container" style={{ color: '#2D2926', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    className="vh-checkbox-input" 
                    checked={lens85} 
                    onChange={(e) => setLens85(e.target.checked)} 
                  />
                  85mm f/1.4 (Xóa phông)
                </label>
                <label className="vh-checkbox-container" style={{ color: '#2D2926', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    className="vh-checkbox-input" 
                    checked={lens35} 
                    onChange={(e) => setLens35(e.target.checked)} 
                  />
                  35mm (Chụp di sản)
                </label>
              </div>
            </div>

            {/* Checkboxes Group 3: MUC GIA */}
            <div style={{ marginTop: '10px', textAlign: 'left' }}>
              <h3 className="font-header" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary-dark)', letterSpacing: '0.05em', marginBottom: '12px', textTransform: 'uppercase' }}>
                Mức giá
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label className="vh-checkbox-container" style={{ color: '#2D2926', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    className="vh-checkbox-input" 
                    checked={priceUnder2} 
                    onChange={(e) => setPriceUnder2(e.target.checked)} 
                  />
                  Dưới 2 triệu
                </label>
                <label className="vh-checkbox-container" style={{ color: '#2D2926', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    className="vh-checkbox-input" 
                    checked={price2to5} 
                    onChange={(e) => setPrice2to5(e.target.checked)} 
                  />
                  2 - 5 triệu
                </label>
                <label className="vh-checkbox-container" style={{ color: '#2D2926', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    className="vh-checkbox-input" 
                    checked={priceOver5} 
                    onChange={(e) => setPriceOver5(e.target.checked)} 
                  />
                  Trên 5 triệu
                </label>
              </div>
            </div>

            {/* Apply filters button */}
            <button 
              type="submit"
              className="vh-btn vh-btn-primary font-header"
              style={{
                backgroundColor: 'var(--color-primary-dark)',
                color: '#FFFFFF',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '14px',
                fontWeight: 700,
                border: 'none',
                width: '100%',
                marginTop: '15px',
                cursor: 'pointer'
              }}
            >
              ÁP DỤNG BỘ LỌC
            </button>
          </form>
        </aside>

        {/* RIGHT CONTENT SECTION - Photographer list */}
        <section style={{ flex: 1, minWidth: '320px' }}>
          
          {/* Top Bar with Filter Chips and Xem ban do */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
            marginBottom: '32px',
            paddingBottom: '16px',
            borderBottom: '1px solid rgba(45, 41, 38, 0.08)'
          }}>
            {/* Concept chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#8C827A', letterSpacing: '0.05em' }}>LỌC THEO:</span>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {['Tất cả', 'Cung đình', 'Nàng thơ'].map((chip) => {
                  const isActive = selectedChip === chip;
                  return (
                    <button
                      key={chip}
                      onClick={() => setSelectedChip(chip)}
                      style={{
                        padding: '8px 24px',
                        borderRadius: '9999px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backgroundColor: isActive ? 'var(--color-primary-dark)' : 'transparent',
                        color: isActive ? '#FFFFFF' : '#8C827A',
                        border: isActive ? '1px solid var(--color-primary-dark)' : '1px solid rgba(45, 41, 38, 0.15)'
                      }}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Map action link */}
            <button 
              onClick={() => toast.info('Chức năng bản đồ sẽ sớm được cập nhật!')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--color-primary)',
                background: 'none',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Map size={16} />
              <span style={{ letterSpacing: '0.05em' }}>XEM TRÊN BẢN ĐỒ</span>
            </button>
          </div>

          {/* Loading, Error and Grid */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '100px 0', gap: '16px' }}>
              <div className="vh-loading-spinner">
                <div className="vh-loading-double-bounce1"></div>
                <div className="vh-loading-double-bounce2"></div>
              </div>
              <span className="font-header" style={{ color: '#8C827A' }}>Đang tải danh sách nhiếp ảnh gia...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--color-primary)' }}>
              <h3 className="font-header" style={{ fontSize: '20px' }}>Không thể tải dữ liệu</h3>
              <p style={{ fontSize: '14px', marginTop: '4px' }}>{error}</p>
            </div>
          ) : filteredPhotographers.length === 0 ? (
            <div style={{
              padding: '80px 0',
              textAlign: 'center',
              color: '#8C827A'
            }}>
              <Search size={48} style={{ color: '#CCCCCC', marginBottom: '16px' }} />
              <h3 className="font-header" style={{ fontSize: '20px', color: '#2D2926' }}>Không tìm thấy nhiếp ảnh gia phù hợp</h3>
              <p style={{ fontSize: '14px', marginTop: '4px' }}>Vui lòng thay đổi bộ lọc tìm kiếm.</p>
            </div>
          ) : (
            <div>
              {/* PHOTOGRAPHERS GRID */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '30px'
              }}>
                {filteredPhotographers.map((p) => (
                  <div 
                    key={p.id} 
                    onClick={() => openDetailsDrawer(p)}
                    style={{ 
                      backgroundColor: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1px solid rgba(45, 41, 38, 0.08)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-6px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                  >
                    {/* Aspect 4:5 image wrapper */}
                    <div style={{ 
                      aspectRatio: '4 / 5', 
                      borderRadius: '12px', 
                      overflow: 'hidden', 
                      position: 'relative' 
                    }}>
                      <img 
                        src={p.image} 
                        alt={p.name} 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover'
                        }}
                      />

                      {/* Top Left Concept Badge */}
                      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 5 }}>
                        <span style={{ 
                          padding: '6px 12px', 
                          fontSize: '10px', 
                          fontWeight: 700, 
                          borderRadius: '4px', 
                          backgroundColor: 'var(--color-primary)', 
                          color: '#FFFFFF', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em' 
                        }}>
                          {p.styleTag}
                        </span>
                      </div>

                      {/* Costume Match Badge */}
                      {hasAoDaiInCart && (
                        <div style={{ position: 'absolute', top: '52px', left: '16px', zIndex: 5 }}>
                          <span style={{ 
                            padding: '6px 12px', 
                            fontSize: '9px', 
                            fontWeight: 700, 
                            borderRadius: '4px', 
                            backgroundColor: 'rgba(26, 188, 156, 0.95)', 
                            color: '#FFFFFF', 
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                          }}>
                            <Sparkles size={10} />
                            <span>Phù hợp 98%</span>
                          </span>
                        </div>
                      )}

                      {/* Top Middle So Sanh Checkbox Pill */}
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        style={{ 
                          position: 'absolute', 
                          top: '16px', 
                          left: '50%', 
                          transform: 'translateX(-50%)', 
                          zIndex: 6, 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                          padding: '6px 12px', 
                          borderRadius: '9999px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      >
                        <input 
                          type="checkbox" 
                          id={`compare-cb-${p.id}`}
                          checked={compareList.includes(p.id)}
                          onChange={(e) => handleCompareToggle(p.id, e)}
                          style={{ cursor: 'pointer', accentColor: 'var(--color-primary-dark)' }}
                        />
                        <label 
                          htmlFor={`compare-cb-${p.id}`}
                          style={{ fontSize: '10px', fontWeight: 700, color: '#2D2926', cursor: 'pointer', userSelect: 'none' }}
                        >
                          SO SÁNH
                        </label>
                      </div>

                      {/* Top Right Rating Badge */}
                      <div style={{ 
                        position: 'absolute', 
                        top: '16px', 
                        right: '16px', 
                        zIndex: 5, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        backgroundColor: '#FFFFFF', 
                        padding: '6px 12px', 
                        borderRadius: '9999px', 
                        fontSize: '12px', 
                        fontWeight: 700, 
                        color: '#2D2926',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                      }}>
                        <Star size={12} fill="#F59E0B" stroke="#F59E0B" />
                        <span>{p.rating.toFixed(1)}</span>
                        <span style={{ color: '#8C827A', fontWeight: 400 }}>({p.reviewsCount})</span>
                      </div>
                    </div>

                    {/* Bottom Info area */}
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {/* Serif Name in Primary Dark */}
                        <h3 className="font-header" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-primary-dark)', margin: 0, textAlign: 'left' }}>
                          {p.name}
                        </h3>
                        
                        {/* Quote in italic warm gray */}
                        <p className="font-body" style={{ 
                          fontSize: '13px', 
                          fontStyle: 'italic', 
                          color: '#8C827A', 
                          lineHeight: 1.5,
                          margin: '0',
                          textAlign: 'left'
                        }}>
                          {p.quote}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div style={{ 
                        display: 'flex', 
                        gap: '10px', 
                        marginTop: '20px', 
                        paddingTop: '14px', 
                        borderTop: '1px solid rgba(45, 41, 38, 0.08)' 
                      }}>
                        <button 
                          className="vh-btn vh-btn-outline" 
                          style={{ 
                            flex: 1, 
                            padding: '10px', 
                            fontSize: '13px', 
                            borderRadius: '8px', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center',
                            gap: '6px',
                            borderColor: 'var(--color-primary)',
                            color: 'var(--color-primary)',
                            backgroundColor: 'transparent',
                            cursor: 'pointer'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.success(`Đang tải Portfolio của ${p.name}`);
                          }}
                        >
                          <Camera size={14} style={{ color: 'var(--color-primary)' }} />
                          <span>Portfolio</span>
                        </button>
                        
                        <button 
                          className="vh-btn vh-btn-primary" 
                          style={{ 
                            flex: 1, 
                            padding: '10px', 
                            fontSize: '13px', 
                            borderRadius: '8px', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: 'var(--color-primary-dark)',
                            color: '#FFFFFF',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetailsDrawer(p);
                          }}
                        >
                          <Calendar size={14} />
                          <span>Đặt lịch</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* OUTLINED XEM THEM BUTTON */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '48px' }}>
                <button
                  onClick={() => toast.info('Đã hiển thị toàn bộ thợ chụp trong cơ sở dữ liệu!')}
                  className="font-header"
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(45, 41, 38, 0.25)',
                    color: 'var(--color-primary)',
                    padding: '12px 36px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.backgroundColor = 'rgba(45, 41, 38, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(45, 41, 38, 0.25)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  XEM THÊM THỢ CHỤP
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 3. SLIDE-OUT DETAILS DRAWER */}
      {/* Backdrop overlay */}
      {isDrawerOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 999,
            transition: 'opacity 0.3s ease'
          }}
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Drawer Panel */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: '500px',
          maxWidth: '100%',
          backgroundColor: '#FCF9F2', // Creamy beige background
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.2)',
          zIndex: 1000,
          transform: isDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          textAlign: 'left'
        }}
      >
        {selectedPhotographer && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* Drawer Header */}
            <div style={{ 
              padding: '24px 30px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              borderBottom: '1px solid rgba(45, 41, 38, 0.08)'
            }}>
              <h2 className="font-header" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary-dark)', margin: 0 }}>
                Thông tin thợ chụp
              </h2>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: '#8C827A',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
              
              {/* Representative Image */}
              <div style={{ width: '100%', height: '240px', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
                <img 
                  src={selectedPhotographer.image} 
                  alt={selectedPhotographer.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              {/* GOI DICH VU SECTION */}
              <div>
                <h3 className="font-body" style={{ fontSize: '11px', fontWeight: 800, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
                  Gói dịch vụ
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedPhotographer.packages && selectedPhotographer.packages.length > 0 ? (
                    selectedPhotographer.packages.map((pkg: any, pIdx: number) => {
                      const isSelected = selectedPkgIndex === pIdx;
                      return (
                        <div 
                          key={pkg._id || pIdx}
                          onClick={() => setSelectedPkgIndex(pIdx)}
                          style={{
                            border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid rgba(182, 145, 91, 0.3)',
                            borderRadius: '8px',
                            padding: '14px 16px',
                            backgroundColor: isSelected ? 'rgba(161, 30, 34, 0.03)' : '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left', maxWidth: '75%' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#2D2926' }}>
                              {pkg.name}
                            </span>
                            <span style={{ fontSize: '12px', color: '#8C827A', lineHeight: 1.4 }}>
                              {pkg.description || `${pkg.durationHours} giờ, ${pkg.editedPhotosCount} ảnh chỉnh sửa`}
                            </span>
                            <span style={{ fontSize: '11px', color: '#8C827A' }}>
                              Thời gian: {pkg.durationHours}h | Edit: {pkg.editedPhotosCount} ảnh | Trả ảnh: {pkg.deliveryDays} ngày
                            </span>
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-dark)', flexShrink: 0 }}>
                            {pkg.price.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: '13px', color: '#8C827A', textAlign: 'center', padding: '10px' }}>
                      Chưa cấu hình gói dịch vụ nào.
                    </div>
                  )}
                </div>
              </div>

              {/* THIET BI SECTION */}
              <div>
                <h3 className="font-body" style={{ fontSize: '11px', fontWeight: 800, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                  Thiết bị
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(selectedPhotographer.equipment && selectedPhotographer.equipment.length > 0
                    ? selectedPhotographer.equipment
                    : getPhotographerGear(selectedPhotographer.name).tags
                  ).map((tag: string) => (
                    <span 
                      key={tag}
                      style={{
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: 'rgba(45, 41, 38, 0.05)',
                        color: '#8C827A',
                        borderRadius: '9999px'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* DANH GIA GAN DAY SECTION */}
              <div>
                <h3 className="font-body" style={{ fontSize: '11px', fontWeight: 800, color: '#8C827A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                  Đánh giá gần đây
                </h3>
                <div style={{ 
                  backgroundColor: '#FFFFFF', 
                  borderRadius: '12px', 
                  padding: '16px',
                  boxShadow: 'var(--shadow-sm)',
                  border: '1px solid rgba(182, 145, 91, 0.15)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#2D2926' }}>
                      {getPhotographerReview(selectedPhotographer.name).author}
                    </span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={12} fill="#F59E0B" stroke="#F59E0B" />
                      ))}
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: '#8C827A', fontStyle: 'italic', margin: 0, lineHeight: 1.5, textAlign: 'left' }}>
                    "{getPhotographerReview(selectedPhotographer.name).comment}"
                  </p>
                </div>
              </div>

            </div>

            {/* Drawer CTA Action Footer */}
            <div style={{ padding: '24px 30px', backgroundColor: '#FFFFFF', borderTop: '1px solid rgba(45, 41, 38, 0.08)' }}>
              <button
                className="vh-btn vh-btn-primary"
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate(`/photographers/${selectedPhotographer.providerId || selectedPhotographer.id}`, {
                    state: { selectedPackageId: selectedPhotographer.packages[selectedPkgIndex]?._id }
                  });
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-primary-dark)',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <span>XEM CHI TIẾT</span>
                <span>→</span>
              </button>
            </div>

          </div>
        )}
      </div>

      {/* FLOATING MAP BUTTON */}
      <button 
        onClick={() => toast.info('Đang tải bản đồ khu vực...')}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          backgroundColor: 'var(--color-primary-dark)',
          color: '#FFFFFF',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '9999px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: '13px',
          cursor: 'pointer',
          zIndex: 100
        }}
      >
        <Map size={16} />
        <span>XEM BẢN ĐỒ</span>
      </button>

    </div>
  );
};
