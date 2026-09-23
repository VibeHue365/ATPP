import React from 'react';
import type { useToast } from '../../../components/feedback/Toast';
import { promotionsApi } from '../api/providerDashboardApi';
import type { useProviderInventoryState } from '../inventory/useProviderInventoryState';
import { toLocalDateKey } from '../shared/dateHelpers';
import type { useProviderPromotionsState } from './useProviderPromotionsState';

type Dependencies = Pick<ReturnType<typeof useProviderPromotionsState>,
  'vCode' | 'vName' | 'vDesc' | 'vType' | 'vValue' | 'vMaxDiscount' | 'vMinOrder' | 'vUsageLimit' | 'vStartDate' | 'vEndDate' | 'editingVoucherId' | 'setEditingVoucherId' | 'setVCode' | 'setVName' | 'setVDesc' | 'setVType' | 'setVValue' | 'setVMaxDiscount' | 'setVMinOrder' | 'setVUsageLimit' | 'setVStartDate' | 'setVEndDate' | 'setIsVoucherModalOpen' | 'cProductId' | 'cPackageId' | 'photoPackages' | 'cShootPeopleCount' | 'cAoDaiQuantity' | 'cName' | 'cDiscount' | 'cValidFrom' | 'cValidTo' | 'cMaxUsage' | 'cDesc' | 'cPrice' | 'editingComboId' | 'setEditingComboId' | 'setCName' | 'setCDesc' | 'setCProductId' | 'setCPackageId' | 'setCDiscount' | 'setCPrice' | 'setCMaxUsage' | 'setCAoDaiQuantity' | 'setCShootPeopleCount' | 'setCValidFrom' | 'setCValidTo'
> &
  Pick<ReturnType<typeof useProviderInventoryState>,
    'inventorySummary'
  > &
{
  vMinOrder?: any;
  toast: ReturnType<typeof useToast>;
  fetchProviderData: () => Promise<void>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createPromotionActions({
  vCode, vName, vDesc, vType, vValue, vMaxDiscount, vMinOrder, vUsageLimit, vStartDate, vEndDate,
  editingVoucherId, setEditingVoucherId, setVCode, setVName, setVDesc, setVType, setVValue,
  setVMaxDiscount, setVMinOrder, setVUsageLimit, setVStartDate, setVEndDate, setIsVoucherModalOpen,
  toast, fetchProviderData, cProductId, cPackageId, photoPackages, cShootPeopleCount, inventorySummary,
  cAoDaiQuantity, cName, cDiscount, cValidFrom, cValidTo, cMaxUsage, cDesc, cPrice, editingComboId,
  setEditingComboId, setCName, setCDesc, setCProductId, setCPackageId, setCDiscount, setCPrice,
  setCMaxUsage, setCAoDaiQuantity, setCShootPeopleCount, setCValidFrom, setCValidTo,
}: Dependencies) {
  const clearVoucherForm = () => {
    setEditingVoucherId(null);
    setVCode('');
    setVName('');
    setVDesc('');
    setVType('PERCENTAGE');
    setVValue(10);
    setVMaxDiscount('');
    setVMinOrder(0);
    setVUsageLimit(50);
    setVStartDate('');
    setVEndDate('');
  };

  const handleCreateOrUpdateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vCode.trim()) {
      toast.error('Vui lòng nhập mã voucher');
      return;
    }
    if (!vName.trim()) {
      toast.error('Vui lòng nhập tên chương trình voucher');
      return;
    }
    if (vValue === '' || Number(vValue) <= 0) {
      toast.error('Giá trị giảm giá phải lớn hơn 0');
      return;
    }
    if (vType === 'PERCENTAGE' && (Number(vValue) < 1 || Number(vValue) > 100)) {
      toast.error('Phần trăm giảm giá phải từ 1% đến 100%');
      return;
    }

    const payload: any = {
      code: vCode.toUpperCase().trim(),
      name: vName.trim(),
      description: vDesc?.trim() || undefined,
      discountType: vType === 'FIXED_AMOUNT' ? 'FIXED_AMOUNT' : 'PERCENTAGE',
      discountValue: Number(vValue),
      minOrderValue: vMinOrder !== '' && vMinOrder !== undefined ? Number(vMinOrder) : 0,
      maxDiscountAmount: vMaxDiscount !== '' && Number(vMaxDiscount) > 0 ? Number(vMaxDiscount) : undefined,
      usageLimit: vUsageLimit !== '' && Number(vUsageLimit) > 0 ? Number(vUsageLimit) : undefined,
      startDate: vStartDate ? new Date(vStartDate).toISOString() : new Date().toISOString(),
      endDate: vEndDate ? new Date(vEndDate).toISOString() : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    };

    try {
      if (editingVoucherId) {
        await promotionsApi.updateVoucher(editingVoucherId, payload);
        toast.success(`Cập nhật voucher "${vCode}" thành công!`);
      } else {
        await promotionsApi.createVoucher(payload);
        toast.success(`Tạo mã ưu đãi "${vCode}" thành công!`);
      }
      clearVoucherForm();
      setIsVoucherModalOpen(false);
      fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Thao tác voucher thất bại');
    }
  };

  const handleEditVoucher = (voucher: any) => {
    const id = voucher._id || voucher.id;
    setEditingVoucherId(id);
    setVCode(voucher.code || '');
    setVName(voucher.name || '');
    setVDesc(voucher.description || '');
    setVType(voucher.discountType === 'FIXED_AMOUNT' ? 'FIXED_AMOUNT' : 'PERCENTAGE');
    setVValue(voucher.discountValue ?? 10);
    setVMaxDiscount(voucher.maxDiscountAmount ?? '');
    setVMinOrder(voucher.minOrderValue ?? 0);
    setVUsageLimit(voucher.usageLimit ?? '');
    setVStartDate(voucher.startDate ? toLocalDateKey(new Date(voucher.startDate)) : '');
    setVEndDate(voucher.endDate ? toLocalDateKey(new Date(voucher.endDate)) : '');
    setIsVoucherModalOpen(true);
  };

  const handleAddVoucher = handleCreateOrUpdateVoucher;

  const handleDeleteVoucher = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mã voucher này?')) return;
    try {
      await promotionsApi.deleteVoucher(id);
      toast.success('Đã xóa mã ưu đãi thành công!');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Xóa voucher thất bại');
    }
  };

  const handleCreateOrUpdateCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cProductId || !cPackageId) {
      toast.error('Vui lòng chọn cả áo dài và gói chụp ảnh');
      return;
    }

    const selectedPkg = photoPackages.find(p => p._id === cPackageId);
    if (selectedPkg) {
      const maxPeopleAllowed = selectedPkg.maxPeople || 1;
      if (Number(cShootPeopleCount || 1) > maxPeopleAllowed) {
        toast.error(`Số người chụp trong combo (${cShootPeopleCount}) không được lớn hơn số người chụp tối đa của gói chụp ảnh (${maxPeopleAllowed} người)`);
        return;
      }
    }

    const selectedAoDaiStock = cProductId && inventorySummary
      ? inventorySummary
        .filter((item: any) => item.productId === cProductId)
        .reduce((sum: number, item: any) => sum + (item.available || 0), 0)
      : 0;
    if (selectedAoDaiStock > 0 && Number(cAoDaiQuantity || 1) > selectedAoDaiStock) {
      toast.error(`Số lượng áo dài trong combo (${cAoDaiQuantity}) không được vượt quá số lượng tồn kho khả dụng (${selectedAoDaiStock})`);
      return;
    }
    if (!cName.trim()) {
      toast.error('Vui lòng nhập tên combo');
      return;
    }
    if (cDiscount === '' || cDiscount < 1 || cDiscount > 80) {
      toast.error('Phần trăm giảm giá phải nằm trong khoảng 1 - 80%');
      return;
    }
    if (!cValidFrom || !cValidTo) {
      toast.error('Vui lòng chọn khoảng thời gian hiệu lực của combo');
      return;
    }
    if (cValidFrom > cValidTo) {
      toast.error('Ngày bắt đầu không được lớn hơn ngày kết thúc');
      return;
    }
    if (cMaxUsage === '' || Number(cMaxUsage) < 1) {
      toast.error('Số lượng giới hạn combo phải lớn hơn hoặc bằng 1');
      return;
    }

    const payload: any = {
      name: cName,
      description: cDesc,
      discountPercent: Number(cDiscount),
      comboPrice: cPrice ? Number(cPrice) : undefined,
      validFrom: new Date(cValidFrom).toISOString(),
      validTo: new Date(cValidTo).toISOString(),
      maxUsage: Number(cMaxUsage),
      aoDaiQuantity: Number(cAoDaiQuantity || 1),
      shootPeopleCount: Number(cShootPeopleCount || 1),
    };

    if (!editingComboId) {
      payload.productId = cProductId;
      payload.photographyPackageId = cPackageId;
    }

    try {
      if (editingComboId) {
        await promotionsApi.updateCombo(editingComboId, payload);
        toast.success(`Cập nhật combo "${cName}" thành công!`);
      } else {
        await promotionsApi.createCombo(payload);
        toast.success(`Tạo combo "${cName}" thành công!`);
      }
      clearComboForm();
      fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Thao tác combo thất bại');
    }
  };

  const handleEditCombo = (combo: any) => {
    setEditingComboId(combo._id);
    setCName(combo.name);
    setCDesc(combo.description || '');
    setCProductId(combo.productId?._id || combo.productId || '');
    setCPackageId(combo.photographyPackageId?._id || combo.photographyPackageId || '');
    setCDiscount(combo.discountPercent);
    setCPrice(combo.comboPrice ? String(combo.comboPrice) : '');
    setCMaxUsage(combo.maxUsage || 10);
    setCAoDaiQuantity(combo.aoDaiQuantity || 1);
    setCShootPeopleCount(combo.shootPeopleCount || 1);

    if (combo.validFrom) {
      setCValidFrom(toLocalDateKey(new Date(combo.validFrom)));
    }
    if (combo.validTo) {
      setCValidTo(toLocalDateKey(new Date(combo.validTo)));
    }
  };

  const handleDeleteCombo = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa combo khuyến mãi này?')) return;
    try {
      await promotionsApi.deleteCombo(id);
      toast.success('Xóa combo thành công!');
      fetchProviderData();
    } catch (err: any) {
      toast.error(err.message || 'Xóa combo thất bại');
    }
  };

  const clearComboForm = () => {
    setEditingComboId(null);
    setCName('');
    setCDesc('');
    setCProductId('');
    setCPackageId('');
    setCDiscount(10);
    setCPrice('');
    setCValidFrom('');
    setCValidTo('');
    setCMaxUsage(10);
    setCAoDaiQuantity(1);
    setCShootPeopleCount(1);
  };

  return {
    handleAddVoucher, handleCreateOrUpdateVoucher, handleEditVoucher, clearVoucherForm,
    handleDeleteVoucher, handleCreateOrUpdateCombo, clearComboForm, handleEditCombo,
    handleDeleteCombo,
  };
}
