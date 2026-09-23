import React from 'react';
import Swal from 'sweetalert2';
import type { useToast } from '../../../components/feedback/Toast';
import { inventoryApi, productsApi } from '../api/providerDashboardApi';
import type { useProductWizardState } from '../collections/useProductWizardState';
import { colorLabels } from '../constants';
import { variantKeyOf, variantLabelOf } from './inventoryHelpers';
import type { useProviderInventoryState } from './useProviderInventoryState';

type Dependencies = Pick<ReturnType<typeof useProviderInventoryState>,
  'setIsLoadingInventory' | 'invPage' | 'debouncedInvSearch' | 'invStatusFilter' | 'invConditionFilter' | 'invSortBy' | 'invLimit' | 'setInventoryItems' | 'setInvTotal' | 'setInventorySummary' | 'setMyProductsList' | 'addInvProductId' | 'addInvMaterial' | 'addInvSize' | 'addInvColor' | 'addInvQuantity' | 'addInvCondition' | 'addInvNotes' | 'myProductsList' | 'setIsAddInventoryOpen' | 'setAddInvProductId' | 'setAddInvSize' | 'setAddInvColor' | 'setAddInvMaterial' | 'setAddInvQuantity' | 'setAddInvCondition' | 'setAddInvNotes' | 'editInvItem' | 'editInvStatus' | 'editInvCondition' | 'editInvNotes' | 'setIsEditInventoryOpen' | 'setEditInvItem' | 'setInvSummaryPage' | 'setInvPage' | 'variantEditRow' | 'variantBusy' | 'variantEditQty' | 'setVariantBusy' | 'setVariantEditRow'
> &
  Pick<ReturnType<typeof useProductWizardState>,
    'editingProduct' | 'isModalOpen'
  > &
{
  toast: ReturnType<typeof useToast>;
  loadEditInvSummary: (productId: string) => Promise<void>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createInventoryActions({
  setIsLoadingInventory, invPage, debouncedInvSearch, invStatusFilter, invConditionFilter, invSortBy,
  invLimit, setInventoryItems, setInvTotal, setInventorySummary, setMyProductsList, toast,
  addInvProductId, addInvMaterial, addInvSize, addInvColor, addInvQuantity, addInvCondition,
  addInvNotes, myProductsList, setIsAddInventoryOpen, setAddInvProductId, setAddInvSize, setAddInvColor,
  setAddInvMaterial, setAddInvQuantity, setAddInvCondition, setAddInvNotes, editingProduct,
  loadEditInvSummary, editInvItem, editInvStatus, editInvCondition, editInvNotes,
  setIsEditInventoryOpen, setEditInvItem, setInvSummaryPage, setInvPage, isModalOpen, variantEditRow,
  variantBusy, variantEditQty, setVariantBusy, setVariantEditRow,
}: Dependencies) {
  const fetchInventoryData = async (options?: { silent?: boolean; itemsOnly?: boolean; page?: number }) => {
    if (!options?.silent) setIsLoadingInventory(true);
    const pageToLoad = options?.page ?? invPage;
    try {
      const res: any = await inventoryApi.listFiltered(encodeURIComponent(debouncedInvSearch), invStatusFilter, invConditionFilter, invSortBy, pageToLoad, invLimit);
      setInventoryItems(res?.items || []);
      setInvTotal(res?.total || 0);

      if (!options?.itemsOnly) {
        const summary: any = await inventoryApi.getSummary();
        setInventorySummary(summary || []);

        const productsRes: any = await productsApi.listForInventory();
        setMyProductsList(productsRes?.items || []);
      }
    } catch (e) {
      console.error('Failed to load inventory:', e);
      toast.error('Không thể đồng bộ dữ liệu tồn kho');
    } finally {
      if (!options?.silent) setIsLoadingInventory(false);
    }
  };

  const handleCreateInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInvProductId) {
      toast.error('Vui lòng chọn sản phẩm');
      return;
    }
    if (!addInvMaterial) {
      toast.error('Vui lòng chọn chất liệu');
      return;
    }
    try {
      await inventoryApi.createItem({
        productId: addInvProductId,
        size: addInvSize,
        color: addInvColor,
        material: addInvMaterial,
        quantity: Number(addInvQuantity),
        conditionStatus: addInvCondition,
        notes: addInvNotes
      });
      toast.success('Nhập kho hiện vật thành công!');

      // Nhập kho có thể sinh ra MÀU MỚI chưa từng có ảnh riêng (backend $addToSet vào product.colors).
      // Không tạo mục ảnh rỗng dưới DB vì nó sẽ bị lọc bỏ khi lưu sản phẩm — thay vào đó nhắc luôn cho người bán.
      const targetProduct = myProductsList.find(p => p._id === addInvProductId);
      const hasColorImages = (targetProduct?.colorImages || []).some(
        (entry: any) => (entry?.color || '').toUpperCase() === addInvColor.toUpperCase() && (entry?.images || []).length > 0,
      );
      if (targetProduct && !hasColorImages) {
        Swal.fire({
          title: `Màu ${colorLabels[addInvColor] || addInvColor} chưa có ảnh riêng`,
          html: `Khách xem <b>${targetProduct.name}</b> và chọn màu này sẽ thấy ảnh chung của sản phẩm.<br/><br/>Vào <b>Sửa sản phẩm → bước 2 → Ảnh theo màu</b> để thêm ảnh cho đúng màu.`,
          icon: 'info',
          confirmButtonText: 'Đã hiểu',
          confirmButtonColor: 'var(--color-primary)',
        });
      }

      setIsAddInventoryOpen(false);
      // Reset form
      setAddInvProductId('');
      setAddInvSize('M');
      setAddInvColor('WHITE');
      setAddInvMaterial('');
      setAddInvQuantity(1);
      setAddInvCondition('GOOD');
      setAddInvNotes('');
      // Refetch
      fetchInventoryData({ silent: true });
      if (editingProduct) {
        void loadEditInvSummary(editingProduct._id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi nhập kho hiện vật');
    }
  };

  const handleUpdateInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInvItem) return;
    try {
      await inventoryApi.updateItem(editInvItem._id, {
        status: editInvStatus,
        conditionStatus: editInvCondition,
        notes: editInvNotes
      });
      toast.success('Cập nhật trạng thái hiện vật thành công!');
      setIsEditInventoryOpen(false);
      setEditInvItem(null);
      fetchInventoryData({ silent: true });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  const handleDeleteInventoryItem = async (itemId: string) => {
    const result = await Swal.fire({
      title: 'Xác nhận thanh lý?',
      text: 'Hiện vật này sẽ được chuyển sang trạng thái RETIRED và không thể cho thuê tiếp.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý thanh lý',
      cancelButtonText: 'Hủy bỏ',
      confirmButtonColor: 'var(--color-primary)',
      cancelButtonColor: '#71717A'
    });

    if (result.isConfirmed) {
      try {
        await inventoryApi.deleteItem(itemId);
        toast.success('Thanh lý hiện vật thành công!');
        fetchInventoryData({ silent: true });
      } catch (err: any) {
        Swal.fire({
          title: 'Không thể thanh lý',
          text: err.message || 'Lỗi xảy ra khi thanh lý hiện vật.',
          icon: 'error',
          confirmButtonColor: 'var(--color-primary)'
        });
      }
    }
  };

  const refreshAfterVariantChange = async () => {
    setInvSummaryPage(1);
    setInvPage(1);
    await fetchInventoryData({ silent: true, page: 1 });
    if (isModalOpen && editingProduct) {
      void loadEditInvSummary(editingProduct._id);
    }
  };

  const handleAdjustVariantQuantity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantEditRow || variantBusy) return;
    const raw = variantEditQty.trim();
    const target = Number(raw);
    if (raw === '' || !Number.isInteger(target) || target < 0 || target > 100) {
      toast.error('Số lượng phải là số nguyên từ 0 đến 100.');
      return;
    }

    // Giảm số lượng là thao tác thanh lý, không lùi lại được — phải hỏi lại cho chắc
    const current = Number(variantEditRow.total) || 0;
    if (target < current) {
      const willRetire = current - target;
      const confirm = await Swal.fire({
        title: target === 0 ? 'Đưa biến thể về HẾT HÀNG?' : 'Xác nhận giảm số lượng?',
        html:
          `Sẽ thanh lý <b>${willRetire}</b> chiếc của <b>${variantLabelOf(variantEditRow)}</b>.` +
          (target === 0
            ? '<br/><br/>Biến thể vẫn còn trên sản phẩm nhưng khách sẽ không đặt được. Bạn có thể nhập thêm hàng bất cứ lúc nào.'
            : ''),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Đồng ý',
        cancelButtonText: 'Hủy bỏ',
        confirmButtonColor: 'var(--color-primary)',
        cancelButtonColor: '#71717A',
      });
      if (!confirm.isConfirmed) return;
    }

    setVariantBusy(true);
    try {
      const res: any = await inventoryApi.adjustVariantQuantity({
        ...variantKeyOf(variantEditRow),
        targetQuantity: target,
      });
      setVariantEditRow(null);
      await refreshAfterVariantChange();
      if (res?.shortfall > 0) {
        await Swal.fire({
          title: 'Đã xử lý một phần',
          html: `${res.message}<br/><br/><b>Không thể thanh lý:</b><br/>${res.skipped
            .map((s: any) => `${s.sku} — ${s.reason}`)
            .join('<br/>')}`,
          icon: 'warning',
          confirmButtonColor: 'var(--color-primary)',
        });
      } else {
        toast.success(res?.message || 'Cập nhật số lượng thành công!');
      }
    } catch (err: any) {
      Swal.fire({
        title: 'Không thể đổi số lượng',
        text: err.message || 'Lỗi xảy ra khi cập nhật số lượng biến thể.',
        icon: 'error',
        confirmButtonColor: 'var(--color-primary)',
      });
    } finally {
      setVariantBusy(false);
    }
  };

  const handleRemoveVariant = async (row: any) => {
    if (variantBusy) return;
    const label = variantLabelOf(row);
    const result = await Swal.fire({
      title: 'Xoá biến thể này?',
      html: `Sẽ gỡ hẳn <b>${label}</b> khỏi sản phẩm <b>${row.productName}</b> và thanh lý <b>${row.total}</b> chiếc.<br/><br/>Khách sẽ không còn nhìn thấy lựa chọn này nữa. Nếu chỉ muốn tạm hết hàng, hãy dùng "Sửa số lượng" và đặt về 0.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xoá biến thể',
      cancelButtonText: 'Hủy bỏ',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#71717A',
    });
    if (!result.isConfirmed) return;

    setVariantBusy(true);
    try {
      const res: any = await inventoryApi.removeVariant({
        body: JSON.stringify(variantKeyOf(row)),
      });
      await refreshAfterVariantChange();
      toast.success(res?.message || 'Đã xoá biến thể!');
    } catch (err: any) {
      Swal.fire({
        title: 'Không thể xoá biến thể',
        text: err.message || 'Lỗi xảy ra khi xoá biến thể.',
        icon: 'error',
        confirmButtonColor: 'var(--color-primary)',
      });
    } finally {
      setVariantBusy(false);
    }
  };

  return {
    fetchInventoryData, handleRemoveVariant, handleDeleteInventoryItem, handleCreateInventoryItem,
    handleUpdateInventoryItem, handleAdjustVariantQuantity,
  };
}
