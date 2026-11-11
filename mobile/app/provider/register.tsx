import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { type Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { providerApi } from '@/apis/providerApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { LoadingState } from '@/components/ui/ScreenState';
import { FontFamily, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/apiError';

const CAPABILITIES = [
  {
    id: 'AODAI_RENTAL',
    title: 'Tiệm Áo dài & Cổ phục',
    subtitle: 'Cho thuê Áo dài, Nhật Bình, Ngũ Thân & Phụ kiện',
    icon: 'shirt-outline' as const,
  },
  {
    id: 'PHOTOGRAPHY',
    title: 'Nhiếp ảnh gia & Studio',
    subtitle: 'Gói chụp ngoại cảnh Đại Nội, Lăng tẩm & Studio',
    icon: 'camera-outline' as const,
  },
];

const PHOTO_STYLES = [
  'Cổ phục Hoàng cung',
  'Nàng thơ Cố đô',
  'Truyền thống Điện ảnh',
  'Kỷ yếu & Cặp đôi',
];

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const DOC_TYPES = [
  {
    type: 'CCCD_FRONT',
    label: 'CCCD / CMND Mặt trước',
    hint: 'Ảnh chụp rõ nét 4 góc, không lóa sáng',
    required: true,
  },
  {
    type: 'CCCD_BACK',
    label: 'CCCD / CMND Mặt sau',
    hint: 'Hiển thị rõ thông tin ngày cấp & đặc điểm',
    required: true,
  },
  {
    type: 'SELFIE',
    label: 'Ảnh Chân dung Chủ tiệm / Nhiếp ảnh gia',
    hint: 'Dùng để đối chiếu xác thực chính chủ KYC',
    required: true,
  },
  {
    type: 'BUSINESS_LICENSE',
    label: 'Giấy phép Kinh doanh / Ảnh Tiệm thực tế',
    hint: 'Tăng 100% độ tin cậy để duyệt nhanh trong 24h',
    required: false,
  },
] as const;

export default function ProviderRegisterRoute() {
  return (
    <RequireAuth>
      <ProviderRegisterScreen />
    </RequireAuth>
  );
}

function ProviderRegisterScreen() {
  const { user, refreshUser } = useAuth();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string>('DRAFT');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const [capabilities, setCapabilities] = useState<string[]>(['AODAI_RENTAL']);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [province, setProvince] = useState('Thừa Thiên Huế');
  const [taxCode, setTaxCode] = useState('');
  const [description, setDescription] = useState('');

  // Ao dai info
  const [rentalPolicy, setRentalPolicy] = useState(
    'Giữ trang phục sạch sẽ, trả đúng giờ hẹn tại tiệm.',
  );
  const [depositPolicy, setDepositPolicy] = useState(
    'Đặt cọc 30% qua hệ thống bảo vệ Escrow của TàGo.',
  );
  const [sizeSupport, setSizeSupport] = useState<string[]>(['S', 'M', 'L', 'XL']);

  // Photography info
  const [workingArea, setWorkingArea] = useState('Đại Nội Huế, Lăng Minh Mạng, Sông Hương');
  const [selectedPhotoStyles, setSelectedPhotoStyles] = useState<string[]>([
    'Cổ phục Hoàng cung',
    'Nàng thơ Cố đô',
  ]);

  // Documents & Consent
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({});
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  const isAlreadyPartner = Boolean(
    user?.roles?.some((r) => ['PROVIDER', 'PHOTOGRAPHER', 'ADMIN'].includes(r.toUpperCase())),
  );

  const hydrateFromRecord = useCallback(
    (rec: any) => {
      if (!rec) return;
      if (rec._id || rec.id) setVerificationId(String(rec._id || rec.id));
      if (rec.status) setVerificationStatus(String(rec.status));
      if (rec.rejectionReason) setRejectionReason(String(rec.rejectionReason));
      if (Array.isArray(rec.requestedCapabilities) && rec.requestedCapabilities.length > 0) {
        setCapabilities(rec.requestedCapabilities);
      }
      const bp = rec.businessProfile || {};
      setBusinessName(bp.businessName || user?.fullName || '');
      setOwnerName(bp.ownerName || user?.fullName || '');
      setPhone(bp.phone || user?.phone || '');
      setEmail(bp.email || user?.email || '');
      setAddress(bp.address || '');
      setProvince(bp.province || 'Thừa Thiên Huế');
      setTaxCode(bp.taxCode || '');
      setDescription(bp.description || '');

      const ad = rec.aodaiInfo || {};
      if (ad.rentalPolicy) setRentalPolicy(ad.rentalPolicy);
      if (ad.depositPolicy) setDepositPolicy(ad.depositPolicy);
      if (Array.isArray(ad.sizeSupport) && ad.sizeSupport.length > 0) {
        setSizeSupport(ad.sizeSupport);
      }

      const ph = rec.photographyInfo || {};
      if (ph.workingArea) setWorkingArea(ph.workingArea);
      if (Array.isArray(ph.photographyStyles) && ph.photographyStyles.length > 0) {
        setSelectedPhotoStyles(ph.photographyStyles);
      }

      if (Array.isArray(rec.documents)) {
        const map: Record<string, string> = {};
        rec.documents.forEach((doc: any) => {
          if (doc?.documentType && (doc?.fileUrl || doc?.url)) {
            map[doc.documentType] = doc.fileUrl || doc.url;
          }
        });
        setUploadedDocs(map);
      }
      if (rec.consentAccepted || rec.consent?.accepted) {
        setConsentChecked(true);
      }
    },
    [user],
  );

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const current = await providerApi.getCurrentVerification().catch(() => null);
        if (!mounted) return;
        if (current) {
          hydrateFromRecord(current);
        } else {
          setOwnerName(user?.fullName || '');
          setPhone(user?.phone || '');
          setEmail(user?.email || '');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [hydrateFromRecord, user]);

  const ensureVerificationRecord = async (): Promise<string> => {
    if (verificationId) return verificationId;
    const created = await providerApi.createVerification({
      requestedCapabilities: capabilities,
    });
    const newId = String(created?._id || created?.id || '');
    if (!newId) throw new Error('Không thể khởi tạo hồ sơ KYC');
    setVerificationId(newId);
    return newId;
  };

  const toggleCapability = (cap: string) => {
    setCapabilities((prev) => {
      if (prev.includes(cap)) {
        return prev.length > 1 ? prev.filter((c) => c !== cap) : prev;
      }
      return [...prev, cap];
    });
  };

  const saveStep1And2 = async (nextStep: 2 | 3) => {
    if (!businessName.trim() || !ownerName.trim() || !phone.trim() || !address.trim()) {
      show('Vui lòng điền đầy đủ Tên tiệm, Chủ đại diện, Số điện thoại và Địa chỉ', 'error');
      return;
    }
    setSaving(true);
    try {
      const id = await ensureVerificationRecord();
      const updated = await providerApi.updateVerification(id, {
        requestedCapabilities: capabilities,
        businessProfile: {
          businessName: businessName.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          email: email.trim() || user?.email || '',
          address: address.trim(),
          province: province.trim() || 'Thừa Thiên Huế',
          taxCode: taxCode.trim() || undefined,
          description: description.trim() || undefined,
          businessType: taxCode.trim() ? 'HOUSEHOLD_BUSINESS' : 'INDIVIDUAL',
        },
        aodaiInfo: capabilities.includes('AODAI_RENTAL')
          ? {
              shopName: businessName.trim(),
              rentalPolicy: rentalPolicy.trim(),
              depositPolicy: depositPolicy.trim(),
              pickupAddress: address.trim(),
              sizeSupport,
            }
          : undefined,
        photographyInfo: capabilities.includes('PHOTOGRAPHY')
          ? {
              studioName: businessName.trim(),
              workingArea: workingArea.trim(),
              photographyStyles: selectedPhotoStyles,
            }
          : undefined,
      });
      hydrateFromRecord(updated);
      setStep(nextStep);
      show('Đã lưu thông tin hồ sơ Đối tác', 'success');
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể lưu hồ sơ Đối tác'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePickDocument = async (docType: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      show('Vui lòng cấp quyền truy cập thư viện ảnh để tải giấy tờ KYC', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    setUploadingDocType(docType);
    try {
      const id = await ensureVerificationRecord();
      const formData = new FormData();
      formData.append('documentType', docType);
      formData.append('file', {
        uri: asset.uri,
        name: asset.fileName || `${docType.toLowerCase()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      } as any);
      await providerApi.uploadVerificationDocument(id, formData);
      setUploadedDocs((prev) => ({ ...prev, [docType]: asset.uri }));
      show('Đã tải giấy tờ xác thực thành công', 'success');
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể tải tài liệu KYC'), 'error');
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleSubmitKyc = async () => {
    if (!uploadedDocs.CCCD_FRONT || !uploadedDocs.CCCD_BACK || !uploadedDocs.SELFIE) {
      show('Vui lòng tải đủ CCCD mặt trước, mặt sau và ảnh chân dung chính chủ', 'error');
      return;
    }
    if (!consentChecked) {
      show('Vui lòng tích đồng ý Điều khoản Đối tác TàGo trước khi gửi duyệt', 'error');
      return;
    }
    setSaving(true);
    try {
      const id = await ensureVerificationRecord();
      await providerApi.acceptVerificationConsent(id, '1.0');
      const submitted = await providerApi.submitVerification(id);
      hydrateFromRecord(submitted);
      setVerificationStatus(submitted?.status || 'PENDING_REVIEW');
      await refreshUser();
      show('Hồ sơ Đối tác đã được gửi xét duyệt thành công!', 'success');
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể gửi duyệt hồ sơ KYC'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Đang kiểm tra hồ sơ Đối tác TàGo..." />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#1E1418" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>TÀGO PARTNER PRO · KYC</Text>
          <Text style={s.title}>Đăng ký Trở thành Đối tác</Text>
        </View>
        {isAlreadyPartner && (
          <Pressable
            style={s.portalPill}
            onPress={() => router.push('/provider' as Href)}
          >
            <Text style={s.portalPillText}>Vào Quản trị</Text>
            <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        {(verificationStatus === 'PENDING_REVIEW' ||
          verificationStatus === 'SUBMITTED' ||
          verificationStatus === 'APPROVED' ||
          verificationStatus === 'REJECTED') && (
          <View
            style={[
              s.statusBanner,
              verificationStatus === 'APPROVED' && s.statusApproved,
              verificationStatus === 'REJECTED' && s.statusRejected,
            ]}
          >
            <Ionicons
              name={
                verificationStatus === 'APPROVED'
                  ? 'checkmark-circle'
                  : verificationStatus === 'REJECTED'
                    ? 'alert-circle'
                    : 'time'
              }
              size={22}
              color={
                verificationStatus === 'APPROVED'
                  ? '#127A48'
                  : verificationStatus === 'REJECTED'
                    ? '#B42318'
                    : '#B54708'
              }
            />
            <View style={{ flex: 1 }}>
              <Text style={s.statusTitle}>
                {verificationStatus === 'APPROVED'
                  ? 'Hồ sơ Đối tác đã được Phê duyệt chính thức'
                  : verificationStatus === 'REJECTED'
                    ? 'Hồ sơ cần bổ sung thông tin'
                    : 'Hồ sơ KYC đang chờ Ban Quản Trị phê duyệt'}
              </Text>
              <Text style={s.statusSub}>
                {verificationStatus === 'APPROVED'
                  ? 'Bạn đã có toàn quyền vận hành Tiệm Áo dài & Studio trên TàGo Partner Pro.'
                  : rejectionReason ||
                    'Đội ngũ thẩm định TàGo sẽ phản hồi trong vòng 24 giờ làm việc.'}
              </Text>
            </View>
          </View>
        )}

        {/* Stepper */}
        <View style={s.stepper}>
          {[
            { id: 1, label: '1. Thương hiệu' },
            { id: 2, label: '2. Dịch vụ & Quy định' },
            { id: 3, label: '3. Định danh KYC' },
          ].map((item) => {
            const active = step === item.id;
            const done = step > item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setStep(item.id as 1 | 2 | 3)}
                style={[s.stepPill, active && s.stepPillActive, done && s.stepPillDone]}
              >
                <Text
                  style={[
                    s.stepPillText,
                    (active || done) && s.stepPillTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {step === 1 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Chọn Lĩnh vực Kinh doanh tại Huế</Text>
            <Text style={s.cardSub}>
              Bạn có thể đăng ký riêng Tiệm Áo dài, Nhiếp ảnh gia hoặc kết hợp cả hai để tạo Gói
              Combo.
            </Text>

            <View style={{ gap: 10 }}>
              {CAPABILITIES.map((cap) => {
                const selected = capabilities.includes(cap.id);
                return (
                  <Pressable
                    key={cap.id}
                    onPress={() => toggleCapability(cap.id)}
                    style={[s.capCard, selected && s.capCardActive]}
                  >
                    <View style={[s.capIcon, selected && s.capIconActive]}>
                      <Ionicons
                        name={cap.icon}
                        size={20}
                        color={selected ? '#FFFFFF' : '#BA0049'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.capTitle}>{cap.title}</Text>
                      <Text style={s.capSub}>{cap.subtitle}</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? '#BA0049' : '#B8A8B0'}
                    />
                  </Pressable>
                );
              })}
            </View>

            <AppInput
              label="TÊN TIỆM ÁO DÀI / STUDIO *"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="VD: Cổ Phục Hoa Niên Huế"
            />
            <AppInput
              label="HỌ TÊN CHỦ ĐẠI DIỆN *"
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="VD: Nguyễn Phúc Minh"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <AppInput
                label="SỐ ĐIỆN THOẠI LIÊN HỆ *"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="0905xxxxxx"
                style={{ flex: 1 }}
              />
              <AppInput
                label="MÃ SỐ THUẾ (NẾU CÓ)"
                value={taxCode}
                onChangeText={setTaxCode}
                placeholder="3300xxxxxx"
                style={{ flex: 1 }}
              />
            </View>
            <AppInput
              label="EMAIL NHẬN ĐỐI SOÁT"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="contact@atelier.vn"
            />
            <AppInput
              label="ĐỊA CHỈ TIỆM / STUDIO TẠI CỐ ĐÔ *"
              value={address}
              onChangeText={setAddress}
              placeholder="VD: 48 Đặng Thái Thân, Phường Thuận Hòa, TP. Huế"
            />
            <AppInput
              label="GIỚI THIỆU PHONG CÁCH NHÀ MAY / STUDIO"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Chia sẻ điểm đặc sắc về chất liệu cổ phục, tay nghề thợ may hoặc góc máy nghệ thuật..."
            />

            <AppButton
              title="Tiếp tục cấu hình dịch vụ →"
              loading={saving}
              onPress={() => void saveStep1And2(2)}
            />
          </View>
        )}

        {step === 2 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Cấu hình Quy định & Chuyên môn</Text>

            {capabilities.includes('AODAI_RENTAL') && (
              <View style={s.subBox}>
                <Text style={s.subBoxTitle}>1. Thiết lập Tiệm Áo dài & Cổ phục</Text>
                <Text style={s.fieldLabel}>KÍCH CỠ HỖ TRỢ TẠI TIỆM</Text>
                <View style={s.chipWrap}>
                  {SIZES.map((sz) => {
                    const on = sizeSupport.includes(sz);
                    return (
                      <Pressable
                        key={sz}
                        onPress={() =>
                          setSizeSupport((prev) =>
                            on ? prev.filter((item) => item !== sz) : [...prev, sz],
                          )
                        }
                        style={[s.chip, on && s.chipOn]}
                      >
                        <Text style={[s.chipText, on && s.chipTextOn]}>Size {sz}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <AppInput
                  label="QUY ĐỊNH BẢO QUẢN & NHẬN TRẢ ĐỒ"
                  value={rentalPolicy}
                  onChangeText={setRentalPolicy}
                  multiline
                />
                <AppInput
                  label="CHÍNH SÁCH CỌC ESCROW"
                  value={depositPolicy}
                  onChangeText={setDepositPolicy}
                />
              </View>
            )}

            {capabilities.includes('PHOTOGRAPHY') && (
              <View style={s.subBox}>
                <Text style={s.subBoxTitle}>2. Thiết lập Nhiếp ảnh & Studio</Text>
                <AppInput
                  label="KHU VỰC NHẬN CHỤP NGOẠI CẢNH"
                  value={workingArea}
                  onChangeText={setWorkingArea}
                  placeholder="Đại Nội, Lăng Tự Đức, Cầu Trường Tiền..."
                />
                <Text style={s.fieldLabel}>PHONG CÁCH NHIẾP ẢNH CHỦ ĐẠO</Text>
                <View style={s.chipWrap}>
                  {PHOTO_STYLES.map((st) => {
                    const on = selectedPhotoStyles.includes(st);
                    return (
                      <Pressable
                        key={st}
                        onPress={() =>
                          setSelectedPhotoStyles((prev) =>
                            on ? prev.filter((item) => item !== st) : [...prev, st],
                          )
                        }
                        style={[s.chip, on && s.chipOn]}
                      >
                        <Text style={[s.chipText, on && s.chipTextOn]}>{st}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={s.secondaryBtn} onPress={() => setStep(1)}>
                <Text style={s.secondaryBtnText}>← Quay lại</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <AppButton
                  title="Lưu & Sang Bước KYC →"
                  loading={saving}
                  onPress={() => void saveStep1And2(3)}
                />
              </View>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Tải Giấy tờ Định danh KYC</Text>
            <Text style={s.cardSub}>
              Dữ liệu định danh được mã hóa bảo mật và chỉ phục vụ xác thực Đối tác chính danh trên
              nền tảng TàGo.
            </Text>

            <View style={{ gap: 12 }}>
              {DOC_TYPES.map((doc) => {
                const uri = uploadedDocs[doc.type];
                const isUploading = uploadingDocType === doc.type;
                return (
                  <View key={doc.type} style={s.docCard}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.docTitle}>{doc.label}</Text>
                        {doc.required && <Text style={s.reqBadge}>Bắt buộc</Text>}
                      </View>
                      <Text style={s.docHint}>{doc.hint}</Text>
                      {uri && (
                        <View style={s.uploadedRow}>
                          <Ionicons name="checkmark-circle" size={14} color="#127A48" />
                          <Text style={s.uploadedText}>Đã tải lên thành công</Text>
                        </View>
                      )}
                    </View>

                    <Pressable
                      style={s.uploadBtn}
                      disabled={isUploading}
                      onPress={() => void handlePickDocument(doc.type)}
                    >
                      {isUploading ? (
                        <ActivityIndicator size="small" color="#BA0049" />
                      ) : uri ? (
                        <Image source={{ uri }} style={s.docPreview} contentFit="cover" />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={18} color="#BA0049" />
                          <Text style={s.uploadBtnText}>Tải ảnh</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <Pressable
              style={s.consentRow}
              onPress={() => setConsentChecked((v) => !v)}
            >
              <Ionicons
                name={consentChecked ? 'checkbox' : 'square-outline'}
                size={22}
                color={consentChecked ? '#BA0049' : '#8C7A82'}
              />
              <Text style={s.consentText}>
                Tôi cam kết thông tin kê khai là chính xác và đồng ý với Quy chế Đối tác TàGo
                Partner Pro & Cơ chế Bảo lãnh Đặt cọc Escrow.
              </Text>
            </Pressable>

            <AppButton
              title="Gửi Hồ Sơ Xét Duyệt KYC"
              loading={saving}
              onPress={() => void handleSubmitKyc()}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FDFBF9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE6EA',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#EFE6EA',
    backgroundColor: '#FAF6F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: '#BA0049',
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: '#1E1418',
  },
  portalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: '#BA0049',
  },
  portalPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  content: {
    padding: 16,
    paddingBottom: 44,
    gap: 16,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: '#FFFAEB',
    borderWidth: 1,
    borderColor: '#FEDF89',
  },
  statusApproved: {
    backgroundColor: '#ECFDF3',
    borderColor: '#ABEFC6',
  },
  statusRejected: {
    backgroundColor: '#FEF3F2',
    borderColor: '#FECDCA',
  },
  statusTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#1E1418',
  },
  statusSub: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 17,
    color: '#5C474F',
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    gap: 8,
  },
  stepPill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    backgroundColor: '#FAF6F8',
    borderWidth: 1,
    borderColor: '#EFE6EA',
    alignItems: 'center',
  },
  stepPillActive: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  stepPillDone: {
    backgroundColor: '#FFF0F5',
    borderColor: '#BA0049',
  },
  stepPillText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    color: '#7A6870',
  },
  stepPillTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#EFE6EA',
    padding: 16,
    gap: 14,
    ...Shadow,
  },
  cardTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 19,
    color: '#1E1418',
  },
  cardSub: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#6E5B63',
    marginTop: -6,
  },
  capCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: '#EFE6EA',
    backgroundColor: '#FAF6F8',
  },
  capCardActive: {
    borderColor: '#BA0049',
    backgroundColor: '#FFF0F5',
  },
  capIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capIconActive: {
    backgroundColor: '#BA0049',
  },
  capTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: '#1E1418',
  },
  capSub: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#6E5B63',
    marginTop: 2,
  },
  subBox: {
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: '#FAF6F8',
    borderWidth: 1,
    borderColor: '#EFE6EA',
    gap: 12,
  },
  subBoxTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#BA0049',
  },
  fieldLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: '#6E5B63',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE6EA',
  },
  chipOn: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  chipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#4F3F46',
  },
  chipTextOn: {
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#EFE6EA',
    backgroundColor: '#FAF6F8',
  },
  secondaryBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#5C474F',
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#EFE6EA',
    backgroundColor: '#FAF6F8',
  },
  docTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: '#1E1418',
  },
  reqBadge: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    color: '#BA0049',
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  docHint: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#7A6870',
  },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  uploadedText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#127A48',
  },
  uploadBtn: {
    width: 74,
    height: 74,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BA0049',
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 4,
  },
  uploadBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    color: '#BA0049',
  },
  docPreview: {
    width: '100%',
    height: '100%',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
  },
  consentText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#3D2C33',
  },
});
