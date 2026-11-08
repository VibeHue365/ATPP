import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { FontFamily } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#BA0049',
        tabBarInactiveTintColor: '#5F5E5E',
        tabBarLabelStyle: {
          fontFamily: FontFamily.bodySemiBold,
          fontSize: 10,
          marginTop: 2,
        },
        tabBarStyle: {
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: 'rgba(227, 190, 195, 0.25)',
          elevation: 12,
          shadowColor: '#1B1C1C',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 16,
        },
        tabBarIcon: ({ color, focused }) => {
          switch (route.name) {
            case 'index':
              return <Ionicons name={focused ? 'compass' : 'compass-outline'} color={color} size={23} />;
            case 'rentals':
              return <MaterialCommunityIcons name="hanger" color={color} size={23} />;
            case 'photography':
              return <Ionicons name={focused ? 'camera' : 'camera-outline'} color={color} size={23} />;
            case 'bookings':
              return <Ionicons name={focused ? 'calendar' : 'calendar-outline'} color={color} size={22} />;
            case 'profile':
              return <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={22} />;
            default:
              return <Ionicons name="ellipse-outline" color={color} size={22} />;
          }
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Khám phá' }} />
      <Tabs.Screen name="rentals" options={{ title: 'Thuê áo' }} />
      <Tabs.Screen name="photography" options={{ title: 'Thợ ảnh' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Lịch hẹn' }} />
      <Tabs.Screen name="profile" options={{ title: 'Tài khoản' }} />
    </Tabs>
  );
}
