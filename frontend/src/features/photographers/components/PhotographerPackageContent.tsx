import React from 'react';
import { Camera, Check, ChevronRight, MapPin, ShieldCheck, Star } from 'lucide-react';
import type { PhotographerDetails, PhotographerPackage } from '../types/photographer.types';
import type { PhotographerReview } from './PhotographerReviews';

interface PhotographerPackageContentProps {
  photographer: PhotographerDetails;
  selectedPackage: PhotographerPackage;
  reviews: PhotographerReview[];
  reviewsLoading: boolean;
  portfolioImages: string[];
  onImageClick: (imageSrc: string) => void;
}

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} phút`;
  return `${hours} giờ${rest ? ` ${rest} phút` : ''}`;
};

export const PhotographerPackageContent: React.FC<PhotographerPackageContentProps> = ({
  photographer,
  selectedPackage,
  reviews,
  reviewsLoading,
  portfolioImages,
  onImageClick,
}) => {
  const duration = selectedPackage.includedDurationMinutes ?? Math.round(selectedPackage.durationHours * 60);
  const location = photographer.address.city || photographer.address.district || 'Khu vực hoạt động';
  const overview = selectedPackage.description?.trim() || photographer.quote?.trim() || 'Gói chụp được thiết kế để bạn có một buổi làm việc nhẹ nhàng, rõ ràng và tập trung vào những khoảnh khắc tự nhiên.';
  const inclusions = [
    `${formatDuration(duration)} chụp liên tục`,
    selectedPackage.editedPhotosCount ? `${selectedPackage.editedPhotosCount} ảnh chỉnh sửa hoàn thiện` : 'Ảnh chỉnh sửa hoàn thiện',
    selectedPackage.rawPhotosCount ? `${selectedPackage.rawPhotosCount} ảnh gốc chọn lọc` : null,
    selectedPackage.deliveryDays ? `Trả ảnh trong ${selectedPackage.deliveryDays} ngày` : null,
    photographer.equipment.length ? 'Tư vấn concept theo thiết bị sẵn có' : null,
    selectedPackage.maxPeople ? `Tối đa ${selectedPackage.maxPeople} người tham gia` : 'Trao đổi trước buổi chụp',
  ].filter((item): item is string => Boolean(item));
  const portfolio = portfolioImages.slice(0, 6);

  return (
    <div className="ppd-content-column">
      <section className="ppd-studio-card">
        <div className="ppd-studio-avatar">{photographer.businessName.charAt(0)}</div>
        <div><strong>{photographer.businessName}</strong><span><ShieldCheck size={14} /> Photographer đã xác minh</span></div>
        <button type="button" onClick={() => document.getElementById('ppd-overview')?.scrollIntoView({ behavior: 'smooth' })}>Xem hồ sơ <ChevronRight size={15} /></button>
      </section>

      <section id="ppd-overview" className="ppd-content-section">
        <span className="ppd-eyebrow">TỔNG QUAN</span>
        <h2>Tổng quan về gói chụp</h2>
        <p className="ppd-lead-copy">{overview}</p>
      </section>

      <section id="ppd-included" className="ppd-content-section">
        <span className="ppd-eyebrow">GÓI BAO GỒM</span>
        <h2>Bạn nhận được gì</h2>
        <div className="ppd-inclusion-grid">
          {inclusions.map((item) => <div className="ppd-inclusion-item" key={item}><Check size={17} /><span>{item}</span></div>)}
        </div>
      </section>

      <section id="ppd-process" className="ppd-content-section">
        <span className="ppd-eyebrow">CÁCH DIỄN RA</span>
        <h2>Một buổi chụp rõ ràng, dễ chuẩn bị</h2>
        <div className="ppd-process-grid">
          {['Chọn ngày và ca phù hợp', 'Chọn địa điểm chụp', 'Trao đổi concept mong muốn', 'Xác nhận lịch và nhận hướng dẫn'].map((step, index) => (
            <div className="ppd-process-item" key={step}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong></div>
          ))}
        </div>
      </section>

      <section id="ppd-location" className="ppd-content-section ppd-location-section">
        <span className="ppd-eyebrow">ĐỊA ĐIỂM</span>
        <h2>Địa điểm chụp</h2>
        <div className="ppd-location-copy"><MapPin size={18} /><div><strong>{location}</strong><p>{selectedPackage.travelFeeNotes || 'Địa điểm cụ thể sẽ được xác nhận cùng photographer sau khi bạn chọn lịch.'}</p></div></div>
      </section>

      <section id="ppd-portfolio" className="ppd-content-section">
        <div className="ppd-section-heading"><div><span className="ppd-eyebrow">PORTFOLIO</span><h2>Những bộ ảnh gần đây</h2></div><Camera size={20} /></div>
        {portfolio.length ? <div className="ppd-portfolio-grid">{portfolio.map((image, index) => <button type="button" key={`${image}-${index}`} onClick={() => onImageClick(image)}><img src={image} alt={`Portfolio ${index + 1}`} /></button>)}</div> : <div className="ppd-empty-state">Portfolio sẽ hiển thị tại đây khi photographer cập nhật hình ảnh.</div>}
      </section>

      <section id="ppd-policies" className="ppd-content-section">
        <span className="ppd-eyebrow">CHÍNH SÁCH</span>
        <h2>Điều bạn nên biết</h2>
        <div className="ppd-policy-grid">
          <div><strong>Đổi lịch</strong><p>{photographer.policies.cancellationPolicy || 'Liên hệ photographer sớm để được hỗ trợ đổi lịch.'}</p></div>
          <div><strong>Thời tiết</strong><p>Với buổi chụp ngoại cảnh, lịch có thể được trao đổi lại khi thời tiết không phù hợp.</p></div>
          <div><strong>Thời lượng</strong><p>Phần tăng giờ và chi phí phát sinh sẽ được báo lại qua quote trước khi xác nhận.</p></div>
        </div>
      </section>

      <section id="ppd-reviews" className="ppd-content-section ppd-review-section">
        <div className="ppd-section-heading"><div><span className="ppd-eyebrow">ĐÁNH GIÁ</span><h2>Khách hàng nói gì?</h2></div><div className="ppd-review-score"><Star size={18} fill="currentColor" /> {photographer.rating.averageRating.toFixed(1)}</div></div>
        {reviewsLoading ? <p className="ppd-inline-note">Đang tải đánh giá…</p> : reviews.length ? <div className="ppd-review-list">{reviews.slice(0, 3).map((review, index) => <blockquote key={review._id || String(index)}><p>“{review.comment || 'Một trải nghiệm rất đáng nhớ.'}”</p><cite>{review.customerId?.profile?.fullName || review.customerId?.fullName || review.customerId?.email || 'Khách hàng đã xác minh'}</cite></blockquote>)}</div> : <div className="ppd-empty-state">Chưa có đánh giá cho gói chụp này.</div>}
      </section>
    </div>
  );
};
