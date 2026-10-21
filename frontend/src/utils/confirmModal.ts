import Swal, { type SweetAlertOptions, type SweetAlertResult } from 'sweetalert2';

/**
 * Modern luxury confirmation dialogs for VibeHue / LUMÉ.
 */
export const ConfirmModal = {
  /**
   * Confirmation for logging out
   */
  async logout(options?: Partial<SweetAlertOptions>): Promise<SweetAlertResult> {
    return Swal.fire({
      title: 'Đăng xuất tài khoản?',
      text: 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không? Phiên làm việc hiện tại sẽ kết thúc an toàn.',
      iconHtml: `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="vh-logout-icon-svg">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      `,
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
      },
      ...options,
    } as SweetAlertOptions);
  },

  /**
   * Confirmation for pausing / deactivating an item (amber warning)
   */
  async pause(title: string, text: string, options?: Partial<SweetAlertOptions>): Promise<SweetAlertResult> {
    return Swal.fire({
      title,
      text,
      iconHtml: `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="10" y1="15" x2="10" y2="9"></line>
          <line x1="14" y1="15" x2="14" y2="9"></line>
        </svg>
      `,
      showCancelButton: true,
      confirmButtonText: 'Tạm ngưng',
      cancelButtonText: 'Giữ hoạt động',
      reverseButtons: true,
      focusCancel: true,
      customClass: {
        popup: 'vh-swal-popup vh-swal-pause',
        icon: 'vh-swal-pause-icon',
        confirmButton: 'vh-swal-pause-confirm',
        cancelButton: 'vh-swal-cancel',
      },
      ...options,
    } as SweetAlertOptions);
  },

  /**
   * Confirmation for deleting an item (red warning)
   */
  async delete(title: string, text: string, options?: Partial<SweetAlertOptions>): Promise<SweetAlertResult> {
    return Swal.fire({
      title,
      text,
      iconHtml: `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"></path>
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      `,
      showCancelButton: true,
      confirmButtonText: 'Xóa ngay',
      cancelButtonText: 'Hủy',
      reverseButtons: true,
      focusCancel: true,
      customClass: {
        popup: 'vh-swal-popup vh-swal-danger',
        icon: 'vh-swal-logout-icon',
        confirmButton: 'vh-swal-danger-confirm',
        cancelButton: 'vh-swal-cancel',
      },
      ...options,
    } as SweetAlertOptions);
  },

  /**
   * Generic modern confirmation dialog
   */
  async confirm(title: string, text: string, options?: Partial<SweetAlertOptions>): Promise<SweetAlertResult> {
    return Swal.fire({
      title,
      text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận',
      cancelButtonText: 'Hủy',
      reverseButtons: true,
      focusCancel: true,
      ...options,
    } as SweetAlertOptions);
  },

  /**
   * Prompt user to sign in before taking an action
   */
  async requireAuth(
    title = 'Yêu cầu đăng nhập',
    text = 'Vui lòng đăng nhập tài khoản để tiếp tục trải nghiệm dịch vụ.',
    options?: Partial<SweetAlertOptions>
  ): Promise<SweetAlertResult> {
    return Swal.fire({
      title,
      text,
      iconHtml: `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
      `,
      showCancelButton: true,
      confirmButtonText: 'Đăng nhập ngay',
      cancelButtonText: 'Để sau',
      reverseButtons: true,
      focusCancel: true,
      customClass: {
        popup: 'vh-swal-popup vh-swal-auth',
        icon: 'vh-swal-auth-icon',
        confirmButton: 'vh-swal-auth-confirm',
        cancelButton: 'vh-swal-cancel',
      },
      ...options,
    } as SweetAlertOptions);
  },
};

export default ConfirmModal;
