import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FontFamily } from '@/constants/theme';
import type {
  ProviderContractPolicyVersion,
  ProviderPolicyReviewStatus,
} from '@/types/contract';
import { formatDateTime } from '@/utils/booking';

interface ProviderPolicyHistoryModalProps {
  visible: boolean;
  loading: boolean;
  versions: ProviderContractPolicyVersion[];
  onClose: () => void;
}

function getPolicyStatusBadge(status: ProviderPolicyReviewStatus): {
  label: string;
  tone: 'success' | 'warning' | 'error' | 'info' | 'neutral';
} {
  switch (status) {
    case 'APPROVED':
      return { label: 'Đã duyệt (Đang hiệu lực)', tone: 'success' };
    case 'PENDING_REVIEW':
      return { label: 'Chờ Admin duyệt', tone: 'warning' };
    case 'REJECTED':
      return { label: 'Bị từ chối', tone: 'error' };
    case 'SUPERSEDED':
      return { label: 'Đã thay thế', tone: 'neutral' };
    case 'DRAFT':
    default:
      return { label: 'Bản nháp', tone: 'info' };
  }
}

export function ProviderPolicyHistoryModal({
  visible,
  loading,
  versions,
  onClose,
}: ProviderPolicyHistoryModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>LỊCH SỬ PHIÊN BẢN</Text>
              <Text style={styles.title}>Chính sách Hợp đồng Shop</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#1B1C1C" />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#BA0049" />
            </View>
          ) : versions.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="document-text-outline" size={34} color="#94A3B8" />
              <Text style={styles.emptyText}>
                Chưa có phiên bản chính sách nào được lưu.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              {versions.map((ver) => {
                const badge = getPolicyStatusBadge(ver.status);
                return (
                  <View key={ver._id} style={styles.versionCard}>
                    <View style={styles.versionTop}>
                      <Text style={styles.versionTitle}>
                        Phiên bản v{ver.versionNumber}
                      </Text>
                      <StatusBadge label={badge.label} tone={badge.tone} />
                    </View>

                    <Text style={styles.metaLine}>
                      Cập nhật: {formatDateTime(ver.updatedAt || ver.createdAt)}
                    </Text>
                    {ver.submittedAt && (
                      <Text style={styles.metaLine}>
                        Gửi duyệt: {formatDateTime(ver.submittedAt)}
                      </Text>
                    )}
                    {ver.approvedAt && (
                      <Text style={styles.metaLine}>
                        Được duyệt: {formatDateTime(ver.approvedAt)}
                      </Text>
                    )}
                    {ver.reviewNote ? (
                      <View style={styles.noteBox}>
                        <Text style={styles.noteText}>
                          Ghi chú Admin: {ver.reviewNote}
                        </Text>
                      </View>
                    ) : null}

                    <Text style={styles.summaryLine}>
                      Ân hạn: {ver.lateReturn?.gracePeriodHours ?? 0}h · Phạt giờ:{' '}
                      {(ver.lateReturn?.hourlyLateFee ?? 0).toLocaleString('vi-VN')}đ ·
                      Phạt ngày:{' '}
                      {(ver.lateReturn?.dailyLateFee ?? 0).toLocaleString('vi-VN')}đ
                    </Text>
                    <Text style={styles.summaryLine}>
                      Hotline: {ver.supportContact?.hotline || 'Chưa có'} (
                      {ver.supportContact?.supportWorkingHours || '08:00 - 21:00'})
                    </Text>
                  </View>
                );
              })}
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
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
    borderBottomColor: '#F1F5F9',
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
    letterSpacing: 0.7,
  },
  title: {
    fontSize: 17,
    fontFamily: FontFamily.display,
    color: '#1B1C1C',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    padding: 36,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: FontFamily.bodyMedium,
    color: '#64748B',
    textAlign: 'center',
  },
  body: {
    maxHeight: 460,
  },
  bodyContent: {
    padding: 18,
    gap: 12,
  },
  versionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 5,
  },
  versionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  versionTitle: {
    fontSize: 14,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  metaLine: {
    fontSize: 11.5,
    fontFamily: FontFamily.body,
    color: '#64748B',
  },
  summaryLine: {
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
    color: '#334155',
    marginTop: 2,
  },
  noteBox: {
    marginTop: 4,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  noteText: {
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
    color: '#991B1B',
  },
});
