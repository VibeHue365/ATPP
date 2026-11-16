import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { weatherAdvisorApi } from '@/apis/weatherAdvisorApi';
import type { SlotAssessmentResult } from '@/types/weather';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';

interface HeritageWeatherCardProps {
  bookingId: string;
  shootDate: string;
  timeSlot: string;
  spotId?: string;
  spotName?: string;
  weatherRescheduleCount?: number;
  hasPendingWeatherAction?: boolean;
  onOpenPlanB: () => void;
  onOpenCancellation: () => void;
}

export function HeritageWeatherCard({
  bookingId,
  shootDate,
  timeSlot,
  spotId,
  spotName = 'Di tích Huế',
  weatherRescheduleCount = 0,
  hasPendingWeatherAction = false,
  onOpenPlanB,
  onOpenCancellation,
}: HeritageWeatherCardProps) {
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<SlotAssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadAssessment() {
      if (!shootDate) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        if (spotId) {
          const res = await weatherAdvisorApi.assessSpotSlot(spotId, {
            date: shootDate,
            timeSlot,
          });
          if (isMounted) setAssessment(res.assessment);
        } else {
          // Fallback to forecast
          const res = await weatherAdvisorApi.getForecast({ date: shootDate });
          const daySummary = res.dailySummaries?.[0];
          if (isMounted && daySummary) {
            setAssessment({
              date: shootDate,
              timeSlot,
              spaceType: 'OUTDOOR',
              slotScore: daySummary.dailyScore || 8.0,
              isRedAlert: daySummary.isRedAlert || false,
              confidence: 'HIGH',
              advisoryTitle: daySummary.isRedAlert
                ? 'Cảnh báo thời tiết xấu'
                : 'Điều kiện thuận lợi',
              recommendation: daySummary.isRedAlert
                ? 'Dự báo có mưa hoặc dông sét tại Huế. Bạn nên cân nhắc đổi lịch hoặc chuyển điểm chụp.'
                : 'Thời tiết phù hợp cho buổi chụp ảnh di sản ngoài trời.',
              hourlyBreakdown: [],
              canRescheduleFree: daySummary.isRedAlert || false,
            });
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError('Không thể tải dữ liệu thời tiết thực tế.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAssessment();
    return () => {
      isMounted = false;
    };
  }, [spotId, shootDate, timeSlot]);

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Ionicons name="partly-sunny" size={18} color="#D97706" />
          <Text style={styles.headerTitle}>Cố vấn Thời tiết Di sản</Text>
        </View>
        <ActivityIndicator size="small" color="#D97706" style={{ marginVertical: 12 }} />
      </View>
    );
  }

  if (error || !assessment) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconTitleRow}>
            <Ionicons name="partly-sunny-outline" size={18} color="#D97706" />
            <Text style={styles.headerTitle}>Cố vấn Thời tiết & Điểm chụp</Text>
          </View>
          <View style={[styles.scoreBadge, { backgroundColor: '#F1F5F9' }]}>
            <Text style={[styles.scoreText, { color: '#64748B' }]}>Sắp kích hoạt</Text>
          </View>
        </View>
        <Text style={styles.spotText}>
          {`Điểm chụp: ${spotName}`}
        </Text>
        <Text style={styles.advisoryText}>
          {shootDate
            ? `Lịch chụp hẹn ngày ${shootDate} (${timeSlot}). Dự báo thời tiết chi tiết theo giờ sẽ tự động kích hoạt trước ngày chụp 7 ngày.`
            : 'Đơn đặt lịch chụp ảnh di sản Huế. Bạn có thể chủ động theo dõi hoặc chuẩn bị phương án đổi lịch dự phòng.'}
        </Text>
        <View style={styles.actionsContainer}>
          <Pressable style={styles.planBButton} onPress={onOpenPlanB}>
            <Ionicons name="swap-horizontal" size={15} color="#FFFFFF" />
            <Text style={styles.planBButtonText}>Đổi lịch / Phương án B</Text>
          </Pressable>
          <Pressable style={styles.cancelLink} onPress={onOpenCancellation}>
            <Text style={styles.cancelLinkText}>Yêu cầu hủy do thời tiết</Text>
            <Ionicons name="chevron-forward" size={13} color="#991B1B" />
          </Pressable>
        </View>
      </View>
    );
  }

  const isRed = assessment.isRedAlert;
  const score = assessment.slotScore;
  const scoreColor = isRed ? '#DC2626' : score >= 7.5 ? '#16A34A' : '#D97706';
  const badgeBg = isRed ? '#FEE2E2' : score >= 7.5 ? '#DCFCE7' : '#FEF3C7';

  return (
    <View style={[styles.card, isRed && styles.redCard]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.iconTitleRow}>
          <Ionicons
            name={isRed ? 'warning' : 'partly-sunny'}
            size={18}
            color={isRed ? '#DC2626' : '#D97706'}
          />
          <Text style={[styles.headerTitle, isRed && styles.redTitle]}>
            {isRed ? 'Cảnh báo Thời tiết (RED ALERT)' : 'Cố vấn Thời tiết Di sản'}
          </Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>
            {score.toFixed(1)}/10
          </Text>
        </View>
      </View>

      {/* Spot & Schedule Info */}
      <Text style={styles.spotText}>
        📍 {spotName} • {shootDate} ({timeSlot})
      </Text>

      {/* Advisory Message */}
      <Text style={styles.advisoryText}>{assessment.recommendation}</Text>

      {/* Quota Tracker */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          Lượt đổi lịch thời tiết đã dùng: <Text style={styles.bold}>{weatherRescheduleCount}/2</Text>
        </Text>
      </View>

      {/* Pending Banner if user has active proposal/cancellation */}
      {hasPendingWeatherAction && (
        <View style={styles.pendingActionBanner}>
          <Ionicons name="time-outline" size={14} color="#D97706" />
          <Text style={styles.pendingActionText}>
            Đang có một đề xuất đổi lịch hoặc yêu cầu hủy đang chờ xử lý
          </Text>
        </View>
      )}

      {/* Action Buttons for Plan B / Cancellation */}
      {!hasPendingWeatherAction && isRed && (
        <View style={styles.actionsContainer}>
          <Pressable style={styles.planBButton} onPress={onOpenPlanB}>
            <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
            <Text style={styles.planBButtonText}>Chọn Phương Án B (Đổi lịch/điểm)</Text>
          </Pressable>

          <Pressable style={styles.cancelLink} onPress={onOpenCancellation}>
            <Text style={styles.cancelLinkText}>Yêu cầu hủy đơn vì bất khả kháng (AD-03)</Text>
            <Ionicons name="chevron-forward" size={13} color="#991B1B" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Shadow,
  },
  redCard: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FECACA',
    borderWidth: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 14,
    color: '#374151',
  },
  redTitle: {
    color: '#991B1B',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  scoreText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
  },
  spotText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 6,
  },
  advisoryText: {
    fontFamily: FontFamily.body,
    fontSize: 12.5,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#6B7280',
  },
  bold: {
    fontFamily: FontFamily.bodyBold,
    color: '#1F2937',
  },
  pendingActionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: Radius.md,
    marginTop: 4,
  },
  pendingActionText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: '#92400E',
    flex: 1,
  },
  actionsContainer: {
    marginTop: 10,
    gap: 8,
  },
  planBButton: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    gap: 6,
  },
  planBButtonText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  cancelLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  cancelLinkText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#991B1B',
    textDecorationLine: 'underline',
  },
});
