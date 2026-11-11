import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { userApi } from '@/apis/userApi';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { safeReturnTo } from '@/utils/navigation';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/apiError';

const stylesList = [
  ['TRADITIONAL', 'Cổ phục Truyền thống'],
  ['MODERN', 'Áo dài Cách tân'],
  ['EDGY', 'Đương đại Phá cách'],
] as const;
const colors = [
  ['PASTEL', 'Pastel Dịu nhẹ'],
  ['RED_GOLD', 'Đỏ Son · Hoàng Kim'],
  ['DARK', 'Tông Trầm Di sản'],
  ['COLORFUL', 'Rực rỡ Lễ hội'],
] as const;
const occasions = [
  ['GRADUATION', 'Kỷ yếu · Tốt nghiệp'],
  ['WEDDING', 'Cưới hỏi · Lễ gia tiên'],
  ['FESTIVAL', 'Lễ hội · Du xuân Cố đô'],
  ['EVENT', 'Sự kiện · Ngoại cảnh'],
] as const;
const materials = [
  ['SILK', 'Lụa Tơ tằm'],
  ['VELVET', 'Nhung The'],
  ['BROCADE', 'Gấm Thêu'],
  ['ORGANZA', 'Organza Tơ óng'],
  ['LINEN', 'Linen Mộc'],
] as const;
const sizes = ['S', 'M', 'L', 'XL', 'XXL'];

export default function Route() {
  return (
    <RequireAuth>
      <Preferences />
    </RequireAuth>
  );
}

function Preferences() {
  const { onboarding, returnTo } = useLocalSearchParams<{
    onboarding?: string;
    returnTo?: string;
  }>();
  const isOnboarding = onboarding === '1';
  const { refreshUser } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [color, setColor] = useState<string | null>(null);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [size, setSize] = useState<string | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  useEffect(() => {
    userApi
      .me()
      .then((user) => {
        const value = user.preferences ?? {};
        setSelectedStyles(value.preferredAoDaiStyles ?? []);
        setColor(value.favoriteColors?.[0] ?? null);
        setSelectedOccasions(value.preferredOccasions ?? []);
        setSelectedMaterials(value.preferredMaterials ?? []);
        setSize(value.sizeInfo?.preferredSize ?? null);
        setHeight(value.sizeInfo?.height != null ? String(value.sizeInfo.height) : '');
        setWeight(value.sizeInfo?.weight != null ? String(value.sizeInfo.weight) : '');
      })
      .catch((cause) => show(getApiErrorMessage(cause, 'Không thể tải sở thích'), 'error'))
      .finally(() => setLoading(false));
  }, [show]);

  const save = async () => {
    if (isOnboarding && (!selectedStyles.length || !size || !selectedOccasions.length)) {
      show('Vui lòng chọn phong cách, kích cỡ và ít nhất một dịp sử dụng', 'error');
      return;
    }
    setSaving(true);
    try {
      await userApi.updatePreferences(
        {
          preferredAoDaiStyles: selectedStyles,
          favoriteColors: color ? [color] : [],
          preferredOccasions: selectedOccasions,
          preferredMaterials: selectedMaterials,
          sizeInfo: {
            preferredSize: size,
            height: height ? Number(height) : null,
            weight: weight ? Number(weight) : null,
          },
        },
        { completeOnboarding: isOnboarding ? true : undefined },
      );
      await refreshUser();
      show(
        isOnboarding ? 'Đã hoàn tất thiết lập sở thích' : 'Đã lưu hồ sơ số đo & sở thích',
        'success',
      );
      if (isOnboarding) router.replace(safeReturnTo(returnTo, '/(tabs)/rentals'));
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể lưu sở thích'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setSaving(true);
    try {
      await userApi.completeOnboarding();
      await refreshUser();
      router.replace(safeReturnTo(returnTo, '/(tabs)/rentals'));
    } catch (cause) {
      show(getApiErrorMessage(cause, 'Không thể hoàn tất onboarding'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Đang tải hồ sơ sở thích..." />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        {isOnboarding ? (
          <View style={s.spacer} />
        ) : (
          <Pressable onPress={() => router.back()} style={s.back}>
            <Ionicons name="chevron-back" size={20} color="#1E1418" />
          </Pressable>
        )}
        <View style={{ alignItems: 'center' }}>
          <Text style={s.eyebrow}>TÀGO STYLE DNA</Text>
          <Text style={s.title}>
            {isOnboarding ? 'Thiết lập Sở thích' : 'Gu Thẩm mỹ & Số đo'}
          </Text>
        </View>
        <View style={s.spacer} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.onboardingNotice}>
          <View style={s.noticeIconWrap}>
            <Ionicons name="sparkles" size={18} color="#BA0049" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.onboardingTitle}>Cá nhân hóa AI Stylist Cố đô</Text>
            <Text style={s.onboardingCopy}>
              Thông tin này giúp TàGo tự động gợi ý đúng kích cỡ Áo dài, tông màu tôn da và bối
              cảnh chụp ảnh phù hợp nhất với bạn.
            </Text>
          </View>
        </View>

        <Group title="Phong cách Áo dài yêu thích" hint="Bạn có thể chọn nhiều phong cách.">
          <MultiChips
            values={stylesList}
            selected={selectedStyles}
            onChange={setSelectedStyles}
          />
        </Group>

        <Group title="Bảng màu tôn da ưa chuộng">
          <Chips values={colors} selected={color} onChange={setColor} />
        </Group>

        <Group title="Chất liệu thủ công" hint="Chọn chất liệu bạn cảm thấy thoải mái nhất.">
          <MultiChips
            values={materials}
            selected={selectedMaterials}
            onChange={setSelectedMaterials}
          />
        </Group>

        <Group title="Dịp sử dụng thường xuyên" hint="Chọn một hoặc nhiều dịp bạn quan tâm.">
          <MultiChips
            values={occasions}
            selected={selectedOccasions}
            onChange={setSelectedOccasions}
          />
        </Group>

        <Group title="Số đo & Kích cỡ thường mặc" hint="Dùng để AI tự động tính size khi thuê đồ.">
          <View style={s.chips}>
            {sizes.map((value) => (
              <Chip
                key={value}
                value={value}
                label={`Size ${value}`}
                active={size === value}
                onPress={() => setSize(size === value ? null : value)}
              />
            ))}
          </View>
          <View style={s.measure}>
            <AppInput
              label="CHIỀU CAO (CM)"
              value={height}
              onChangeText={setHeight}
              keyboardType="number-pad"
              placeholder="160"
              style={{ flex: 1 }}
            />
            <AppInput
              label="CÂN NẶNG (KG)"
              value={weight}
              onChangeText={setWeight}
              keyboardType="number-pad"
              placeholder="52"
              style={{ flex: 1 }}
            />
          </View>
        </Group>

        <AppButton
          title={isOnboarding ? 'Hoàn tất thiết lập' : 'Lưu hồ sơ thẩm mỹ'}
          loading={saving}
          onPress={() => void save()}
        />
        {isOnboarding ? (
          <Pressable disabled={saving} onPress={() => void skip()} style={s.skip}>
            <Text style={s.skipText}>Bỏ qua, thiết lập sau</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.group}>
      <View>
        <Text style={s.groupTitle}>{title}</Text>
        {hint ? <Text style={s.groupHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Chips({
  values,
  selected,
  onChange,
}: {
  values: readonly (readonly [string, string])[];
  selected: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <View style={s.chips}>
      {values.map(([value, label]) => (
        <Chip
          key={value}
          value={value}
          label={label}
          active={selected === value}
          onPress={() => onChange(selected === value ? null : value)}
        />
      ))}
    </View>
  );
}

function MultiChips({
  values,
  selected,
  onChange,
}: {
  values: readonly (readonly [string, string])[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <View style={s.chips}>
      {values.map(([value, label]) => {
        const active = selected.includes(value);
        return (
          <Chip
            key={value}
            value={value}
            label={label}
            active={active}
            onPress={() =>
              onChange(active ? selected.filter((item) => item !== value) : [...selected, value])
            }
          />
        );
      })}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  value: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[s.chip, active && s.chipOn]}
    >
      <Text style={[s.chipText, active && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FDFBF9' },
  header: {
    height: 66,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE6EA',
  },
  back: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: '#EFE6EA',
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF6F8',
  },
  spacer: { width: 40 },
  eyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: '#BA0049',
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: '#1E1418',
    textAlign: 'center',
  },
  content: { padding: 16, paddingBottom: 40, gap: Spacing.md },
  onboardingNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 15,
    borderRadius: Radius.lg,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F3C4D5',
  },
  noticeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 16,
    color: '#BA0049',
  },
  onboardingCopy: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#5C474F',
    marginTop: 4,
  },
  group: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFE6EA',
    borderRadius: Radius.lg,
    backgroundColor: '#FFFFFF',
    gap: 12,
    ...Shadow,
  },
  groupTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 17,
    color: '#1E1418',
  },
  groupHint: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 16,
    color: '#8C7A82',
    marginTop: 2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EFE6EA',
    borderRadius: Radius.pill,
    backgroundColor: '#FAF6F8',
  },
  chipOn: {
    backgroundColor: '#BA0049',
    borderColor: '#BA0049',
  },
  chipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#4F3F46',
  },
  chipTextOn: { color: Colors.white },
  measure: { flexDirection: 'row', gap: 10, marginTop: 4 },
  skip: { alignItems: 'center', paddingVertical: 10 },
  skipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    color: '#8C7A82',
  },
});
