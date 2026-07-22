import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  FileUp,
  Loader2,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { providerVerificationService } from '../../features/provider-verifications/services/providerVerificationService';
import { API_BASE_URL } from '../../config/env';
import { tokenStorage } from '../../services/tokenStorage';
import { httpClient } from '../../services/httpClient';
import type {
  AodaiInfo,
  PhotographyInfo,
  ProviderBusinessProfile,
  ProviderCapability,
  ProviderDocumentType,
  ProviderVerificationDocumentSummary,
  ProviderVerificationDetail,
} from '../../features/provider-verifications/types';
import './BecomeProviderPage.css';

const capabilityOptions: Array<{
  value: ProviderCapability;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'AODAI_RENTAL',
    label: 'Cho thuê áo dài',
    description: 'Quản lý cửa hàng, chính sách thuê, đặt cọc và điểm nhận trả.',
    icon: <Scissors size={20} />,
  },
  {
    value: 'PHOTOGRAPHY',
    label: 'Nhiếp ảnh',
    description: 'Đăng ký studio, khu vực làm việc, phong cách và portfolio.',
    icon: <Camera size={20} />,
  },
];

const documentLabels: Record<ProviderDocumentType, string> = {
  IDENTITY_CARD_FRONT: 'CCCD mặt trước',
  IDENTITY_CARD_BACK: 'CCCD mặt sau',
  PASSPORT: 'Hộ chiếu',
  BUSINESS_LICENSE: 'Giấy phép kinh doanh',
  TAX_REGISTRATION: 'Đăng ký thuế',
  SHOP_PHOTO_PROOF: 'Ảnh chứng minh cửa hàng',
  STUDIO_PORTFOLIO_PROOF: 'Portfolio studio',
  PROFESSIONAL_CERTIFICATE: 'Chứng chỉ chuyên môn',
};

// const ocrDocumentTypes: ProviderDocumentType[] = [
//   'IDENTITY_CARD_FRONT',
//   'IDENTITY_CARD_BACK',
//   'BUSINESS_LICENSE',
//   'TAX_REGISTRATION',
//   'PROFESSIONAL_CERTIFICATE',
// ];

const steps = ['Loại dịch vụ', 'Hồ sơ', 'Đồng ý', 'Tài liệu', 'Gửi duyệt'];

const emptyBusinessProfile: ProviderBusinessProfile = {
  businessName: '',
  ownerName: '',
  phone: '',
  email: '',
  address: '',
  province: '',
  description: '',
};

const emptyAodaiInfo: AodaiInfo = {
  shopName: '',
  rentalPolicy: '',
  depositPolicy: '',
  pickupAddress: '',
  sizeSupport: '',
};

const emptyPhotographyInfo: PhotographyInfo = {
  studioName: '',
  workingArea: '',
  photographyStyles: [],
  portfolioUrls: [],
};

function normalizeVerificationDetail(
  detail: ProviderVerificationDetail,
): ProviderVerificationDetail {
  return {
    ...detail,
    status: detail.status ?? 'DRAFT',
    requestedCapabilities: Array.isArray(detail.requestedCapabilities)
      ? detail.requestedCapabilities
      : [],
    businessProfile: detail.businessProfile ?? {},
    aodaiInfo: detail.aodaiInfo ?? {},
    photographyInfo: {
      ...(detail.photographyInfo ?? {}),
      photographyStyles: Array.isArray(detail.photographyInfo?.photographyStyles)
        ? detail.photographyInfo.photographyStyles
        : [],
      portfolioUrls: Array.isArray(detail.photographyInfo?.portfolioUrls)
        ? detail.photographyInfo.portfolioUrls
        : [],
    },
    consent: {
      accepted: Boolean(detail.consent?.accepted),
      version: detail.consent?.version ?? null,
      acceptedAt: detail.consent?.acceptedAt ?? null,
    },
    requiredDocuments: Array.isArray(detail.requiredDocuments)
      ? detail.requiredDocuments
      : [],
    missingDocuments: Array.isArray(detail.missingDocuments)
      ? detail.missingDocuments
      : [],
    documents: Array.isArray(detail.documents) ? detail.documents : [],
    ocrWarnings: Array.isArray(detail.ocrWarnings) ? detail.ocrWarnings : [],
  };
}

function optimisticDocumentUpload(
  detail: ProviderVerificationDetail,
  documentType: ProviderDocumentType,
  uploaded: {
    versionNo: number;
    uploadStatus: string;
    ocrStatus: string;
  },
  file: File,
): ProviderVerificationDetail {
  const nextDocument = {
    documentType,
    required: true,
    currentVersion: uploaded.versionNo,
    current: {
      versionNo: uploaded.versionNo,
      isCurrent: true,
      uploadStatus: uploaded.uploadStatus as 'UPLOADED',
      originalFileName: file.name,
      mimeType: file.type,
      size: file.size,
      ocrStatus: uploaded.ocrStatus as 'NOT_STARTED',
      ocrConfidence: null,
      extractedFields: {},
      mismatchFlags: [],
      uploadedAt: new Date().toISOString(),
      processedAt: null,
    },
  };

  const documents = detail.documents.some(
    (document) => document.documentType === documentType,
  )
    ? detail.documents.map((document) =>
        document.documentType === documentType
          ? { ...document, ...nextDocument, required: document.required }
          : document,
      )
    : [...detail.documents, nextDocument];

  return {
    ...detail,
    documents,
    missingDocuments: detail.missingDocuments.filter(
      (missing) => missing !== documentType,
    ),
  };
}

function formatDate(dateStr?: string | Date | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// function translateMismatchFlag(flag: string) {
//   const translations: Record<string, string> = {
//     NAME_MISMATCH: 'Họ tên không trùng khớp với hồ sơ đăng ký',
//     ID_MISMATCH: 'Số định danh không trùng khớp với thông tin đã nhập',
//     DOB_MISMATCH: 'Ngày sinh không trùng khớp với thông tin định danh',
//     EXPIRY_MISMATCH: 'Tài liệu đã hết hạn sử dụng',
//     LOW_CONFIDENCE: 'Độ chính xác hình ảnh thấp, vui lòng cung cấp ảnh rõ nét hơn',
//     DOCUMENT_EXPIRED: 'Giấy tờ đã hết hạn hiệu lực',
//     FACE_MISMATCH: 'Khuôn mặt trích xuất không khớp',
//   };
//   return translations[flag] ?? flag;
// }

export const BecomeProviderPage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedCapabilities, setSelectedCapabilities] = useState<
    ProviderCapability[]
  >(['AODAI_RENTAL']);
  const [verification, setVerification] =
    useState<ProviderVerificationDetail | null>(null);
  const [businessProfile, setBusinessProfile] =
    useState<ProviderBusinessProfile>(emptyBusinessProfile);
  const [aodaiInfo, setAodaiInfo] = useState<AodaiInfo>(emptyAodaiInfo);
  const [photographyInfo, setPhotographyInfo] =
    useState<PhotographyInfo>(emptyPhotographyInfo);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Dashboard toggle state
  const [showStatusDashboard, setShowStatusDashboard] = useState(true);

  // Address selectors states
  const [provinces, setProvinces] = useState<Array<{ code: number; name: string }>>([]);
  const [districts, setDistricts] = useState<Array<{ code: number; name: string }>>([]);
  const [wards, setWards] = useState<Array<{ code: number; name: string }>>([]);
  const [isApiSupported, setIsApiSupported] = useState(false);
  const [isAddressEditing, setIsAddressEditing] = useState(false);

  const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | null>(null);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<number | null>(null);
  const [selectedWardCode, setSelectedWardCode] = useState<number | null>(null);
  const [streetAddress, setStreetAddress] = useState('');

  // Ao Dai pickup address selectors states
  const [pickupDistricts, setPickupDistricts] = useState<Array<{ code: number; name: string }>>([]);
  const [pickupWards, setPickupWards] = useState<Array<{ code: number; name: string }>>([]);
  const [isPickupAddressEditing, setIsPickupAddressEditing] = useState(false);

  const [selectedPickupProvinceCode, setSelectedPickupProvinceCode] = useState<number | null>(null);
  const [selectedPickupDistrictCode, setSelectedPickupDistrictCode] = useState<number | null>(null);
  const [selectedPickupWardCode, setSelectedPickupWardCode] = useState<number | null>(null);
  const [pickupStreetAddress, setPickupStreetAddress] = useState('');
  const [useBusinessAddressForPickup, setUseBusinessAddressForPickup] = useState(true);

  const verificationId = verification?.verificationId;
  const isEditable =
    !verification || ['DRAFT', 'NEEDS_CHANGES'].includes(verification.status);
  const requestedCapabilities =
    verification?.requestedCapabilities?.length
      ? verification.requestedCapabilities
      : selectedCapabilities;
  const requiresAodai = requestedCapabilities.includes('AODAI_RENTAL');
  const requiresPhotography = requestedCapabilities.includes('PHOTOGRAPHY');

  const hasUploadedDocuments = useMemo(() => {
    if (!verification) return false;
    return verification.documents.some(
      (doc) => doc.current && doc.current.uploadStatus === 'UPLOADED',
    );
  }, [verification]);

  useEffect(() => {
    void loadCurrentVerification();
  }, []);

  // Fetch provinces when editing Step 1
  useEffect(() => {
    if (activeStep === 1) {
      void fetchProvinces();
    }
  }, [activeStep]);

  // Sync address changes for business profile
  useEffect(() => {
    if (!isApiSupported || !isAddressEditing) return;
    const provName = provinces.find((p) => p.code === selectedProvinceCode)?.name || '';
    const distName = districts.find((d) => d.code === selectedDistrictCode)?.name || '';
    const wardName = wards.find((w) => w.code === selectedWardCode)?.name || '';

    const parts = [streetAddress.trim(), wardName, distName, provName].filter(Boolean);
    if (parts.length > 0) {
      setBusinessProfile((prev) => ({
        ...prev,
        province: provName || prev.province,
        address: parts.join(', '),
      }));
    }
  }, [streetAddress, selectedProvinceCode, selectedDistrictCode, selectedWardCode, isAddressEditing, provinces, districts, wards]);

  // Sync address changes for Ao Dai pickup address
  useEffect(() => {
    if (useBusinessAddressForPickup) {
      setAodaiInfo((prev) => ({
        ...prev,
        pickupAddress: businessProfile.address,
      }));
      return;
    }

    if (!isApiSupported || !isPickupAddressEditing) return;
    const provName = provinces.find((p) => p.code === selectedPickupProvinceCode)?.name || '';
    const distName = pickupDistricts.find((d) => d.code === selectedPickupDistrictCode)?.name || '';
    const wardName = pickupWards.find((w) => w.code === selectedPickupWardCode)?.name || '';

    const parts = [pickupStreetAddress.trim(), wardName, distName, provName].filter(Boolean);
    if (parts.length > 0) {
      setAodaiInfo((prev) => ({
        ...prev,
        pickupAddress: parts.join(', '),
      }));
    }
  }, [pickupStreetAddress, selectedPickupProvinceCode, selectedPickupDistrictCode, selectedPickupWardCode, useBusinessAddressForPickup, businessProfile.address, isPickupAddressEditing, provinces, pickupDistricts, pickupWards]);

  const fetchProvinces = async () => {
    try {
      const res = await fetch('https://provinces.open-api.vn/api/p/');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProvinces(data);
      setIsApiSupported(true);
    } catch {
      setIsApiSupported(false);
    }
  };

  const handleProvinceChange = async (code: number) => {
    setSelectedProvinceCode(code);
    setSelectedDistrictCode(null);
    setSelectedWardCode(null);
    setDistricts([]);
    setWards([]);
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/p/${code}?depth=2`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDistricts(data.districts || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDistrictChange = async (code: number) => {
    setSelectedDistrictCode(code);
    setSelectedWardCode(null);
    setWards([]);
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/d/${code}?depth=2`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWards(data.wards || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePickupProvinceChange = async (code: number) => {
    setSelectedPickupProvinceCode(code);
    setSelectedPickupDistrictCode(null);
    setSelectedPickupWardCode(null);
    setPickupDistricts([]);
    setPickupWards([]);
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/p/${code}?depth=2`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPickupDistricts(data.districts || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePickupDistrictChange = async (code: number) => {
    setSelectedPickupDistrictCode(code);
    setSelectedPickupWardCode(null);
    setPickupWards([]);
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/d/${code}?depth=2`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPickupWards(data.wards || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadCurrentVerification = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const current = await providerVerificationService.getCurrent();
      
      let existingProvider: any = null;
      if (user?.roles?.includes('PROVIDER')) {
        try {
          existingProvider = await httpClient.get('/providers/me');
        } catch (e) {
          console.warn('Failed to load existing provider profile', e);
        }
      }

      const upgradeCap = new URLSearchParams(window.location.search).get('upgrade') as ProviderCapability;

      if (current) {
        const normalized = normalizeVerificationDetail(current);
        
        if (existingProvider) {
          if (!normalized.businessProfile?.businessName) {
            normalized.businessProfile.businessName = existingProvider.businessName || '';
          }
          if (!normalized.businessProfile?.ownerName) {
            normalized.businessProfile.ownerName = user?.fullName || existingProvider.ownerName || '';
          }
          if (!normalized.businessProfile?.phone) {
            normalized.businessProfile.phone = existingProvider.contact?.phone || user?.phone || '';
          }
          if (!normalized.businessProfile?.email) {
            normalized.businessProfile.email = existingProvider.contact?.email || user?.email || '';
          }
          if (!normalized.businessProfile?.address) {
            normalized.businessProfile.address = existingProvider.address?.addressLine || '';
          }
          if (!normalized.businessProfile?.province) {
            normalized.businessProfile.province = existingProvider.address?.city || '';
          }
          
          if (existingProvider.capabilities?.includes('PHOTOGRAPHY') || normalized.requestedCapabilities.includes('PHOTOGRAPHY')) {
            if (!normalized.photographyInfo?.studioName) {
              normalized.photographyInfo.studioName = existingProvider.businessName || normalized.businessProfile?.businessName || '';
            }
            if (!normalized.photographyInfo?.workingArea) {
              normalized.photographyInfo.workingArea = existingProvider.address?.addressLine || normalized.businessProfile?.address || '';
            }
          }
          
          if (existingProvider.capabilities?.includes('AODAI_RENTAL') || existingProvider.capabilities?.includes('RENTAL') || normalized.requestedCapabilities.includes('AODAI_RENTAL')) {
            if (!normalized.aodaiInfo?.shopName) {
              normalized.aodaiInfo.shopName = existingProvider.businessName || normalized.businessProfile?.businessName || '';
            }
            if (!normalized.aodaiInfo?.pickupAddress) {
              normalized.aodaiInfo.pickupAddress = existingProvider.address?.addressLine || normalized.businessProfile?.address || '';
            }
            if (!normalized.aodaiInfo?.rentalPolicy) {
              normalized.aodaiInfo.rentalPolicy = existingProvider.policies?.rentalPolicy || '';
            }
          }
        }

        hydrateFromVerification(normalized);
        setVerification(normalized);

        setActiveStep(stepFromVerification(normalized));
        setShowStatusDashboard(normalized.status !== 'DRAFT');
        
        if (normalized.businessProfile?.address) {
          setIsAddressEditing(false);
        } else {
          setIsAddressEditing(true);
        }
        if (normalized.aodaiInfo?.pickupAddress) {
          setIsPickupAddressEditing(false);
        } else {
          setIsPickupAddressEditing(true);
        }
      } else if (user) {
        const latest = await providerVerificationService.getLatest();

        if (latest && !upgradeCap) {
          const normalized = normalizeVerificationDetail(latest);
          hydrateFromVerification(normalized);
          setVerification(normalized);
          setActiveStep(4);
          setShowStatusDashboard(true);
          setIsAddressEditing(!normalized.businessProfile?.address);
          setIsPickupAddressEditing(!normalized.aodaiInfo?.pickupAddress);
          if (normalized.status === 'APPROVED') {
            await refreshProfile();
          }
          return;
        }

        if (upgradeCap && ['AODAI_RENTAL', 'PHOTOGRAPHY'].includes(upgradeCap)) {
          setSelectedCapabilities([upgradeCap]);
        }
        
        const initialBusinessProfile = {
          ...emptyBusinessProfile,
          ownerName: user.fullName,
          email: user.email,
          phone: user.phone ?? '',
        };

        const initialAodaiInfo = { ...emptyAodaiInfo };
        const initialPhotographyInfo = { ...emptyPhotographyInfo };

        if (existingProvider) {
          initialBusinessProfile.businessName = existingProvider.businessName || '';
          initialBusinessProfile.phone = existingProvider.contact?.phone || initialBusinessProfile.phone;
          initialBusinessProfile.email = existingProvider.contact?.email || initialBusinessProfile.email;
          initialBusinessProfile.address = existingProvider.address?.addressLine || '';
          initialBusinessProfile.province = existingProvider.address?.city || '';
          
          if (existingProvider.capabilities?.includes('PHOTOGRAPHY')) {
            initialPhotographyInfo.studioName = existingProvider.businessName || '';
            initialPhotographyInfo.workingArea = existingProvider.address?.addressLine || '';
          }
          
          if (existingProvider.capabilities?.includes('AODAI_RENTAL') || existingProvider.capabilities?.includes('RENTAL')) {
            initialAodaiInfo.shopName = existingProvider.businessName || '';
            initialAodaiInfo.pickupAddress = existingProvider.address?.addressLine || '';
            initialAodaiInfo.rentalPolicy = existingProvider.policies?.rentalPolicy || '';
          }
        }

        setBusinessProfile(initialBusinessProfile);
        setAodaiInfo(initialAodaiInfo);
        setPhotographyInfo(initialPhotographyInfo);
        
        setShowStatusDashboard(false);
        setIsAddressEditing(!initialBusinessProfile.address);
        setIsPickupAddressEditing(!initialAodaiInfo.pickupAddress);
      }
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const hydrateFromVerification = (detail: ProviderVerificationDetail) => {
    setSelectedCapabilities(detail.requestedCapabilities);
    setBusinessProfile({ ...emptyBusinessProfile, ...detail.businessProfile });
    setAodaiInfo({ ...emptyAodaiInfo, ...detail.aodaiInfo });
    setPhotographyInfo({ ...emptyPhotographyInfo, ...detail.photographyInfo });
    setConsentAccepted(detail.consent.accepted);

    // Smart Address Check
    if (detail.aodaiInfo?.pickupAddress && detail.businessProfile?.address) {
      const isSame = detail.aodaiInfo.pickupAddress === detail.businessProfile.address;
      setUseBusinessAddressForPickup(isSame);
      setIsPickupAddressEditing(!isSame);
    } else {
      setUseBusinessAddressForPickup(true);
      setIsPickupAddressEditing(false);
    }
  };

  const refreshVerification = async (id = verificationId) => {
    if (!id) return;
    const detail = await providerVerificationService.getById(id);
    const normalized = normalizeVerificationDetail(detail);
    hydrateFromVerification(normalized);
    setVerification(normalized);
    if (normalized.status === 'APPROVED') {
      await refreshProfile();
    }
  };

  useEffect(() => {
    const isOcrPending = verification?.documents.some((document) => {
      const executionStatus = document.current?.ocr?.executionStatus;
      return ['NOT_STARTED', 'PROCESSING', 'TIMEOUT'].includes(executionStatus ?? '');
    });
    if (!isOcrPending || !verificationId) return;

    const intervalId = window.setInterval(() => {
      void refreshVerification(verificationId);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [verification, verificationId]);

  useEffect(() => {
    if (!verificationId || !['SUBMITTED', 'UNDER_REVIEW'].includes(verification?.status ?? '')) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshVerification(verificationId).catch((err) => setError(messageFromError(err)));
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [verification?.status, verificationId]);
  const stepFromVerification = (detail: ProviderVerificationDetail) => {
    if (!['DRAFT', 'NEEDS_CHANGES'].includes(detail.status)) return 4;
    if (detail.requestedCapabilities.length === 0) return 0;
    if (!isProfileComplete(detail)) return 1;
    if (!detail.consent.accepted) return 2;
    if (detail.documents.length === 0 || detail.missingDocuments.length > 0) return 3;
    return 4;
  };

  const maxReachedStep = useMemo(() => {
    if (!verification) return 0;
    return stepFromVerification(verification);
  }, [verification]);

  const toggleCapability = (capability: ProviderCapability) => {
    setSelectedCapabilities((current) => {
      if (current.includes(capability)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== capability);
      }
      return [...current, capability];
    });
  };

  const startVerification = async () => {
    setActionLoading('create');
    setError(null);
    setSuccess(null);
    try {
      if (verificationId) {
        const capabilitiesChanged = JSON.stringify([...verification.requestedCapabilities].sort()) !== JSON.stringify([...selectedCapabilities].sort());
        const detail = (capabilitiesChanged && !hasUploadedDocuments)
          ? await providerVerificationService.update(verificationId, {
              requestedCapabilities: selectedCapabilities,
            })
          : verification;
        const normalized = normalizeVerificationDetail(detail);
        hydrateFromVerification(normalized);
        setVerification(normalized);
        setActiveStep(1);
        setSuccess('Thông tin dịch vụ đăng ký đã được lưu.');
        return;
      }

      const created = await providerVerificationService.create(
        selectedCapabilities,
      );
      const detail = await providerVerificationService.getById(
        created.verificationId,
      );
      const normalized = normalizeVerificationDetail(detail);
      hydrateFromVerification(normalized);
      setVerification(normalized);
      setActiveStep(1);
      setSuccess('Hồ sơ đăng ký Provider đã được khởi tạo.');
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const validateProfile = (
    currentAodai: AodaiInfo,
    currentPhotography: PhotographyInfo,
  ) => {
    const errors: Record<string, string> = {};
    
    if (!businessProfile.businessName?.trim()) errors.businessName = 'Tên thương hiệu không được để trống';
    if (!businessProfile.ownerName?.trim()) errors.ownerName = 'Tên chủ hồ sơ không được để trống';
    
    if (!businessProfile.phone?.trim()) {
      errors.phone = 'Số điện thoại không được để trống';
    } else if (!/^[0-9+\s-]{9,15}$/.test(businessProfile.phone)) {
      errors.phone = 'Số điện thoại không hợp lệ (9 - 15 số)';
    }

    if (!businessProfile.email?.trim()) {
      errors.email = 'Email không được để trống';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessProfile.email)) {
      errors.email = 'Email không đúng định dạng';
    }
    
    if (!businessProfile.address?.trim()) errors.address = 'Địa chỉ không được để trống';
    if (!businessProfile.province?.trim()) errors.province = 'Tỉnh/Thành phố không được để trống';
    if (isApiSupported && isAddressEditing) {
      if (!selectedProvinceCode) errors.province = 'Vui lòng chọn Tỉnh/Thành phố';
      if (!selectedDistrictCode) errors.district = 'Vui lòng chọn Quận/Huyện';
      if (!selectedWardCode) errors.ward = 'Vui lòng chọn Phường/Xã';
      if (!streetAddress.trim()) errors.address = 'Vui lòng nhập số nhà, tên đường';
    }

    if (requiresAodai) {
      if (!currentAodai.pickupAddress?.trim()) errors.pickupAddress = 'Địa chỉ nhận trả không được để trống';
      if (!currentAodai.rentalPolicy?.trim()) errors.rentalPolicy = 'Chính sách thuê không được để trống';
      if (!currentAodai.depositPolicy?.trim()) errors.depositPolicy = 'Chính sách đặt cọc không được để trống';
      if (!currentAodai.sizeSupport?.trim()) errors.sizeSupport = 'Thông tin size không được để trống';
      if (isApiSupported && !useBusinessAddressForPickup && isPickupAddressEditing) {
        if (!selectedPickupProvinceCode) errors.pickupProvince = 'Vui lòng chọn Tỉnh/Thành phố nhận trả';
        if (!selectedPickupDistrictCode) errors.pickupDistrict = 'Vui lòng chọn Quận/Huyện nhận trả';
        if (!selectedPickupWardCode) errors.pickupWard = 'Vui lòng chọn Phường/Xã nhận trả';
        if (!pickupStreetAddress.trim()) errors.pickupAddress = 'Vui lòng nhập số nhà, tên đường nhận trả';
      }
    }

    if (requiresPhotography) {
      if (!currentPhotography.workingArea?.trim()) errors.workingArea = 'Khu vực làm việc không được để trống';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveProfile = async () => {
    if (!verificationId) return;

    // Đồng bộ shopName và studioName theo businessName
    const updatedAodaiInfo = { ...aodaiInfo, shopName: businessProfile.businessName };
    const updatedPhotographyInfo = { ...photographyInfo, studioName: businessProfile.businessName };

    if (!validateProfile(updatedAodaiInfo, updatedPhotographyInfo)) {
      setError('Vui lòng điền đầy đủ thông tin ở các trường bắt buộc.');
      return;
    }
    
    setActionLoading('profile');
    setError(null);
    setSuccess(null);
    try {
      const { _id: bpId, ...cleanBusinessProfile } = businessProfile as any;
      const { _id: adId, ...cleanAodaiInfo } = updatedAodaiInfo as any;
      const { _id: phId, ...cleanPhotographyInfo } = updatedPhotographyInfo as any;

      const detail = await providerVerificationService.update(verificationId, {
        businessProfile: cleanBusinessProfile,
        aodaiInfo: requiresAodai ? cleanAodaiInfo : undefined,
        photographyInfo: requiresPhotography ? cleanPhotographyInfo : undefined,
      });
      const normalized = normalizeVerificationDetail(detail);
      hydrateFromVerification(normalized);
      setVerification(normalized);
      setActiveStep(2);
      setSuccess('Thông tin hồ sơ kinh doanh đã được lưu.');
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const acceptConsent = async () => {
    if (!verificationId) return;
    setActionLoading('consent');
    setError(null);
    setSuccess(null);
    try {
      await providerVerificationService.acceptConsent(verificationId);
      await refreshVerification();
      setActiveStep(3);
      setSuccess('Bạn đã đồng ý xử lý thông tin cá nhân và tài liệu xác minh.');
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const uploadDocument = async (
    documentType: ProviderDocumentType,
    file: File | undefined,
  ) => {
    if (!verificationId || !file) return;
    setActionLoading(`upload-${documentType}`);
    setError(null);
    setSuccess(null);
    try {
      const uploaded = await providerVerificationService.uploadDocument(
        verificationId,
        documentType,
        file,
      );
      setVerification((current) =>
        current
          ? optimisticDocumentUpload(current, documentType, uploaded, file)
          : current,
      );
      await refreshVerification();
      setSuccess(`Tải lên tài liệu ${documentLabels[documentType]} thành công.`);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setActionLoading(null);
    }
  };

  // const runOcr = async (documentType: ProviderDocumentType) => {
  //   if (!verificationId) return;
  //   setActionLoading(`ocr-${documentType}`);
  //   setError(null);
  //   setSuccess(null);
  //   try {
  //     await providerVerificationService.runOcr(verificationId, documentType);
  //     await refreshVerification();
  //     setSuccess(`Đã chạy đối chiếu trích xuất thông tin OCR cho ${documentLabels[documentType]}.`);
  //   } catch (err) {
  //     setError(messageFromError(err));
  //   } finally {
  //     setActionLoading(null);
  //   }
  // };

  const viewDocument = async (documentType: ProviderDocumentType) => {
    if (!verificationId) return;
    setActionLoading(`view-${documentType}`);
    setError(null);
    try {
      const accessToken = tokenStorage.getAccessToken();
      const response = await fetch(
        `${API_BASE_URL}/provider-verifications/${verificationId}/documents/${documentType}/view`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error('Không thể tải tài liệu để hiển thị.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank');
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const submitVerification = async () => {
    if (!verificationId) return;
    setActionLoading('submit');
    setError(null);
    setSuccess(null);
    try {
      await providerVerificationService.submit(verificationId);
      await refreshVerification();
      setShowStatusDashboard(true);
      setActiveStep(4);
      setSuccess('Hồ sơ đăng ký của bạn đã được gửi cho Admin phê duyệt.');
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const resetForNewApplication = () => {
    setVerification(null);
    setConsentAccepted(false);
    setValidationErrors({});
    setError(null);
    setSuccess(null);
    setShowStatusDashboard(false);
    setActiveStep(0);
  };

  const canSubmit = useMemo(() => {
    if (!verification) return false;
    return (
      verification.consent.accepted &&
      verification.missingDocuments.length === 0 &&
      ['DRAFT', 'NEEDS_CHANGES'].includes(verification.status)
    );
  }, [verification]);

  if (isLoading) {
    return (
      <main className="vh-provider-shell">
        <div className="vh-provider-loading">
          <Loader2 className="animate-spin" size={32} />
          <span>Đang tải thông tin hồ sơ đối tác...</span>
        </div>
      </main>
    );
  }

  // Dashboard View
  if (showStatusDashboard && verification && verification.status !== 'DRAFT') {
    return (
      <main className="vh-provider-shell animate-fade-in">
        <StatusDashboard
          verification={verification}
          onEdit={() => {
            setShowStatusDashboard(false);
            if (verification.status === 'NEEDS_CHANGES') {
              setActiveStep(verification.missingDocuments.length > 0 ? 3 : 1);
            } else {
              setActiveStep(1);
            }
          }}
          onReset={resetForNewApplication}
          actionLoading={actionLoading}
          onViewDocument={viewDocument}
        />
      </main>
    );
  }

  return (
    <main className="vh-provider-shell animate-fade-in">
      <section className="vh-provider-header-band">
        <div>
          <span className="vh-provider-kicker">ĐỐI TÁC VIBEHUE</span>
          <h1>Đăng ký tài khoản Đối tác</h1>
          <p>
            Đồng hành cùng VibeHue để kết nối với hàng ngàn khách hàng yêu thích cổ phục áo dài và nhiếp ảnh chuyên nghiệp.
          </p>
        </div>
        {verification && (
          <div className="vh-provider-status-badge-container">
            <span className="vh-status-label">Trạng thái hồ sơ:</span>
            <div className={`vh-provider-status status-${verification.status}`}>
              {statusLabel(verification.status)}
            </div>
          </div>
        )}
      </section>

      <section className="vh-provider-workspace">
        <aside className="vh-provider-stepper" aria-label="Các bước đăng ký">
          {steps.map((step, index) => {
            const isCompleted = index < maxReachedStep;
            const isActive = index === activeStep;
            const isClickable = index <= maxReachedStep;
            
            return (
              <button
                key={step}
                className={`vh-provider-step ${isActive ? 'active' : ''} ${
                  isCompleted ? 'done' : ''
                }`}
                disabled={!isClickable}
                onClick={() => {
                  setSuccess(null);
                  setError(null);
                  setActiveStep(index);
                }}
                type="button"
              >
                <span className="vh-step-icon">
                  {isCompleted ? <Check size={12} /> : index + 1}
                </span>
                <strong>{step}</strong>
              </button>
            );
          })}
        </aside>

        <section className="vh-provider-panel">
          {error && (
            <div className="vh-provider-alert error animate-fade-in">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="vh-provider-alert success animate-fade-in">
              <BadgeCheck size={18} />
              <span>{success}</span>
            </div>
          )}

          {activeStep === 0 && (
            <CapabilityStep
              selectedCapabilities={selectedCapabilities}
              disabled={hasUploadedDocuments}
              hasVerification={Boolean(verification)}
              onToggle={toggleCapability}
              onStart={startVerification}
              isLoading={actionLoading === 'create'}
            />
          )}

          {activeStep === 1 && (
            <ProfileStep
              businessProfile={businessProfile}
              aodaiInfo={aodaiInfo}
              photographyInfo={photographyInfo}
              requiresAodai={requiresAodai}
              requiresPhotography={requiresPhotography}
              disabled={!isEditable}
              errors={validationErrors}
              onBusinessChange={(val) => {
                setBusinessProfile(val);
                setAodaiInfo((prev) => ({ ...prev, shopName: val.businessName }));
                setPhotographyInfo((prev) => ({ ...prev, studioName: val.businessName }));
                setValidationErrors((prev) => ({ ...prev, businessName: '', ownerName: '', phone: '', email: '', address: '', province: '' }));
              }}
              onAodaiChange={(val) => {
                setAodaiInfo(val);
                setValidationErrors((prev) => ({ ...prev, shopName: '', brandName: '', pickupAddress: '', rentalPolicy: '', depositPolicy: '', sizeSupport: '' }));
              }}
              onPhotographyChange={(val) => {
                setPhotographyInfo(val);
                setValidationErrors((prev) => ({ ...prev, studioName: '', brandName: '', workingArea: '' }));
              }}
              onSave={saveProfile}
              isLoading={actionLoading === 'profile'}
              // Address Selector props
              isApiSupported={isApiSupported}
              isAddressEditing={isAddressEditing}
              setIsAddressEditing={setIsAddressEditing}
              provinces={provinces}
              districts={districts}
              wards={wards}
              selectedProvinceCode={selectedProvinceCode}
              selectedDistrictCode={selectedDistrictCode}
              selectedWardCode={selectedWardCode}
              streetAddress={streetAddress}
              setStreetAddress={(value) => {
                setValidationErrors((prev) => ({ ...prev, address: '' }));
                setStreetAddress(value);
              }}
              onProvinceChange={(code) => {
                setValidationErrors((prev) => ({ ...prev, province: '', district: '', ward: '', address: '' }));
                void handleProvinceChange(code);
              }}
              onDistrictChange={(code) => {
                setValidationErrors((prev) => ({ ...prev, district: '', ward: '', address: '' }));
                void handleDistrictChange(code);
              }}
              onWardChange={(code) => {
                setValidationErrors((prev) => ({ ...prev, ward: '', address: '' }));
                setSelectedWardCode(code);
              }}
              // Ao Dai Pickup Selector props
              pickupDistricts={pickupDistricts}
              pickupWards={pickupWards}
              isPickupAddressEditing={isPickupAddressEditing}
              setIsPickupAddressEditing={setIsPickupAddressEditing}
              selectedPickupProvinceCode={selectedPickupProvinceCode}
              selectedPickupDistrictCode={selectedPickupDistrictCode}
              selectedPickupWardCode={selectedPickupWardCode}
              pickupStreetAddress={pickupStreetAddress}
              setPickupStreetAddress={(value) => {
                setValidationErrors((prev) => ({ ...prev, pickupAddress: '' }));
                setPickupStreetAddress(value);
              }}
              onPickupProvinceChange={(code) => {
                setValidationErrors((prev) => ({ ...prev, pickupProvince: '', pickupDistrict: '', pickupWard: '', pickupAddress: '' }));
                void handlePickupProvinceChange(code);
              }}
              onPickupDistrictChange={(code) => {
                setValidationErrors((prev) => ({ ...prev, pickupDistrict: '', pickupWard: '', pickupAddress: '' }));
                void handlePickupDistrictChange(code);
              }}
              onPickupWardChange={(code) => {
                setValidationErrors((prev) => ({ ...prev, pickupWard: '', pickupAddress: '' }));
                setSelectedPickupWardCode(code);
              }}
              useBusinessAddressForPickup={useBusinessAddressForPickup}
              setUseBusinessAddressForPickup={setUseBusinessAddressForPickup}
            />
          )}

          {activeStep === 2 && (
            <ConsentStep
              checked={consentAccepted}
              disabled={!isEditable || verification?.consent.accepted}
              onCheckedChange={setConsentAccepted}
              onAccept={acceptConsent}
              isLoading={actionLoading === 'consent'}
              onBack={() => setActiveStep(1)}
            />
          )}

          {activeStep === 3 && verification && (
            <DocumentStepV2
              verification={verification}
              disabled={!isEditable || !verification.consent.accepted}
              actionLoading={actionLoading}
              onUpload={uploadDocument}
              onViewDocument={viewDocument}
              onContinue={() => setActiveStep(4)}
              onBack={() => setActiveStep(2)}
            />
          )}

          {activeStep === 4 && (
            <ReviewStep
              verification={verification}
              canSubmit={canSubmit}
              isLoading={actionLoading === 'submit'}
              onSubmit={submitVerification}
              onRefresh={() => void refreshVerification()}
              onBack={() => setActiveStep(3)}
            />
          )}
        </section>
      </section>
    </main>
  );
};

// --- STAGE COMPONENTS ---

function CapabilityStep({
  selectedCapabilities,
  disabled,
  hasVerification,
  onToggle,
  onStart,
  isLoading,
}: {
  selectedCapabilities: ProviderCapability[];
  disabled: boolean;
  hasVerification: boolean;
  onToggle: (capability: ProviderCapability) => void;
  onStart: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="vh-provider-section">
      <PanelTitle
        icon={<BriefcaseBusiness size={20} />}
        title="Chọn dịch vụ bạn cung cấp"
        subtitle="Chọn một hoặc cả hai dịch vụ phù hợp với mô hình kinh doanh của bạn."
      />
      
      {disabled && (
        <div className="vh-capability-locked-notice">
          <AlertCircle size={16} />
          <span>Danh mục dịch vụ đã được khoá vì bạn đã đăng tải tài liệu xác thực ở các bước sau.</span>
        </div>
      )}

      <div className="vh-provider-capability-grid">
        {capabilityOptions.map((option) => {
          const isSelected = selectedCapabilities.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              className={`vh-provider-capability ${isSelected ? 'selected' : ''}`}
              onClick={() => onToggle(option.value)}
            >
              <span className="vh-provider-capability-icon">{option.icon}</span>
              <div className="vh-provider-capability-details">
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </div>
            </button>
          );
        })}
      </div>
      <div className="vh-provider-actions">
        <Button
          type="button"
          onClick={onStart}
          isLoading={isLoading}
          disabled={selectedCapabilities.length === 0}
          rightIcon={<ArrowRight size={16} />}
        >
          {hasVerification ? 'Tiếp tục điền hồ sơ' : 'Khởi tạo hồ sơ'}
        </Button>
      </div>
    </div>
  );
}

function ProfileStep({
  businessProfile,
  aodaiInfo,
  photographyInfo,
  requiresAodai,
  requiresPhotography,
  disabled,
  errors,
  onBusinessChange,
  onAodaiChange,
  onPhotographyChange,
  onSave,
  isLoading,
  // Address selector properties
  isApiSupported,
  isAddressEditing,
  setIsAddressEditing,
  provinces,
  districts,
  wards,
  selectedProvinceCode,
  selectedDistrictCode,
  selectedWardCode,
  streetAddress,
  setStreetAddress,
  onProvinceChange,
  onDistrictChange,
  onWardChange,
  // Ao Dai pickup properties
  pickupDistricts,
  pickupWards,
  isPickupAddressEditing,
  setIsPickupAddressEditing,
  selectedPickupProvinceCode,
  selectedPickupDistrictCode,
  selectedPickupWardCode,
  pickupStreetAddress,
  setPickupStreetAddress,
  onPickupProvinceChange,
  onPickupDistrictChange,
  onPickupWardChange,
  useBusinessAddressForPickup,
  setUseBusinessAddressForPickup,
}: {
  businessProfile: ProviderBusinessProfile;
  aodaiInfo: AodaiInfo;
  photographyInfo: PhotographyInfo;
  requiresAodai: boolean;
  requiresPhotography: boolean;
  disabled: boolean;
  errors: Record<string, string>;
  onBusinessChange: (value: ProviderBusinessProfile) => void;
  onAodaiChange: (value: AodaiInfo) => void;
  onPhotographyChange: (value: PhotographyInfo) => void;
  onSave: () => void;
  isLoading: boolean;
  // Address selector properties
  isApiSupported: boolean;
  isAddressEditing: boolean;
  setIsAddressEditing: (val: boolean) => void;
  provinces: Array<{ code: number; name: string }>;
  districts: Array<{ code: number; name: string }>;
  wards: Array<{ code: number; name: string }>;
  selectedProvinceCode: number | null;
  selectedDistrictCode: number | null;
  selectedWardCode: number | null;
  streetAddress: string;
  setStreetAddress: (val: string) => void;
  onProvinceChange: (code: number) => void;
  onDistrictChange: (code: number) => void;
  onWardChange: (code: number) => void;
  // Ao Dai pickup properties
  pickupDistricts: Array<{ code: number; name: string }>;
  pickupWards: Array<{ code: number; name: string }>;
  isPickupAddressEditing: boolean;
  setIsPickupAddressEditing: (val: boolean) => void;
  selectedPickupProvinceCode: number | null;
  selectedPickupDistrictCode: number | null;
  selectedPickupWardCode: number | null;
  pickupStreetAddress: string;
  setPickupStreetAddress: (val: string) => void;
  onPickupProvinceChange: (code: number) => void;
  onPickupDistrictChange: (code: number) => void;
  onPickupWardChange: (code: number) => void;
  useBusinessAddressForPickup: boolean;
  setUseBusinessAddressForPickup: (val: boolean) => void;
}) {
  return (
    <div className="vh-provider-section">
      <PanelTitle
        icon={<FileCheck size={20} />}
        title="Thông tin hồ sơ đối tác"
        subtitle="Thông tin này sẽ là hồ sơ chính thức của bạn trên VibeHue sau khi được Admin phê duyệt."
      />
      <div className="vh-provider-form-grid">
        <TextField
          label="Tên thương hiệu kinh doanh"
          value={businessProfile.businessName}
          disabled={disabled}
          required
          error={errors.businessName}
          onChange={(val) => onBusinessChange({ ...businessProfile, businessName: val })}
        />
        <TextField
          label="Tên người đại diện / chủ hộ"
          value={businessProfile.ownerName}
          disabled={disabled}
          required
          error={errors.ownerName}
          onChange={(val) => onBusinessChange({ ...businessProfile, ownerName: val })}
        />
        <TextField
          label="Số điện thoại liên hệ"
          value={businessProfile.phone}
          disabled={disabled}
          required
          error={errors.phone}
          onChange={(val) => onBusinessChange({ ...businessProfile, phone: val })}
        />
        <TextField
          label="Địa chỉ email liên hệ"
          value={businessProfile.email}
          disabled={disabled}
          required
          error={errors.email}
          onChange={(val) => onBusinessChange({ ...businessProfile, email: val })}
        />

        {/* Dynamic Province and Detailed Address Selectors */}
        {isApiSupported && !disabled ? (
          <>
            {!isAddressEditing && businessProfile.address ? (
              <div className="vh-provider-field span-2 vh-saved-address-row">
                <span className="vh-field-label">Địa chỉ cơ sở đã lưu</span>
                <div className="vh-saved-address-display">
                  <strong>{businessProfile.address}</strong>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddressEditing(true)}
                  >
                    Thay đổi địa chỉ
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="vh-provider-field">
                  <span className="vh-field-label">Tỉnh / Thành phố <span className="vh-required-asterisk">*</span></span>
                  <select
                    className="vh-select-field"
                    value={selectedProvinceCode ?? ''}
                    onChange={(e) => onProvinceChange(Number(e.target.value))}
                  >
                    <option value="">-- Chọn Tỉnh/Thành phố --</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {errors.province && <span className="vh-field-error-msg">{errors.province}</span>}
                </div>

                <div className="vh-provider-field">
                  <span className="vh-field-label">Quận / Huyện <span className="vh-required-asterisk">*</span></span>
                  <select
                    className="vh-select-field"
                    value={selectedDistrictCode ?? ''}
                    disabled={!selectedProvinceCode}
                    onChange={(e) => onDistrictChange(Number(e.target.value))}
                  >
                    <option value="">-- Chọn Quận/Huyện --</option>
                    {districts.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {errors.district && <span className="vh-field-error-msg">{errors.district}</span>}
                </div>

                <div className="vh-provider-field">
                  <span className="vh-field-label">Phường / Xã <span className="vh-required-asterisk">*</span></span>
                  <select
                    className="vh-select-field"
                    value={selectedWardCode ?? ''}
                    disabled={!selectedDistrictCode}
                    onChange={(e) => onWardChange(Number(e.target.value))}
                  >
                    <option value="">-- Chọn Phường/Xã --</option>
                    {wards.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  {errors.ward && <span className="vh-field-error-msg">{errors.ward}</span>}
                </div>

                <div className="vh-provider-field">
                  <span className="vh-field-label">Số nhà, tên đường <span className="vh-required-asterisk">*</span></span>
                  <input
                    className="vh-input-field"
                    value={streetAddress}
                    disabled={!selectedWardCode}
                    placeholder="Ví dụ: 123 Nguyễn Huệ"
                    onChange={(e) => setStreetAddress(e.target.value)}
                  />
                  {errors.address && <span className="vh-field-error-msg">{errors.address}</span>}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <TextField
              label="Địa chỉ chi tiết cơ sở"
              value={businessProfile.address}
              disabled={disabled}
              required
              error={errors.address}
              onChange={(val) => onBusinessChange({ ...businessProfile, address: val })}
            />
            <TextField
              label="Tỉnh / Thành phố"
              value={businessProfile.province}
              disabled={disabled}
              required
              error={errors.province}
              onChange={(val) => onBusinessChange({ ...businessProfile, province: val })}
            />
          </>
        )}

        <TextArea
          label="Giới thiệu chi tiết thương hiệu"
          value={businessProfile.description}
          disabled={disabled}
          error={errors.description}
          onChange={(val) => onBusinessChange({ ...businessProfile, description: val })}
        />
      </div>

      {requiresAodai && (
        <div className="vh-capability-info-section animate-fade-in">
          <h3 className="vh-provider-subtitle">
            <Scissors size={16} />
            <span>Thông tin dịch vụ cho thuê Áo Dài</span>
          </h3>
          <div className="vh-provider-form-grid">
            <SizeSelectorField
              label="Hỗ trợ các kích cỡ size"
              value={aodaiInfo.sizeSupport}
              disabled={disabled}
              required
              error={errors.sizeSupport}
              onChange={(val) => onAodaiChange({ ...aodaiInfo, sizeSupport: val })}
            />

            {/* Pickup Address Selector */}
            <div className="vh-provider-field span-2">
              <label className="vh-pickup-address-checkbox-label">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={useBusinessAddressForPickup}
                  onChange={(e) => setUseBusinessAddressForPickup(e.target.checked)}
                />
                <span>Sử dụng địa chỉ cơ sở làm địa chỉ nhận trả đồ</span>
              </label>
            </div>

            {useBusinessAddressForPickup ? (
              <div className="vh-provider-field span-2 vh-pickup-address-synced-card animate-fade-in">
                <span className="vh-field-label">Địa chỉ nhận trả đồ thực tế</span>
                <div className="vh-address-synced-box">
                  <CheckCircle2 size={16} className="text-success" />
                  <span>Trùng khớp với địa chỉ cơ sở đã khai báo ở trên:</span>
                  <strong>{businessProfile.address || '(Chưa điền địa chỉ cơ sở)'}</strong>
                </div>
              </div>
            ) : (
              <>
                {isApiSupported && !disabled ? (
                  <>
                    {!isPickupAddressEditing && aodaiInfo.pickupAddress ? (
                      <div className="vh-provider-field span-2 vh-saved-address-row animate-fade-in">
                        <span className="vh-field-label">Địa chỉ nhận trả đồ đã lưu</span>
                        <div className="vh-saved-address-display">
                          <strong>{aodaiInfo.pickupAddress}</strong>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPickupAddressEditing(true)}
                          >
                            Thay đổi địa chỉ nhận trả
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="vh-pickup-selectors-grid span-2 animate-fade-in">
                        <div className="vh-provider-field">
                          <span className="vh-field-label">Tỉnh / Thành phố nhận trả <span className="vh-required-asterisk">*</span></span>
                          <select
                            className="vh-select-field"
                            value={selectedPickupProvinceCode ?? ''}
                            onChange={(e) => onPickupProvinceChange(Number(e.target.value))}
                          >
                            <option value="">-- Chọn Tỉnh/Thành phố --</option>
                            {provinces.map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          {errors.pickupProvince && <span className="vh-field-error-msg">{errors.pickupProvince}</span>}
                        </div>

                        <div className="vh-provider-field">
                          <span className="vh-field-label">Quận / Huyện nhận trả <span className="vh-required-asterisk">*</span></span>
                          <select
                            className="vh-select-field"
                            value={selectedPickupDistrictCode ?? ''}
                            disabled={!selectedPickupProvinceCode}
                            onChange={(e) => onPickupDistrictChange(Number(e.target.value))}
                          >
                            <option value="">-- Chọn Quận/Huyện --</option>
                            {pickupDistricts.map((d) => (
                              <option key={d.code} value={d.code}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                          {errors.pickupDistrict && <span className="vh-field-error-msg">{errors.pickupDistrict}</span>}
                        </div>

                        <div className="vh-provider-field">
                          <span className="vh-field-label">Phường / Xã nhận trả <span className="vh-required-asterisk">*</span></span>
                          <select
                            className="vh-select-field"
                            value={selectedPickupWardCode ?? ''}
                            disabled={!selectedPickupDistrictCode}
                            onChange={(e) => onPickupWardChange(Number(e.target.value))}
                          >
                            <option value="">-- Chọn Phường/Xã --</option>
                            {pickupWards.map((w) => (
                              <option key={w.code} value={w.code}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                          {errors.pickupWard && <span className="vh-field-error-msg">{errors.pickupWard}</span>}
                        </div>

                        <div className="vh-provider-field">
                          <span className="vh-field-label">Số nhà, tên đường nhận trả <span className="vh-required-asterisk">*</span></span>
                          <input
                            className="vh-input-field"
                            value={pickupStreetAddress}
                            disabled={!selectedPickupWardCode}
                            placeholder="Ví dụ: 123 Nguyễn Huệ"
                            onChange={(e) => setPickupStreetAddress(e.target.value)}
                          />
                          {errors.pickupAddress && <span className="vh-field-error-msg">{errors.pickupAddress}</span>}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <TextField
                    label="Địa chỉ nhận trả áo dài"
                    value={aodaiInfo.pickupAddress}
                    disabled={disabled}
                    required
                    error={errors.pickupAddress}
                    onChange={(val) => onAodaiChange({ ...aodaiInfo, pickupAddress: val })}
                  />
                )}
              </>
            )}

            <RentalPolicyField
              value={aodaiInfo.rentalPolicy}
              disabled={disabled}
              error={errors.rentalPolicy}
              onChange={(val) => onAodaiChange({ ...aodaiInfo, rentalPolicy: val })}
            />
            <DepositPolicyField
              value={aodaiInfo.depositPolicy}
              disabled={disabled}
              error={errors.depositPolicy}
              onChange={(val) => onAodaiChange({ ...aodaiInfo, depositPolicy: val })}
            />
          </div>
        </div>
      )}

      {requiresPhotography && (
        <div className="vh-capability-info-section animate-fade-in">
          <h3 className="vh-provider-subtitle">
            <Camera size={16} />
            <span>Thông tin dịch vụ Nhiếp Ảnh</span>
          </h3>
          <div className="vh-provider-form-grid">
            <TextField
              label="Khu vực hoạt động chính (Ví dụ: TP. Huế, Đà Nẵng, Quảng Trị)"
              value={photographyInfo.workingArea}
              disabled={disabled}
              required
              error={errors.workingArea}
              onChange={(val) => onPhotographyChange({ ...photographyInfo, workingArea: val })}
            />
            <TextField
              label="Phong cách chụp ảnh (Phân cách bằng dấu phẩy, ví dụ: Cổ trang, Ngoại cảnh, Đám cưới)"
              value={photographyInfo.photographyStyles?.join(', ')}
              disabled={disabled}
              onChange={(val) => onPhotographyChange({ ...photographyInfo, photographyStyles: splitCsv(val) })}
            />
            <TextField
              label="Đường dẫn Portfolio / Website tham khảo (Phân cách bằng dấu phẩy)"
              value={photographyInfo.portfolioUrls?.join(', ')}
              disabled={disabled}
              onChange={(val) => onPhotographyChange({ ...photographyInfo, portfolioUrls: splitCsv(val) })}
            />
          </div>
        </div>
      )}

      <div className="vh-provider-actions">
        <Button type="button" onClick={onSave} isLoading={isLoading} disabled={disabled}>
          Lưu hồ sơ và Tiếp tục
        </Button>
      </div>
    </div>
  );
}

function ConsentStep({
  checked,
  disabled,
  onCheckedChange,
  onAccept,
  isLoading,
  onBack,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  onAccept: () => void;
  isLoading: boolean;
  onBack: () => void;
}) {
  return (
    <div className="vh-provider-section">
      <PanelTitle
        icon={<ShieldCheck size={20} />}
        title="Đồng ý xử lý dữ liệu cá nhân"
        subtitle="Để tuân thủ các quy định bảo mật, chúng tôi cần sự chấp thuận của bạn trước khi tải tài liệu xác thực lên."
      />
      <div className="vh-provider-consent-card">
        <div className="vh-consent-body">
          <p>Bằng việc đánh dấu đồng ý, tôi cam kết và đồng ý rằng:</p>
          <ul>
            <li>VibeHue có quyền thu thập, đối chiếu và xử lý các thông tin cá nhân và tài liệu xác thực (CCCD/Hộ chiếu, Giấy đăng ký kinh doanh...) do tôi tải lên cho mục đích xét duyệt tư cách Đối tác.</li>
            <li>Các tài liệu này sẽ được lưu trữ an toàn trong kho dữ liệu riêng tư (Private Storage) của hệ thống và chỉ được truy xuất bảo mật thông qua máy chủ backend của VibeHue.</li>
            <li>Thông tin định danh như Số CCCD/Hộ chiếu sẽ được hệ thống mã hóa và băm (masked & hashed) nhằm bảo mật tối đa, không hiển thị công khai.</li>
            <li>Tôi hoàn toàn tự chịu trách nhiệm về tính chính xác và tính pháp lý của toàn bộ tài liệu do mình cung cấp.</li>
          </ul>
        </div>
        <label className="vh-provider-consent-checkbox-label">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onCheckedChange(event.target.checked)}
          />
          <span>Tôi đã đọc, hiểu và đồng ý hoàn toàn với các điều khoản xử lý thông tin cá nhân nêu trên.</span>
        </label>
      </div>
      <div className="vh-provider-actions">
        <Button type="button" variant="outline" onClick={onBack} leftIcon={<ArrowLeft size={16} />}>
          Quay lại
        </Button>
        <Button type="button" onClick={onAccept} isLoading={isLoading} disabled={!checked || disabled}>
          Xác nhận Đồng ý
        </Button>
      </div>
    </div>
  );
}

function DocumentStepV2({
  verification,
  disabled,
  actionLoading,
  onUpload,
  onViewDocument,
  onContinue,
  onBack,
}: {
  verification: ProviderVerificationDetail;
  disabled: boolean;
  actionLoading: string | null;
  onUpload: (documentType: ProviderDocumentType, file?: File) => void;
  onViewDocument: (documentType: ProviderDocumentType) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const documentByType = (documentType: ProviderDocumentType) =>
    verification.documents.find((document) => document.documentType === documentType);

  const identityDocs = [
    documentByType('IDENTITY_CARD_FRONT') ?? {
      documentType: 'IDENTITY_CARD_FRONT' as ProviderDocumentType,
      required: true,
      currentVersion: null,
      current: null,
    },
    documentByType('IDENTITY_CARD_BACK') ?? {
      documentType: 'IDENTITY_CARD_BACK' as ProviderDocumentType,
      required: true,
      currentVersion: null,
      current: null,
    },
  ];

  const legalDocs = [
    documentByType('BUSINESS_LICENSE') ?? {
      documentType: 'BUSINESS_LICENSE' as ProviderDocumentType,
      required: false,
      currentVersion: null,
      current: null,
    },
  ];

  const proofDocs = verification.documents.filter((doc) =>
    ['SHOP_PHOTO_PROOF', 'STUDIO_PORTFOLIO_PROOF', 'PROFESSIONAL_CERTIFICATE'].includes(doc.documentType)
  );

  return (
    <div className="vh-provider-section">
      <PanelTitle
        icon={<FileUp size={20} />}
        title="Tài liệu xác minh danh tính và năng lực"
        subtitle="Hồ sơ được chia theo các danh mục kiểm duyệt. Định dạng ảnh chụp (JPG, PNG) hoặc PDF sắc nét, dung lượng tối đa 5MB."
      />

      <div className="vh-provider-upload-groups">
        {identityDocs.length > 0 && (
          <section className="vh-provider-upload-group animate-fade-in">
            <div className="vh-provider-upload-heading">
              <FileCheck size={18} />
              <div>
                <h3>1. Giấy tờ định danh cá nhân</h3>
                <p>Căn cước công dân hoặc Hộ chiếu người đại diện</p>
              </div>
            </div>
             <div className="vh-provider-id-grid">
              {identityDocs.map((doc) => (
                <UploadDropZone
                  key={doc.documentType}
                  documentType={doc.documentType}
                  label={documentLabels[doc.documentType]}
                  hint="Ảnh chụp mặt trước rõ nét"
                  document={doc}
                  disabled={disabled}
                  actionLoading={actionLoading}
                  onUpload={onUpload}
                  onView={onViewDocument}
                  verificationId={verification.verificationId}
                />
              ))}
            </div>
          </section>
        )}

        {legalDocs.length > 0 && (
          <section className="vh-provider-upload-group animate-fade-in">
            <div className="vh-provider-upload-heading">
              <FileText size={18} />
              <div>
                <h3>2. Giấy tờ pháp lý doanh nghiệp</h3>
                <p>Giấy phép kinh doanh, mã số thuế hoặc đăng ký thương hiệu (Không bắt buộc)</p>
              </div>
            </div>
            <div className="vh-provider-id-grid">
              {legalDocs.map((doc) => (
                <UploadDropZone
                  key={doc.documentType}
                  documentType={doc.documentType}
                  label={documentLabels[doc.documentType]}
                  hint="Tải lên tài liệu PDF hoặc Hình ảnh"
                  document={doc}
                  disabled={disabled}
                  actionLoading={actionLoading}
                  onUpload={onUpload}
                  onView={onViewDocument}
                  verificationId={verification.verificationId}
                />
              ))}
            </div>
          </section>
        )}

        {proofDocs.length > 0 && (
          <section className="vh-provider-upload-group animate-fade-in">
            <div className="vh-provider-upload-heading">
              <Camera size={18} />
              <div>
                <h3>3. Chứng minh địa điểm & Năng lực thực tế</h3>
                <p>Hình ảnh thực tế cơ sở / cửa hàng áo dài hoặc portfolio tác phẩm nhiếp ảnh đã thực hiện</p>
              </div>
            </div>
            <div className="vh-provider-id-grid">
              {proofDocs.map((doc) => (
                <UploadDropZone
                  key={doc.documentType}
                  documentType={doc.documentType}
                  label={documentLabels[doc.documentType]}
                  hint="Hình ảnh hoặc PDF minh chứng"
                  document={doc}
                  disabled={disabled}
                  actionLoading={actionLoading}
                  onUpload={onUpload}
                  onView={onViewDocument}
                  verificationId={verification.verificationId}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="vh-provider-actions">
        <Button type="button" variant="outline" onClick={onBack} leftIcon={<ArrowLeft size={16} />}>
          Quay lại
        </Button>
        <Button type="button" onClick={onContinue} rightIcon={<ArrowRight size={16} />}>
          Tiếp tục kiểm tra
        </Button>
      </div>
    </div>
  );
}

function UploadDropZone({
  documentType,
  label,
  hint,
  document,
  disabled,
  actionLoading,
  onUpload,
  onView,
  verificationId,
}: {
  documentType: ProviderDocumentType;
  label: string;
  hint: string;
  document?: ProviderVerificationDocumentSummary;
  disabled: boolean;
  actionLoading: string | null;
  onUpload: (documentType: ProviderDocumentType, file?: File) => void;
  onView: (documentType: ProviderDocumentType) => void;
  verificationId?: string;
}) {
  const current = document?.current;
  const isUploaded = current?.uploadStatus === 'UPLOADED';
  const isRequired = document?.required;
  const isOcrFailed = current?.ocrStatus === 'OCR_FAILED';
  const ocrNextAction = current?.ocr?.nextAction;
  const ocrStatusMessage =
    ocrNextAction === 'WAIT_FOR_OCR'
      ? 'OCR is queued or processing. This page refreshes automatically.'
      : ocrNextAction === 'UPLOAD_AGAIN'
        ? 'Hệ thống không thể xác minh tài liệu này. Vui lòng tải lên hình ảnh rõ nét hơn.'
        : ocrNextAction === 'SUBMIT_WITH_MANUAL_REVIEW'
          ? 'OCR needs manual review. You can continue and submit the application.'
          : ocrNextAction === 'READY_TO_SUBMIT' ? 'OCR verification is complete.' : null;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!isUploaded || !verificationId) {
      setPreviewUrl(null);
      return;
    }

    const isImage = current?.mimeType?.startsWith('image/') || 
                    /\.(jpg|jpeg|png)$/i.test(current?.originalFileName || '');
    if (!isImage) {
      setPreviewUrl(null);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;

    const loadPreview = async () => {
      setLoadingPreview(true);
      try {
        const accessToken = tokenStorage.getAccessToken();
        const response = await fetch(
          `${API_BASE_URL}/provider-verifications/${verificationId}/documents/${documentType}/view`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        if (active) {
          const objectUrl = URL.createObjectURL(blob);
          createdUrl = objectUrl;
          setPreviewUrl(objectUrl);
        }
      } catch (e) {
        console.error('Failed to load image preview', e);
      } finally {
        if (active) {
          setLoadingPreview(false);
        }
      }
    };

    void loadPreview();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isUploaded, verificationId, documentType, current?.versionNo]);

  return (
    <div className="vh-provider-upload-zone-wrapper">
      <div className={`vh-provider-upload-zone ${isUploaded ? 'uploaded' : ''} ${isOcrFailed ? 'ocr-failed' : ''}`}>
        <label className={`vh-provider-upload-click ${disabled ? 'disabled' : ''}`}>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            disabled={disabled}
            onChange={(event) => onUpload(documentType, event.target.files?.[0])}
          />
          {previewUrl ? (
            <div className="vh-upload-image-preview-container">
              <img src={previewUrl} alt={label} className="vh-upload-image-preview" />
              {!disabled && (
                <div className="vh-upload-image-overlay">
                  <Camera size={18} />
                  <span>Thay đổi ảnh</span>
                </div>
              )}
            </div>
          ) : loadingPreview ? (
            <div className="vh-upload-preview-loading">
              <Loader2 className="animate-spin" size={20} />
              <span>Đang tải ảnh...</span>
            </div>
          ) : (
            <>
              <span className="vh-provider-upload-icon">
                {current?.mimeType === 'application/pdf' ? <FileText size={20} /> : <Camera size={20} />}
              </span>
              <strong>
                {label} {isRequired && <span className="vh-required-asterisk">*</span>}
              </strong>
              <small>
                {isUploaded
                  ? `Tên file: ${current?.originalFileName || 'Tài liệu đã tải lên'} (v${current?.versionNo})`
                  : hint}
              </small>
            </>
          )}
        </label>

        <div className="vh-provider-upload-meta">
          <div className="vh-upload-status-indicator">
            <span className={`vh-upload-status-badge ${isUploaded ? 'uploaded' : 'empty'}`}>
              {isUploaded ? 'Đã tải lên' : 'Chưa tải lên'}
            </span>
            {ocrStatusMessage && (
              <small
                style={{ display: 'block', marginTop: 6, color: ocrNextAction === 'UPLOAD_AGAIN' ? '#B42318' : '#475467', fontWeight: 600 }}
              >
                {ocrStatusMessage}
              </small>
            )}
          </div>

          <div className="vh-upload-actions-row">
            {isUploaded && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onView(documentType)}
                isLoading={actionLoading === `view-${documentType}`}
              >
                Xem file
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewStep({
  verification,
  canSubmit,
  isLoading,
  onSubmit,
  onRefresh,
  onBack,
}: {
  verification: ProviderVerificationDetail | null;
  canSubmit: boolean;
  isLoading: boolean;
  onSubmit: () => void;
  onRefresh: () => void;
  onBack: () => void;
}) {
  if (!verification) {
    return (
      <div className="vh-provider-section">
        <PanelTitle
          icon={<BadgeCheck size={20} />}
          title="Chưa có hồ sơ"
          subtitle="Hãy quay lại bước đầu tiên để khởi tạo hồ sơ."
        />
      </div>
    );
  }


  return (
    <div className="vh-provider-section">
      <PanelTitle
        icon={<BadgeCheck size={20} />}
        title="Kiểm tra lại và Gửi duyệt"
        subtitle="Vui lòng rà soát lại thông tin bên dưới. Admin sẽ thực hiện thẩm định hồ sơ của bạn."
      />
      <div className="vh-provider-review-grid">
        <SummaryItem label="Hình thức đăng ký" value={verification.requestedCapabilities.map(c => c === 'AODAI_RENTAL' ? 'Thuê Áo Dài' : 'Nhiếp Ảnh').join(', ')} />
        <SummaryItem label="Chủ hồ sơ" value={verification.businessProfile?.ownerName || 'Chưa cung cấp'} />
        <SummaryItem label="Tên thương hiệu" value={verification.businessProfile?.businessName || 'Chưa cung cấp'} />
        <SummaryItem label="Chấp thuận bảo mật" value={verification.consent.accepted ? 'Đã đồng ý' : 'Chưa đồng ý'} />
        <SummaryItem label="Số giấy tờ thiếu" value={verification.missingDocuments.length > 0 ? `${verification.missingDocuments.length} tài liệu bắt buộc` : 'Đã đủ tài liệu'} />
        <SummaryItem label="Ngày khởi tạo" value={formatDate(verification.createdAt || '')} />
      </div>

      {verification.ocrWarnings && verification.ocrWarnings.length > 0 && (
        <div className="vh-provider-alert warning animate-fade-in">
          <AlertTriangle size={18} />
          <div>
            <strong>OCR needs manual review:</strong> The document could not be fully verified automatically. You can still submit this application; an admin will review the uploaded files.
          </div>
        </div>
      )}

      {verification.review?.reason && (
        <div className="vh-provider-alert warning animate-fade-in">
          <AlertCircle size={18} />
          <div>
            <strong>Lý do yêu cầu sửa đổi của Admin trước đó:</strong>
            <p className="vh-admin-reason-note">{verification.review.reason}</p>
          </div>
        </div>
      )}

      <div className="vh-provider-actions">
        <Button type="button" variant="outline" onClick={onBack} leftIcon={<ArrowLeft size={16} />}>
          Quay lại
        </Button>
        <Button type="button" variant="outline" leftIcon={<RefreshCw size={16} />} onClick={onRefresh}>
          Làm mới
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          isLoading={isLoading}
          disabled={!canSubmit}
        >
          Gửi hồ sơ duyệt
        </Button>
      </div>
    </div>
  );
}

// --- STATUS DASHBOARD (PREMIUM TRACKING INTERFACE) ---

function StatusDashboard({
  verification,
  onEdit,
  onReset,
  actionLoading,
  onViewDocument,
}: {
  verification: ProviderVerificationDetail;
  onEdit: () => void;
  onReset: () => void;
  actionLoading: string | null;
  onViewDocument: (documentType: ProviderDocumentType) => void;
}) {
  const isApproved = verification.status === 'APPROVED';
  const isRejected = verification.status === 'REJECTED';
  const isNeedsChanges = verification.status === 'NEEDS_CHANGES';
  const isPendingReview = ['SUBMITTED', 'UNDER_REVIEW'].includes(verification.status);

  return (
    <div className="vh-status-dashboard animate-fade-in">
      {isApproved && (
        <div className="vh-status-banner success animate-fade-in">
          <div className="vh-status-banner-icon-bg">
            <Sparkles size={28} className="vh-icon-sparkle" />
          </div>
          <div className="vh-status-banner-content">
            <h2>Chúc mừng! Bạn đã là Đối tác của VibeHue</h2>
            <p>Hồ sơ đăng ký của bạn đã được phê duyệt thành công. Tài khoản của bạn hiện tại có toàn quyền đăng bán, cho thuê áo dài hoặc thiết lập dịch vụ nhiếp ảnh trên hệ thống.</p>
            <div className="vh-banner-actions">
              <a href="/provider/dashboard" className="vh-btn vh-btn-primary vh-btn-md vh-link-btn">
                <span>Đi đến Dashboard đối tác</span>
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="vh-status-banner error animate-fade-in">
          <div className="vh-status-banner-icon-bg">
            <XCircle size={28} />
          </div>
          <div className="vh-status-banner-content">
            <h2>Hồ sơ chưa được thông qua</h2>
            <p>Rất tiếc, Ban quản trị chưa thể duyệt hồ sơ đăng ký đối tác của bạn ở thời điểm này.</p>
            {verification.review?.reason && (
              <div className="vh-status-banner-reason">
                <strong>Lý do từ chối:</strong>
                <p>"{verification.review.reason}"</p>
              </div>
            )}
            <div className="vh-banner-actions">
              <Button type="button" onClick={onReset}>
                Tạo hồ sơ đăng ký mới
              </Button>
            </div>
          </div>
        </div>
      )}

      {isNeedsChanges && (
        <div className="vh-status-banner warning animate-fade-in">
          <div className="vh-status-banner-icon-bg">
            <AlertTriangle size={28} />
          </div>
          <div className="vh-status-banner-content">
            <h2>Hồ sơ cần bổ sung, chỉnh sửa thông tin</h2>
            <p>Admin đã kiểm tra hồ sơ và yêu cầu bạn cập nhật hoặc chụp lại một số giấy tờ xác minh chưa đạt yêu cầu.</p>
            {verification.review?.reason && (
              <div className="vh-status-banner-reason">
                <strong>Chi tiết yêu cầu bổ sung:</strong>
                <p>"{verification.review.reason}"</p>
              </div>
            )}
            <div className="vh-banner-actions">
              <Button type="button" onClick={onEdit}>
                Cập nhật thông tin ngay
              </Button>
            </div>
          </div>
        </div>
      )}

      {isPendingReview && (
        <div className="vh-status-banner info animate-fade-in">
          <div className="vh-status-banner-icon-bg">
            <Clock size={28} className="animate-pulse" />
          </div>
          <div className="vh-status-banner-content">
            <h2>Hồ sơ đang trong quá trình xét duyệt</h2>
            <p>Hồ sơ đã được gửi thành công và đang được phân phối cho nhân viên kiểm duyệt. Quá trình kiểm tra trực quan hình ảnh và đối chiếu dữ liệu thường mất tối đa 24h - 48h (trừ thứ 7 và CN).</p>
          </div>
        </div>
      )}

      <div className="vh-status-card timeline-card">
        <h3>Tiến độ kiểm duyệt hồ sơ</h3>
        <div className="vh-timeline-visual">
          <div className="vh-timeline-step completed">
            <span className="vh-timeline-icon"><Check size={12} /></span>
            <div className="vh-timeline-info">
              <strong>Khởi tạo hồ sơ</strong>
              <small>{formatDate(verification.createdAt)}</small>
            </div>
          </div>

          <div className={`vh-timeline-step ${verification.status !== 'DRAFT' ? 'completed' : ''}`}>
            <span className="vh-timeline-icon">
              {verification.status !== 'DRAFT' ? <Check size={12} /> : '2'}
            </span>
            <div className="vh-timeline-info">
              <strong>Gửi duyệt hồ sơ</strong>
              <small>{verification.status !== 'DRAFT' ? 'Đã hoàn thành' : 'Đang chờ'}</small>
            </div>
          </div>

          <div className={`vh-timeline-step ${['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_CHANGES'].includes(verification.status) ? 'completed' : isPendingReview ? 'active' : ''}`}>
            <span className="vh-timeline-icon">
              {['APPROVED', 'REJECTED', 'NEEDS_CHANGES'].includes(verification.status) ? (
                <Check size={12} />
              ) : isPendingReview ? (
                <Clock size={12} className="animate-spin" />
              ) : (
                '3'
              )}
            </span>
            <div className="vh-timeline-info">
              <strong>Đang thẩm định</strong>
              <small>
                {verification.status === 'UNDER_REVIEW'
                  ? 'Nhân viên đang xem xét'
                  : ['APPROVED', 'REJECTED', 'NEEDS_CHANGES'].includes(verification.status)
                    ? 'Đã hoàn thành'
                    : 'Đang chờ'}
              </small>
            </div>
          </div>

          <div className={`vh-timeline-step ${isApproved ? 'completed success' : isRejected ? 'completed error' : isNeedsChanges ? 'completed warning' : ''}`}>
            <span className="vh-timeline-icon">
              {isApproved ? (
                <CheckCircle2 size={14} />
              ) : isRejected ? (
                <XCircle size={14} />
              ) : isNeedsChanges ? (
                <AlertTriangle size={14} />
              ) : (
                '4'
              )}
            </span>
            <div className="vh-timeline-info">
              <strong>Kết quả phê duyệt</strong>
              <small>{statusLabel(verification.status)}</small>
            </div>
          </div>
        </div>
      </div>

      <div className="vh-status-details-grid">
        <div className="vh-status-card">
          <h3>Thông tin kinh doanh</h3>
          <div className="vh-dashboard-data-list">
            <div className="vh-data-row">
              <span>Tên thương hiệu:</span>
              <strong>{verification.businessProfile?.businessName}</strong>
            </div>
            <div className="vh-data-row">
              <span>Chủ sở hữu / Đại diện:</span>
              <strong>{verification.businessProfile?.ownerName}</strong>
            </div>
            <div className="vh-data-row">
              <span>Điện thoại liên hệ:</span>
              <strong>{verification.businessProfile?.phone}</strong>
            </div>
            <div className="vh-data-row">
              <span>Email liên hệ:</span>
              <strong>{verification.businessProfile?.email}</strong>
            </div>
            <div className="vh-data-row">
              <span>Địa chỉ đăng ký:</span>
              <strong>
                {verification.businessProfile?.address}, {verification.businessProfile?.province}
              </strong>
            </div>
            <div className="vh-data-row">
              <span>Dịch vụ đăng ký:</span>
              <strong>
                {verification.requestedCapabilities
                  .map((c) => (c === 'AODAI_RENTAL' ? 'Thuê Áo Dài' : 'Nhiếp Ảnh'))
                  .join(', ')}
              </strong>
            </div>
          </div>
        </div>

        <div className="vh-status-card">
          <h3>Tài liệu xác minh đã tải lên</h3>
          <div className="vh-dashboard-docs-list">
            {verification.documents.map((doc) => {
              const current = doc.current;
              const isUploaded = current?.uploadStatus === 'UPLOADED';
              return (
                <div key={doc.documentType} className="vh-dashboard-doc-item">
                  <div className="vh-dashboard-doc-info">
                    <strong>{documentLabels[doc.documentType]}</strong>
                    <small>
                      {isUploaded
                        ? `Phiên bản v${current?.versionNo} (OCR: ${ocrStatusLabel(current?.ocrStatus || '')})`
                        : 'Chưa tải lên'}
                    </small>
                  </div>
                  {isUploaded && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      isLoading={actionLoading === `view-${doc.documentType}`}
                      onClick={() => onViewDocument(doc.documentType)}
                    >
                      Xem file
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- UTILITY/HELPER COMPONENTS ---

function PanelTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="vh-provider-panel-title">
      <span className="vh-panel-title-icon">{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  disabled,
  required,
  error,
  onChange,
}: {
  label: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`vh-provider-field ${error ? 'has-error' : ''}`}>
      <span className="vh-field-label">
        {label} {required && <span className="vh-required-asterisk">*</span>}
      </span>
      <input
        className="vh-input-field"
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <span className="vh-field-error-msg animate-fade-in">{error}</span>}
    </label>
  );
}

function TextArea({
  label,
  value,
  disabled,
  required,
  error,
  onChange,
}: {
  label: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`vh-provider-field span-2 ${error ? 'has-error' : ''}`}>
      <span className="vh-field-label">
        {label} {required && <span className="vh-required-asterisk">*</span>}
      </span>
      <textarea
        className="vh-input-field vh-textarea-field"
        value={value ?? ''}
        disabled={disabled}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <span className="vh-field-error-msg animate-fade-in">{error}</span>}
    </label>
  );
}

function SizeSelectorField({
  label,
  value,
  disabled,
  required,
  error,
  onChange,
}: {
  label: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free size'];

  const selectedSizes = useMemo(() => {
    if (!value) return [];
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [value]);

  const handleToggle = (size: string) => {
    if (disabled) return;
    let newSizes: string[];
    if (selectedSizes.includes(size)) {
      newSizes = selectedSizes.filter((s) => s !== size);
    } else {
      newSizes = AVAILABLE_SIZES.filter((s) => selectedSizes.includes(s) || s === size);
      selectedSizes.forEach((s) => {
        if (!AVAILABLE_SIZES.includes(s) && !newSizes.includes(s)) {
          newSizes.push(s);
        }
      });
    }
    onChange(newSizes.join(', '));
  };

  const [customSize, setCustomSize] = useState('');

  const handleAddCustomSize = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customSize.trim();
    if (!trimmed) return;

    if (!selectedSizes.includes(trimmed)) {
      const newSizes = [...selectedSizes, trimmed];
      onChange(newSizes.join(', '));
    }
    setCustomSize('');
  };

  return (
    <div className={`vh-provider-field span-2 ${error ? 'has-error' : ''}`}>
      <span className="vh-field-label">
        {label} {required && <span className="vh-required-asterisk">*</span>}
      </span>
      <div className="vh-size-selector-container">
        <div className="vh-size-chips-grid">
          {AVAILABLE_SIZES.map((size) => {
            const isSelected = selectedSizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                disabled={disabled}
                className={`vh-size-chip ${isSelected ? 'selected' : ''}`}
                onClick={() => handleToggle(size)}
              >
                {isSelected && <Check size={14} className="vh-size-chip-check" />}
                <span>{size}</span>
              </button>
            );
          })}
        </div>

        {!disabled && (
          <div className="vh-custom-size-row">
            <input
              type="text"
              className="vh-input-field vh-custom-size-input"
              placeholder="Thêm size khác (ví dụ: 4XL, 130cm...)"
              value={customSize}
              disabled={disabled}
              onChange={(e) => setCustomSize(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomSize();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddCustomSize()}
              disabled={disabled || !customSize.trim()}
            >
              Thêm
            </Button>
          </div>
        )}

        {selectedSizes.filter((s) => !AVAILABLE_SIZES.includes(s)).length > 0 && (
          <div className="vh-custom-sizes-list">
            <span className="vh-custom-sizes-label">Các size khác đã chọn:</span>
            <div className="vh-custom-size-chips">
              {selectedSizes
                .filter((s) => !AVAILABLE_SIZES.includes(s))
                .map((size) => (
                  <span key={size} className="vh-custom-size-badge">
                    {size}
                    {!disabled && (
                      <button
                        type="button"
                        className="vh-custom-size-remove"
                        onClick={() => handleToggle(size)}
                      >
                        &times;
                      </button>
                    )}
                  </span>
                ))}
            </div>
          </div>
        )}

        <div className="vh-size-preview">
          <span>Các size đã chọn: </span>
          <strong>{value ? value : '(Chưa chọn size nào)'}</strong>
        </div>
      </div>
      {error && <span className="vh-field-error-msg animate-fade-in">{error}</span>}
    </div>
  );
}

interface StructuredRentalPolicy {
  limitDays: number;
  delayFeePerDay: number;
  description: string;
}

interface StructuredDepositPolicy {
  depositType: 'COLLATERAL' | 'CASH' | 'BOTH' | 'NONE';
  depositValue: number;
  description: string;
}

const defaultRentalPolicy: StructuredRentalPolicy = {
  limitDays: 3,
  delayFeePerDay: 50000,
  description: '',
};

const defaultDepositPolicy: StructuredDepositPolicy = {
  depositType: 'CASH',
  depositValue: 500000,
  description: '',
};

function parseRentalPolicy(val?: string): StructuredRentalPolicy {
  if (!val) return defaultRentalPolicy;
  try {
    const trimmed = val.trim();
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      return {
        limitDays: typeof parsed.limitDays === 'number' ? parsed.limitDays : 3,
        delayFeePerDay: typeof parsed.delayFeePerDay === 'number' ? parsed.delayFeePerDay : 50000,
        description: parsed.description || '',
      };
    }
  } catch (e) {
    // Ignore and fallback
  }
  return {
    ...defaultRentalPolicy,
    description: val,
  };
}

function parseDepositPolicy(val?: string): StructuredDepositPolicy {
  if (!val) return defaultDepositPolicy;
  try {
    const trimmed = val.trim();
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      return {
        depositType: ['COLLATERAL', 'CASH', 'BOTH', 'NONE'].includes(parsed.depositType) ? parsed.depositType : 'CASH',
        depositValue: typeof parsed.depositValue === 'number' ? parsed.depositValue : 500000,
        description: parsed.description || '',
      };
    }
  } catch (e) {
    // Ignore and fallback
  }
  return {
    ...defaultDepositPolicy,
    description: val,
  };
}

function RentalPolicyField({
  value,
  disabled,
  error,
  onChange,
}: {
  value?: string;
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const policy = useMemo(() => parseRentalPolicy(value), [value]);

  useEffect(() => {
    if (!value) {
      onChange(JSON.stringify(defaultRentalPolicy));
    }
  }, [value, onChange]);

  const updatePolicy = (updated: Partial<StructuredRentalPolicy>) => {
    const newPolicy = { ...policy, ...updated };
    onChange(JSON.stringify(newPolicy));
  };

  return (
    <div className={`vh-provider-field span-2 ${error ? 'has-error' : ''}`}>
      <span className="vh-field-label">
        Chính sách cho thuê áo dài <span className="vh-required-asterisk">*</span>
      </span>
      <div className="vh-policy-container">
        <div className="vh-policy-structured-grid">
          <div className="vh-provider-field">
            <span className="vh-field-label">Thời gian thuê tiêu chuẩn (ngày)</span>
            <input
              type="number"
              min={1}
              className="vh-input-field"
              value={policy.limitDays}
              disabled={disabled}
              onChange={(e) => updatePolicy({ limitDays: Math.max(1, Number(e.target.value)) })}
            />
          </div>
          <div className="vh-provider-field">
            <span className="vh-field-label">Phí trễ hạn mỗi ngày (VND)</span>
            <input
              type="number"
              min={0}
              step={5000}
              className="vh-input-field"
              value={policy.delayFeePerDay}
              disabled={disabled}
              onChange={(e) => updatePolicy({ delayFeePerDay: Math.max(0, Number(e.target.value)) })}
            />
          </div>
        </div>
        <div className="vh-provider-field" style={{ marginTop: '12px' }}>
          <span className="vh-field-label">Mô tả chi tiết thêm điều khoản cho thuê</span>
          <textarea
            className="vh-input-field vh-textarea-field"
            rows={3}
            placeholder="Ví dụ: Đồ thuê yêu cầu trả lại nguyên vẹn không tự ý sửa..."
            value={policy.description}
            disabled={disabled}
            onChange={(e) => updatePolicy({ description: e.target.value })}
          />
        </div>
      </div>
      {error && <span className="vh-field-error-msg animate-fade-in">{error}</span>}
    </div>
  );
}

function DepositPolicyField({
  value,
  disabled,
  error,
  onChange,
}: {
  value?: string;
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const policy = useMemo(() => parseDepositPolicy(value), [value]);

  useEffect(() => {
    if (!value) {
      onChange(JSON.stringify(defaultDepositPolicy));
    }
  }, [value, onChange]);

  const updatePolicy = (updated: Partial<StructuredDepositPolicy>) => {
    const newPolicy = { ...policy, ...updated };
    onChange(JSON.stringify(newPolicy));
  };

  return (
    <div className={`vh-provider-field span-2 ${error ? 'has-error' : ''}`}>
      <span className="vh-field-label">
        Chính sách đặt cọc và bồi thường <span className="vh-required-asterisk">*</span>
      </span>
      <div className="vh-policy-container">
        <div className="vh-policy-structured-grid">
          <div className="vh-provider-field">
            <span className="vh-field-label">Hình thức đặt cọc</span>
            <select
              className="vh-select-field"
              value={policy.depositType}
              disabled={disabled}
              onChange={(e) => updatePolicy({ depositType: e.target.value as any })}
            >
              <option value="CASH">Tiền mặt / Chuyển khoản</option>
              <option value="COLLATERAL">Giữ giấy tờ tùy thân (CCCD/Hộ chiếu)</option>
              <option value="BOTH">Tiền mặt hoặc Giấy tờ tùy thân</option>
              <option value="NONE">Không yêu cầu đặt cọc</option>
            </select>
          </div>
          {policy.depositType !== 'NONE' && policy.depositType !== 'COLLATERAL' && (
            <div className="vh-provider-field">
              <span className="vh-field-label">Số tiền cọc yêu cầu (VND)</span>
              <input
                type="number"
                min={0}
                step={50000}
                className="vh-input-field"
                value={policy.depositValue}
                disabled={disabled}
                onChange={(e) => updatePolicy({ depositValue: Math.max(0, Number(e.target.value)) })}
              />
            </div>
          )}
        </div>
        <div className="vh-provider-field" style={{ marginTop: '12px' }}>
          <span className="vh-field-label">Mô tả chi tiết thêm điều khoản đặt cọc & đền bù</span>
          <textarea
            className="vh-input-field vh-textarea-field"
            rows={3}
            placeholder="Ví dụ: Bồi thường 100% giá trị áo nếu làm rách hoặc hư hỏng không thể phục hồi..."
            value={policy.description}
            disabled={disabled}
            onChange={(e) => updatePolicy({ description: e.target.value })}
          />
        </div>
      </div>
      {error && <span className="vh-field-error-msg animate-fade-in">{error}</span>}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="vh-provider-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isProfileComplete(detail: ProviderVerificationDetail) {
  const profile = detail.businessProfile ?? {};
  const hasBaseProfile = [
    profile.businessName,
    profile.ownerName,
    profile.phone,
    profile.email,
    profile.address,
    profile.province,
  ].every(Boolean);

  if (!hasBaseProfile) {
    return false;
  }

  if (detail.requestedCapabilities.includes('AODAI_RENTAL')) {
    const aodai = detail.aodaiInfo ?? {};
    if (
      ![
        aodai.shopName,
        aodai.rentalPolicy,
        aodai.depositPolicy,
        aodai.pickupAddress,
        aodai.sizeSupport,
      ].every(Boolean)
    ) {
      return false;
    }
  }

  if (detail.requestedCapabilities.includes('PHOTOGRAPHY')) {
    const photography = detail.photographyInfo ?? {};
    if (![photography.studioName, photography.workingArea].every(Boolean)) {
      return false;
    }
  }

  return true;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: 'Đang soạn thảo',
    SUBMITTED: 'Đã gửi duyệt',
    UNDER_REVIEW: 'Đang thẩm định',
    NEEDS_CHANGES: 'Cần bổ sung',
    APPROVED: 'Đã phê duyệt',
    REJECTED: 'Bị từ chối',
    CANCELLED: 'Đã hủy bỏ',
  };
  return labels[status] ?? status;
}

function ocrStatusLabel(status: string) {
  const labels: Record<string, string> = {
    NOT_STARTED: 'Chưa chạy đối chiếu',
    OCR_PROCESSING: 'Đang trích xuất...',
    OCR_PASSED: 'Hợp lệ',
    OCR_FAILED: 'Không thể đọc ảnh',
    OCR_LOW_CONFIDENCE: 'Độ tin cậy thấp',
    MISMATCH_DETECTED: 'Thông tin lệch',
    NEEDS_MANUAL_REVIEW: 'Cần kiểm tra lại',
  };
  return labels[status] ?? status;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'Có lỗi kết nối xảy ra. Vui lòng thử lại.';
}

export default BecomeProviderPage;
