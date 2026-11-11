import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { providerApi } from '@/apis/providerApi';
import { useToast } from '@/contexts/ToastContext';
import { FontFamily } from '@/constants/theme';
import { getMediaUrl } from '@/utils/media';

export type PackageComboModalMode = 'PACKAGE' | 'COMBO' | null;

interface PackageAndComboFormModalProps {
  visible: boolean;
  mode: PackageComboModalMode;
  editingItem?: any | null;
  products: any[];
  packages: any[];
  onClose: () => void;
  onSaved: () => void;
}

export function PackageAndComboFormModal({
  visible,
  mode,
  editingItem,
  products,
  packages,
  onClose,
  onSaved,
}: PackageAndComboFormModalProps) {
  const { show } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Photography Package form state
  const [pkgName, setPkgName] = useState('');
  const [pkgDesc, setPkgDesc] = useState('');
  const [pkgPrice, setPkgPrice] = useState('1200000');
  const [pkgDurationHours, setPkgDurationHours] = useState('2');
  const [pkgEditedCount, setPkgEditedCount] = useState('25');
  const [pkgRawCount, setPkgRawCount] = useState('120');
  const [pkgDeliveryDays, setPkgDeliveryDays] = useState('3');
  const [pkgMaxPeople, setPkgMaxPeople] = useState('2');
  const [pkgImages, setPkgImages] = useState<string[]>([]);

  // Combo form state
  const [comboName, setComboName] = useState('');
  const [comboDesc, setComboDesc] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [comboDiscount, setComboDiscount] = useState('20');
  const [comboMaxUsage, setComboMaxUsage] = useState('20');
  const [aoDaiQty, setAoDaiQty] = useState('1');
  const [shootPeople, setShootPeople] = useState('1');

  useEffect(() => {
    if (!visible) return;

    if (mode === 'PACKAGE') {
      if (editingItem) {
        setPkgName(editingItem.name || editingItem.title || '');
        setPkgDesc(editingItem.description || '');
        setPkgPrice(String(editingItem.price ?? editingItem.basePrice ?? 1200000));
        setPkgDurationHours(
          String(
            editingItem.durationHours ??
              Number(((editingItem.durationMinutes || 120) / 60).toFixed(1)),
          ),
        );
        setPkgEditedCount(String(editingItem.editedPhotosCount ?? 25));
        setPkgRawCount(String(editingItem.rawPhotosCount ?? 100));
        setPkgDeliveryDays(String(editingItem.deliveryDays ?? 3));
        setPkgMaxPeople(String(editingItem.maxPeople ?? 2));
        setPkgImages(
          Array.isArray(editingItem.images)
            ? editingItem.images
            : editingItem.coverImage
              ? [editingItem.coverImage]
              : [],
        );
      } else {
        setPkgName('');
        setPkgDesc('Gói chụp ảnh cổ phục ngoại cảnh Đại Nội / Cung An Định');
        setPkgPrice('1200000');
        setPkgDurationHours('2');
        setPkgEditedCount('25');
        setPkgRawCount('120');
        setPkgDeliveryDays('3');
        setPkgMaxPeople('2');
        setPkgImages([]);
      }
    } else if (mode === 'COMBO') {
      if (editingItem) {
        setComboName(editingItem.name || '');
        setComboDesc(editingItem.description || '');
        const pid =
          typeof editingItem.productId === 'object'
            ? editingItem.productId?._id
            : editingItem.productId;
        const pkgId =
          typeof editingItem.photographyPackageId === 'object'
            ? editingItem.photographyPackageId?._id
            : editingItem.photographyPackageId;
        setSelectedProductId(pid || products[0]?._id || '');
        setSelectedPackageId(pkgId || packages[0]?._id || '');
        setComboDiscount(String(editingItem.discountPercent ?? 20));
        setComboMaxUsage(String(editingItem.maxUsage ?? 20));
        setAoDaiQty(String(editingItem.aoDaiQuantity ?? 1));
        setShootPeople(String(editingItem.shootPeopleCount ?? 1));
      } else {
        setComboName('');
        setComboDesc('Trọn gói thuê cổ phục cao cấp + Chụp ảnh ngoại cảnh Cố đô');
        setSelectedProductId(products[0]?._id || '');
        setSelectedPackageId(packages[0]?._id || '');
        setComboDiscount('20');
        setComboMaxUsage('20');
        setAoDaiQty('1');
        setShootPeople('1');
      }
    }
  }, [visible, mode, editingItem, products, packages]);

  const handlePickPackagePhotos = async () => {
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

    setUploadingImage(true);
    try {
      const formData = new FormData();
      res.assets.forEach((asset, idx) => {
        formData.append(
          'images',
          (asset.file ?? {
            uri: asset.uri,
            name: asset.fileName ?? `pkg_sample_${idx}.jpg`,
            type: asset.mimeType ?? 'image/jpeg',
          }) as unknown as Blob,
        );
      });
      const uploaded = await providerApi.uploadImages(formData);
      if (uploaded?.urls?.length) {
        setPkgImages((prev) => [...prev, ...uploaded.urls]);
        show(`Đã tải lên ${uploaded.urls.length} ảnh mẫu gói chụp!`, 'success');
      }
    } catch {
      show('Không thể tải ảnh mẫu gói chụp, vui lòng thử lại', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSavePackage = async () => {
    if (!pkgName.trim()) {
      show('Vui lòng nhập tên gói chụp ảnh', 'error');
      return;
    }
    const priceNum = Number(pkgPrice);
    if (!priceNum || priceNum <= 0) {
      show('Giá gói chụp phải lớn hơn 0', 'error');
      return;
    }

    setSaving(true);
    try {
      const durHours = Math.max(0.5, Number(pkgDurationHours) || 2);
      const payload: Record<string, any> = {
        name: pkgName.trim(),
        description: pkgDesc.trim() || undefined,
        price: priceNum,
        durationHours: durHours,
        includedDurationMinutes: Math.round(durHours * 60),
        editedPhotosCount: Math.max(0, Number(pkgEditedCount) || 25),
        rawPhotosCount: Math.max(0, Number(pkgRawCount) || 100),
        deliveryDays: Math.max(1, Number(pkgDeliveryDays) || 3),
        maxPeople: Math.max(1, Number(pkgMaxPeople) || 2),
      };
      if (pkgImages.length > 0) {
        payload.images = pkgImages;
        payload.coverImage = pkgImages[0];
      }

      if (editingItem?._id) {
        await providerApi.updatePhotographyPackage(editingItem._id, payload);
        show('Đã cập nhật gói chụp ảnh thành công!', 'success');
      } else {
        await providerApi.createPhotographyPackage({
          ...payload,
          status: 'ACTIVE',
        });
        show('Đã thêm gói chụp ảnh mới thành công!', 'success');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Không thể lưu gói chụp ảnh';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCombo = async () => {
    if (!comboName.trim()) {
      show('Vui lòng nhập tên gói Combo', 'error');
      return;
    }
    if (!selectedProductId || !selectedPackageId) {
      show('Vui lòng chọn 1 mẫu Áo dài và 1 Gói chụp ảnh để ghép Combo', 'error');
      return;
    }
    const disc = Number(comboDiscount);
    if (isNaN(disc) || disc < 1 || disc > 80) {
      show('Phần trăm giảm giá Combo phải từ 1% đến 80%', 'error');
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setDate(now.getDate() + 30);

      const payload: Record<string, any> = {
        name: comboName.trim(),
        description: comboDesc.trim() || 'Combo Cổ Phục + Chụp Ảnh Cố Đô',
        discountPercent: disc,
        validFrom: editingItem?.validFrom || now.toISOString(),
        validTo: editingItem?.validTo || nextMonth.toISOString(),
        maxUsage: Math.max(1, Number(comboMaxUsage) || 20),
        aoDaiQuantity: Math.max(1, Number(aoDaiQty) || 1),
        shootPeopleCount: Math.max(1, Number(shootPeople) || 1),
      };

      if (editingItem?._id) {
        await providerApi.updateCombo(editingItem._id, payload);
        show('Đã cập nhật gói Combo thành công!', 'success');
      } else {
        payload.productId = selectedProductId;
        payload.photographyPackageId = selectedPackageId;
        await providerApi.createCombo(payload);
        show('Đã tạo gói Combo ưu đãi mới!', 'success');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Không thể lưu gói Combo';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!mode) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>
                {mode === 'PACKAGE' ? 'DỊCH VỤ NHIẾP ẢNH TÀGO' : 'GÓI COMBO ƯU ĐÃI'}
              </Text>
              <Text style={styles.title}>
                {mode === 'PACKAGE'
                  ? editingItem
                    ? 'Chỉnh sửa Gói chụp ảnh'
                    : 'Thêm Gói chụp ảnh mới'
                  : editingItem
                    ? 'Chỉnh sửa Gói Combo'
                    : 'Ghép Gói Combo mới'}
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#1B1C1C" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {mode === 'PACKAGE' ? (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Ảnh bìa & Ảnh mẫu gói chụp</Text>
                <Pressable
                  style={styles.uploadBtn}
                  onPress={() => void handlePickPackagePhotos()}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="#BA0049" />
                  ) : (
                    <>
                      <Ionicons name="images-outline" size={17} color="#BA0049" />
                      <Text style={styles.uploadBtnText}>
                        Tải ảnh mẫu buổi chụp từ điện thoại
                      </Text>
                    </>
                  )}
                </Pressable>

                {pkgImages.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  >
                    {pkgImages.map((u, idx) => (
                      <View key={`${u}-${idx}`} style={styles.thumbWrap}>
                        <Image
                          source={{ uri: getMediaUrl(u) }}
                          style={styles.thumbImg}
                          contentFit="cover"
                        />
                        <Pressable
                          style={styles.thumbRemove}
                          onPress={() =>
                            setPkgImages((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <Ionicons name="close-circle" size={17} color="#DC2626" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <Text style={styles.label}>Tên gói chụp ảnh *</Text>
                <TextInput
                  style={styles.input}
                  value={pkgName}
                  onChangeText={setPkgName}
                  placeholder="VD: Gói Ngoại Cảnh Hoàng Thành Huế (2 Giờ)"
                />

                <Text style={styles.label}>Mô tả chi tiết gói chụp</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={pkgDesc}
                  onChangeText={setPkgDesc}
                  multiline
                  placeholder="Bao gồm hướng dẫn tạo dáng cổ phục, phụ kiện quạt/nón..."
                />

                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Giá niêm yết (đ) *</Text>
                    <TextInput
                      style={styles.input}
                      value={pkgPrice}
                      onChangeText={setPkgPrice}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Thời lượng (giờ) *</Text>
                    <TextInput
                      style={styles.input}
                      value={pkgDurationHours}
                      onChangeText={setPkgDurationHours}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Số ảnh chỉnh sửa</Text>
                    <TextInput
                      style={styles.input}
                      value={pkgEditedCount}
                      onChangeText={setPkgEditedCount}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Số ảnh gốc trả</Text>
                    <TextInput
                      style={styles.input}
                      value={pkgRawCount}
                      onChangeText={setPkgRawCount}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Hạn trả ảnh (ngày)</Text>
                    <TextInput
                      style={styles.input}
                      value={pkgDeliveryDays}
                      onChangeText={setPkgDeliveryDays}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Số khách tối đa</Text>
                    <TextInput
                      style={styles.input}
                      value={pkgMaxPeople}
                      onChangeText={setPkgMaxPeople}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Pressable
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  disabled={saving}
                  onPress={handleSavePackage}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.saveBtnText}>
                        {editingItem ? 'Lưu cập nhật gói chụp' : 'Tạo gói chụp mới'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Tên gói Combo ưu đãi *</Text>
                <TextInput
                  style={styles.input}
                  value={comboName}
                  onChangeText={setComboName}
                  placeholder="VD: Combo Nhật Bình Cung Đình + Chụp Đại Nội"
                />

                <Text style={styles.label}>Mô tả quyền lợi Combo</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={comboDesc}
                  onChangeText={setComboDesc}
                  multiline
                  placeholder="Mô tả ưu đãi khi đặt trọn gói cổ phục và nhiếp ảnh..."
                />

                {/* Select Product */}
                {!editingItem && (
                  <>
                    <Text style={styles.label}>
                      1. Chọn mẫu Cổ phục Áo dài ghép Combo *
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.selectorRow}
                    >
                      {products.map((p) => {
                        const pid = String(p._id || p.id);
                        const selected = selectedProductId === pid;
                        return (
                          <Pressable
                            key={pid}
                            style={[
                              styles.selectChip,
                              selected && styles.selectChipActive,
                            ]}
                            onPress={() => setSelectedProductId(pid)}
                          >
                            <MaterialIcons
                              name="checkroom"
                              size={14}
                              color={selected ? '#FFFFFF' : '#BA0049'}
                            />
                            <Text
                              style={[
                                styles.selectChipText,
                                selected && styles.selectChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              {p.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    <Text style={styles.label}>
                      2. Chọn Gói chụp ảnh ghép Combo *
                    </Text>
                    {packages.length === 0 ? (
                      <Text style={styles.warningHint}>
                        ⚠️ Tiệm chưa có gói chụp ảnh nào. Hãy qua tab "Gói Chụp" để tạo ít nhất 1 gói chụp trước khi ghép Combo.
                      </Text>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.selectorRow}
                      >
                        {packages.map((pk) => {
                          const pkId = String(pk._id || pk.id);
                          const selected = selectedPackageId === pkId;
                          return (
                            <Pressable
                              key={pkId}
                              style={[
                                styles.selectChip,
                                selected && styles.selectChipActive,
                              ]}
                              onPress={() => setSelectedPackageId(pkId)}
                            >
                              <Ionicons
                                name="camera"
                                size={14}
                                color={selected ? '#FFFFFF' : '#BA0049'}
                              />
                              <Text
                                style={[
                                  styles.selectChipText,
                                  selected && styles.selectChipTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                {pk.name || pk.title}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    )}
                  </>
                )}

                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Giảm giá Combo (%) *</Text>
                    <TextInput
                      style={styles.input}
                      value={comboDiscount}
                      onChangeText={setComboDiscount}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Giới hạn số lượt đặt</Text>
                    <TextInput
                      style={styles.input}
                      value={comboMaxUsage}
                      onChangeText={setComboMaxUsage}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Số lượng áo dài (bộ)</Text>
                    <TextInput
                      style={styles.input}
                      value={aoDaiQty}
                      onChangeText={setAoDaiQty}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Số khách chụp</Text>
                    <TextInput
                      style={styles.input}
                      value={shootPeople}
                      onChangeText={setShootPeople}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Pressable
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  disabled={saving}
                  onPress={handleSaveCombo}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={17} color="#FFFFFF" />
                      <Text style={styles.saveBtnText}>
                        {editingItem ? 'Lưu cập nhật Combo' : 'Phát hành Gói Combo'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
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
  backdropFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
    fontFamily: FontFamily.bodyBold,
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
  body: {
    paddingHorizontal: 20,
  },
  bodyContent: {
    paddingTop: 12,
    paddingBottom: 28,
  },
  formGroup: {
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
    marginTop: 2,
  },
  uploadBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BA0049',
    backgroundColor: '#FFF5F8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  thumbWrap: {
    width: 68,
    height: 68,
    borderRadius: 10,
    position: 'relative',
  },
  thumbImg: {
    width: 68,
    height: 68,
    borderRadius: 10,
  },
  thumbRemove: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
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
    minHeight: 68,
    textAlignVertical: 'top',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  selectorRow: {
    gap: 8,
    paddingVertical: 4,
  },
  selectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 210,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
  },
  selectChipActive: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  selectChipText: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemiBold,
    color: '#BA0049',
  },
  selectChipTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bodyBold,
  },
  warningHint: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#B45309',
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 10,
  },
  saveBtn: {
    marginTop: 10,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#BA0049',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
});
