import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type ViewStyle } from 'react-native';
import { Colors, FontFamily, Radius } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface Props extends PressableProps { title: string; variant?: Variant; loading?: boolean; fullWidth?: boolean; }

export function AppButton({ title, variant = 'primary', loading, disabled, fullWidth = true, style, accessibilityLabel, accessibilityState, ...props }: Props) {
  const unavailable=Boolean(disabled||loading);
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel??title} accessibilityState={{...accessibilityState,disabled:unavailable,busy:Boolean(loading)}} disabled={unavailable} style={state => [styles.base, styles[variant], fullWidth && styles.full, state.pressed && styles.pressed, unavailable && styles.disabled, typeof style==='function'?style(state):style as ViewStyle]} {...props}>
    {loading ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? Colors.white : Colors.primary} /> : <Text style={[styles.label, styles[`${variant}Label`]]}>{title}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({base:{minHeight:48,paddingHorizontal:18,borderRadius:Radius.md,alignItems:'center',justifyContent:'center'},full:{width:'100%'},primary:{backgroundColor:Colors.primary},secondary:{backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border},ghost:{backgroundColor:'transparent'},danger:{backgroundColor:Colors.error},pressed:{opacity:.82},disabled:{opacity:.5},label:{fontFamily:FontFamily.bodySemiBold,fontSize:14},primaryLabel:{color:Colors.white},secondaryLabel:{color:Colors.text},ghostLabel:{color:Colors.primary},dangerLabel:{color:Colors.white}});
