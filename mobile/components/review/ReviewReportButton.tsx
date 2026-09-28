import { Ionicons } from '@expo/vector-icons';
import { type Href, router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { reviewApi } from '@/apis/reviewApi';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppModal } from '@/components/ui/AppModal';
import { Colors, FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/apiError';

export function ReviewReportButton({ reviewId, authorId }: { reviewId: string; authorId?: string }) {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [reported, setReported] = useState(false);

  if (authorId && authorId === user?.id) return null;

  const begin = () => {
    if (!isAuthenticated) {
      router.push({ pathname: '/(auth)/login', params: { returnTo: pathname } } as unknown as Href);
      return;
    }
    setOpen(true);
  };

  const submit = async () => {
    if (reason.trim().length < 10) {
      show('Vui lòng mô tả lý do ít nhất 10 ký tự', 'error');
      return;
    }
    setSaving(true);
    try {
      await reviewApi.report(reviewId, reason.trim());
      setReported(true);
      setOpen(false);
      setReason('');
      show('Đã gửi báo cáo đánh giá để kiểm duyệt', 'success');
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể báo cáo đánh giá'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Pressable disabled={reported} onPress={begin} style={styles.trigger}>
      <Ionicons name={reported ? 'checkmark-circle-outline' : 'flag-outline'} size={13} color={reported ? Colors.success : Colors.textMuted}/>
      <Text style={[styles.triggerText, reported && styles.reported]}>{reported ? 'Đã báo cáo' : 'Báo cáo'}</Text>
    </Pressable>
    <AppModal visible={open} title="Báo cáo đánh giá" onClose={() => setOpen(false)}>
      <View style={styles.modal}>
        <Text style={styles.help}>Chỉ báo cáo nội dung spam, xúc phạm, sai sự thật hoặc không liên quan đến dịch vụ.</Text>
        <AppInput label="Lý do báo cáo" value={reason} onChangeText={setReason} multiline numberOfLines={4} maxLength={500} placeholder="Mô tả nội dung không phù hợp..." style={styles.input}/>
        <AppButton title="Gửi báo cáo" loading={saving} onPress={() => void submit()}/>
      </View>
    </AppModal>
  </>;
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingTop: 8 },
  triggerText: { fontFamily: FontFamily.bodyMedium, fontSize: 8, color: Colors.textMuted },
  reported: { color: Colors.success },
  modal: { gap: 13, paddingBottom: 12 },
  help: { fontFamily: FontFamily.body, fontSize: 10, lineHeight: 16, color: Colors.textSecondary },
  input: { minHeight: 105, textAlignVertical: 'top', paddingTop: 12 },
});
