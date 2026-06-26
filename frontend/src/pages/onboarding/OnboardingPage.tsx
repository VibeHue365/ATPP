import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  Heart, 
  Sparkles, 
  PartyPopper,
  ArrowRight,
  ArrowLeft,
  Info
} from 'lucide-react';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { calculateRecommendedSize } from '../../utils/sizeHelper';

// Import images
import traditionalImg from '../../assets/images/onboarding_traditional.png';
import modernImg from '../../assets/images/onboarding_modern.png';
import edgyImg from '../../assets/images/onboarding_edgy.png';

interface Step1Data {
  style: 'traditional' | 'modern' | 'edgy' | null;
}

interface Step2Data {
  colorTone: 'pastel' | 'red_gold' | 'dark' | 'colorful' | null;
  size: 'S' | 'M' | 'L' | 'XL' | null;
  height: string;
  weight: string;
  chest: string;
  waist: string;
  hips: string;
}

interface Step3Data {
  purpose: 'graduation' | 'wedding' | 'festival' | 'event' | null;
  aiAssistant: boolean;
}

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { updatePreferences } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [step1, setStep1] = useState<Step1Data>({ style: 'traditional' });
  const [step2, setStep2] = useState<Step2Data>({
    colorTone: 'red_gold', size: 'M', height: '160', weight: '50', chest: '', waist: '', hips: '',
  });
  const [step3, setStep3] = useState<Step3Data>({ purpose: 'wedding', aiAssistant: false });

  const [submitting, setSubmitting] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const savePreferences = async (isSkipped = false) => {
    setSubmitting(true);
    try {
      const payload = {
        hasCompletedOnboarding: true,
        preferences: isSkipped ? {} : {
          stylePreferences: step3.purpose ? [step3.purpose.toUpperCase()] : [],
          favoriteColors: step2.colorTone ? [step2.colorTone.toUpperCase()] : [],
          preferredAoDaiStyles: step1.style ? [step1.style.toUpperCase()] : [],
          sizeInfo: {
            preferredSize: step2.size || null,
            height: step2.height ? Number(step2.height) : null,
            weight: step2.weight ? Number(step2.weight) : null,
            chest: step2.chest ? Number(step2.chest) : null,
            waist: step2.waist ? Number(step2.waist) : null,
            hips: step2.hips ? Number(step2.hips) : null,
          },
          preferredLocations: []
        }
      };

      await updatePreferences(payload);
    } catch (err) {
      console.error('Failed to save onboarding preferences:', err);
    } finally {
      setSubmitting(false);
      navigate(ROUTES.RENTALS);
    }
  };

  const handleNext = () => {
    if (step < 3) {
      setStep((p) => (p + 1) as 1|2|3);
    } else {
      savePreferences(false);
    }
  };

  const handleBack = () => { if (step > 1) setStep((p) => (p - 1) as 1|2|3); };
  const handleSkip = () => { savePreferences(true); };

  const selectedCardStyle = (isSelected: boolean): React.CSSProperties => ({
    border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-light-border)',
    backgroundColor: isSelected ? 'var(--color-light-bg)' : 'white',
    boxShadow: isSelected ? '0 8px 24px rgba(161,30,34,0.08)' : 'var(--shadow-sm)',
  });

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-light-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: 'var(--font-body)',
      boxSizing: 'border-box',
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '880px',
        backgroundColor: 'white',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-light-border)',
        boxShadow: 'var(--shadow-lg)',
        padding: '48px',
        minHeight: '620px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'visible',
      }}>
        
        {/* Watermark */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '220px', height: '220px', opacity: 0.08, pointerEvents: 'none', color: 'var(--color-primary)' }}>
          <svg viewBox="0 0 100 100" fill="currentColor" style={{ width: '100%', height: '100%' }}>
            <path d="M50 0 L60 40 L100 50 L60 60 L50 100 L40 60 L0 50 L40 40 Z" />
            <circle cx="50" cy="50" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontFamily: 'var(--font-header)', fontSize: '28px', fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>Silk & Stone</h1>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>BƯỚC {step} / 3</span>
          </div>

          {/* Progress Bar */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', padding: '0 4px' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '2px', backgroundColor: 'var(--color-light-border)', transform: 'translateY(-50%)', zIndex: 1 }} />
            <div style={{ position: 'absolute', left: 0, top: '50%', height: '2px', backgroundColor: 'var(--color-primary)', transform: 'translateY(-50%)', transition: 'width 0.3s ease', zIndex: 1, width: `${((step - 1) / 2) * 100}%` }} />
            {[1, 2, 3].map((s) => {
              const isActive = s === step;
              const isCompleted = s < step;
              return (
                <button key={s} onClick={() => setStep(s as 1|2|3)} style={{
                  position: 'relative', width: '14px', height: '14px', borderRadius: '50%', cursor: 'pointer', zIndex: 2,
                  backgroundColor: isActive || isCompleted ? 'var(--color-primary)' : 'var(--color-light-border)',
                  border: isActive || isCompleted ? '2px solid var(--color-primary)' : '2px solid white',
                  boxShadow: isActive ? '0 0 0 3px rgba(161,30,34,0.15)' : 'none',
                  padding: 0, transition: 'all 0.3s ease',
                }}>
                  {isCompleted && <span style={{ position: 'absolute', top: '3px', left: '3px', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'white' }} />}
                </button>
              );
            })}
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 32px 0' }}>Chọn trường phái Áo Dài yêu thích</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                {[
                  { key: 'traditional', img: traditionalImg, label: 'Truyền Thống' },
                  { key: 'modern', img: modernImg, label: 'Cách Tân' },
                  { key: 'edgy', img: edgyImg, label: 'Phá Cách' },
                ].map((item) => (
                  <div key={item.key} onClick={() => setStep1({ style: item.key as any })} style={{
                    cursor: 'pointer', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    transition: 'var(--transition-smooth)', ...selectedCardStyle(step1.style === item.key),
                  }}>
                    <div style={{ height: '260px', overflow: 'hidden', backgroundColor: 'var(--color-light-bg)' }}>
                      <img src={item.img} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} />
                    </div>
                    <div style={{ padding: '16px 12px', textAlign: 'center', fontWeight: 700, fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-primary)', borderTop: '1px solid var(--color-light-border)' }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 32px 0' }}>Chọn tone màu sắc ưa thích</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '40px' }}>
                {[
                  { key: 'pastel', color: '#FCE7F3', label: 'Pastel nhẹ nhàng', tooltip: 'Bao gồm: Trắng, Hồng, Vàng/Kem' },
                  { key: 'red_gold', color: '#DC2626', label: 'Đỏ/Vàng lễ hội', tooltip: 'Bao gồm: Đỏ, Vàng/Kem, Vàng' },
                  { key: 'dark', color: '#1F2937', label: 'Tone trầm sang trọng', tooltip: 'Bao gồm: Đen, Xám, Nâu, Xanh dương' },
                  { key: 'colorful', color: 'linear-gradient(135deg, #10B981 0%, #F59E0B 100%)', label: 'Hoa văn sặc sỡ', tooltip: 'Bao gồm: Vàng, Xanh lá, Hồng, Xanh dương, Đỏ' },
                ].map((c) => (
                  <div key={c.key} onClick={() => setStep2(p => ({ ...p, colorTone: c.key as any }))} style={{
                    cursor: 'pointer', padding: '18px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                    transition: 'var(--transition-smooth)', position: 'relative', ...selectedCardStyle(step2.colorTone === c.key),
                  }}>
                    {/* Info Icon with detailed color list tooltip */}
                    <div 
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: activeTooltip === c.key ? 1 : 0.6,
                        transition: 'opacity 0.2s',
                        zIndex: 5,
                      }}
                      onMouseEnter={() => setActiveTooltip(c.key)}
                      onMouseLeave={() => setActiveTooltip(null)}
                    >
                      <Info size={14} />

                      {/* Custom Tooltip Card */}
                      {activeTooltip === c.key && (
                        <div style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 8px)',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          backgroundColor: '#1E293B',
                          color: '#F8FAFC',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 500,
                          lineHeight: '1.4',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
                          zIndex: 100,
                          pointerEvents: 'none',
                          border: '1px solid #334155',
                        }}>
                          {c.tooltip}
                          {/* Triangle arrow pointing down */}
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            borderWidth: '5px',
                            borderStyle: 'solid',
                            borderColor: '#1E293B transparent transparent transparent',
                          }} />
                        </div>
                      )}
                    </div>

                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', marginBottom: '10px', border: '1px solid var(--color-light-border)', background: c.color }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.label}</span>
                  </div>
                ))}
              </div>

              <h3 style={{ fontFamily: 'var(--font-header)', fontSize: '24px', fontWeight: 700, margin: '32px 0 16px 0' }}>Kích thước & Số đo</h3>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '12px' }}>Size tiêu chuẩn</span>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                {(['S', 'M', 'L', 'XL'] as const).map((sz) => (
                  <button key={sz} onClick={() => setStep2(p => ({ ...p, size: sz }))} style={{
                    width: '48px', height: '40px', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', transition: 'var(--transition-smooth)',
                    border: step2.size === sz ? '2px solid var(--color-primary)' : '1px solid var(--color-light-border)',
                    backgroundColor: step2.size === sz ? 'var(--color-light-bg)' : 'white',
                    color: step2.size === sz ? 'var(--color-primary)' : 'var(--color-text-primary)',
                  }}>{sz}</button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', borderTop: '1px solid var(--color-light-border)', paddingTop: '24px' }}>
                {[
                  { label: 'Chiều cao (cm)', key: 'height' as const },
                  { label: 'Cân nặng (kg)', key: 'weight' as const },
                  { label: 'Ngực (tự chọn)', key: 'chest' as const },
                  { label: 'Eo (tự chọn)', key: 'waist' as const },
                  { label: 'Mông (tự chọn)', key: 'hips' as const },
                ].map((m) => (
                  <div key={m.key} style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{m.label}</label>
                    <input type="number" value={step2[m.key]} onChange={(e) => setStep2(p => ({ ...p, [m.key]: e.target.value }))}
                      placeholder={m.key === 'chest' || m.key === 'waist' || m.key === 'hips' ? '--' : ''}
                      style={{ width: '100%', textAlign: 'center', border: 'none', borderBottom: '1px solid var(--color-light-border)', padding: '6px 0', fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', background: 'transparent', outline: 'none' }} />
                  </div>
                ))}
              </div>

              {(() => {
                const recommended = calculateRecommendedSize(step2.height, step2.weight);
                if (!recommended) return null;
                const isMismatch = step2.size && step2.size !== recommended;
                return (
                  <div style={{ 
                    marginTop: '24px', 
                    padding: '12px 16px', 
                    borderRadius: '6px', 
                    fontSize: '13px', 
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: isMismatch ? '#FFF3CD' : '#D1E7DD',
                    color: isMismatch ? '#664D03' : '#0F5132',
                    border: isMismatch ? '1px solid #FFE69C' : '1px solid #BADBCC'
                  }}>
                    {isMismatch ? (
                      <span>⚠️ Kích thước cơ thể có vẻ phù hợp với size <strong>{recommended}</strong>. Vui lòng kiểm tra lại chiều cao/cân nặng hoặc chọn size tương ứng.</span>
                    ) : (
                      <span>✓ Kích thước và size đã chọn phù hợp với vóc dáng của bạn.</span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '32px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 32px 0' }}>Mục đích thuê & Cá nhân hóa</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px' }}>
                {[
                  { key: 'graduation', icon: <GraduationCap size={20} />, label: 'Chụp ảnh kỷ yếu' },
                  { key: 'wedding', icon: <Heart size={20} />, label: 'Dự đám cưới' },
                  { key: 'festival', icon: <PartyPopper size={20} />, label: 'Lễ hội truyền thống' },
                  { key: 'event', icon: <Sparkles size={20} />, label: 'Biểu diễn/Sự kiện' },
                ].map((p) => (
                  <div key={p.key} onClick={() => setStep3(prev => ({ ...prev, purpose: p.key as any }))} style={{
                    cursor: 'pointer', padding: '20px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '16px',
                    transition: 'var(--transition-smooth)', ...selectedCardStyle(step3.purpose === p.key),
                  }}>
                    <div style={{ padding: '10px', backgroundColor: 'var(--color-light-bg)', color: 'var(--color-primary)', borderRadius: '8px', border: '1px solid var(--color-light-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.icon}</div>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '14px' }}>{p.label}</span>
                  </div>
                ))}
              </div>

              {/* AI Toggle */}
              <div style={{ backgroundColor: 'var(--color-light-bg)', borderLeft: '4px solid var(--color-primary)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', padding: '24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div onClick={() => setStep3(p => ({ ...p, aiAssistant: !p.aiAssistant }))} style={{
                  width: '44px', height: '24px', borderRadius: '24px', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background-color 0.3s ease',
                  backgroundColor: step3.aiAssistant ? 'var(--color-primary)' : 'var(--color-light-border)',
                }}>
                  <div style={{
                    position: 'absolute', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white', top: '3px', transition: 'left 0.3s ease', boxShadow: 'var(--shadow-sm)',
                    left: step3.aiAssistant ? '23px' : '3px',
                  }} />
                </div>
                <div>
                  <h4 style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '14px', margin: '0 0 4px 0' }}>Trợ lý AI gợi ý phong cách riêng</h4>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>Sử dụng trí tuệ nhân tạo để phân tích sở thích và vóc dáng, giúp bạn tìm ra bộ Áo Dài hoàn hảo nhất trong 5 giây.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-light-border)', paddingTop: '32px', marginTop: 'auto' }}>
          <div>
            {step > 1 && (
              <button onClick={handleBack} style={{
                padding: '10px 24px', border: '1px solid var(--color-text-secondary)', background: 'transparent', color: 'var(--color-text-primary)',
                fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', transition: 'var(--transition-smooth)',
              }}>
                <ArrowLeft size={16} /> Trở lại
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button onClick={handleSkip} disabled={submitting} style={{
              background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', fontWeight: 700, fontSize: '12px',
              textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}>Bỏ qua</button>
            <button onClick={handleNext} disabled={submitting} style={{
              padding: '12px 28px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', fontWeight: 700, fontSize: '12px',
              textTransform: 'uppercase', letterSpacing: '0.1em', borderRadius: '4px', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(161,30,34,0.15)', display: 'flex', alignItems: 'center', gap: '8px', transition: 'var(--transition-smooth)',
              opacity: submitting ? 0.8 : 1,
            }}>
              {step === 3 ? (submitting ? 'Đang lưu...' : 'Hoàn tất') : 'Tiếp tục'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
