import React from 'react';
import { Tabs, router, type Href } from 'expo-router';
import {
  ProviderBottomTabBar,
  type ProviderTab,
} from '@/components/provider/ProviderBottomTabBar';

export default function ProviderTabsLayout() {
  return (
    <Tabs
      tabBar={({ state, navigation }) => {
        const routeName = state.routes[state.index]?.name;
        let currentTab: ProviderTab = 'today';
        if (routeName === 'orders') currentTab = 'orders';
        else if (routeName === 'schedules') currentTab = 'schedules';
        else if (routeName === 'store') currentTab = 'store';

        return (
          <ProviderBottomTabBar
            currentTab={currentTab}
            onSelectTab={(tab) => {
              if (tab === 'today') navigation.navigate('index');
              else if (tab === 'orders') navigation.navigate('orders');
              else if (tab === 'schedules') navigation.navigate('schedules');
              else if (tab === 'store') navigation.navigate('store');
            }}
            onOpenQrScanner={() => {
              router.push('/provider/qr-scanner' as Href);
            }}
          />
        );
      }}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hôm nay' }} />
      <Tabs.Screen name="orders" options={{ title: 'Đơn hàng' }} />
      <Tabs.Screen name="schedules" options={{ title: 'Lịch hẹn' }} />
      <Tabs.Screen name="store" options={{ title: 'Cửa hàng' }} />
    </Tabs>
  );
}
