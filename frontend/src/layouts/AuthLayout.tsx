import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

export const AuthLayout: React.FC = () => {
  const location = useLocation();
  const isRegister = location.pathname.includes('/register');

  const images = [
    '/hero_bg.png',
    '/nang_thuy_tien.png',
    '/phuong_hoang.png',
    '/hong_lien_hoa.png',
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <div className="vh-auth-container" style={{ height: '100vh', overflow: 'hidden' }}>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      
      {/* Visual Brand Side - Full bleed hero image with floating glass card */}
      <div
        className="vh-auth-brand-side"
        style={{
          height: '100vh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Render all background images absolutely, overlaying each other, cross-fading */}
        {images.map((img, idx) => (
          <div
            key={img}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url('${img}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: idx === currentImageIndex ? 1 : 0,
              transition: 'opacity 1.5s ease-in-out',
              zIndex: 1,
            }}
          />
        ))}

        {/* Dark subtle overlay */}
        <div
          className="vh-auth-brand-overlay"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 100%)',
            position: 'absolute',
            inset: 0,
            zIndex: 2,
          }}
        />

        {/* Premium Floating Glassmorphic Card */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '40px',
            right: '40px',
            zIndex: 10,
            background: 'rgba(30, 27, 25, 0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '36px',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
            animation: 'fadeInUp 0.6s ease-out forwards',
          }}
        >
          {/* Gold Header Tag */}
          <span
            style={{
              color: 'var(--color-gold)',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-body)',
              display: 'block',
              marginBottom: '12px',
            }}
          >
            {isRegister ? 'KẾT NỐI ĐỐI TÁC • SILK & STONE' : 'GIAO THOA DI SẢN • SILK & STONE'}
          </span>

          <h1
            style={{
              color: '#FFFFFF',
              fontSize: '32px',
              fontWeight: 800,
              fontFamily: 'var(--font-header)',
              lineHeight: 1.2,
              marginBottom: '12px',
              letterSpacing: '-0.02em',
            }}
          >
            {isRegister
              ? 'Kiến tạo tương lai thời trang truyền thống'
              : 'Lưu giữ vẻ đẹp tinh hoa di sản'}
          </h1>
          <p
            style={{
              color: '#FAF6F0',
              fontSize: '14px',
              lineHeight: 1.6,
              fontWeight: 500,
              opacity: 0.85,
              margin: 0,
            }}
          >
            {isRegister
              ? 'Tham gia cùng hơn 10.000+ đối tác và khách hàng để chia sẻ niềm đam mê, bảo tồn và phát huy giá trị văn hóa phục sức Việt.'
              : 'Từ những chất liệu truyền thống tơ tằm, gấm, lụa... Silk & Stone đồng hành cùng bạn tôn vinh và lan tỏa bản sắc Việt.'}
          </p>
        </div>
      </div>

      {/* Form Content Side */}
      <div 
        className="vh-auth-form-side vh-hide-scrollbar" 
        style={{ 
          position: 'relative', 
          height: '100vh', 
          overflowY: 'auto', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '40px 16px',
          width: '100%',
        }}
      >
        <div className="vh-auth-form-wrapper" style={{ width: '100%', maxWidth: '460px', zIndex: 2 }}>
          <div className="vh-auth-card" style={{ padding: '12px 16px', border: 'none', boxShadow: 'none', backgroundColor: 'transparent' }}>
            <Outlet />
          </div>
        </div>

        {/* Conditional Decorative Elements */}
        {isRegister ? (
          /* Sparkle decorative cluster on Register view bottom right */
          <div className="vh-sparkle-cluster">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 4 Q20 20 4 20 Q20 20 20 36 Q20 20 36 20 Q20 20 20 4 Z" fill="var(--color-gold)" />
              <path d="M48 24 Q48 34 38 34 Q48 34 48 44 Q48 34 58 34 Q48 34 48 24 Z" fill="var(--color-primary)" />
              <path d="M28 44 Q28 49 23 49 Q28 49 28 54 Q28 49 33 49 Q28 49 28 44 Z" fill="var(--color-gold)" opacity="0.7" />
            </svg>
          </div>
        ) : (
          /* Wave decorative element on Login view */
          <div style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: 0.15, pointerEvents: 'none', zIndex: 1 }}>
            <svg width="120" height="24" viewBox="0 0 120 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 12 C 30 2, 30 22, 60 12 C 90 2, 90 22, 120 12" stroke="var(--color-primary)" strokeWidth="1.5" />
              <path d="M0 16 C 30 6, 30 26, 60 16 C 90 6, 90 26, 120 16" stroke="var(--color-gold)" strokeWidth="1" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthLayout;
