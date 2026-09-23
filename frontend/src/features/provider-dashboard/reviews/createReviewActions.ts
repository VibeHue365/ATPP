import React from 'react';
import type { useToast } from '../../../components/feedback/Toast';
import { reviewsApi } from '../api/providerDashboardApi';
import type { useProviderReviewsState } from './useProviderReviewsState';

type Dependencies = Pick<ReturnType<typeof useProviderReviewsState>,
  'replyingReviewId' | 'replyText' | 'setReplyingReviewId' | 'setReplyText'
> &
{
  toast: ReturnType<typeof useToast>;
  fetchProviderData: () => Promise<void>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createReviewActions({
  replyingReviewId, replyText, toast, setReplyingReviewId, setReplyText, fetchProviderData,
}: Dependencies) {
  const handleReplyReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingReviewId) return;
    try {
      await reviewsApi.reply(replyingReviewId, { reply: replyText });
      toast.success('Gửi phản hồi đánh giá thành công!');
      setReplyingReviewId(null);
      setReplyText('');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Không thể gửi phản hồi');
    }
  };

  const handleReportReview = async (reviewId: string) => {
    try {
      await reviewsApi.report(reviewId, { reason: 'Spam, ngôn từ không phù hợp' });
      toast.success('Đã gửi báo cáo vi phạm nội dung lên hệ thống admin!');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Báo cáo review thất bại');
    }
  };

  return { handleReportReview, handleReplyReview };
}
