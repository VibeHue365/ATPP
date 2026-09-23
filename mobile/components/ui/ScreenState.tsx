import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { Colors, FontFamily } from '@/constants/theme';
export function LoadingState({label='Đang tải...'}:{label?:string}){return <View style={s.root}><ActivityIndicator color={Colors.primary} size="large"/><Text style={s.copy}>{label}</Text></View>}
export function EmptyState({title='Chưa có dữ liệu',message='Nội dung sẽ xuất hiện tại đây khi có dữ liệu.'}:{title?:string;message?:string}){return <View style={s.root}><Ionicons name="file-tray-outline" size={42} color={Colors.textMuted}/><Text style={s.title}>{title}</Text><Text style={s.copy}>{message}</Text></View>}
export function ErrorState({message='Đã có lỗi xảy ra.',onRetry}:{message?:string;onRetry?:()=>void}){return <View style={s.root}><Ionicons name="alert-circle-outline" size={42} color={Colors.error}/><Text style={s.title}>Không thể tải dữ liệu</Text><Text style={s.copy}>{message}</Text>{onRetry&&<AppButton title="Thử lại" fullWidth={false} onPress={onRetry}/>}</View>}
const s=StyleSheet.create({root:{padding:32,alignItems:'center',justifyContent:'center',gap:12},title:{fontFamily:FontFamily.bodyBold,fontSize:16,color:Colors.text},copy:{fontFamily:FontFamily.body,fontSize:13,lineHeight:20,color:Colors.textSecondary,textAlign:'center'}});
