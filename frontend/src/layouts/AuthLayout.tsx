import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

export const AuthLayout: React.FC = () => {
  const location = useLocation();
  const isRegister = location.pathname.includes('/register');

  return (
    <div className="vh-auth-container">
      {/* Visual Brand Side - Full bleed hero image */}
      <div
        className="vh-auth-brand-side"
        style={{
          backgroundImage: "url('/hero_bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          height: '100vh',
          position: 'relative',
        }}
      >
        {/* Dark gradient overlay from bottom */}
        <div
          className="vh-auth-brand-overlay"
          style={{
            background: isRegister
              ? 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.1) 100%)'
              : 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
          }}
        />

        {/* Conditional Left side overlay style */}
        {isRegister ? (
          /* Register specific overlay: flat text directly over dark image background */
          <div
            style={{
              position: 'absolute',
              bottom: '48px',
              left: '48px',
              right: '48px',
              zIndex: 10,
            }}
          >
            <h1
              style={{
                color: '#FFFFFF',
                fontSize: '44px',
                fontWeight: 700,
                fontFamily: 'var(--font-header)',
                lineHeight: 1.1,
                marginBottom: '4px',
                letterSpacing: '-0.02em',
              }}
            >
              Silk &amp; Stone
            </h1>
            <p
              style={{
                color: 'var(--color-gold)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-body)',
              }}
            >
              Heritage &amp; Innovation
            </p>
          </div>
        ) : (
          /* Login specific overlay: glassmorphic cream panel */
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              padding: '24px 32px',
              background: 'rgba(252, 249, 242, 0.85)',
              backdropFilter: 'blur(16px)',
              borderTop: '1px solid rgba(45, 41, 38, 0.08)',
            }}
          >
            <h1
              style={{
                color: 'var(--color-primary)',
                fontSize: '28px',
                fontWeight: 700,
                fontFamily: 'var(--font-header)',
                lineHeight: 1.25,
                marginBottom: '6px',
              }}
            >
              Giao thoa giữa lụa và đá
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: 1.6, fontWeight: 500 }}>
              Cùng Silk &amp; Stone viết tiếp câu chuyện di sản trong thời đại mới.
            </p>
          </div>
        )}
      </div>

      {/* Form Content Side */}
      <div className="vh-auth-form-side" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="vh-auth-form-wrapper" style={{ maxWidth: '460px', zIndex: 2 }}>
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
