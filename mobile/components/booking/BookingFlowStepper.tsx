import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, Radius } from '@/constants/theme';
import type { BookingType } from '@/types/booking';

export interface BookingFlowStepperProps {
  bookingType: BookingType;
  status: string;
  variant?: 'customer' | 'provider';
  containerStyle?: StyleProp<ViewStyle>;
}

interface StepDef {
  key: string;
  label: string;
  subLabel?: string;
  customerNote: string;
  providerNote: string;
}

export function BookingFlowStepper({
  bookingType,
  status,
  variant = 'customer',
  containerStyle,
}: BookingFlowStepperProps) {
  const isAbnormal = ['CANCELLED', 'DISPUTED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(
    status,
  );

  const steps: StepDef[] = useMemo(() => {
    if (bookingType === 'PHOTOGRAPHY') {
      return [
        {
          key: 'CONFIRMED',
          label: 'Khóa lịch',
          customerNote: 'Lịch hẹn đã được xác nhận. Thợ ảnh đang chuẩn bị concept và thiết bị.',
          providerNote: 'Lịch hẹn mới đã được xác nhận. Vui lòng chuẩn bị thiết bị và lịch trình.',
        },
        {
          key: 'IN_PROGRESS',
          label: 'Buổi chụp',
          customerNote: 'Buổi chụp ảnh đang diễn ra tại địa điểm hẹn cùng thợ ảnh.',
          providerNote: 'Đang trong buổi chụp ảnh thực tế với khách hàng.',
        },
        {
          key: 'AWAITING_REVIEW',
          label: 'Bàn giao ảnh',
          customerNote: 'Thợ ảnh đã gửi album ảnh! Hãy xem và bấm "Xác nhận hài lòng & Hoàn tất".',
          providerNote: 'Đã gửi album ảnh, đang chờ khách duyệt trong vòng 48h.',
        },
        {
          key: 'COMPLETED',
          label: 'Hoàn tất',
          customerNote: 'Bạn đã duyệt ảnh hài lòng. Đơn hàng hoàn tất, hãy để lại đánh giá nhé!',
          providerNote: 'Khách hàng đã duyệt ảnh. Tiền công chụp đã được giải ngân hoàn tất.',
        },
      ];
    }

    if (bookingType === 'COMBO') {
      return [
        {
          key: 'CONFIRMED',
          label: 'Xác nhận',
          customerNote: 'Đơn combo đã đặt cọc thành công. Tiệm và thợ ảnh đang chuẩn bị.',
          providerNote: 'Đơn combo mới đã khóa lịch. Chuẩn bị trang phục và lịch trình chụp.',
        },
        {
          key: 'PICKED_UP',
          label: 'Nhận đồ & Chụp',
          customerNote: 'Nhận trang phục tại tiệm và gặp thợ ảnh thực hiện buổi chụp.',
          providerNote: 'Bàn giao trang phục và tiến hành buổi chụp theo lịch hẹn.',
        },
        {
          key: 'AWAITING_REVIEW',
          label: 'Duyệt ảnh',
          customerNote: 'Album ảnh combo đã sẵn sàng. Kiểm tra và duyệt ảnh chụp.',
          providerNote: 'Đã bàn giao ảnh combo, đang chờ khách xác nhận album.',
        },
        {
          key: 'RETURNED',
          label: 'Trả cổ phục',
          customerNote: 'Hoàn trả trang phục tại tiệm sau khi chụp xong.',
          providerNote: 'Kiểm tra hiện trạng cổ phục khi khách mang trả.',
        },
        {
          key: 'COMPLETED',
          label: 'Hoàn tất',
          customerNote: 'Đơn combo hoàn tất trọn vẹn và tiền cọc giữ đồ đã được hoàn trả.',
          providerNote: 'Đơn combo hoàn tất 100% và đã quyết toán các khoản.',
        },
      ];
    }

    // Default: AODAI_RENTAL (6 steps aligned with e-Contract V2 + Rental Escrow flow)
    return [
      {
        key: 'PENDING_PAYMENT',
        label: 'Ký HĐ & TT',
        customerNote:
          'Vui lòng xác nhận Hợp đồng điện tử (nếu áp dụng) và hoàn tất thanh toán PayOS để giữ lịch.',
        providerNote:
          'Khách hàng đang hoàn tất xác nhận Hợp đồng điện tử và thanh toán qua PayOS.',
      },
      {
        key: 'CONFIRMED',
        label: 'Đặt cọc',
        customerNote: 'Đơn đã cọc thành công. Tiệm đang xác nhận và soạn cổ phục theo yêu cầu.',
        providerNote: 'Đơn mới đã cọc. Vui lòng xác nhận đơn, kiểm tra tình trạng và soạn đồ.',
      },
      {
        key: 'PICKUP_PENDING',
        label: 'Sẵn sàng',
        customerNote: 'Cổ phục đã sẵn sàng tại tiệm! Hãy ghé lấy đồ đúng giờ và xác nhận trên ứng dụng.',
        providerNote: 'Đã soạn đồ xong và tải ảnh hiện trạng, chờ khách đến nhận đồ.',
      },
      {
        key: 'PICKED_UP',
        label: 'Đang thuê',
        customerNote: 'Bạn đang giữ trang phục. Vui lòng bảo quản cẩn thận theo hợp đồng và trả đúng hạn.',
        providerNote: 'Khách hàng đang giữ trang phục trong thời gian thuê.',
      },
      {
        key: 'RETURNED',
        label: 'Đã trả đồ',
        customerNote: 'Đã gửi lại đồ cho tiệm. Tiệm đang kiểm tra hiện trạng để hoàn cọc.',
        providerNote: 'Đã nhận lại đồ. Vui lòng kiểm tra kỹ hiện trạng và bấm đối soát hoàn cọc.',
      },
      {
        key: 'COMPLETED',
        label: 'Hoàn cọc',
        customerNote: 'Tiền cọc đã được hoàn trả. Đơn thuê hoàn tất, hãy đánh giá tiệm nhé!',
        providerNote: 'Đơn thuê hoàn tất trọn vẹn, cọc Escrow đã được quyết toán.',
      },
    ];
  }, [bookingType]);

  // Determine active step index
  const activeIndex = useMemo(() => {
    if (bookingType === 'PHOTOGRAPHY') {
      if (['PENDING_PAYMENT', 'DRAFT', 'CONFIRMED', 'DEPOSIT_PAID'].includes(status)) return 0;
      if (status === 'IN_PROGRESS') return 1;
      if (['AWAITING_REVIEW', 'COMBO_PHOTOS_APPROVED'].includes(status)) return 2;
      if (status === 'COMPLETED') return 3;
      return 0;
    }

    if (bookingType === 'COMBO') {
      if (['PENDING_PAYMENT', 'DRAFT', 'CONFIRMED', 'DEPOSIT_PAID'].includes(status)) return 0;
      if (['PICKUP_PENDING', 'PICKED_UP', 'IN_PROGRESS'].includes(status)) return 1;
      if (['AWAITING_REVIEW', 'COMBO_PHOTOS_APPROVED'].includes(status)) return 2;
      if (['RETURNED', 'RETURN_PENDING'].includes(status)) return 3;
      if (status === 'COMPLETED') return 4;
      return 0;
    }

    // Rental (6 steps)
    if (['PENDING_PAYMENT', 'DRAFT'].includes(status)) return 0;
    if (['CONFIRMED', 'DEPOSIT_PAID'].includes(status)) return 1;
    if (status === 'PICKUP_PENDING') return 2;
    if (['PICKED_UP', 'RETURN_PENDING'].includes(status)) return 3;
    if (status === 'RETURNED') return 4;
    if (status === 'COMPLETED') return 5;
    return 1;
  }, [bookingType, status]);

  if (isAbnormal) {
    const isCancelled = status === 'CANCELLED';
    const isDisputed = status === 'DISPUTED';
    const bg = isCancelled ? '#FEF2F2' : isDisputed ? '#FFFBEB' : '#F0FDF4';
    const border = isCancelled ? '#FCA5A5' : isDisputed ? '#FCD34D' : '#86EFAC';
    const textCol = isCancelled ? Colors.error : isDisputed ? '#B45309' : Colors.success;
    const iconName = isCancelled
      ? 'close-circle-outline'
      : isDisputed
        ? 'alert-circle-outline'
        : 'checkmark-done-circle-outline';
    const title = isCancelled
      ? 'Đơn hàng đã hủy'
      : isDisputed
        ? 'Đơn hàng đang xử lý sự cố / tranh chấp'
        : 'Đơn hàng đã hoàn tiền';
    const subtitle = isCancelled
      ? 'Đơn này đã dừng và hệ thống đã thực hiện đối soát hoàn cọc theo quy định.'
      : isDisputed
        ? 'Đội ngũ hỗ trợ và quản trị viên đang làm việc với các bên để xử lý bồi thường.'
        : 'Các khoản thanh toán/tiền cọc đã được hoàn trả lại cho bạn.';

    return (
      <View style={[styles.abnormalContainer, { backgroundColor: bg, borderColor: border }, containerStyle]}>
        <Ionicons name={iconName} size={22} color={textCol} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.abnormalTitle, { color: textCol }]}>{title}</Text>
          <Text style={styles.abnormalSubtitle}>{subtitle}</Text>
        </View>
      </View>
    );
  }

  const currentStep = steps[activeIndex] || steps[0];
  const isIncidentPending = status === 'RETURN_PENDING';
  const activeNote = isIncidentPending
    ? variant === 'provider'
      ? 'Đã lập biên bản sự cố trả đồ. Đang chờ khách hàng xác nhận hoặc quản trị viên đối soát giải phóng cọc.'
      : 'Cửa hàng vừa báo cáo sự cố lúc trả đồ. Bạn vui lòng xem chi tiết biên bản, ảnh bằng chứng và xác nhận hoặc khiếu nại bên dưới.'
    : bookingType !== 'AODAI_RENTAL' && ['PENDING_PAYMENT', 'DRAFT'].includes(status)
      ? variant === 'provider'
        ? 'Khách hàng đang hoàn tất xác nhận hợp đồng (nếu có) và thanh toán qua PayOS.'
        : 'Đơn hàng đang chờ xác nhận hợp đồng (nếu áp dụng) và thanh toán cọc qua PayOS.'
      : variant === 'provider'
        ? currentStep?.providerNote
        : currentStep?.customerNote;

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.headerRow}>
        <Text style={styles.titleHeading}>TIẾN TRÌNH DỊCH VỤ</Text>
        <Text style={styles.stepCounter}>
          Bước {Math.min(activeIndex + 1, steps.length)}/{steps.length}
        </Text>
      </View>

      {/* Stepper bar */}
      <View style={styles.stepsRow}>
        {steps.map((step, idx) => {
          const isDone = idx < activeIndex || status === 'COMPLETED';
          const isCurrent = idx === activeIndex && status !== 'COMPLETED';
          const isLast = idx === steps.length - 1;

          return (
            <React.Fragment key={step.key}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    isDone && styles.stepCircleDone,
                    isCurrent && styles.stepCircleCurrent,
                  ]}
                >
                  {isDone ? (
                    <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.stepNumberText,
                        isCurrent && styles.stepNumberCurrentText,
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.stepLabel,
                    isDone && styles.stepLabelDone,
                    isCurrent && styles.stepLabelCurrent,
                  ]}
                >
                  {step.label}
                </Text>
              </View>

              {!isLast && (
                <View
                  style={[
                    styles.connectorLine,
                    idx < activeIndex && styles.connectorLineDone,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Dynamic guidance note */}
      {Boolean(activeNote) && (
        <View
          style={[
            styles.guidanceBox,
            isIncidentPending && {
              backgroundColor: Colors.warningSoft,
              borderColor: '#FDE68A',
            },
          ]}
        >
          <Ionicons
            name={
              isIncidentPending
                ? 'warning'
                : status === 'COMPLETED'
                  ? 'checkmark-circle'
                  : 'information-circle'
            }
            size={16}
            color={
              isIncidentPending
                ? Colors.warning
                : status === 'COMPLETED'
                  ? Colors.success
                  : Colors.primary
            }
          />
          <Text
            style={[
              styles.guidanceText,
              isIncidentPending && { color: '#92400E', fontFamily: FontFamily.bodyMedium },
            ]}
          >
            {activeNote}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0ECEB',
    marginBottom: 16,
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleHeading: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    color: '#8A0035',
    letterSpacing: 0.6,
  },
  stepCounter: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.textMuted,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 40,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepCircleDone: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  stepCircleCurrent: {
    backgroundColor: '#FFF0F3',
    borderColor: '#BA0049',
    borderWidth: 2,
  },
  stepNumberText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#9CA3AF',
  },
  stepNumberCurrentText: {
    color: '#BA0049',
    fontFamily: FontFamily.bodyBold,
  },
  stepLabel: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 9.5,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 2,
  },
  stepLabelDone: {
    color: '#059669',
    fontFamily: FontFamily.bodySemiBold,
  },
  stepLabelCurrent: {
    color: '#BA0049',
    fontFamily: FontFamily.bodyBold,
  },
  connectorLine: {
    flex: 0.45,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 1,
    marginTop: -16,
  },
  connectorLineDone: {
    backgroundColor: '#059669',
  },
  guidanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF9F9',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    marginTop: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#F0ECEB',
  },
  guidanceText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#4B5563',
    lineHeight: 16,
  },
  abnormalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  abnormalTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    marginBottom: 2,
  },
  abnormalSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    color: '#4B5563',
    lineHeight: 16,
  },
});
