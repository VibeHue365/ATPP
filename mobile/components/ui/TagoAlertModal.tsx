import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, Shadow } from '@/constants/theme';

export interface TagoAlertButton {
  text?: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface TagoAlertOptions {
  eyebrow?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface AlertPayload {
  title: string;
  message?: string;
  buttons?: TagoAlertButton[];
  options?: TagoAlertOptions;
}

type Listener = (payload: AlertPayload | null) => void;

let activeListener: Listener | null = null;

/**
 * Hiển thị hộp thoại xác nhận chuẩn TàGo Heritage Editorial (#BA0049)
 * Thay thế hoàn toàn Alert.alert mặc định của hệ điều hành Android/iOS.
 */
export function tagoAlert(
  title: string,
  message?: string,
  buttons?: TagoAlertButton[],
  options?: TagoAlertOptions,
) {
  if (activeListener) {
    activeListener({ title, message, buttons, options });
  }
}

export const TagoAlert = {
  alert: tagoAlert,
};

function resolveAlertVisual(
  title: string,
  buttons?: TagoAlertButton[],
  options?: TagoAlertOptions,
): {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  badgeBg: string;
  eyebrow: string;
} {
  const lower = title.toLowerCase();
  const hasDestructive = buttons?.some((b) => b.style === 'destructive');

  const resolved = (() => {
    if (lower.includes('đăng xuất')) {
      return {
        icon: 'log-out-outline' as const,
        iconColor: '#BA0049',
        badgeBg: '#FFF0F3',
        eyebrow: 'TÀI KHOẢN TÀGO',
      };
    }
    if (lower.includes('hợp đồng')) {
      return {
        icon: 'document-text-outline' as const,
        iconColor: '#DC2626',
        badgeBg: '#FEF2F2',
        eyebrow: 'HỢP ĐỒNG ĐIỆN TỬ',
      };
    }
    if (lower.includes('vị trí') || lower.includes('định vị') || lower.includes('gps')) {
      return {
        icon: 'location-outline' as const,
        iconColor: '#0284C7',
        badgeBg: '#F0F9FF',
        eyebrow: 'ĐỊNH VỊ GPS',
      };
    }
    if (lower.includes('xóa')) {
      return {
        icon: 'trash-outline' as const,
        iconColor: '#DC2626',
        badgeBg: '#FEF2F2',
        eyebrow:
          lower.includes('giỏ hàng') || lower.includes('dịch vụ')
            ? 'GIỎ HÀNG DỊCH VỤ'
            : 'XÁC NHẬN XÓA',
      };
    }
    if (lower.includes('mưa') || lower.includes('đổi điểm')) {
      return {
        icon: 'rainy-outline' as const,
        iconColor: '#0284C7',
        badgeBg: '#F0F9FF',
        eyebrow: 'THỜI TIẾT CỐ ĐÔ',
      };
    }
    if (lower.includes('rút doanh thu') || lower.includes('hoàn cọc')) {
      return {
        icon: 'wallet-outline' as const,
        iconColor: '#059669',
        badgeBg: '#ECFDF5',
        eyebrow: 'VÍ ĐỐI SOÁT ESCROW',
      };
    }
    if (lower.includes('rfid') || lower.includes('chip')) {
      return {
        icon: 'hardware-chip-outline' as const,
        iconColor: '#BA0049',
        badgeBg: '#FFF0F3',
        eyebrow: 'ĐỊNH DANH CHIP RFID',
      };
    }
    if (lower.includes('vé điện tử') || lower.includes('quét')) {
      return {
        icon: 'qr-code-outline' as const,
        iconColor: '#BA0049',
        badgeBg: '#FFF0F3',
        eyebrow: 'TÀGO SMART SCANNER',
      };
    }
    if (lower.includes('báo cáo') || lower.includes('bồi thường') || hasDestructive) {
      return {
        icon: 'shield-checkmark-outline' as const,
        iconColor: '#D97706',
        badgeBg: '#FFFBEB',
        eyebrow: 'BẢO VỆ QUYỀN LỢI TÀGO',
      };
    }
    return {
      icon: 'sparkles' as const,
      iconColor: '#BA0049',
      badgeBg: '#FFF0F3',
      eyebrow: 'XÁC NHẬN THAO TÁC',
    };
  })();

  return {
    ...resolved,
    icon: options?.icon ?? resolved.icon,
    eyebrow: options?.eyebrow ?? resolved.eyebrow,
  };
}

interface TagoAlertCardProps {
  title: string;
  message?: string;
  buttons?: TagoAlertButton[];
  options?: TagoAlertOptions;
  loading?: boolean;
  onPressButton: (btn: TagoAlertButton) => void;
  onBackdropClose: () => void;
}

function TagoAlertDialogContent({
  title,
  message,
  buttons,
  options,
  loading = false,
  onPressButton,
  onBackdropClose,
}: TagoAlertCardProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      damping: 20,
      stiffness: 260,
      mass: 0.7,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [title, message, anim]);

  const resolvedButtons: TagoAlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: 'Đã hiểu', style: 'default' }];

  const visual = resolveAlertVisual(title, resolvedButtons, options);
  const isMultiVertical = resolvedButtons.length > 2;

  const sortedButtons = isMultiVertical
    ? [
        ...resolvedButtons.filter((b) => b.style !== 'cancel'),
        ...resolvedButtons.filter((b) => b.style === 'cancel'),
      ]
    : [
        ...resolvedButtons.filter((b) => b.style === 'cancel'),
        ...resolvedButtons.filter((b) => b.style !== 'cancel'),
      ];

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const cardScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  return (
    <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
      <Pressable
        style={styles.backdropPress}
        disabled={loading}
        onPress={onBackdropClose}
      />

      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        {/* Top Icon & Eyebrow */}
        <View style={styles.topRow}>
          <View style={[styles.iconCircle, { backgroundColor: visual.badgeBg }]}>
            <Ionicons name={visual.icon} size={22} color={visual.iconColor} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>{visual.eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>

        {!!message && (
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>
        )}

        {/* Buttons */}
        {isMultiVertical ? (
          <View style={styles.verticalActions}>
            {sortedButtons.map((btn, idx) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              const isPrimaryAction = !isCancel && (isDestructive || idx === 0);
              return (
                <Pressable
                  key={`${btn.text}-${idx}`}
                  disabled={loading}
                  onPress={() => onPressButton(btn)}
                  style={({ pressed }) => [
                    styles.verticalBtn,
                    isCancel
                      ? styles.btnCancel
                      : isDestructive
                        ? styles.btnDestructive
                        : idx === 0
                          ? styles.btnPrimary
                          : styles.btnSecondaryRose,
                    loading && styles.btnDisabled,
                    pressed && !loading && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                  ]}
                >
                  {loading && isPrimaryAction ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.btnText,
                        isCancel
                          ? styles.btnCancelText
                          : isDestructive || idx === 0
                            ? styles.btnPrimaryText
                            : styles.btnSecondaryRoseText,
                      ]}
                    >
                      {btn.text || 'Xác nhận'}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.horizontalActions}>
            {sortedButtons.map((btn, idx) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <Pressable
                  key={`${btn.text}-${idx}`}
                  disabled={loading}
                  onPress={() => onPressButton(btn)}
                  style={({ pressed }) => [
                    styles.horizontalBtn,
                    isCancel
                      ? styles.btnCancel
                      : isDestructive
                        ? styles.btnDestructive
                        : styles.btnPrimary,
                    loading && styles.btnDisabled,
                    pressed && !loading && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                  ]}
                >
                  {loading && !isCancel ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.btnText,
                        isCancel ? styles.btnCancelText : styles.btnPrimaryText,
                      ]}
                    >
                      {btn.text || 'Xác nhận'}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Hộp thoại xác nhận dùng trực tiếp bên trong một <Modal> đang mở sẵn
 * (tránh lỗi 2 native Modal chồng nhau trên iOS/Android và hỗ trợ spinner loading).
 */
export function TagoConfirmOverlay({
  visible,
  title,
  message,
  buttons,
  options,
  loading = false,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: TagoAlertButton[];
  options?: TagoAlertOptions;
  loading?: boolean;
  onClose: () => void;
}) {
  if (!visible) return null;

  const resolvedButtons: TagoAlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: 'Đã hiểu', style: 'default' }];

  const handlePressButton = (btn: TagoAlertButton) => {
    if (btn.style === 'cancel') {
      onClose();
    }
    if (btn.onPress) {
      void btn.onPress();
    } else if (btn.style !== 'cancel') {
      onClose();
    }
  };

  const handleBackdropClose = () => {
    if (loading) return;
    const cancelBtn = resolvedButtons.find((b) => b.style === 'cancel');
    onClose();
    if (cancelBtn?.onPress) {
      void cancelBtn.onPress();
    }
  };

  return (
    <View style={styles.inlineOverlay} pointerEvents="box-none">
      <TagoAlertDialogContent
        title={title}
        message={message}
        buttons={resolvedButtons}
        options={options}
        loading={loading}
        onPressButton={handlePressButton}
        onBackdropClose={handleBackdropClose}
      />
    </View>
  );
}

export function TagoAlertHost() {
  const [payload, setPayload] = useState<AlertPayload | null>(null);

  useEffect(() => {
    activeListener = (next) => setPayload(next);
    return () => {
      activeListener = null;
    };
  }, []);

  if (!payload) return null;

  const { title, message, buttons, options } = payload;
  const resolvedButtons: TagoAlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: 'Đã hiểu', style: 'default' }];

  const handlePressButton = (btn: TagoAlertButton) => {
    setPayload(null);
    if (btn.onPress) {
      void btn.onPress();
    }
  };

  const handleBackdropClose = () => {
    const cancelBtn = resolvedButtons.find((b) => b.style === 'cancel');
    setPayload(null);
    if (cancelBtn?.onPress) {
      void cancelBtn.onPress();
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleBackdropClose}
    >
      <TagoAlertDialogContent
        title={title}
        message={message}
        buttons={resolvedButtons}
        options={options}
        onPressButton={handlePressButton}
        onBackdropClose={handleBackdropClose}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  inlineOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 14, 17, 0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdropPress: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  card: {
    width: '100%',
    maxWidth: 372,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#F3E3E9',
    gap: 14,
    ...Shadow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 1.1,
    color: '#BA0049',
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 18,
    lineHeight: 24,
    color: '#1E1418',
    marginTop: 2,
  },
  messageBox: {
    backgroundColor: '#FAF7F8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  message: {
    fontFamily: FontFamily.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: '#4F3F46',
  },
  horizontalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  horizontalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  verticalActions: {
    gap: 8,
    marginTop: 4,
  },
  verticalBtn: {
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnCancel: {
    backgroundColor: '#F5F2F3',
  },
  btnPrimary: {
    backgroundColor: '#BA0049',
  },
  btnDestructive: {
    backgroundColor: '#DC2626',
  },
  btnSecondaryRose: {
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
  },
  btnDisabled: {
    opacity: 0.72,
  },
  btnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
  },
  btnCancelText: {
    color: '#5C474F',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
  },
  btnSecondaryRoseText: {
    color: '#BA0049',
  },
});
