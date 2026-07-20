import { useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../../../config/env';
import { adminReportedReviewsApi } from '../api/adminReportedReviewsApi';
import { useReportedReviews } from '../hooks/useReportedReviews';
import type { ReportAction, ReportedReview } from '../types';
import './reportedReviews.css';

const actionCopy: Record<ReportAction, { title: string; confirmText: string; description: string }> = {
  DELETE: {
    title: 'Gỡ đánh giá vi phạm?',
    confirmText: 'Gỡ đánh giá',
    description: 'Đánh giá sẽ bị xóa khỏi hệ thống và khách hàng sẽ nhận được thông báo.',
  },
  DISMISS: {
    title: 'Giữ lại đánh giá?',
    confirmText: 'Giữ đánh giá',
    description: 'Báo cáo sẽ được đóng; đánh giá vẫn được hiển thị công khai.',
  },
};

const getBookingLabel = (review: ReportedReview) =>
  review.bookingId?.bookingCode ?? review.bookingId?._id?.slice(-6).toUpperCase() ?? 'N/A';

const formatReportedAt = (value?: string) => {
  if (!value) return 'Không rõ thời điểm';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không rõ thời điểm' : date.toLocaleString('vi-VN');
};

const imageUrl = (value: string) =>
  value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `${API_BASE_URL}${value}`;

export function ReportedReviewsPanel() {
  const { error, items, loading, refresh } = useReportedReviews();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleReport = async (review: ReportedReview, action: ReportAction) => {
    const copy = actionCopy[action];
    const result = await Swal.fire({
      title: copy.title,
      text: copy.description,
      input: 'textarea',
      inputLabel: 'Lý do xử lý',
      inputPlaceholder: 'Nhập lý do để thông báo cho các bên liên quan.',
      inputValidator: (value) =>
        value.trim() ? undefined : 'Vui lòng nhập lý do xử lý.',
      icon: action === 'DELETE' ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: copy.confirmText,
      cancelButtonText: 'Hủy',
    });

    if (!result.isConfirmed) return;

    setPendingId(review._id);
    try {
      await adminReportedReviewsApi.handle(review._id, action, result.value.trim());
      await refresh();
      await Swal.fire({
        title: 'Đã cập nhật',
        text: action === 'DELETE' ? 'Đánh giá đã được gỡ và các bên liên quan đã được thông báo.' : 'Báo cáo đã được đóng, đánh giá vẫn được giữ lại.',
        icon: 'success',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (requestError) {
      await Swal.fire({
        title: 'Không thể xử lý báo cáo',
        text: requestError instanceof Error ? requestError.message : 'Vui lòng thử lại.',
        icon: 'error',
      });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="admin-reviews">
      <div className="admin-reviews__toolbar"><button type="button" onClick={() => void refresh()} disabled={loading}>Tải lại</button></div>

      {error && <p className="admin-reviews__error" role="alert">{error}</p>}

      <div className="admin-reviews__table"><header><h3>Báo cáo vi phạm & spam đánh giá</h3></header>
        <table>
          <thead>
            <tr>
              <th>Booking</th>
              <th>Đối tác</th>
              <th>Khách hàng & đánh giá</th>
              <th>Lý do báo cáo</th>
              <th>Ngày báo cáo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((review) => (
              <tr key={review._id}>
                <td>
                  <strong>#{getBookingLabel(review)}</strong>
                </td>
                <td>{review.providerId?.businessName ?? 'Nhà cung cấp'}</td>
                <td>
                  <strong>{review.customerId?.profile?.fullName ?? 'Khách hàng'}</strong>
                  <small className="admin-reviews__rating">{'★'.repeat(review.rating ?? 0)}</small>
                  <small>{review.comment || 'Không có bình luận.'}</small>
                  {!!review.images?.length && (
                    <div className='admin-reviews__images' aria-label='Ảnh đính kèm đánh giá'>
                      {review.images.map((image, index) => (
                        <a key={image} href={imageUrl(image)} target='_blank' rel='noreferrer'>
                          <img src={imageUrl(image)} alt={`Ảnh đính kèm ${index + 1}`} />
                        </a>
                      ))}
                    </div>
                  )}
                </td>
                <td>{review.reportReason || 'Spam / vi phạm tiêu chuẩn'}</td>
                <td><small>{formatReportedAt(review.reportedAt)}</small></td>
                <td className="admin-reviews__actions">
                  <button
                    className="admin-reviews__remove"
                    type="button"
                    disabled={pendingId === review._id}
                    onClick={() => void handleReport(review, 'DELETE')}
                  >
                    Gỡ review
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === review._id}
                    onClick={() => void handleReport(review, 'DISMISS')}
                  >
                    Giữ review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !items.length && <p className="admin-reviews__empty">Không có báo cáo cần xử lý.</p>}
      </div>
    </section>
  );
}
