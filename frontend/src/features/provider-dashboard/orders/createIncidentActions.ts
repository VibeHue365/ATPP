import React from 'react';
import type { useToast } from '../../../components/feedback/Toast';
import { bookingsApi } from '../api/providerDashboardApi';
import type { useProviderIncidentState } from './useProviderIncidentState';

type Dependencies = Pick<ReturnType<typeof useProviderIncidentState>,
  'setIncidentPhotos' | 'reportingOrder' | 'selectedItemId' | 'incidentPhotos' | 'incidentAmount' | 'incidentDesc' | 'incidentActionType' | 'setReportingOrder' | 'setSelectedItemId' | 'setIncidentDesc' | 'setIncidentAmount' | 'setIncidentActionType'
> &
{
  toast: ReturnType<typeof useToast>;
  fetchOrders: (silent?: boolean, force?: boolean) => Promise<void>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createIncidentActions({
  toast, setIncidentPhotos, reportingOrder, selectedItemId, incidentPhotos, incidentAmount,
  incidentDesc, incidentActionType, setReportingOrder, setSelectedItemId, setIncidentDesc,
  setIncidentAmount, setIncidentActionType, fetchOrders,
}: Dependencies) {
  const handleIncidentPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    toast.info('Đang tải ảnh lên...');
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }
      const res: any = await bookingsApi.uploadIncidentEvidence(formData);
      if (res.urls && Array.isArray(res.urls)) {
        setIncidentPhotos(prev => [...prev, ...res.urls]);
        toast.success('Tải ảnh thành công!');
      } else {
        toast.error('Tải ảnh thất bại: Phản hồi không hợp lệ từ máy chủ.');
      }
    } catch (err: any) {
      toast.error('Tải ảnh thất bại: ' + (err.message || ''));
    }
  };

  const handleSendIncidentReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingOrder || !selectedItemId) {
      toast.error('Vui lòng chọn sản phẩm gặp sự cố!');
      return;
    }
    if (incidentPhotos.length === 0) {
      toast.error('Báo cáo sự cố bắt buộc phải có ít nhất 1 hình ảnh làm bằng chứng!');
      return;
    }
    if (incidentAmount > (reportingOrder.depositTotal || 0)) {
      toast.error(`Tiền đền bù không được vượt quá số tiền cọc (${(reportingOrder.depositTotal || 0).toLocaleString()}đ)`);
      return;
    }
    try {
      await bookingsApi.reportIncident({
        bookingId: reportingOrder._id,
        bookingItemId: selectedItemId,
        description: incidentDesc,
        evidencePhotos: incidentPhotos,
        requestedAmount: incidentAmount,
        actionType: incidentActionType,
      });
      toast.success('Báo cáo sự cố thành công! Đơn đặt lịch đã chuyển sang trạng thái chờ giải quyết.');
      setReportingOrder(null);
      setSelectedItemId('');
      setIncidentDesc('');
      setIncidentPhotos([]);
      setIncidentAmount(0);
      setIncidentActionType('CLEANING');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Gửi báo cáo sự cố thất bại');
    }
  };

  return { handleSendIncidentReport, handleIncidentPhotoUpload };
}
