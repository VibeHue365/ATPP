
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
      title: 'Đăng xuất?',
      text: 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--color-primary)',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: 'Đăng xuất',
      cancelButtonText: 'Hủy',
      background: 'white',
      customClass: {
        popup: 'font-body',
      }
    });

    if (result.isConfirmed) {
      logout();
      toast.success('Đã đăng xuất thành công!');
      navigate('/');
    }
  };

  return { handleLogoutClick };
}
