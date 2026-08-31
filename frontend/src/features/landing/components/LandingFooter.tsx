import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../config/routes';

export const LandingFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer 
      className="lume-footer w-full text-white mt-14"
      style={{
        backgroundColor: 'var(--landing-primary)',
      }}
    >
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-16">
        {/* Main Footer Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
          
          {/* Brand Column (~40%) */}
          <div className="md:col-span-5 flex flex-col gap-3">
            <Link 
              to="/" 
              aria-label="LUMÉ - Áo dài & Chụp ảnh"
              className="flex items-center gap-3 text-decoration-none group self-start"
            >
              <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center font-serif font-black text-lg text-white shadow-sm transition-transform group-hover:scale-105">
                L
              </div>
              <div className="flex flex-col">
                <span className="font-header font-black text-lg tracking-tight leading-none text-white">
                  LUMÉ
                </span>
                <span className="text-[9px] font-bold tracking-widest uppercase mt-0.5 text-stone-200">
                  ÁO DÀI & CHỤP ẢNH
                </span>
              </div>
            </Link>

            <p className="text-xs md:text-sm text-stone-200 leading-relaxed max-w-sm mt-1">
              Trải nghiệm văn hóa Áo Dài và đặt lịch chụp ảnh nghệ thuật chuyên nghiệp với quy trình tinh gọn, minh bạch trong một nền tảng.
            </p>
          </div>

          {/* Navigation Column 1: DỊCH VỤ (~25%) */}
          <div className="md:col-span-3 flex flex-col gap-3">
            <span className="font-header font-bold text-xs uppercase tracking-wider text-stone-200">
              Dịch vụ
            </span>
            <ul className="flex flex-col gap-2 p-0 m-0 list-none text-xs md:text-sm">
              <li>
                <Link 
                  to={ROUTES.RENTALS} 
                  className="text-stone-100 hover:text-white transition-colors text-decoration-none"
                >
                  Thuê Áo dài
                </Link>
              </li>
              <li>
                <Link 
                  to={ROUTES.PHOTOGRAPHERS} 
                  className="text-stone-100 hover:text-white transition-colors text-decoration-none"
                >
                  Chụp ảnh nghệ thuật
                </Link>
              </li>
              <li>
                <Link 
                  to={ROUTES.COMBOS} 
                  className="text-stone-100 hover:text-white transition-colors text-decoration-none"
                >
                  Combo trọn gói
                </Link>
              </li>
            </ul>
          </div>

          {/* Navigation Column 2: KHÁM PHÁ & HỖ TRỢ (~20%) */}
          <div className="md:col-span-2 flex flex-col gap-3">
            <span className="font-header font-bold text-xs uppercase tracking-wider text-stone-200">
              Khám phá
            </span>
            <ul className="flex flex-col gap-2 p-0 m-0 list-none text-xs md:text-sm">
              <li>
                <button 
                  type="button"
                  onClick={() => scrollToSection('service-finder')}
                  className="text-stone-100 hover:text-white transition-colors text-left bg-transparent border-none p-0 cursor-pointer text-xs md:text-sm font-normal"
                >
                  Bộ lọc tìm kiếm
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={() => scrollToSection('locations')}
                  className="text-stone-100 hover:text-white transition-colors text-left bg-transparent border-none p-0 cursor-pointer text-xs md:text-sm font-normal"
                >
                  Địa điểm yêu thích
                </button>
              </li>
            </ul>
          </div>

          {/* Navigation Column 3: TÀI KHOẢN (~15%) */}
          <div className="md:col-span-2 flex flex-col gap-3">
            <span className="font-header font-bold text-xs uppercase tracking-wider text-stone-200">
              Tài khoản
            </span>
            <ul className="flex flex-col gap-2 p-0 m-0 list-none text-xs md:text-sm">
              <li>
                <Link 
                  to={ROUTES.LOGIN} 
                  className="text-stone-100 hover:text-white transition-colors text-decoration-none"
                >
                  Đăng nhập
                </Link>
              </li>
              <li>
                <Link 
                  to={ROUTES.CART} 
                  className="text-stone-100 hover:text-white transition-colors text-decoration-none"
                >
                  Giỏ hàng
                </Link>
              </li>
              <li>
                <Link 
                  to={ROUTES.NOTIFICATIONS} 
                  className="text-stone-100 hover:text-white transition-colors text-decoration-none"
                >
                  Thông báo
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar Divider */}
        <div className="mt-12 pt-6 border-t border-white/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-300">
          <div>
            © {currentYear} LUMÉ. Tất cả quyền được bảo lưu.
          </div>
          <div className="flex items-center gap-6">
            <span className="text-stone-300">Trải nghiệm di sản Việt</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
