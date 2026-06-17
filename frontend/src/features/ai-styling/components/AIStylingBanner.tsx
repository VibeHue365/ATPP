import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

export const AIStylingBanner: React.FC = () => {
  return (
    <section id="ai-styling" className="vh-features-section bg-stone-950 py-20 px-6 overflow-hidden relative">
      {/* Decorative Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-amber-500/10 blur-[100px] pointer-events-none" />

      <div className="max-w-[1600px] w-full px-6 md:px-12 mx-auto relative z-10">
        <div className="vh-ai-banner-grid">
          {/* Text Content */}
          <div className="flex flex-col items-start text-white" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', color: 'white' }}>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider mb-6" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '9999px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '24px' }}>
              <Sparkles size={12} />
              <span>Smart Assistant</span>
            </span>
            <h2 className="font-header text-white" style={{ fontSize: '36px', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
              AI Styling Assistant
            </h2>
            <p style={{ color: '#cbd5e1', fontSize: '16px', marginTop: '24px', lineHeight: 1.7, maxWidth: '540px' }}>
              Giải mã phong cách của riêng bạn. Công nghệ AI của chúng tôi sẽ phân tích các chỉ số cơ bản của bạn để đưa ra những gợi ý phối đồ và concept áo dài hoàn hảo nhất với phom dáng và bối cảnh chụp.
            </p>
            <button className="vh-btn vh-btn-secondary vh-btn-lg gap-2 mt-10 font-bold group" style={{ marginTop: '32px' }}>
              <span>THỬ NGAY</span>
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Image Mockup Area */}
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '380px', aspectRatio: '4 / 5', borderRadius: '24px', overflow: 'hidden', border: '1px solid #334155', boxShadow: 'var(--shadow-lg)', backgroundColor: '#1e293b' }}>
              <img
                src="/ai_mockup.png"
                alt="AI Styling Mockup"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15, 23, 42, 0.8), transparent, transparent)' }} />
              {/* Floating Stat Card */}
              <div style={{ position: 'absolute', bottom: '24px', left: '24px', right: '24px', padding: '16px', borderRadius: '16px', backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid #475569', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-md)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Độ chính xác gợi ý</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>98.4% Match</span>
                </div>
                <div style={{ width: '1px', height: '32px', backgroundColor: '#475569' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Mẫu gợi ý tuần này</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>Cúc Họa Mi</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default AIStylingBanner;
