import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { httpClient } from '../../../services/httpClient';
import { ROUTES } from '../../../config/routes';
import { SectionHeader } from '../../../components/common/SectionHeader';
import type { ComboDeal } from '../types/combo.types';
import { ComboCard } from './ComboCard';

export const ComboDealsSection: React.FC = () => {
  const [combos, setCombos] = useState<ComboDeal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchCombos = async () => {
      try {
        setLoading(true);
        const data = await httpClient.get<ComboDeal[]>('/combo-promotions/public');
        if (active) {
          const validData = (data || []).filter(
            (c) => c && c.productId && c.photographyPackageId,
          );
          setCombos(validData);
        }
      } catch (err: unknown) {
        console.warn('Lỗi tải danh sách combo deals:', err);
        if (active) {
          setError('Hiện chưa thể tải danh sách combo khuyến mãi.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchCombos();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="combos" className="w-full">
      <div 
        className="rounded-3xl p-6 md:p-8 transition-all"
        style={{
          backgroundColor: 'var(--landing-surface-soft)',
          border: '1px solid var(--landing-border)',
        }}
      >
        {/* Section Header Reused from Phase 2 */}
        <SectionHeader
          eyebrow="KHUYẾN MÃI & COMBO DỊCH VỤ"
          title="Combo trọn gói"
          action={
            <Link
              to={ROUTES.COMBOS}
              className="text-xs font-bold inline-flex items-center gap-1 hover:underline text-decoration-none"
              style={{ color: 'var(--landing-primary)' }}
            >
              <span>Xem tất cả</span>
              <ArrowRight size={14} />
            </Link>
          }
        />

        {/* States & 2-Card Grid */}
        {loading ? (
          <div className="py-12 text-center text-xs font-semibold text-stone-500">
            Đang tải các combo khuyến mãi...
          </div>
        ) : error ? (
          <div className="py-12 text-center text-xs font-semibold text-stone-500">
            {error}
          </div>
        ) : combos.length === 0 ? (
          <div className="py-12 text-center text-xs font-semibold text-stone-500">
            Hiện chưa có combo ưu đãi nào.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {combos.slice(0, 2).map((combo, idx) => (
              <ComboCard key={combo._id} combo={combo} index={idx} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
