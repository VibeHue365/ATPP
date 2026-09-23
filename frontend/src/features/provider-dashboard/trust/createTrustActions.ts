import React from 'react';
import type { useToast } from '../../../components/feedback/Toast';
import { reviewsApi } from '../api/providerDashboardApi';
import type { useProviderNavigationState } from '../hooks/useProviderNavigationState';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import type { useProviderTrustState } from './useProviderTrustState';

type Dependencies = Pick<ReturnType<typeof useProviderSessionState>,
  'setIsDetailModalOpen'
> &
  Pick<ReturnType<typeof useProviderNavigationState>,
    'setCurrentView'
  > &
  Pick<ReturnType<typeof useProviderTrustState>,
    'setSearchCustId' | 'setTrustScoreResult' | 'ratingBooking' | 'cRating' | 'cComment' | 'setRatingBooking' | 'setCComment' | 'setCRating' | 'searchCustId'
  > &
{
  toast: ReturnType<typeof useToast>;
  fetchProviderData: () => Promise<void>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createTrustActions({
  setIsDetailModalOpen, setCurrentView, setSearchCustId, setTrustScoreResult, ratingBooking, cRating,
  cComment, toast, setRatingBooking, setCComment, setCRating, fetchProviderData, searchCustId,
}: Dependencies) {
  const viewCustomerTrust = async (custId: string) => {
    setIsDetailModalOpen(false);
    setCurrentView('trust');
    setSearchCustId(custId);
    try {
      const res = await reviewsApi.getUserTrust(custId);
      setTrustScoreResult(res);
    } catch (err) {
      console.error('Không thể tải điểm tín nhiệm:', err);
    }
  };

  const handleRateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingBooking) return;
    try {
      await reviewsApi.rateCustomer({
        bookingId: ratingBooking.bookingId,
        rating: cRating,
        comment: cComment,
      });
      toast.success('Đã gửi đánh giá tín nhiệm khách hàng thành công!');
      setRatingBooking(null);
      setCComment('');
      setCRating(5);
      fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Đánh giá khách hàng thất bại');
    }
  };

  const handleSearchTrustScore = async () => {
    if (!searchCustId) return;
    try {
      const res: any = await reviewsApi.getCustomerReviewTrust(searchCustId);
      setTrustScoreResult(res);
      toast.success('Đồng bộ tín nhiệm khách hàng hoàn tất!');
    } catch (err: any) {
      toast.error('Không thể tìm thấy khách hàng này');
      setTrustScoreResult(null);
    }
  };

  return { handleSearchTrustScore, handleRateCustomer, viewCustomerTrust };
}
