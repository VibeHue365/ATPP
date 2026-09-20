import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily } from '@/constants/theme';

export function SectionHeader({ title, action = 'Xem tất cả', onPress }: { title: string; action?: string; onPress?:()=>void }) {
  return <View style={styles.row}><Text style={styles.title}>{title}</Text><Pressable disabled={!onPress} onPress={onPress}><Text style={styles.action}>{action} ›</Text></Pressable></View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, title: { color: Colors.text, fontFamily: FontFamily.display, fontSize: 21 }, action: { color: Colors.primary, fontFamily: FontFamily.bodyMedium, fontSize: 12 } });
