import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  Heart, 
  Sparkles, 
  PartyPopper,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { ROUTES } from '../config/routes';
import './OnboardingPage.css';

// Import images
import traditionalImg from '../assets/images/onboarding_traditional.png';
import modernImg from '../assets/images/onboarding_modern.png';
import edgyImg from '../assets/images/onboarding_edgy.png';

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
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [step1, setStep1] = useState<Step1Data>({ style: 'traditional' });
  const [step2, setStep2] = useState<Step2Data>({
    colorTone: 'red_gold',
    size: 'M',
    height: '160',
    weight: '50',
    chest: '85',
    waist: '64',
    hips: '90',
  });
  const [step3, setStep3] = useState<Step3Data>({
    purpose: 'wedding',
    aiAssistant: false,
  });

  const handleNext = () => {
    if (step < 3) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3);
    } else {
      navigate(ROUTES.RENTALS);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

  const handleSkip = () => {
    navigate(ROUTES.RENTALS);
  };

  return (
    <div className="onboarding-wrapper">
      <div className="onboarding-card animate-panel-fade">
        
        {/* Subtle Traditional Motif Watermark */}
        <div className="onboarding-watermark">
          <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full">
            <path d="M50 0 L60 40 L100 50 L60 60 L50 100 L40 60 L0 50 L40 40 Z" />
            <circle cx="50" cy="50" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        {/* Content Area */}
        <div>
          {/* Top Header */}
          <div className="onboarding-header">
            <h1 className="onboarding-brand">
              Silk & Stone
            </h1>
            <span className="onboarding-step-text">
              BƯỚC {step} / 3
            </span>
          </div>

          {/* Progress Bar */}
          <div className="onboarding-progress-container">
            <div className="onboarding-progress-bg" />
            <div 
              className="onboarding-progress-fill" 
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            />

            {[1, 2, 3].map((s) => (
              <button
                key={s}
                onClick={() => setStep(s as 1 | 2 | 3)}
                className={`onboarding-dot ${
                  s === step ? 'active' : s < step ? 'completed' : ''
                }`}
              />
            ))}
          </div>

          {/* Step Contents */}
          <div className="onboarding-step-content">
            {step === 1 && (
              <div>
                <h2 className="onboarding-title">
                  Chọn trường phái Áo Dài yêu thích
                </h2>

                <div className="onboarding-style-grid">
                  {/* Option 1: Truyền Thống */}
                  <div 
                    onClick={() => setStep1({ style: 'traditional' })}
                    className={`onboarding-style-card ${
                      step1.style === 'traditional' ? 'selected' : ''
                    }`}
                  >
                    <div className="onboarding-card-img-wrapper">
                      <img 
                        src={traditionalImg} 
                        alt="Truyền Thống" 
                        className="onboarding-card-img"
                      />
                    </div>
                    <div className="onboarding-card-label">
                      Truyền Thống
                    </div>
                  </div>

                  {/* Option 2: Cách Tân */}
                  <div 
                    onClick={() => setStep1({ style: 'modern' })}
                    className={`onboarding-style-card ${
                      step1.style === 'modern' ? 'selected' : ''
                    }`}
                  >
                    <div className="onboarding-card-img-wrapper">
                      <img 
                        src={modernImg} 
                        alt="Cách Tân" 
                        className="onboarding-card-img"
                      />
                    </div>
                    <div className="onboarding-card-label">
                      Cách Tân
                    </div>
                  </div>

                  {/* Option 3: Phá Cách */}
                  <div 
                    onClick={() => setStep1({ style: 'edgy' })}
                    className={`onboarding-style-card ${
                      step1.style === 'edgy' ? 'selected' : ''
                    }`}
                  >
                    <div className="onboarding-card-img-wrapper">
                      <img 
                        src={edgyImg} 
                        alt="Phá Cách" 
                        className="onboarding-card-img"
                      />
                    </div>
                    <div className="onboarding-card-label">
                      Phá Cách
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="onboarding-title">
                  Chọn tone màu sắc ưa thích
                </h2>

                {/* Colors Grid */}
                <div className="onboarding-color-grid">
                  {/* Pastel */}
                  <div
                    onClick={() => setStep2(prev => ({ ...prev, colorTone: 'pastel' }))}
                    className={`onboarding-color-card ${
                      step2.colorTone === 'pastel' ? 'selected' : ''
                    }`}
                  >
                    <div className="onboarding-color-swatch" style={{ backgroundColor: '#FCE7F3' }} />
                    <span className="onboarding-color-label">Pastel nhẹ nhàng</span>
                  </div>

                  {/* Red/Gold */}
                  <div
                    onClick={() => setStep2(prev => ({ ...prev, colorTone: 'red_gold' }))}
                    className={`onboarding-color-card ${
                      step2.colorTone === 'red_gold' ? 'selected' : ''
                    }`}
                  >
                    <div className="onboarding-color-swatch" style={{ backgroundColor: '#DC2626' }} />
                    <span className="onboarding-color-label">Đỏ/Vàng lễ hội</span>
                  </div>

                  {/* Dark/Elegant */}
                  <div
                    onClick={() => setStep2(prev => ({ ...prev, colorTone: 'dark' }))}
                    className={`onboarding-color-card ${
                      step2.colorTone === 'dark' ? 'selected' : ''
                    }`}
                  >
                    <div className="onboarding-color-swatch" style={{ backgroundColor: '#1F2937' }} />
                    <span className="onboarding-color-label">Tone trầm sang trọng</span>
                  </div>

                  {/* Colorful/Gradient */}
                  <div
                    onClick={() => setStep2(prev => ({ ...prev, colorTone: 'colorful' }))}
                    className={`onboarding-color-card ${
                      step2.colorTone === 'colorful' ? 'selected' : ''
                    }`}
                  >
                    <div 
                      className="onboarding-color-swatch" 
                      style={{ background: 'linear-gradient(135deg, #10B981 0%, #F59E0B 100%)' }} 
                    />
                    <span className="onboarding-color-label">Hoa văn sặc sỡ</span>
                  </div>
                </div>

                <h3 className="onboarding-subtitle">
                  Kích thước & Số đo
                </h3>
                
                <span className="onboarding-section-label">
                  Size tiêu chuẩn
                </span>

                {/* Standard Sizes */}
                <div className="onboarding-size-row">
                  {(['S', 'M', 'L', 'XL'] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setStep2(prev => ({ ...prev, size: sz }))}
                      className={`onboarding-size-btn ${
                        step2.size === sz ? 'selected' : ''
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>

                {/* Direct Body Measurements */}
                <div className="onboarding-measure-grid">
                  <div className="onboarding-measure-item">
                    <label className="onboarding-measure-label">
                      Chiều cao (cm)
                    </label>
                    <input 
                      type="number"
                      value={step2.height}
                      onChange={(e) => setStep2(prev => ({ ...prev, height: e.target.value }))}
                      className="onboarding-measure-input"
                    />
                  </div>
                  <div className="onboarding-measure-item">
                    <label className="onboarding-measure-label">
                      Cân nặng (kg)
                    </label>
                    <input 
                      type="number"
                      value={step2.weight}
                      onChange={(e) => setStep2(prev => ({ ...prev, weight: e.target.value }))}
                      className="onboarding-measure-input"
                    />
                  </div>
                  <div className="onboarding-measure-item">
                    <label className="onboarding-measure-label">
                      Ngực
                    </label>
                    <input 
                      type="number"
                      value={step2.chest}
                      onChange={(e) => setStep2(prev => ({ ...prev, chest: e.target.value }))}
                      className="onboarding-measure-input"
                    />
                  </div>
                  <div className="onboarding-measure-item">
                    <label className="onboarding-measure-label">
                      Eo
                    </label>
                    <input 
                      type="number"
                      value={step2.waist}
                      onChange={(e) => setStep2(prev => ({ ...prev, waist: e.target.value }))}
                      className="onboarding-measure-input"
                    />
                  </div>
                  <div className="onboarding-measure-item">
                    <label className="onboarding-measure-label">
                      Mông
                    </label>
                    <input 
                      type="number"
                      value={step2.hips}
                      onChange={(e) => setStep2(prev => ({ ...prev, hips: e.target.value }))}
                      className="onboarding-measure-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="onboarding-title">
                  Mục đích thuê & Cá nhân hóa
                </h2>

                {/* Purpose Selection */}
                <div className="onboarding-purpose-grid">
                  {/* Graduation */}
                  <div
                    onClick={() => setStep3(prev => ({ ...prev, purpose: 'graduation' }))}
                    className={`onboarding-purpose-card ${
                      step3.purpose === 'graduation' ? 'selected' : ''
                    }`}
                  >
                    <div className="onboarding-purpose-icon">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <span className="onboarding-purpose-name">Chụp ảnh kỷ yếu</span>
                  </div>

                  {/* Wedding */}
                  <div
                    onClick={() => setStep3(prev => ({ ...prev, purpose: 'wedding' }))}
                    className={`onboarding-purpose-card ${
                      step3.purpose === 'wedding' ? 'selected' : ''
                    }`}
                  >
                    <div className="onboarding-purpose-icon">
                      <Heart className="w-5 h-5" />
                    </div>
                    <span className="onboarding-purpose-name">Dự đám cưới</span>
                  </div>

                  {/* Festival */}
                  <div
                    onClick={() => setStep3(prev => ({ ...prev, purpose: 'festival' }))}
                    className={`onboarding-purpose-card ${
                      step3.purpose === 'festival' ? 'selected' : ''
                    }`}
                  >
                    <div className="onboarding-purpose-icon">
                      <PartyPopper className="w-5 h-5" />
                    </div>
                    <span className="onboarding-purpose-name">Lễ hội truyền thống</span>
                  </div>

                  {/* Event */}
                  <div
                    onClick={() => setStep3(prev => ({ ...prev, purpose: 'event' }))}
                    className={`onboarding-purpose-card ${
                      step3.purpose === 'event' ? 'selected' : ''
                    }`}
                  >
                    <div className="onboarding-purpose-icon">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <span className="onboarding-purpose-name">Biểu diễn/Sự kiện</span>
                  </div>
                </div>

                {/* AI Assistant Toggle Panel */}
                <div className="onboarding-ai-panel">
                  <label className="onboarding-switch">
                    <input 
                      type="checkbox"
                      checked={step3.aiAssistant}
                      onChange={() => setStep3(prev => ({ ...prev, aiAssistant: !prev.aiAssistant }))}
                    />
                    <span className="onboarding-slider" />
                  </label>
                  <div>
                    <h4 className="onboarding-ai-title">
                      Trợ lý AI gợi ý phong cách riêng
                    </h4>
                    <p className="onboarding-ai-desc">
                      Sử dụng trí tuệ nhân tạo để phân tích sở thích và vóc dáng, giúp bạn tìm ra bộ Áo Dài hoàn hảo nhất trong 5 giây.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="onboarding-footer">
          <div>
            {step > 1 ? (
              <button 
                onClick={handleBack}
                className="onboarding-btn-back"
              >
                <ArrowLeft className="w-4.5 h-4.5" />
                Trở lại
              </button>
            ) : (
              <div /> // Empty placeholder to align skip/continue to the right
            )}
          </div>

          <div className="onboarding-right-actions">
            <button 
              onClick={handleSkip}
              className="onboarding-btn-skip"
            >
              Bỏ qua
            </button>

            <button 
              onClick={handleNext}
              className="onboarding-btn-next"
            >
              {step === 3 ? 'Hoàn tất' : 'Tiếp tục'}
              <ArrowRight className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OnboardingPage;
