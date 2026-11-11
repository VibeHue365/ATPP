import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { bookingApi } from '@/apis/bookingApi';
import { TagoLocationPicker } from '@/components/map/TagoLocationPicker';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppModal } from '@/components/ui/AppModal';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';
import type { BookingSchedule } from '@/types/booking';
import { getApiErrorMessage } from '@/utils/apiError';
import { isValidLatLng, resolveEntityCoords } from '@/utils/geo';

interface Props {
  visible: boolean;
  bookingId: string;
  schedule: BookingSchedule | null;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function LocationChangeModal({
  visible,
  bookingId,
  schedule,
  onClose,
  onSuccess,
}: Props) {
  const { show } = useToast();
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState(16.4637);
  const [longitude, setLongitude] = useState(107.5909);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !schedule) return;
    const initialCoords = resolveEntityCoords(schedule);
    setAddress(
      schedule.locationAddress ??
        schedule.locationSnapshot?.address ??
        'Cung An Định, 179B Phan Đình Phùng, TP. Huế',
    );
    setLatitude(initialCoords.lat);
    setLongitude(initialCoords.lng);
    setNote('');
  }, [visible, schedule]);

  const submit = async () => {
    if (!schedule) return;
    if (!address.trim() || !isValidLatLng(latitude, longitude)) {
      show('Vui lòng chọn địa điểm mới hợp lệ trên bản đồ', 'error');
      return;
    }
    setSaving(true);
    try {
      await bookingApi.requestLocationChange(bookingId, schedule._id, {
        address: address.trim(),
        latitude,
        longitude,
        note: note.trim() || undefined,
      });
      show('Đã gửi yêu cầu đổi địa điểm chụp kèm tọa độ mới', 'success');
      onClose();
      await onSuccess();
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể gửi yêu cầu đổi địa điểm'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal visible={visible} title="Bản đồ đổi địa điểm chụp" onClose={onClose}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={s.note}>
          Tìm địa chỉ mới trên toàn quốc hoặc chạm/kéo ghim trên bản đồ. Các địa điểm có mái che được gợi ý ưu tiên khi thời tiết có mưa.
        </Text>

        <TagoLocationPicker
          value={{ address, latitude, longitude }}
          onChange={(next) => {
            setAddress(next.address);
            setLatitude(next.latitude);
            setLongitude(next.longitude);
          }}
          title="Chọn địa điểm chụp thay thế"
          subtitle="Chạm vào danh thắng gợi ý hoặc kéo ghim tới điểm mới"
          preferIndoorSpots
          mapHeight={210}
        />

        <AppInput
          label="GHI CHÚ CHO NHIẾP ẢNH GIA (TÙY CHỌN)"
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          placeholder="Ví dụ: Đổi sang điểm có mái che do trời mưa nhẹ, hẹn nhau tại cổng chính..."
        />
        <AppButton title="Gửi yêu cầu đổi điểm chụp" loading={saving} onPress={() => void submit()} />
      </ScrollView>
    </AppModal>
  );
}

const s = StyleSheet.create({
  scroll: { maxHeight: 590 },
  content: { gap: Spacing.md, paddingBottom: Spacing.sm },
  note: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
    backgroundColor: Colors.primarySoft,
    padding: 12,
    borderRadius: Radius.sm,
  },
});
