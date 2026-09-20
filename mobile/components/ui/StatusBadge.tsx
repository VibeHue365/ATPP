import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius } from '@/constants/theme';
type Tone='neutral'|'success'|'warning'|'error'|'primary'|'info';
const tones={neutral:{bg:'#F2EFED',text:Colors.textSecondary},success:{bg:Colors.successSoft,text:Colors.success},warning:{bg:Colors.warningSoft,text:Colors.warning},error:{bg:Colors.errorSoft,text:Colors.error},primary:{bg:Colors.primarySoft,text:Colors.primary},info:{bg:'#EEF4FF',text:'#3F6DC4'}};
export function StatusBadge({label,tone='neutral'}:{label:string;tone?:Tone}){const color=tones[tone];return <View style={[styles.badge,{backgroundColor:color.bg}]}><Text style={[styles.text,{color:color.text}]}>{label}</Text></View>}
const styles=StyleSheet.create({badge:{alignSelf:'flex-start',paddingHorizontal:9,paddingVertical:5,borderRadius:Radius.pill},text:{fontFamily:FontFamily.bodySemiBold,fontSize:10}});
