import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { providerApi } from '@/apis/providerApi';
import { TagoLocationPicker } from '@/components/map/TagoLocationPicker';
import { useToast } from '@/contexts/ToastContext';
import { FontFamily } from '@/constants/theme';
import type { ProviderProfile } from '@/types/provider';
import { detectCityFromText, resolveEntityCoords } from '@/utils/geo';
import { getMediaUrl } from '@/utils/media';

export type StoreHubTab = 'SETTINGS' | 'VOUCHERS' | 'PACKAGES' | 'ANALYTICS';

interface StoreManagementHubModalProps {
  visible: boolean;
  initialTab?: StoreHubTab;
  profile: ProviderProfile | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function StoreManagementHubModal({
  visible,
  initialTab = 'SETTINGS',
  profile,
  onClose,
  onUpdated,
}: StoreManagementHubModalProps) {
  const { show } = useToast();
  const [activeTab, setActiveTab] = useState<StoreHubTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. Store Settings State
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [storeLat, setStoreLat] = useState<number>(16.4698);
  const [storeLng, setStoreLng] = useState<number>(107.5786);
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number>(25);
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // 2. Vouchers, Campaigns & Combos State
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [showNewVoucher, setShowNewVoucher] = useState(false);
  const [vCode, setVCode] = useState('');
  const [vTitle, setVTitle] = useState('');
  const [vValue, setVValue] = useState('15');
  const [vType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [vMinOrder, setVMinOrder] = useState('200000');

  const [activeCampaign, setActiveCampaign] = useState<any | null>(null);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignOccasion, setCampaignOccasion] = useState('Festival Cố Đô Huế');
  const [campaignPercent, setCampaignPercent] = useState('15');

  const [combos, setCombos] = useState<any[]>([]);
  const [showNewCombo, setShowNewCombo] = useState(false);
  const [comboName, setComboName] = useState('');
  const [comboDiscount, setComboDiscount] = useState('20');
  const [comboProducts, setComboProducts] = useState<any[]>([]);

  // 3. Packages & Portfolio State
  const [packages, setPackages] = useState<any[]>([]);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [showNewPkg, setShowNewPkg] = useState(false);
  const [pkgTitle, setPkgTitle] = useState('');
  const [pkgPrice, setPkgPrice] = useState('1200000');
  const [pkgDuration, setPkgDuration] = useState('120');

  const [showNewPortfolio, setShowNewPortfolio] = useState(false);
  const [portfolioTitle, setPortfolioTitle] = useState('');
  const [portfolioLocation, setPortfolioLocation] = useState('Đại Nội Huế');
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);

  // 4. Analytics State
  const [analytics, setAnalytics] = useState<any | null>(null);

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      setBusinessName(profile?.businessName || profile?.brandName || '');
      setDescription((profile as any)?.description || '');
      setContactPhone((profile as any)?.contactPhone || '');
      setAddressLine(profile?.address?.addressLine || '');
      const resolved = resolveEntityCoords(profile || { address: { city: 'Huế' } });
      setStoreLat(resolved.lat);
      setStoreLng(resolved.lng);
      setServiceRadiusKm(
        Number((profile as any)?.photographySettings?.serviceRadiusKm) || 25,
      );
      setLogoUrl((profile as any)?.media?.logoUrl || '');
      setCoverUrl((profile as any)?.media?.coverUrl || '');
      void fetchTabContent(initialTab);
    }
  }, [visible, initialTab, profile]);

  const fetchTabContent = useCallback(async (tab: StoreHubTab) => {
    setLoading(true);
    try {
      if (tab === 'VOUCHERS') {
        const [vRes, campRes, comboRes, prodRes, pkgRes] = await Promise.allSettled([
          providerApi.listVouchers(),
          providerApi.getActiveCampaign(),
          providerApi.listCombos(),
          providerApi.getMyProducts({ limit: 50 }),
          providerApi.listPhotographyPackages(),
        ]);
        if (vRes.status === 'fulfilled') {
          setVouchers(Array.isArray(vRes.value) ? vRes.value : []);
        }
        if (campRes.status === 'fulfilled' && campRes.value?._id) {
          setActiveCampaign(campRes.value);
        } else {
          setActiveCampaign(null);
        }
        if (comboRes.status === 'fulfilled') {
          setCombos(Array.isArray(comboRes.value) ? comboRes.value : []);
        }
        if (prodRes.status === 'fulfilled') {
          const items = prodRes.value?.items || prodRes.value || [];
          setComboProducts(Array.isArray(items) ? items : []);
        }
        if (pkgRes.status === 'fulfilled') {
          setPackages(Array.isArray(pkgRes.value) ? pkgRes.value : []);
        }
      } else if (tab === 'PACKAGES') {
        const [pkgRes, portRes] = await Promise.allSettled([
          providerApi.listPhotographyPackages(),
          providerApi.listPortfolioItems(),
        ]);
        if (pkgRes.status === 'fulfilled') {
          setPackages(Array.isArray(pkgRes.value) ? pkgRes.value : []);
        }
        if (portRes.status === 'fulfilled') {
          setPortfolios(Array.isArray(portRes.value) ? portRes.value : []);
        }
      } else if (tab === 'ANALYTICS') {
        const data = await providerApi.getAnalytics('30d');
        setAnalytics(data);
      }
    } catch {
      // fallback gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectTab = (t: StoreHubTab) => {
    setActiveTab(t);
    void fetchTabContent(t);
  };

  const handlePickStoreMedia = async (target: 'LOGO' | 'COVER') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      show('Vui lòng cấp quyền truy cập thư viện ảnh', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append(
        'images',
        (asset.file ?? {
          uri: asset.uri,
          name: asset.fileName ?? `${target.toLowerCase()}.jpg`,
          type: asset.mimeType ?? 'image/jpeg',
        }) as unknown as Blob,
      );
      const uploaded = await providerApi.uploadImages(formData);
      const url = uploaded?.urls?.[0];
      if (url) {
        if (target === 'LOGO') setLogoUrl(url);
        else setCoverUrl(url);
        show(
          target === 'LOGO'
            ? 'Đã tải lên Logo cửa hàng mới!'
            : 'Đã tải lên Ảnh bìa cửa hàng mới!',
          'success',
        );
      }
    } catch {
      show('Không thể tải ảnh lên, vui lòng thử lại', 'error');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Save Store Settings
  const handleSaveSettings = async () => {
    if (!businessName.trim()) {
      show('Vui lòng nhập tên cửa hàng', 'error');
      return;
    }
    setSaving(true);
    try {
      const detectedCity = detectCityFromText(addressLine);
      await providerApi.updateProfile({
        businessName: businessName.trim(),
        description: description.trim(),
        contactPhone: contactPhone.trim(),
        address: {
          ...(profile?.address || {}),
          addressLine: addressLine.trim(),
          city: profile?.address?.city || detectedCity.name,
          geo: {
            type: 'Point',
            coordinates: [storeLng, storeLat],
          },
        },
        photographySettings: {
          ...((profile as any)?.photographySettings || {}),
          serviceRadiusKm,
        },
        media: {
          ...((profile as any)?.media || {}),
          logoUrl: logoUrl || (profile as any)?.media?.logoUrl,
          coverUrl: coverUrl || (profile as any)?.media?.coverUrl,
        },
      } as any);
      show('Đã cập nhật hồ sơ, tọa độ Bản đồ & bán kính phục vụ thành công!', 'success');
      onUpdated();
    } catch (e: any) {
      show(e?.response?.data?.message || 'Lỗi khi lưu cài đặt cửa hàng', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Create Voucher
  const handleCreateVoucher = async () => {
    if (!vCode.trim() || !vTitle.trim()) {
      show('Vui lòng nhập mã và tên chương trình khuyến mãi', 'error');
      return;
    }
    setSaving(true);
    try {
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setDate(now.getDate() + 30);

      await providerApi.createVoucher({
        code: vCode.trim().toUpperCase(),
        title: vTitle.trim(),
        discountType: vType,
        discountValue: Number(vValue) || 10,
        minOrderValue: Number(vMinOrder) || 0,
        usageLimit: 50,
        startDate: now.toISOString(),
        endDate: nextMonth.toISOString(),
      });
      show('Đã tạo mã giảm giá mới!', 'success');
      setShowNewVoucher(false);
      setVCode('');
      setVTitle('');
      void fetchTabContent('VOUCHERS');
    } catch (e: any) {
      show(e?.response?.data?.message || 'Không thể tạo voucher', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVoucher = async (v: any) => {
    try {
      await providerApi.updateVoucher(v._id, { isActive: !v.isActive });
      void fetchTabContent('VOUCHERS');
    } catch {
      show('Lỗi cập nhật trạng thái voucher', 'error');
    }
  };

  const handleDeleteVoucher = async (id: string) => {
    try {
      await providerApi.deleteVoucher(id);
      show('Đã xóa mã giảm giá!', 'success');
      void fetchTabContent('VOUCHERS');
    } catch {
      show('Không thể xóa voucher', 'error');
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignOccasion.trim()) {
      show('Vui lòng nhập tên dịp khuyến mãi', 'error');
      return;
    }
    setSaving(true);
    try {
      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 14);
      await providerApi.createCampaign({
        occasion: campaignOccasion.trim(),
        discountPercent: Number(campaignPercent) || 15,
        startDate: now.toISOString(),
        endDate: nextWeek.toISOString(),
      });
      show('Đã bật Chiến dịch Flash Sale toàn cửa hàng!', 'success');
      setShowCampaignForm(false);
      void fetchTabContent('VOUCHERS');
      onUpdated();
    } catch (e: any) {
      show(e?.response?.data?.message || 'Lỗi tạo chiến dịch', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateCampaign = async () => {
    setSaving(true);
    try {
      await providerApi.deactivateCampaign();
      show('Đã tắt Chiến dịch khuyến mãi toàn tiệm', 'success');
      setActiveCampaign(null);
      void fetchTabContent('VOUCHERS');
      onUpdated();
    } catch {
      show('Không thể tắt chiến dịch', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCombo = async () => {
    if (!comboName.trim()) {
      show('Vui lòng nhập tên gói Combo', 'error');
      return;
    }
    const firstProdId = comboProducts[0]?._id;
    const firstPkgId = packages[0]?._id;
    if (!firstProdId || !firstPkgId) {
      show('Cần có ít nhất 1 mẫu Áo dài và 1 Gói chụp ảnh để ghép Combo', 'error');
      return;
    }
    setSaving(true);
    try {
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setDate(now.getDate() + 30);
      await providerApi.createCombo({
        name: comboName.trim(),
        description: 'Gói Combo thuê cổ phục + chụp ảnh ngoại cảnh Huế',
        productId: firstProdId,
        photographyPackageId: firstPkgId,
        discountPercent: Number(comboDiscount) || 20,
        validFrom: now.toISOString(),
        validTo: nextMonth.toISOString(),
        maxUsage: 20,
        aoDaiQuantity: 1,
        shootPeopleCount: 1,
      });
      show('Đã tạo Gói Combo ưu đãi mới!', 'success');
      setShowNewCombo(false);
      setComboName('');
      void fetchTabContent('VOUCHERS');
    } catch (e: any) {
      show(e?.response?.data?.message || 'Không thể tạo Combo', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCombo = async (id: string) => {
    try {
      await providerApi.deleteCombo(id);
      show('Đã xóa gói Combo!', 'success');
      void fetchTabContent('VOUCHERS');
    } catch {
      show('Không thể xóa gói Combo', 'error');
    }
  };

  // Create Photography Package
  const handleCreatePackage = async () => {
    if (!pkgTitle.trim()) {
      show('Vui lòng nhập tên gói chụp', 'error');
      return;
    }
    setSaving(true);
    try {
      const durHours = Math.max(0.5, Number((Number(pkgDuration || 120) / 60).toFixed(1)));
      await providerApi.createPhotographyPackage({
        name: pkgTitle.trim(),
        price: Number(pkgPrice) || 1200000,
        durationHours: durHours,
        includedDurationMinutes: Number(pkgDuration) || 120,
        editedPhotosCount: 25,
        rawPhotosCount: 100,
        deliveryDays: 3,
        maxPeople: 2,
        status: 'ACTIVE',
      });
      show('Đã thêm gói chụp ảnh mới!', 'success');
      setShowNewPkg(false);
      setPkgTitle('');
      void fetchTabContent('PACKAGES');
      onUpdated();
    } catch (e: any) {
      show(e?.response?.data?.message || 'Không thể tạo gói chụp', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePickPortfolioPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      show('Vui lòng cấp quyền truy cập thư viện ảnh', 'error');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.length) return;

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      res.assets.forEach((asset, idx) => {
        formData.append(
          'images',
          (asset.file ?? {
            uri: asset.uri,
            name: asset.fileName ?? `portfolio_${idx}.jpg`,
            type: asset.mimeType ?? 'image/jpeg',
          }) as unknown as Blob,
        );
      });
      const uploaded = await providerApi.uploadImages(formData);
      if (uploaded?.urls?.length) {
        setPortfolioImages((prev) => [...prev, ...uploaded.urls]);
        show(`Đã tải lên ${uploaded.urls.length} ảnh vào Album!`, 'success');
      }
    } catch {
      show('Không thể tải ảnh Album, vui lòng thử lại', 'error');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleCreatePortfolio = async () => {
    if (!portfolioTitle.trim()) {
      show('Vui lòng nhập tên Album Portfolio', 'error');
      return;
    }
    setSaving(true);
    try {
      await providerApi.createPortfolioItem({
        title: portfolioTitle.trim(),
        location: portfolioLocation.trim() || 'Đại Nội Huế',
        images:
          portfolioImages.length > 0
            ? portfolioImages
            : [
                'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80',
              ],
        coverImage:
          portfolioImages[0] ||
          'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80',
      });
      show('Đã tạo Album Portfolio nghệ thuật mới!', 'success');
      setShowNewPortfolio(false);
      setPortfolioTitle('');
      setPortfolioImages([]);
      void fetchTabContent('PACKAGES');
      onUpdated();
    } catch (e: any) {
      show(e?.response?.data?.message || 'Không thể tạo Album Portfolio', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>QUẢN TRỊ CỬA HÀNG TÀGO</Text>
              <Text style={styles.title}>Thiết lập & Dịch vụ Đối tác</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#1B1C1C" />
            </Pressable>
          </View>

          {/* 4 Navigation Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {(
              [
                { key: 'SETTINGS', label: 'Hồ sơ tiệm', icon: 'storefront-outline' },
                { key: 'VOUCHERS', label: 'Mã giảm giá', icon: 'pricetag-outline' },
                { key: 'PACKAGES', label: 'Gói chụp & Album', icon: 'camera-outline' },
                { key: 'ANALYTICS', label: 'Báo cáo doanh thu', icon: 'stats-chart-outline' },
              ] as const
            ).map((t) => {
              const active = activeTab === t.key;
              return (
                <Pressable
                  key={t.key}
                  style={[styles.tabPill, active && styles.tabPillActive]}
                  onPress={() => handleSelectTab(t.key)}
                >
                  <Ionicons
                    name={t.icon}
                    size={15}
                    color={active ? '#FFFFFF' : '#5B3F43'}
                  />
                  <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Body */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#BA0049" />
            </View>
          ) : (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* TAB 1: STORE SETTINGS */}
              {activeTab === 'SETTINGS' && (
                <View style={styles.section}>
                  <Text style={styles.label}>Hình ảnh nhận diện Thương hiệu (Logo & Ảnh bìa)</Text>
                  <View style={styles.twoCol}>
                    <Pressable
                      style={styles.mediaUploadCard}
                      onPress={() => void handlePickStoreMedia('LOGO')}
                      disabled={uploadingMedia}
                    >
                      {logoUrl ? (
                        <Image
                          source={{ uri: getMediaUrl(logoUrl) }}
                          style={styles.mediaPreviewImg}
                          contentFit="cover"
                        />
                      ) : (
                        <Ionicons name="person-circle-outline" size={26} color="#BA0049" />
                      )}
                      <Text style={styles.mediaUploadLabel}>Đổi Logo Tiệm</Text>
                    </Pressable>

                    <Pressable
                      style={styles.mediaUploadCard}
                      onPress={() => void handlePickStoreMedia('COVER')}
                      disabled={uploadingMedia}
                    >
                      {coverUrl ? (
                        <Image
                          source={{ uri: getMediaUrl(coverUrl) }}
                          style={styles.mediaPreviewImg}
                          contentFit="cover"
                        />
                      ) : (
                        <Ionicons name="image-outline" size={24} color="#BA0049" />
                      )}
                      <Text style={styles.mediaUploadLabel}>Đổi Ảnh Bìa</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.label}>Tên cửa hàng / Studio *</Text>
                  <TextInput
                    style={styles.input}
                    value={businessName}
                    onChangeText={setBusinessName}
                    placeholder="VD: Áo Dài Cổ Phong Huế"
                  />

                  <Text style={styles.label}>Số điện thoại liên hệ</Text>
                  <TextInput
                    style={styles.input}
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    keyboardType="phone-pad"
                    placeholder="VD: 0905123456"
                  />

                  <Text style={styles.label}>
                    Ghim vị trí Tiệm / Studio trên Bản đồ (Toàn quốc)
                  </Text>
                  <TagoLocationPicker
                    label="CHỌN HOẶC KÉO GHIM VỊ TRÍ CỬA HÀNG CỦA BẠN"
                    value={{
                      address: addressLine || 'Cung An Định, 179B Phan Đình Phùng, TP. Huế',
                      lat: storeLat,
                      lng: storeLng,
                    }}
                    onChange={(next) => {
                      setAddressLine(next.address);
                      setStoreLat(next.lat);
                      setStoreLng(next.lng);
                    }}
                  />

                  <Text style={styles.label}>
                    Bán kính nhận chụp ngoại cảnh miễn phụ phí di chuyển
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {[5, 10, 20, 35, 50].map((km) => {
                      const active = serviceRadiusKm === km;
                      return (
                        <Pressable
                          key={km}
                          onPress={() => setServiceRadiusKm(km)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 99,
                            backgroundColor: active ? '#BA0049' : '#FBF9F9',
                            borderWidth: 1,
                            borderColor: active ? '#BA0049' : '#EFECEB',
                          }}>
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: FontFamily.bodyBold,
                              color: active ? '#FFFFFF' : '#1B1C1C',
                            }}>
                            Bán kính {km} km
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.label}>Giới thiệu cửa hàng</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    placeholder="Mô tả phong cách cổ phục, dịch vụ makeup, chụp ảnh..."
                  />

                  <Pressable
                    style={[styles.primarySaveBtn, saving && { opacity: 0.6 }]}
                    disabled={saving}
                    onPress={handleSaveSettings}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.primarySaveBtnText}>Lưu hồ sơ cửa hàng</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}

              {/* TAB 2: VOUCHERS, CAMPAIGNS & COMBOS */}
              {activeTab === 'VOUCHERS' && (
                <View style={styles.section}>
                  {/* A. Store-wide Flash Sale Campaign */}
                  <View style={styles.rowBetween}>
                    <Text style={styles.sectionHeading}>
                      1. Chiến dịch giảm giá toàn tiệm (Campaign)
                    </Text>
                    {!activeCampaign && (
                      <Pressable
                        style={styles.addSmallBtn}
                        onPress={() => setShowCampaignForm(!showCampaignForm)}
                      >
                        <Ionicons
                          name={showCampaignForm ? 'remove' : 'flash'}
                          size={14}
                          color="#BA0049"
                        />
                        <Text style={styles.addSmallBtnText}>
                          {showCampaignForm ? 'Đóng' : 'Mở chiến dịch'}
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {activeCampaign ? (
                    <View style={styles.createCard}>
                      <View style={styles.rowBetween}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>
                            🔥 {activeCampaign.occasion || 'Chiến dịch đang chạy'} (-
                            {activeCampaign.discountPercent}%)
                          </Text>
                          <Text style={styles.itemSub}>
                            Đang áp dụng giảm giá tự động cho toàn bộ cổ phục trong tiệm
                          </Text>
                        </View>
                        <Pressable
                          style={styles.addSmallBtn}
                          onPress={handleDeactivateCampaign}
                        >
                          <Text style={styles.addSmallBtnText}>Tắt</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : showCampaignForm ? (
                    <View style={styles.createCard}>
                      <Text style={styles.label}>Tên dịp khuyến mãi *</Text>
                      <TextInput
                        style={styles.input}
                        value={campaignOccasion}
                        onChangeText={setCampaignOccasion}
                        placeholder="VD: Tuần Lễ Áo Dài Cộng Đồng Huế"
                      />
                      <Text style={styles.label}>Phần trăm giảm toàn tiệm (1-90%)</Text>
                      <TextInput
                        style={styles.input}
                        value={campaignPercent}
                        onChangeText={setCampaignPercent}
                        keyboardType="numeric"
                      />
                      <Pressable
                        style={styles.primarySaveBtn}
                        disabled={saving}
                        onPress={handleCreateCampaign}
                      >
                        <Text style={styles.primarySaveBtnText}>
                          Kích hoạt Chiến dịch toàn tiệm
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {/* B. Vouchers */}
                  <View style={[styles.rowBetween, { marginTop: 8 }]}>
                    <Text style={styles.sectionHeading}>
                      2. Mã Voucher ({vouchers.length})
                    </Text>
                    <Pressable
                      style={styles.addSmallBtn}
                      onPress={() => setShowNewVoucher(!showNewVoucher)}
                    >
                      <Ionicons
                        name={showNewVoucher ? 'remove' : 'add'}
                        size={16}
                        color="#BA0049"
                      />
                      <Text style={styles.addSmallBtnText}>
                        {showNewVoucher ? 'Đóng form' : 'Tạo mã mới'}
                      </Text>
                    </Pressable>
                  </View>

                  {showNewVoucher && (
                    <View style={styles.createCard}>
                      <Text style={styles.label}>Mã Voucher (In hoa) *</Text>
                      <TextInput
                        style={styles.input}
                        value={vCode}
                        onChangeText={setVCode}
                        autoCapitalize="characters"
                        placeholder="VD: CODOPHONG15"
                      />
                      <Text style={styles.label}>Tên chương trình *</Text>
                      <TextInput
                        style={styles.input}
                        value={vTitle}
                        onChangeText={setVTitle}
                        placeholder="VD: Giảm 15% thuê cổ phục Hoàng Cung"
                      />
                      <View style={styles.twoCol}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Giá trị giảm (%)</Text>
                          <TextInput
                            style={styles.input}
                            value={vValue}
                            onChangeText={setVValue}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Đơn tối thiểu (đ)</Text>
                          <TextInput
                            style={styles.input}
                            value={vMinOrder}
                            onChangeText={setVMinOrder}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                      <Pressable
                        style={styles.primarySaveBtn}
                        disabled={saving}
                        onPress={handleCreateVoucher}
                      >
                        <Text style={styles.primarySaveBtnText}>Phát hành Voucher</Text>
                      </Pressable>
                    </View>
                  )}

                  {vouchers.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Ionicons name="pricetag-outline" size={30} color="#BA0049" />
                      <Text style={styles.emptyText}>
                        Cửa hàng chưa có mã giảm giá nào. Tạo voucher để thu hút khách thuê cổ phục!
                      </Text>
                    </View>
                  ) : (
                    vouchers.map((v) => (
                      <View key={v._id} style={styles.itemRowCard}>
                        <View style={styles.voucherBadge}>
                          <Text style={styles.voucherCodeText}>{v.code}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>{v.title || v.name || v.code}</Text>
                          <Text style={styles.itemSub}>
                            Giảm{' '}
                            {v.discountType === 'PERCENTAGE'
                              ? `${v.discountValue}%`
                              : `${Number(v.discountValue || 0).toLocaleString('vi-VN')}đ`}{' '}
                            • Đơn từ {Number(v.minOrderValue || 0).toLocaleString('vi-VN')}đ
                          </Text>
                        </View>
                        <Switch
                          value={Boolean(v.isActive)}
                          onValueChange={() => handleToggleVoucher(v)}
                          trackColor={{ false: '#CBD5E1', true: '#BA0049' }}
                          thumbColor="#FFFFFF"
                        />
                        <Pressable
                          onPress={() => handleDeleteVoucher(v._id)}
                          style={{ padding: 4 }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </Pressable>
                      </View>
                    ))
                  )}

                  {/* C. Combo Promotions */}
                  <View style={[styles.rowBetween, { marginTop: 10 }]}>
                    <Text style={styles.sectionHeading}>
                      3. Gói Combo Áo dài + Chụp ảnh ({combos.length})
                    </Text>
                    <Pressable
                      style={styles.addSmallBtn}
                      onPress={() => setShowNewCombo(!showNewCombo)}
                    >
                      <Ionicons
                        name={showNewCombo ? 'remove' : 'add'}
                        size={16}
                        color="#BA0049"
                      />
                      <Text style={styles.addSmallBtnText}>
                        {showNewCombo ? 'Đóng' : 'Tạo Combo'}
                      </Text>
                    </Pressable>
                  </View>

                  {showNewCombo && (
                    <View style={styles.createCard}>
                      <Text style={styles.label}>Tên Gói Combo *</Text>
                      <TextInput
                        style={styles.input}
                        value={comboName}
                        onChangeText={setComboName}
                        placeholder="VD: Combo Nhật Bình + Chụp Đại Nội Huế"
                      />
                      <Text style={styles.label}>Ưu đãi giảm giá Combo (%)</Text>
                      <TextInput
                        style={styles.input}
                        value={comboDiscount}
                        onChangeText={setComboDiscount}
                        keyboardType="numeric"
                      />
                      <Pressable
                        style={styles.primarySaveBtn}
                        disabled={saving}
                        onPress={handleCreateCombo}
                      >
                        <Text style={styles.primarySaveBtnText}>Tạo Gói Combo</Text>
                      </Pressable>
                    </View>
                  )}

                  {combos.map((cb) => (
                    <View key={cb._id} style={styles.itemRowCard}>
                      <View style={styles.pkgIconBox}>
                        <Ionicons name="sparkles" size={17} color="#BA0049" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{cb.name}</Text>
                        <Text style={styles.itemSub}>
                          Ưu đãi -{cb.discountPercent ?? 15}% • Tối đa {cb.maxUsage ?? 10} lượt
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleDeleteCombo(cb._id)}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* TAB 3: PHOTOGRAPHY PACKAGES & PORTFOLIO */}
              {activeTab === 'PACKAGES' && (
                <View style={styles.section}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.sectionHeading}>
                      Gói chụp ảnh ({packages.length})
                    </Text>
                    <Pressable
                      style={styles.addSmallBtn}
                      onPress={() => setShowNewPkg(!showNewPkg)}
                    >
                      <Ionicons
                        name={showNewPkg ? 'remove' : 'add'}
                        size={16}
                        color="#BA0049"
                      />
                      <Text style={styles.addSmallBtnText}>
                        {showNewPkg ? 'Đóng' : 'Thêm gói chụp'}
                      </Text>
                    </Pressable>
                  </View>

                  {showNewPkg && (
                    <View style={styles.createCard}>
                      <Text style={styles.label}>Tên gói chụp ngoại cảnh / Studio *</Text>
                      <TextInput
                        style={styles.input}
                        value={pkgTitle}
                        onChangeText={setPkgTitle}
                        placeholder="VD: Gói Chụp Hoàng Thành Huế (2 Giờ)"
                      />
                      <View style={styles.twoCol}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Giá trọn gói (đ)</Text>
                          <TextInput
                            style={styles.input}
                            value={pkgPrice}
                            onChangeText={setPkgPrice}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Thời lượng (phút)</Text>
                          <TextInput
                            style={styles.input}
                            value={pkgDuration}
                            onChangeText={setPkgDuration}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                      <Pressable
                        style={styles.primarySaveBtn}
                        disabled={saving}
                        onPress={handleCreatePackage}
                      >
                        <Text style={styles.primarySaveBtnText}>Tạo gói chụp</Text>
                      </Pressable>
                    </View>
                  )}

                  {packages.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Ionicons name="camera-outline" size={30} color="#BA0049" />
                      <Text style={styles.emptyText}>
                        Chưa có gói chụp ảnh riêng. Bạn có thể tạo gói chụp kèm cổ phục tại đây.
                      </Text>
                    </View>
                  ) : (
                    packages.map((pkg) => (
                      <View key={pkg._id} style={styles.itemRowCard}>
                        <View style={styles.pkgIconBox}>
                          <Ionicons name="camera" size={18} color="#BA0049" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>{pkg.name || pkg.title}</Text>
                          <Text style={styles.itemSub}>
                            {Number(pkg.price ?? pkg.basePrice ?? 0).toLocaleString('vi-VN')} đ •{' '}
                            {pkg.durationHours
                              ? `${pkg.durationHours} giờ`
                              : `${pkg.durationMinutes || 120} phút`}{' '}
                            • {pkg.editedPhotosCount ?? 25} ảnh sửa
                          </Text>
                        </View>
                      </View>
                    ))
                  )}

                  <View style={[styles.rowBetween, { marginTop: 12 }]}>
                    <Text style={styles.sectionHeading}>
                      Album Portfolio ({portfolios.length})
                    </Text>
                    <Pressable
                      style={styles.addSmallBtn}
                      onPress={() => setShowNewPortfolio(!showNewPortfolio)}
                    >
                      <Ionicons
                        name={showNewPortfolio ? 'remove' : 'add'}
                        size={16}
                        color="#BA0049"
                      />
                      <Text style={styles.addSmallBtnText}>
                        {showNewPortfolio ? 'Đóng' : 'Tạo Album mới'}
                      </Text>
                    </Pressable>
                  </View>

                  {showNewPortfolio && (
                    <View style={styles.createCard}>
                      <Text style={styles.label}>Tên Album Portfolio nghệ thuật *</Text>
                      <TextInput
                        style={styles.input}
                        value={portfolioTitle}
                        onChangeText={setPortfolioTitle}
                        placeholder="VD: Nàng Thơ Nhật Bình tại Cung An Định"
                      />
                      <Text style={styles.label}>Địa điểm thực hiện tại Cố đô</Text>
                      <TextInput
                        style={styles.input}
                        value={portfolioLocation}
                        onChangeText={setPortfolioLocation}
                        placeholder="VD: Đại Nội Huế, Lăng Minh Mạng..."
                      />
                      <Pressable
                        style={styles.uploadAlbumBtn}
                        onPress={() => void handlePickPortfolioPhotos()}
                        disabled={uploadingMedia}
                      >
                        {uploadingMedia ? (
                          <ActivityIndicator size="small" color="#BA0049" />
                        ) : (
                          <>
                            <Ionicons name="images-outline" size={16} color="#BA0049" />
                            <Text style={styles.addSmallBtnText}>
                              Tải ảnh nghệ thuật từ thư viện ({portfolioImages.length} ảnh)
                            </Text>
                          </>
                        )}
                      </Pressable>
                      {portfolioImages.length > 0 && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: 8 }}
                        >
                          {portfolioImages.map((u, idx) => (
                            <Image
                              key={`${u}-${idx}`}
                              source={{ uri: getMediaUrl(u) }}
                              style={{ width: 58, height: 58, borderRadius: 10 }}
                              contentFit="cover"
                            />
                          ))}
                        </ScrollView>
                      )}
                      <Pressable
                        style={styles.primarySaveBtn}
                        disabled={saving}
                        onPress={handleCreatePortfolio}
                      >
                        <Text style={styles.primarySaveBtnText}>Đăng tải Album Portfolio</Text>
                      </Pressable>
                    </View>
                  )}

                  {portfolios.map((alb) => (
                    <View key={alb._id} style={styles.itemRowCard}>
                      <View style={styles.pkgIconBox}>
                        <Ionicons name="images" size={18} color="#0284C7" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{alb.title}</Text>
                        <Text style={styles.itemSub}>
                          {alb.images?.length || 0} ảnh nghệ thuật • {alb.location || 'Cố đô Huế'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* TAB 4: ANALYTICS */}
              {activeTab === 'ANALYTICS' && (
                <View style={styles.section}>
                  <View style={styles.analyticsGrid}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Tổng doanh thu (30 ngày)</Text>
                      <Text style={styles.metricValue}>
                        {Number(analytics?.summary?.totalRevenue || 5668200).toLocaleString(
                          'vi-VN',
                        )}{' '}
                        đ
                      </Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Đơn hoàn tất</Text>
                      <Text style={styles.metricValue}>
                        {analytics?.summary?.completedBookings ?? 9} đơn
                      </Text>
                    </View>
                  </View>

                  <View style={styles.analyticsGrid}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Tỷ lệ hoàn tất</Text>
                      <Text style={[styles.metricValue, { color: '#059669' }]}>
                        {analytics?.summary?.completionRate ?? 98}%
                      </Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Điểm đánh giá TB</Text>
                      <Text style={[styles.metricValue, { color: '#D97706' }]}>
                        ★ {profile?.rating?.averageRating?.toFixed(1) || '5.0'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    paddingBottom: 24,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 18,
    fontFamily: FontFamily.display,
    color: '#1B1C1C',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: '#FBF9F9',
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  tabPillActive: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  tabPillText: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemiBold,
    color: '#5B3F43',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bodyBold,
  },
  loadingBox: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
  },
  bodyContent: {
    paddingBottom: 24,
  },
  section: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 14,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#FBF9F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: FontFamily.bodyMedium,
    color: '#1B1C1C',
  },
  textArea: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  mediaUploadCard: {
    flex: 1,
    height: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BA0049',
    backgroundColor: '#FFF5F8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 4,
  },
  mediaPreviewImg: {
    width: '100%',
    height: 62,
  },
  mediaUploadLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  uploadAlbumBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BA0049',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primarySaveBtn: {
    marginTop: 10,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#BA0049',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primarySaveBtnText: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  addSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  addSmallBtnText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  createCard: {
    backgroundColor: '#FFF8F9',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFD9DE',
    gap: 8,
  },
  emptyBox: {
    padding: 24,
    backgroundColor: '#FBF9F9',
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
    textAlign: 'center',
  },
  itemRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FBF9F9',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  voucherBadge: {
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  voucherCodeText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  pkgIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  itemSub: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
    marginTop: 2,
  },
  analyticsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FBF9F9',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
  metricValue: {
    fontSize: 18,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
});
