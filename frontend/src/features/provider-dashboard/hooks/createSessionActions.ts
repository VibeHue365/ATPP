
import type { NavigateFunction } from 'react-router-dom';
import Swal from 'sweetalert2';
import type { useToast } from '../../../components/feedback/Toast';

interface Dependencies {
  logout: () => Promise<void>;
  toast: ReturnType<typeof useToast>;
  navigate: NavigateFunction;
}

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createSessionActions({ logout, toast, navigate }: Dependencies) {
  const handleLogoutClick = async () => {
    const result = await Swal.fire({
      title: 'Đăng xuất tài khoản?',
      text: 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không? Phiên làm việc hiện tại sẽ kết thúc an toàn.',
      iconHtml: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="vh-logout-icon-svg"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
      showCancelButton: true,
      confirmButtonText: 'Đăng xuất',
      cancelButtonText: 'Ở lại',
      reverseButtons: true,
      focusCancel: true,
      customClass: {
        popup: 'vh-swal-popup vh-swal-logout',
        icon: 'vh-swal-logout-icon',
        confirmButton: 'vh-swal-logout-confirm',
        cancelButton: 'vh-swal-logout-cancel',
      }
    });

    if (result.isConfirmed) {
      await logout();
      toast.success('Đã đăng xuất thành công!');
      navigate('/');
    }
  };

  return { handleLogoutClick };
}
