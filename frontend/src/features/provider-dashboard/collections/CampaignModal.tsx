import type { FormEvent } from 'react';
import { Modal } from '../../../components/common/Modal';
import type { useProviderCampaignState } from './useProviderCampaignState';

type CampaignModalProps = Pick<ReturnType<typeof useProviderCampaignState>,
  'isCampaignModalOpen' | 'setIsCampaignModalOpen' | 'activeCampaign' | 'campaignOccasion' | 'setCampaignOccasion' | 'campaignPercent' | 'setCampaignPercent' | 'campaignStart' | 'setCampaignStart' | 'campaignEnd' | 'setCampaignEnd' | 'submittingCampaign'
> &
{
  handleCreateCampaign: (e: FormEvent<Element>) => Promise<void>;
  handleDeactivateCampaign: () => Promise<void>;
};

export function CampaignModal({
  isCampaignModalOpen, setIsCampaignModalOpen, handleCreateCampaign, activeCampaign,
  handleDeactivateCampaign, campaignOccasion, setCampaignOccasion, campaignPercent, setCampaignPercent,
  campaignStart, setCampaignStart, campaignEnd, setCampaignEnd, submittingCampaign,
}: CampaignModalProps) {
  return (
    <Modal
      isOpen={isCampaignModalOpen}
      onClose={() => setIsCampaignModalOpen(false)}
      title="Thiết lập chương trình khuyến mãi"
      maxWidth="480px"
    >
      <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
        {activeCampaign && (
          <div style={{ padding: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', fontSize: '13px', color: '#B91C1C', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontWeight: 700 }}>Đang chạy chiến dịch: {activeCampaign.occasion} (-{activeCampaign.discountPercent}%)</span>
            <span>Thời gian: {new Date(activeCampaign.startDate).toLocaleDateString('vi-VN')} - {new Date(activeCampaign.endDate).toLocaleDateString('vi-VN')}</span>
            <button
              type="button"
              onClick={handleDeactivateCampaign}
              style={{
                marginTop: '8px', padding: '8px 12px', backgroundColor: '#EF4444', color: 'white', border: 'none',
                borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '12px', alignSelf: 'flex-start'
              }}
            >
              Về giá gốc (Hủy khuyến mãi)
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>DỊP KHUYẾN MÃI *</label>
          <input
            type="text"
            placeholder="Ví dụ: Sale Tết 2027, Khai xuân..."
            value={campaignOccasion}
            onChange={(e) => setCampaignOccasion(e.target.value)}
            required
            style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>PHẦN TRĂM GIẢM GIÁ (%) *</label>
          <input
            type="number"
            min="1"
            max="90"
            placeholder="10"
            value={campaignPercent}
            onChange={(e) => setCampaignPercent(e.target.value)}
            required
            style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>TỪ NGÀY *</label>
            <input
              type="date"
              value={campaignStart}
              onChange={(e) => setCampaignStart(e.target.value)}
              required
              style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>ĐẾN NGÀY *</label>
            <input
              type="date"
              value={campaignEnd}
              onChange={(e) => setCampaignEnd(e.target.value)}
              required
              style={{ padding: '10px', border: '1px solid var(--color-light-border)', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--color-light-border)', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={() => setIsCampaignModalOpen(false)}
            style={{ flex: 1, padding: '10px', backgroundColor: '#F3F4F6', color: '#4B5563', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submittingCampaign}
            style={{
              flex: 2, padding: '10px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none',
              borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: submittingCampaign ? 'not-allowed' : 'pointer'
            }}
          >
            {submittingCampaign ? 'Đang xử lý...' : activeCampaign ? 'Cập nhật khuyến mãi mới' : 'Kích hoạt khuyến mãi'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
