import React from 'react';
import Swal from 'sweetalert2';
import type { useToast } from '../../../components/feedback/Toast';
import { promotionsApi } from '../api/providerDashboardApi';
import { toLocalDateKey } from '../shared/dateHelpers';
import type { useProviderCampaignState } from './useProviderCampaignState';

type Dependencies = Pick<ReturnType<typeof useProviderCampaignState>,
  'setActiveCampaign' | 'setCampaignOccasion' | 'setCampaignPercent' | 'setCampaignStart' | 'setCampaignEnd' | 'setIsCampaignModalOpen' | 'campaignOccasion' | 'campaignPercent' | 'campaignStart' | 'campaignEnd' | 'setSubmittingCampaign'
> &
{
  toast: ReturnType<typeof useToast>;
  fetchProducts: () => Promise<void>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createCampaignActions({
  setActiveCampaign, setCampaignOccasion, setCampaignPercent, setCampaignStart, setCampaignEnd,
  setIsCampaignModalOpen, campaignOccasion, toast, campaignPercent, campaignStart, campaignEnd,
  setSubmittingCampaign, fetchProducts,
}: Dependencies) {
  const fetchActiveCampaign = async () => {
    try {
      const res = await promotionsApi.getCampaign() as any;
      if (res && res._id) {
        setActiveCampaign(res);
        setCampaignOccasion(res.occasion);
        setCampaignPercent(res.discountPercent.toString());
        setCampaignStart(new Date(res.startDate).toISOString().split('T')[0]);
        setCampaignEnd(new Date(res.endDate).toISOString().split('T')[0]);
      } else {
        setActiveCampaign(null);
        // Default dates
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        setCampaignStart(toLocalDateKey(today));
        setCampaignEnd(toLocalDateKey(nextWeek));
      }
    } catch (err) {
      console.error('Error fetching campaign:', err);
    }
  };

  const openCampaignModal = () => {
    setIsCampaignModalOpen(true);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignOccasion.trim()) {
      toast.error('Vui lòng nhập dịp khuyến mãi');
      return;
    }
    const percent = parseInt(campaignPercent, 10);
    if (isNaN(percent) || percent < 1 || percent > 90) {
      toast.error('Phần trăm giảm giá phải từ 1% đến 90%');
      return;
    }
    if (!campaignStart || !campaignEnd) {
      toast.error('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc');
      return;
    }

    setSubmittingCampaign(true);
    try {
      await promotionsApi.createCampaign({
        occasion: campaignOccasion.trim(),
        discountPercent: percent,
        startDate: new Date(campaignStart).toISOString(),
        endDate: new Date(campaignEnd).toISOString(),
      });
      toast.success('Tạo chiến dịch khuyến mãi thành công');
      setIsCampaignModalOpen(false);
      fetchActiveCampaign();
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Lỗi khi tạo khuyến mãi');
    } finally {
      setSubmittingCampaign(false);
    }
  };

  const handleDeactivateCampaign = async () => {
    const result = await Swal.fire({
      title: 'Tắt chương trình khuyến mãi?',
      text: 'Tất cả sản phẩm sẽ quay về giá gốc ngay lập tức.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Tắt khuyến mãi',
      cancelButtonText: 'Giữ nguyên',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#71717A',
    });
    if (!result.isConfirmed) return;

    setSubmittingCampaign(true);
    try {
      await promotionsApi.deactivateCampaign();
      toast.success('Đã tắt khuyến mãi thành công, các sản phẩm quay về giá gốc');
      setActiveCampaign(null);
      setCampaignOccasion('');
      setCampaignPercent('10');
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      setCampaignStart(toLocalDateKey(today));
      setCampaignEnd(toLocalDateKey(nextWeek));
      setIsCampaignModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Lỗi khi tắt khuyến mãi');
    } finally {
      setSubmittingCampaign(false);
    }
  };

  return { fetchActiveCampaign, openCampaignModal, handleDeactivateCampaign, handleCreateCampaign };
}
