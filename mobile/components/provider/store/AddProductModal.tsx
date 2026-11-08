import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { providerApi } from '@/apis/providerApi';
import { useToast } from '@/contexts/ToastContext';
import { getMediaUrl } from '@/utils/media';

interface AddProductModalProps {
  visible: boolean;
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
  onClose,
  onCreated,
}: AddProductModalProps) {
  const { show } = useToast();
  const [name, setName] = useState('');
  const [style, setStyle] = useState(PRESET_STYLES[0]);
  const [color, setColor] = useState('Đỏ Chu Sa');
  const [material, setMaterial] = useState(ALL_MATERIALS[0]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['S', 'M', 'L']);
  const [basePrice, setBasePrice] = useState('850000');
  const [depositAmount, setDepositAmount] = useState('300000');
  const [initialQty, setInitialQty] = useState('2');
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      assets.forEach((asset, idx) => {
        formData.append(
          'images',
          (asset.file ?? {
            uri: asset.uri,
            name: asset.fileName ?? `garment_${Date.now()}_${idx}.jpg`,
            type: asset.mimeType ?? 'image/jpeg',
          }) as unknown as Blob,
        );
      });
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

  const handleCreate = async () => {
    if (!name.trim()) {
      show('Vui lòng nhập tên mẫu áo dài', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const categories = await providerApi.getCategories().catch(() => []);
      const firstCategoryId =
        Array.isArray(categories) && categories.length > 0
          ? categories[0]._id || categories[0].id
          : undefined;

      const finalImages =
        images.length > 0
          ? images
          : [
              'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80',
            ];

      const sizesToCreate = selectedSizes.length > 0 ? selectedSizes : ['S', 'M', 'L'];

      const created = await providerApi.createProduct({
        name: name.trim(),
        categoryId: firstCategoryId,
        style,
        basePrice: Number(basePrice) || 500000,
        depositAmount: Number(depositAmount) || 200000,
        sizes: sizesToCreate,
        colors: [color.trim() || 'Đỏ'],
        materials: [material],
        images: finalImages,
        description: `${name.trim()} - Bộ sưu tập ${style} chất liệu ${material} tại TàGo Atelier.`,
      });

      const qty = Math.max(1, parseInt(initialQty, 10) || 2);
      if (created?._id) {
        await Promise.allSettled(
          sizesToCreate.map((sz) =>
            providerApi.adjustVariantQuantity({
              productId: created._id,
              size: sz,
              color: color.trim() || 'Đỏ',
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
        err?.response?.data?.message || 'Không thể tạo mẫu áo mới';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handleBar} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconWrap}>
                <MaterialIcons name="add-business" size={19} color="#BA0049" />
              </View>
              <View>
                <Text style={styles.title}>Thêm Mẫu Áo Dài Mới</Text>
                <Text style={styles.subtitle}>
                  Tải ảnh thực tế & cấp mã SKU / chip RFID tự động
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

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Số lượng mỗi Size</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={initialQty}
                  onChangeText={setInitialQty}
                />
              </View>
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
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={() => void handleCreate()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Lưu & Cấp Chip RFID</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
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
