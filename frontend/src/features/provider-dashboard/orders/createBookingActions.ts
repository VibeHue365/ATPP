import Swal from 'sweetalert2';
import type { useToast } from '../../../components/feedback/Toast';
import { API_BASE_URL } from '../../../config/env';
import { bookingsApi } from '../api/providerDashboardApi';
import { statusDisplayMap } from '../constants';
import type { Order } from '../types';
import type { useProviderOrderState } from './useProviderOrderState';

type Dependencies = Pick<ReturnType<typeof useProviderOrderState>,
  'orders' | 'setActionMenuId' | 'setOrders'
> &
{
  toast: ReturnType<typeof useToast>;
  fetchOrders: (silent?: boolean, force?: boolean) => Promise<void>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createBookingActions({ orders, setActionMenuId, setOrders, toast, fetchOrders }: Dependencies) {
  const changeOrderStatus = async (_id: string, apiStatus: string) => {
    const order = orders.find(o => o._id === _id || o.id === _id);

    // ===== PHOTOGRAPHY / COMBO: Bàn giao sản phẩm buổi chụp → AWAITING_REVIEW =====
    const isPhotographyOrder = order?.bookingType === 'PHOTOGRAPHY' || order?.bookingType === 'COMBO' || order?.items?.some((i: any) => i.itemType === 'PHOTOGRAPHY_PACKAGE');
    if (apiStatus === 'AWAITING_REVIEW' && isPhotographyOrder) {
      const result = await Swal.fire({
        title: 'Bàn giao sản phẩm buổi chụp',
        html: `
          <div style="display: flex; flex-direction: column; gap: 14px; text-align: left; padding: 6px 0;">
            <p style="font-size: 13px; color: #4B5563; margin: 0; line-height: 1.5;">
              Nhập <strong>Link Kho Ảnh Gốc (Google Drive / Cloud)</strong> và/hoặc <strong>Tải lên ảnh xem trước</strong> để gửi cho khách hàng xem & xác nhận.
            </p>

            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label for="delivery-drive-url-input" style="font-size: 12.5px; font-weight: 700; color: #1E293B; display: flex; align-items: center; gap: 6px;">
                🔗 Link Kho Ảnh Gốc (Google Drive / Cloud)
              </label>
              <input
                type="url"
                id="delivery-drive-url-input"
                placeholder="https://drive.google.com/drive/folders/..."
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1.5px solid #CBD5E1;
                  border-radius: 8px;
                  font-size: 13px;
                  box-sizing: border-box;
                  outline: none;
                "
                value="${(order as any)?.deliveryDriveUrl || ''}"
              />
              <small style="font-size: 11px; color: #64748B;">Lưu ý: Bật quyền "Người có liên kết có thể xem" cho thư mục Drive.</small>
            </div>

            <div style="border-top: 1px dashed #E2E8F0; margin: 2px 0;"></div>

            <div style="display: flex; flex-direction: column; gap: 6px; align-items: center;">
              <label style="font-size: 12.5px; font-weight: 700; color: #1E293B; width: 100%; text-align: left;">
                📸 Ảnh kết quả xem trước
              </label>
              <label for="delivered-photo-input" style="
                width: 100%;
                height: 100px;
                border: 2px dashed #BFDBFE;
                border-radius: 12px;
                background-color: #EFF6FF;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease-in-out;
                gap: 4px;
                padding: 12px;
                box-sizing: border-box;
              "
              onmouseover="this.style.borderColor='#1D4ED8'; this.style.backgroundColor='#DBEAFE';"
              onmouseout="this.style.borderColor='#BFDBFE'; this.style.backgroundColor='#EFF6FF';"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span style="font-size: 12px; font-weight: 700; color: #1D4ED8;">Tải lên ảnh kết quả</span>
                <span style="font-size: 11px; color: #6B7280;">Hỗ trợ nhiều hình ảnh JPG, PNG, WEBP</span>
                <input type="file" id="delivered-photo-input" multiple accept="image/*" style="display: none;" />
              </label>
              <div id="delivered-photo-preview" style="
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                justify-content: center;
                margin-top: 10px;
                width: 100%;
              "></div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#1D4ED8',
        cancelButtonColor: '#9CA3AF',
        confirmButtonText: '📸 Bàn giao ảnh cho khách hàng',
        cancelButtonText: 'Hủy',
        background: 'white',
        didOpen: () => {
          const fileInput = document.getElementById('delivered-photo-input') as HTMLInputElement;
          const previewContainer = document.getElementById('delivered-photo-preview') as HTMLDivElement;
          if (fileInput && previewContainer) {
            fileInput.addEventListener('change', async (e: any) => {
              const files = e.target.files;
              if (!files || files.length === 0) return;
              previewContainer.innerHTML = '<span style="font-size: 12px; color: #1D4ED8; font-weight: 600;">⏳ Đang tải ảnh...</span>';
              const uploadedUrls: string[] = [];
              try {
                for (let i = 0; i < files.length; i++) {
                  const formData = new FormData();
                  formData.append('file', files[i]);
                  const res: any = await bookingsApi.uploadReference(formData);
                  if (res.url) uploadedUrls.push(res.url);
                }
                previewContainer.innerHTML = '';
                uploadedUrls.forEach(url => {
                  const wrapper = document.createElement('div');
                  wrapper.style.cssText = 'position:relative;width:64px;height:64px;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:2px solid #BFDBFE;';
                  const img = document.createElement('img');
                  img.src = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
                  img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                  img.className = 'delivered-uploaded-img';
                  img.dataset.url = url;
                  wrapper.appendChild(img);
                  previewContainer.appendChild(wrapper);
                });
              } catch (_err) {
                previewContainer.innerHTML = '<span style="font-size: 12px; color: #C0392B; font-weight: 600;">❌ Tải ảnh thất bại!</span>';
              }
            });
          }
        },
        preConfirm: () => {
          const driveInput = document.getElementById('delivery-drive-url-input') as HTMLInputElement;
          const driveUrl = driveInput?.value?.trim() || '';

          const imgs = document.querySelectorAll('.delivered-uploaded-img');
          const deliveredPhotos: string[] = [];
          imgs.forEach((img: any) => {
            if (img.dataset.url) deliveredPhotos.push(img.dataset.url);
          });

          if (!driveUrl && deliveredPhotos.length === 0) {
            Swal.showValidationMessage('Vui lòng nhập Link Drive kho ảnh hoặc tải lên ít nhất 1 ảnh kết quả!');
            return false;
          }

          if (driveUrl && !/^https?:\/\//i.test(driveUrl)) {
            Swal.showValidationMessage('Đường dẫn Drive không hợp lệ! Vui lòng nhập URL hợp lệ (bắt đầu bằng http:// hoặc https://)');
            return false;
          }

          return { deliveredPhotos, deliveryDriveUrl: driveUrl };
        }
      });

      if (!result.isConfirmed || !result.value) {
        setActionMenuId(null);
        return;
      }

      const { deliveredPhotos, deliveryDriveUrl } = result.value;
      try {
        await bookingsApi.updateStatus(_id, {
          status: apiStatus,
          deliveredPhotos: deliveredPhotos.length > 0 ? deliveredPhotos : undefined,
          deliveryDriveUrl: deliveryDriveUrl || undefined,
        });
        const displayStatus = statusDisplayMap[apiStatus] || apiStatus;
        setOrders(prev => prev.map(o => (o._id === _id || o.id === _id) ? { ...o, status: displayStatus, rawStatus: apiStatus, deliveredPhotos, deliveryDriveUrl } : o));
        toast.success('Đã bàn giao sản phẩm ảnh cho khách hàng thành công!');
      } catch (err: any) {
        toast.error(err.message || 'Gửi ảnh thất bại');
      }
      setActionMenuId(null);
      return;
    }

    // ===== PHOTOGRAPHY: Hủy/Từ chối lịch chụp → yêu cầu nhập lý do =====
    if (apiStatus === 'CANCELLED' && order?.bookingType === 'PHOTOGRAPHY') {
      const result = await Swal.fire({
        title: 'Từ chối / Hủy toàn bộ booking',
        html: `
          <p style="font-size: 13px; color: #6B7280; margin-bottom: 14px; line-height: 1.5;">
            Vui lòng cho khách hàng biết lý do bạn từ chối hoặc hủy lịch chụp này.
            Lý do sẽ được gửi trực tiếp đến khách hàng.
          </p>
        `,
        input: 'textarea',
        inputLabel: 'Lý do hủy (bắt buộc)',
        inputPlaceholder: 'VD: Tôi bận lịch vào ngày này / Thời tiết không phù hợp / ...',
        inputAttributes: {
          'aria-label': 'Lý do hủy',
          style: 'font-size: 13px; min-height: 80px;',
        },
        showCancelButton: true,
        confirmButtonColor: '#d32f2f',
        cancelButtonColor: '#9CA3AF',
        confirmButtonText: 'Xác nhận hủy đơn',
        cancelButtonText: 'Quay lại',
        background: 'white',
        inputValidator: (value) => {
          if (!value || !value.trim()) {
            return 'Bạn phải nhập lý do hủy để khách hàng biết!';
          }
          return null;
        },
      });

      if (!result.isConfirmed || !result.value) {
        setActionMenuId(null);
        return;
      }

      const reason = result.value.trim();
      try {
        await bookingsApi.cancel(_id, { reason });
        const displayStatus = statusDisplayMap['CANCELLED'] || 'Đã hủy';
        setOrders(prev => prev.map(o => (o._id === _id || o.id === _id) ? { ...o, status: displayStatus, rawStatus: 'CANCELLED' } : o));
        toast.success('Đã hủy lịch chụp. Lý do đã được gửi cho khách hàng.');
      } catch (err: any) {
        toast.error(err.message || 'Hủy đơn thất bại');
      }
      setActionMenuId(null);
      return;
    }

    // ===== PHOTOGRAPHY: Báo khách vắng mặt (No-Show) với Ảnh bằng chứng =====
    if (apiStatus === 'NO_SHOW') {
      let uploadedProofUrls: string[] = [];

      const result = await Swal.fire({
        title: '📸 Báo khách vắng mặt (No-Show)',
        html: `
          <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 6px 0; text-align: left;">
            <p style="font-size: 13px; color: #4B5563; margin-bottom: 14px; line-height: 1.5; width: 100%;">
              Vui lòng nhập mô tả chi tiết và tải ảnh bằng chứng (ảnh cuộc gọi, tin nhắn, ảnh check-in điểm hẹn) để đối soát khi khách vắng mặt. Tiền cọc sẽ được chuyển bồi thường cho bạn.
            </p>

            <label style="font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 6px; width: 100%;">Lý do / Mô tả chi tiết (bắt buộc):</label>
            <textarea id="noshow-reason-input" style="width: 100%; height: 80px; padding: 8px 12px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 13px; margin-bottom: 14px; box-sizing: border-box;" placeholder="VD: Đã đứng chờ lúc 08:00 tại Chùa Linh Ứng đến 08:45 nhưng khách không tới, gọi 5 cuộc không nghe máy..."></textarea>

            <label style="font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 6px; width: 100%;">Tải ảnh bằng chứng (ảnh màn hình cuộc gọi, tin nhắn, vị trí check-in):</label>
            <input type="file" id="noshow-proof-files" multiple accept="image/*" style="width: 100%; font-size: 12px; margin-bottom: 6px;" />
            <div id="noshow-upload-status" style="font-size: 11px; color: #059669; font-weight: 600; margin-top: 2px; width: 100%;"></div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#d32f2f',
        cancelButtonColor: '#9CA3AF',
        confirmButtonText: 'Gửi báo cáo & Thu cọc',
        cancelButtonText: 'Quay lại',
        didOpen: () => {
          const fileInput = document.getElementById('noshow-proof-files') as HTMLInputElement;
          const statusDiv = document.getElementById('noshow-upload-status') as HTMLDivElement;
          if (fileInput) {
            fileInput.onchange = async () => {
              const files = fileInput.files;
              if (!files || files.length === 0) return;
              statusDiv.innerText = '⏳ Đang tải ảnh bằng chứng...';
              uploadedProofUrls = [];
              for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append('file', files[i]);
                try {
                  const res: any = await bookingsApi.uploadEvidence(formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                  if (res.data?.url) {
                    uploadedProofUrls.push(res.data.url);
                  }
                } catch (e) { console.error('Upload proof err', e); }
              }
              statusDiv.innerText = `✓ Đã tải lên ${uploadedProofUrls.length} ảnh bằng chứng thành công!`;
            };
          }
        },
        preConfirm: () => {
          const reasonInput = (document.getElementById('noshow-reason-input') as HTMLTextAreaElement)?.value || '';
          if (!reasonInput.trim()) {
            Swal.showValidationMessage('Vui lòng nhập mô tả / lý do báo cáo vắng mặt!');
            return false;
          }
          return { reason: reasonInput.trim(), photos: uploadedProofUrls };
        }
      });

      if (!result.isConfirmed || !result.value) {
        setActionMenuId(null);
        return;
      }

      const { reason, photos } = result.value;
      try {
        await bookingsApi.cancel(_id, {
          reason: `[KHÁCH VẮNG MẶT - NO SHOW] ${reason}`,
          reportPhotos: photos
        });
        const displayStatus = statusDisplayMap['CANCELLED'] || 'Đã hủy';
        setOrders(prev => prev.map(o => (o._id === _id || o.id === _id) ? { ...o, status: displayStatus, rawStatus: 'CANCELLED' } : o));
        toast.success('Đã gửi báo cáo Khách vắng mặt thành công kèm ảnh bằng chứng. Tiền cọc sẽ được bồi thường cho bạn!');
      } catch (err: any) {
        toast.error(err.message || 'Báo cáo thất bại');
      }
      setActionMenuId(null);
      return;
    }

    if (apiStatus === 'PICKUP_PENDING') {
      const result = await Swal.fire({
        title: 'Bàn giao trang phục',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0;">
            <p style="font-size: 13px; color: #6B7280; margin-bottom: 18px; text-align: center; line-height: 1.5; max-width: 360px;">
              Ảnh chụp rõ nét tình trạng tổng thể, cổ áo, tà áo và các chi tiết quan trọng lúc giao hàng làm bằng chứng đối soát.
            </p>
            <label for="handover-file-input" style="
              width: 100%;
              max-width: 320px;
              height: 130px;
              border: 2px dashed #D1D5DB;
              border-radius: 12px;
              background-color: #F9FAFB;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.2s ease-in-out;
              gap: 8px;
              padding: 16px;
              box-sizing: border-box;
            "
            onmouseover="this.style.borderColor='var(--color-primary-dark)'; this.style.backgroundColor='#FFFDF9';"
            onmouseout="this.style.borderColor='#D1D5DB'; this.style.backgroundColor='#F9FAFB';"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8C827A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span style="font-size: 13px; font-weight: 700; color: #4B5563; margin-top: 4px;">Tải lên ảnh bàn giao</span>
              <span style="font-size: 11px; color: #9CA3AF;">Hỗ trợ nhiều hình ảnh JPG, PNG, WEBP</span>
              <input type="file" id="handover-file-input" multiple accept="image/*" style="display: none;" />
            </label>
            <div id="handover-preview-container" style="
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
              justify-content: center;
              margin-top: 20px;
              width: 100%;
              max-width: 360px;
            "></div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonColor: 'var(--color-primary-dark)',
        cancelButtonColor: '#9CA3AF',
        confirmButtonText: 'Xác nhận Bàn giao',
        cancelButtonText: 'Hủy',
        background: 'white',
        didOpen: () => {
          const fileInput = document.getElementById('handover-file-input') as HTMLInputElement;
          const previewContainer = document.getElementById('handover-preview-container') as HTMLDivElement;
          if (fileInput && previewContainer) {
            fileInput.addEventListener('change', async (e: any) => {
              const files = e.target.files;
              if (!files || files.length === 0) return;
              previewContainer.innerHTML = '<span style="font-size: 12px; color: #8C827A; font-weight: 600;">⏳ Đang tải ảnh...</span>';

              const uploadedUrls: string[] = [];
              try {
                for (let i = 0; i < files.length; i++) {
                  const formData = new FormData();
                  formData.append('file', files[i]);
                  const res: any = await bookingsApi.uploadReference(formData);
                  if (res.url) uploadedUrls.push(res.url);
                }

                previewContainer.innerHTML = '';
                uploadedUrls.forEach(url => {
                  const wrapper = document.createElement('div');
                  wrapper.style.position = 'relative';
                  wrapper.style.width = '64px';
                  wrapper.style.height = '64px';
                  wrapper.style.borderRadius = '8px';
                  wrapper.style.overflow = 'hidden';
                  wrapper.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                  wrapper.style.border = '1px solid #E5E7EB';

                  const img = document.createElement('img');
                  img.src = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
                  img.style.width = '100%';
                  img.style.height = '100%';
                  img.style.objectFit = 'cover';
                  img.className = 'handover-uploaded-img';
                  img.dataset.url = url;

                  wrapper.appendChild(img);
                  previewContainer.appendChild(wrapper);
                });
              } catch (err) {
                previewContainer.innerHTML = '<span style="font-size: 12px; color: #C0392B; font-weight: 600;">❌ Tải ảnh thất bại!</span>';
              }
            });
          }
        },
        preConfirm: () => {
          const imgs = document.querySelectorAll('.handover-uploaded-img');
          const urls: string[] = [];
          imgs.forEach((img: any) => {
            if (img.dataset.url) urls.push(img.dataset.url);
          });
          if (urls.length === 0) {
            Swal.showValidationMessage('Vui lòng tải lên ít nhất 1 hình ảnh bàn giao!');
            return false;
          }
          return urls;
        }
      });

      if (!result.isConfirmed || !result.value) {
        setActionMenuId(null);
        return;
      }

      const handoverPhotos = result.value;
      try {
        await bookingsApi.updateStatus(_id, { status: apiStatus, handoverPhotos });
        const displayStatus = statusDisplayMap[apiStatus] || apiStatus;
        setOrders(prev => prev.map(o => (o._id === _id || o.id === _id) ? { ...o, status: displayStatus, rawStatus: apiStatus, handoverPhotos } : o));
        toast.success(`Đã bàn giao và cập nhật trạng thái đơn hàng thành "${displayStatus}"!`);
      } catch (err: any) {
        toast.error(err.message || 'Cập nhật trạng thái thất bại');
      }
      setActionMenuId(null);
      return;
    }

    if (apiStatus === 'SESSION_START' || apiStatus === 'SESSION_COMPLETE') {
      try {
        await bookingsApi.updateStatus(_id, { status: 'IN_PROGRESS' });
        await fetchOrders(true, true);
        toast.success(
          apiStatus === 'SESSION_START'
            ? 'Đã bắt đầu buổi chụp.'
            : 'Đã hoàn tất buổi chụp. Bạn có thể bắt đầu buổi kế tiếp.',
        );
      } catch (err: any) {
        toast.error(err.message || 'Cập nhật buổi chụp thất bại');
      }
      setActionMenuId(null);
      return;
    }
    try {
      await bookingsApi.updateStatus(_id, { status: apiStatus });
      const displayStatus = statusDisplayMap[apiStatus] || apiStatus;
      setOrders(prev => prev.map(o => (o._id === _id || o.id === _id) ? { ...o, status: displayStatus, rawStatus: apiStatus } : o));
      toast.success(`Đã cập nhật trạng thái đơn hàng thành "${displayStatus}"!`);
    } catch (err: any) {
      toast.error(err.message || 'Cập nhật trạng thái thất bại');
    }
    setActionMenuId(null);
  };

  const resolveRescheduleRequest = async (order: Order, item: any, approved: boolean) => {
    const result = await Swal.fire({
      title: approved ? 'Duyệt yêu cầu đổi lịch?' : 'Từ chối yêu cầu đổi lịch?',
      text: approved
        ? 'Lịch chỉ được cập nhật nếu thời gian đề xuất vẫn còn trống tại thời điểm duyệt.'
        : 'Bạn có thể ghi chú để khách hiểu lý do từ chối.',
      input: 'textarea',
      inputLabel: approved ? 'Ghi chú cho khách (không bắt buộc)' : 'Lý do từ chối (không bắt buộc)',
      inputPlaceholder: 'Nhập ghi chú...',
      showCancelButton: true,
      confirmButtonText: approved ? 'Duyệt đổi lịch' : 'Từ chối yêu cầu',
      cancelButtonText: 'Hủy',
      confirmButtonColor: approved ? '#1E7A46' : '#C0392B',
    });
    if (!result.isConfirmed) return;

    try {
      await bookingsApi.resolveReschedule(order._id, item._id, {
        approved,
        note: typeof result.value === 'string' && result.value.trim() ? result.value.trim() : undefined,
      });
      toast.success(approved ? 'Đã duyệt yêu cầu đổi lịch.' : 'Đã từ chối yêu cầu đổi lịch.');
      setActionMenuId(null);
      await fetchOrders();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xử lý yêu cầu đổi lịch.');
    }
  };

  return { resolveRescheduleRequest, changeOrderStatus };
}
