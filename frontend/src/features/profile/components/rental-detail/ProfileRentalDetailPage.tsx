import React from 'react';
import { AlertTriangle, CheckSquare, Sparkles, XCircle, Shield, Upload, CheckCircle, Eye } from 'lucide-react';
import { RentalDetailHeader } from './RentalDetailHeader';
import { RentalMainCard } from './RentalMainCard';
import { RentalInfoColumns } from './RentalInfoColumns';
import { RentalTimelineAndPhotos } from './RentalTimelineAndPhotos';
import { RentalBottomActionBar } from './RentalBottomActionBar';
import { RentalPickupDamageReportCard } from './RentalPickupDamageReportCard';
import { RentalPickupReportModal, type PickupModalMode } from './RentalPickupReportModal';
import { RentalReturnModal } from './RentalReturnModal';
import { PrivateEvidenceImage } from '../../../../components/common/PrivateEvidenceImage';
import Swal from 'sweetalert2';
import { httpClient } from '../../../../services/httpClient';
import { useSocket } from '../../../../context/SocketContext';
import { getBookingStatusLabel } from '../../../../utils/bookingStatus';

interface ProfileRentalDetailPageProps {
  booking?: any;
  onBack: () => void;
  onOpenReschedule?: (item: any) => void;
  onOpenCancel?: (booking: any) => void;
  onRefreshBooking?: () => void;
  onContinuePayment?: (bookingId: string) => void;
}

export const ProfileRentalDetailPage: React.FC<ProfileRentalDetailPageProps> = ({
  booking,
  onBack,
  onOpenReschedule,
  onOpenCancel,
  onRefreshBooking,
  onContinuePayment
}) => {
  const [incident, setIncident] = React.useState<any>(booking?.incident || null);
  const [respondingIncident, setRespondingIncident] = React.useState<boolean>(false);
  const [pickupModalMode, setPickupModalMode] = React.useState<PickupModalMode | null>(null);
  const [isSubmittingPickup, setIsSubmittingPickup] = React.useState<boolean>(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = React.useState<boolean>(false);
  const [dominoAlternatives, setDominoAlternatives] = React.useState<any[]>([]);
  const [identityCardInfo, setIdentityCardInfo] = React.useState<any>(booking?.customerIdentityCard || null);

  React.useEffect(() => {
    if (!booking?._id) return;
    let isCurrent = true;
    httpClient.get<any>(`/api/bookings/${booking._id}/customer-identity`)
      .then((res) => {
        if (isCurrent && res) setIdentityCardInfo(res);
      })
      .catch(() => { });
    return () => {
      isCurrent = false;
    };
  }, [booking?._id, booking?.updatedAt]);

  const handleUploadCccd = async () => {
    if (!booking?._id) return;
    try {
      const result = await Swal.fire({
        width: '540px',
        padding: '20px 24px 24px',
        html: `
          <div style="text-align: left; font-family: inherit; color: #231F20;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <div style="width: 38px; height: 38px; border-radius: 10px; background: #FFF1F2; color: #8E1B2E; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #231F20;">Xác thực CCCD nhận trang phục</h3>
                <p style="margin: 2px 0 0; font-size: 12px; color: #7D736B;">Đối soát bảo mật trước khi cửa hàng bàn giao áo dài</p>
              </div>
            </div>

            <p style="margin: 0 0 14px; font-size: 12.5px; color: #5C534A; line-height: 1.5; background: #FCFAF8; padding: 10px 12px; border-radius: 10px; border: 1px solid #EFE9E1;">
              Chỉ <strong>bạn, Cửa hàng phụ trách đơn và Quản trị viên TàGo</strong> được phép xem ảnh đối soát. Ảnh tự động xóa sau <strong>1 ngày</strong> khi đơn hoàn tất hoặc hủy (nếu không có tranh chấp).
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
              <label for="cust-cccd-front" style="position: relative; height: 142px; border: 1.5px dashed #D8CFC4; border-radius: 12px; background: #FCFAF8; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; transition: border-color 0.15s;">
                <input id="cust-cccd-front" type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" style="display: none;" />
                <div id="cust-cccd-front-placeholder" style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 12px;">
                  <div style="width: 36px; height: 36px; border-radius: 50%; background: #FFF1F2; color: #8E1B2E; display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                  <span style="font-size: 12.5px; font-weight: 750; color: #231F20;">Mặt trước CCCD <span style="color: #E11D48;">*</span></span>
                  <span style="font-size: 11px; color: #8C827A; margin-top: 3px;">Chạm để chọn / chụp</span>
                </div>
                <img id="cust-cccd-front-preview" style="display: none; width: 100%; height: 100%; object-fit: cover;" alt="Mặt trước CCCD" />
                <div id="cust-cccd-front-badge" style="display: none; position: absolute; bottom: 0; left: 0; right: 0; background: rgba(35,31,32,0.72); color: #FFF; font-size: 11px; font-weight: 600; text-align: center; padding: 4px 6px;">✓ Mặt trước • Bấm để đổi</div>
              </label>

              <label for="cust-cccd-back" style="position: relative; height: 142px; border: 1.5px dashed #D8CFC4; border-radius: 12px; background: #FCFAF8; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; transition: border-color 0.15s;">
                <input id="cust-cccd-back" type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" style="display: none;" />
                <div id="cust-cccd-back-placeholder" style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 12px;">
                  <div style="width: 36px; height: 36px; border-radius: 50%; background: #F3EFEA; color: #6B625A; display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                  <span style="font-size: 12.5px; font-weight: 750; color: #231F20;">Mặt sau CCCD</span>
                  <span style="font-size: 11px; color: #8C827A; margin-top: 3px;">Chạm để chọn / chụp</span>
                </div>
                <img id="cust-cccd-back-preview" style="display: none; width: 100%; height: 100%; object-fit: cover;" alt="Mặt sau CCCD" />
                <div id="cust-cccd-back-badge" style="display: none; position: absolute; bottom: 0; left: 0; right: 0; background: rgba(35,31,32,0.72); color: #FFF; font-size: 11px; font-weight: 600; text-align: center; padding: 4px 6px;">✓ Mặt sau • Bấm để đổi</div>
              </label>
            </div>

            <div style="font-size: 11.5px; color: #059669; margin-top: 8px; display: flex; align-items: center; gap: 6px; font-weight: 500;">
              <span>🔒 Dữ liệu được mã hóa &amp; lưu tại kho riêng tư theo Nghị định 13/2023/NĐ-CP.</span>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Lưu CCCD',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#8E1B2E',
        cancelButtonColor: '#6B7280',
        didOpen: (popup) => {
          popup.style.paddingTop = '22px';
          const iconEl = popup.querySelector('.swal2-icon') as HTMLElement | null;
          if (iconEl) {
            iconEl.style.setProperty('display', 'none', 'important');
          }
          const titleEl = popup.querySelector('.swal2-title') as HTMLElement | null;
          if (titleEl && !titleEl.textContent?.trim()) {
            titleEl.style.setProperty('display', 'none', 'important');
          }
          const htmlEl = popup.querySelector('.swal2-html-container') as HTMLElement | null;
          if (htmlEl) {
            htmlEl.style.setProperty('margin-top', '0', 'important');
            htmlEl.style.setProperty('padding-top', '0', 'important');
          }
          const bindPreview = (side: 'front' | 'back') => {
            const input = document.getElementById(`cust-cccd-${side}`) as HTMLInputElement | null;
            const placeholder = document.getElementById(`cust-cccd-${side}-placeholder`);
            const preview = document.getElementById(`cust-cccd-${side}-preview`) as HTMLImageElement | null;
            const badge = document.getElementById(`cust-cccd-${side}-badge`);
            input?.addEventListener('change', () => {
              const file = input.files?.[0];
              if (!file || !preview || !placeholder || !badge) return;
              preview.src = URL.createObjectURL(file);
              preview.style.display = 'block';
              badge.style.display = 'block';
              placeholder.style.display = 'none';
            });
          };
          bindPreview('front');
          bindPreview('back');
        },
        preConfirm: () => {
          const frontInput = document.getElementById('cust-cccd-front') as HTMLInputElement | null;
          const backInput = document.getElementById('cust-cccd-back') as HTMLInputElement | null;

          if (!frontInput?.files?.[0]) {
            Swal.showValidationMessage('Vui lòng chụp hoặc tải ảnh mặt trước CCCD!');
            return false;
          }
          return {
            frontFile: frontInput.files[0],
            backFile: backInput?.files?.[0] || null,
          };
        },
      });

      if (!result.isConfirmed || !result.value) return;

      const { frontFile, backFile } = result.value;
      const formData = new FormData();
      formData.append('front', frontFile);
      if (backFile) formData.append('back', backFile);

      Swal.fire({
        title: 'Đang tải ảnh CCCD an toàn...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await httpClient.post(`/api/bookings/${booking._id}/customer-identity`, formData);

      const freshCccd: any = await httpClient.get(`/api/bookings/${booking._id}/customer-identity`).catch(() => null);
      if (freshCccd) setIdentityCardInfo(freshCccd);

      await Swal.fire({
        icon: 'success',
        title: 'Đã lưu CCCD thành công!',
        text: 'Cửa hàng có thể đối soát hồ sơ khi bạn đến nhận áo.',
        confirmButtonColor: '#8E1B2E',
      });
      onRefreshBooking?.();
    } catch (err: any) {
      const rawMsg = String(err?.response?.data?.message || err?.message || '');
      const isTechnical =
        !rawMsg ||
        /mongo|cannot create field|internal server|500|exception|typeerror/i.test(rawMsg);
      const friendlyMsg = isTechnical
        ? 'Không thể lưu ảnh CCCD lúc này. Vui lòng kiểm tra ảnh tải lên (JPG, PNG, WEBP) và thử lại.'
        : rawMsg;
      Swal.fire({
        icon: 'warning',
        title: 'Chưa thể lưu CCCD',
        text: friendlyMsg,
        confirmButtonText: 'Đã hiểu',
        confirmButtonColor: '#8E1B2E',
      });
    }
  };

  const handleViewMyCccd = async () => {
    if (!booking?._id) return;
    try {
      Swal.fire({
        title: 'Đang tải ảnh CCCD...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      const res: any = await httpClient.get(`/api/bookings/${booking._id}/customer-identity`);
      if (!res?.hasIdentityCard) {
        Swal.fire({
          icon: 'info',
          title: 'Chưa có ảnh CCCD',
          text: 'Bạn chưa tải ảnh CCCD lên đơn thuê này.',
          confirmButtonColor: '#8E1B2E',
        });
        return;
      }
      let frontUrl = '';
      let backUrl = '';
      if (res.hasFrontImage) {
        const frontBlob = await httpClient.getBlob(`/api/bookings/${booking._id}/customer-identity/image/front`);
        frontUrl = URL.createObjectURL(frontBlob);
      }
      if (res.hasBackImage) {
        const backBlob = await httpClient.getBlob(`/api/bookings/${booking._id}/customer-identity/image/back`);
        backUrl = URL.createObjectURL(backBlob);
      }

      Swal.fire({
        width: '540px',
        padding: '22px 24px 24px',
        html: `
          <div style="text-align: left; font-family: inherit; color: #231F20;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 38px; height: 38px; border-radius: 10px; background: #DCFCE7; color: #16A34A; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <h3 style="margin: 0; font-size: 16.5px; font-weight: 800; color: #231F20;">CCCD đã xác thực của bạn</h3>
                  <p style="margin: 2px 0 0; font-size: 12px; color: #7D736B;">Hồ sơ đã được mã hóa AES-256 &amp; che bảo mật</p>
                </div>
              </div>
              <button type="button" id="toggle-my-cccd-blur" style="background: #FFF1F2; border: 1px solid #FECDD3; color: #8E1B2E; border-radius: 8px; padding: 6px 10px; font-size: 11.5px; font-weight: 700; cursor: pointer; white-space: nowrap;">
                👁 Hiện rõ ảnh
              </button>
            </div>

            <div style="background: #FCFAF8; padding: 10px 14px; border-radius: 10px; margin-bottom: 14px; border: 1px solid #EFE9E1; font-size: 12.5px;">
              <div><strong>Họ và tên:</strong> ${res.fullName || 'Khách thuê'}</div>
              <div style="font-size: 11.5px; color: #059669; margin-top: 4px;">🔒 Chỉ bạn, Cửa hàng phụ trách đơn và Quản trị viên TàGo mới có quyền xem. Tự động xóa sau 1 ngày khi hoàn tất.</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              ${frontUrl ? `
                <div class="cccd-mask-box" style="position: relative; height: 146px; border-radius: 10px; overflow: hidden; border: 1.5px solid #DED7CB; background: #18181B; cursor: pointer;">
                  <img class="cccd-mask-img" src="${frontUrl}" style="width: 100%; height: 100%; object-fit: cover; filter: blur(11px); transform: scale(1.06); transition: filter 0.2s ease, transform 0.2s ease;" />
                  <div class="cccd-mask-overlay" style="position: absolute; inset: 0; background: rgba(24,24,27,0.35); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #FFF; font-size: 11.5px; font-weight: 700; text-align: center; padding: 8px;">
                    <span>🔒 Đã che bảo mật</span>
                    <span style="font-size: 10.5px; font-weight: 500; opacity: 0.9; margin-top: 2px;">Bấm để xem rõ</span>
                  </div>
                  <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.68); color: #fff; font-size: 11px; font-weight: 600; text-align: center; padding: 3px;">Mặt trước</div>
                </div>
              ` : '<div style="color: #9CA3AF; font-size: 12px; padding: 20px; text-align: center; border: 1px dashed #DED7CB; border-radius: 10px;">Chưa có mặt trước</div>'}
              ${backUrl ? `
                <div class="cccd-mask-box" style="position: relative; height: 146px; border-radius: 10px; overflow: hidden; border: 1.5px solid #DED7CB; background: #18181B; cursor: pointer;">
                  <img class="cccd-mask-img" src="${backUrl}" style="width: 100%; height: 100%; object-fit: cover; filter: blur(11px); transform: scale(1.06); transition: filter 0.2s ease, transform 0.2s ease;" />
                  <div class="cccd-mask-overlay" style="position: absolute; inset: 0; background: rgba(24,24,27,0.35); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #FFF; font-size: 11.5px; font-weight: 700; text-align: center; padding: 8px;">
                    <span>🔒 Đã che bảo mật</span>
                    <span style="font-size: 10.5px; font-weight: 500; opacity: 0.9; margin-top: 2px;">Bấm để xem rõ</span>
                  </div>
                  <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.68); color: #fff; font-size: 11px; font-weight: 600; text-align: center; padding: 3px;">Mặt sau</div>
                </div>
              ` : '<div style="color: #9CA3AF; font-size: 12px; padding: 20px; text-align: center; border: 1px dashed #DED7CB; border-radius: 10px;">Chưa có mặt sau</div>'}
            </div>
          </div>
        `,
        confirmButtonText: 'Đóng',
        confirmButtonColor: '#8E1B2E',
        didOpen: (popup) => {
          let revealed = false;
          const toggleBtn = popup.querySelector('#toggle-my-cccd-blur') as HTMLButtonElement | null;
          const applyState = () => {
            popup.querySelectorAll('.cccd-mask-img').forEach((el) => {
              const img = el as HTMLElement;
              img.style.filter = revealed ? 'none' : 'blur(11px)';
              img.style.transform = revealed ? 'scale(1)' : 'scale(1.06)';
            });
            popup.querySelectorAll('.cccd-mask-overlay').forEach((el) => {
              (el as HTMLElement).style.display = revealed ? 'none' : 'flex';
            });
            if (toggleBtn) {
              toggleBtn.textContent = revealed ? '🙈 Che lại' : '👁 Hiện rõ ảnh';
            }
          };
          toggleBtn?.addEventListener('click', () => {
            revealed = !revealed;
            applyState();
          });
          popup.querySelectorAll('.cccd-mask-box').forEach((box) => {
            box.addEventListener('click', () => {
              revealed = !revealed;
              applyState();
            });
          });
        },
        didClose: () => {
          if (frontUrl) URL.revokeObjectURL(frontUrl);
          if (backUrl) URL.revokeObjectURL(backUrl);
        },
      });
    } catch (err: any) {
      const rawMsg = String(err?.response?.data?.message || err?.message || '');
      const isTechnical =
        !rawMsg ||
        /mongo|internal server|500|exception|typeerror/i.test(rawMsg);
      Swal.fire({
        icon: 'warning',
        title: 'Không thể hiển thị CCCD',
        text: isTechnical ? 'Chưa thể tải ảnh CCCD lúc này. Vui lòng thử lại sau.' : rawMsg,
        confirmButtonText: 'Đóng',
        confirmButtonColor: '#8E1B2E',
      });
    }
  };

  React.useEffect(() => {
    const domino = booking?.dominoRecovery;
    if (domino?.status === 'OFFERED' && Array.isArray(domino?.alternativeProductIds) && domino.alternativeProductIds.length > 0) {
      Promise.all(
        domino.alternativeProductIds.map((id: string) =>
          httpClient.get<any>(`/api/products/${id}`).catch(() => null),
        ),
      ).then((res) => setDominoAlternatives(res.filter(Boolean)));
    } else {
      setDominoAlternatives([]);
    }
  }, [booking?.dominoRecovery?.status, booking?.dominoRecovery?.alternativeProductIds]);

  const handleSelectDominoAlternative = async (altProductId: string) => {
    try {
      const res = await Swal.fire({
        title: 'Đổi sang mẫu áo này?',
        text: 'Hệ thống sẽ cập nhật đơn hàng của bạn sang mẫu áo dài tương đương này mà không phát sinh thêm chi phí.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#881337',
        confirmButtonText: 'Đồng ý đổi mẫu',
        cancelButtonText: 'Xem lại',
      });
      if (!res.isConfirmed) return;

      Swal.fire({
        title: 'Đang xử lý đổi mẫu...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await httpClient.post(`/api/bookings/${booking._id}/domino/choice`, {
        action: 'SELECT_ALTERNATIVE',
        alternativeProductId: altProductId,
      });

      Swal.fire({
        icon: 'success',
        title: 'Thành công!',
        text: 'Đã đổi sang mẫu áo mới thành công. Shop sẽ chuẩn bị áo theo đúng lịch hẹn!',
      });
      onRefreshBooking?.();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: err?.response?.data?.message || err?.message || 'Không thể đổi mẫu áo.',
      });
    }
  };

  const handleDominoRefund = async () => {
    try {
      const res = await Swal.fire({
        title: 'Hủy đơn & Nhận hoàn tiền 100%?',
        text: 'Hệ thống sẽ hoàn trả 100% toàn bộ tiền cọc và tiền thuê về tài khoản của bạn ngay lập tức.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#DC2626',
        confirmButtonText: 'Xác nhận hoàn tiền 100%',
        cancelButtonText: 'Hủy',
      });
      if (!res.isConfirmed) return;

      Swal.fire({
        title: 'Đang xử lý hoàn tiền...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await httpClient.post(`/api/bookings/${booking._id}/domino/choice`, {
        action: 'REFUND_100%',
      });

      Swal.fire({
        icon: 'success',
        title: 'Hoàn tiền thành công!',
        text: 'Đơn hàng đã được hủy và hoàn trả 100% tiền cọc + phí thuê.',
      });
      onRefreshBooking?.();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: err?.response?.data?.message || err?.message || 'Không thể hoàn tiền.',
      });
    }
  };

  const { socket } = useSocket();

  const fetchIncidentDetails = React.useCallback(async () => {
    if (!booking?._id) return;
    try {
      const res = await httpClient.get<any>(`/api/disputes/incidents/booking/${booking._id}`);
      setIncident(res || null);
    } catch {
      setIncident(null);
    }
  }, [booking?._id]);

  React.useEffect(() => {
    if (booking?.incident) {
      setIncident(booking.incident);
    } else {
      fetchIncidentDetails();
    }
  }, [booking?.incident, booking?.status, booking?.updatedAt, fetchIncidentDetails]);

  // Targeted socket refresh: Only refetch if booking_updated event matches this open booking
  React.useEffect(() => {
    if (!socket || !booking?._id) return;
    const handler = (payload: { bookingId: string }) => {
      if (payload?.bookingId === booking._id) {
        fetchIncidentDetails();
        onRefreshBooking?.();
      }
    };
    socket.on('booking_updated', handler);
    return () => {
      socket.off('booking_updated', handler);
    };
  }, [socket, booking?._id, fetchIncidentDetails, onRefreshBooking]);

  const items = booking?.items || [];
  const item = items[0] || {};
  const bookingId = booking?._id?.toString() || '';
  const itemId = item?._id?.toString() || '';
  const evidenceKey = `${bookingId}:${itemId}`;
  const [pickupEvidenceSummary, setPickupEvidenceSummary] = React.useState<{ key: string; files: any[] }>({ key: '', files: [] });

  React.useEffect(() => {
    if (!bookingId || !itemId) return;
    let active = true;
    httpClient
      .get<{ pickup?: any[] }>(`/api/bookings/${bookingId}/items/${itemId}/rental/evidence`)
      .then((summary) => {
        if (active) setPickupEvidenceSummary({ key: evidenceKey, files: summary?.pickup || [] });
      })
      .catch(() => {
        if (active) setPickupEvidenceSummary({ key: evidenceKey, files: [] });
      });
    return () => {
      active = false;
    };
  }, [bookingId, itemId, evidenceKey, booking?.updatedAt]);

  const isPhoto = item.itemType === 'PHOTOGRAPHY_PACKAGE';
  const pkgObj = item.photographyPackageId && typeof item.photographyPackageId === 'object' ? item.photographyPackageId : null;
  const prodObj = !isPhoto && item.productId && typeof item.productId === 'object' ? item.productId : null;

  const resolvedProvider =
    (item.providerId && typeof item.providerId === 'object' ? item.providerId : null) ||
    (prodObj?.providerId && typeof prodObj.providerId === 'object' ? prodObj.providerId : null) ||
    (pkgObj?.providerId && typeof pkgObj.providerId === 'object' ? pkgObj.providerId : null) ||
    (booking?.providerIds && booking.providerIds[0] && typeof booking.providerIds[0] === 'object' ? booking.providerIds[0] : null) ||
    null;

  const [cachedProvider, setCachedProvider] = React.useState<any>(resolvedProvider);

  React.useEffect(() => {
    if (resolvedProvider && (resolvedProvider.businessName || resolvedProvider.fullName)) {
      setCachedProvider(resolvedProvider);
      return;
    }
    const provId =
      (typeof item?.providerId === 'string' ? item.providerId : (item?.providerId?._id ? String(item.providerId._id) : null)) ||
      (typeof prodObj?.providerId === 'string' ? prodObj.providerId : (prodObj?.providerId?._id ? String(prodObj.providerId._id) : null)) ||
      (typeof pkgObj?.providerId === 'string' ? pkgObj.providerId : (pkgObj?.providerId?._id ? String(pkgObj.providerId._id) : null)) ||
      (typeof booking?.providerIds?.[0] === 'string' ? booking.providerIds[0] : (booking?.providerIds?.[0]?._id ? String(booking.providerIds[0]._id) : null));

    if (provId) {
      let isCurrent = true;
      httpClient.get<any>(`/api/providers/${provId}`)
        .then((p) => {
          if (isCurrent && p) setCachedProvider(p);
        })
        .catch(() => { });
      return () => {
        isCurrent = false;
      };
    }
  }, [resolvedProvider, booking?._id, booking?.providerIds, item?.providerId, prodObj?.providerId, pkgObj?.providerId]);

  const provider = (resolvedProvider && (resolvedProvider.businessName || resolvedProvider.fullName)) ? resolvedProvider : (cachedProvider || {});

  const dressItems = items.map((it: any) => {
    const itProd = it.productId && typeof it.productId === 'object' ? it.productId : null;
    const itPkg = it.photographyPackageId && typeof it.photographyPackageId === 'object' ? it.photographyPackageId : null;
    const itName = itProd?.name || itPkg?.name || it.packageSnapshot?.name || it.name || it.productName || 'Áo Dài Di Sản';
    const itImage =
      itProd?.images?.[0] ||
      itProd?.coverImage ||
      itPkg?.coverImage ||
      it.images?.[0] ||
      it.coverImage ||
      it.image ||
      it.productImage;
    const itSize = it.selectedSize || it.size || 'M';
    const itColor = it.selectedColor || it.color || itProd?.color || 'Đa sắc';
    const itMaterial =
      (Array.isArray(itProd?.materials) ? itProd.materials.join(', ') : itProd?.material) ||
      it.material ||
      'Lụa cao cấp';
    const itBrand = itProd?.brand || provider?.businessName || provider?.fullName || 'TàGo Premium';
    const itAccessories =
      (Array.isArray(it.accessories) ? it.accessories.join(', ') : it.accessories) ||
      (Array.isArray(itProd?.accessories) ? itProd.accessories.join(', ') : itProd?.accessories) ||
      'Mấn đội đầu';
    const itPrice = it.unitPrice || it.price || itProd?.rentalPrice;
    const itQty = it.quantity || 1;

    return {
      id: it._id,
      title: itName,
      image: itImage,
      size: itSize,
      color: itColor,
      material: itMaterial,
      brand: itBrand,
      accessories: itAccessories,
      price: itPrice,
      quantity: itQty
    };
  });

  const itemName =
    prodObj?.name ||
    pkgObj?.name ||
    item.packageSnapshot?.name ||
    item.name ||
    (isPhoto ? 'Gói Chụp Ảnh Nghệ Thuật' : 'Áo Dài Truyền Thống');

  const itemImage =
    prodObj?.images?.[0] ||
    prodObj?.coverImage ||
    pkgObj?.coverImage ||
    item.images?.[0] ||
    item.coverImage ||
    item.image ||
    item.productImage;

  const itemCode = booking?.bookingCode || (booking?._id ? 'RT-' + String(booking._id).slice(-4) : 'RT-TAGO');
  const itemSize = isPhoto ? '' : (item.selectedSize || item.size || '');
  const itemColor =
    item.selectedColor ||
    item.color ||
    (Array.isArray(prodObj?.colors) ? prodObj.colors.join(', ') : prodObj?.color) ||
    'Đa sắc';
  const itemBrand = prodObj?.brand || provider?.businessName || provider?.fullName || 'TàGo Premium';
  const itemMaterial =
    (Array.isArray(prodObj?.materials) ? prodObj.materials.join(', ') : prodObj?.material) ||
    'Lụa cao cấp';
  const itemAccessories =
    (Array.isArray(item.accessories) ? item.accessories.join(', ') : item.accessories) ||
    (Array.isArray(prodObj?.accessories) ? prodObj.accessories.join(', ') : prodObj?.accessories) ||
    'Mấn đội đầu';

  // Dates & Times
  const rawPickup = item.rentalFrom || booking?.rentalFrom || item.startDate || item.shootDate || booking?.startDate;
  const rawReturn = item.rentalTo || item.endDate || booking?.endDate;

  const pickupDateStr = rawPickup
    ? new Date(rawPickup).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' })
    : 'Chưa cập nhật';
  const pickupTimeStr = item.shootTimeSlot || item.pickupTime || '09:00';
  const readyTimeStr = rawPickup
    ? new Date(rawPickup).toLocaleDateString('vi-VN') + ' 08:00'
    : 'Trước giờ nhận 1h';
  const dueTimeStr = rawReturn
    ? new Date(rawReturn).toLocaleDateString('vi-VN') + ' • Trước 18:00'
    : isPhoto
      ? 'Hoàn tất sau buổi chụp'
      : 'Theo thỏa thuận';

  // Remaining time calculation
  const calculateRemaining = () => {
    const trackedMinutes = booking?.overdueTracking?.minutesOverdue;
    if (
      (booking?.status === 'OVERDUE' || booking?.overdueTracking?.isOverdue) &&
      typeof trackedMinutes === 'number' &&
      trackedMinutes > 0
    ) {
      const h = Math.floor(trackedMinutes / 60);
      const m = trackedMinutes % 60;
      const d = Math.floor(h / 24);
      if (d > 0) return `Quá hạn ${d} ngày ${h % 24 > 0 ? `${h % 24} giờ` : ''}`.trim();
      return m > 0 ? `Quá hạn ${h} giờ ${m} phút` : `Quá hạn ${h} giờ`;
    }
    if (!rawReturn) return 'Chưa có hạn trả';
    const dueMs = new Date(rawReturn).getTime();
    const now = Date.now();
    const diff = dueMs - now;
    if (diff < 0) {
      const totalMins = Math.max(1, Math.floor(Math.abs(diff) / (1000 * 60)));
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      const days = Math.floor(hours / 24);
      if (days > 0) return `Quá hạn ${days} ngày`;
      return hours > 0
        ? (mins > 0 ? `Quá hạn ${hours} giờ ${mins} phút` : `Quá hạn ${hours} giờ`)
        : `Quá hạn ${mins} phút`;
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return days > 0 ? `${days} ngày ${remHours > 0 ? `${remHours} giờ` : ''}` : `${Math.max(1, hours)} giờ`;
  };

  const remainingTimeStr = calculateRemaining();

  // Status & Stepper
  const isPendingCustomerIncident =
    (booking?.status === 'RETURN_PENDING' || booking?.status === 'PENDING_CUSTOMER') &&
    incident?.status === 'PENDING_CUSTOMER';
  const isDisputed = booking?.status === 'DISPUTED' || incident?.status === 'DISPUTED';

  const currentStatus = isDisputed
    ? 'DISPUTED'
    : booking?.status || item?.rentalFulfillment?.status || 'CONFIRMED';
  const currentStatusLabel = getBookingStatusLabel(currentStatus, {
    hasPendingIncident: isPendingCustomerIncident,
    uppercase: true,
  });

  // Financial values
  const rentalPrice = (item.unitPrice || 0) * (item.quantity || 1) || booking?.pricingSummary?.subTotal || 0;
  const cleaningFee = booking?.pricingSummary?.serviceFee || 0;
  const depositFee = item.depositAmount || booking?.pricingSummary?.depositTotal || 0;
  const totalPrice = booking?.pricingSummary?.grandTotal || booking?.totalAmount || 0;
  const isPaid = booking?.status !== 'PENDING_PAYMENT' && booking?.status !== 'WAITING_PAYMENT';
  const paymentTimeStr = booking?.paymentSummary?.paidAt
    ? new Date(booking.paymentSummary.paidAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    : booking?.createdAt
      ? new Date(booking.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Gần đây';

  // Helper to safely format address object or string
  const formatStoreAddress = (addr: any): string => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr.trim();
    if (typeof addr === 'object') {
      const parts = [
        addr.addressLine || addr.street || addr.address,
        addr.ward,
        addr.district,
        addr.city || addr.province
      ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
      if (parts.length > 0) return parts.join(', ');
      if (addr.formattedAddress && typeof addr.formattedAddress === 'string') return addr.formattedAddress;
    }
    return '';
  };

  // Store information
  const storeName = provider?.businessName || provider?.fullName || 'Cửa hàng đối tác';
  const rawAddress =
    item.pickupReturnLocationSnapshot?.address ||
    item.pickupReturnLocationSnapshot ||
    provider?.rentalSettings?.pickupLocation ||
    provider?.pickupLocation ||
    provider?.address ||
    provider?.businessAddress ||
    booking?.deliveryAddress?.address ||
    booking?.deliveryAddress;

  const storeAddress = formatStoreAddress(rawAddress) || 'Đang cập nhật địa chỉ cửa hàng';

  // Support hotline handler
  const handleSupport = () => {
    Swal.fire({
      title: 'Trung tâm Hỗ trợ Khách hàng TàGo',
      html: `
        <div style="text-align: left; font-size: 14px; color: #4A3F35; line-height: 1.6;">
          <p>Đội ngũ TàGo luôn sẵn sàng hỗ trợ bạn:</p>
          <div style="background: #FDF2F4; padding: 12px 16px; border-radius: 10px; border: 1px solid #F7D5DA; margin: 12px 0;">
            <p style="margin: 0; font-weight: 700; color: #8E1B2E; font-size: 16px;">📞 Hotline: 1900 9999</p>
            <p style="margin: 4px 0 0 0; color: #7D736B; font-size: 12px;">Hỗ trợ 24/7 toàn quốc</p>
          </div>
          <p style="margin: 0;">✉️ Email: <strong>support@tago.vn</strong></p>
          <p style="margin: 4px 0 0 0;">🏢 Cửa hàng: <strong>${storeAddress}</strong></p>
        </div>
      `,
      confirmButtonText: 'Đã hiểu',
      confirmButtonColor: '#8E1B2E'
    });
  };

  // Open Map handler
  const handleOpenMap = () => {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(storeAddress)}`, '_blank');
  };

  // View Rules modal
  const handleViewRules = () => {
    Swal.fire({
      title: 'Quy định & Chính sách Thuê trang phục',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #4A3F35; line-height: 1.6;">
          <ol style="padding-left: 18px; margin: 0; display: flex; flex-direction: column; gap: 8px;">
            <li><strong>Bảo quản trang phục:</strong> Giữ áo cẩn thận, không để dính vết bẩn cứng đầu, mực, hóa chất hoặc rách vải.</li>
            <li><strong>Giặt ủi:</strong> Không tự ý giặt ủi hoặc tẩy trang phục. Cửa hàng và TàGo sẽ đảm nhận quy trình giặt sấy chuyên dụng sau khi nhận lại.</li>
            <li><strong>Thời hạn trả:</strong> Vui lòng hoàn trả trước giờ hẹn quy định. Trường hợp quá hạn sẽ tính phí phát sinh theo thỏa thuận.</li>
            <li><strong>Hoàn cọc:</strong> Tiền cọc (${depositFee.toLocaleString('vi-VN')}đ) sẽ được hoàn trả đầy đủ ngay sau khi nhân viên kiểm tra tình trạng áo dài.</li>
          </ol>
        </div>
      `,
      confirmButtonText: 'Đã hiểu',
      confirmButtonColor: '#8E1B2E'
    });
  };

  // View Invoice modal
  const handleViewInvoice = () => {
    Swal.fire({
      title: `Hóa đơn điện tử #${itemCode}`,
      html: `
        <div style="text-align: left; font-size: 13px; color: #4A3F35;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #ECE5DB; padding-bottom: 8px; margin-bottom: 8px;">
            <span>Dịch vụ / Sản phẩm:</span>
            <strong>${itemName} ${itemSize ? `(Size ${itemSize})` : ''}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Tiền dịch vụ:</span>
            <span>${rentalPrice.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Phí dịch vụ:</span>
            <span>${cleaningFee.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Tiền đặt cọc:</span>
            <span>${depositFee.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="border-top: 1px solid #ECE5DB; padding-top: 8px; margin-top: 8px; display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #8E1B2E;">
            <span>Tổng thanh toán:</span>
            <span>${totalPrice.toLocaleString('vi-VN')}đ</span>
          </div>
          <div style="margin-top: 12px; background: ${isPaid ? '#ECFDF5' : '#FEF3C7'}; padding: 6px 12px; border-radius: 6px; color: ${isPaid ? '#047857' : '#B45309'}; font-weight: 700; font-size: 12px; text-align: center;">
            ${isPaid ? '✓ ĐÃ THANH TOÁN QUA VÍ/PAYOS' : '⏳ CHỜ THANH TOÁN'}
          </div>
        </div>
      `,
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#8E1B2E'
    });
  };

  // Return Ao Dai handler: Mở modal trả áo kèm bắt buộc tải ảnh tình trạng áo khi trả
  const handleReturn = () => {
    setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = async (data: { evidencePhotos: string[]; note?: string }) => {
    if (!booking?._id) return;
    await httpClient.post(`/bookings/${booking._id}/customer-return`, data);
    await Swal.fire({
      icon: 'success',
      title: 'Đã gửi thông báo trả áo!',
      text: `Cửa hàng ${storeName} đã nhận được thông báo kèm ảnh bằng chứng trả áo. Nhân viên sẽ kiểm tra và đối soát hoàn cọc ${depositFee.toLocaleString('vi-VN')}đ cho bạn.`,
      confirmButtonColor: '#8E1B2E',
    });
    onRefreshBooking?.();
  };

  // Handle customer agrees to incident compensation
  const handleAgreeIncident = async () => {
    if (!incident?._id) return;
    const requestedAmount = incident.requestedAmount || 0;
    const remainingRefund = Math.max(0, depositFee - requestedAmount);

    const result = await Swal.fire({
      title: 'Đồng ý bồi thường sự cố?',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #4A3F35; line-height: 1.6;">
          <p style="margin-bottom: 12px;">
            Bạn xác nhận đồng ý bồi thường chi phí sự cố hư hỏng theo yêu cầu của Shop. Số tiền sẽ được khấu trừ trực tiếp từ tiền cọc của bạn.
          </p>
          <div style="background-color: #FFFBEB; border: 1px solid #FCD34D; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
              <span style="color: #78350F;">Tiền cọc giữ đồ ban đầu:</span>
              <strong style="color: #78350F;">${depositFee.toLocaleString('vi-VN')}đ</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #DC2626; font-size: 13px;">
              <span>Khấu trừ bồi thường cho Shop:</span>
              <strong style="color: #DC2626;">-${requestedAmount.toLocaleString('vi-VN')}đ</strong>
            </div>
            <div style="border-top: 1px dashed #D1D5DB; margin: 8px 0;"></div>
            <div style="display: flex; justify-content: space-between; color: #059669; font-size: 14px; font-weight: 800;">
              <span>Tiền cọc còn lại hoàn trả bạn:</span>
              <span style="color: #059669;">${remainingRefund.toLocaleString('vi-VN')}đ</span>
            </div>
          </div>
          <p style="margin: 0; font-size: 12px; color: #4B5563;">
            ${remainingRefund > 0
          ? '✓ Số tiền cọc còn lại sẽ được hệ thống hoàn tự động về tài khoản thanh toán của bạn.'
          : '✓ Toàn bộ tiền cọc được dùng để bồi thường thiệt hại cho cửa hàng.'}
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận đồng ý',
      cancelButtonText: 'Xem lại',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6B7280'
    });

    if (!result.isConfirmed) return;

    try {
      setRespondingIncident(true);
      await httpClient.post(`/api/disputes/incidents/${incident._id}/agree`);
      await Swal.fire({
        icon: 'success',
        title: 'Xử lý thành công!',
        text: 'Đã hoàn tất thủ tục bồi thường sự cố. Đơn thuê đã hoàn thành.',
        confirmButtonColor: '#8E1B2E'
      });
      onRefreshBooking?.();
      fetchIncidentDetails();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Có lỗi xảy ra',
        text: err?.response?.data?.message || err?.message || 'Không thể xác nhận đền bù.',
        confirmButtonColor: '#8E1B2E'
      });
    } finally {
      setRespondingIncident(false);
    }
  };

  // Handle customer disagrees / escalates incident to Admin
  const handleDisagreeIncident = async () => {
    if (!incident?._id) return;

    const { value: reasonText, isConfirmed } = await Swal.fire({
      title: 'Khiếu nại lên Ban Quản Trị?',
      input: 'textarea',
      inputLabel: 'Lý do khiếu nại (tùy chọn):',
      inputPlaceholder: 'Nêu rõ lý do bạn không đồng ý với yêu cầu đền bù của Shop...',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #4A3F35; line-height: 1.6; margin-bottom: 12px;">
          <p style="margin-bottom: 10px;">
            Bạn không đồng ý với yêu cầu đền bù của Shop? Đơn hàng sẽ được chuyển lên Ban Quản Trị (Admin) để thẩm định và giải quyết.
          </p>
          <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 12px 14px; color: #991B1B;">
            <p style="margin: 0 0 6px 0; font-weight: 700; font-size: 13px;">⚠️ Quy trình xử lý tranh chấp:</p>
            <ul style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.6;">
              <li>Tiền cọc và doanh thu thuê được <strong>đóng băng an toàn</strong> trong tài khoản ký quỹ.</li>
              <li>Admin sẽ đối soát ảnh bàn giao lúc nhận, ảnh trả đồ và liên hệ hai bên để đưa ra phán quyết công bằng.</li>
            </ul>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Gửi khiếu nại lên Admin',
      cancelButtonText: 'Quay lại',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
    });

    if (!isConfirmed) return;

    try {
      setRespondingIncident(true);
      await httpClient.post(`/api/disputes/incidents/${incident._id}/disagree`, {
        reason: reasonText?.trim() || undefined,
      });
      await Swal.fire({
        icon: 'success',
        title: 'Đã gửi khiếu nại!',
        text: 'Đơn hàng đã được chuyển sang trạng thái tranh chấp. Ban Quản Trị sẽ kiểm tra và thông báo kết quả sớm nhất cho bạn.',
        confirmButtonColor: '#8E1B2E',
      });
      onRefreshBooking?.();
      fetchIncidentDetails();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Có lỗi xảy ra',
        text: err?.response?.data?.message || err?.message || 'Không thể gửi khiếu nại.',
        confirmButtonColor: '#8E1B2E',
      });
    } finally {
      setRespondingIncident(false);
    }
  };

  // Handle pickup modal submit for CONFIRM, DAMAGE, and REJECT flows
  const handlePickupModalSubmit = async (data: { description?: string; reason?: string; evidencePhotos: string[] }) => {
    if (!booking?._id || !pickupModalMode) return;
    setIsSubmittingPickup(true);
    try {
      if (pickupModalMode === 'CONFIRM') {
        await httpClient.post(`/bookings/${booking._id}/customer-confirm-pickup`, {
          evidencePhotos: data.evidencePhotos.length > 0 ? data.evidencePhotos : undefined
        });
        await Swal.fire({
          icon: 'success',
          title: 'Nhận áo thành công!',
          text: 'Đơn thuê của bạn đã chuyển sang trạng thái Đang thuê. Chúc bạn có trải nghiệm tuyệt vời!',
          confirmButtonColor: '#8E1B2E'
        });
      } else if (pickupModalMode === 'DAMAGE') {
        await httpClient.post(`/bookings/${booking._id}/customer-report-damage`, {
          description: data.description,
          evidencePhotos: data.evidencePhotos
        });
        await Swal.fire({
          icon: 'success',
          title: 'Báo cáo thành công!',
          text: 'Báo cáo được ghi nhận là tình trạng có sẵn trước khi thuê và dùng để bảo vệ tiền cọc của bạn. Đơn thuê đã bắt đầu.',
          confirmButtonColor: '#8E1B2E'
        });
      } else if (pickupModalMode === 'REJECT') {
        await httpClient.post(`/bookings/${booking._id}/customer-reject-handover`, {
          reason: data.reason,
          evidencePhotos: data.evidencePhotos
        });
        await Swal.fire({
          icon: 'warning',
          title: 'Đã từ chối nhận áo!',
          text: 'Đơn sẽ được chuyển sang quy trình tranh chấp để Admin đối soát. Bạn sẽ không bắt đầu thời gian thuê.',
          confirmButtonColor: '#8E1B2E'
        });
      }
      setPickupModalMode(null);
      onRefreshBooking?.();
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi xử lý yêu cầu.';
      throw new Error(errorMsg);
    } finally {
      setIsSubmittingPickup(false);
    }
  };

  // Confirm complete rental and refund deposit
  const handleConfirmComplete = async () => {
    if (!booking?._id) return;

    const result = await Swal.fire({
      title: 'Xác nhận hoàn tất đơn thuê?',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #4A3F35; line-height: 1.6;">
          <p style="margin-bottom: 12px;">
            Cửa hàng đã xác nhận nhận lại trang phục nguyên vẹn. Bạn xác nhận hoàn tất đơn để hệ thống tiến hành giải ngân và hoàn trả tiền cọc <strong>${depositFee.toLocaleString('vi-VN')}đ</strong> cho bạn?
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận hoàn tất & Nhận cọc',
      cancelButtonText: 'Đóng',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#7D736B'
    });

    if (!result.isConfirmed) return;

    try {
      await httpClient.post(`/bookings/${booking._id}/confirm-complete`, {});
      await Swal.fire({
        icon: 'success',
        title: 'Hoàn tất đơn hàng thành công!',
        text: 'Cảm ơn bạn đã sử dụng dịch vụ của TàGo. Tiền cọc đang được hệ thống xử lý hoàn trả.',
        confirmButtonColor: '#8E1B2E'
      });
      onRefreshBooking?.();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Có lỗi xảy ra',
        text: err?.response?.data?.message || err?.message || 'Không thể xác nhận hoàn tất đơn.',
        confirmButtonColor: '#8E1B2E'
      });
    }
  };

  // Timeline steps
  const timelineSteps: {
    id: string;
    title: string;
    description: string;
    timestamp?: string;
    status: 'COMPLETED' | 'ACTIVE' | 'PENDING';
  }[] = [
      {
        id: 'step-1',
        title: 'Shop chuẩn bị áo',
        description: ['PICKUP_PENDING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
          ? 'Đã chuẩn bị xong và kiểm tra chất lượng tại cửa hàng'
          : 'Cửa hàng đang kiểm tra và chuẩn bị áo dài',
        timestamp: readyTimeStr,
        status: ['PICKUP_PENDING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
          ? 'COMPLETED'
          : 'ACTIVE'
      },
      {
        id: 'step-2',
        title: ['PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
          ? 'Đã nhận áo'
          : 'Chờ nhận áo tại cửa hàng',
        description: ['PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
          ? `Đã nhận áo tại ${storeName}`
          : `Vui lòng đến ${storeName} để nhận áo theo lịch hẹn`,
        timestamp: rawPickup ? new Date(rawPickup).toLocaleDateString('vi-VN') + ' • ' + pickupTimeStr : undefined,
        status: ['PICKED_UP', 'IN_PROGRESS', 'RENTING', 'RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
          ? 'COMPLETED'
          : ['PICKUP_PENDING', 'READY_FOR_PICKUP'].includes(currentStatus)
            ? 'ACTIVE'
            : 'PENDING'
      },
      {
        id: 'step-3',
        title: 'Khách đang thuê',
        description: ['RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
          ? 'Đã hoàn tất thời gian trải nghiệm trang phục'
          : ['PICKED_UP', 'IN_PROGRESS', 'RENTING'].includes(currentStatus)
            ? 'Thời gian thuê đang diễn ra theo hợp đồng'
            : 'Chưa bắt đầu thời gian thuê',
        status: ['RETURN_PENDING', 'RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
          ? 'COMPLETED'
          : ['PICKED_UP', 'IN_PROGRESS', 'RENTING'].includes(currentStatus)
            ? 'ACTIVE'
            : 'PENDING'
      },
      {
        id: 'step-4',
        title: 'Trả áo & Hoàn cọc',
        description: ['RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
          ? 'Đã hoàn tất kiểm tra và hoàn cọc'
          : currentStatus === 'RETURN_PENDING'
            ? 'Đang kiểm tra áo và đối soát hoàn cọc'
            : `Trả áo tại ${storeAddress} để nhận lại tiền cọc`,
        timestamp: ['RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus) && rawReturn ? new Date(rawReturn).toLocaleDateString('vi-VN') : undefined,
        status: ['RETURNED', 'COMBO_PHOTOS_APPROVED', 'COMPLETED'].includes(currentStatus)
          ? 'COMPLETED'
          : currentStatus === 'RETURN_PENDING'
            ? 'ACTIVE'
            : 'PENDING'
      }
    ];

  // Photos
  const persistedPickupFiles = item?.rentalFulfillment?.pickupEvidence?.files || [];
  const reconciledPickupFiles = pickupEvidenceSummary.key === evidenceKey ? pickupEvidenceSummary.files : [];
  const pickupFiles = persistedPickupFiles.length > 0 ? persistedPickupFiles : reconciledPickupFiles;
  const returnFiles = item?.rentalFulfillment?.returnEvidence?.files || [];

  const photos: any[] = [];
  pickupFiles.forEach((f: any, idx: number) => {
    photos.push({
      id: `pickup-${f.fileId || idx}`,
      title: `Ảnh bàn giao #${idx + 1}`,
      timestamp: f.uploadedAt ? new Date(f.uploadedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : paymentTimeStr,
      fileId: f.fileId,
      bookingId,
      itemId,
      image: f.url || '',
    });
  });

  returnFiles.forEach((f: any, idx: number) => {
    photos.push({
      id: `return-${f.fileId || idx}`,
      title: `Ảnh nhận lại #${idx + 1}`,
      timestamp: f.uploadedAt ? new Date(f.uploadedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : paymentTimeStr,
      fileId: f.fileId,
      bookingId,
      itemId,
      image: f.url || '',
    });
  });

  (Array.isArray(booking?.handoverPhotos) ? booking.handoverPhotos : []).forEach((photoItem: any, idx: number) => {
    const url = typeof photoItem === 'string' ? photoItem : photoItem?.url || '';
    photos.push({
      id: `handover-${idx}`,
      title: `Ảnh xác nhận #${idx + 1}`,
      timestamp: paymentTimeStr,
      image: url,
    });
  });

  let canReschedule = false;
  if (['CONFIRMED', 'DEPOSIT_PAID'].includes(currentStatus)) {
    try {
      const pickupDate = rawPickup ? new Date(rawPickup) : null;
      if (pickupDate && !isNaN(pickupDate.getTime())) {
        const msUntilPickup = pickupDate.getTime() - Date.now();
        canReschedule = msUntilPickup >= 24 * 60 * 60 * 1000;
      }
    } catch {
      canReschedule = false;
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        minWidth: 0
      }}
    >
      {/* 1. Top Header with Back button and Support/Reschedule actions */}
      <RentalDetailHeader
        onBack={onBack}
        onOpenSupport={handleSupport}
        canReschedule={canReschedule}
        onOpenReschedule={() => onOpenReschedule?.(item)}
      />

      {/* Cảnh báo quá hạn trả áo (chỉ hiện khi đơn chưa hoàn tất/kết thúc) */}
      {(currentStatus === 'OVERDUE' || (booking?.overdueTracking?.isOverdue && !['COMPLETED', 'CANCELLED', 'RETURNED', 'LOST_ITEM'].includes(currentStatus))) && currentStatus !== 'LOST_ITEM' && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1.5px solid #FCA5A5',
            borderRadius: '16px',
            padding: '18px 20px',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} color="#DC2626" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#991B1B' }}>
                ĐƠN THUÊ ÁO DÀI ĐANG QUÁ HẠN TRẢ
              </span>
            </div>
            <span
              style={{
                backgroundColor: '#FEE2E2',
                color: '#B91C1C',
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid #FECACA',
              }}
            >
              Trễ {Math.floor((booking?.overdueTracking?.minutesOverdue || 0) / 60)}h {(booking?.overdueTracking?.minutesOverdue || 0) % 60}m
            </span>
          </div>

          <div style={{ fontSize: '13px', color: '#450A0A', lineHeight: 1.6, marginBottom: '10px' }}>
            <div>• <strong>Phí quá hạn:</strong> Tính lũy tiến <strong>+10% tiền cọc / 30 phút</strong> (+{Math.max(1000, Math.round(depositFee * 0.1)).toLocaleString('vi-VN')}đ/30p). Phạt hiện tại: <span style={{ color: '#DC2626', fontWeight: 700 }}>{(booking?.overdueTracking?.calculatedLateFee || 0).toLocaleString('vi-VN')}đ</span> (áp trần tối đa 50% tiền cọc: {(booking?.overdueTracking?.maxLateFeeCap || 0).toLocaleString('vi-VN')}đ).</div>
            <div>• <strong>Chế tài hệ thống:</strong> {booking?.overdueTracking?.accountRestrictedAt ? <span style={{ color: '#DC2626', fontWeight: 600 }}>Tài khoản của bạn đã bị tạm khóa quyền đặt đơn mới (Mốc T+2h).</span> : 'Tài khoản sẽ tự động khóa quyền đặt đơn mới nếu trễ quá 2 giờ.'}</div>
            <div>• Vui lòng nhanh chóng mang áo đến trả tại cửa hàng <strong>{storeName}</strong> ({storeAddress}) để nhân viên kiểm tra, chốt phí phạt thực tế và hoàn trả phần cọc còn lại.</div>
          </div>
        </div>
      )}

      {/* Thông báo đối soát phí quá hạn khi đơn đã hoàn tất */}
      {(() => {
        const isCompletedOrder = ['COMPLETED', 'RETURNED'].includes(currentStatus);
        const resolvedLateFee = Number(
          booking?.overdueTracking?.calculatedLateFee ?? booking?.pricingSummary?.lateFee ?? 0,
        );
        const wasOverdue = Boolean(booking?.overdueTracking?.isOverdue) || resolvedLateFee > 0;
        if (!isCompletedOrder || !wasOverdue) return null;

        const rawDepositRefunded = booking?.overdueTracking?.depositRefundedAmount;
        const resolvedDepositRefund =
          typeof rawDepositRefunded === 'number' && rawDepositRefunded > 0
            ? rawDepositRefunded
            : Math.max(0, depositFee - resolvedLateFee);
        const minutesOverdue = Number(booking?.overdueTracking?.minutesOverdue || 0);

        return (
          <div
            style={{
              backgroundColor: '#FFFBEB',
              border: '1.5px solid #FCD34D',
              borderRadius: '16px',
              padding: '16px 20px',
              boxShadow: '0 2px 10px rgba(217, 119, 6, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#D97706" />
                <span style={{ fontSize: '14.5px', fontWeight: 750, color: '#92400E' }}>
                  THÔNG BÁO KHẤU TRỪ PHÍ QUÁ HẠN TRẢ ÁO
                </span>
              </div>
              {minutesOverdue > 0 && (
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#B45309', backgroundColor: '#FEF3C7', padding: '3px 9px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                  Trễ {Math.floor(minutesOverdue / 60)}h {minutesOverdue % 60}m
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: '#78350F', lineHeight: 1.6 }}>
              <div>
                • Do đơn thuê trả áo quá hạn, hệ thống đã khấu trừ phí phạt quá hạn{' '}
                <strong style={{ color: '#B45309' }}>-{resolvedLateFee.toLocaleString('vi-VN')}đ</strong> từ tiền cọc ban đầu ({depositFee.toLocaleString('vi-VN')}đ).
              </div>
              <div>
                • Số tiền cọc còn lại đã hoàn trả cho bạn:{' '}
                <strong style={{ color: '#15803D' }}>{resolvedDepositRefund.toLocaleString('vi-VN')}đ</strong>.
              </div>
            </div>
          </div>
        );
      })()}

      {/* Cảnh báo Mất đồ (Khách A) */}
      {currentStatus === 'LOST_ITEM' && (
        <div
          style={{
            backgroundColor: '#450A0A',
            color: '#FFF',
            borderRadius: '16px',
            padding: '18px 20px',
            boxShadow: '0 4px 14px rgba(69, 10, 10, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <XCircle size={22} color="#F87171" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#FECACA' }}>
              ĐƠN HÀNG ĐÃ XÁC NHẬN MẤT TRANG PHỤC (LOST_ITEM)
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#FCA5A5', lineHeight: 1.6 }}>
            Do trang phục quá hạn và không thể liên lạc, toàn bộ tiền cọc của bạn đã được chuyển cho Shop để bồi hoàn giá trị áo. Tài khoản của bạn đã bị khóa vĩnh viễn theo Điều 175 BLHS và quy chế sàn TàGo.
          </div>
        </div>
      )}

      {/* Domino Recovery Card (Khách B) */}
      {booking?.dominoRecovery?.hasConflict && (
        <div
          style={{
            backgroundColor: booking?.dominoRecovery?.status === 'SWAPPED' ? '#F0FDF4' : '#FFFBEB',
            border: `1.5px solid ${booking?.dominoRecovery?.status === 'SWAPPED' ? '#86EFAC' : '#FCD34D'}`,
            borderRadius: '16px',
            padding: '18px 20px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Sparkles size={18} color={booking?.dominoRecovery?.status === 'SWAPPED' ? '#16A34A' : '#D97706'} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: booking?.dominoRecovery?.status === 'SWAPPED' ? '#166534' : '#92400E' }}>
              THÔNG BÁO TỪ HỆ THỐNG DOMINO RECOVERY
            </span>
          </div>

          {booking?.dominoRecovery?.status === 'SWAPPED' && (
            <div style={{ fontSize: '13px', color: '#15803D', lineHeight: 1.6 }}>
              ✓ <strong>Đã tự động điều phối áo mới:</strong> Do lượt thuê ca trước gặp sự cố quá hạn, hệ thống đã tự động gán một chiếc áo dài cùng mẫu &amp; size mới tinh trống lịch cho bạn để đảm bảo buổi trải nghiệm diễn ra đúng giờ.
            </div>
          )}

          {booking?.dominoRecovery?.status === 'OFFERED' && (
            <div>
              <div style={{ fontSize: '13px', color: '#78350F', lineHeight: 1.6, marginBottom: '12px' }}>
                Do khách thuê ca trước trễ hạn trả trang phục, để bạn không bị gián đoạn kế hoạch, sàn TàGo gửi tới bạn 2 phương án hỗ trợ ưu tiên:
              </div>

              {/* Danh sách 3 mẫu đề xuất */}
              {dominoAlternatives.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#92400E', marginBottom: '8px' }}>
                    Phương án 1: Đổi sang 1 trong các mẫu áo dài tương đương cùng phân khúc (Miễn phí)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    {dominoAlternatives.map((alt: any) => (
                      <div
                        key={alt._id}
                        style={{
                          backgroundColor: '#FFF',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ width: '100%', height: '110px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#F3F4F6' }}>
                          <img
                            src={alt.images?.[0] || alt.coverImage || itemImage || ''}
                            alt={alt.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {alt.name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#881337', fontWeight: 600 }}>
                          {(alt.rentalPrice || alt.price || 0).toLocaleString('vi-VN')}đ / lượt
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleSelectDominoAlternative(alt._id)}
                          style={{
                            marginTop: 'auto',
                            backgroundColor: '#881337',
                            color: '#FFF',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '11.5px',
                            fontWeight: 650,
                            cursor: 'pointer',
                          }}
                        >
                          Chọn mẫu này
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Phương án 2: Hủy nhận hoàn tiền 100% */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', borderTop: '1px dashed #FCD34D', paddingTop: '10px' }}>
                <div style={{ fontSize: '12px', color: '#92400E' }}>
                  ⏱️ <em>Hệ thống sẽ tự động hoàn tiền 100% sau 60 phút nếu bạn chưa chọn mẫu mới.</em>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDominoRefund()}
                  style={{
                    backgroundColor: '#DC2626',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12.5px',
                    fontWeight: 650,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <XCircle size={14} />
                  <span>Hủy đơn &amp; Nhận hoàn tiền 100%</span>
                </button>
              </div>
            </div>
          )}

          {booking?.dominoRecovery?.status === 'ACCEPTED_ALTERNATIVE' && (
            <div style={{ fontSize: '13px', color: '#15803D', lineHeight: 1.6 }}>
              ✓ Bạn đã đồng ý chuyển sang mẫu trang phục thay thế tương đương. Shop đang chuẩn bị áo cho bạn.
            </div>
          )}

          {booking?.dominoRecovery?.status === 'REFUNDED' && (
            <div style={{ fontSize: '13px', color: '#15803D', lineHeight: 1.6 }}>
              ✓ Đơn hàng đã được hủy và hoàn tiền 100% cọc + phí thuê về tài khoản của bạn.
            </div>
          )}
        </div>
      )}

      {/* 2. Main Rental Overview Card & Horizontal Stepper with Integrated Handover Inspection */}
      {(() => {
        const hasProviderSentHandover =
          pickupFiles.length > 0 ||
          (Array.isArray(booking?.handoverPhotos) && booking.handoverPhotos.length > 0) ||
          Boolean(
            item?.rentalFulfillment?.history?.some(
              (entry: any) => entry?.action === 'PICKUP_EVIDENCE_SUBMITTED',
            ),
          );
        const canUploadCccd = ['CONFIRMED', 'DEPOSIT_PAID', 'READY_FOR_PICKUP', 'PICKUP_PENDING'].includes(currentStatus);
        const showCccdCard =
          ['CONFIRMED', 'DEPOSIT_PAID', 'READY_FOR_PICKUP', 'PICKUP_PENDING', 'PICKED_UP', 'RETURN_PENDING', 'OVERDUE'].includes(currentStatus) &&
          !isPhoto;
        const hasCccd = Boolean(
          identityCardInfo?.hasIdentityCard ||
          booking?.customerIdentityCard?.hasIdentityCard ||
          booking?.customerIdentityCard?.frontImage,
        );
        const maskedId = identityCardInfo?.idNumberMasked || booking?.customerIdentityCard?.idNumberMasked;

        return (
          <>
            <RentalMainCard
              rentalData={{
                image: itemImage,
                title: itemName,
                code: itemCode,
                size: itemSize,
                brand: itemBrand,
                color: itemColor,
                material: itemMaterial,
                accessories: itemAccessories,
                status: currentStatus,
                statusLabel: currentStatusLabel,
                readyTime: readyTimeStr,
                pickupTime: rawPickup ? new Date(rawPickup).toLocaleDateString('vi-VN') + ' ' + pickupTimeStr : pickupTimeStr,
                dueTime: dueTimeStr,
                remainingTime: remainingTimeStr,
                items: dressItems
              }}
              pickupInspection={
                ['PICKUP_PENDING', 'READY_FOR_PICKUP'].includes(currentStatus) && hasProviderSentHandover
                  ? {
                    // New fulfillment evidence is private and belongs to the item;
                    // fall back to legacy booking-level URLs only for old bookings.
                    handoverPhotos: pickupFiles.length > 0 ? pickupFiles : booking?.handoverPhotos,
                    bookingId,
                    itemId,
                    isSubmitting: isSubmittingPickup,
                    onConfirm: () => setPickupModalMode('CONFIRM'),
                    onReportDamage: () => setPickupModalMode('DAMAGE'),
                    onReject: () => setPickupModalMode('REJECT'),
                  }
                  : undefined
              }
            />

            {['PICKUP_PENDING', 'READY_FOR_PICKUP'].includes(currentStatus) && !hasProviderSentHandover && (
              <div
                style={{
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#92400E',
                  fontSize: '13px',
                }}
              >
                <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Cửa hàng đang chuẩn bị bàn giao áo dài:</strong> Khi bạn đến nhận đồ, cửa hàng sẽ chụp ảnh hiện trạng trang phục và gửi sang để bạn kiểm tra đối soát tại đây.
                </div>
              </div>
            )}

            {showCccdCard && (
              <div
                style={{
                  backgroundColor: hasCccd ? '#F0FDF4' : '#FFF8F6',
                  border: `1.5px solid ${hasCccd ? '#86EFAC' : '#FECDD3'}`,
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: '1 1 320px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      backgroundColor: hasCccd ? '#DCFCE7' : '#FFE4E6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: hasCccd ? '#16A34A' : '#9F1239',
                      flexShrink: 0,
                    }}
                  >
                    {hasCccd ? <CheckCircle size={20} /> : <Shield size={20} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14.5px', fontWeight: 750, color: hasCccd ? '#166534' : '#881337' }}>
                      {hasCccd ? 'Đã xác thực CCCD nhận trang phục' : 'Xác thực CCCD (Trước khi bàn giao áo)'}
                    </div>
                    <div style={{ fontSize: '12.5px', color: hasCccd ? '#15803D' : '#4A3F35', marginTop: '3px', lineHeight: 1.5 }}>
                      {hasCccd
                        ? `Hồ sơ CCCD của bạn đã được lưu an toàn${maskedId ? ` (${maskedId})` : ''}. Chỉ bạn, Cửa hàng phụ trách đơn và Quản trị viên TàGo có quyền xem đối soát.`
                        : 'Vui lòng chụp hoặc tải lên ảnh 2 mặt CCCD để cửa hàng đối soát trước khi bàn giao áo dài. Dữ liệu được bảo mật tuyệt đối.'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {hasCccd && (
                    <button
                      type="button"
                      onClick={() => void handleViewMyCccd()}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #BBF7D0',
                        color: '#166534',
                        padding: '8px 14px',
                        borderRadius: '10px',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Eye size={14} />
                      <span>Xem CCCD</span>
                    </button>
                  )}
                  {canUploadCccd && (
                    <button
                      type="button"
                      onClick={() => void handleUploadCccd()}
                      style={{
                        backgroundColor: hasCccd ? '#FFFFFF' : '#8E1B2E',
                        border: hasCccd ? '1px solid #D1D5DB' : 'none',
                        color: hasCccd ? '#374151' : '#FFFFFF',
                        padding: '9px 16px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: hasCccd ? 'none' : '0 4px 10px rgba(142, 27, 46, 0.2)',
                      }}
                    >
                      <Upload size={15} />
                      <span>{hasCccd ? 'Cập nhật CCCD' : 'Chụp / Tải CCCD (2 mặt)'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {(() => {
        const result = booking?.disputeResult || (() => {
          const timeline = Array.isArray((booking as any)?.statusTimeline) ? (booking as any).statusTimeline : [];
          const resolved = [...timeline].reverse().find((entry: any) => typeof entry?.note === 'string' && entry.note.includes('Admin giải quyết tranh chấp'));
          return resolved ? { decisionLabel: resolved.note, resolvedAt: resolved.changedAt } : null;
        })();
        if (!result) return null;
        return (
          <div style={{ background: '#FFFBEA', border: '1px solid #F3C969', borderRadius: 14, padding: '16px 20px', color: '#5B3A00' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>⚖️ Kết quả giải quyết tranh chấp từ Admin</div>
            <div style={{ display: 'grid', gap: 6, fontSize: 13.5 }}>
              <div><strong>Phán quyết:</strong> {result.decisionLabel || result.decision || 'Đã xử lý'}</div>
              {typeof result.refundAmount === 'number' && <div><strong>Hoàn tiền cho khách:</strong> {result.refundAmount.toLocaleString('vi-VN')}đ</div>}
              {result.notes && <div><strong>Ghi chú Admin:</strong> {result.notes}</div>}
              {result.resolvedAt && <div style={{ color: '#8A6A35', fontSize: 12 }}>Thời gian xử lý: {new Date(result.resolvedAt).toLocaleString('vi-VN')}</div>}
            </div>
          </div>
        );
      })()}

      {/* 2a. Ghi nhận tình trạng áo có sẵn trước khi thuê nếu khách đã báo cáo */}
      {booking?.pickupDamageReport && (
        <RentalPickupDamageReportCard
          report={booking.pickupDamageReport}
          onViewPhoto={(url) => {
            Swal.fire({
              title: 'Ảnh bằng chứng hư hỏng khi nhận áo',
              imageUrl: url,
              confirmButtonText: 'Đóng',
              confirmButtonColor: '#8E1B2E'
            });
          }}
        />
      )}

      {/* 2b. Khách hàng xem xét & xử lý yêu cầu đền bù sự cố từ Shop */}
      {isPendingCustomerIncident && (
        <div
          style={{
            backgroundColor: '#FFFDF9',
            borderRadius: '16px',
            border: '1.5px solid #FCD34D',
            boxShadow: '0 4px 20px rgba(217, 119, 6, 0.08)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* Header of Incident Card */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: '#FEF3C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#D97706',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#92400E' }}>
                  Yêu Cầu Bồi Thường Sự Cố Hư Hỏng Trang Phục
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#B45309' }}>
                  Cửa hàng đã nhận lại đồ và gửi báo cáo sự cố cần bạn xác nhận xử lý
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FFF1F2',
                border: '1px solid #FECDD3',
                color: '#E11D48',
                padding: '4px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 750
              }}
            >
              Chờ bạn duyệt
            </div>
          </div>

          {/* Description & Financial deduction */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '14px'
            }}
          >
            {/* Box 1: Description */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EFE9E1',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#7D736B', textTransform: 'uppercase' }}>
                Mô tả sự cố từ Cửa hàng
              </span>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#231F20', fontWeight: 600, lineHeight: 1.5 }}>
                "{incident.description || 'Hư hỏng trang phục khi sử dụng'}"
              </p>
              <span style={{ fontSize: '11px', color: '#8C827A' }}>
                Phương án đề xuất: {incident.actionType === 'MAINTENANCE' ? 'Sửa chữa / Bảo dưỡng' : 'Giặt ủi / Làm sạch chuyên sâu'}
              </span>
            </div>

            {/* Box 2: Financial deduction */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EFE9E1',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#7D736B', textTransform: 'uppercase' }}>
                  Tiền cọc giữ đồ:
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#231F20' }}>
                  {depositFee.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#DC2626' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700 }}>
                  Khấu trừ đền bù sự cố:
                </span>
                <span style={{ fontSize: '14px', fontWeight: 800 }}>
                  -{(incident.requestedAmount || 0).toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div style={{ borderTop: '1px dashed #E5E7EB', margin: '2px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#059669' }}>
                <span style={{ fontSize: '13px', fontWeight: 800 }}>
                  Tiền cọc hoàn trả lại bạn:
                </span>
                <span style={{ fontSize: '15px', fontWeight: 800 }}>
                  {Math.max(0, depositFee - (incident.requestedAmount || 0)).toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>
          </div>

          {/* Evidence Photos */}
          {incident.evidencePhotos && incident.evidencePhotos.length > 0 && (
            <div>
              <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 750, color: '#4B5563', marginBottom: '8px' }}>
                📸 Bằng chứng hình ảnh do Shop chụp ({incident.evidencePhotos.length} ảnh):
              </span>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {incident.evidencePhotos.map((ref: string, index: number) => (
                  <div
                    key={index}
                    style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1.5px solid #FCD34D',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                    }}
                  >
                    <PrivateEvidenceImage
                      reference={ref}
                      legacyUrl={ref}
                      alt={`Bằng chứng hư hỏng ${index + 1}`}
                      linkStyle={{ display: 'block', width: '100%', height: '100%' }}
                      imageStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Buttons Inside Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '8px',
              borderTop: '1px solid #F3EDE4',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={handleDisagreeIncident}
              disabled={respondingIncident}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: respondingIncident ? 'not-allowed' : 'pointer'
              }}
            >
              <AlertTriangle size={14} color="#DC2626" />
              <span>{respondingIncident ? 'Đang gửi...' : 'Từ chối / Khiếu nại lên Admin'}</span>
            </button>

            <button
              type="button"
              onClick={handleAgreeIncident}
              disabled={respondingIncident}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '8px',
                backgroundColor: '#059669',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '12.5px',
                fontWeight: 750,
                cursor: respondingIncident ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)'
              }}
            >
              <CheckSquare size={14} />
              <span>
                {respondingIncident
                  ? 'Đang xử lý...'
                  : `Đồng ý đền bù (${(incident.requestedAmount || 0).toLocaleString('vi-VN')}đ)`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 2c. Disputed Banner Card */}
      {isDisputed && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            borderRadius: '14px',
            border: '1.5px solid #FECACA',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#991B1B',
              flexShrink: 0
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#991B1B' }}>
              Đơn Hàng Đang Trong Quá Trình Giải Quyết Tranh Chấp
            </h4>
            <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#B91C1C', lineHeight: 1.5 }}>
              Bạn đã từ chối yêu cầu đền bù của Shop. Ban Quản Trị TàGo đang thụ lý hồ sơ, kiểm tra ảnh đối soát và sẽ liên hệ giải quyết công bằng trong vòng 24–48h làm việc. Toàn bộ tiền cọc và thanh toán được giữ an toàn trong Escrow.
            </p>
          </div>
        </div>
      )}

      {/* 3. 3-Column Info Cards (Pickup/Return, Payment, Rules) */}
      <RentalInfoColumns
        pickupDate={pickupDateStr}
        pickupTime={pickupTimeStr}
        storeName={storeName}
        storeAddress={storeAddress}
        rentalPrice={rentalPrice}
        cleaningFee={cleaningFee}
        depositFee={depositFee}
        lateFeeDeducted={
          booking?.overdueTracking?.calculatedLateFee ??
          booking?.pricingSummary?.lateFee ??
          0
        }
        depositRefunded={(() => {
          const lateFee = Number(
            booking?.overdueTracking?.calculatedLateFee ?? booking?.pricingSummary?.lateFee ?? 0,
          );
          const rawRefund = booking?.overdueTracking?.depositRefundedAmount;
          return typeof rawRefund === 'number' && rawRefund > 0
            ? rawRefund
            : Math.max(0, depositFee - lateFee);
        })()}
        isLostItem={currentStatus === 'LOST_ITEM'}
        totalPrice={totalPrice}
        paymentTime={paymentTimeStr}
        onOpenMap={handleOpenMap}
        onGetDirections={handleOpenMap}
        onViewInvoice={handleViewInvoice}
        onViewRules={handleViewRules}
      />

      {/* 4. 2-Column Quá trình thuê & Ảnh bàn giao */}
      <RentalTimelineAndPhotos
        timelineSteps={timelineSteps}
        photos={photos}
        onViewPhoto={(photo) => {
          Swal.fire({
            title: photo.title,
            imageUrl: photo.image,
            imageAlt: photo.title,
            text: `Chụp lúc: ${photo.timestamp}`,
            confirmButtonText: 'Đóng',
            confirmButtonColor: '#8E1B2E'
          });
        }}
      />

      {/* 5. Bottom Action Bar */}
      <RentalBottomActionBar
        status={currentStatus}
        incident={incident}
        respondingIncident={respondingIncident}
        onCancel={() => onOpenCancel?.(booking || { _id: 'demo-1', bookingCode: itemCode })}
        onSupport={handleSupport}
        onReturn={handleReturn}
        onOpenMap={handleOpenMap}
        onConfirmPickup={() => setPickupModalMode('CONFIRM')}
        onReportDamage={() => setPickupModalMode('DAMAGE')}
        onRejectHandover={() => setPickupModalMode('REJECT')}
        isSubmittingPickup={isSubmittingPickup}
        onConfirmComplete={handleConfirmComplete}
        onAgreeIncident={handleAgreeIncident}
        onDisagreeIncident={handleDisagreeIncident}
        onContinuePayment={() => onContinuePayment?.(booking?._id)}
        canCustomerConfirmCompletion={Boolean(booking?.canCustomerConfirmCompletion)}
      />

      {/* 6. Modal Báo cáo hiện trạng / Xác nhận / Từ chối nhận áo */}
      {pickupModalMode && (
        <RentalPickupReportModal
          isOpen={Boolean(pickupModalMode)}
          mode={pickupModalMode}
          bookingCode={itemCode}
          onClose={() => {
            if (!isSubmittingPickup) setPickupModalMode(null);
          }}
          onSubmit={handlePickupModalSubmit}
        />
      )}

      {/* 7. Modal Xác nhận trả áo dài kèm ảnh bằng chứng */}
      <RentalReturnModal
        isOpen={isReturnModalOpen}
        bookingCode={itemCode}
        storeName={storeName}
        storeAddress={storeAddress}
        depositAmount={depositFee}
        onClose={() => setIsReturnModalOpen(false)}
        onOpenMap={handleOpenMap}
        onSubmit={handleReturnSubmit}
      />
    </div>
  );
};
