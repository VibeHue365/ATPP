import Swal from 'sweetalert2';
import type { useToast } from '../../../components/feedback/Toast';
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
    const result = await Swal.fire({
      title: 'Xác nhận xóa?',
      text: `Bạn có chắc chắn muốn xóa áo dài "${name}" không?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--color-primary)',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Hủy',
      background: 'white',
      customClass: {
        popup: 'font-body',
      }
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await productsApi.remove(id);
      Swal.fire({
        title: 'Đã xóa!',
        text: `Đã xóa thành công sản phẩm "${name}".`,
        icon: 'success',
        confirmButtonColor: 'var(--color-primary)',
      });
      fetchProducts();
    } catch (err: any) {
      Swal.fire({
        title: 'Thất bại!',
        text: err.message || 'Xóa sản phẩm thất bại.',
        icon: 'error',
        confirmButtonColor: 'var(--color-primary)',
      });
    }
  };

  return { fetchCategories, fetchServiceCategories, fetchProducts, handleDeleteProduct };
}
