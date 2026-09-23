import type { NavigateFunction } from 'react-router-dom';
import Swal from 'sweetalert2';
import type { useToast } from '../../../components/feedback/Toast';
import type { useProviderAnalyticsState } from '../analytics/useProviderAnalyticsState';
import { bookingsApi, inventoryApi, portfolioApi, productsApi, promotionsApi, providerApi, reviewsApi } from '../api/providerDashboardApi';
import type { useProviderCalendarState } from '../calendar/useProviderCalendarState';
import type { useProviderInventoryState } from '../inventory/useProviderInventoryState';
import type { useProviderPortfolioState } from '../portfolio/useProviderPortfolioState';
import type { useProviderPromotionsState } from '../promotions/useProviderPromotionsState';
import type { useProviderReviewsState } from '../reviews/useProviderReviewsState';
import { normalizeCancellationRefundRules } from '../service-profile/policyHelpers';
import type { useProviderProfileState } from '../service-profile/useProviderProfileState';
import type { useProviderTrustState } from '../trust/useProviderTrustState';
import type { useProviderNavigationState } from './useProviderNavigationState';
import type { useProviderSessionState } from './useProviderSessionState';

type Dependencies = Pick<ReturnType<typeof useProviderSessionState>,
  'setIsLoadingProvider' | 'setProvider'
> &
  Pick<ReturnType<typeof useProviderProfileState>,
    'setBusinessName' | 'setPhone' | 'setAddressLine' | 'setCity' | 'setCancellationRefundRules' | 'setCancellationAdditionalNotes' | 'setComboDiscountPercent' | 'setBaseLatitude' | 'setBaseLongitude' | 'setServiceRadiusKm' | 'setUseBusinessAddressForPickup' | 'setPickupAddressLine' | 'setPickupLatitude' | 'setPickupLongitude'
  > &
  Pick<ReturnType<typeof useProviderNavigationState>,
    'currentView'
  > &
  Pick<ReturnType<typeof useProviderPortfolioState>,
    'setPortfolioItems'
  > &
  Pick<ReturnType<typeof useProviderPromotionsState>,
    'setPhotoPackages' | 'setCombos' | 'setVouchers'
  > &
  Pick<ReturnType<typeof useProviderInventoryState>,
    'setMyProductsList' | 'setInventorySummary'
  > &
  Pick<ReturnType<typeof useProviderCalendarState>,
    'setSchedules'
  > &
  Pick<ReturnType<typeof useProviderReviewsState>,
    'setReviewsData'
  > &
  Pick<ReturnType<typeof useProviderTrustState>,
    'setBookingsState'
  > &
  Pick<ReturnType<typeof useProviderAnalyticsState>,
    'setAnalyticsData'
  > &
{
  toast: ReturnType<typeof useToast>;
  navigate: NavigateFunction;
  logout: () => Promise<void>;
};

/** Recreated each render so handlers retain the dashboard's existing closure semantics. */
export function createProviderDataActions({
  setIsLoadingProvider, setProvider, setBusinessName, setPhone, setAddressLine, setCity,
  setCancellationRefundRules, setCancellationAdditionalNotes, setComboDiscountPercent, setBaseLatitude,
  setBaseLongitude, setServiceRadiusKm, setUseBusinessAddressForPickup, setPickupAddressLine,
  setPickupLatitude, setPickupLongitude, currentView, setPortfolioItems, setPhotoPackages,
  setMyProductsList, setInventorySummary, setCombos, setVouchers, setSchedules, setReviewsData,
  setBookingsState, setAnalyticsData, toast, navigate, logout,
}: Dependencies) {
  const fetchProviderData = async () => {
    setIsLoadingProvider(true);
    try {
      const pRes: any = await providerApi.getProfile();
      setProvider(pRes);
      setBusinessName(pRes.businessName || '');
      setPhone(pRes.contact?.phone || '');
      setAddressLine(pRes.address?.addressLine || '');
      setCity(pRes.address?.city || '');
      const persistedCancellationConfig = pRes.policies?.cancellationPolicyConfig;
      const legacyCancellationPolicy = pRes.policies?.cancellationPolicy || '';
      setCancellationRefundRules(Array.isArray(persistedCancellationConfig?.refundRules)
        ? normalizeCancellationRefundRules(persistedCancellationConfig.refundRules)
        : []);
      setCancellationAdditionalNotes(persistedCancellationConfig
        ? (persistedCancellationConfig.additionalNotes || '')
        : legacyCancellationPolicy);
      setComboDiscountPercent(pRes.comboDiscountPercent ?? 0);
      setBaseLatitude(pRes.address?.geo?.coordinates?.[1]?.toString() ?? '');
      setBaseLongitude(pRes.address?.geo?.coordinates?.[0]?.toString() ?? '');
      setServiceRadiusKm(pRes.photographySettings?.serviceRadiusKm?.toString() ?? '');
      setUseBusinessAddressForPickup(pRes.rentalSettings?.useBusinessAddressForPickup !== false);
      setPickupAddressLine(pRes.rentalSettings?.pickupLocation?.addressLine ?? '');
      setPickupLatitude(pRes.rentalSettings?.pickupLocation?.geo?.coordinates?.[1]?.toString() ?? '');
      setPickupLongitude(pRes.rentalSettings?.pickupLocation?.geo?.coordinates?.[0]?.toString() ?? '');

      const hasPhotography = Array.isArray(pRes.capabilities) && pRes.capabilities.includes('PHOTOGRAPHY');
      const hasAodai = Array.isArray(pRes.capabilities) && (pRes.capabilities.includes('AODAI_RENTAL') || pRes.capabilities.includes('RENTAL'));
      const view = currentView;
      const shouldLoadPortfolio = view === 'portfolio';
      const shouldLoadComboData = view === 'vouchers';
      const shouldLoadCalendar = view === 'calendar';
      const shouldLoadReviews = view === 'reviews';
      const shouldLoadBookings = view === 'reviews' || view === 'trust';
      const shouldLoadAnalytics = view === 'analytics' || view === 'overview';
      const [portfolioRes, packagesRes, productsRes, summary, combosRes, schedulesRes, vouchersRes, reviewsRes, bookingsRes, analyticsRes] = await Promise.all([
        shouldLoadPortfolio && hasPhotography ? portfolioApi.listItems() : Promise.resolve(null),
        shouldLoadComboData && hasPhotography ? providerApi.listPhotographyPackages() : Promise.resolve(null),
        shouldLoadComboData && hasAodai ? productsApi.listForCombos() : Promise.resolve(null),
        shouldLoadComboData && hasAodai ? inventoryApi.getSummary() : Promise.resolve(null),
        shouldLoadComboData && hasAodai && hasPhotography ? promotionsApi.listCombos() : Promise.resolve(null),
        shouldLoadCalendar ? providerApi.listSchedules() : Promise.resolve(null),
        view === 'vouchers' ? promotionsApi.listVouchers() : Promise.resolve(null),
        shouldLoadReviews ? reviewsApi.getStats() : Promise.resolve(null),
        shouldLoadBookings ? bookingsApi.list() : Promise.resolve(null),
        shouldLoadAnalytics ? providerApi.getAnalytics() : Promise.resolve(null),
      ]) as any[];

      if (shouldLoadPortfolio) setPortfolioItems(Array.isArray(portfolioRes) ? portfolioRes : []);
      if (shouldLoadComboData) {
        if (hasPhotography) setPhotoPackages(Array.isArray(packagesRes) ? packagesRes : []);
        if (hasAodai) {
          setMyProductsList(productsRes?.items || []);
          setInventorySummary(Array.isArray(summary) ? summary : []);
        }
        if (hasAodai && hasPhotography) setCombos(Array.isArray(combosRes) ? combosRes : []);
        setVouchers(Array.isArray(vouchersRes) ? vouchersRes : []);
      }
      if (shouldLoadCalendar) setSchedules(Array.isArray(schedulesRes) ? schedulesRes : []);
      if (shouldLoadReviews) setReviewsData(reviewsRes);
      if (shouldLoadBookings) setBookingsState(Array.isArray(bookingsRes) ? bookingsRes : []);
      if (shouldLoadAnalytics) setAnalyticsData(analyticsRes);
    } catch (err: any) {
      const msg = err.message || 'Không thể đồng bộ dữ liệu đối tác';
      toast.error(msg);
      if (msg.includes('đình chỉ') || msg.includes('susp')) {
        Swal.fire({
          title: 'Dịch vụ đối tác bị tạm ngưng',
          text: msg,
          icon: 'warning',
          confirmButtonText: 'Quay lại trang chủ',
          confirmButtonColor: '#B89047',
          allowOutsideClick: false,
        }).then(() => {
          navigate('/');
        });
      } else if (msg.includes('khoá') || msg.includes('khóa') || msg.includes('ban') || msg.includes('unauth')) {
        Swal.fire({
          title: 'Tài khoản bị khóa',
          text: msg,
          icon: 'error',
          confirmButtonText: 'Đăng xuất',
          confirmButtonColor: 'var(--color-primary)',
          allowOutsideClick: false,
        }).then(() => {
          logout();
          navigate('/auth/login');
        });
      }
    } finally {
      setIsLoadingProvider(false);
    }
  };

  return { fetchProviderData };
}
