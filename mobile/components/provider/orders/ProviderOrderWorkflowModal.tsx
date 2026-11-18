import React, { useState, useEffect } from 'react';
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
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { providerApi } from '@/apis/providerApi';
import { useNotifications } from '@/contexts/NotificationContext';
import { useToast } from '@/contexts/ToastContext';
import { FontFamily } from '@/constants/theme';
import { getMediaUrl } from '@/utils/media';
import { getItemSkuOrCode, getRentalItems, hasPickupEvidence } from '@/utils/rentalState';

export type ProviderWorkflowMode =
  | 'HANDOVER'
  | 'DELIVER_PHOTOS'
  | 'REPORT_INCIDENT'
  | 'CANCEL_ORDER'
  | null;

interface UploadedPhotoEntry {
  value: string;
  previewUri: string;
}

interface ProviderOrderWorkflowModalProps {
  visible: boolean;
  mode: ProviderWorkflowMode;
  order: any | null;
  targetItemId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProviderOrderWorkflowModal({
  visible,
  mode,
  order,
  targetItemId,
  onClose,
  onSuccess,
}: ProviderOrderWorkflowModalProps) {
  const { show } = useToast();
  const { bumpBookingSync } = useNotifications();

  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Handover / Deliver Photos / Incident uploaded media
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhotoEntry[]>([]);
  const [driveUrl, setDriveUrl] = useState('');

  // Cancel / Incident / Handover note state
  const [reasonText, setReasonText] = useState('');
  const [incidentType, setIncidentType] = useState<'CLEANING' | 'MAINTENANCE'>('CLEANING');
  const [requestedAmount, setRequestedAmount] = useState('150000');
  const [selectedItemId, setSelectedItemId] = useState('');

  useEffect(() => {
    if (visible && order) {
      setUploadedPhotos([]);
      setDriveUrl(order.deliveryDriveUrl || '');
      setReasonText('');
      setIncidentType('CLEANING');
      const rentalItems = getRentalItems(order, true);
      const preferredItem =
        (targetItemId ? rentalItems.find((it) => it._id === targetItemId) : null) ||
        (mode === 'HANDOVER'
          ? rentalItems.find(
              (it) =>
                it.rentalFulfillment?.status === 'READY_FOR_PICKUP' &&
                !hasPickupEvidence(it, order),
            )
          : mode === 'REPORT_INCIDENT'
            ? rentalItems.find((it) => it.rentalFulfillment?.status === 'RETURNED')
            : null) ||
        rentalItems[0] ||
        order.items?.[0];

      setSelectedItemId(preferredItem?._id || (preferredItem as any)?.id || '');
      const dep =
        order.pricingSummary?.depositTotal ||
        order.depositAmount ||
        preferredItem?.depositAmount ||
        300000;
      setRequestedAmount(String(Math.min(150000, dep || 150000)));
    }
  }, [visible, order, mode, targetItemId]);

  if (!order || !mode) return null;

  const rentalItems = getRentalItems(order, true);
  const selectableItems =
    mode === 'HANDOVER'
      ? rentalItems.filter(
          (it) =>
            it.rentalFulfillment?.status === 'READY_FOR_PICKUP' &&
            !hasPickupEvidence(it, order),
        )
      : mode === 'REPORT_INCIDENT'
        ? rentalItems.filter((it) =>
            ['PICKED_UP', 'CUSTOMER_RETURN_REQUESTED', 'RETURNED'].includes(
              String(it.rentalFulfillment?.status || ''),
            ),
          )
        : [];
  const itemOptions = selectableItems.length > 0 ? selectableItems : rentalItems;

  const orderCode =
    order.bookingCode ||
    (order._id ? `#${order._id.slice(-6).toUpperCase()}` : '#BK');
  const maxDeposit =
    order.pricingSummary?.depositTotal ||
    order.depositAmount ||
    rentalItems.reduce((sum, it) => sum + (it.depositAmount ?? 0) * (it.quantity ?? 1), 0) ||
    500000;

  const uploadSelectedAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!assets?.length) return;
    setUploadingPhoto(true);
    try {
      if (mode === 'HANDOVER') {
        if (!selectedItemId) {
          show('Không tìm thấy áo dài cần bàn giao', 'error');
          return;
        }
        const remainingSlots = Math.max(0, 5 - uploadedPhotos.length);
        const targetAssets = assets.slice(0, remainingSlots);
        if (!targetAssets.length) {
          show('Tối đa 5 ảnh bàn giao cho mỗi áo dài', 'error');
          return;
        }
        const formData = new FormData();
        targetAssets.forEach((asset, i) => {
          formData.append(
            'images',
            (asset.file ?? {
              uri: asset.uri,
              name: asset.fileName ?? `handover_${i}.jpg`,
              type: asset.mimeType ?? 'image/jpeg',
            }) as unknown as Blob,
          );
        });
        const res = await providerApi.uploadRentalEvidence(
          order._id,
          selectedItemId,
          formData,
        );
        const files = Array.isArray(res?.files) ? res.files : [];
        if (files.length > 0) {
          setUploadedPhotos((prev) =>
            [
              ...prev,
              ...files.map((f, idx) => ({
                value: f.fileId,
                previewUri: targetAssets[idx]?.uri || targetAssets[0].uri,
              })),
            ].slice(0, 5),
          );
          show(`Đã tải lên ${files.length} ảnh bàn giao hiện trạng`, 'success');
        }
      } else if (mode === 'REPORT_INCIDENT') {
        const formData = new FormData();
        assets.slice(0, 5).forEach((asset, i) => {
          formData.append(
            'images',
            (asset.file ?? {
              uri: asset.uri,
              name: asset.fileName ?? `incident_${i}.jpg`,
              type: asset.mimeType ?? 'image/jpeg',
            }) as unknown as Blob,
          );
        });
        const res = await providerApi.uploadIncidentEvidence(formData);
        if (res?.urls?.length) {
          setUploadedPhotos((prev) => [
            ...prev,
            ...(res.urls || []).map((u, idx) => ({
              value: u,
              previewUri: assets[idx]?.uri || getMediaUrl(u) || u,
            })),
          ]);
          show(`Đã tải lên ${res.urls.length} ảnh bằng chứng sự cố`, 'success');
        }
      } else {
        const nextEntries: UploadedPhotoEntry[] = [];
        for (let i = 0; i < assets.length; i++) {
          const asset = assets[i];
          const formData = new FormData();
          formData.append(
            'file',
            (asset.file ?? {
              uri: asset.uri,
              name: asset.fileName ?? `deliver_${i}.jpg`,
              type: asset.mimeType ?? 'image/jpeg',
            }) as unknown as Blob,
          );
          const res = await providerApi.uploadReference(formData);
          if (res?.url) {
            nextEntries.push({
              value: res.url,
              previewUri: getMediaUrl(res.url) || asset.uri,
            });
          }
        }
        if (nextEntries.length > 0) {
          setUploadedPhotos((prev) => [...prev, ...nextEntries]);
          show(`Đã tải lên ${nextEntries.length} ảnh thành công`, 'success');
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Tải ảnh thất bại, vui lòng thử lại';
      show(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Pick & Upload photo from library
  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      show('Vui lòng cấp quyền truy cập thư viện ảnh', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;
    await uploadSelectedAssets(result.assets);
  };

  // Take photo with live camera
  const handleTakeCameraPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      show('Vui lòng cấp quyền máy ảnh để chụp bằng chứng', 'error');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    await uploadSelectedAssets(result.assets);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (mode === 'HANDOVER') {
        if (!selectedItemId) {
          show('Không tìm thấy sản phẩm thuê để gửi ảnh bàn giao', 'error');
          setSubmitting(false);
          return;
        }
        if (uploadedPhotos.length === 0) {
          show('Vui lòng tải lên ít nhất 1 ảnh chụp tình trạng áo lúc bàn giao!', 'error');
          setSubmitting(false);
          return;
        }
        await providerApi.markPickedUp(order._id, selectedItemId, {
          fileIds: uploadedPhotos.map((p) => p.value),
          conditionNote: reasonText.trim() || undefined,
          note:
            reasonText.trim() ||
            'Shop đã chụp ảnh hiện trạng bàn giao, chờ khách kiểm tra và xác nhận nhận áo.',
        });
        bumpBookingSync(order._id);
        show(
          `Đã gửi ảnh bàn giao đơn ${orderCode}! Chờ khách hàng xác nhận nhận đồ.`,
          'success',
        );
        onSuccess();
      } else if (mode === 'DELIVER_PHOTOS') {
        const cleanDrive = driveUrl.trim();
        if (!cleanDrive && uploadedPhotos.length === 0) {
          show('Vui lòng nhập Link Google Drive hoặc tải lên ảnh kết quả!', 'error');
          setSubmitting(false);
          return;
        }
        if (cleanDrive && !/^https?:\/\//i.test(cleanDrive)) {
          show('Link Drive phải bắt đầu bằng http:// hoặc https://', 'error');
          setSubmitting(false);
          return;
        }
        await providerApi.updateBookingStatus(order._id, 'AWAITING_REVIEW', {
          deliveryDriveUrl: cleanDrive || undefined,
          deliveredPhotos:
            uploadedPhotos.length > 0 ? uploadedPhotos.map((p) => p.value) : undefined,
        });
        bumpBookingSync(order._id);
        show('Đã bàn giao sản phẩm ảnh cho khách hàng thành công!', 'success');
        onSuccess();
      } else if (mode === 'CANCEL_ORDER') {
        if (!reasonText.trim()) {
          show('Vui lòng nhập lý do hủy / từ chối đơn để báo cho khách!', 'error');
          setSubmitting(false);
          return;
        }
        await providerApi.cancelBooking(order._id, {
          reason: reasonText.trim(),
        });
        bumpBookingSync(order._id);
        show('Đã hủy đơn hàng và gửi thông báo lý do cho khách.', 'success');
        onSuccess();
      } else if (mode === 'REPORT_INCIDENT') {
        if (!selectedItemId) {
          show('Không tìm thấy sản phẩm trong đơn để báo sự cố', 'error');
          setSubmitting(false);
          return;
        }
        if (!reasonText.trim()) {
          show('Vui lòng nhập mô tả tình trạng hư hỏng / vết bẩn!', 'error');
          setSubmitting(false);
          return;
        }
        if (uploadedPhotos.length === 0) {
          show('Bắt buộc phải có ít nhất 1 hình ảnh bằng chứng sự cố!', 'error');
          setSubmitting(false);
          return;
        }
        const amt = Number(requestedAmount.replace(/[^0-9]/g, '') || 0);
        if (amt <= 0 || amt > maxDeposit) {
          show(
            `Số tiền đền bù phải từ 1đ đến tối đa ${maxDeposit.toLocaleString('vi-VN')}đ`,
            'error',
          );
          setSubmitting(false);
          return;
        }

        await providerApi.reportIncident({
          bookingId: order._id,
          bookingItemId: selectedItemId,
          description: reasonText.trim(),
          evidencePhotos: uploadedPhotos.map((p) => p.value),
          requestedAmount: amt,
          actionType: incidentType,
        });
        bumpBookingSync(order._id);
        show(
          'Đã gửi báo cáo sự cố thành công! Đơn chuyển sang chờ khách xác nhận đền bù.',
          'success',
        );
        onSuccess();
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể thực hiện thao tác, vui lòng thử lại';
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
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>QUY TRÌNH CHUẨN TÀGO • {orderCode}</Text>
              <Text style={styles.title}>
                {mode === 'HANDOVER'
                  ? 'Bàn giao trang phục cho khách'
                  : mode === 'DELIVER_PHOTOS'
                    ? 'Bàn giao sản phẩm buổi chụp'
                    : mode === 'REPORT_INCIDENT'
                      ? 'Báo cáo sự cố & Khấu trừ cọc'
                      : 'Từ chối / Hủy đơn đặt'}
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#1B1C1C" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
          >
            {/* MODE 1: HANDOVER */}
            {mode === 'HANDOVER' && (
              <>
                <View style={styles.infoBanner}>
                  <Ionicons name="shield-checkmark" size={18} color="#BA0049" />
                  <Text style={styles.infoBannerText}>
                    Chủ tiệm tải tối đa 5 ảnh hiện trạng cổ phục lúc giao (lưu trữ bảo mật) để khách kiểm tra và xác nhận đã nhận đồ.
                  </Text>
                </View>

                {itemOptions.length > 1 && (
                  <View style={styles.itemSelectRow}>
                    <Text style={styles.fieldLabel}>Chọn áo dài cần bàn giao</Text>
                    {itemOptions.map((it: any) => {
                      const active = selectedItemId === it._id;
                      return (
                        <Pressable
                          key={it._id}
                          onPress={() => {
                            if (selectedItemId !== it._id) {
                              setSelectedItemId(it._id);
                              setUploadedPhotos([]);
                            }
                          }}
                          style={[
                            styles.itemSelectPill,
                            active && styles.itemSelectPillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.itemSelectPillText,
                              active && { color: '#BA0049', fontFamily: FontFamily.bodyBold },
                            ]}
                            numberOfLines={1}
                          >
                            {it.name || it.productId?.name || 'Áo dài'} ({getItemSkuOrCode(it) || 'Món'})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <View style={styles.uploadBox}>
                  <Pressable
                    style={styles.uploadDropzone}
                    onPress={handlePickPhoto}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color="#BA0049" />
                    ) : (
                      <>
                        <Ionicons name="images-outline" size={28} color="#BA0049" />
                        <Text style={styles.uploadTitle}>
                          Chọn ảnh hiện trạng từ thư viện
                        </Text>
                        <Text style={styles.uploadSub}>
                          Chụp rõ cổ áo, tà áo và phụ kiện đi kèm (JPG/PNG/WEBP)
                        </Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    style={[styles.quickRefBtn, { backgroundColor: '#FFF0F3' }]}
                    onPress={() => void handleTakeCameraPhoto()}
                    disabled={uploadingPhoto}
                  >
                    <Ionicons name="camera" size={16} color="#BA0049" />
                    <Text style={[styles.quickRefBtnText, { color: '#BA0049' }]}>
                      Chụp ảnh trực tiếp bằng Camera
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>Ghi chú hiện trạng bàn giao (tùy chọn)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 68, textAlignVertical: 'top', paddingTop: 10 }]}
                  multiline
                  value={reasonText}
                  onChangeText={setReasonText}
                  placeholder="VD: Áo mới ủi phẳng, đủ khăn đóng đi kèm..."
                />
              </>
            )}

            {/* MODE 2: DELIVER_PHOTOS */}
            {mode === 'DELIVER_PHOTOS' && (
              <>
                <Text style={styles.fieldLabel}>
                  🔗 Link Kho Ảnh Gốc (Google Drive / Cloud)
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://drive.google.com/drive/folders/..."
                  placeholderTextColor="#9CA3AF"
                  value={driveUrl}
                  onChangeText={setDriveUrl}
                  autoCapitalize="none"
                />
                <Text style={styles.helperHint}>
                  Lưu ý: Bật quyền "Người có liên kết có thể xem" cho thư mục Drive.
                </Text>

                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>
                  📸 Hoặc tải lên ảnh kết quả xem trước
                </Text>
                <Pressable
                  style={styles.uploadDropzone}
                  onPress={handlePickPhoto}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color="#BA0049" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={26} color="#BA0049" />
                      <Text style={styles.uploadTitle}>Tải lên ảnh kết quả</Text>
                      <Text style={styles.uploadSub}>Hỗ trợ nhiều ảnh JPG, PNG, WEBP</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}

            {/* MODE 3: REPORT_INCIDENT */}
            {mode === 'REPORT_INCIDENT' && (
              <>
                {itemOptions.length > 1 && (
                  <View style={styles.itemSelectRow}>
                    <Text style={styles.fieldLabel}>Chọn áo dài phát sinh sự cố</Text>
                    {itemOptions.map((it: any) => {
                      const active = selectedItemId === it._id;
                      return (
                        <Pressable
                          key={it._id}
                          onPress={() => setSelectedItemId(it._id)}
                          style={[
                            styles.itemSelectPill,
                            active && styles.itemSelectPillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.itemSelectPillText,
                              active && { color: '#BA0049', fontFamily: FontFamily.bodyBold },
                            ]}
                            numberOfLines={1}
                          >
                            {it.name || it.productId?.name || 'Áo dài'} ({getItemSkuOrCode(it) || 'Món'})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <Text style={styles.fieldLabel}>Hình thức xử lý sự cố</Text>
                <View style={styles.typeToggleRow}>
                  <Pressable
                    style={[
                      styles.typeToggleBtn,
                      incidentType === 'CLEANING' && styles.typeToggleBtnActive,
                    ]}
                    onPress={() => setIncidentType('CLEANING')}
                  >
                    <Text
                      style={[
                        styles.typeToggleText,
                        incidentType === 'CLEANING' && styles.typeToggleTextActive,
                      ]}
                    >
                      Giặt tẩy vết bẩn
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.typeToggleBtn,
                      incidentType === 'MAINTENANCE' && styles.typeToggleBtnActive,
                    ]}
                    onPress={() => setIncidentType('MAINTENANCE')}
                  >
                    <Text
                      style={[
                        styles.typeToggleText,
                        incidentType === 'MAINTENANCE' && styles.typeToggleTextActive,
                      ]}
                    >
                      Sửa chữa rách / hỏng
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>
                  Số tiền yêu cầu khấu trừ từ cọc (Tối đa {maxDeposit.toLocaleString('vi-VN')}đ)
                </Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={requestedAmount}
                  onChangeText={setRequestedAmount}
                  placeholder="Nhập số tiền đền bù (VNĐ)"
                />

                <Text style={styles.fieldLabel}>Mô tả chi tiết tình trạng (Bắt buộc)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  multiline
                  value={reasonText}
                  onChangeText={setReasonText}
                  placeholder="VD: Vạt áo trước bị dính vết cà phê, thiếu 1 quạt thêu..."
                />

                <Text style={styles.fieldLabel}>Ảnh bằng chứng sự cố (Bắt buộc)</Text>
                <Pressable
                  style={styles.uploadDropzone}
                  onPress={handlePickPhoto}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color="#BA0049" />
                  ) : (
                    <>
                      <Ionicons name="images-outline" size={26} color="#BA0049" />
                      <Text style={styles.uploadTitle}>Chọn ảnh bằng chứng hư hỏng</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.quickRefBtn, { backgroundColor: '#FFF0F3' }]}
                  onPress={() => void handleTakeCameraPhoto()}
                  disabled={uploadingPhoto}
                >
                  <Ionicons name="camera" size={16} color="#BA0049" />
                  <Text style={[styles.quickRefBtnText, { color: '#BA0049' }]}>
                    Chụp bằng chứng bằng Camera
                  </Text>
                </Pressable>
              </>
            )}

            {/* MODE 4: CANCEL_ORDER */}
            {mode === 'CANCEL_ORDER' && (
              <>
                <View style={styles.infoBanner}>
                  <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                  <Text style={styles.infoBannerText}>
                    Vui lòng nhập lý do từ chối hoặc hủy đơn. Lý do này sẽ được gửi thông báo trực tiếp đến khách hàng và hoàn trả tiền cọc.
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Lý do hủy / từ chối đơn (Bắt buộc)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  multiline
                  value={reasonText}
                  onChangeText={setReasonText}
                  placeholder="VD: Cửa hàng kín lịch vào khung giờ này / Cổ phục đang bảo dưỡng..."
                />
              </>
            )}

            {/* Preview Uploaded Photos */}
            {uploadedPhotos.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewLabel}>
                  Đã đính kèm ({uploadedPhotos.length} ảnh):
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.previewRow}
                >
                  {uploadedPhotos.map((entry, idx) => (
                    <View key={`${entry.value}-${idx}`} style={styles.previewThumbWrap}>
                      <Image
                        source={{ uri: entry.previewUri }}
                        style={styles.previewThumb}
                        contentFit="cover"
                      />
                      <Pressable
                        style={styles.removeThumbBtn}
                        onPress={() =>
                          setUploadedPhotos((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        <Ionicons name="close-circle" size={18} color="#DC2626" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>Quay lại</Text>
            </Pressable>

            <Pressable
              style={[
                styles.submitBtn,
                mode === 'CANCEL_ORDER' && styles.submitBtnDanger,
              ]}
              onPress={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === 'HANDOVER'
                    ? 'Xác nhận Bàn giao'
                    : mode === 'DELIVER_PHOTOS'
                      ? 'Gửi ảnh cho khách'
                      : mode === 'REPORT_INCIDENT'
                        ? 'Gửi báo cáo sự cố'
                        : 'Xác nhận Hủy đơn'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(27, 28, 28, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '88%',
    paddingBottom: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECEB',
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 17,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
    marginTop: 2,
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
    padding: 18,
    gap: 12,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
    borderRadius: 14,
    padding: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#1B1C1C',
    lineHeight: 18,
  },
  uploadBox: {
    gap: 8,
  },
  uploadDropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FFD9DE',
    backgroundColor: '#FFF9FA',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  uploadTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
    marginTop: 4,
  },
  uploadSub: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
  },
  quickRefBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F5F3F3',
  },
  quickRefBtnText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemiBold,
    color: '#5F5E5E',
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  input: {
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    fontFamily: FontFamily.bodyMedium,
    color: '#1B1C1C',
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  helperHint: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    alignItems: 'center',
  },
  typeToggleBtnActive: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  typeToggleText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#5F5E5E',
  },
  typeToggleTextActive: {
    color: '#FFFFFF',
  },
  previewSection: {
    gap: 6,
    marginTop: 4,
  },
  previewLabel: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#059669',
  },
  previewRow: {
    gap: 10,
    paddingVertical: 4,
  },
  previewThumbWrap: {
    width: 68,
    height: 68,
    borderRadius: 12,
    position: 'relative',
  },
  previewThumb: {
    width: 68,
    height: 68,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  removeThumbBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFECEB',
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFECEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#5F5E5E',
  },
  submitBtn: {
    flex: 1.6,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDanger: {
    backgroundColor: '#DC2626',
  },
  submitBtnText: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  itemSelectRow: {
    gap: 6,
  },
  itemSelectPill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
  },
  itemSelectPillActive: {
    backgroundColor: '#FFF0F3',
    borderColor: '#BA0049',
  },
  itemSelectPillText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
});
