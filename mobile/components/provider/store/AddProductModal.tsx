import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { providerApi } from '@/apis/providerApi';
import { useToast } from '@/contexts/ToastContext';
import { prepareImageUploadPart } from '@/utils/imageUpload';
import { getMediaUrl } from '@/utils/media';

interface AddProductModalProps {
  visible: boolean;
  asScreen?: boolean;
  editingProduct?: any | null;
  onClose: () => void;
  onCreated: () => void;
}

const PRESET_STYLES = [
  'Cổ Phục Cố Đô',
  'Áo Nhật Bình',
  'Áo Ngũ Thân',
  'Áo Tấc Nam',
];

const ALL_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const ALL_MATERIALS = ['Gấm Tơ Tằm', 'Lụa Tơ Tằm', 'Nhung The', 'Organza Tơ Óng'];

export function AddProductModal({
  visible,
  asScreen = false,
  editingProduct,
  onClose,
  onCreated,
}: AddProductModalProps) {
  const isEditing = Boolean(editingProduct?._id || editingProduct?.id);
  const { show } = useToast();
  const [name, setName] = useState('');
  const [style, setStyle] = useState(PRESET_STYLES[0]);
  const [color, setColor] = useState('Đỏ Chu Sa');
  const [material, setMaterial] = useState(ALL_MATERIALS[0]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['S', 'M', 'L']);
  const [basePrice, setBasePrice] = useState('500000');
  const [depositAmount, setDepositAmount] = useState('200000');
  const [replacementValue, setReplacementValue] = useState('');
  const [description, setDescription] = useState('');
  const [initialQty, setInitialQty] = useState('2');
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editingProduct) {
      setName(editingProduct.name || '');
      setStyle(editingProduct.style || PRESET_STYLES[0]);
      setColor(
        Array.isArray(editingProduct.colors) && editingProduct.colors[0]
          ? String(editingProduct.colors[0])
          : 'Đỏ Chu Sa',
      );
      setMaterial(
        Array.isArray(editingProduct.materials) && editingProduct.materials[0]
          ? String(editingProduct.materials[0])
          : ALL_MATERIALS[0],
      );
      setSelectedSizes(
        Array.isArray(editingProduct.sizes) && editingProduct.sizes.length > 0
          ? editingProduct.sizes.map(String)
          : ['S', 'M', 'L'],
      );
      setBasePrice(String(editingProduct.basePrice ?? 500000));
      setDepositAmount(String(editingProduct.depositAmount ?? 200000));
      setReplacementValue(
        typeof editingProduct.replacementValue === 'number' &&
          editingProduct.replacementValue > 0
          ? String(editingProduct.replacementValue)
          : '',
      );
      setDescription(editingProduct.description || '');
      setImages(
        Array.isArray(editingProduct.images) ? editingProduct.images : [],
      );
    } else {
      setName('');
      setStyle(PRESET_STYLES[0]);
      setColor('Đỏ Chu Sa');
      setMaterial(ALL_MATERIALS[0]);
      setSelectedSizes(['S', 'M', 'L']);
      setBasePrice('500000');
      setDepositAmount('200000');
      setReplacementValue('');
      setDescription('');
      setInitialQty('2');
      setImages([]);
    }
  }, [visible, editingProduct]);

  const toggleSize = (sz: string) => {
    setSelectedSizes((prev) => {
      if (prev.includes(sz)) {
        return prev.length > 1 ? prev.filter((item) => item !== sz) : prev;
      }
      return [...prev, sz];
    });
  };

  const uploadAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!assets.length) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      for (let idx = 0; idx < assets.length; idx += 1) {
        const part = await prepareImageUploadPart(
          assets[idx],
          `garment_${Date.now()}_${idx}.jpg`,
        );
        formData.append('images', part);
      }
      const res = await providerApi.uploadImages(formData);
      if (res?.urls?.length) {
        setImages((prev) => [...prev, ...res.urls]);
        show(`Đã tải lên ${res.urls.length} ảnh mẫu áo dài!`, 'success');
      }
    } catch {
      try {
        const uploaded: string[] = [];
        for (let i = 0; i < assets.length; i++) {
          const asset = assets[i];
          const fd = new FormData();
          fd.append(
            'file',
            (asset.file ?? {
              uri: asset.uri,
              name: asset.fileName ?? `garment_${i}.jpg`,
              type: asset.mimeType ?? 'image/jpeg',
            }) as unknown as Blob,
          );
          const r = await providerApi.uploadReference(fd);
          if (r?.url) uploaded.push(r.url);
        }
        if (uploaded.length > 0) {
          setImages((prev) => [...prev, ...uploaded]);
          show(`Đã tải lên ${uploaded.length} ảnh mẫu áo dài!`, 'success');
        } else {
          show('Không thể tải ảnh lên máy chủ', 'error');
        }
      } catch {
        show('Không thể tải ảnh lên, vui lòng thử lại', 'error');
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      show('Vui lòng cấp quyền truy cập thư viện ảnh', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      await uploadAssets(result.assets);
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      show('Vui lòng cấp quyền máy ảnh', 'error');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      await uploadAssets(result.assets);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      show('Vui lòng nhập tên mẫu áo dài', 'error');
      return;
    }

    const parsedPrice = Number(basePrice.replace(/[^0-9]/g, ''));
    const parsedDeposit = Number(depositAmount.replace(/[^0-9]/g, '') || '0');

    if (
      !Number.isInteger(parsedPrice) ||
      parsedPrice < 50000 ||
      parsedPrice > 10000000 ||
      parsedPrice % 1000 !== 0
    ) {
      show('Giá thuê/ngày phải từ 50.000đ đến 10.000.000đ (bội số 1.000đ)', 'error');
      return;
    }
    if (
      !Number.isInteger(parsedDeposit) ||
      parsedDeposit < 0 ||
      parsedDeposit > 5000000 ||
      parsedDeposit % 1000 !== 0 ||
      (parsedDeposit > 0 && parsedDeposit < 20000)
    ) {
      show('Tiền cọc phải là 0đ hoặc từ 20.000đ – 5.000.000đ (bội số 1.000đ)', 'error');
      return;
    }
    if (parsedDeposit >= parsedPrice) {
      show('Tiền đặt cọc phải nhỏ hơn giá thuê mỗi ngày', 'error');
      return;
    }

    const cleanReplacementStr = replacementValue.replace(/[^0-9]/g, '');
    const parsedReplacement = cleanReplacementStr
      ? Math.round(Number(cleanReplacementStr))
      : null;

    if (
      replacementValue.trim() &&
      (!parsedReplacement ||
        parsedReplacement < 100000 ||
        parsedReplacement > 50000000 ||
        parsedReplacement < parsedPrice ||
        parsedReplacement < parsedDeposit)
    ) {
      show('Giá trị bồi hoàn phải từ 100.000đ – 50.000.000đ và >= giá thuê & tiền cọc', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const finalImages =
        images.length > 0
          ? images
          : [
              'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80',
            ];
      const sizesToSave = selectedSizes.length > 0 ? selectedSizes : ['S', 'M', 'L'];
      const cleanColor = color.trim() || 'Đỏ';

      if (isEditing) {
        const productId = String(editingProduct._id || editingProduct.id);
        const existingColors = Array.isArray(editingProduct.colors)
          ? editingProduct.colors.slice(1)
          : [];
        const existingMaterials = Array.isArray(editingProduct.materials)
          ? editingProduct.materials.slice(1)
          : [];

        const updatePayload: Record<string, any> = {
          name: name.trim(),
          style,
          basePrice: parsedPrice,
          depositAmount: parsedDeposit,
          sizes: sizesToSave,
          colors: Array.from(new Set([cleanColor, ...existingColors])),
          materials: Array.from(new Set([material, ...existingMaterials])),
          images: finalImages,
          description:
            description.trim() ||
            `${name.trim()} - Bộ sưu tập ${style} chất liệu ${material} tại TàGo Atelier.`,
        };

        if (parsedReplacement !== null && parsedReplacement > 0) {
          updatePayload.replacementValue = parsedReplacement;
        } else if (
          typeof editingProduct.replacementValue === 'number' &&
          editingProduct.replacementValue > 0
        ) {
          updatePayload.replacementValue = null;
        }

        await providerApi.updateProduct(productId, updatePayload);
        show('Đã cập nhật thông tin & giá trị bồi hoàn sản phẩm!', 'success');
        onCreated();
        onClose();
        return;
      }

      const categories = await providerApi.getCategories().catch(() => []);
      const firstCategoryId =
        Array.isArray(categories) && categories.length > 0
          ? categories[0]._id || categories[0].id
          : undefined;

      const createPayload: Record<string, any> = {
        name: name.trim(),
        categoryId: firstCategoryId,
        style,
        basePrice: parsedPrice,
        depositAmount: parsedDeposit,
        sizes: sizesToSave,
        colors: [cleanColor],
        materials: [material],
        images: finalImages,
        description:
          description.trim() ||
          `${name.trim()} - Bộ sưu tập ${style} chất liệu ${material} tại TàGo Atelier.`,
      };
      if (parsedReplacement !== null && parsedReplacement > 0) {
        createPayload.replacementValue = parsedReplacement;
      }

      const created = await providerApi.createProduct(createPayload);

      const qty = Math.max(1, parseInt(initialQty, 10) || 2);
      if (created?._id) {
        await Promise.allSettled(
          sizesToSave.map((sz) =>
            providerApi.adjustVariantQuantity({
              productId: created._id,
              size: sz,
              color: cleanColor,
              material,
              quantity: qty,
            }),
          ),
        );
      }

      show('Đã thêm mẫu áo mới & khởi tạo chip RFID!', 'success');
      setName('');
      setImages([]);
      onCreated();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (isEditing ? 'Không thể cập nhật sản phẩm' : 'Không thể tạo mẫu áo mới');
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <SafeAreaView style={styles.fullScreenRoot} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color="#1B1C1C" />
          </Pressable>
          <View style={styles.headerLeft}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="add-business" size={19} color="#BA0049" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {isEditing ? 'Chỉnh sửa Mẫu Áo Dài' : 'Thêm Mẫu Áo Dài Mới'}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {isEditing
                  ? 'Cập nhật giá thuê, tiền cọc & giá trị bồi hoàn Hợp đồng V2'
                  : 'Tải ảnh thực tế & cấp mã SKU / chip RFID tự động'}
              </Text>
            </View>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#1B1C1C" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Image Picker Section */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Hình ảnh thực tế mẫu Cổ phục / Áo dài</Text>
            <View style={styles.uploadActionRow}>
              <Pressable
                style={styles.uploadBtn}
                onPress={() => void handlePickFromLibrary()}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#BA0049" />
                ) : (
                  <>
                    <Ionicons name="images-outline" size={17} color="#BA0049" />
                    <Text style={styles.uploadBtnText}>Chọn ảnh thư viện</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={styles.uploadBtn}
                onPress={() => void handleTakePhoto()}
                disabled={uploadingImage}
              >
                <Ionicons name="camera-outline" size={17} color="#BA0049" />
                <Text style={styles.uploadBtnText}>Chụp ảnh mới</Text>
              </Pressable>
            </View>

            {images.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0, flexShrink: 0 }}
                contentContainerStyle={styles.thumbRow}
              >
                  {images.map((imgUrl, idx) => (
                    <View key={`${imgUrl}-${idx}`} style={styles.thumbWrap}>
                      <Image
                        source={{ uri: getMediaUrl(imgUrl) }}
                        style={styles.thumbImg}
                        contentFit="cover"
                      />
                      <Pressable
                        style={styles.thumbRemove}
                        onPress={() =>
                          setImages((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        <Ionicons name="close-circle" size={18} color="#DC2626" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Tên mẫu áo dài *</Text>
              <TextInput
                style={styles.input}
                placeholder="VD: Áo Nhật Bình Hoàng Cung Thêu Phượng"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Bộ sưu tập / Dòng cổ phục</Text>
              <View style={styles.styleChips}>
                {PRESET_STYLES.map((st) => (
                  <Pressable
                    key={st}
                    style={[
                      styles.styleChip,
                      style === st && styles.styleChipActive,
                    ]}
                    onPress={() => setStyle(st)}
                  >
                    <Text
                      style={[
                        styles.styleChipText,
                        style === st && styles.styleChipTextActive,
                      ]}
                    >
                      {st}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Chất liệu thủ công</Text>
              <View style={styles.styleChips}>
                {ALL_MATERIALS.map((mat) => (
                  <Pressable
                    key={mat}
                    style={[
                      styles.styleChip,
                      material === mat && styles.styleChipActive,
                    ]}
                    onPress={() => setMaterial(mat)}
                  >
                    <Text
                      style={[
                        styles.styleChipText,
                        material === mat && styles.styleChipTextActive,
                      ]}
                    >
                      {mat}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Kích cỡ khởi tạo Chip RFID</Text>
              <View style={styles.styleChips}>
                {ALL_SIZES.map((sz) => {
                  const active = selectedSizes.includes(sz);
                  return (
                    <Pressable
                      key={sz}
                      style={[styles.styleChip, active && styles.styleChipPrimary]}
                      onPress={() => toggleSize(sz)}
                    >
                      <Text
                        style={[
                          styles.styleChipText,
                          active && styles.styleChipTextActive,
                        ]}
                      >
                        Size {sz}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.row2}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Màu sắc chủ đạo</Text>
                <TextInput
                  style={styles.input}
                  value={color}
                  onChangeText={setColor}
                />
              </View>

              {!isEditing && (
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Số lượng mỗi Size</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={initialQty}
                    onChangeText={setInitialQty}
                  />
                </View>
              )}
            </View>

            <View style={styles.row2}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Giá thuê / ngày (VNĐ)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={basePrice}
                  onChangeText={setBasePrice}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Tiền cọc Escrow (VNĐ)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={depositAmount}
                  onChangeText={setDepositAmount}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Giá trị bồi hoàn trang phục (VNĐ) — Hợp đồng V2
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="VD: 1500000 (không bắt buộc nếu không tính % tài sản)"
                placeholderTextColor="#94A3B8"
                value={replacementValue}
                onChangeText={setReplacementValue}
              />
              <Text style={styles.helperHint}>
                Căn cứ tính tiền bồi thường khi Chính sách chọn "% Giá trị áo".
                Nếu thay đổi giá trị bồi hoàn, sản phẩm sẽ chuyển sang chờ Admin
                kiểm duyệt trên Web.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={() => void handleSave()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons
                    name={isEditing ? 'save' : 'add'}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.submitBtnText}>
                    {isEditing ? 'Lưu thay đổi' : 'Lưu & Cấp Chip RFID'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  if (asScreen) {
    return content;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexShrink: 0,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(186, 0, 73, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
  },
  bodyContent: {
    paddingVertical: 14,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#1B1C1C',
  },
  helperHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#64748B',
    lineHeight: 15,
  },
  uploadActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BA0049',
    backgroundColor: '#FFF5F8',
  },
  uploadBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#BA0049',
  },
  thumbRow: {
    gap: 10,
    paddingTop: 6,
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
    borderWidth: 1,
    borderColor: '#E3E2E2',
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E3E2E2',
    backgroundColor: '#FBF9F9',
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#1B1C1C',
  },
  styleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#E3E2E2',
    backgroundColor: '#FFFFFF',
  },
  styleChipActive: {
    backgroundColor: '#1B1C1C',
    borderColor: '#1B1C1C',
  },
  styleChipPrimary: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  styleChipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#1B1C1C',
  },
  styleChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  row2: {
    flexDirection: 'row',
    gap: 10,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#5B3F43',
  },
  submitBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#BA0049',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  submitBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
});
