import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Sparkles, Star } from 'lucide-react';
import { ROUTES } from '../config/routes';

export const AuthLayout: React.FC = () => {
  const location = useLocation();
  const isRegister = location.pathname.includes('/register');
  const isLogin = location.pathname.includes('/login');
  const isAuthTabVisible = isLogin || isRegister;

  const slides = [
    {
      img: '/images/hero-silk-stone-v2.webp',
      tag: 'LUMÉ HERITAGE • ÁO DÀI & NHIẾP ẢNH',
      title: 'Tôn vinh nét đẹp Áo dài & Nhiếp ảnh',
      desc: 'Nền tảng kết nối tinh hoa trang phục truyền thống Việt cùng các nhiếp ảnh gia tài năng trên toàn quốc.',
      features: [
        '500+ Mẫu áo dài di sản & cách tân cao cấp',
        'Đặt lịch chụp ảnh cùng studio chuyên nghiệp',
        'Công nghệ Thử đồ 3D chuẩn xác theo vóc dáng'
      ]
    },
    {
      img: '/images/hero-gam-moi-v2.webp',
      tag: 'BỘ SƯU TẬP • GẤM HOÀNG GIA',
      title: 'Gìn giữ tinh hoa tơ lụa truyền thống',
      desc: 'Chất liệu lụa tơ tằm, gấm dệt thủ công được tuyển chọn kỹ lưỡng, mang đậm dấu ấn văn hóa cung đình.',
      features: [
        'Chất liệu tơ lụa & gấm thêu tay tinh xảo',
        'Dịch vụ may đo và tinh chỉnh theo số đo riêng',
        'Bảo chứng chất lượng bởi các nghệ nhân di sản'
      ]
    },
    {
      img: '/images/hero-hue-heritage-v2.webp',
      tag: 'DỊCH VỤ NHIẾP ẢNH • HUẾ HERITAGE',
      title: 'Lưu giữ khoảnh khắc rạng rỡ của bạn',
      desc: 'Hơn 120+ nhiếp ảnh gia phong cách cung đình, cổ phong và đương đại sẵn sàng phục vụ tại các di tích lịch sử.',
      features: [
        'Gói chụp đa dạng từ cá nhân, cặp đôi đến gia đình',
        'Hỗ trợ trang điểm & đạo cụ concept trọn gói',
        'Nhận ảnh chỉnh sửa chất lượng cao trong 48h'
      ]
    }
  ];

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlideIndex((prevIndex) => (prevIndex + 1) % slides.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="lume-auth-page">
      <div className="lume-auth-container">
        
        {/* Left Side: Editorial Visual Showcase */}
        <div className="lume-auth-visual">
          {/* Background Slide Images */}
          {slides.map((slide, idx) => (
            <div
              key={slide.img}
              className="lume-auth-visual-bg"
              style={{
                backgroundImage: `url('${slide.img}')`,
                opacity: idx === currentSlideIndex ? 1 : 0,
                transform: idx === currentSlideIndex ? 'scale(1.03)' : 'scale(1)',
                transition: 'opacity 1.2s ease-in-out, transform 6s ease-out',
              }}
            />
          ))}

          {/* Dark luxury overlay gradient */}
          <div className="lume-auth-visual-overlay" />

          {/* Top Brand Badge & Slide Dots */}
          <div className="lume-auth-visual-top">
            <Link to={ROUTES.LANDING} className="lume-auth-brand-badge text-decoration-none">
              <div className="lume-auth-brand-badge-icon">L</div>
              <div className="flex flex-col">
                <span className="lume-auth-brand-badge-text">LUMÉ</span>
                <span className="text-[8px] tracking-widest text-white/70 font-semibold uppercase">Áo dài & Chụp ảnh</span>
              </div>
            </Link>

            <div className="lume-auth-visual-dots">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Slide ${idx + 1}`}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`lume-auth-visual-dot ${idx === currentSlideIndex ? 'active' : ''}`}
                />
              ))}
            </div>
          </div>

          {/* Bottom Floating Editorial Content Card */}
          <div className="lume-auth-visual-bottom">
            <div className="lume-auth-visual-card">
              <span className="lume-auth-visual-tag">
                {slides[currentSlideIndex].tag}
              </span>
              <h2 className="lume-auth-visual-title">
                {slides[currentSlideIndex].title}
              </h2>
              <p className="lume-auth-visual-desc">
                {slides[currentSlideIndex].desc}
              </p>

              <div className="lume-auth-visual-features">
                {slides[currentSlideIndex].features.map((feat, idx) => (
                  <div key={idx} className="lume-auth-visual-feature-item">
                    <div className="lume-auth-visual-feature-icon">
                      <CheckCircle2 size={11} />
                    </div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust Pill */}
            <div className="flex items-center justify-between px-2 text-white/80 text-xs">
              <div className="flex items-center gap-1.5 font-medium">
                <div className="flex text-amber-400">
                  <Star size={13} fill="currentColor" />
                  <Star size={13} fill="currentColor" />
                  <Star size={13} fill="currentColor" />
                  <Star size={13} fill="currentColor" />
                  <Star size={13} fill="currentColor" />
                </div>
                <span className="text-white font-bold ml-1">4.9/5</span>
                <span>(10.000+ đánh giá)</span>
              </div>
              <div className="flex items-center gap-1 text-white/70">
                <Sparkles size={13} className="text-rose-400" />
                <span>Nền tảng Di sản Việt</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Auth Form Container */}
        <div className="lume-auth-form-side">
          <div className="lume-auth-form-side-inner">
            
            {/* Top Navigation & Mobile Brand */}
            <div className="lume-auth-top-nav">
              <Link to={ROUTES.LANDING} className="lume-auth-back-btn">
                <ArrowLeft size={14} />
                <span>Quay lại trang chủ</span>
              </Link>

              {/* Mobile Brand Logo */}
              <Link to={ROUTES.LANDING} className="lume-auth-mobile-logo text-decoration-none">
                <div className="w-7 h-7 rounded-full bg-[#B52B47] text-white flex items-center justify-center font-bold text-xs">
                  L
                </div>
                <span className="font-header font-black text-sm text-[#292324]">LUMÉ</span>
              </Link>
            </div>

            {/* Quick Switch Tab Bar (Shown on Login / Register) */}
            {isAuthTabVisible && (
              <div className="lume-auth-tab-bar">
                <Link
                  to={ROUTES.LOGIN}
                  className={`lume-auth-tab-item ${isLogin ? 'active' : ''}`}
                >
                  Đăng nhập
                </Link>
                <Link
                  to={ROUTES.REGISTER}
                  className={`lume-auth-tab-item ${isRegister ? 'active' : ''}`}
                >
                  Đăng ký
                </Link>
              </div>
            )}

            {/* Form Viewport */}
            <Outlet />

            {/* Bottom Copyright */}
            <div className="mt-6 pt-4 border-t border-[#E8DEDF]/60 text-center text-[11px] text-[#988B8D]">
              © {new Date().getFullYear()} LUMÉ Heritage. Bảo mật và bản quyền được đảm bảo.
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default AuthLayout;

