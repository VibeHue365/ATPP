import { StyleSheet, View, type ViewProps } from 'react-native';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
export function AppCard({ style, ...props }: ViewProps) { return <View style={[styles.card, style]} {...props}/>; }
const styles=StyleSheet.create({card:{backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.lg,padding:Spacing.lg,...Shadow}});
