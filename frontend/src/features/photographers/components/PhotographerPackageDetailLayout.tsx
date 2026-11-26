import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  Clock3,
  Heart,
  LayoutGrid,
  MapPin,
  Share2,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { PhotographerPackage } from '../types/photographer.types';
import type { PhotographerPackageDetailLayoutProps } from '../types/photographer-package-detail.types';
import { PhotographerPackageBookingCard } from './PhotographerPackageBookingCard';
import { PhotographerPackageContent } from './PhotographerPackageContent';
import { PhotographyMultiSessionDialog } from './PhotographyMultiSessionDialog';

const formatPrice = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} phút`;
  return `${hours} giờ${rest ? ` ${rest} phút` : ''}`;
};

const PackageHighlights: React.FC<{ selectedPackage: PhotographerPackage; photographerCity: string }> = ({ selectedPackage, photographerCity }) => {
  const duration = selectedPackage.includedDurationMinutes ?? Math.round(selectedPackage.durationHours * 60);
  const items = [
    { icon: Clock3, value: formatDuration(duration), label: 'Thời lượng gói cơ bản' },
    { icon: Camera, value: selectedPackage.editedPhotosCount ? `${selectedPackage.editedPhotosCount} ảnh` : 'Ảnh chỉnh sửa', label: 'Ảnh chỉnh sửa hoàn thiện' },
    { icon: UsersRound, value: selectedPackage.maxPeople ? `${selectedPackage.maxPeople} người` : 'Theo gói', label: 'Số người phù hợp' },
    { icon: Sparkles, value: selectedPackage.deliveryDays ? `${selectedPackage.deliveryDays} ngày` : 'Theo thỏa thuận', label: 'Thời gian trả ảnh dự kiến' },
    { icon: MapPin, value: photographerCity || 'Linh hoạt', label: 'Khu vực chụp chính' },
  ];

  return <section className="ppd-highlights" aria-label="Điểm nổi bật của gói chụp">{items.map(({ icon: Icon, value, label }) => <div className="ppd-highlight" key={label}><Icon size={18} /><strong>{value}</strong><span>{label}</span></div>)}</section>;
};

const RelatedPackages: React.FC<{ packages: PhotographerPackage[]; selectedPackageId: string; onSelectPackage: (pkg: PhotographerPackage) => void }> = ({ packages, selectedPackageId, onSelectPackage }) => {
  const related = packages.filter((pkg) => pkg._id !== selectedPackageId).slice(0, 4);
  if (!related.length) return null;
  return <section className="ppd-related"><div className="ppd-section-heading"><div><span className="ppd-eyebrow">GỢI Ý CHO BẠN</span><h2>Gói chụp tương tự</h2></div><span className="ppd-related-count">{related.length} lựa chọn</span></div><div className="ppd-related-grid">{related.map((pkg) => <button type="button" className="ppd-related-card" key={pkg._id} onClick={() => onSelectPackage(pkg)}><div className="ppd-related-card__image">{pkg.images?.[0] ? <img src={pkg.images[0]} alt="" /> : <Camera size={24} />}</div><div><strong>{pkg.name}</strong><span>{formatPrice(pkg.price)} · {formatDuration(pkg.includedDurationMinutes ?? Math.round(pkg.durationHours * 60))}</span><em>Xem gói <ArrowRight size={14} /></em></div></button>)}</div></section>;
};

export const PhotographerPackageDetailLayout: React.FC<PhotographerPackageDetailLayoutProps> = (props) => {
  const {
    photographer,
    packages,
    selectedPackage,
    selectedDate,
    startTime,
    endTime,
    selectedTimeSlot,
    quote,
    quoteError,
    isQuoteLoading,
    selectedLocation,
    locationError,
    agreeTerms,
    isBusy,
    isBooking,
    canAddToCart,
    reviews,
    reviewsLoading,
    calendarDate,
    calendarDays,
    isCalendarLoading,
    slots,
    isSlotBusy,
    includedDurationMinutes,
    overtimeIncrementMinutes,
    maxOvertimeMinutes,
    durationMinutes,
    canIncreaseDuration,
    isNextDurationQuoteLoading,
    increaseUnavailableReason,
    onToggleFavorite,
    onSelectPackage,
    onPreviousMonth,
    onNextMonth,
    onPreviewDate,
    onPreviewDuration,
    onConfirmSchedule,
    onCancelSchedule,
    onDecreaseDuration,
    onIncreaseDuration,
    onLocationChange,
    onAgreeTermsChange,
    onBookNow,
    onAddToCart,
    onImageClick,
    lightbox,
    bookingMode,
    multiSessions,
    onStartMultiSession,
    onBackToSingle,
    onAddSession,
    onGenerateRange,
    onUpdateSession,
    onRemoveSession,
  } = props;
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [shareLabel, setShareLabel] = useState('Chia sẻ');
  const [isMultiSessionDialogOpen, setIsMultiSessionDialogOpen] = useState(false);
  const [multiSessionDialogOrigin, setMultiSessionDialogOrigin] = useState<'single' | 'multi'>('single');
  const selectedImages = useMemo(() => {
    const packageImages = selectedPackage?.images?.filter(Boolean) || [];
    const portfolioItemImages = (photographer.portfolioItems ?? []).flatMap((item) =>
      (item.images ?? []).filter(Boolean),
    );
    const otherPackageImages = packages
      .filter((pkg) => pkg._id !== selectedPackage?._id)
      .flatMap((pkg) => (pkg.images ?? []).filter(Boolean));
    const studioMediaImages = [
      ...(photographer.media?.images ?? []),
      ...(photographer.coverImage ? [photographer.coverImage] : []),
    ].filter(Boolean);

    return [
      ...new Set([
        ...packageImages,
        ...portfolioItemImages,
        ...photographer.portfolio.filter(Boolean),
        ...otherPackageImages,
        ...studioMediaImages,
      ]),
    ];
  }, [packages, photographer, selectedPackage]);
  const city = photographer.address.city || photographer.address.district || '';
  const category = selectedPackage?.name?.split(/[-–—]/)[0]?.trim() || 'GÓI CHỤP ẢNH';
  const tabs = [
    ['overview', 'Tổng quan'],
    ['included', 'Bao gồm'],
    ['process', 'Buổi chụp'],
    ['location', 'Địa điểm'],
    ['portfolio', 'Portfolio'],
    ['policies', 'Chính sách'],
    ['reviews', 'Đánh giá'],
  ];

  const handleShare = async () => {
    const shareData = { title: selectedPackage?.name || photographer.businessName, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(window.location.href);
      setShareLabel('Đã sao chép');
      window.setTimeout(() => setShareLabel('Chia sẻ'), 1800);
    } catch {
      setShareLabel('Chia sẻ');
    }
  };

  const handlePackageSelection = (pkg: PhotographerPackage) => {
    onSelectPackage(pkg);
    const params = new URLSearchParams(location.search);
    params.set('packageId', pkg._id);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true, state: location.state });
  };

  const scrollToTab = (tab: string) => {
    setActiveTab(tab);
    document.getElementById('ppd-' + tab)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openMultiSessionDialog = () => {
    const isEditingExistingSchedule = bookingMode === 'MULTI';
    setMultiSessionDialogOrigin(isEditingExistingSchedule ? 'multi' : 'single');
    if (!isEditingExistingSchedule) onStartMultiSession();
    setIsMultiSessionDialogOpen(true);
  };

  const cancelMultiSessionDialog = () => {
    setIsMultiSessionDialogOpen(false);
    if (multiSessionDialogOrigin === 'single') onBackToSingle();
  };

  const confirmMultiSessionDialog = () => {
    setMultiSessionDialogOrigin('multi');
    setIsMultiSessionDialogOpen(false);
  };

  const multiSessionErrors =
    quote?.valid === false
      ? quote.errors.filter(
          (error) => !error.clientId || multiSessions.some((session) => session.clientId === error.clientId),
        )
      : [];
  const localToday = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  return (
    <div className="photography-package-detail-page">
      <div className="ppd-page-shell">
        <nav className="ppd-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link><span>/</span><Link to="/photographers">Chụp ảnh</Link><span>/</span><span>{photographer.businessName}</span>
          {location.state?.selectedPackageId && <span className="ppd-breadcrumb-package">/ {selectedPackage?.name}</span>}
        </nav>

        <header className="ppd-package-header">
          <div>
            <span className="ppd-eyebrow">{category.toUpperCase()} {city ? `• ${city.toUpperCase()}` : ''}</span>
            <h1>{selectedPackage?.name || `Gói chụp của ${photographer.businessName}`}</h1>
            <div className="ppd-header-meta"><span className="ppd-rating"><span>★</span> {photographer.rating.averageRating.toFixed(1)}</span><span>{photographer.rating.totalReviews} đánh giá</span><span>{photographer.businessName}</span><span className="ppd-verified"><Check size={13} /> Đã xác minh</span></div>
          </div>
          <div className="ppd-header-actions"><button type="button" onClick={handleShare}><Share2 size={16} /> {shareLabel}</button><button type="button" onClick={onToggleFavorite} className={props.isFavorite ? 'is-active' : ''}><Heart size={16} fill={props.isFavorite ? 'currentColor' : 'none'} /> {props.isFavorite ? 'Đã lưu' : 'Lưu'}</button></div>
        </header>

        {(() => {
          const mosaicImages = selectedImages.slice(0, 5);
          const totalPhotos = selectedImages.length;
          const variantByCount = {
            1: 'single',
            2: 'two',
            3: 'three',
            4: 'four',
            5: 'five',
          } as const;
          const layoutVariant =
            variantByCount[mosaicImages.length as keyof typeof variantByCount] ?? 'single';

          return (
            <section className="ppd-hero-gallery" aria-label="Bộ ảnh gói chụp">
              {mosaicImages.length === 0 ? (
                <div className="ppd-hero-empty">
                  <Camera size={40} />
                  <span>Studio đang cập nhật bộ ảnh cho gói này</span>
                </div>
              ) : (
                <>
                  <div className={`ppd-mosaic ppd-mosaic--${layoutVariant}`}>
                    {mosaicImages.map((image, index) => (
                      <button
                        type="button"
                        key={`${image}-${index}`}
                        className="ppd-mosaic-tile"
                        onClick={() => onImageClick(image)}
                        aria-label={`Xem ảnh ${index + 1} trên ${totalPhotos}`}
                      >
                        <img
                          src={image}
                          alt={`${selectedPackage?.name || photographer.businessName} — ảnh ${index + 1}`}
                          loading={index === 0 ? 'eager' : 'lazy'}
                        />
                      </button>
                    ))}
                  </div>
                  {totalPhotos > 1 && (
                    <button
                      type="button"
                      className="ppd-mosaic-all-btn"
                      onClick={() => onImageClick(selectedImages[0])}
                    >
                      <LayoutGrid size={15} />
                      <span>Xem tất cả {totalPhotos} ảnh</span>
                    </button>
                  )}
                </>
              )}
            </section>
          );
        })()}

        {selectedPackage && <PackageHighlights selectedPackage={selectedPackage} photographerCity={city} />}

        {selectedPackage ? <>
          <div className="ppd-tabs" role="tablist" aria-label="Nội dung gói chụp">{tabs.map(([key, label]) => <button type="button" key={key} role="tab" aria-selected={activeTab === key} className={activeTab === key ? 'is-active' : ''} onClick={() => scrollToTab(key)}>{label}</button>)}</div>
          <div className="ppd-detail-grid">
            <PhotographerPackageContent photographer={photographer} selectedPackage={selectedPackage} reviews={reviews} reviewsLoading={reviewsLoading} portfolioImages={selectedImages} onImageClick={onImageClick} />
            <div className="ppd-sidebar-column">
              <PhotographerPackageBookingCard
                photographer={photographer}
                packages={packages}
                selectedPackage={selectedPackage}
                selectedDate={selectedDate}
                startTime={startTime}
                endTime={endTime}
                selectedTimeSlot={selectedTimeSlot}
                durationMinutes={durationMinutes}
                includedDurationMinutes={includedDurationMinutes}
                overtimeIncrementMinutes={overtimeIncrementMinutes}
                maxOvertimeMinutes={maxOvertimeMinutes}
                canIncreaseDuration={canIncreaseDuration}
                isNextDurationQuoteLoading={isNextDurationQuoteLoading}
                increaseUnavailableReason={increaseUnavailableReason}
                bookingMode={bookingMode}
                multiSessions={multiSessions}
                quote={quote}
                quoteError={quoteError}
                isQuoteLoading={isQuoteLoading}
                selectedLocation={selectedLocation}
                locationError={locationError}
                agreeTerms={agreeTerms}
                isBusy={isBusy}
                isBooking={isBooking}
                canAddToCart={canAddToCart}
                calendarDate={calendarDate}
                calendarDays={calendarDays}
                isCalendarLoading={isCalendarLoading}
                isSlotsLoading={props.isSlotsLoading}
                slots={slots}
                isSlotBusy={isSlotBusy}
                getSlotCapacityInfo={props.getSlotCapacityInfo}
                onSelectPackage={handlePackageSelection}
                onPreviousMonth={onPreviousMonth}
                onNextMonth={onNextMonth}
                onPreviewDate={onPreviewDate}
                onPreviewDuration={onPreviewDuration}
                onConfirmSchedule={onConfirmSchedule}
                onCancelSchedule={onCancelSchedule}
                onDecreaseDuration={onDecreaseDuration}
                onIncreaseDuration={onIncreaseDuration}
                onOpenMultiSession={openMultiSessionDialog}
                onBackToSingle={onBackToSingle}
                onLocationChange={onLocationChange}
                onAgreeTermsChange={onAgreeTermsChange}
                onBookNow={onBookNow}
                onAddToCart={onAddToCart}
                selectedVoucher={props.selectedVoucher}
                applicableVouchersCount={props.applicableVouchers?.length}
                onOpenVoucherPicker={props.onOpenVoucherPicker}
                onRemoveVoucher={props.onRemoveVoucher}
                studioStaff={props.studioStaff}
                effectiveCapacity={props.effectiveCapacity}
                previewDayQuota={props.previewDayQuota}
                selectedSlotCapacity={props.selectedSlotCapacity}
                onRefreshAvailability={props.onRefreshAvailability}
              />
               <PhotographyMultiSessionDialog
                 open={isMultiSessionDialogOpen}
                 sessions={multiSessions}
                 minDate={localToday}
                 includedDurationMinutes={includedDurationMinutes}
                 minimumSessionMinutes={
                   selectedPackage?.pricingUnit && selectedPackage.pricingUnit !== 'PER_SESSION'
                     ? 30
                     : includedDurationMinutes
                 }
                 overtimeIncrementMinutes={overtimeIncrementMinutes}
                 maxOvertimeMinutes={maxOvertimeMinutes}
                 pricingUnit={selectedPackage?.pricingUnit}
                 includedDayCount={selectedPackage?.includedDayCount}
                 includedSessionCount={selectedPackage?.includedSessionCount}
                 errors={multiSessionErrors}
                 onAdd={onAddSession}
                 onGenerateRange={onGenerateRange}
                 onUpdate={onUpdateSession}
                 onRemove={onRemoveSession}
                 onCancel={cancelMultiSessionDialog}
                 onConfirm={confirmMultiSessionDialog}
               />
            </div>
          </div>
          <RelatedPackages packages={packages} selectedPackageId={selectedPackage._id} onSelectPackage={handlePackageSelection} />
        </> : <section className="ppd-no-package"><Camera size={22} /><div><h2>Gói chụp chưa mở bán</h2><p>Photographer hiện chưa có gói đặt lịch. Bạn vẫn có thể xem portfolio và liên hệ để được tư vấn.</p></div></section>}
      </div>
      {lightbox}
    </div>
  );
};
