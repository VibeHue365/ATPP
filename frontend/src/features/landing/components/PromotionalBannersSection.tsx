import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '../../../config/routes';

export const PromotionalBannersSection: React.FC = () => {
  return (
    <section className="lume-promotions w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* LEFT BANNER: Light / Soft Surface */}
        <div 
          className="rounded-3xl p-6 md:p-7 flex flex-col sm:flex-row justify-between items-stretch gap-5 min-w-0 group transition-all"
          style={{
            backgroundColor: 'var(--landing-surface-soft)',
            border: '1px solid var(--landing-border)',
          }}
        >
          {/* Text Content Area */}
          <div className="flex flex-col justify-between gap-3 flex-1 min-w-0">
            <div className="flex flex-col gap-2">
              <span 
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--landing-primary)' }}
              >
                ÁO DÀI THEO DỊP
              </span>
              <h3 
                className="text-xl md:text-2xl font-bold font-header leading-snug"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                Kỷ yếu, lễ hội, du lịch và sự kiện
              </h3>
              <p 
                className="text-xs leading-relaxed line-clamp-2"
                style={{ color: 'var(--landing-text-secondary)' }}
              >
                Bộ sưu tập trang phục phong phú phù hợp cho mọi nhu cầu trải nghiệm văn hóa.
              </p>
            </div>

            <Link
              to={ROUTES.RENTALS}
              className="text-xs font-bold inline-flex items-center gap-1.5 hover:underline text-decoration-none self-start mt-1"
              style={{ color: 'var(--landing-primary)' }}
            >
              <span>Xem bộ sưu tập</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Visual Area */}
          <div className="w-full sm:w-44 md:w-48 h-40 sm:h-auto rounded-2xl overflow-hidden shrink-0 shadow-sm bg-stone-100 relative">
            <img
              src="/images/campaign-ao-dai-theo-dip.webp"
              alt="Bộ sưu tập Áo Dài"
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </div>

        {/* RIGHT BANNER: Burgundy Dark Surface */}
        <div 
          className="rounded-3xl p-6 md:p-7 flex flex-col sm:flex-row justify-between items-stretch gap-5 min-w-0 group transition-all text-white"
          style={{
            backgroundColor: 'var(--landing-primary)',
          }}
        >
          {/* Text Content Area */}
          <div className="flex flex-col justify-between gap-3 flex-1 min-w-0">
            <div className="flex flex-col gap-2">
              <span 
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--landing-primary-soft)' }}
              >
                CHỤP THEO CONCEPT
              </span>
              <h3 className="text-xl md:text-2xl font-bold font-header leading-snug text-white">
                Studio, ngoại cảnh và chụp theo nhóm
              </h3>
              <p className="text-xs leading-relaxed text-stone-200 line-clamp-2">
                Đội ngũ nhiếp ảnh gia sáng tạo, đồng hành cùng bạn trong từng góc máy.
              </p>
            </div>

            <Link
              to={ROUTES.PHOTOGRAPHERS}
              className="text-xs font-bold inline-flex items-center gap-1.5 hover:underline text-decoration-none text-white self-start mt-1"
            >
              <span>Xem gói chụp</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Visual Area */}
          <div className="w-full sm:w-44 md:w-48 h-40 sm:h-auto rounded-2xl overflow-hidden shrink-0 shadow-sm border border-white/20 bg-stone-900 relative">
            <img
              src="/images/campaign-chup-theo-concept.webp"
              alt="Nhiếp ảnh concept"
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </div>

      </div>
    </section>
  );
};
