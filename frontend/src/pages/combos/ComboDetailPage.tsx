import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Sparkles, Scissors, Camera, Calendar, Clock, Users, Package,
  ChevronRight, ShoppingBag, Image as ImageIcon, Loader2, MapPin, Star,
  AlertCircle
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { useCart } from '../../context/CartContext';
import { ROUTES } from '../../config/routes';
import { API_BASE_URL } from '../../config/env';
import { useToast } from '../../components/feedback/Toast';
import './ComboDetailPage.css';

const getImageUrl = (url: string) => {
  if (!url) return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url}`;
};

const timeSlots: string[] = [];
for (let h = 6; h <= 20; h++) {
  timeSlots.push(`${String(h).padStart(2, '0')}:00`);
  timeSlots.push(`${String(h).padStart(2, '0')}:30`);
}

interface ComboDetail {
  _id: string;
  name: string;
  description?: string;
  productId: {
    _id: string;
    name: string;
    images: string[];
    basePrice: number;
    slug: string;
    depositAmount?: number;
    sizes?: string[];
    colors?: string[];
    materials?: string[];
  };
  photographyPackageId: {
    _id: string;
    name: string;
    images: string[];
    price: number;
    durationHours: number;
    slug: string;
    editedPhotosCount?: number;
    deliveryDays?: number;
    maxPeople?: number;
  };
  providerId: {
    _id: string;
    businessName: string;
    address?: { addressLine: string; city: string };
    rating?: { averageRating: number; totalReviews: number };
    contact?: { phone: string; email: string };
  };
  discountPercent: number;
  comboPrice?: number;
  validFrom?: string;
  validTo?: string;
  aoDaiQuantity: number;
  shootPeopleCount: number;
  maxUsage: number;
  usedCount: number;
  image?: string;
}

export const ComboDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  console.log('=== ComboDetailPage mounted/rendering with id:', id);
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const toast = useToast();

  const [combo, setCombo] = useState<ComboDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gallery state
  const [activeImg, setActiveImg] = useState(0);

  // Booking form state
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');

  useEffect(() => {
    if (!id) return;
    const fetchCombo = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await httpClient.get<ComboDetail>(`/combo-promotions/${id}`);
        setCombo(data);
        // Default size/color
        if (data.productId?.sizes?.length) setSelectedSize(data.productId.sizes[0]);
        if (data.productId?.colors?.length) setSelectedColor(data.productId.colors[0]);
      } catch (err: any) {
        setError(err.message || 'Không thể tải thông tin combo');
      } finally {
        setLoading(false);
      }
    };
    fetchCombo();
  }, [id]);

  // All gallery images (combo image + product images + package images)
  const allImages = useMemo(() => {
    if (!combo) return [];
    const imgs: string[] = [];
    if (combo.image) imgs.push(combo.image);
    if (combo.productId?.images) imgs.push(...combo.productId.images);
    if (combo.photographyPackageId?.images) imgs.push(...combo.photographyPackageId.images);
    return imgs.length > 0 ? imgs : [''];
  }, [combo]);

  if (loading) {
    return (
      <div className="vh-combo-detail">
        <div className="vh-combo-detail-loading">
          <Loader2 size={32} />
          <span>Đang tải thông tin combo...</span>
        </div>
      </div>
    );
  }

  if (error || !combo) {
    return (
      <div className="vh-combo-detail">
        <div className="vh-combo-detail-error">
          <AlertCircle size={36} />
          <h3>{error || 'Không tìm thấy combo'}</h3>
          <Link to={ROUTES.COMBOS}>← Quay lại danh sách combo</Link>
        </div>
      </div>
    );
  }

  const product = combo.productId;
  const pkg = combo.photographyPackageId;
  const provider = combo.providerId;

  if (!product || !pkg) {
    return (
      <div className="vh-combo-detail">
        <div className="vh-combo-detail-error">
          <AlertCircle size={36} />
          <h3>Sản phẩm áo dài hoặc gói chụp ảnh của combo này không khả dụng</h3>
          <Link to={ROUTES.COMBOS}>← Quay lại danh sách combo</Link>
        </div>
      </div>
    );
  }

  const originalPrice = (product.basePrice || 0) + (pkg.price || 0);
  const discountedPrice = combo.comboPrice
    ? combo.comboPrice
    : Math.round(originalPrice * (1 - combo.discountPercent / 100));
  const savedAmount = originalPrice - discountedPrice;
  const remaining = combo.maxUsage - (combo.usedCount || 0);

  const validFromDate = combo.validFrom ? new Date(combo.validFrom) : null;
  const validToDate = combo.validTo ? new Date(combo.validTo) : null;
  const todayStr = new Date().toISOString().split('T')[0];

  let minDate = todayStr;
  let maxDate = '';

  try {
    if (validFromDate && !isNaN(validFromDate.getTime())) {
      const fromStr = validFromDate.toISOString().split('T')[0];
      minDate = fromStr > todayStr ? fromStr : todayStr;
    }
  } catch (err) {
    console.error('Error parsing validFrom Date:', err);
  }

  try {
    if (validToDate && !isNaN(validToDate.getTime())) {
      maxDate = validToDate.toISOString().split('T')[0];
    }
  } catch (err) {
    console.error('Error parsing validTo Date:', err);
  }

  const computedEndTime = (() => {
    const duration = pkg.durationHours || 1;
    const startIndex = timeSlots.indexOf(startTime);
    const slotsToSkip = Math.round(duration * 2);
    const endIndex = Math.min(startIndex + slotsToSkip, timeSlots.length - 1);
    return timeSlots[endIndex] || startTime;
  })();

  const canBook = selectedSize && selectedColor && shootDate && startTime && remaining > 0;

  const handleBookCombo = () => {
    if (!canBook) {
      toast.error('Vui lòng chọn đầy đủ thông tin trước khi đặt combo');
      return;
    }

    const comboTimeSlot = `${startTime} - ${computedEndTime}`;

    // Add Ao Dai to cart
    addToCart({
      itemType: 'PRODUCT',
      productId: product._id,
      productName: product.name,
      productImage: product.images?.[0] || '',
      basePrice: product.basePrice,
      depositAmount: product.depositAmount || 0,
      size: selectedSize,
      color: selectedColor,
      rentalType: 'DAILY',
      startDate: shootDate,
      endDate: shootDate,
      rentalFrom: shootDate,
      rentalTo: shootDate,
      providerCity: provider.address?.city || '',
      providerAddress: provider.address?.addressLine || '',
      comboDiscountPercent: combo.discountPercent,
      comboPromotionId: combo._id,
      quantity: combo.aoDaiQuantity || 1,
    });

    // Add Photography Package to cart
    addToCart({
      itemType: 'PHOTOGRAPHY_PACKAGE',
      photographyPackageId: pkg._id,
      photographerName: provider.businessName,
      photographerAvatar: '',
      packageName: pkg.name,
      basePrice: pkg.price,
      depositAmount: Math.round(pkg.price * 0.3),
      shootDate: shootDate,
      shootTimeSlot: comboTimeSlot,
      shootLocation: provider.address?.addressLine || '',
      shootConcept: 'Gói chụp ảnh trong Combo',
      photographerCity: provider.address?.city || '',
      comboDiscountPercent: combo.discountPercent,
      comboPromotionId: combo._id,
      quantity: 1,
    });

    toast.success('Đã thêm combo vào giỏ hàng!');
    navigate(ROUTES.CART);
  };

  return (
    <div className="vh-combo-detail">
      {/* Breadcrumb */}
      <div className="vh-combo-detail-breadcrumb">
        <Link to={ROUTES.LANDING}>Trang chủ</Link>
        <ChevronRight size={14} />
        <Link to={ROUTES.COMBOS}>Combo</Link>
        <ChevronRight size={14} />
        <span className="active">{combo.name}</span>
      </div>

      {/* Top Section: Gallery + Info */}
      <div className="vh-combo-detail-top">
        {/* Gallery */}
        <div className="vh-combo-detail-gallery">
          <div className="vh-combo-detail-discount-badge">
            <Sparkles size={14} fill="currentColor" />
            GIẢM {combo.discountPercent}%
          </div>
          <img
            className="vh-combo-detail-gallery-main"
            src={getImageUrl(allImages[activeImg] || '')}
            alt={combo.name}
          />
          {allImages.length > 1 && (
            <div className="vh-combo-detail-gallery-thumbs">
              {allImages.map((img, i) => (
                <img
                  key={i}
                  src={getImageUrl(img)}
                  alt={`Ảnh ${i + 1}`}
                  className={`vh-combo-detail-gallery-thumb ${i === activeImg ? 'active' : ''}`}
                  onClick={() => setActiveImg(i)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="vh-combo-detail-info">
          {/* Provider */}
          <div className="vh-combo-detail-provider">
            <MapPin size={14} />
            <span>{provider?.businessName}</span>
            {provider?.rating && provider.rating.totalReviews > 0 && (
              <>
                <span>•</span>
                <Star size={13} fill="#F59E0B" color="#F59E0B" />
                <span>{provider.rating.averageRating.toFixed(1)} ({provider.rating.totalReviews})</span>
              </>
            )}
          </div>

          {/* Title */}
          <h1 className="vh-combo-detail-title">{combo.name}</h1>

          {/* Description */}
          {combo.description && (
            <p className="vh-combo-detail-desc">{combo.description}</p>
          )}

          {/* Price Block */}
          <div className="vh-combo-detail-price-block">
            <div className="vh-combo-detail-price-left">
              <span className="vh-combo-detail-price-label">Giá combo trọn gói</span>
              <span className="vh-combo-detail-price-original">
                {originalPrice.toLocaleString('vi-VN')}đ
              </span>
              <span className="vh-combo-detail-price-combo">
                {discountedPrice.toLocaleString('vi-VN')}đ
              </span>
            </div>
            <div className="vh-combo-detail-price-save">
              Tiết kiệm {savedAmount.toLocaleString('vi-VN')}đ
            </div>
          </div>

          {/* Meta Cards */}
          <div className="vh-combo-detail-meta-grid">
            <div className="vh-combo-detail-meta-card">
              <Calendar size={18} />
              <div className="vh-combo-detail-meta-card-content">
                <span className="vh-combo-detail-meta-card-label">Thời gian áp dụng</span>
                <span className="vh-combo-detail-meta-card-value">
                  {validFromDate?.toLocaleDateString('vi-VN')} — {validToDate?.toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
            <div className="vh-combo-detail-meta-card">
              <Package size={18} />
              <div className="vh-combo-detail-meta-card-content">
                <span className="vh-combo-detail-meta-card-label">Còn lại</span>
                <span className="vh-combo-detail-meta-card-value">
                  {remaining}/{combo.maxUsage} suất
                </span>
              </div>
            </div>
            <div className="vh-combo-detail-meta-card">
              <Users size={18} />
              <div className="vh-combo-detail-meta-card-content">
                <span className="vh-combo-detail-meta-card-label">Số người chụp</span>
                <span className="vh-combo-detail-meta-card-value">{combo.shootPeopleCount || 1} người</span>
              </div>
            </div>
            <div className="vh-combo-detail-meta-card">
              <Scissors size={18} />
              <div className="vh-combo-detail-meta-card-content">
                <span className="vh-combo-detail-meta-card-label">Áo dài thuê</span>
                <span className="vh-combo-detail-meta-card-value">{combo.aoDaiQuantity || 1} bộ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Included Items */}
      <div className="vh-combo-detail-items">
        <h2>Bao gồm trong Combo</h2>
        <div className="vh-combo-detail-items-grid">
          {/* Ao Dai Card */}
          <div className="vh-combo-detail-item-card">
            <img
              className="vh-combo-detail-item-img"
              src={getImageUrl(product.images?.[0] || '')}
              alt={product.name}
            />
            <div className="vh-combo-detail-item-body">
              <div className="vh-combo-detail-item-type-badge aodai">
                <Scissors size={10} /> Áo Dài
              </div>
              <div className="vh-combo-detail-item-name">{product.name}</div>
              <div className="vh-combo-detail-item-price">
                {product.basePrice.toLocaleString('vi-VN')}đ / bộ
              </div>
              <div className="vh-combo-detail-item-specs">
                {product.sizes && product.sizes.length > 0 && (
                  <div className="vh-combo-detail-item-spec">
                    <Package size={12} />
                    Size: {product.sizes.join(', ')}
                  </div>
                )}
                {product.colors && product.colors.length > 0 && (
                  <div className="vh-combo-detail-item-spec">
                    <Sparkles size={12} />
                    Màu: {product.colors.join(', ')}
                  </div>
                )}
                {product.materials && product.materials.length > 0 && (
                  <div className="vh-combo-detail-item-spec">
                    <Scissors size={12} />
                    Chất liệu: {product.materials.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Photography Package Card */}
          <div className="vh-combo-detail-item-card">
            <img
              className="vh-combo-detail-item-img"
              src={getImageUrl(pkg.images?.[0] || '')}
              alt={pkg.name}
            />
            <div className="vh-combo-detail-item-body">
              <div className="vh-combo-detail-item-type-badge photo">
                <Camera size={10} /> Gói Chụp Ảnh
              </div>
              <div className="vh-combo-detail-item-name">{pkg.name}</div>
              <div className="vh-combo-detail-item-price">
                {pkg.price.toLocaleString('vi-VN')}đ / gói
              </div>
              <div className="vh-combo-detail-item-specs">
                <div className="vh-combo-detail-item-spec">
                  <Clock size={12} />
                  Thời lượng: {pkg.durationHours} giờ
                </div>
                {pkg.editedPhotosCount && (
                  <div className="vh-combo-detail-item-spec">
                    <ImageIcon size={12} />
                    {pkg.editedPhotosCount} ảnh chỉnh sửa
                  </div>
                )}
                {pkg.deliveryDays && (
                  <div className="vh-combo-detail-item-spec">
                    <Calendar size={12} />
                    Trả ảnh sau {pkg.deliveryDays} ngày
                  </div>
                )}
                {pkg.maxPeople && (
                  <div className="vh-combo-detail-item-spec">
                    <Users size={12} />
                    Tối đa {pkg.maxPeople} người / gói
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Section */}
      <div className="vh-combo-detail-booking">
        <div className="vh-combo-detail-booking-card">
          <h2>🎯 Đặt Combo Ngay</h2>

          <div className="vh-combo-detail-booking-grid">
            {/* Size */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="vh-combo-detail-field">
                <label>Chọn kích cỡ áo dài</label>
                <div className="vh-combo-detail-chips">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`vh-combo-detail-chip ${selectedSize === size ? 'selected' : ''}`}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color */}
            {product.colors && product.colors.length > 0 && (
              <div className="vh-combo-detail-field">
                <label>Chọn màu sắc áo dài</label>
                <div className="vh-combo-detail-chips">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`vh-combo-detail-chip ${selectedColor === color ? 'selected' : ''}`}
                      onClick={() => setSelectedColor(color)}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Shoot Date */}
            <div className="vh-combo-detail-field">
              <label>Chọn ngày chụp mong muốn</label>
              <input
                type="date"
                value={shootDate}
                onChange={(e) => setShootDate(e.target.value)}
                min={minDate}
                max={maxDate}
              />
            </div>

            {/* Start Time */}
            <div className="vh-combo-detail-field">
              <label>Chọn giờ bắt đầu chụp</label>
              <select value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                {timeSlots.map((ts) => (
                  <option key={ts} value={ts}>{ts}</option>
                ))}
              </select>
              {shootDate && (
                <small style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, marginTop: '4px' }}>
                  Khung giờ: {startTime} — {computedEndTime} ({pkg.durationHours}h)
                </small>
              )}
            </div>
          </div>

          {remaining <= 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECDD3', borderRadius: '8px', padding: '12px', color: '#DC2626', fontSize: '13px', fontWeight: 600, textAlign: 'center', marginBottom: '12px' }}>
              Combo này đã hết suất. Vui lòng chọn combo khác.
            </div>
          )}

          <button
            className="vh-combo-detail-cta"
            onClick={handleBookCombo}
            disabled={!canBook}
          >
            <ShoppingBag size={18} />
            Đặt Combo Ngay — {discountedPrice.toLocaleString('vi-VN')}đ
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComboDetailPage;
