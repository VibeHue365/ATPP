import React from 'react';
import { Star, Quote } from 'lucide-react';
import { TESTIMONIALS_DATA } from '../constants/testimonials.constants';

export const TestimonialGrid: React.FC = () => {
  return (
    <section className="vh-features-section bg-stone-50 py-20 px-6 border-t border-stone-200">
      <div className="max-w-[1600px] w-full px-6 md:px-12 mx-auto">
        {/* Section Header */}
        <div className="vh-section-header" style={{ marginBottom: '56px' }}>
          <span className="vh-section-badge">ĐÁNH GIÁ</span>
          <h2 className="text-3xl font-bold font-header text-stone-900 mt-2">Trải Nghiệm Khách Hàng</h2>
          <p className="text-stone-500 mt-1">Cảm nhận chân thực từ những người đồng hành yêu mến giá trị Áo Dài di sản</p>
        </div>

        {/* Testimonials Grid */}
        <div className="vh-testimonials-grid">
          {TESTIMONIALS_DATA.map((t) => (
            <div key={t.id} className="vh-premium-card" style={{ padding: '32px', minHeight: '260px' }}>

              {/* Quote Icon */}
              <div style={{ position: 'absolute', top: '24px', right: '32px', color: '#f1f5f9', zIndex: 1 }}>
                <Quote size={40} className="fill-stone-100" style={{ opacity: 0.3 }} />
              </div>

              <div style={{ position: 'relative', zIndex: 10 }}>
                {/* Stars */}
                <div className="vh-stars-row">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={16} className="vh-star-gold" />
                  ))}
                </div>

                {/* Comment */}
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
                  {t.comment}
                </p>
              </div>

              {/* Reviewer Details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--color-light-border)' }}>
                <img
                  src={t.avatar}
                  alt={t.name}
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-light-border)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: 'var(--font-header)', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '14px' }}>{t.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.05em', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>{t.location}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default TestimonialGrid;
