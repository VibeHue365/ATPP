import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { bookingApi } from '@/apis/bookingApi';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppModal } from '@/components/ui/AppModal';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';
import type { BookingSchedule } from '@/types/booking';
import { getApiErrorMessage } from '@/utils/apiError';

interface Props { visible:boolean; bookingId:string; schedule:BookingSchedule|null; onClose:()=>void; onSuccess:()=>Promise<void>|void; }
export function LocationChangeModal({visible,bookingId,schedule,onClose,onSuccess}:Props){const{show}=useToast();const[address,setAddress]=useState('');const[latitude,setLatitude]=useState('');const[longitude,setLongitude]=useState('');const[note,setNote]=useState('');const[saving,setSaving]=useState(false);
  useEffect(()=>{if(!visible||!schedule)return;const coordinates=schedule.locationSnapshot?.geo?.coordinates??[];setAddress(schedule.locationAddress??schedule.locationSnapshot?.address??'');setLongitude(coordinates[0]!=null?String(coordinates[0]):'');setLatitude(coordinates[1]!=null?String(coordinates[1]):'');setNote('')},[visible,schedule]);
  const submit=async()=>{if(!schedule)return;const lat=Number(latitude),lng=Number(longitude);if(!address.trim()||!Number.isFinite(lat)||!Number.isFinite(lng)){show('Vui lòng nhập địa chỉ và tọa độ hợp lệ','error');return}setSaving(true);try{await bookingApi.requestLocationChange(bookingId,schedule._id,{address:address.trim(),latitude:lat,longitude:lng,note:note.trim()||undefined});show('Đã gửi yêu cầu đổi địa điểm','success');onClose();await onSuccess()}catch(cause){show(getApiErrorMessage(cause,'Không thể gửi yêu cầu đổi địa điểm'),'error')}finally{setSaving(false)}};
  return <AppModal visible={visible} title="Đổi địa điểm chụp" onClose={onClose}><ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><Text style={s.note}>Nhập địa chỉ mới và tọa độ lấy từ Google Maps. Photographer sẽ xác nhận trước khi địa điểm thay đổi.</Text><AppInput label="ĐỊA CHỈ MỚI" value={address} onChangeText={setAddress} multiline/><AppInput label="VĨ ĐỘ (LATITUDE)" value={latitude} onChangeText={setLatitude} keyboardType="numbers-and-punctuation" placeholder="16.4637"/><AppInput label="KINH ĐỘ (LONGITUDE)" value={longitude} onChangeText={setLongitude} keyboardType="numbers-and-punctuation" placeholder="107.5847"/><AppInput label="GHI CHÚ (TÙY CHỌN)" value={note} onChangeText={setNote} multiline maxLength={500}/><AppButton title="Gửi yêu cầu" loading={saving} onPress={()=>void submit()}/></ScrollView></AppModal>}
const s=StyleSheet.create({scroll:{maxHeight:570},content:{gap:Spacing.md,paddingBottom:Spacing.sm},note:{fontFamily:FontFamily.body,fontSize:10,lineHeight:16,color:Colors.textSecondary,backgroundColor:Colors.primarySoft,padding:12,borderRadius:Radius.sm}});
