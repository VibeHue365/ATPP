import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AIChatBot } from './AIChatBot';
import '../../../pages/LandingPage.css';

export const AIFloatingWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();

  // Hide on internal management dashboards
  const isDashboard =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/provider/dashboard');

  if (isDashboard) {
    return null;
  }

  return (
    <aside
      aria-label="TàGo Stylist AI"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {/* Modern Minimalist Glassmorphism Chat Window */}
      {isOpen ? (
        <div
          className="lume-chat-popup"
          style={{
            width: 'min(385px, calc(100vw - 32px))',
            height: 'min(590px, calc(100vh - 48px))',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            borderRadius: '24px',
            boxShadow:
              '0 24px 70px -12px rgba(28, 25, 23, 0.18), 0 10px 30px -4px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.06)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <AIChatBot onClose={() => setIsOpen(false)} />
        </div>
      ) : (
        /* Luxury Concierge Floating Pill / Orb */
        <div
          className="lume-ai-btn-wrapper"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Subtle Ambient Breathing Halo */}
          <div className="lume-ai-pulse-ring" />

          {/* Minimalist Floating Tooltip Pill */}
          <div
            style={{
              position: 'absolute',
              right: '66px',
              padding: '6px 14px',
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              color: '#1C1917',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              pointerEvents: 'none',
              transition: 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: isHovered ? 1 : 0,
              transform: isHovered ? 'translateX(0)' : 'translateX(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={13} style={{ color: '#B52B47' }} />
            <span>TàGo Stylist AI</span>
          </div>

          {/* Trigger Button - Pearl Glass & Imperial Wine Red Sparkle */}
          <button
            onClick={() => setIsOpen(true)}
            title="TàGo Stylist AI - Tư vấn phong cách Áo Dài"
            aria-label="Mở TàGo Stylist AI"
            className="lume-ai-toggle-btn"
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FFFFFF 0%, #FCFAF7 60%, #F5EFEB 100%)',
              border: '1.5px solid rgba(181, 43, 71, 0.28)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow:
                '0 10px 28px rgba(181, 43, 71, 0.16), 0 3px 10px rgba(0, 0, 0, 0.06), inset 0 1px 2px #FFFFFF',
              color: '#B52B47',
              position: 'relative',
            }}
          >
            <Sparkles size={23} className="lume-ai-sparkle-icon" style={{ color: '#B52B47' }} />
          </button>
        </div>
      )}
    </aside>
  );
};

export default AIFloatingWidget;
