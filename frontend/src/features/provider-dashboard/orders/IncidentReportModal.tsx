import {
  AlertTriangle
} from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import { PrivateEvidenceImage } from '../../../components/common/PrivateEvidenceImage';
import { API_BASE_URL } from '../../../config/env';
import type { Order } from '../types';
import type { useProviderIncidentState } from './useProviderIncidentState';

type IncidentReportModalProps = Pick<ReturnType<typeof useProviderIncidentState>,
  'setReportingOrder' | 'selectedItemId' | 'setSelectedItemId' | 'incidentActionType' | 'setIncidentActionType' | 'incidentDesc' | 'setIncidentDesc' | 'incidentPhotos' | 'setIncidentPhotos' | 'incidentAmount' | 'setIncidentAmount'
> &
{
  reportingOrder: NonNullable<Order | null>;
  handleSendIncidentReport: (e: FormEvent<Element>) => Promise<void>;
  handleIncidentPhotoUpload: (e: ChangeEvent<HTMLInputElement, Element>) => Promise<void>;
};

export function IncidentReportModal({
  reportingOrder, handleSendIncidentReport, setReportingOrder, selectedItemId, setSelectedItemId,
  incidentActionType, setIncidentActionType, incidentDesc, setIncidentDesc, handleIncidentPhotoUpload,
  incidentPhotos, setIncidentPhotos, incidentAmount, setIncidentAmount,
}: IncidentReportModalProps) {
  return (
    (() => {
      const isReportingPhotoOrder = reportingOrder.bookingType === 'PHOTOGRAPHY' || reportingOrder.items?.some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE');
      return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <form onSubmit={handleSendIncidentReport} style={{ width: '100%', maxWidth: '500px', backgroundColor: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--color-dark-bg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontFamily: 'var(--font-header)', fontSize: '15px', fontWeight: 700, margin: 0 }}>{isReportingPhotoOrder ? 'BÁO CÁO KHÁCH HÀNG' : 'BÁO CÁO SỰ CỐ / HỎNG ĐỒ'}</h4>
              <button type="button" onClick={() => setReportingOrder(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto' }}>

              {/* Pickup Damage Report Warning */}
              {!isReportingPhotoOrder && reportingOrder.pickupDamageReport && (
                <div style={{
                  backgroundColor: '#FEF9E7',
                  border: '1px solid #F5CBA7',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  color: '#7E5109',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <AlertTriangle size={15} style={{ color: '#D35400' }} />
                    <span>Chú ý: Khách hàng đã báo lỗi khi nhận đồ!</span>
                  </div>
                  <div style={{ fontSize: '12px' }}>
                    <strong>Mô tả của khách:</strong> {reportingOrder.pickupDamageReport.description}
                  </div>
                  {reportingOrder.pickupDamageReport.evidencePhotos && reportingOrder.pickupDamageReport.evidencePhotos.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {reportingOrder.pickupDamageReport.evidencePhotos.map((photo: string, index: number) => (
                        <a key={index} href={photo.startsWith('http') ? photo : `${API_BASE_URL}${photo}`} target="_blank" rel="noreferrer" style={{ width: '45px', height: '45px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #F5CBA7' }}>
                          <img src={photo.startsWith('http') ? photo : `${API_BASE_URL}${photo}`} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </a>
                      ))}
                    </div>
                  )}
                  <strong style={{ fontSize: '11px', color: '#C0392B', marginTop: '4px' }}>
                    * Vui lòng đối soát kỹ và không phạt tiền đối với các vết bẩn/hỏng hóc khách hàng đã khai báo ở trên.
                  </strong>
                </div>
              )}

              {/* Chọn sản phẩm / Gói chụp */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{isReportingPhotoOrder ? 'GÓI CHỤP GẶP SỰ CỐ *' : 'SẢN PHẨM GẶP SỰ CỐ *'}</span>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', outline: 'none' }}
                  required
                >
                  <option value="">{isReportingPhotoOrder ? '-- Chọn gói chụp trong đơn hàng --' : '-- Chọn sản phẩm trong đơn hàng --'}</option>
                  {(reportingOrder.items || []).map((item: any) => (
                    <option key={item._id} value={item._id}>
                      {item.name || 'Gói chụp / Sản phẩm'} ({item.quantity}x - {item.unitPrice?.toLocaleString()}đ)
                    </option>
                  ))}
                </select>
              </div>

              {/* Loại xử lý */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>HÌNH THỨC XỬ LÝ *</span>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {isReportingPhotoOrder ? (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="radio"
                          name="actionType"
                          value="NO_SHOW"
                          checked={incidentActionType === 'NO_SHOW'}
                          onChange={() => setIncidentActionType('NO_SHOW')}
                        />
                        Khách vắng mặt / Không đến (NO_SHOW)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="radio"
                          name="actionType"
                          value="VIOLATION"
                          checked={incidentActionType === 'VIOLATION'}
                          onChange={() => setIncidentActionType('VIOLATION')}
                        />
                        Vi phạm quy định / Tranh chấp (VIOLATION)
                      </label>
                    </>
                  ) : (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="radio"
                          name="actionType"
                          value="CLEANING"
                          checked={incidentActionType === 'CLEANING'}
                          onChange={() => setIncidentActionType('CLEANING')}
                        />
                        Giặt là vết bẩn (CLEANING)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="radio"
                          name="actionType"
                          value="MAINTENANCE"
                          checked={incidentActionType === 'MAINTENANCE'}
                          onChange={() => setIncidentActionType('MAINTENANCE')}
                        />
                        Sửa chữa / Đền bù rách, hỏng (MAINTENANCE)
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* Mô tả chi tiết */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{isReportingPhotoOrder ? 'MÔ TẢ CHI TIẾT SỰ CỐ TỪ KHÁCH HÀNG *' : 'MÔ TẢ CHI TIẾT SỰ CỐ *'}</span>
                <textarea
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-light-border)', fontSize: '14px', outline: 'none', resize: 'none', height: '80px', fontFamily: 'inherit' }}
                  placeholder={isReportingPhotoOrder ? 'Nhập chi tiết sự cố từ phía khách hàng (không xuất hiện, trễ giờ quá quy định, hủy ngang...)...' : 'Nhập chi tiết vết bẩn hoặc vị trí rách hỏng của sản phẩm...'}
                  value={incidentDesc}
                  onChange={(e) => setIncidentDesc(e.target.value)}
                  required
                />
              </div>

              {/* Ảnh bằng chứng */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{isReportingPhotoOrder ? 'ẢNH CHỤP BẰNG CHỨNG (NẾU CÓ)' : 'ẢNH CHỤP BẰNG CHỨNG HỎNG HÓC *'}</span>

                <label htmlFor="incident-photo-file" style={{
                  border: '2px dashed #D1D5DB',
                  borderRadius: '12px',
                  backgroundColor: '#F9FAFB',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  gap: '8px',
                  transition: 'all 0.2s ease-in-out'
                }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary-dark)';
                    e.currentTarget.style.backgroundColor = '#FFFDF9';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#D1D5DB';
                    e.currentTarget.style.backgroundColor = '#F9FAFB';
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8C827A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#4B5563' }}>Tải ảnh bằng chứng lên</span>
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{isReportingPhotoOrder ? 'Chọn ảnh bằng chứng (tin nhắn, lịch sử gọi...)' : 'Chọn một hoặc nhiều hình ảnh vết bẩn, rách'}</span>
                  <input
                    id="incident-photo-file"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleIncidentPhotoUpload}
                    style={{ display: 'none' }}
                  />
                </label>

                {incidentPhotos.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', padding: '8px', backgroundColor: '#F3F4F6', borderRadius: '8px' }}>
                    {incidentPhotos.map((photo, index) => {
                      const url = photo.startsWith('http') ? photo : `${API_BASE_URL}${photo}`;
                      return (
                        <div key={index} style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #D1D5DB' }}>
                          <PrivateEvidenceImage
                            reference={photo}
                            legacyUrl={url}
                            alt="Incident preview"
                            linkStyle={{ display: 'block', width: '100%', height: '100%' }}
                            imageStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <button
                            type="button"
                            onClick={() => setIncidentPhotos(prev => prev.filter((_, i) => i !== index))}
                            style={{
                              position: 'absolute',
                              top: '2px',
                              right: '2px',
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(0,0,0,0.6)',
                              color: 'white',
                              border: 'none',
                              fontSize: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Số tiền yêu cầu đền bù */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{isReportingPhotoOrder ? 'SỐ TIỀN YÊU CẦU BỒI THƯỜNG (NẾU CÓ)' : 'TIỀN ĐỀN BÙ YÊU CẦU *'}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>Tối đa cọc: {reportingOrder.depositTotal?.toLocaleString()}đ</span>
                </div>
                <input
                  type="number"
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-light-border)', fontSize: '14px', outline: 'none' }}
                  placeholder="Nhập số tiền yêu cầu đền bù..."
                  value={incidentAmount}
                  onChange={(e) => setIncidentAmount(Number(e.target.value))}
                  min={0}
                  max={reportingOrder.depositTotal}
                  required
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', padding: '12px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', marginTop: '8px' }}
              >
                {isReportingPhotoOrder ? 'GỬI BÁO CÁO KHÁCH HÀNG' : 'GỬI BÁO CÁO SỰ CỐ'}
              </button>
            </div>
          </form>
        </div>
      );
    })()
  );
}
