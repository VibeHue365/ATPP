import Swal from 'sweetalert2';
import type { useToast } from '../../../components/feedback/Toast';
import { ConfirmModal } from '../../../utils/confirmModal';
import { type PortfolioItemFormValues } from '../../photographers/components/PortfolioItemFormModal';
import { portfolioApi } from '../api/providerDashboardApi';
import type { useProviderPortfolioState } from './useProviderPortfolioState';

type Dependencies = Pick<ReturnType<typeof useProviderPortfolioState>,
  'setIsPortfolioSaving' | 'editingPortfolioItem' | 'setIsPortfolioFormOpen' | 'setEditingPortfolioItem'
> &
{
  toast: ReturnType<typeof useToast>;
  fetchProviderData: () => Promise<void>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createPortfolioActions({
  toast, fetchProviderData, setIsPortfolioSaving, editingPortfolioItem, setIsPortfolioFormOpen,
  setEditingPortfolioItem,
}: Dependencies) {
  const handleAddPortfolio = async () => {
    const { value: imageUrl, isConfirmed } = await Swal.fire({
      title: 'Thêm ảnh mẫu Portfolio',
      input: 'url',
      inputLabel: 'Đường dẫn URL ảnh (JPEG/PNG)',
      inputPlaceholder: 'https://example.com/image.jpg',
      showCancelButton: true,
      confirmButtonColor: 'var(--color-primary-dark)',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: 'Thêm ảnh',
      cancelButtonText: 'Hủy',
      background: 'white',
      inputValidator: (value: string) => {
        if (!value) return 'Vui lòng nhập URL ảnh!';
        try { new URL(value); } catch { return 'URL không hợp lệ!'; }
      },
    });
    if (!isConfirmed || !imageUrl) return;
    try {
      await portfolioApi.addLegacyImage({ imageUrl });
      toast.success('Đã thêm ảnh mẫu thiết kế vào Portfolio!');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Tải ảnh portfolio thất bại');
    }
  };

  const handleRemovePortfolio = async (imgUrl: string) => {
    try {
      await portfolioApi.deleteLegacyImage(encodeURIComponent(imgUrl));
      toast.success('Đã gỡ ảnh khỏi Portfolio');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Gỡ ảnh thất bại');
    }
  };

  const handlePortfolioFormSubmit = async (values: PortfolioItemFormValues) => {
    setIsPortfolioSaving(true);
    try {
      if (editingPortfolioItem) {
        await portfolioApi.updateItem(editingPortfolioItem._id, values);
        toast.success('Cập nhật tác phẩm thành công.');
      } else {
        await portfolioApi.createItem(values);
        toast.success('Tác phẩm đã được gửi duyệt.');
      }
      setIsPortfolioFormOpen(false);
      setEditingPortfolioItem(null);
      await fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Không thể lưu tác phẩm portfolio.');
    } finally {
      setIsPortfolioSaving(false);
    }
  };

  const handleDeletePortfolioItem = async (itemId: string) => {
    const result = await ConfirmModal.delete(
      'Gỡ tác phẩm khỏi Portfolio?',
      'Tác phẩm này sẽ bị gỡ bỏ khỏi hồ sơ năng lực của bạn. Bạn có muốn tiếp tục?',
      {
        confirmButtonText: 'Gỡ tác phẩm',
        cancelButtonText: 'Hủy bỏ',
      }
    );
    if (!result.isConfirmed) return;
    try {
      await portfolioApi.deleteItem(itemId);
      toast.success('\u0110\u00E3 g\u1EE1 t\u00E1c ph\u1EA9m kh\u1ECFi portfolio.');
      fetchProviderData();
      return;
    } catch (err: any) {
      toast.error(err.message || 'Kh\u00F4ng th\u1EC3 g\u1EE1 t\u00E1c ph\u1EA9m.');
      return;
    }
    /* Legacy reply handler body kept out of this handler.

    e.preventDefault();
    if (!replyingReviewId) return;
    try {
      await httpClient.post(`/reviews/${replyingReviewId}/reply`, { reply: replyText });
      toast.success('Gửi phản hồi đánh giá thành công!');
      setReplyingReviewId(null);
      setReplyText('');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Không thể gửi phản hồi');
    }
    */
  };

  return { handleAddPortfolio, handleRemovePortfolio, handleDeletePortfolioItem, handlePortfolioFormSubmit };
}
