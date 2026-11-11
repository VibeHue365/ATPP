import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily } from '@/constants/theme';

interface ReputationIncidentCardProps {
  rating?: number;
  incidentCode?: string;
  incidentText?: string;
  badgeText?: string;
  onPressDetail?: () => void;
}

export function ReputationIncidentCard({
  rating = 5.0,
  incidentCode,
  incidentText = 'Hoạt động tốt · Chưa ghi nhận khiếu nại',
  badgeText = 'Chuẩn đối tác TàGo',
  onPressDetail,
}: ReputationIncidentCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.leftRow}>
        <View style={styles.iconBox}>
          <Ionicons name="shield-checkmark" size={20} color="#059669" />
        </View>

        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>Uy tín {rating.toFixed(1)}/5.0</Text>
            <Ionicons name="star" size={13} color="#D97706" />
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{badgeText}</Text>
            </View>
          </View>
          <Text style={styles.subtext} numberOfLines={1}>
            {incidentCode ? (
              <>
                <Text style={styles.incidentCodeText}>{incidentCode}</Text> · {incidentText}
              </>
            ) : (
              incidentText
            )}
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.detailBtn, pressed && styles.btnPressed]}
        onPress={onPressDetail}
      >
        <Text style={styles.detailBtnText}>Đánh giá</Text>
        <Ionicons name="arrow-forward" size={12} color="#BA0049" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EFECEB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: '#1B1C1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  titleText: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: '#1B1C1C',
  },
  pendingBadge: {
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  subtext: {
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: '#5F5E5E',
  },
  incidentCodeText: {
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F3',
    borderWidth: 1,
    borderColor: '#FFD9DE',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 99,
  },
  detailBtnText: {
    fontSize: 11,
    fontFamily: FontFamily.bodyBold,
    color: '#BA0049',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
