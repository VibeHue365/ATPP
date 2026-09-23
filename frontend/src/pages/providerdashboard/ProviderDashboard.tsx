import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookingDetailModal } from '../../components/common/BookingDetailModal';
import { useToast } from '../../components/feedback/Toast';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { PortfolioItemFormModal } from '../../features/photographers/components/PortfolioItemFormModal';
import { PhotographyPackageManager } from '../../features/photography-packages/components/PhotographyPackageManager';
import { ProviderOverviewPanel } from '../../features/provider-dashboard/overview/ProviderOverviewPanel';
import { createAnalyticsActions } from '../../features/provider-dashboard/analytics/createAnalyticsActions';
import { useProviderAnalyticsState } from '../../features/provider-dashboard/analytics/useProviderAnalyticsState';
import { CalendarPanel } from '../../features/provider-dashboard/calendar/CalendarPanel';
import { createCalendarActions } from '../../features/provider-dashboard/calendar/createCalendarActions';
import { useProviderCalendarState } from '../../features/provider-dashboard/calendar/useProviderCalendarState';
import { CampaignModal } from '../../features/provider-dashboard/collections/CampaignModal';
import { CollectionsPanel } from '../../features/provider-dashboard/collections/CollectionsPanel';
import { createCampaignActions } from '../../features/provider-dashboard/collections/createCampaignActions';
import { createProductDataActions } from '../../features/provider-dashboard/collections/createProductDataActions';
import { createProductWizardActions } from '../../features/provider-dashboard/collections/createProductWizardActions';
import { ProductWizardModal } from '../../features/provider-dashboard/collections/ProductWizardModal';
import { useProductWizardState } from '../../features/provider-dashboard/collections/useProductWizardState';
import { useProviderCampaignState } from '../../features/provider-dashboard/collections/useProviderCampaignState';
import { useProviderProductsState } from '../../features/provider-dashboard/collections/useProviderProductsState';
import { createProviderDataActions } from '../../features/provider-dashboard/hooks/createProviderDataActions';
import { createSessionActions } from '../../features/provider-dashboard/hooks/createSessionActions';
import { useProviderNavigationState } from '../../features/provider-dashboard/hooks/useProviderNavigationState';
import { useProviderNotifications } from '../../features/provider-dashboard/hooks/useProviderNotifications';
import { useProviderSessionState } from '../../features/provider-dashboard/hooks/useProviderSessionState';
import { AddInventoryModal } from '../../features/provider-dashboard/inventory/AddInventoryModal';
import { createInventoryActions } from '../../features/provider-dashboard/inventory/createInventoryActions';
import { EditInventoryModal } from '../../features/provider-dashboard/inventory/EditInventoryModal';
import { InventoryPanel } from '../../features/provider-dashboard/inventory/InventoryPanel';
import { useProviderInventoryState } from '../../features/provider-dashboard/inventory/useProviderInventoryState';
import { VariantQuantityModal } from '../../features/provider-dashboard/inventory/VariantQuantityModal';
import { ProviderHeader } from '../../features/provider-dashboard/layout/ProviderHeader';
import { ProviderSidebar } from '../../features/provider-dashboard/layout/ProviderSidebar';
import { createBookingActions } from '../../features/provider-dashboard/orders/createBookingActions';
import { createIncidentActions } from '../../features/provider-dashboard/orders/createIncidentActions';
import { createOrderDataActions } from '../../features/provider-dashboard/orders/createOrderDataActions';
import { IncidentReportModal } from '../../features/provider-dashboard/orders/IncidentReportModal';
import { getOrderGroup } from '../../features/provider-dashboard/orders/orderHelpers';
import { OrdersPanel } from '../../features/provider-dashboard/orders/OrdersPanel';
import { useProviderIncidentState } from '../../features/provider-dashboard/orders/useProviderIncidentState';
import { useProviderOrderState } from '../../features/provider-dashboard/orders/useProviderOrderState';
import { createPayoutActions } from '../../features/provider-dashboard/payouts/createPayoutActions';
import { PayoutsPanel } from '../../features/provider-dashboard/payouts/PayoutsPanel';
import { useProviderPayoutsState } from '../../features/provider-dashboard/payouts/useProviderPayoutsState';
import { createPortfolioActions } from '../../features/provider-dashboard/portfolio/createPortfolioActions';
import { PortfolioPanel } from '../../features/provider-dashboard/portfolio/PortfolioPanel';
import { PortfolioPreviewModal } from '../../features/provider-dashboard/portfolio/PortfolioPreviewModal';
import { useProviderPortfolioState } from '../../features/provider-dashboard/portfolio/useProviderPortfolioState';
import { CombosPanel } from '../../features/provider-dashboard/combos/CombosPanel';
import { createPromotionActions } from '../../features/provider-dashboard/promotions/createPromotionActions';
import { useProviderPromotionsState } from '../../features/provider-dashboard/promotions/useProviderPromotionsState';
import { RentalOperationsPanel } from '../../features/provider-dashboard/rental-operations/RentalOperationsPanel';
import { createReviewActions } from '../../features/provider-dashboard/reviews/createReviewActions';
import { ReviewReplyModal } from '../../features/provider-dashboard/reviews/ReviewReplyModal';
import { ReviewsPanel } from '../../features/provider-dashboard/reviews/ReviewsPanel';
import { useProviderReviewsState } from '../../features/provider-dashboard/reviews/useProviderReviewsState';
import { RolesPanel } from '../../features/provider-dashboard/roles/RolesPanel';
import { createProfileActions } from '../../features/provider-dashboard/service-profile/createProfileActions';
import { buildCancellationPolicySummary, normalizeCancellationRefundRules } from '../../features/provider-dashboard/service-profile/policyHelpers';
import { ServiceProfilePanel } from '../../features/provider-dashboard/service-profile/ServiceProfilePanel';
import { useProviderProfileState } from '../../features/provider-dashboard/service-profile/useProviderProfileState';
import { createTrustActions } from '../../features/provider-dashboard/trust/createTrustActions';
import { CustomerRatingModal } from '../../features/provider-dashboard/trust/CustomerRatingModal';
import { TrustPanel } from '../../features/provider-dashboard/trust/TrustPanel';
import { useProviderTrustState } from '../../features/provider-dashboard/trust/useProviderTrustState';
import { NotificationsPage } from '../notifications/NotificationsPage';
import './providerServiceProfile.css';

export const ProviderDashboard: React.FC = () => {
  // Feature state is always mounted here, independent of the visible panel.
  // Cross-feature callbacks are deferred until invocation to preserve the original closures.

  const navigate = useNavigate();

  const { logout, user, isAuthenticated } = useAuth();

  const toast = useToast();

  useEffect(() => {
    if (isAuthenticated !== undefined) {
      if (!isAuthenticated) {
        navigate('/auth/login', { replace: true });
        return;
      }
      const roles = user?.roles || [];
      const isProvider = roles.some(r => r.toUpperCase() === 'PROVIDER');
      if (!isProvider) {
        toast.error('Bạn không có quyền truy cập trang quản trị của Đối tác!');
        navigate('/', { replace: true });
      }
    }
  }, [user, isAuthenticated, navigate, toast]);

  const { currentView, setCurrentView, collectionTab, setCollectionTab } = useProviderNavigationState();

  const {
    provider, setProvider, selectedBookingId, setSelectedBookingId, isDetailModalOpen,
    setIsDetailModalOpen, isLoadingProvider, setIsLoadingProvider,
  } = useProviderSessionState();


  const {
    analyticsData, setAnalyticsData, chartTimeRange, setChartTimeRange,
  } = useProviderAnalyticsState();

  const {
    portfolioItems, setPortfolioItems, isPortfolioFormOpen, setIsPortfolioFormOpen, isPortfolioSaving,
    setIsPortfolioSaving, hoveredItemId, setHoveredItemId, editingPortfolioItem, setEditingPortfolioItem,
    previewPortfolioItem, setPreviewPortfolioItem, previewImageIndex, setPreviewImageIndex,
  } = useProviderPortfolioState();

  const hasPhotographyCapability = Array.isArray(provider?.capabilities) && provider.capabilities.includes('PHOTOGRAPHY');

  const hasAodaiCapability = Array.isArray(provider?.capabilities) && (provider.capabilities.includes('COSTUME_RENTAL') || provider.capabilities.includes('AODAI_RENTAL') || provider.capabilities.includes('RENTAL'));

  const {
    prodSearch, setProdSearch, prodSortBy, setProdSortBy, prodPage, setProdPage, prodLimit, prodTotal,
    setProdTotal, prodSizeFilter, setProdSizeFilter, prodColorFilter, setProdColorFilter,
    debouncedProdSearch, setDebouncedProdSearch, products, setProducts, categories, setCategories,
    loadingProducts, setLoadingProducts, styleCategories, setStyleCategories, eventCategories,
    setEventCategories,
  } = useProviderProductsState();

  const {
    invSearch, setInvSearch, invSortBy, setInvSortBy, invStatusFilter, setInvStatusFilter,
    invConditionFilter, setInvConditionFilter, invPage, setInvPage, invSummaryPage, setInvSummaryPage,
    invLimit, invTotal, setInvTotal, debouncedInvSearch, setDebouncedInvSearch, inventoryItems,
    setInventoryItems, inventorySummary, setInventorySummary, myProductsList, setMyProductsList,
    isLoadingInventory, setIsLoadingInventory, variantEditRow, setVariantEditRow, variantEditQty,
    setVariantEditQty, variantBusy, setVariantBusy, isAddInventoryOpen, setIsAddInventoryOpen,
    addInvProductId, setAddInvProductId, addInvSize, setAddInvSize, addInvColor, setAddInvColor,
    addInvMaterial, setAddInvMaterial, addInvQuantity, setAddInvQuantity, addInvCondition,
    setAddInvCondition, addInvNotes, setAddInvNotes, isEditInventoryOpen, setIsEditInventoryOpen,
    editInvItem, setEditInvItem, editInvStatus, setEditInvStatus, editInvCondition, setEditInvCondition,
    editInvNotes, setEditInvNotes,
  } = useProviderInventoryState();

  const {
    isCampaignModalOpen, setIsCampaignModalOpen, campaignOccasion, setCampaignOccasion, campaignPercent,
    setCampaignPercent, campaignStart, setCampaignStart, campaignEnd, setCampaignEnd, activeCampaign,
    setActiveCampaign, submittingCampaign, setSubmittingCampaign,
  } = useProviderCampaignState();

  useEffect(() => {
    if (provider) {
      if (!hasAodaiCapability && (currentView === 'rental-operations' || currentView === 'collections')) {
        setCurrentView('overview');
      }
      if (!hasPhotographyCapability && (currentView === 'portfolio' || currentView === 'photography-packages')) {
        setCurrentView('overview');
      }
    }
  }, [provider, hasAodaiCapability, hasPhotographyCapability, currentView, setCurrentView]);

  const {
    schedules, setSchedules, selectedScheduleDays, setSelectedScheduleDays, workingHourRanges,
    setWorkingHourRanges, editingScheduleDay, setEditingScheduleDay, blockedDate, setBlockedDate,
    scheduleCapability, setScheduleCapability,
    activeSubNavTab, setActiveSubNavTab, calendarMonth, setCalendarMonth,
    selectedDate, setSelectedDate, blockType, setBlockType, blockSlotStart,
    setBlockSlotStart, blockSlotEnd, setBlockSlotEnd, blockReason, setBlockReason,
    listTab, setListTab,
  } = useProviderCalendarState();

  const {
    vouchers, setVouchers, combos, setCombos, photoPackages, setPhotoPackages, cName, setCName, cDesc,
    setCDesc, cProductId, setCProductId, cPackageId, setCPackageId, cDiscount, setCDiscount, cPrice,
    setCPrice, cValidFrom, setCValidFrom, cValidTo, setCValidTo, cMaxUsage, setCMaxUsage, cAoDaiQuantity,
    setCAoDaiQuantity, cShootPeopleCount, setCShootPeopleCount, isAoDaiModalOpen, setIsAoDaiModalOpen,
    isPackageModalOpen, setIsPackageModalOpen, aoDaiSearch, setAoDaiSearch, packageSearch,
    setPackageSearch, editingComboId, setEditingComboId, editingVoucherId, setEditingVoucherId,
    vCode, setVCode, vName, setVName, vDesc, setVDesc, vType, setVType, vValue, setVValue,
    vMaxDiscount, setVMaxDiscount, vMinOrder, setVMinOrder, vUsageLimit, setVUsageLimit,
    vStartDate, setVStartDate, vEndDate, setVEndDate, isVoucherModalOpen, setIsVoucherModalOpen,
  } = useProviderPromotionsState();

  useEffect(() => {
    if (cProductId && cPackageId) {
      const prod = myProductsList.find(p => p._id === cProductId);
      const pkg = photoPackages.find(p => p._id === cPackageId);
      if (prod && pkg) {
        const discountPercent = Number(cDiscount) || 0;
        const originalPrice = (prod.basePrice || 0) + (pkg.price || 0);
        const calculatedPrice = Math.round(originalPrice * (1 - discountPercent / 100));
        setCPrice(String(calculatedPrice));
      }
    }
  }, [cProductId, cPackageId, cDiscount, myProductsList, photoPackages, setCPrice]);

  const {
    reviewsData, setReviewsData, replyingReviewId, setReplyingReviewId, replyText, setReplyText,
  } = useProviderReviewsState();

  const {
    bookingsState, setBookingsState, ratingBooking, setRatingBooking, cRating, setCRating, cComment,
    setCComment, searchCustId, setSearchCustId, trustScoreResult, setTrustScoreResult,
  } = useProviderTrustState();

  const { payouts, setPayouts } = useProviderPayoutsState();

  const {
    businessName, setBusinessName, phone, setPhone, addressLine, setAddressLine, city, setCity,
    cancellationRefundRules, setCancellationRefundRules, cancellationAdditionalNotes,
    setCancellationAdditionalNotes, comboDiscountPercent, setComboDiscountPercent, baseLatitude,
    setBaseLatitude, baseLongitude, setBaseLongitude, serviceRadiusKm, setServiceRadiusKm,
    useBusinessAddressForPickup, setUseBusinessAddressForPickup, pickupAddressLine, setPickupAddressLine,
    pickupLatitude, setPickupLatitude, pickupLongitude, setPickupLongitude, profileSection,
    setProfileSection, isSavingProfile, setIsSavingProfile,
  } = useProviderProfileState();

  const {
    isNotiOpen, setIsNotiOpen, notifications, loadingNoti, notiRef, fetchNotifications,
    providerUnreadCount, handleNotiMarkAsRead, handleNotiMarkAllAsRead, getNotiTimeAgo, getNotiTypeStyle,
  } = useProviderNotifications();

  const normalizedCancellationRules = normalizeCancellationRefundRules(cancellationRefundRules);

  const cancellationPolicySummary = buildCancellationPolicySummary(normalizedCancellationRules, cancellationAdditionalNotes);

  const persistedCancellationConfig = provider?.policies?.cancellationPolicyConfig;

  const persistedCancellationRules = Array.isArray(persistedCancellationConfig?.refundRules)
    ? normalizeCancellationRefundRules(persistedCancellationConfig.refundRules)
    : [];

  const persistedCancellationNotes = persistedCancellationConfig
    ? (persistedCancellationConfig.additionalNotes || '')
    : (provider?.policies?.cancellationPolicy ?? '');

  const profileHasUnsavedChanges = Boolean(provider) && (
    businessName !== (provider?.businessName ?? '') ||
    phone !== (provider?.contact?.phone ?? '') ||
    addressLine !== (provider?.address?.addressLine ?? '') ||
    city !== (provider?.address?.city ?? '') ||
    cancellationPolicySummary !== (provider?.policies?.cancellationPolicy ?? '') ||
    JSON.stringify(normalizedCancellationRules) !== JSON.stringify(persistedCancellationRules) ||
    cancellationAdditionalNotes !== persistedCancellationNotes ||
    baseLatitude !== (provider?.address?.geo?.coordinates?.[1]?.toString() ?? '') ||
    baseLongitude !== (provider?.address?.geo?.coordinates?.[0]?.toString() ?? '') ||
    serviceRadiusKm !== (provider?.photographySettings?.serviceRadiusKm?.toString() ?? '') ||
    useBusinessAddressForPickup !== (provider?.rentalSettings?.useBusinessAddressForPickup !== false) ||
    pickupAddressLine !== (provider?.rentalSettings?.pickupLocation?.addressLine ?? '') ||
    pickupLatitude !== (provider?.rentalSettings?.pickupLocation?.geo?.coordinates?.[1]?.toString() ?? '') ||
    pickupLongitude !== (provider?.rentalSettings?.pickupLocation?.geo?.coordinates?.[0]?.toString() ?? '')
  );

  const {
    orders, setOrders, loadingOrders, setLoadingOrders, orderTab, setOrderTab, bookingTypeFilter,
    setBookingTypeFilter, activePage, setActivePage, actionMenuId, setActionMenuId,
  } = useProviderOrderState();

  const {
    reportingOrder, setReportingOrder, selectedItemId, setSelectedItemId, incidentDesc, setIncidentDesc,
    incidentPhotos, setIncidentPhotos, incidentAmount, setIncidentAmount, incidentActionType,
    setIncidentActionType,
  } = useProviderIncidentState();

  const {
    isModalOpen, setIsModalOpen, editingProduct, setEditingProduct, prodName, setProdName, prodCategoryId,
    setProdCategoryId, prodDescription, setProdDescription, prodBasePrice, setProdBasePrice,
    prodDepositAmount, setProdDepositAmount, prodSizes, setProdSizes, prodColors, setProdColors,
    prodMaterials, setProdMaterials, prodStatus, setProdStatus, prodImages, setProdImages,
    prodColorImages, setProdColorImages, uploadingColor, setUploadingColor, uploadingImages,
    setUploadingImages, prodVideos, setProdVideos, uploadingVideos, setUploadingVideos, prodStyle,
    setProdStyle, prodOccasions, setProdOccasions, prodStyleCategoryIds, setProdStyleCategoryIds,
    prodEventCategoryIds, setProdEventCategoryIds, variants, setVariants, wizardStep, setWizardStep,
    createdDraftId, setCreatedDraftId, activeTagCodes, setActiveTagCodes, editInvSummary,
    setEditInvSummary, savingDraft, setSavingDraft,
  } = useProductWizardState();

  const { handlePeriodChange } = createAnalyticsActions({
    setChartTimeRange,
    setAnalyticsData
  });

  const { fetchProviderData } = createProviderDataActions({
    setIsLoadingProvider,
    setProvider,
    setBusinessName,
    setPhone,
    setAddressLine,
    setCity,
    setCancellationRefundRules,
    setCancellationAdditionalNotes,
    setComboDiscountPercent,
    setBaseLatitude,
    setBaseLongitude,
    setServiceRadiusKm,
    setUseBusinessAddressForPickup,
    setPickupAddressLine,
    setPickupLatitude,
    setPickupLongitude,
    currentView,
    setPortfolioItems,
    setPhotoPackages,
    setMyProductsList,
    setInventorySummary,
    setCombos,
    setVouchers,
    setSchedules,
    setReviewsData,
    setBookingsState,
    setAnalyticsData,
    toast,
    navigate,
    logout
  });

  const { fetchPayouts } = createPayoutActions({
    setPayouts
  });

  const { handleUpdateProfile } = createProfileActions({
    businessName,
    phone,
    addressLine,
    city,
    toast,
    cancellationRefundRules,
    cancellationAdditionalNotes,
    setIsSavingProfile,
    provider,
    baseLatitude,
    baseLongitude,
    useBusinessAddressForPickup,
    pickupAddressLine,
    pickupLatitude,
    pickupLongitude,
    serviceRadiusKm,
    comboDiscountPercent,
    fetchProviderData: (...args) => fetchProviderData(...args)
  });

  const { toggleScheduleDay, updateWorkingHourRange, handleSaveRecurringSchedules, handleBlockDate, handleEditRecurringSchedule, handleUnblockDate } = createCalendarActions({
    setSelectedScheduleDays,
    setWorkingHourRanges,
    selectedScheduleDays,
    toast,
    workingHourRanges,
    scheduleCapability,
    setEditingScheduleDay,
    fetchProviderData: (...args) => fetchProviderData(...args),
    blockedDate,
    setBlockedDate,
    blockType,
    blockSlotStart,
    blockSlotEnd,
    blockReason,
    setBlockReason,
  });

  const { handleAddPortfolio, handleRemovePortfolio, handleDeletePortfolioItem, handlePortfolioFormSubmit } = createPortfolioActions({
    toast,
    fetchProviderData: (...args) => fetchProviderData(...args),
    setIsPortfolioSaving,
    editingPortfolioItem,
    setIsPortfolioFormOpen,
    setEditingPortfolioItem
  });

  const { handleReportReview, handleReplyReview } = createReviewActions({
    replyingReviewId,
    replyText,
    toast,
    setReplyingReviewId,
    setReplyText,
    fetchProviderData: (...args) => fetchProviderData(...args)
  });

  const { handleSearchTrustScore, handleRateCustomer, viewCustomerTrust } = createTrustActions({
    setIsDetailModalOpen,
    setCurrentView,
    setSearchCustId,
    setTrustScoreResult,
    ratingBooking,
    cRating,
    cComment,
    toast,
    setRatingBooking,
    setCComment,
    setCRating,
    fetchProviderData: (...args) => fetchProviderData(...args),
    searchCustId
  });

  const { handleLogoutClick } = createSessionActions({
    logout,
    toast,
    navigate
  });

  void handleAddPortfolio;

  void handleRemovePortfolio;

  const {
    fetchInventoryData, handleRemoveVariant, handleDeleteInventoryItem, handleCreateInventoryItem,
    handleUpdateInventoryItem, handleAdjustVariantQuantity,
  } = createInventoryActions({
    setIsLoadingInventory,
    invPage,
    debouncedInvSearch,
    invStatusFilter,
    invConditionFilter,
    invSortBy,
    invLimit,
    setInventoryItems,
    setInvTotal,
    setInventorySummary,
    setMyProductsList,
    toast,
    addInvProductId,
    addInvMaterial,
    addInvSize,
    addInvColor,
    addInvQuantity,
    addInvCondition,
    addInvNotes,
    myProductsList,
    setIsAddInventoryOpen,
    setAddInvProductId,
    setAddInvSize,
    setAddInvColor,
    setAddInvMaterial,
    setAddInvQuantity,
    setAddInvCondition,
    setAddInvNotes,
    editingProduct,
    loadEditInvSummary: (...args) => loadEditInvSummary(...args),
    editInvItem,
    editInvStatus,
    editInvCondition,
    editInvNotes,
    setIsEditInventoryOpen,
    setEditInvItem,
    setInvSummaryPage,
    setInvPage,
    isModalOpen,
    variantEditRow,
    variantBusy,
    variantEditQty,
    setVariantBusy,
    setVariantEditRow
  });

  const {
    handleAddVoucher, handleCreateOrUpdateVoucher, handleEditVoucher, clearVoucherForm,
    handleDeleteVoucher, handleCreateOrUpdateCombo, clearComboForm, handleEditCombo,
    handleDeleteCombo,
  } = createPromotionActions({
    vCode,
    vName,
    vDesc,
    vType,
    vValue,
    vMaxDiscount,
    vMinOrder,
    vUsageLimit,
    vStartDate,
    vEndDate,
    editingVoucherId,
    setEditingVoucherId,
    setIsVoucherModalOpen,
    toast,
    setVCode,
    setVName,
    setVDesc,
    setVType,
    setVValue,
    setVMaxDiscount,
    setVMinOrder,
    setVUsageLimit,
    setVStartDate,
    setVEndDate,
    fetchProviderData,
    cProductId,
    cPackageId,
    photoPackages,
    cShootPeopleCount,
    inventorySummary,
    cAoDaiQuantity,
    cName,
    cDiscount,
    cValidFrom,
    cValidTo,
    cMaxUsage,
    cDesc,
    cPrice,
    editingComboId,
    setEditingComboId,
    setCName,
    setCDesc,
    setCProductId,
    setCPackageId,
    setCDiscount,
    setCPrice,
    setCMaxUsage,
    setCAoDaiQuantity,
    setCShootPeopleCount,
    setCValidFrom,
    setCValidTo
  });

  const { handleSendIncidentReport, handleIncidentPhotoUpload } = createIncidentActions({
    toast,
    setIncidentPhotos,
    reportingOrder,
    selectedItemId,
    incidentPhotos,
    incidentAmount,
    incidentDesc,
    incidentActionType,
    setReportingOrder,
    setSelectedItemId,
    setIncidentDesc,
    setIncidentAmount,
    setIncidentActionType,
    fetchOrders: (...args) => fetchOrders(...args)
  });

  const { fetchOrders } = createOrderDataActions({
    setLoadingOrders,
    setOrders,
    actionMenuId,
    toast
  });

  const { resolveRescheduleRequest, changeOrderStatus } = createBookingActions({
    orders,
    setActionMenuId,
    setOrders,
    toast,
    fetchOrders: (...args) => fetchOrders(...args)
  });

  const { fetchCategories, fetchServiceCategories, fetchProducts, handleDeleteProduct } = createProductDataActions({
    setLoadingProducts,
    debouncedProdSearch,
    prodSortBy,
    prodPage,
    prodLimit,
    prodSizeFilter,
    prodColorFilter,
    setProducts,
    setProdTotal,
    toast,
    setCategories,
    prodCategoryId,
    setProdCategoryId,
    setStyleCategories,
    setEventCategories
  });

  const { fetchActiveCampaign, openCampaignModal, handleDeactivateCampaign, handleCreateCampaign } = createCampaignActions({
    setActiveCampaign,
    setCampaignOccasion,
    setCampaignPercent,
    setCampaignStart,
    setCampaignEnd,
    setIsCampaignModalOpen,
    campaignOccasion,
    toast,
    campaignPercent,
    campaignStart,
    campaignEnd,
    setSubmittingCampaign,
    fetchProducts: (...args) => fetchProducts(...args)
  });

  const {
    loadEditInvSummary, openAddModal, openEditModal, handleDuplicateProduct, handleWizardCancel,
    handleImageChange, removeImage, handleVideoChange, removeVideo, updateVariantRow, removeVariantRow,
    addVariantRow, colorsNeedingImages, handleColorImageChange, removeColorImage, handleWizardFinish,
    handleWizardBack, handleWizardNext,
  } = createProductWizardActions({
    setEditingProduct,
    setProdName,
    setProdDescription,
    setProdBasePrice,
    setProdDepositAmount,
    setProdSizes,
    setProdColors,
    setProdMaterials,
    setProdStatus,
    setProdImages,
    setProdColorImages,
    setProdVideos,
    setProdStyle,
    setProdOccasions,
    setProdStyleCategoryIds,
    setProdEventCategoryIds,
    setVariants,
    setWizardStep,
    setCreatedDraftId,
    setActiveTagCodes,
    categories,
    setProdCategoryId,
    setIsModalOpen,
    setEditInvSummary,
    setUploadingImages,
    toast,
    prodVideos,
    setUploadingVideos,
    editingProduct,
    editInvSummary,
    variants,
    setUploadingColor,
    prodImages,
    prodColorImages,
    prodName,
    prodCategoryId,
    prodDescription,
    prodBasePrice,
    prodDepositAmount,
    prodStatus,
    prodStyle,
    prodOccasions,
    prodStyleCategoryIds,
    prodEventCategoryIds,
    wizardStep,
    setSavingDraft,
    createdDraftId,
    activeTagCodes,
    styleCategories,
    eventCategories,
    fetchProducts: (...args) => fetchProducts(...args)
  });

  useEffect(() => {
    if (currentView === 'overview') {
      fetchProviderData();
      fetchOrders();
    } else if (currentView === 'orders' || currentView === 'rental-operations') {
      fetchOrders();
    } else if (currentView === 'collections') {
      fetchCategories();
      fetchServiceCategories();
      fetchActiveCampaign();
    } else if (currentView === 'payouts') {
      fetchPayouts();
    } else if (currentView === 'inventory') {
      fetchInventoryData();
    } else if (['profile', 'portfolio', 'calendar', 'vouchers', 'reviews', 'trust', 'analytics', 'role-management'].includes(currentView)) {
      fetchProviderData();
    }
  }, [currentView]);

  const { socket } = useSocket();

  const fetchOrdersRef = useRef(fetchOrders);

  useEffect(() => { fetchOrdersRef.current = fetchOrders; });

  useEffect(() => {
    if (!socket) return;
    const handler = (_payload: { bookingId: string; status: string }) => {
      fetchOrdersRef.current(true);
    };
    socket.on('booking_updated', handler);
    return () => { socket.off('booking_updated', handler); };
  }, [socket]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedProdSearch(prodSearch.trim()), 300);
    return () => window.clearTimeout(timeoutId);
  }, [prodSearch, setDebouncedProdSearch]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedInvSearch(invSearch.trim()), 300);
    return () => window.clearTimeout(timeoutId);
  }, [invSearch, setDebouncedInvSearch]);

  useEffect(() => {
    if (currentView === 'collections' && collectionTab === 'products') {
      fetchProducts();
    }
  }, [currentView, collectionTab, debouncedProdSearch, prodSortBy, prodPage, prodSizeFilter, prodColorFilter]);

  useEffect(() => {
    if (currentView === 'collections' && collectionTab === 'inventory') {
      fetchInventoryData();
    }
  }, [currentView, collectionTab]);

  useEffect(() => {
    if (currentView === 'collections' && collectionTab === 'inventory') {
      fetchInventoryData({ silent: true, itemsOnly: true });
    }
  }, [debouncedInvSearch, invSortBy, invStatusFilter, invConditionFilter, invPage]);

  const roleFilteredOrders = React.useMemo(() => {
    if (hasAodaiCapability && !hasPhotographyCapability) {
      return orders.filter(o => o.bookingType === 'AODAI_RENTAL');
    }
    if (hasPhotographyCapability && !hasAodaiCapability) {
      return orders.filter(o => o.bookingType === 'PHOTOGRAPHY');
    }
    return orders;
  }, [orders, hasAodaiCapability, hasPhotographyCapability]);

  const tabs = React.useMemo(() => [
    { label: 'Tất cả', count: roleFilteredOrders.length },
    { label: 'Chờ xử lý', count: roleFilteredOrders.filter(o => getOrderGroup(o.status) === 'Chờ xử lý').length },
    { label: 'Đang thực hiện', count: roleFilteredOrders.filter(o => getOrderGroup(o.status) === 'Đang thực hiện').length },
    { label: 'Hoàn thành', count: roleFilteredOrders.filter(o => getOrderGroup(o.status) === 'Hoàn thành').length },
    { label: 'Đã hủy', count: roleFilteredOrders.filter(o => getOrderGroup(o.status) === 'Đã hủy').length },
    { label: 'Yêu cầu đổi lịch', count: roleFilteredOrders.filter(o => o.items?.some((item: any) => item?.rescheduleRequest?.status === 'PENDING')).length },
  ], [roleFilteredOrders]);

  const filteredOrders = roleFilteredOrders.filter((order) => {
    let matchesStatus = false;
    if (orderTab === 'Tất cả') {
      matchesStatus = true;
    } else if (orderTab === 'Yêu cầu đổi lịch') {
      matchesStatus = Boolean(order.items?.some((item: any) => item?.rescheduleRequest?.status === 'PENDING'));
    } else {
      matchesStatus = getOrderGroup(order.status) === orderTab;
    }
    const matchesType = (!hasAodaiCapability || !hasPhotographyCapability) ? true : (bookingTypeFilter === 'Tất cả' || order.bookingType === bookingTypeFilter);
    return matchesStatus && matchesType;
  });

  const rentalOperationItems = React.useMemo(() => orders.flatMap((order) =>
    (order.items || [])
      .filter((item: any) => item?.rentalFulfillment && item.rentalFulfillment.status !== 'COMPLETED' && item.rentalFulfillment.status !== 'CANCELLED')
      .map((item: any) => ({ order, item })),
  ), [orders]);

  const monthlyRevenue = React.useMemo(() => {
    const now = new Date();
    return orders
      .filter(o => {
        let d: Date | null = o.rawOrderDate ? new Date(o.rawOrderDate) : null;
        if (!d || isNaN(d.getTime())) {
          const parts = (o.orderDate || '').split(' ');
          const datePart = parts[parts.length - 1];
          if (datePart && datePart.includes('/')) {
            const [day, month, year] = datePart.split('/').map(Number);
            if (day && month && year) {
              d = new Date(year, month - 1, day);
            }
          }
        }
        const isCompleted = o.rawStatus === 'COMPLETED' || o.status === 'HOÀN THÀNH';
        return isCompleted && d && !isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
  }, [orders]);

  const renderInventoryView = () => <InventoryPanel {...{ inventorySummary, invSummaryPage, invSearch, setInvSearch, invStatusFilter, setInvStatusFilter, invConditionFilter, setInvConditionFilter, invSortBy, setInvSortBy, isLoadingInventory, variantBusy, setVariantEditRow, setVariantEditQty, handleRemoveVariant, setInvSummaryPage, inventoryItems, setEditInvItem, setEditInvStatus, setEditInvCondition, setEditInvNotes, setIsEditInventoryOpen, handleDeleteInventoryItem, invTotal, invLimit, invPage, setInvPage }} />;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-light-bg)' }}>
      {/* SIDEBAR */}
      <ProviderSidebar {...{ setCurrentView, currentView, hasAodaiCapability, setCollectionTab, collectionTab, hasPhotographyCapability, navigate, handleLogoutClick }} />

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflowY: 'auto', backgroundColor: 'var(--color-light-bg)' }}>
        {/* TOP BAR */}
        <ProviderHeader {...{ notiRef, setIsNotiOpen, isNotiOpen, fetchNotifications, providerUnreadCount, handleNotiMarkAllAsRead, loadingNoti, notifications, getNotiTypeStyle, handleNotiMarkAsRead, getNotiTimeAgo, setCurrentView, provider }} />

        {/* CONTENT SWITCH PANEL */}
        {(currentView === 'overview' || currentView === 'analytics') && (
          <main style={{ flex: 1, padding: '32px' }}>
            <ProviderOverviewPanel
              provider={provider}
              orders={orders}
              loadingOrders={loadingOrders}
              analyticsData={analyticsData}
              notifications={notifications}
              chartTimeRange={chartTimeRange}
              onPeriodChange={handlePeriodChange}
              onNavigate={setCurrentView}
            />
          </main>
        )}

        {currentView === 'notifications' && (
          <main style={{ flex: 1, padding: '24px 32px' }}>
            <NotificationsPage hideBreadcrumb variant="provider" />
          </main>
        )}

        {currentView === 'orders' && (
          <OrdersPanel {...{ toast, tabs, setOrderTab, orderTab, hasAodaiCapability, hasPhotographyCapability, orders, setBookingTypeFilter, bookingTypeFilter, monthlyRevenue, loadingOrders, filteredOrders, setSelectedBookingId, setIsDetailModalOpen, setActionMenuId, actionMenuId, resolveRescheduleRequest, changeOrderStatus, setReportingOrder, setSelectedItemId, setIncidentDesc, setIncidentPhotos, setIncidentAmount, setIncidentActionType, activePage, setActivePage }} />
        )}

        {currentView === 'rental-operations' && (
          <RentalOperationsPanel {...{ fetchOrders, loadingOrders, rentalOperationItems, setSelectedBookingId, setIsDetailModalOpen, orders, toast }} />
        )}
        {currentView === 'collections' && (
          <CollectionsPanel {...{ collectionTab, openAddModal, setCollectionTab, prodSearch, setProdSearch, setProdPage, prodSizeFilter, setProdSizeFilter, prodColorFilter, setProdColorFilter, prodSortBy, setProdSortBy, loadingProducts, products, openEditModal, handleDuplicateProduct, handleDeleteProduct, prodTotal, prodLimit, prodPage, renderInventoryView, categories, fetchProducts, inventorySummary, toast }} />
        )}

        {currentView === 'profile' && (
          <ServiceProfilePanel {...{ profileHasUnsavedChanges, isLoadingProvider, handleUpdateProfile, profileSection, setProfileSection, businessName, setBusinessName, phone, setPhone, city, setCity, baseLatitude, baseLongitude, addressLine, setAddressLine, setBaseLatitude, setBaseLongitude, hasPhotographyCapability, serviceRadiusKm, setServiceRadiusKm, hasAodaiCapability, useBusinessAddressForPickup, setUseBusinessAddressForPickup, pickupLatitude, pickupLongitude, pickupAddressLine, setPickupAddressLine, setPickupLatitude, setPickupLongitude, setCancellationRefundRules, cancellationRefundRules, cancellationAdditionalNotes, setCancellationAdditionalNotes, cancellationPolicySummary, isSavingProfile }} />
        )}

        {hasPhotographyCapability && currentView === 'photography-packages' && (
          <PhotographyPackageManager enabled={hasPhotographyCapability} />
        )}

        {hasPhotographyCapability && currentView === 'portfolio' && (
          <PortfolioPanel {...{ setIsPortfolioFormOpen, isLoadingProvider, portfolioItems, hoveredItemId, setHoveredItemId, setPreviewPortfolioItem, setPreviewImageIndex, setEditingPortfolioItem, handleDeletePortfolioItem }} />
        )}

        {currentView === 'calendar' && (
          <CalendarPanel {...{
            isLoadingProvider, editingScheduleDay, hasAodaiCapability, hasPhotographyCapability,
            setScheduleCapability, scheduleCapability, setSelectedScheduleDays, selectedScheduleDays,
            toggleScheduleDay, setWorkingHourRanges, workingHourRanges, updateWorkingHourRange,
            setEditingScheduleDay, handleSaveRecurringSchedules, blockedDate, setBlockedDate,
            handleBlockDate, schedules, handleEditRecurringSchedule, handleUnblockDate,
            activeSubNavTab, setActiveSubNavTab, calendarMonth, setCalendarMonth,
            selectedDate, setSelectedDate, blockType, setBlockType, blockSlotStart,
            setBlockSlotStart, blockSlotEnd, setBlockSlotEnd, blockReason, setBlockReason,
            listTab, setListTab, orders,
          }} />
        )}

        {currentView === 'vouchers' && (
          <CombosPanel {...{
            isLoadingProvider, hasAodaiCapability, openCampaignModal, activeCampaign,
            handleDeactivateCampaign, submittingCampaign, handleAddVoucher,
            handleCreateOrUpdateVoucher, handleEditVoucher, clearVoucherForm,
            vCode, setVCode, vName, setVName, vDesc, setVDesc, vType, setVType, vValue, setVValue,
            vMaxDiscount, setVMaxDiscount, vMinOrder, setVMinOrder, vUsageLimit, setVUsageLimit,
            vStartDate, setVStartDate, vEndDate, setVEndDate, editingVoucherId, setEditingVoucherId,
            isVoucherModalOpen, setIsVoucherModalOpen, vouchers, handleDeleteVoucher,
            hasPhotographyCapability, handleCreateOrUpdateCombo, editingComboId, cName, setCName,
            cDesc, setCDesc, cProductId, myProductsList, setIsAoDaiModalOpen, cPackageId,
            photoPackages, setIsPackageModalOpen, cDiscount, setCDiscount, cPrice, setCPrice,
            cValidFrom, setCValidFrom, cValidTo, setCValidTo, cMaxUsage, setCMaxUsage,
            cShootPeopleCount, setCShootPeopleCount, inventorySummary, cAoDaiQuantity,
            setCAoDaiQuantity, clearComboForm, isAoDaiModalOpen, aoDaiSearch, setAoDaiSearch,
            setCProductId, isPackageModalOpen, packageSearch, setPackageSearch, setCPackageId,
            combos, handleEditCombo, handleDeleteCombo
          }} />
        )}

        {currentView === 'reviews' && (
          <ReviewsPanel {...{ isLoadingProvider, reviewsData, handleReportReview, setReplyingReviewId, setReplyText }} />
        )}

        {currentView === 'trust' && (
          <TrustPanel {...{ isLoadingProvider, searchCustId, setSearchCustId, handleSearchTrustScore, trustScoreResult, bookingsState, setRatingBooking }} />
        )}

        {currentView === 'payouts' && (
          <PayoutsPanel {...{ isLoadingProvider, payouts, setSelectedBookingId, setIsDetailModalOpen }} />
        )}

        {/* ==================== ROLE MANAGEMENT VIEW ==================== */}
        {currentView === 'role-management' && (
          <RolesPanel {...{ isLoadingProvider, hasAodaiCapability, hasPhotographyCapability, navigate }} />
        )}
      </div>

      {/* -------------------- MODAL: CAMPAIGN MANAGEMENT -------------------- */}
      <CampaignModal {...{ isCampaignModalOpen, setIsCampaignModalOpen, handleCreateCampaign, activeCampaign, handleDeactivateCampaign, campaignOccasion, setCampaignOccasion, campaignPercent, setCampaignPercent, campaignStart, setCampaignStart, campaignEnd, setCampaignEnd, submittingCampaign }} />

      {/* -------------------- MODALS: CREATE & EDIT PRODUCT -------------------- */}
      <ProductWizardModal {...{ isModalOpen, handleWizardCancel, editingProduct, wizardStep, setWizardStep, prodName, setProdName, prodCategoryId, setProdCategoryId, categories, prodStatus, setProdStatus, prodBasePrice, setProdBasePrice, prodDepositAmount, setProdDepositAmount, prodDescription, setProdDescription, handleImageChange, uploadingImages, prodImages, removeImage, handleVideoChange, uploadingVideos, prodVideos, removeVideo, setAddInvProductId, setIsAddInventoryOpen, editInvSummary, prodSizes, setProdSizes, prodColors, setProdColors, prodMaterials, setProdMaterials, variantBusy, setVariantEditRow, setVariantEditQty, handleRemoveVariant, variants, setVariants, updateVariantRow, removeVariantRow, addVariantRow, colorsNeedingImages, prodColorImages, uploadingColor, handleColorImageChange, removeColorImage, createdDraftId, setActiveTagCodes, handleWizardFinish, handleWizardBack, handleWizardNext, savingDraft, activeTagCodes }} />
      {/* Review reply modal popup */}
      {replyingReviewId && (
        <ReviewReplyModal {...{ handleReplyReview, setReplyingReviewId, replyText, setReplyText }} />
      )}

      {/* Report incident modal popup */}
      {reportingOrder && <IncidentReportModal {...{ reportingOrder, handleSendIncidentReport, setReportingOrder, selectedItemId, setSelectedItemId, incidentActionType, setIncidentActionType, incidentDesc, setIncidentDesc, handleIncidentPhotoUpload, incidentPhotos, setIncidentPhotos, incidentAmount, setIncidentAmount }} />}

      {/* Rate customer modal popup */}
      {ratingBooking && (
        <CustomerRatingModal {...{ handleRateCustomer, setRatingBooking, setCRating, cRating, cComment, setCComment }} />
      )}

      <PortfolioItemFormModal
        isOpen={isPortfolioFormOpen}
        isSaving={isPortfolioSaving}
        onClose={() => {
          setIsPortfolioFormOpen(false);
          setEditingPortfolioItem(null);
        }}
        onSubmit={handlePortfolioFormSubmit}
        initialValues={editingPortfolioItem ? { title: editingPortfolioItem.title, description: editingPortfolioItem.description || undefined, images: editingPortfolioItem.images } : null}
      />

      {previewPortfolioItem && (
        <PortfolioPreviewModal {...{ setPreviewPortfolioItem, previewPortfolioItem, setPreviewImageIndex, previewImageIndex }} />
      )}

      {/* Booking Details Modal */}
      <BookingDetailModal
        bookingId={selectedBookingId}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onCustomerClick={viewCustomerTrust}
        viewerRole="provider"
        onBookingChanged={fetchOrders}
      />

      {/* Modal Nhập Kho Áo Dài */}
      {isAddInventoryOpen && (
        <AddInventoryModal {...{ handleCreateInventoryItem, setIsAddInventoryOpen, addInvProductId, setAddInvProductId, editingProduct, myProductsList, addInvSize, setAddInvSize, addInvColor, setAddInvColor, addInvMaterial, setAddInvMaterial, addInvQuantity, setAddInvQuantity, addInvCondition, setAddInvCondition, addInvNotes, setAddInvNotes }} />
      )}

      {/* Modal Cập Nhật Trạng Thái & Chất Lượng */}
      {isEditInventoryOpen && editInvItem && (
        <EditInventoryModal {...{ handleUpdateInventoryItem, editInvItem, setIsEditInventoryOpen, editInvStatus, setEditInvStatus, editInvCondition, setEditInvCondition, editInvNotes, setEditInvNotes }} />
      )}

      {/* MODAL: SỬA SỐ LƯỢNG CỦA CẢ MỘT BIẾN THỂ */}
      {variantEditRow && (
        <VariantQuantityModal {...{ handleAdjustVariantQuantity, variantEditRow, variantEditQty, setVariantEditQty, setVariantEditRow, variantBusy }} />
      )}
    </div>
  );
};

export default ProviderDashboard;
