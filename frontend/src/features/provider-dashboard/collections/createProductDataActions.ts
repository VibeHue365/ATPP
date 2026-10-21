import type { useToast } from '../../../components/feedback/Toast';
import { ConfirmModal } from '../../../utils/confirmModal';
import { categoryService } from '../../categories/services/categoryService';
import { productsApi } from '../api/providerDashboardApi';
import type { useProductWizardState } from './useProductWizardState';
import type { useProviderProductsState } from './useProviderProductsState';

type Dependencies = Pick<ReturnType<typeof useProviderProductsState>,
  'setLoadingProducts' | 'debouncedProdSearch' | 'prodSortBy' | 'prodPage' | 'prodLimit' | 'prodSizeFilter' | 'prodColorFilter' | 'setProducts' | 'setProdTotal' | 'setCategories' | 'setStyleCategories' | 'setEventCategories'
> &
  Pick<ReturnType<typeof useProductWizardState>,
    'prodCategoryId' | 'setProdCategoryId'
  > &
{
  toast: ReturnType<typeof useToast>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createProductDataActions({
  setLoadingProducts, debouncedProdSearch, prodSortBy, prodPage, prodLimit, prodSizeFilter,
  prodColorFilter, setProducts, setProdTotal, toast, setCategories, prodCategoryId, setProdCategoryId,
  setStyleCategories, setEventCategories,
}: Dependencies) {
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res: any = await productsApi.listFiltered(encodeURIComponent(debouncedProdSearch), prodSortBy, prodPage, prodLimit, prodSizeFilter, prodColorFilter);
      setProducts(res?.items || []);
      setProdTotal(res?.total || 0);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi tải danh sách sản phẩm');
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await productsApi.listCategories<any[]>();
      setCategories(data);
      if (data.length > 0 && !prodCategoryId) {
        setProdCategoryId(data[0]._id || data[0].id);
      }
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
    }
  };

  const fetchServiceCategories = async () => {
    try {
      const [styles, events] = await Promise.all([
        categoryService.getPublic({ type: 'STYLE', status: 'ACTIVE', limit: 100 }),
        categoryService.getPublic({ type: 'EVENT', status: 'ACTIVE', limit: 100 }),
      ]);
      setStyleCategories(styles);
      setEventCategories(events);
    } catch (err) {
      console.error('Lỗi tải danh mục phong cách và dịp phù hợp:', err);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    const result = await ConfirmModal.delete(
      'Xóa sản phẩm Áo Dài?',
      `Bạn có chắc chắn muốn xóa áo dài "${name}" không? Sản phẩm sẽ bị gỡ bỏ hoàn toàn khỏi cửa hàng.`,
      {
        confirmButtonText: 'Xóa sản phẩm',
        cancelButtonText: 'Hủy',
      }
    );

    if (!result.isConfirmed) {
      return;
    }

    try {
      await productsApi.remove(id);
      toast.success(`Đã xóa thành công sản phẩm "${name}".`);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Xóa sản phẩm thất bại.');
    }
  };

  return { fetchCategories, fetchServiceCategories, fetchProducts, handleDeleteProduct };
}
