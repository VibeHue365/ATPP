import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { httpClient } from '../../../services/httpClient';
import { ROUTES } from '../../../config/routes';
import { SectionHeader } from '../../../components/common/SectionHeader';
import type { ProductFromDb, AoDaiItem } from '../types/rental.types';
import { mapProductToAoDaiItem } from '../mappers/product.mapper';
import { AoDaiCard } from './AoDaiCard';

export const FeaturedAoDaiSection: React.FC = () => {
  const [items, setItems] = useState<AoDaiItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const data = await httpClient.get<ProductFromDb[]>('/products/featured?limit=8');
        
        if (active && Array.isArray(data)) {
          const mappedItems: AoDaiItem[] = data.map(mapProductToAoDaiItem);
          setItems(mappedItems);
        }
      } catch (err: unknown) {
        console.error('Lỗi khi lấy danh sách sản phẩm nổi bật:', err);
        if (active) {
          setError('Hiện chưa thể tải danh sách sản phẩm nổi bật.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchProducts();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="rentals" className="w-full">
      {/* Section Header Reused from Phase 2 */}
      <SectionHeader
        eyebrow="THUÊ ÁO DÀI"
        title="Áo dài nổi bật"
        action={
          <Link
            to={ROUTES.RENTALS}
            className="text-xs font-bold inline-flex items-center gap-1 hover:underline text-decoration-none"
            style={{ color: 'var(--landing-primary)' }}
          >
            <span>Xem tất cả</span>
            <ArrowRight size={14} />
          </Link>
        }
      />

      {/* States & Product Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs font-semibold text-stone-500">
          Đang tải danh sách Áo Dài nổi bật...
        </div>
      ) : error ? (
        <div className="py-12 text-center text-xs font-semibold text-stone-500">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-xs font-semibold text-stone-500">
          Hiện chưa có sản phẩm Áo Dài nổi bật nào.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <AoDaiCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
};
