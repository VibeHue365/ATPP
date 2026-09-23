import React from 'react';
import type { useToast } from '../../../components/feedback/Toast';
import { providerApi } from '../api/providerDashboardApi';
import type { useProviderSessionState } from '../hooks/useProviderSessionState';
import { buildCancellationPolicySummary, normalizeCancellationRefundRules } from './policyHelpers';
import type { useProviderProfileState } from './useProviderProfileState';

type Dependencies = Pick<ReturnType<typeof useProviderProfileState>,
  'businessName' | 'phone' | 'addressLine' | 'city' | 'cancellationRefundRules' | 'cancellationAdditionalNotes' | 'setIsSavingProfile' | 'baseLatitude' | 'baseLongitude' | 'useBusinessAddressForPickup' | 'pickupAddressLine' | 'pickupLatitude' | 'pickupLongitude' | 'serviceRadiusKm' | 'comboDiscountPercent'
> &
  Pick<ReturnType<typeof useProviderSessionState>,
    'provider'
  > &
{
  toast: ReturnType<typeof useToast>;
  fetchProviderData: () => Promise<void>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createProfileActions({
  businessName, phone, addressLine, city, toast, cancellationRefundRules, cancellationAdditionalNotes,
  setIsSavingProfile, provider, baseLatitude, baseLongitude, useBusinessAddressForPickup,
  pickupAddressLine, pickupLatitude, pickupLongitude, serviceRadiusKm, comboDiscountPercent,
  fetchProviderData,
}: Dependencies) {
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !phone.trim() || !addressLine.trim() || !city.trim()) {
      toast.error('Vui lòng hoàn thiện tên cửa hàng, số điện thoại, thành phố và địa chỉ trên bản đồ.');
      return;
    }
    const normalizedCancellationRules = normalizeCancellationRefundRules(cancellationRefundRules);
    const hasInvalidCancellationRule = cancellationRefundRules.some((rule) =>
      !Number.isInteger(rule.noticeDays) || rule.noticeDays < 0 || rule.noticeDays > 365 ||
      !Number.isFinite(rule.refundPercent) || rule.refundPercent < 0 || rule.refundPercent > 100,
    );
    const hasDuplicateNoticeDays = new Set(cancellationRefundRules.map((rule) => rule.noticeDays)).size !== cancellationRefundRules.length;
    if (hasInvalidCancellationRule || hasDuplicateNoticeDays) {
      toast.error('Mỗi mốc hủy cần có số ngày và tỷ lệ hoàn từ 0 đến 100%; không được trùng mốc ngày.');
      return;
    }
    const cancellationPolicySummary = buildCancellationPolicySummary(normalizedCancellationRules, cancellationAdditionalNotes);
    setIsSavingProfile(true);
    try {
      await providerApi.updateProfile({
        businessName,
        contact: { ...provider?.contact, phone },
        address: { ...provider?.address, addressLine, city, geo: baseLatitude && baseLongitude ? { type: 'Point', coordinates: [Number(baseLongitude), Number(baseLatitude)] } : null },
        rentalSettings: { useBusinessAddressForPickup, pickupLocation: useBusinessAddressForPickup ? null : { addressLine: pickupAddressLine, geo: pickupLatitude && pickupLongitude ? { type: 'Point', coordinates: [Number(pickupLongitude), Number(pickupLatitude)] } : null } },
        photographySettings: { serviceRadiusKm: serviceRadiusKm === '' ? null : Number(serviceRadiusKm) },
        policies: {
          ...provider?.policies,
          cancellationPolicy: cancellationPolicySummary || null,
          cancellationPolicyConfig: {
            refundRules: normalizedCancellationRules,
            additionalNotes: cancellationAdditionalNotes.trim() || null,
          },
        },
        comboDiscountPercent: Number(comboDiscountPercent),
      });
      toast.success('Cập nhật thông tin dịch vụ thành công!');
      fetchProviderData();
    } catch (err: any) {
      toast.error('Cập nhật thất bại');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return { handleUpdateProfile };
}
