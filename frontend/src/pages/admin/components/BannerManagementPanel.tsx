import React, { useState, useEffect } from 'react';
import {
  Upload,
  Save,
  RotateCcw,
  Shirt,
  Camera,
  Gift,
  Home,
  Eye,
  Loader2,
} from 'lucide-react';
import { useToast } from '../../../components/feedback/Toast';
import { bannersApi } from '../../../features/banners/api/banners.api';
import { DEFAULT_BANNERS } from '../../../features/banners/constants';
import type { Banner, BannerPlacement, UpdateBannerPayload } from '../../../features/banners/types';
import './bannerManagement.css';

interface PlacementCardConfig {
  placement: BannerPlacement;
  title: string;
  icon: React.ReactNode;
  pageRoute: string;
}

const PLACEMENTS: PlacementCardConfig[] = [
  {
    placement: 'AODAI',
    title: 'Trang Thuê Áo Dài',
    icon: <Shirt size={18} />,
    pageRoute: '/rentals',
  },
  {
    placement: 'PHOTOGRAPHER',
    title: 'Trang Gói Chụp Ảnh',
    icon: <Camera size={18} />,
    pageRoute: '/photographers',
  },
  {
    placement: 'COMBO',
    title: 'Trang Gói Combo',
    icon: <Gift size={18} />,
    pageRoute: '/combos',
  },
  {
    placement: 'HOME',
    title: 'Trang Chủ',
    icon: <Home size={18} />,
    pageRoute: '/',
  },
];

export const BannerManagementPanel: React.FC = () => {
  const toast = useToast();
  const [banners, setBanners] = useState<Record<BannerPlacement, Partial<Banner>>>({
    AODAI: {},
    PHOTOGRAPHER: {},
    COMBO: {},
    HOME: {},
  });
  const [loading, setLoading] = useState(true);
  const [uploadingPlacement, setUploadingPlacement] = useState<BannerPlacement | null>(null);
  const [savingPlacement, setSavingPlacement] = useState<BannerPlacement | null>(null);

  // Load banners on mount (Zero N+1 query: single API call)
  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    setLoading(true);
    try {
      const data = await bannersApi.getAdminBanners();
      const mapped: Record<BannerPlacement, Partial<Banner>> = {
        AODAI: {},
        PHOTOGRAPHER: {},
        COMBO: {},
        HOME: {},
      };
      data.forEach((b) => {
        if (b.placement && mapped[b.placement] !== undefined) {
          mapped[b.placement] = b;
        }
      });
      setBanners(mapped);
    } catch (err: any) {
      toast.error('Không thể tải danh sách banner: ' + (err?.message || 'Lỗi server'));
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (placement: BannerPlacement, field: keyof UpdateBannerPayload, value: any) => {
    setBanners((prev) => ({
      ...prev,
      [placement]: {
        ...prev[placement],
        [field]: value,
      },
    }));
  };

  const handleFileUpload = async (placement: BannerPlacement, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File ảnh vượt quá dung lượng tối đa 5MB!');
      return;
    }

    setUploadingPlacement(placement);
    try {
      const res = await bannersApi.uploadBannerImage(file);
      handleFieldChange(placement, 'imageUrl', res.url);
      toast.success(`Đã tải ảnh lên thành công cho ${placement}!`);
    } catch (err: any) {
      toast.error('Tải ảnh thất bại: ' + (err?.message || 'Lỗi xử lý file'));
    } finally {
      setUploadingPlacement(null);
    }
  };

  const handleSave = async (placement: BannerPlacement) => {
    const b = banners[placement];
    const defaultMeta = DEFAULT_BANNERS[placement];
    const finalImageUrl = b.imageUrl || defaultMeta.imageUrl;

    const payload: UpdateBannerPayload = {
      placement,
      imageUrl: finalImageUrl,
      title: b.title ?? '',
      subtitle: b.subtitle ?? '',
      linkUrl: b.linkUrl ?? '',
      isActive: b.isActive !== undefined ? b.isActive : true,
    };

    setSavingPlacement(placement);
    try {
      const saved = await bannersApi.updateAdminBanner(placement, payload);
      setBanners((prev) => ({
        ...prev,
        [placement]: saved,
      }));
      toast.success(`Đã lưu cấu hình banner ${placement} thành công!`);
    } catch (err: any) {
      toast.error('Lưu banner thất bại: ' + (err?.message || 'Lỗi server'));
    } finally {
      setSavingPlacement(null);
    }
  };

  const handleResetToDefault = (placement: BannerPlacement) => {
    const defaultMeta = DEFAULT_BANNERS[placement];
    setBanners((prev) => ({
      ...prev,
      [placement]: {
        ...prev[placement],
        imageUrl: defaultMeta.imageUrl,
        title: '',
        subtitle: '',
        isActive: true,
      },
    }));
    toast.info(`Đã khôi phục thông số mặc định cho ${placement}. Nhấn "Lưu thay đổi" để áp dụng.`);
  };

  if (loading) {
    return (
      <div className="banner-admin-loading">
        <Loader2 className="animate-spin" size={32} />
        <p>Đang tải cấu hình banner hệ thống...</p>
      </div>
    );
  }

  return (
    <div className="banner-admin-container">
      <div className="banner-admin-header">
        <div>
          <h2>Quản lý Banner Toàn Trang</h2>
          <p>
            Tùy biến ảnh bìa Hero Banner, lớp phủ văn bản và trạng thái hiển thị cho từng trang chính theo chuẩn điện ảnh Traveloka.
          </p>
        </div>
        <button
          type="button"
          className="banner-refresh-btn"
          onClick={loadBanners}
          title="Tải lại dữ liệu"
        >
          <RotateCcw size={15} /> Làm mới
        </button>
      </div>

      <div className="banner-admin-grid">
        {PLACEMENTS.map(({ placement, title, icon, pageRoute }) => {
          const current = banners[placement] || {};
          const defaultMeta = DEFAULT_BANNERS[placement];
          const displayImage = current.imageUrl || defaultMeta.imageUrl;
          const isActive = current.isActive !== undefined ? current.isActive : true;
          const isUploading = uploadingPlacement === placement;
          const isSaving = savingPlacement === placement;

          return (
            <div key={placement} className="banner-card">
              <div className="banner-card-top">
                <div className="banner-card-title-group">
                  <span className="banner-card-icon">{icon}</span>
                  <div>
                    <h3>{title}</h3>
                    <a href={pageRoute} target="_blank" rel="noreferrer" className="banner-card-link">
                      Xem trang <Eye size={12} />
                    </a>
                  </div>
                </div>

                <div className="banner-card-status">
                  <label className="banner-toggle-label">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => handleFieldChange(placement, 'isActive', e.target.checked)}
                    />
                    <span className="banner-toggle-slider" />
                  </label>
                  <span className={`banner-status-badge ${isActive ? 'is-active' : 'is-inactive'}`}>
                    {isActive ? 'Đang bật' : 'Đang tắt'}
                  </span>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="banner-preview-box">
                <div
                  className="banner-preview-canvas"
                  style={{
                    backgroundImage: `linear-gradient(90deg, rgba(20, 6, 9, 0.88) 0%, rgba(20, 6, 9, 0.52) 55%, rgba(0, 0, 0, 0.22) 100%), url(${displayImage})`,
                  }}
                >
                  <div className="banner-preview-content">
                    <span className="banner-preview-eyebrow">XEM TRƯỚC BANNER</span>
                    <h4 className="banner-preview-title">
                      {current.title?.trim() || defaultMeta.defaultTitle}
                    </h4>
                    <p className="banner-preview-desc">
                      {current.subtitle?.trim() || defaultMeta.defaultSubtitle}
                    </p>
                  </div>
                </div>

                {isUploading && (
                  <div className="banner-uploading-overlay">
                    <Loader2 className="animate-spin" size={24} />
                    <span>Đang tải ảnh lên Cloudinary...</span>
                  </div>
                )}
              </div>

              {/* Form Controls */}
              <div className="banner-card-form">
                <div className="banner-input-group">
                  <label>Ảnh bìa Banner (URL hoặc Tải lên mới)</label>
                  <div className="banner-image-input-row">
                    <input
                      type="text"
                      className="banner-text-input"
                      value={current.imageUrl || ''}
                      placeholder={`Mặc định: ${defaultMeta.imageUrl}`}
                      onChange={(e) => handleFieldChange(placement, 'imageUrl', e.target.value)}
                    />
                    <label className="banner-upload-button">
                      <Upload size={14} /> Tải ảnh
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        disabled={isUploading}
                        onChange={(e) => handleFileUpload(placement, e)}
                      />
                    </label>
                  </div>
                  <span className="banner-hint">Gợi ý: Tỷ lệ 16:9 hoặc dải ngang 3:1 (1920x600px). Tối đa 5MB.</span>
                </div>

                <div className="banner-input-group">
                  <label>Tiêu đề tùy chỉnh (Để trống để dùng tiêu đề gốc)</label>
                  <input
                    type="text"
                    className="banner-text-input"
                    value={current.title || ''}
                    placeholder={`Gốc: "${defaultMeta.defaultTitle}"`}
                    onChange={(e) => handleFieldChange(placement, 'title', e.target.value)}
                    maxLength={150}
                  />
                </div>

                <div className="banner-input-group">
                  <label>Mô tả ngắn (Để trống để dùng mô tả gốc)</label>
                  <input
                    type="text"
                    className="banner-text-input"
                    value={current.subtitle || ''}
                    placeholder={`Gốc: "${defaultMeta.defaultSubtitle}"`}
                    onChange={(e) => handleFieldChange(placement, 'subtitle', e.target.value)}
                    maxLength={300}
                  />
                </div>

                <div className="banner-card-actions">
                  <button
                    type="button"
                    className="banner-reset-btn"
                    onClick={() => handleResetToDefault(placement)}
                    title="Đặt lại thông số mặc định"
                  >
                    <RotateCcw size={14} /> Mặc định
                  </button>

                  <button
                    type="button"
                    className="banner-save-btn"
                    disabled={isSaving || isUploading}
                    onClick={() => handleSave(placement)}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="animate-spin" size={15} /> Đang lưu...
                      </>
                    ) : (
                      <>
                        <Save size={15} /> Lưu thay đổi
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
