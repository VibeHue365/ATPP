import {
  CheckCircle,
  FileText,
  MapPinned,
  Plus,
  Save,
  Store,
  Trash2,
  Upload,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { SectionLoading } from '../../../components/feedback/AsyncState';
import { useToast } from '../../../components/feedback/Toast';
import { PhotographyLocationPicker } from '../../photographers/components/PhotographyLocationPicker';
import { providerApi } from '../api/providerDashboardApi';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import type { useProviderProfileState } from './useProviderProfileState';

type ServiceProfilePanelProps = Pick<ReturnType<typeof useProviderSessionState>,
  'isLoadingProvider'
> &
  Pick<ReturnType<typeof useProviderProfileState>,
    'profileSection' | 'setProfileSection' | 'businessName' | 'setBusinessName' | 'phone' | 'setPhone' | 'city' | 'setCity' | 'baseLatitude' | 'baseLongitude' | 'addressLine' | 'setAddressLine' | 'setBaseLatitude' | 'setBaseLongitude' | 'serviceRadiusKm' | 'setServiceRadiusKm' | 'useBusinessAddressForPickup' | 'setUseBusinessAddressForPickup' | 'pickupLatitude' | 'pickupLongitude' | 'pickupAddressLine' | 'setPickupAddressLine' | 'setPickupLatitude' | 'setPickupLongitude' | 'setCancellationRefundRules' | 'cancellationRefundRules' | 'cancellationAdditionalNotes' | 'setCancellationAdditionalNotes' | 'isSavingProfile' | 'coverUrl' | 'setCoverUrl'
  > &
{
  profileHasUnsavedChanges: boolean;
  handleUpdateProfile: (e: FormEvent<Element>) => Promise<void>;
  hasPhotographyCapability: boolean | undefined;
  hasAodaiCapability: boolean | undefined;
  cancellationPolicySummary: string;
};

export function ServiceProfilePanel({
  profileHasUnsavedChanges, isLoadingProvider, handleUpdateProfile, profileSection, setProfileSection,
  businessName, setBusinessName, phone, setPhone, city, setCity, baseLatitude, baseLongitude,
  addressLine, setAddressLine, setBaseLatitude, setBaseLongitude, hasPhotographyCapability,
  serviceRadiusKm, setServiceRadiusKm, hasAodaiCapability, useBusinessAddressForPickup,
  setUseBusinessAddressForPickup, pickupLatitude, pickupLongitude, pickupAddressLine,
  setPickupAddressLine, setPickupLatitude, setPickupLongitude, setCancellationRefundRules,
  cancellationRefundRules, cancellationAdditionalNotes, setCancellationAdditionalNotes,
  cancellationPolicySummary, isSavingProfile, coverUrl, setCoverUrl,
}: ServiceProfilePanelProps) {
  const toast = useToast();
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Chỉ hỗ trợ file ảnh định dạng JPEG, PNG, WEBP');
      return;
    }

    setUploadingCover(true);
    try {
      const res = await providerApi.uploadCoverImage(file);
      if (res?.url) {
        setCoverUrl(res.url);
        toast.success('Tải ảnh bìa thành công! Hãy nhấn "Lưu thay đổi"');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Tải ảnh bìa thất bại');
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = '';
      }
    }
  };

  return (
    <main className="provider-service-page">
      <div className="provider-service-header">
        <div>
          <p className="provider-service-eyebrow">THIẾT LẬP NHÀ CUNG CẤP</p>
          <h2>Thông tin dịch vụ</h2>
          <p>Hoàn thiện từng phần thay vì điền một biểu mẫu dài. Địa chỉ chính xác chỉ dùng nội bộ để phục vụ đặt lịch và giao nhận.</p>
        </div>
        <span className={`provider-service-status${profileHasUnsavedChanges ? ' is-dirty' : ''}`}>
          <CheckCircle size={16} /> {profileHasUnsavedChanges ? 'Có thay đổi chưa lưu' : 'Đã lưu'}
        </span>
      </div>

      {isLoadingProvider ? <SectionLoading message="Đang tải thông tin dịch vụ…" /> : (
        <form onSubmit={handleUpdateProfile} className="provider-service-form">
          <div className="provider-service-tabs" role="tablist" aria-label="Các phần thông tin dịch vụ">
            <button type="button" role="tab" aria-selected={profileSection === 'business'} className={`provider-service-tab${profileSection === 'business' ? ' is-active' : ''}`} onClick={() => setProfileSection('business')}>
              <Store size={20} /><span>Cửa hàng<small>Thương hiệu & liên hệ</small></span>
            </button>
            <button type="button" role="tab" aria-selected={profileSection === 'location'} className={`provider-service-tab${profileSection === 'location' ? ' is-active' : ''}`} onClick={() => setProfileSection('location')}>
              <MapPinned size={20} /><span>Địa điểm & phạm vi<small>Pin bản đồ, bán kính, giao nhận</small></span>
            </button>
            <button type="button" role="tab" aria-selected={profileSection === 'policy'} className={`provider-service-tab${profileSection === 'policy' ? ' is-active' : ''}`} onClick={() => setProfileSection('policy')}>
              <FileText size={20} /><span>Chính sách<small>Hủy dịch vụ & hoàn cọc</small></span>
            </button>
          </div>

          {profileSection === 'business' && <section className="provider-service-panel" role="tabpanel">
            <div className="provider-service-panel-heading">
              <h3>Thông tin cửa hàng</h3>
              <p>Đây là thông tin khách hàng nhìn thấy khi tìm đến dịch vụ của bạn.</p>
            </div>
            <div className="provider-service-field-grid">
              <div className="provider-service-field">
                <label htmlFor="provider-business-name">Tên thương hiệu / cửa hàng</label>
                <input id="provider-business-name" type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ví dụ: Áo Dài Cổ Phong Vibe" required />
                <p className="provider-service-field-note">Dùng tên nhất quán trên trang sản phẩm và đơn đặt.</p>
              </div>
              <div className="provider-service-field">
                <label htmlFor="provider-phone">Số điện thoại liên hệ</label>
                <input id="provider-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ví dụ: 0901 234 567" required />
                <p className="provider-service-field-note">Dùng để hỗ trợ khách khi phát sinh đơn đặt.</p>
              </div>
              <div className="provider-service-field" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label htmlFor="provider-cover-url">Ảnh bìa gian hàng (Cover Banner)</label>
                  <span style={{ fontSize: 12, color: '#897d75' }}>Tỷ lệ chuẩn 16:9 hoặc dải ngang 3:1 (Tối đa 5MB)</span>
                </div>

                <input
                  type="file"
                  ref={coverInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleCoverFileSelect}
                />

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={uploadingCover}
                    onClick={() => coverInputRef.current?.click()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 18px',
                      borderRadius: 10,
                      background: '#fff',
                      border: '1.5px solid #a11e22',
                      color: '#a11e22',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: uploadingCover ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {uploadingCover ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Đang tải ảnh lên...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        <span>Tải ảnh từ máy tính</span>
                      </>
                    )}
                  </button>

                  <div style={{ flex: 1, minWidth: 220 }}>
                    <input
                      id="provider-cover-url"
                      type="text"
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="Hoặc dán trực tiếp link ảnh (https://...)"
                    />
                  </div>

                  {coverUrl && (
                    <button
                      type="button"
                      onClick={() => setCoverUrl('')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1px solid #e3d7cb',
                        background: '#fff',
                        color: '#666',
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Trash2 size={14} /> Xóa ảnh
                    </button>
                  )}
                </div>

                {/* Preview Box */}
                {coverUrl ? (
                  <div
                    style={{
                      marginTop: 12,
                      borderRadius: 14,
                      overflow: 'hidden',
                      height: 160,
                      background: `url(${coverUrl}) center/cover no-repeat`,
                      border: '2px solid rgba(161, 30, 34, 0.15)',
                      position: 'relative',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 24px',
                        color: '#fff',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, display: 'block', marginBottom: 2 }}>
                          Xem trước trên trang Shop
                        </span>
                        <strong style={{ fontSize: 18 }}>{businessName || 'Gian hàng của bạn'}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => coverInputRef.current?.click()}
                    style={{
                      marginTop: 12,
                      padding: '24px 20px',
                      borderRadius: 14,
                      border: '2px dashed #e3d7cb',
                      background: '#fffdfa',
                      textAlign: 'center',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 22, background: '#fff0ef', color: '#a11e22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ImageIcon size={22} />
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: 13, color: '#333' }}>
                        Chưa có ảnh bìa — Nhấn để chọn ảnh từ máy tính
                      </strong>
                      <span style={{ fontSize: 12, color: '#888' }}>
                        Định dạng hỗ trợ: JPG, PNG, WebP (Tối đa 5MB)
                      </span>
                    </div>
                  </div>
                )}
                <p className="provider-service-field-note">
                  Ảnh bìa sẽ hiển thị ở đầu trang cửa hàng công khai của bạn, giúp thu hút khách hàng (tỷ lệ chuẩn 16:9 hoặc dải ngang 3:1).
                </p>
              </div>
            </div>
          </section>}

          {profileSection === 'location' && <section className="provider-service-panel" role="tabpanel">
            <div className="provider-service-panel-heading">
              <h3>Địa điểm và phạm vi phục vụ</h3>
              <p>Tìm địa chỉ, chọn pin trên bản đồ rồi thiết lập phạm vi phù hợp. Tọa độ được ẩn trong phần nâng cao để biểu mẫu dễ dùng hơn.</p>
            </div>
            <div className="provider-service-location-stack">
              <div className="provider-service-field" style={{ maxWidth: 420 }}>
                <label htmlFor="provider-city">Thành phố</label>
                <input id="provider-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ví dụ: Thành phố Huế" required />
              </div>
              <PhotographyLocationPicker
                compact
                value={baseLatitude !== '' && baseLongitude !== '' ? { address: addressLine, latitude: Number(baseLatitude), longitude: Number(baseLongitude) } : null}
                onSelect={(location) => {
                  setAddressLine(location.address);
                  setBaseLatitude(location.latitude.toString());
                  setBaseLongitude(location.longitude.toString());
                }}
                title="Địa chỉ kinh doanh / điểm xuất phát"
                hint="Tìm địa chỉ hoặc kéo pin. Đây là vị trí nội bộ dùng để kiểm tra lịch và bán kính phục vụ."
                radiusKm={hasPhotographyCapability && serviceRadiusKm !== '' ? Number(serviceRadiusKm) : null}
              />

              {hasPhotographyCapability && <div className="provider-service-radius">
                <div className="provider-service-radius-header"><strong>Bán kính phục vụ chụp ảnh</strong><span className="provider-service-radius-value">{serviceRadiusKm || 0} km</span></div>
                <div className="provider-service-radius-presets">
                  {[5, 10, 20, 50].map((radius) => <button type="button" key={radius} className={Number(serviceRadiusKm) === radius ? 'is-selected' : ''} onClick={() => setServiceRadiusKm(String(radius))}>{radius} km</button>)}
                </div>
                <div className="provider-service-radius-controls">
                  <input type="range" min="1" max="100" value={Math.min(100, Math.max(1, Number(serviceRadiusKm) || 1))} onChange={(e) => setServiceRadiusKm(e.target.value)} aria-label="Bán kính phục vụ chụp ảnh" />
                  <input type="number" min="1" max="500" step="1" value={serviceRadiusKm} onChange={(e) => setServiceRadiusKm(e.target.value)} placeholder="Số km" aria-label="Nhập bán kính phục vụ" />
                </div>
              </div>}

              {hasAodaiCapability && <div className="provider-service-pickup">
                <label className="provider-service-pickup-toggle">
                  <input type="checkbox" checked={useBusinessAddressForPickup} onChange={(e) => setUseBusinessAddressForPickup(e.target.checked)} />
                  <span><strong>Dùng địa chỉ kinh doanh cho nhận và trả áo dài</strong><span>Chỉ tắt lựa chọn này nếu điểm giao nhận khác với cửa hàng.</span></span>
                </label>
                {!useBusinessAddressForPickup && <PhotographyLocationPicker
                  compact
                  value={pickupLatitude !== '' && pickupLongitude !== '' ? { address: pickupAddressLine, latitude: Number(pickupLatitude), longitude: Number(pickupLongitude) } : null}
                  onSelect={(location) => {
                    setPickupAddressLine(location.address);
                    setPickupLatitude(location.latitude.toString());
                    setPickupLongitude(location.longitude.toString());
                  }}
                  title="Điểm nhận và trả áo dài"
                  hint="MVP hiện dùng một điểm chung cho cả nhận và trả."
                />}
              </div>}
            </div>
          </section>}

          {profileSection === 'policy' && <section className="provider-service-panel" role="tabpanel">
            <div className="provider-service-panel-heading">
              <h3>Chính sách hủy dịch vụ và hoàn cọc</h3>
              <p>Thiết lập từng mốc hủy và tỷ lệ hoàn cọc. Hệ thống sẽ tự viết thành chính sách rõ ràng cho khách.</p>
            </div>
            <div className="provider-policy-builder">
              <div className="provider-policy-builder-header">
                <div><strong>Mốc hoàn cọc</strong><span>Nhập số ngày trước lịch hẹn và phần trăm hoàn tiền cọc tương ứng.</span></div>
                <div className="provider-policy-builder-actions">
                  <button type="button" className="provider-policy-secondary-action" onClick={() => setCancellationRefundRules([{ noticeDays: 7, refundPercent: 100 }, { noticeDays: 3, refundPercent: 50 }, { noticeDays: 0, refundPercent: 0 }])}>Dùng mẫu phổ biến</button>
                  <button type="button" className="provider-policy-primary-action" onClick={() => setCancellationRefundRules((rules) => [...rules, { noticeDays: 0, refundPercent: 0 }])}><Plus size={15} /> Thêm mốc</button>
                </div>
              </div>
              {cancellationRefundRules.length === 0 ? <div className="provider-policy-empty"><strong>Chưa có mốc hoàn cọc.</strong><span>Chọn “Dùng mẫu phổ biến” hoặc thêm mốc theo chính sách của cửa hàng.</span></div> : <div className="provider-policy-rules">
                <div className="provider-policy-rule-labels"><span>Hủy trước lịch</span><span>Tỷ lệ hoàn cọc</span><span /></div>
                {cancellationRefundRules.map((rule, index) => <div className="provider-policy-rule" key={index}>
                  <label><input type="number" min="0" max="365" step="1" value={rule.noticeDays} onChange={(event) => setCancellationRefundRules((rules) => rules.map((item, itemIndex) => itemIndex === index ? { ...item, noticeDays: Number(event.target.value) } : item))} /><span>ngày</span></label>
                  <label><input type="number" min="0" max="100" step="1" value={rule.refundPercent} onChange={(event) => setCancellationRefundRules((rules) => rules.map((item, itemIndex) => itemIndex === index ? { ...item, refundPercent: Number(event.target.value) } : item))} /><span>% hoàn</span></label>
                  <button type="button" className="provider-policy-remove" onClick={() => setCancellationRefundRules((rules) => rules.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Xóa mốc hủy ${rule.noticeDays} ngày`}><Trash2 size={16} /></button>
                </div>)}
              </div>}
            </div>
            <div className="provider-service-field provider-policy-notes">
              <label htmlFor="provider-cancellation-notes">Ghi chú thêm (không bắt buộc)</label>
              <textarea id="provider-cancellation-notes" value={cancellationAdditionalNotes} onChange={(e) => setCancellationAdditionalNotes(e.target.value)} placeholder="Ví dụ: Phí chuyển khoản không được hoàn; khách cần liên hệ shop để xác nhận yêu cầu hủy." />
            </div>
            <div className="provider-service-policy-preview"><strong>Xem trước hiển thị với khách:</strong><p>{cancellationPolicySummary || 'Chưa thiết lập chính sách hủy và hoàn cọc.'}</p></div>
          </section>}

          <div className="provider-service-savebar">
            <div className={`provider-service-savebar-copy${profileHasUnsavedChanges ? ' is-dirty' : ''}`}>
              <CheckCircle size={17} /> {profileHasUnsavedChanges ? 'Bạn có thay đổi chưa được lưu.' : 'Thông tin đang được đồng bộ.'}
            </div>
            <button type="submit" disabled={isSavingProfile}>
              <Save size={16} /> {isSavingProfile ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
