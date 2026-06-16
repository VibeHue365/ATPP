import React from 'react';
import { AoDaiProductGrid } from '../features/rentals/components/AoDaiProductGrid';
import { PhotographerFeaturedList } from '../features/photographers/components/PhotographerFeaturedList';
import { AIStylingBanner } from '../features/ai-styling/components/AIStylingBanner';
import { TestimonialGrid } from '../features/testimonials/components/TestimonialGrid';
import { Sparkles, ArrowRight, Compass, Bookmark, Cpu } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const partners = [
    'VOGUE VIETNAM',
    'HOI AN HERITAGE',
    'SILK VILLAGE',
    'HUE ARTS COUNCIL',
    'VIET FASHION WEEK',
  ];

  return (
    <div className="vh-landing-container" style={{ width: '100%' }}>
      {/* Hero Section */}
      <section className="vh-hero">
        {/* Left Hero Text */}
        <div className="vh-hero-content" style={{ marginLeft: "85px" }}>
          <div className="vh-hero-badge animate-bounce" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={12} className="vh-txt-gold" />
            <span>Khai Phóng Vẻ Đẹp Di Sản</span>
          </div>
          <h1 className="vh-hero-title" style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.15, marginBottom: '24px' }}>
            Kết Nối Di Sản -<br />
            <span className="vh-text-gradient">Lưu Giữ Khoảnh Khắc</span>
          </h1>
          <p className="vh-hero-subtitle" style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginBottom: '40px', lineHeight: 1.7 }}>
            Mỗi bước đi, mỗi khoảnh khắc khoác lên mình tà Áo Dài truyền thống đều mang trong mình một câu chuyện di sản riêng biệt. Silk & Stone kiến tạo hệ sinh thái hoàn chỉnh kết hợp Thuê Áo Dài, Nhiếp Ảnh Gia và Gợi ý thông minh bởi trí tuệ nhân tạo.
          </p>
          <div className="vh-hero-actions" style={{ display: 'flex', gap: '16px' }}>
            <a href="#rentals" className="vh-btn vh-btn-primary vh-btn-lg" style={{ borderRadius: '12px' }}>
              THUÊ ÁO DÀI
            </a>
            <a href="#photographers" className="vh-btn vh-btn-outline vh-btn-lg" style={{ borderRadius: '12px' }}>
              TÌM NHIẾP ẢNH GIA
            </a>
          </div>
        </div>

        {/* Right Hero Image */}
        <div className="vh-hero-visuals">
          {/* Decorative Orbs */}
          <div className="vh-orb vh-orb-1" style={{ filter: 'blur(80px)', opacity: 0.1 }} />
          <div className="vh-orb vh-orb-2" style={{ filter: 'blur(80px)', opacity: 0.1 }} />

          {/* Hero Image Container */}
          <div className="vh-hero-card" style={{ width: '100%', maxWidth: '380px', height: '440px', padding: 0, overflow: 'hidden', border: '1px solid var(--color-light-border)' }}>
            <img
              src="/hero_bg.png"
              alt="Silk & Stone Hero Premium"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Elegant Floating Stat Badge */}
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', padding: '16px', borderRadius: '16px', backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid var(--color-light-border)', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass className="vh-txt-purple" size={20} />
                <span style={{ fontFamily: 'var(--font-header)', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '13px' }}>Hành trình Silk & Stone</span>
              </div>
              <div style={{ height: '1px', backgroundColor: 'var(--color-light-border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                <span><strong>1000+</strong> Mẫu khảo sát</span>
                <span><strong>50+</strong> Nghệ tác ẩm thực</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features Section */}
      <section className="vh-features-section bg-white" style={{ borderTop: '1px solid var(--color-light-border)', backgroundColor: 'white', padding: '80px 24px' }}>
        <div className="max-w-[1600px] w-full px-6 md:px-12 mx-auto">
          {/* Section Header */}
          <div className="vh-section-header" style={{ marginBottom: '56px' }}>
            <span className="vh-section-badge">TÍNH NĂNG CAO CẤP</span>
            <h2 className="text-3xl font-bold font-header text-stone-900 mt-2">Tính năng độc bản tại Silk & Stone</h2>
            <p className="text-stone-500 mt-1">Mang đến trải nghiệm dịch vụ di sản áo dài mượt mà, trực quan và hiện đại</p>
          </div>

          {/* Bento Grid */}
          <div className="vh-bento-grid">
            {/* Box 1: Booking System */}
            <div className="vh-premium-card">
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--color-primary-trans)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: '24px' }}>
                  <Bookmark size={24} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Hệ Thống Đặt Lịch</h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Đặt lịch chụp trực tiếp với các nhiếp ảnh gia chuyên nghiệp hàng đầu, am hiểu tường tận về các concept cổ phục và di sản văn hóa xứ Thần Kinh.
                </p>
              </div>
              <a href="#photographers" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginTop: '32px' }}>
                <span>TÌM HIỂU THÊM</span>
                <ArrowRight size={14} />
              </a>
            </div>

            {/* Box 2: Marketplace for Rentals */}
            <div className="vh-premium-card">
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(182, 145, 91, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-gold)', marginBottom: '24px' }}>
                  <Compass size={24} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Thuê Áo Dài Cao Cấp</h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Khám phá bộ sưu tập hàng ngàn mẫu Áo Dài cao cấp được thiết kế tỉ mỉ bởi các nghệ nhân thêu tay hàng đầu, đa dạng chất liệu từ lụa tơ tằm đến gấm satin.
                </p>
              </div>
              <a href="#rentals" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--color-gold)', textTransform: 'uppercase', marginTop: '32px' }}>
                <span>TÌM HIỂU THÊM</span>
                <ArrowRight size={14} />
              </a>
            </div>

            {/* Box 3: AI Styling Assistant */}
            <div className="vh-premium-card">
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--color-primary-trans)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: '24px' }}>
                  <Cpu size={24} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Gợi Ý AI Thông Minh</h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Trải nghiệm công nghệ AI độc quyền giúp phân tích nhanh các đặc điểm hình thể, đưa ra gợi ý bộ sưu tập phù hợp hoàn hảo với phong cách và địa điểm bạn sẽ ghé thăm.
                </p>
              </div>
              <a href="#ai-styling" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginTop: '32px' }}>
                <span>TÌM HIỂU THÊM</span>
                <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Ao Dai Rentals Grid */}
      <AoDaiProductGrid />

      {/* Featured Photographers List */}
      <PhotographerFeaturedList />

      {/* AI Styling Assistant Section */}
      <AIStylingBanner />

      {/* Testimonials Review Grid */}
      <TestimonialGrid />

      {/* Brand Partners Showcase */}
      <section className="bg-white" style={{ borderTop: '1px solid var(--color-light-border)', padding: '40px 24px' }}>
        <div className="max-w-[1600px] w-full px-6 md:px-12 mx-auto vh-partners-row">
          {partners.map((p, idx) => (
            <span key={idx} className="font-header font-bold text-lg tracking-widest text-stone-950">
              {p}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
};

export default LandingPage;


