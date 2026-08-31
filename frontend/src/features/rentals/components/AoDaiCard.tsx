import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../../auth/hooks/useAuth';
import { FavoriteButton } from '../../../components/common/FavoriteButton';
import { PriceDisplay } from '../../../components/common/PriceDisplay';
import { SmartTagList } from '../../smart-tagging/components/SmartTagList';
import type { AoDaiItem } from '../types/rental.types';

export interface AoDaiCardProps {
  item: AoDaiItem;
}

export const AoDaiCard: React.FC<AoDaiCardProps> = ({ item }) => {
  const navigate = useNavigate();
  const { user, toggleFavorite } = useAuth();

  const isFavorite = Boolean(
    user?.favorites?.some(
      (f: { targetId: unknown; targetType?: string }) =>
        String(f.targetId) === item.id &&
        (f.targetType === 'PRODUCT' || f.targetType === 'Product')
    )
  );

  const handleFavoriteClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Yêu cầu đăng nhập',
        text: 'Vui lòng đăng nhập để lưu sản phẩm yêu thích.',
        confirmButtonColor: 'var(--landing-primary, #7D3543)',
        confirmButtonText: 'Đăng nhập ngay',
        showCancelButton: true,
        cancelButtonText: 'Hủy',
      });
      if (result.isConfirmed) {
        navigate('/login');
      }
      return;
    }

    try {
      await toggleFavorite('PRODUCT', item.id);
    } catch (err: unknown) {
      console.error('Không thể cập nhật danh sách yêu thích:', err);
    }
  };

  return (
    <div
      className="lume-rental-card group flex flex-col justify-between transition-all border"
      style={{
        backgroundColor: 'var(--landing-surface)',
        borderColor: 'var(--landing-border)',
      }}
    >
      {/* Image Area Container */}
      <div className="lume-rental-card__media relative w-full aspect-[3/4] overflow-hidden bg-stone-100">
        <Link 
          to={`/rentals/${item.id}`} 
          className="block w-full h-full text-decoration-none"
          tabIndex={-1}
        >
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>

        {/* Favorite Button Primitive Overlay */}
        <div className="lume-rental-card__favorite absolute z-10">
          <FavoriteButton
            isFavorite={isFavorite}
            onToggle={handleFavoriteClick}
            title={isFavorite ? `Bỏ yêu thích ${item.name}` : `Thêm ${item.name} vào yêu thích`}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="lume-rental-card__content flex flex-col flex-1 justify-between">
        <div className="lume-rental-card__details flex flex-col">
          {/* Material / Type Subtitle */}
          <span 
            className="lume-rental-card__material text-[11px] font-bold uppercase tracking-wider"
            style={{ color: 'var(--landing-text-muted)' }}
          >
            {item.material}
          </span>

          {/* Product Name Link */}
          <Link
            to={`/rentals/${item.id}`}
            className="lume-rental-card__title font-header font-bold text-base text-decoration-none line-clamp-1 transition-colors hover:opacity-80"
            style={{ color: 'var(--landing-text-primary)' }}
          >
            {item.name}
          </Link>

          {/* Smart Badges if present */}
          {item.badges && item.badges.length > 0 && (
            <div className="lume-rental-card__tags mt-1">
              <SmartTagList badges={item.badges} limit={2} />
            </div>
          )}
        </div>

        {/* Price & Action Row */}
        <div 
          className="lume-rental-card__price-row pt-3 border-t flex items-center justify-between mt-1"
          style={{ borderColor: 'var(--landing-border)' }}
        >
          <div className="flex flex-col">
            <span 
              className="lume-rental-card__price-label text-[10px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--landing-text-muted)' }}
            >
              Giá thuê
            </span>
            <PriceDisplay price={item.price} suffix="/ngày" />
          </div>

          <Link
            to={`/rentals/${item.id}`}
            className="lume-rental-card__availability px-3.5 py-1.5 rounded-full text-xs font-bold transition-all text-decoration-none"
            style={{ backgroundColor: 'var(--landing-primary)' }}
          >
            Chi tiết
          </Link>
        </div>
      </div>
    </div>
  );
};
