import React from 'react';
import { Camera, Calendar, Star } from 'lucide-react';

interface Photographer {
  id: string;
  name: string;
  style: string;
  quote: string;
  rating: number;
  reviewsCount: number;
  image: string;
}

export const PhotographerFeaturedList: React.FC = () => {
  const photographers: Photographer[] = [
    {
      id: '1',
      name: 'Hoàng Minh',
      style: 'ẢNH THỜI TRANG DI SẢN',
      quote: '"Lưu giữ hồn cốt Việt qua từng khung hình đương đại."',
      rating: 4.9,
      reviewsCount: 120,
      image: '/hoang_minh.png',
    },
    {
      id: '2',
      name: 'Lê Thảo',
      style: 'ÁNH SÁNG TỰ NHIÊN & LÃNG MẠN',
      quote: '"Mỗi bức ảnh là một bài thơ về vẻ đẹp dịu dàng."',
      rating: 5.0,
      reviewsCount: 95,
      image: '/le_thao.png',
    },
    {
      id: '3',
      name: 'Trần Bảo',
      style: 'ĐIỆN ẢNH CỔ ĐIỂN',
      quote: '"Kể chuyện lịch sử qua lăng kính nhiếp ảnh chuyên sâu."',
      rating: 4.8,
      reviewsCount: 140,
      image: '/tran_bao.png',
    },
  ];

  return (
    <section id="photographers" className="vh-features-section bg-white py-20 px-6">
      <div className="max-w-[1600px] w-full px-6 md:px-12 mx-auto">
        {/* Section Header */}
        <div className="vh-section-header" style={{ marginBottom: '56px' }}>
          <span className="vh-section-badge">Gương Mặt Nghệ Thuật</span>
          <h2 className="text-3xl font-bold font-header text-stone-900 mt-2">Nhiếp Ảnh Gia Tiêu Biểu</h2>
          <p className="text-stone-500 mt-1">Đội ngũ tác giả chuyên nghiệp đồng hành kiến tạo những khoảnh khắc di sản vô giá</p>
        </div>

        {/* Photographers Grid */}
        <div className="vh-photographers-grid">
          {photographers.map((p) => (
            <div key={p.id} className="vh-premium-card" style={{ padding: '20px' }}>
              {/* Image Container */}
              <div className="vh-card-image-wrapper" style={{ aspectRatio: '4 / 5' }}>
                <img
                  src={p.image}
                  alt={p.name}
                  className="vh-card-image"
                />

                {/* Style Overlay */}
                <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10 }}>
                  <span style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 700, borderRadius: '9999px', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {p.style}
                  </span>
                </div>

                {/* Rating Badge */}
                <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '9999px', backgroundColor: 'rgba(255, 255, 255, 0.95)', color: 'var(--color-text-primary)', fontSize: '12px', fontWeight: 700, boxShadow: 'var(--shadow-sm)' }}>
                  <Star size={12} className="fill-amber-400 stroke-amber-400" />
                  <span>{p.rating}</span>
                  <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>({p.reviewsCount})</span>
                </div>
              </div>

              {/* Text Info */}
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
                    {p.name}
                  </h3>
                  <p style={{ fontSize: '14px', fontStyle: 'italic', color: 'var(--color-text-secondary)', marginTop: '12px', lineHeight: 1.6 }}>
                    {p.quote}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--color-light-border)' }}>
                  <button className="vh-btn vh-btn-outline" style={{ flex: 1, padding: '10px', fontSize: '14px', borderRadius: '8px', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                    <Camera size={16} />
                    <span>Portfolio</span>
                  </button>
                  <button className="vh-btn vh-btn-primary" style={{ flex: 1, padding: '10px', fontSize: '14px', borderRadius: '8px', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                    <Calendar size={16} />
                    <span>Đặt lịch</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
