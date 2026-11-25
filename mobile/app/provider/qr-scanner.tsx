import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { providerApi } from '@/apis/providerApi';
import { useToast } from '@/contexts/ToastContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { FontFamily } from '@/constants/theme';
import { TagoAlert } from '@/components/ui/TagoAlertModal';
import { getRentalItems, resolveBookingDisplayState } from '@/utils/rentalState';

type ScanTab = 'ORDER' | 'RFID';

const INVENTORY_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Sẵn sàng',
  RESERVED: 'Đã giữ lịch',
  RENTED: 'Đang cho thuê',
  CLEANING: 'Đang giặt ủi',
  MAINTENANCE: 'Đang bảo trì',
  DAMAGED: 'Hư hỏng',
  RETIRED: 'Ngừng sử dụng',
};

const getInventoryStatusLabel = (status?: string | null): string => {
  const key = String(status || '').toUpperCase();
  return INVENTORY_STATUS_LABELS[key] ?? 'Đang cập nhật';
};

export default function ProviderQrScannerScreen() {
  const { show } = useToast();
  const { bumpBookingSync } = useNotifications();
  const [scanTab, setScanTab] = useState<ScanTab>('ORDER');
  const [manualCode, setManualCode] = useState('');
  const [bookings, setBookings] = useState<any[]>([]);
  const [rfidChips, setRfidChips] = useState<any[]>([]);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [bookingRes, chipRes] = await Promise.all([
          providerApi.getBookings().catch(() => []),
          providerApi.getInventoryItems({ limit: 100 }).catch(() => ({ items: [] })),
        ]);
        if (Array.isArray(bookingRes)) {
          setBookings(
            bookingRes.filter(
              (b) =>
                !['CANCELLED', 'COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(
                  String(b.status || '').toUpperCase(),
                ),
            ),
          );
        }
        if (Array.isArray(chipRes?.items)) {
          setRfidChips(chipRes.items);
        }
      } catch {
        // Ignore
      }
    })();
  }, []);

  const parseQrPayload = (raw: string): string => {
    const trimmed = raw.trim();
    // Handle TAGO_BOOKING:<id>|CODE:<code> format from Customer QR Pass
    if (trimmed.includes('CODE:')) {
      const codePart = trimmed.split('CODE:')[1]?.split('|')[0];
      if (codePart) return codePart.trim();
    }
    if (trimmed.startsWith('TAGO_BOOKING:')) {
      const idPart = trimmed.replace('TAGO_BOOKING:', '').split('|')[0];
      if (idPart) return idPart.trim();
    }
    return trimmed;
  };

  const handleOpenLiveCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      show('Vui lòng cấp quyền máy ảnh để chụp ảnh kiểm chứng tại quầy', 'error');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.75,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setCapturedUri(res.assets[0].uri);
      show(
        scanTab === 'ORDER'
          ? 'Đã chụp ảnh đối chứng! Hãy nhập hoặc chọn đúng mã đơn bên dưới để xử lý.'
          : 'Đã chụp ảnh hiện vật! Hãy nhập hoặc chọn đúng mã SKU chip RFID bên dưới.',
        'info',
      );
    }
  };

  const openOrderInTab = (bookingId: string) => {
    router.replace({
      pathname: '/provider/(tabs)/orders',
      params: { bookingId },
    } as any);
  };

  const handleProcessCode = (rawInput: string) => {
    const parsed = parseQrPayload(rawInput);
    const clean = parsed.replace(/^#/, '').toUpperCase();
    if (!clean) {
      show('Vui lòng nhập mã Vé QR đơn hàng hoặc mã SKU Chip RFID', 'error');
      return;
    }

    // 1. Check if it matches an RFID Chip first
    const matchedChip = rfidChips.find(
      (c) => (c.sku || '').toUpperCase() === clean || (c._id || '').toUpperCase() === clean,
    );

    if (
      matchedChip &&
      (scanTab === 'RFID' ||
        !bookings.some((b) => (b.bookingCode || '').toUpperCase().includes(clean)))
    ) {
      TagoAlert.alert(
        'Quét Tag Chip RFID Hiện vật',
        `Mã SKU: ${matchedChip.sku}\nBiến thể: Size ${matchedChip.size} • ${matchedChip.color}\nTrạng thái hiện tại: ${getInventoryStatusLabel(matchedChip.status)}`,
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: 'Chuyển sang Sẵn sàng',
            onPress: async () => {
              setProcessing(true);
              try {
                await providerApi.updateInventoryItem(matchedChip._id, {
                  status: 'AVAILABLE',
                });
                bumpBookingSync();
                show(`Chip ${matchedChip.sku} đã chuyển sang Sẵn sàng!`, 'success');
                router.back();
              } catch {
                show('Không thể cập nhật chip RFID', 'error');
              } finally {
                setProcessing(false);
              }
            },
          },
          {
            text: 'Đưa vào Giặt ủi / Bảo dưỡng',
            onPress: async () => {
              setProcessing(true);
              try {
                await providerApi.updateInventoryItem(matchedChip._id, {
                  status: 'MAINTENANCE',
                });
                bumpBookingSync();
                show(`Chip ${matchedChip.sku} đã chuyển sang Bảo dưỡng!`, 'success');
                router.back();
              } catch {
                show('Không thể cập nhật chip RFID', 'error');
              } finally {
                setProcessing(false);
              }
            },
          },
        ],
      );
      return;
    }

    // 2. Match Active Order
    const matchedOrder = bookings.find((b) => {
      const bCode = (b.bookingCode || '').replace(/^#/, '').toUpperCase();
      const fullId = (b._id || '').toUpperCase();
      const shortId = b._id ? b._id.slice(-6).toUpperCase() : '';
      return (
        bCode === clean ||
        shortId === clean ||
        fullId === clean ||
        bCode.includes(clean)
      );
    });

    if (!matchedOrder) {
      TagoAlert.alert(
        'Không tìm thấy đơn hàng',
        `Không tìm thấy đơn đang hoạt động hoặc chip RFID khớp với mã #${clean}. Bạn có thể kiểm tra lại danh sách trong tab Đơn hàng.`,
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: 'Mở danh sách đơn',
            onPress: () => router.replace('/provider/(tabs)/orders' as any),
          },
        ],
      );
      return;
    }

    const custName =
      matchedOrder?.customerId?.profile?.fullName ||
      matchedOrder?.contactInfo?.fullName ||
      'Khách hàng';
    const display = resolveBookingDisplayState(matchedOrder, 'provider');
    const stage = display.stage;
    const rentalItems = getRentalItems(matchedOrder, true);
    const firstRental = rentalItems[0];

    const buttons: Array<{
      text: string;
      style?: 'default' | 'cancel' | 'destructive';
      onPress?: () => void;
    }> = [{ text: 'Đóng', style: 'cancel' }];

    if (stage === 'DEPOSIT_PAID') {
      buttons.push({
        text: 'Xác nhận đơn & Chuẩn bị đồ',
        onPress: async () => {
          setProcessing(true);
          try {
            await providerApi.updateBookingStatus(
              matchedOrder._id,
              'CONFIRMED',
              'Quét QR xác nhận chuẩn bị đơn',
            );
            bumpBookingSync(matchedOrder._id);
            show(`Đã xác nhận đơn #${matchedOrder.bookingCode || clean}!`, 'success');
            openOrderInTab(matchedOrder._id);
          } catch (e: any) {
            show(e?.response?.data?.message || 'Không thể xác nhận đơn', 'error');
          } finally {
            setProcessing(false);
          }
        },
      });
    } else if (stage === 'PREPARING' && firstRental?._id) {
      buttons.push({
        text: 'Xác nhận đã soạn xong áo',
        onPress: async () => {
          setProcessing(true);
          try {
            const targets = rentalItems.filter(
              (it) => !it.rentalFulfillment?.status || it.rentalFulfillment.status === 'PENDING',
            );
            for (const it of targets.length ? targets : [firstRental]) {
              await providerApi.markRentalReady(matchedOrder._id, it._id);
            }
            bumpBookingSync(matchedOrder._id);
            show('Đã soạn xong áo! Hãy tải ảnh hiện trạng khi bàn giao.', 'success');
            openOrderInTab(matchedOrder._id);
          } catch (e: any) {
            show(e?.response?.data?.message || 'Không thể chuyển trạng thái soạn đồ', 'error');
          } finally {
            setProcessing(false);
          }
        },
      });
    } else if (stage === 'READY_NEEDS_HANDOVER_PHOTOS') {
      buttons.push({
        text: 'Chụp & Tải ảnh bàn giao áo',
        onPress: () => openOrderInTab(matchedOrder._id),
      });
    } else if (stage === 'CUSTOMER_RETURN_REQUESTED' && firstRental?._id) {
      buttons.push({
        text: 'Xác nhận đã nhận lại áo',
        onPress: async () => {
          setProcessing(true);
          try {
            const targets = rentalItems.filter(
              (it) => it.rentalFulfillment?.status === 'CUSTOMER_RETURN_REQUESTED',
            );
            for (const it of targets.length ? targets : [firstRental]) {
              await providerApi.markReturned(matchedOrder._id, it._id, {
                note: 'Quét QR nhận trả đồ tại cửa hàng',
              });
            }
            bumpBookingSync(matchedOrder._id);
            show('Đã nhận lại áo! Chuyển sang kiểm tra & hoàn cọc Escrow.', 'success');
            openOrderInTab(matchedOrder._id);
          } catch (e: any) {
            show(e?.response?.data?.message || 'Không thể xác nhận nhận trả áo', 'error');
          } finally {
            setProcessing(false);
          }
        },
      });
    } else if (stage === 'RETURNED_NEEDS_INSPECTION' && firstRental?._id) {
      buttons.push({
        text: 'Áo nguyên vẹn & Hoàn cọc Escrow',
        onPress: async () => {
          setProcessing(true);
          try {
            const targets = rentalItems.filter(
              (it) => it.rentalFulfillment?.status === 'RETURNED',
            );
            for (const it of targets.length ? targets : [firstRental]) {
              await providerApi.confirmNoIncident(
                matchedOrder._id,
                it._id,
                'Quét QR kiểm nhận nguyên vẹn & giải ngân hoàn cọc',
              );
            }
            bumpBookingSync(matchedOrder._id);
            show(
              `Đã hoàn cọc Escrow đơn #${matchedOrder.bookingCode || clean}!`,
              'success',
            );
            openOrderInTab(matchedOrder._id);
          } catch (e: any) {
            show(e?.response?.data?.message || 'Không thể xác nhận hoàn cọc', 'error');
          } finally {
            setProcessing(false);
          }
        },
      });
    } else if (stage === 'CLEANING_AFTER_REFUND' && firstRental?._id) {
      buttons.push({
        text: 'Hoàn tất giặt ủi & Mở kho',
        onPress: async () => {
          setProcessing(true);
          try {
            const targets = rentalItems.filter(
              (it) => it.rentalFulfillment?.status === 'RETURNED',
            );
            for (const it of targets.length ? targets : [firstRental]) {
              await providerApi.markCleaningCompleted(matchedOrder._id, it._id);
            }
            bumpBookingSync(matchedOrder._id);
            show('Đã hoàn tất giặt ủi & mở khóa kho!', 'success');
            router.back();
          } catch (e: any) {
            show(e?.response?.data?.message || 'Không thể hoàn tất giặt ủi', 'error');
          } finally {
            setProcessing(false);
          }
        },
      });
    } else {
      buttons.push({
        text: 'Mở chi tiết đơn',
        onPress: () => openOrderInTab(matchedOrder._id),
      });
    }

    TagoAlert.alert(
      'Xác thực Vé Điện Tử TàGo',
      `Đơn #${matchedOrder.bookingCode || clean} · ${custName}\nTrạng thái: ${display.label}${display.nextStepText ? `\n${display.nextStepText}` : ''}`,
      buttons,
    );
  };

  const quickItems = useMemo(() => {
    if (scanTab === 'ORDER') {
      return bookings.slice(0, 5).map((b) => {
        const display = resolveBookingDisplayState(b, 'provider');
        const custName =
          b.customerId?.profile?.fullName ||
          b.contactInfo?.fullName ||
          'Khách đặt lịch';
        return {
          id: b._id,
          code: b.bookingCode || (b._id ? b._id.slice(-6).toUpperCase() : 'BK'),
          sub: `${custName} • ${display.shortLabel}`,
        };
      });
    }
    return rfidChips.slice(0, 6).map((c) => ({
      id: c._id || c.sku,
      code: c.sku,
      sub: `Size ${c.size} • ${c.color}`,
    }));
  }, [scanTab, bookings, rfidChips]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.eyebrow}>TÀGO SMART SCANNER</Text>
          <Text style={styles.headerTitle}>Quét Vé QR & Chip RFID</Text>
        </View>
        <Pressable style={styles.cameraBtn} onPress={() => void handleOpenLiveCamera()}>
          <Ionicons name="camera" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Mode Switcher */}
      <View style={styles.modeSwitchRow}>
        <Pressable
          onPress={() => setScanTab('ORDER')}
          style={[styles.modePill, scanTab === 'ORDER' && styles.modePillActive]}
        >
          <Ionicons
            name="qr-code-outline"
            size={15}
            color={scanTab === 'ORDER' ? '#FFFFFF' : '#CBD5E1'}
          />
          <Text style={[styles.modePillText, scanTab === 'ORDER' && styles.modePillTextActive]}>
            Vé QR Đơn hàng ({bookings.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setScanTab('RFID')}
          style={[styles.modePill, scanTab === 'RFID' && styles.modePillActive]}
        >
          <MaterialIcons
            name="nfc"
            size={16}
            color={scanTab === 'RFID' ? '#FFFFFF' : '#CBD5E1'}
          />
          <Text style={[styles.modePillText, scanTab === 'RFID' && styles.modePillTextActive]}>
            Chip RFID Kho ({rfidChips.length})
          </Text>
        </Pressable>
      </View>

      {/* Camera Viewfinder Frame */}
      <View style={styles.viewfinderContainer}>
        <Pressable
          style={styles.viewfinderBox}
          onPress={() => void handleOpenLiveCamera()}
        >
          {capturedUri ? (
            <Image
              source={{ uri: capturedUri }}
              style={styles.capturedPreview}
              contentFit="cover"
            />
          ) : null}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />

          <MaterialIcons
            name={scanTab === 'ORDER' ? 'qr-code-scanner' : 'nfc'}
            size={68}
            color="rgba(255,255,255,0.9)"
          />
          <Text style={styles.scannerHint}>
            {scanTab === 'ORDER'
              ? 'Chạm vào khung ngắm để mở Camera quét Vé Điện Tử TàGo của khách hàng'
              : 'Chạm vào khung ngắm để chụp/quét mã SKU trên Tag Chip RFID của cổ phục'}
          </Text>
          <View style={styles.liveCamBadge}>
            <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
            <Text style={styles.liveCamBadgeText}>Mở Camera Thực Tế</Text>
          </View>
        </Pressable>
      </View>

      {/* Manual Input & Real Active Orders / RFID Quick Select */}
      <View style={styles.inputCard}>
        <Text style={styles.inputTitle}>
          {scanTab === 'ORDER'
            ? 'Nhập mã Vé điện tử hoặc chọn nhanh đơn đang mở'
            : 'Nhập mã SKU Chip RFID hoặc chọn nhanh hiện vật trong kho'}
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={
              scanTab === 'ORDER'
                ? 'Nhập mã đơn (VD: B1090502772...)'
                : 'Nhập mã SKU (VD: AD-NHATBINH-S-01...)'
            }
            placeholderTextColor="#9CA3AF"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="characters"
          />
          <Pressable
            style={styles.submitBtn}
            disabled={processing}
            onPress={() => handleProcessCode(manualCode)}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Xử lý</Text>
            )}
          </Pressable>
        </View>

        {quickItems.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={styles.quickTagsLabel}>
              {scanTab === 'ORDER' ? 'Đơn hàng thực tế tại tiệm:' : 'Chip RFID đang có trong kho:'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickTagsRow}
            >
              {quickItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.quickTag}
                  onPress={() => {
                    setManualCode(item.code);
                    handleProcessCode(item.code);
                  }}
                >
                  <Text style={styles.quickTagText}>#{String(item.code).replace(/^#/, '')}</Text>
                  <Text style={styles.quickTagSub}>{item.sub}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#140F12',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#BA0049',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: FontFamily.bodyBold,
    color: '#F48FB1',
    letterSpacing: 1.4,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  modeSwitchRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 6,
    padding: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 99,
  },
  modePillActive: {
    backgroundColor: '#BA0049',
  },
  modePillText: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemiBold,
    color: '#CBD5E1',
  },
  modePillTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bodyBold,
  },
  viewfinderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  viewfinderBox: {
    width: 268,
    height: 268,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  capturedPreview: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.35,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#BA0049',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scannerHint: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  liveCamBadge: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: '#BA0049',
  },
  liveCamBadgeText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  inputTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
    backgroundColor: '#FBF9F9',
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: FontFamily.bodySemiBold,
    color: '#1B1C1C',
  },
  submitBtn: {
    backgroundColor: '#BA0049',
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
  },
  quickTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickTagsLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#5F5E5E',
  },
  quickTag: {
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  quickTagText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  quickTagSub: {
    fontSize: 10,
    fontFamily: FontFamily.body,
    color: '#6E5B63',
  },
});
