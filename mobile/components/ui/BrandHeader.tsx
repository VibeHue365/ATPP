import { Ionicons } from '@expo/vector-icons';
import { type Href,router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/contexts/NotificationContext';

export function BrandHeader() {
  const {unreadCount}=useNotifications();
  const actions=[{name:'search' as const,route:'/(tabs)/rentals'},{name:'heart-outline' as const,route:'/favorites'},{name:'notifications-outline' as const,route:'/notifications'}];
  return <View style={styles.root}>
    <View style={styles.brand}><View style={styles.mark}><Text style={styles.markText}>L</Text></View><View><Text style={styles.name}>LUMÉ</Text><Text style={styles.tagline}>ÁO DÀI & CHỤP ẢNH</Text></View></View>
    <View style={styles.actions}>{actions.map(action => <Pressable accessibilityLabel={action.name==='search'?'Tìm kiếm':action.name==='heart-outline'?'Yêu thích':'Thông báo'} onPress={()=>router.push(action.route as Href)} key={action.name} style={styles.icon}><Ionicons name={action.name} size={20} color={Colors.text} />{action.name==='notifications-outline'&&unreadCount>0&&<View style={styles.badge}><Text style={styles.badgeText}>{Math.min(unreadCount,9)}</Text></View>}</Pressable>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 }, actions: { flexDirection: 'row', gap: 8 },
  mark: { width: 34, height: 34, borderRadius: Radius.pill, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  markText: { color: Colors.white, fontFamily: FontFamily.display, fontSize: 15 },
  name: { color: Colors.primary, fontFamily: FontFamily.display, fontSize: 17, letterSpacing: 1.5 },
  tagline: { color: Colors.textMuted, fontFamily: FontFamily.bodyMedium, fontSize: 8, letterSpacing: 0.8 },
  icon: { width: 36, height: 36, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },badge:{position:'absolute',right:-2,top:-3,minWidth:16,height:16,borderRadius:99,paddingHorizontal:3,backgroundColor:Colors.primary,alignItems:'center',justifyContent:'center'},badgeText:{fontFamily:FontFamily.bodyBold,fontSize:8,color:Colors.white},
});
