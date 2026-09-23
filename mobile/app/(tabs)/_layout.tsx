import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Colors, FontFamily } from '@/constants/theme';

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home-outline', rentals: 'sparkles-outline', photography: 'camera-outline', bookings: 'calendar-outline', profile: 'person-outline',
};

export default function TabLayout() {
  return (
    <Tabs screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: Colors.primary,
      tabBarInactiveTintColor: Colors.textMuted,
      tabBarLabelStyle: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
      tabBarStyle: { height: 70, paddingTop: 8, paddingBottom: 8, backgroundColor: Colors.surface, borderTopColor: Colors.border },
      tabBarIcon: ({ color, size, focused }) => {
        const name = icons[route.name] ?? 'ellipse-outline';
        const activeName = name.replace('-outline', '') as keyof typeof Ionicons.glyphMap;
        return <Ionicons name={focused ? activeName : name} color={color} size={size} />;
      },
    })}>
      <Tabs.Screen name="index" options={{ title: 'Khám phá' }} />
      <Tabs.Screen name="rentals" options={{ title: 'Áo dài' }} />
      <Tabs.Screen name="photography" options={{ title: 'Chụp ảnh' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Lịch hẹn' }} />
      <Tabs.Screen name="profile" options={{ title: 'Tài khoản' }} />
    </Tabs>
  );
}
