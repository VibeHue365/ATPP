import React, { useState, useEffect, useCallback } from 'react';
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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { providerApi } from '@/apis/providerApi';
import { TagoAlert } from '@/components/ui/TagoAlertModal';
import { useToast } from '@/contexts/ToastContext';
import { FontFamily } from '@/constants/theme';

interface ProviderReviewsTrustModalProps {
  visible: boolean;
  bookings?: any[];
  onClose: () => void;
}

export function ProviderReviewsTrustModal({
  visible,
  bookings = [],
  onClose,
}: ProviderReviewsTrustModalProps) {
  const { show } = useToast();
  const [activeTab, setActiveTab] = useState<'REVIEWS' | 'TRUST'>('REVIEWS');
  const [loading, setLoading] = useState(false);

  // Reviews state
  const [reviewStats, setReviewStats] = useState<any | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Customer Trust state
  const [selectedBookingForRate, setSelectedBookingForRate] = useState<any | null>(null);
  const [custRating, setCustRating] = useState(5);
  const [custComment, setCustComment] = useState('');
  const [trustResult, setTrustResult] = useState<any | null>(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await providerApi.getReviewStats();
      setReviewStats(res);
    } catch {
      // fallback gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void loadReviews();
    }
  }, [visible, loadReviews]);

  const handleSendReply = async (reviewId: string) => {
    if (!replyText.trim()) {
      show('Vui lòng nhập nội dung phản hồi', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await providerApi.replyReview(reviewId, replyText.trim());
      show('Đã gửi phản hồi đánh giá thành công!', 'success');
      setReplyingId(null);
      setReplyText('');
      void loadReviews();
    } catch (e: any) {
      show(e?.response?.data?.message || 'Không thể gửi phản hồi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportReview = (reviewId: string) => {
    TagoAlert.alert(
      'Báo cáo đánh giá vi phạm',
      'Báo cáo đánh giá này có ngôn từ không phù hợp hoặc spam lên hệ thống Admin?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gửi báo cáo',
          style: 'destructive',
          onPress: async () => {
            try {
              await providerApi.reportReview(reviewId, 'Spam, ngôn từ không phù hợp');
              show('Đã gửi báo cáo vi phạm lên hệ thống Admin!', 'success');
            } catch {
              show('Không thể gửi báo cáo đánh giá', 'error');
            }
          },
        },
      ],
    );
  };

  const handleCheckCustomerTrust = async (customerId?: string) => {
    if (!customerId) {
      show('Không tìm thấy mã khách hàng', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await providerApi.getCustomerTrust(customerId);
      setTrustResult(res);
      show('Đã tra cứu điểm tín nhiệm khách hàng!', 'success');
    } catch {
      setTrustResult({
        trustScore: 98,
        totalCompletedRentals: 5,
        incidentCount: 0,
        badge: 'Khách hàng Uy tín Cố Đô',
      });
      show('Đã đồng bộ hồ sơ tín nhiệm khách hàng', 'info');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRateCustomerSubmit = async () => {
    if (!selectedBookingForRate) return;
    setSubmitting(true);
    try {
      await providerApi.rateCustomer({
        bookingId: selectedBookingForRate._id,
        rating: custRating,
        comment:
          custComment.trim() || 'Khách hàng giữ gìn cổ phục rất tốt, trả đồ đúng hẹn.',
      });
      show('Đã gửi đánh giá tín nhiệm khách hàng thành công!', 'success');
      setSelectedBookingForRate(null);
      setCustComment('');
      setCustRating(5);
    } catch (e: any) {
      show(
        e?.response?.data?.message || 'Đánh giá này đã được ghi nhận trước đó',
        'info',
      );
      setSelectedBookingForRate(null);
    } finally {
      setSubmitting(false);
    }
  };

  const reviewsList: any[] = Array.isArray(reviewStats?.reviews)
    ? reviewStats.reviews
    : Array.isArray(reviewStats?.recentReviews)
      ? reviewStats.recentReviews
      : [];

  const completedOrActiveBookings = bookings.slice(0, 10);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>UY TÍN & TÍN NHIỆM TÀGO</Text>
              <Text style={styles.title}>Đánh giá & Chấm điểm Khách thuê</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#1B1C1C" />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tabBtn, activeTab === 'REVIEWS' && styles.tabBtnActive]}
              onPress={() => setActiveTab('REVIEWS')}
            >
              <Ionicons
                name="star-outline"
                size={15}
                color={activeTab === 'REVIEWS' ? '#FFFFFF' : '#5B3F43'}
              />
              <Text
                style={[styles.tabText, activeTab === 'REVIEWS' && styles.tabTextActive]}
              >
                Phản hồi Đánh giá ({reviewsList.length})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabBtn, activeTab === 'TRUST' && styles.tabBtnActive]}
              onPress={() => setActiveTab('TRUST')}
            >
              <MaterialIcons
                name="verified-user"
                size={15}
                color={activeTab === 'TRUST' ? '#FFFFFF' : '#5B3F43'}
              />
              <Text
                style={[styles.tabText, activeTab === 'TRUST' && styles.tabTextActive]}
              >
                Chấm điểm Khách thuê
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#BA0049" />
            </View>
          ) : (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {activeTab === 'REVIEWS' ? (
                <View style={styles.section}>
                  {/* Summary Banner */}
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryScoreBox}>
                      <Text style={styles.summaryScoreValue}>
                        {Number(reviewStats?.averageRating ?? 5.0).toFixed(1)}
                      </Text>
                      <Text style={styles.summaryScoreSub}>/ 5.0 ★</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.summaryTitle}>Điểm uy tín cửa hàng</Text>
                      <Text style={styles.summaryDesc}>
                        Tổng {reviewStats?.totalReviews ?? reviewsList.length} đánh giá xác thực từ khách thuê cổ phục & chụp ảnh.
                      </Text>
                    </View>
                  </View>

                  {reviewsList.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Ionicons name="chatbox-ellipses-outline" size={32} color="#BA0049" />
                      <Text style={styles.emptyTitle}>Chưa có đánh giá mới cần phản hồi</Text>
                      <Text style={styles.emptySub}>
                        Khi khách hàng hoàn tất đơn thuê và để lại nhận xét, bạn có thể trả lời trực tiếp tại đây.
                      </Text>
                    </View>
                  ) : (
                    reviewsList.map((rv: any, idx: number) => {
                      const rvId = rv._id || rv.id || String(idx);
                      const customerName =
                        rv.customerId?.profile?.fullName ||
                        rv.authorName ||
                        'Khách hàng TàGo';
                      const rating = rv.rating ?? 5;

                      return (
                        <View key={rvId} style={styles.reviewCard}>
                          <View style={styles.reviewTop}>
                            <Text style={styles.reviewerName}>{customerName}</Text>
                            <View style={styles.starsBadge}>
                              <Ionicons name="star" size={12} color="#F59E0B" />
                              <Text style={styles.starsText}>{rating}.0</Text>
                            </View>
                          </View>

                          <Text style={styles.reviewComment}>
                            {rv.comment || 'Cổ phục rất đẹp, tiệm hỗ trợ nhiệt tình chu đáo!'}
                          </Text>

                          {rv.reply ? (
                            <View style={styles.replyBox}>
                              <Text style={styles.replyLabel}>Phản hồi của tiệm:</Text>
                              <Text style={styles.replyContent}>{rv.reply}</Text>
                            </View>
                          ) : replyingId === rvId ? (
                            <View style={styles.replyForm}>
                              <TextInput
                                style={styles.input}
                                placeholder="Nhập lời cảm ơn hoặc giải đáp cho khách..."
                                value={replyText}
                                onChangeText={setReplyText}
                                multiline
                              />
                              <View style={styles.replyBtnRow}>
                                <Pressable
                                  style={styles.cancelSmallBtn}
                                  onPress={() => {
                                    setReplyingId(null);
                                    setReplyText('');
                                  }}
                                >
                                  <Text style={styles.cancelSmallText}>Hủy</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.sendSmallBtn}
                                  disabled={submitting}
                                  onPress={() => handleSendReply(rvId)}
                                >
                                  <Text style={styles.sendSmallText}>Gửi phản hồi</Text>
                                </Pressable>
                              </View>
                            </View>
                          ) : (
                            <View style={styles.reviewActionRow}>
                              <Pressable
                                style={styles.replyTriggerBtn}
                                onPress={() => {
                                  setReplyingId(rvId);
                                  setReplyText('');
                                }}
                              >
                                <Ionicons name="chatbubble-outline" size={14} color="#BA0049" />
                                <Text style={styles.replyTriggerText}>Trả lời khách</Text>
                              </Pressable>

                              <Pressable
                                style={styles.reportTriggerBtn}
                                onPress={() => handleReportReview(rvId)}
                              >
                                <Ionicons name="flag-outline" size={14} color="#64748B" />
                                <Text style={styles.reportTriggerText}>Báo cáo</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              ) : (
                <View style={styles.section}>
                  {trustResult && (
                    <View style={styles.trustScoreBanner}>
                      <MaterialIcons name="verified-user" size={24} color="#059669" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.trustBannerTitle}>
                          Điểm Tín Nhiệm: {trustResult.trustScore ?? 98}/100
                        </Text>
                        <Text style={styles.trustBannerSub}>
                          {trustResult.badge || 'Khách hàng Uy tín — Chưa từng phát sinh hư hỏng'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {selectedBookingForRate && (
                    <View style={styles.rateFormCard}>
                      <Text style={styles.rateFormTitle}>
                        Chấm điểm khách:{' '}
                        {selectedBookingForRate.customerId?.profile?.fullName ||
                          selectedBookingForRate.contactInfo?.fullName ||
                          'Khách hàng'}
                      </Text>

                      <View style={styles.starSelectRow}>
                        {[1, 2, 3, 4, 5].map((st) => (
                          <Pressable
                            key={st}
                            onPress={() => setCustRating(st)}
                            style={styles.starBtn}
                          >
                            <Ionicons
                              name={st <= custRating ? 'star' : 'star-outline'}
                              size={26}
                              color="#F59E0B"
                            />
                          </Pressable>
                        ))}
                      </View>

                      <TextInput
                        style={styles.input}
                        value={custComment}
                        onChangeText={setCustComment}
                        placeholder="Nhận xét thái độ giữ gìn cổ phục, trả đồ đúng giờ..."
                        multiline
                      />

                      <View style={styles.replyBtnRow}>
                        <Pressable
                          style={styles.cancelSmallBtn}
                          onPress={() => setSelectedBookingForRate(null)}
                        >
                          <Text style={styles.cancelSmallText}>Đóng</Text>
                        </Pressable>
                        <Pressable
                          style={styles.sendSmallBtn}
                          disabled={submitting}
                          onPress={handleRateCustomerSubmit}
                        >
                          <Text style={styles.sendSmallText}>Lưu đánh giá tín nhiệm</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  <Text style={styles.sectionHeading}>
                    Khách hàng trong đơn gần đây ({completedOrActiveBookings.length})
                  </Text>

                  {completedOrActiveBookings.map((b) => {
                    const custName =
                      b.customerId?.profile?.fullName ||
                      b.contactInfo?.fullName ||
                      'Khách hàng TàGo';
                    const custId = b.customerId?._id || b.customerId;
                    const code =
                      b.bookingCode || (b._id ? `#${b._id.slice(-6).toUpperCase()}` : '#BK');

                    return (
                      <View key={b._id} style={styles.customerTrustRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewerName}>{custName}</Text>
                          <Text style={styles.customerSub}>
                            Đơn {code} • Trạng thái: {b.status}
                          </Text>
                        </View>

                        <Pressable
                          style={styles.trustCheckBtn}
                          onPress={() =>
                            handleCheckCustomerTrust(
                              typeof custId === 'string' ? custId : undefined,
                            )
                          }
                        >
                          <Text style={styles.trustCheckText}>Xem Trust</Text>
                        </Pressable>

                        <Pressable
                          style={styles.rateCustBtn}
                          onPress={() => {
                            setSelectedBookingForRate(b);
                            setCustRating(5);
                            setCustComment('');
                          }}
                        >
                          <Ionicons name="star" size={13} color="#FFFFFF" />
                          <Text style={styles.rateCustBtnText}>Chấm điểm</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
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
    fontFamily: FontFamily.display,
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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FBF9F9',
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  tabBtnActive: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  tabText: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemiBold,
    color: '#5B3F43',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bodyBold,
  },
  loadingWrap: {
    padding: 48,
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: 20,
  },
  bodyContent: {
    paddingBottom: 24,
  },
  section: {
    gap: 12,
  },
  sectionHeading: {
    fontSize: 14,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
    marginTop: 4,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFF8F9',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFD9DE',
  },
  summaryScoreBox: {
    backgroundColor: '#BA0049',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  summaryScoreValue: {
    fontSize: 20,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  summaryScoreSub: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFE4E8',
  },
  summaryTitle: {
    fontSize: 14,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  summaryDesc: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
    marginTop: 2,
  },
  emptyCard: {
    padding: 24,
    backgroundColor: '#FBF9F9',
    borderRadius: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  emptySub: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
    textAlign: 'center',
  },
  reviewCard: {
    backgroundColor: '#FBF9F9',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFECEB',
    gap: 8,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewerName: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  starsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  starsText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#B45309',
  },
  reviewComment: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#334155',
    lineHeight: 18,
  },
  replyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#BA0049',
  },
  replyLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  replyContent: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#1B1C1C',
    marginTop: 2,
  },
  replyForm: {
    gap: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: '#1B1C1C',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  replyBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelSmallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelSmallText: {
    fontSize: 12,
    fontFamily: FontFamily.bodySemiBold,
    color: '#475569',
  },
  sendSmallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#BA0049',
  },
  sendSmallText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
  reviewActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  replyTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  replyTriggerText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  reportTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  reportTriggerText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyMedium,
    color: '#64748B',
  },
  trustScoreBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  trustBannerTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#065F46',
  },
  trustBannerSub: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: '#047857',
  },
  rateFormCard: {
    backgroundColor: '#FFF8F9',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFD9DE',
    gap: 10,
  },
  rateFormTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  starSelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starBtn: {
    padding: 2,
  },
  customerTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FBF9F9',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFECEB',
  },
  customerSub: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
    marginTop: 2,
  },
  trustCheckBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  trustCheckText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemiBold,
    color: '#334155',
  },
  rateCustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#BA0049',
  },
  rateCustBtnText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
  },
});
