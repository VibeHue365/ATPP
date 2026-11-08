import React, { useEffect, useState } from 'react';
import {
  Modal,
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

interface AlertPayload {
  title: string;
  message?: string;
  buttons?: TagoAlertButton[];
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
) {
  if (activeListener) {
    activeListener({ title, message, buttons });
  }
}

export const TagoAlert = {
  alert: tagoAlert,
};

function resolveAlertVisual(
  title: string,
  buttons?: TagoAlertButton[],
): {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  badgeBg: string;
  eyebrow: string;
} {
  const lower = title.toLowerCase();
  const hasDestructive = buttons?.some((b) => b.style === 'destructive');

  if (lower.includes('đăng xuất')) {
    return {
      icon: 'log-out-outline',
      iconColor: '#BA0049',
      badgeBg: '#FFF0F3',
      eyebrow: 'TÀI KHOẢN TÀGO',
    };
  }
  if (lower.includes('xóa')) {
    return {
      icon: 'trash-outline',
      iconColor: '#DC2626',
      badgeBg: '#FEF2F2',
      eyebrow: 'XÁC NHẬN XÓA',
    };
  }
  if (lower.includes('mưa') || lower.includes('đổi điểm')) {
    return {
      icon: 'rainy-outline',
      iconColor: '#0284C7',
      badgeBg: '#F0F9FF',
      eyebrow: 'THỜI TIẾT CỐ ĐÔ',
    };
  }
  if (lower.includes('rút doanh thu') || lower.includes('hoàn cọc')) {
    return {
      icon: 'wallet-outline',
      iconColor: '#059669',
      badgeBg: '#ECFDF5',
      eyebrow: 'VÍ ĐỐI SOÁT ESCROW',
    };
  }
  if (lower.includes('rfid') || lower.includes('chip')) {
    return {
      icon: 'hardware-chip-outline',
      iconColor: '#BA0049',
      badgeBg: '#FFF0F3',
      eyebrow: 'ĐỊNH DANH CHIP RFID',
    };
  }
  if (lower.includes('vé điện tử') || lower.includes('quét')) {
    return {
      icon: 'qr-code-outline',
      iconColor: '#BA0049',
      badgeBg: '#FFF0F3',
      eyebrow: 'TÀGO SMART SCANNER',
    };
  }
  if (lower.includes('báo cáo') || lower.includes('bồi thường') || hasDestructive) {
    return {
      icon: 'shield-checkmark-outline',
      iconColor: '#D97706',
      badgeBg: '#FFFBEB',
      eyebrow: 'BẢO VỆ QUYỀN LỢI TÀGO',
    };
  }
  return {
    icon: 'sparkles',
    iconColor: '#BA0049',
    badgeBg: '#FFF0F3',
    eyebrow: 'XÁC NHẬN THAO TÁC',
  };
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

  const { title, message, buttons } = payload;
  const resolvedButtons: TagoAlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: 'Đã hiểu', style: 'default' }];

  const visual = resolveAlertVisual(title, resolvedButtons);
  const isMultiVertical = resolvedButtons.length > 2;

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

  // Sort for 3+ buttons so cancel is at bottom
  const sortedVerticalButtons = isMultiVertical
    ? [
        ...resolvedButtons.filter((b) => b.style !== 'cancel'),
        ...resolvedButtons.filter((b) => b.style === 'cancel'),
      ]
    : resolvedButtons;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleBackdropClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={handleBackdropClose} />

        <View style={styles.card}>
          {/* Top Icon & Eyebrow */}
          <View style={styles.topRow}>
            <View style={[styles.iconCircle, { backgroundColor: visual.badgeBg }]}>
              <Ionicons name={visual.icon} size={22} color={visual.iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{visual.eyebrow}</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
          </View>

          {!!message && <Text style={styles.message}>{message}</Text>}

          {/* Buttons */}
          {isMultiVertical ? (
            <View style={styles.verticalActions}>
              {sortedVerticalButtons.map((btn, idx) => {
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';
                return (
                  <Pressable
                    key={`${btn.text}-${idx}`}
                    onPress={() => handlePressButton(btn)}
                    style={({ pressed }) => [
                      styles.verticalBtn,
                      isCancel
                        ? styles.btnCancel
                        : isDestructive
                          ? styles.btnDestructive
                          : idx === 0
                            ? styles.btnPrimary
                            : styles.btnSecondaryRose,
                      pressed && { opacity: 0.88 },
                    ]}
                  >
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
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.horizontalActions}>
              {resolvedButtons.map((btn, idx) => {
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';
                return (
                  <Pressable
                    key={`${btn.text}-${idx}`}
                    onPress={() => handlePressButton(btn)}
                    style={({ pressed }) => [
                      styles.horizontalBtn,
                      isCancel
                        ? styles.btnCancel
                        : isDestructive
                          ? styles.btnDestructive
                          : styles.btnPrimary,
                      pressed && { opacity: 0.88 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        isCancel ? styles.btnCancelText : styles.btnPrimaryText,
                      ]}
                    >
                      {btn.text || 'Xác nhận'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 14, 17, 0.52)',
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
    maxWidth: 370,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
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
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 1.1,
    color: '#BA0049',
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 19,
    color: '#1E1418',
    marginTop: 1,
  },
  message: {
    fontFamily: FontFamily.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: '#4F3F46',
    backgroundColor: '#FAF6F8',
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFE6EA',
  },
  horizontalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
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
    marginTop: 2,
  },
  verticalBtn: {
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnCancel: {
    backgroundColor: '#F7F3F5',
    borderWidth: 1,
    borderColor: '#E5DCE0',
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
