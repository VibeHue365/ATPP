import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { providerApi } from '@/apis/providerApi';
import { TagoAlert } from '@/components/ui/TagoAlertModal';
import { useToast } from '@/contexts/ToastContext';
import { getMediaUrl } from '@/utils/media';
import type { EnrichedInventoryProduct } from './InventoryProductMatrixCard';

interface RfidChipDetailModalProps {
  visible: boolean;
  product: EnrichedInventoryProduct | null;
  onClose: () => void;
  onUpdated: () => void;
}

const EXTRA_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export function RfidChipDetailModal({
  visible,
  product,
  onClose,
  onUpdated,
}: RfidChipDetailModalProps) {
  const { show } = useToast();
  const [chips, setChips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [adjustingSize, setAdjustingSize] = useState<string | null>(null);

  // Edit Product / Price History / Delete state
  const [showEditForm, setShowEditForm] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBasePrice, setEditBasePrice] = useState('');
  const [editDeposit, setEditDeposit] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);

  // New Variant Form state
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [newVariantSize, setNewVariantSize] = useState('XL');
  const [newVariantColor, setNewVariantColor] = useState('');
  const [newVariantQty, setNewVariantQty] = useState('2');
  const [addingVariant, setAddingVariant] = useState(false);

  const loadChips = useCallback(async () => {
    if (!product?._id) return;
    setLoading(true);
    try {
      const res = await providerApi.getInventoryItems({
        productId: product._id,
        limit: 100,
      });
      if (res && Array.isArray(res.items)) {
        setChips(
          res.items.filter((i: any) => i.conditionStatus !== 'RETIRED'),
        );
      } else {
        setChips([]);
      }
    } catch {
      setChips([]);
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (visible && product) {
      setEditName(product.name || '');
      setEditBasePrice(String(product.basePrice || 850000));
      setEditDeposit(String(product.depositAmount || 300000));
      setEditImages(
        Array.isArray(product.rawProduct?.images)
          ? product.rawProduct.images
          : product.imageUrl
            ? [product.imageUrl]
            : [],
      );
      setNewVariantColor(
        product.rawProduct?.colors?.[0] || product.colorLabel || 'Đỏ Chu Sa',
      );
      setShowEditForm(false);
      setShowAddVariant(false);
      void loadChips();
      providerApi
        .getProductPriceHistory(product._id)
        .then((res) => {
          const items = res?.items || res || [];
          setPriceHistory(Array.isArray(items) ? items : []);
        })
        .catch(() => setPriceHistory([]));
    }
  }, [visible, product, loadChips]);

  if (!product) return null;

  const handlePickProductImage = async () => {
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
    if (result.canceled || !result.assets?.length) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      result.assets.forEach((asset, idx) => {
        formData.append(
          'images',
          (asset.file ?? {
            uri: asset.uri,
            name: asset.fileName ?? `edit_garment_${idx}.jpg`,
            type: asset.mimeType ?? 'image/jpeg',
          }) as unknown as Blob,
        );
      });
      const res = await providerApi.uploadImages(formData);
      if (res?.urls?.length) {
        setEditImages((prev) => [...prev, ...res.urls]);
        show(`Đã tải thêm ${res.urls.length} ảnh mẫu áo!`, 'success');
      }
    } catch {
      show('Không thể tải ảnh lên, vui lòng thử lại', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProductEdit = async () => {
    if (!editName.trim()) {
      show('Vui lòng nhập tên mẫu áo', 'error');
      return;
    }
    setSavingProduct(true);
    try {
      await providerApi.updateProduct(product._id, {
        name: editName.trim(),
        basePrice: Number(editBasePrice) || product.basePrice,
        depositAmount: Number(editDeposit) || product.depositAmount,
        images: editImages.length > 0 ? editImages : undefined,
      });
      show('Đã cập nhật thông tin, hình ảnh & giá thuê mẫu áo!', 'success');
      setShowEditForm(false);
      onUpdated();
    } catch (e: any) {
      show(e?.response?.data?.message || 'Lỗi khi cập nhật sản phẩm', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleAddNewVariant = async () => {
    const cleanColor =
      newVariantColor.trim() ||
      product.rawProduct?.colors?.[0] ||
      product.colorLabel ||
      'Đỏ';
    const qty = Math.max(1, parseInt(newVariantQty, 10) || 1);
    const rawMaterial = product.rawProduct?.materials?.[0] || 'Gấm Tơ Tằm';

    setAddingVariant(true);
    try {
      const existingSizes: string[] = Array.isArray(product.rawProduct?.sizes)
        ? product.rawProduct.sizes
        : ['S', 'M', 'L'];
      const existingColors: string[] = Array.isArray(product.rawProduct?.colors)
        ? product.rawProduct.colors
        : [cleanColor];

      const mergedSizes = existingSizes.includes(newVariantSize)
        ? existingSizes
        : [...existingSizes, newVariantSize];
      const mergedColors = existingColors.includes(cleanColor)
        ? existingColors
        : [...existingColors, cleanColor];

      await providerApi.updateProduct(product._id, {
        sizes: mergedSizes,
        colors: mergedColors,
      });

      await providerApi.adjustVariantQuantity({
        productId: product._id,
        size: newVariantSize,
        color: cleanColor,
        material: rawMaterial,
        quantity: qty,
      });

      show(
        `Đã cấp ${qty} chip RFID cho biến thể Size ${newVariantSize} (${cleanColor})!`,
        'success',
      );
      setShowAddVariant(false);
      await loadChips();
      onUpdated();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || 'Không thể thêm biến thể mới';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setAddingVariant(false);
    }
  };

  const handleDeleteProduct = () => {
    TagoAlert.alert(
      'Xóa mẫu cổ phục khỏi kho?',
      `Bạn có chắc chắn muốn xóa mẫu "${product.name}" khỏi danh sách cho thuê?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa mẫu áo',
          style: 'destructive',
          onPress: async () => {
            try {
              await providerApi.deleteProduct(product._id);
              show('Đã xóa mẫu cổ phục thành công!', 'success');
              onClose();
              onUpdated();
            } catch (e: any) {
              show(
                e?.response?.data?.message || 'Không thể xóa mẫu đang có đơn thuê',
                'error',
              );
            }
          },
        },
      ],
    );
  };

  const handleToggleChipStatus = async (chip: any) => {
    if (!chip._id || chip.status === 'RENTED') {
      show('Chip đang được khách thuê, không thể chuyển trạng thái', 'info');
      return;
    }
    const nextStatus =
      chip.status === 'MAINTENANCE' || chip.status === 'CLEANING'
        ? 'AVAILABLE'
        : 'MAINTENANCE';

    setUpdatingId(chip._id);
    try {
      await providerApi.updateInventoryItem(chip._id, { status: nextStatus });
      show(
        nextStatus === 'AVAILABLE'
          ? `Đã chuyển chip ${chip.sku} sang Sẵn sàng`
          : `Đã chuyển chip ${chip.sku} sang Bảo dưỡng/Giặt ủi`,
        'success',
      );
      await loadChips();
      onUpdated();
    } catch {
      show('Không thể cập nhật trạng thái chip', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAdjustSizeQuantity = async (
    size: string,
    currentTotal: number,
    delta: number,
  ) => {
    const nextQty = Math.max(0, currentTotal + delta);
    if (nextQty === currentTotal) return;

    const rawColor =
      product.rawProduct?.colors?.[0] || product.colorLabel || 'Đỏ';
    const rawMaterial = product.rawProduct?.materials?.[0] || null;

    setAdjustingSize(size);
    try {
      await providerApi.adjustVariantQuantity({
        productId: product._id,
        size,
        color: rawColor,
        material: rawMaterial,
        quantity: nextQty,
      });
      show(`Đã cập nhật tồn kho Size ${size}: ${nextQty} chiếc`, 'success');
      await loadChips();
      onUpdated();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        'Không thể điều chỉnh số lượng biến thể';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setAdjustingSize(null);
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
        <Pressable style={styles.backdropFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.nfcBadge}>
                <MaterialIcons name="nfc" size={18} color="#BA0049" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={styles.sheetSub}>
                  {product.code} • {product.rackLocation} • {product.totalChips}{' '}
                  chip RFID
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
            showsVerticalScrollIndicator={false}
          >
            {/* Section 0: Edit Product Info / Price / Photos / Delete */}
            <View style={styles.sectionBox}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>
                  THÔNG TIN & GIÁ THUÊ ({product.basePrice.toLocaleString('vi-VN')} đ/ngày)
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={() => setShowEditForm(!showEditForm)}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#BA0049' }}>
                      {showEditForm ? 'Đóng sửa' : 'Sửa mẫu / Ảnh'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={handleDeleteProduct}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#EF4444' }}>
                      Xóa mẫu
                    </Text>
                  </Pressable>
                </View>
              </View>

              {showEditForm && (
                <View style={styles.editFormBox}>
                  <Text style={styles.formFieldLabel}>Hình ảnh mẫu áo</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable
                      style={styles.addPhotoBtn}
                      onPress={() => void handlePickProductImage()}
                      disabled={uploadingPhoto}
                    >
                      {uploadingPhoto ? (
                        <ActivityIndicator size="small" color="#BA0049" />
                      ) : (
                        <>
                          <Ionicons name="camera-outline" size={16} color="#BA0049" />
                          <Text style={styles.addPhotoBtnText}>Thêm ảnh</Text>
                        </>
                      )}
                    </Pressable>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {editImages.map((u, idx) => (
                        <View key={`${u}-${idx}`} style={styles.photoThumbWrap}>
                          <Image
                            source={{ uri: getMediaUrl(u) }}
                            style={styles.photoThumb}
                            contentFit="cover"
                          />
                          <Pressable
                            style={styles.photoRemoveBtn}
                            onPress={() =>
                              setEditImages((prev) => prev.filter((_, i) => i !== idx))
                            }
                          >
                            <Ionicons name="close-circle" size={16} color="#EF4444" />
                          </Pressable>
                        </View>
                      ))}
                    </ScrollView>
                  </View>

                  <Text style={styles.formFieldLabel}>Tên mẫu cổ phục</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editName}
                    onChangeText={setEditName}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formFieldLabel}>Giá thuê / ngày (đ)</Text>
                      <TextInput
                        style={[styles.formInput, { marginTop: 4 }]}
                        value={editBasePrice}
                        onChangeText={setEditBasePrice}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formFieldLabel}>Tiền cọc Escrow (đ)</Text>
                      <TextInput
                        style={[styles.formInput, { marginTop: 4 }]}
                        value={editDeposit}
                        onChangeText={setEditDeposit}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <Pressable
                    style={styles.saveEditBtn}
                    disabled={savingProduct}
                    onPress={() => void handleSaveProductEdit()}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: 'Inter_700Bold' }}>
                      {savingProduct ? 'Đang lưu...' : 'Lưu cập nhật giá, ảnh & thông tin'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {priceHistory.length > 0 && (
                <Text style={{ fontSize: 11, color: '#64748B', fontFamily: 'Inter_400Regular' }}>
                  Lịch sử đổi giá gần nhất: {priceHistory.length} lần cập nhật
                </Text>
              )}
            </View>

            {/* Section 1: Size Quantity Adjuster + Add New Variant */}
            <View style={styles.sectionBox}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>
                  ĐIỀU CHỈNH TỒN KHO THEO SIZE ({product.colorLabel})
                </Text>
                <Pressable onPress={() => setShowAddVariant(!showAddVariant)}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: '#BA0049' }}>
                    {showAddVariant ? 'Đóng' : '+ Thêm Size / Màu'}
                  </Text>
                </Pressable>
              </View>

              {showAddVariant && (
                <View style={styles.editFormBox}>
                  <Text style={styles.formFieldLabel}>Chọn Size cần bổ sung</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {EXTRA_SIZES.map((sz) => (
                      <Pressable
                        key={sz}
                        onPress={() => setNewVariantSize(sz)}
                        style={[
                          styles.sizePill,
                          newVariantSize === sz && styles.sizePillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sizePillText,
                            newVariantSize === sz && styles.sizePillTextActive,
                          ]}
                        >
                          Size {sz}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formFieldLabel}>Màu sắc biến thể</Text>
                      <TextInput
                        style={[styles.formInput, { marginTop: 4 }]}
                        value={newVariantColor}
                        onChangeText={setNewVariantColor}
                        placeholder="VD: Đỏ Chu Sa"
                      />
                    </View>
                    <View style={{ width: 96 }}>
                      <Text style={styles.formFieldLabel}>Số lượng</Text>
                      <TextInput
                        style={[styles.formInput, { marginTop: 4 }]}
                        value={newVariantQty}
                        onChangeText={setNewVariantQty}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <Pressable
                    style={styles.saveEditBtn}
                    disabled={addingVariant}
                    onPress={() => void handleAddNewVariant()}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: 'Inter_700Bold' }}>
                      {addingVariant
                        ? 'Đang khởi tạo chip...'
                        : `Cấp mới ${newVariantQty} chip Size ${newVariantSize}`}
                    </Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.sizeAdjustList}>
                {product.sizeMatrix.map((cell) => {
                  const isBusy = adjustingSize === cell.size;
                  return (
                    <View key={cell.size} style={styles.sizeAdjustRow}>
                      <View>
                        <Text style={styles.sizeRowTitle}>Size {cell.size}</Text>
                        <Text style={styles.sizeRowMeta}>
                          {cell.available} sẵn sàng • {cell.rented} đang thuê •{' '}
                          {cell.maintenance} bảo dưỡng
                        </Text>
                      </View>

                      <View style={styles.stepperWrap}>
                        <Pressable
                          style={[
                            styles.stepBtn,
                            (cell.total <= cell.rented || isBusy) &&
                              styles.stepBtnDisabled,
                          ]}
                          disabled={cell.total <= cell.rented || isBusy}
                          onPress={() =>
                            void handleAdjustSizeQuantity(
                              cell.size,
                              cell.total,
                              -1,
                            )
                          }
                        >
                          <Ionicons name="remove" size={16} color="#1B1C1C" />
                        </Pressable>

                        <View style={styles.qtyValueWrap}>
                          {isBusy ? (
                            <ActivityIndicator size="small" color="#BA0049" />
                          ) : (
                            <Text style={styles.qtyValueText}>{cell.total}</Text>
                          )}
                        </View>

                        <Pressable
                          style={[styles.stepBtn, isBusy && styles.stepBtnDisabled]}
                          disabled={isBusy}
                          onPress={() =>
                            void handleAdjustSizeQuantity(
                              cell.size,
                              cell.total,
                              1,
                            )
                          }
                        >
                          <Ionicons name="add" size={16} color="#BA0049" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Section 2: Individual RFID Chips */}
            <View style={styles.sectionBox}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>
                  DANH SÁCH CHIP RFID ĐỊNH DANH ({chips.length})
                </Text>
                <Text style={styles.sectionHint}>Chạm để đổi trạng thái</Text>
              </View>

              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color="#BA0049" />
                  <Text style={styles.loadingText}>
                    Đang đọc dữ liệu chip RFID...
                  </Text>
                </View>
              ) : chips.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>
                    Chưa có chip RFID nào cho mẫu áo này. Hãy bấm dấu (+) ở trên
                    để khởi tạo chip tự động.
                  </Text>
                </View>
              ) : (
                <View style={styles.chipList}>
                  {chips.map((chip) => {
                    const isMaint =
                      chip.status === 'MAINTENANCE' ||
                      chip.status === 'CLEANING' ||
                      chip.conditionStatus === 'LOCKED';
                    const isRented = chip.status === 'RENTED';
                    const isUpdating = updatingId === chip._id;

                    return (
                      <Pressable
                        key={chip._id || chip.sku}
                        style={[
                          styles.chipRow,
                          isMaint && styles.chipRowMaint,
                          isRented && styles.chipRowRented,
                        ]}
                        onPress={() => void handleToggleChipStatus(chip)}
                        disabled={isUpdating}
                      >
                        <View style={styles.chipLeft}>
                          <MaterialIcons
                            name="memory"
                            size={16}
                            color={
                              isRented
                                ? '#B45309'
                                : isMaint
                                  ? '#7E22CE'
                                  : '#047857'
                            }
                          />
                          <View>
                            <Text style={styles.chipSku}>{chip.sku}</Text>
                            <Text style={styles.chipVariant}>
                              Size {chip.size} • {chip.color}
                            </Text>
                          </View>
                        </View>

                        {isUpdating ? (
                          <ActivityIndicator size="small" color="#BA0049" />
                        ) : (
                          <View
                            style={[
                              styles.chipStatusPill,
                              isRented
                                ? styles.pillRented
                                : isMaint
                                  ? styles.pillMaint
                                  : styles.pillAvail,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipStatusText,
                                isRented
                                  ? styles.textRented
                                  : isMaint
                                    ? styles.textMaint
                                    : styles.textAvail,
                              ]}
                            >
                              {isRented
                                ? 'Đang thuê'
                                : isMaint
                                  ? 'Bảo dưỡng / Giặt'
                                  : 'Sẵn sàng'}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Hoàn tất kiểm tra</Text>
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
  backdropFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
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
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  nfcBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(186, 0, 73, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
  },
  sheetSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
    marginTop: 2,
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
    gap: 16,
  },
  sectionBox: {
    backgroundColor: '#FBF9F9',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9E8E7',
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#BA0049',
    letterSpacing: 0.4,
  },
  sectionHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
  },
  editFormBox: {
    backgroundColor: '#FFF8F9',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFD9DE',
  },
  formFieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#1B1C1C',
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1B1C1C',
  },
  saveEditBtn: {
    backgroundColor: '#BA0049',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addPhotoBtn: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BA0049',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoBtnText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#BA0049',
  },
  photoThumbWrap: {
    width: 60,
    height: 60,
    borderRadius: 10,
    position: 'relative',
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
  },
  sizePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sizePillActive: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  sizePillText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#1B1C1C',
  },
  sizePillTextActive: {
    color: '#FFFFFF',
  },
  sizeAdjustList: {
    gap: 8,
  },
  sizeAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9E8E7',
  },
  sizeRowTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
  },
  sizeRowMeta: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F5F3F3',
    borderWidth: 1,
    borderColor: '#E3E2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  qtyValueWrap: {
    minWidth: 28,
    alignItems: 'center',
  },
  qtyValueText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
  },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
  },
  emptyWrap: {
    paddingVertical: 14,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
    textAlign: 'center',
  },
  chipList: {
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9E8E7',
  },
  chipRowMaint: {
    borderColor: 'rgba(168, 85, 247, 0.3)',
    backgroundColor: 'rgba(250, 245, 255, 0.6)',
  },
  chipRowRented: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(255, 251, 235, 0.6)',
  },
  chipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipSku: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#1B1C1C',
  },
  chipVariant: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#5B3F43',
  },
  chipStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  pillAvail: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
  },
  pillMaint: {
    backgroundColor: 'rgba(168, 85, 247, 0.14)',
  },
  pillRented: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  chipStatusText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  textAvail: {
    color: '#047857',
  },
  textMaint: {
    color: '#7E22CE',
  },
  textRented: {
    color: '#B45309',
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  doneBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
});
