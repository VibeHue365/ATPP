import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Colors, FontFamily, Radius } from '@/constants/theme';

interface Props extends TextInputProps { label?: string; error?: string; hint?: string; }
export const AppInput = forwardRef<TextInput, Props>(({ label, error, hint, style, accessibilityLabel, onFocus, onBlur, ...props }, ref) => { const [focused,setFocused]=useState(false); return <View style={styles.wrap}>{label&&<Text style={styles.label}>{label}</Text>}<TextInput {...props} ref={ref} accessibilityLabel={accessibilityLabel??label} placeholderTextColor={Colors.textMuted} style={[styles.input,focused&&styles.focused,error&&styles.invalid,style]} onFocus={e=>{setFocused(true);onFocus?.(e)}} onBlur={e=>{setFocused(false);onBlur?.(e)}}/>{error?<Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>:hint?<Text style={styles.hint}>{hint}</Text>:null}</View> });
AppInput.displayName='AppInput';
const styles=StyleSheet.create({wrap:{gap:6},label:{fontFamily:FontFamily.bodySemiBold,fontSize:11,color:Colors.textSecondary},input:{minHeight:48,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.md,backgroundColor:Colors.surface,paddingHorizontal:14,fontFamily:FontFamily.body,fontSize:14,color:Colors.text},focused:{borderColor:Colors.primary},invalid:{borderColor:Colors.error},error:{fontFamily:FontFamily.body,fontSize:11,color:Colors.error},hint:{fontFamily:FontFamily.body,fontSize:11,color:Colors.textMuted}});
