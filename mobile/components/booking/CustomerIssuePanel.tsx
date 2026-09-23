import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { bookingApi, type BookingIncident } from '@/apis/bookingApi';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';
import type { Booking } from '@/types/booking';
import { getApiErrorMessage } from '@/utils/apiError';
import { getMediaUrl } from '@/utils/media';

type IssueType='DAMAGE'|'REJECT';
const money=(value=0)=>new Intl.NumberFormat('vi-VN').format(value)+'đ';

export function CustomerIssuePanel({booking,onSuccess}:{booking:Booking;onSuccess:()=>Promise<void>}){
  const {show}=useToast();
  const [incident,setIncident]=useState<BookingIncident|null>(null);
  const [type,setType]=useState<IssueType|null>(null);
  const [description,setDescription]=useState('');
  const [photos,setPhotos]=useState<string[]>([]);
  const [saving,setSaving]=useState(false);
  const rental=booking.items.some(item=>item.itemType==='PRODUCT');
  const canInspect=rental&&booking.status==='PICKUP_PENDING';

  useEffect(()=>{let active=true;if(!rental)return;bookingApi.incident(booking._id).then(value=>{if(active)setIncident(value)}).catch(error=>{if(active&&!(error instanceof AxiosError&&error.response?.status===404))setIncident(null)});return()=>{active=false}},[booking._id,rental]);

  const pick=async()=>{const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted){show('Cần quyền truy cập thư viện ảnh','error');return}const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,selectionLimit:5,quality:.8});if(result.canceled)return;setSaving(true);try{const urls:string[]=[];for(const asset of result.assets){const body=new FormData();body.append('file',asset.file??({uri:asset.uri,name:asset.fileName??`evidence-${Date.now()}.jpg`,type:asset.mimeType??'image/jpeg'} as unknown as Blob));const uploaded=await bookingApi.uploadEvidence(body);urls.push(uploaded.url)}setPhotos(current=>[...current,...urls].slice(0,5));show('Đã tải ảnh bằng chứng','success')}catch(error){show(getApiErrorMessage(error,'Không thể tải ảnh bằng chứng'),'error')}finally{setSaving(false)}};
  const submit=async()=>{if(!type||!description.trim()){show('Vui lòng mô tả tình trạng trang phục','error');return}if(!photos.length){show('Cần ít nhất một ảnh bằng chứng','error');return}setSaving(true);try{if(type==='DAMAGE')await bookingApi.reportRentalDamage(booking._id,description.trim(),photos);else await bookingApi.rejectRentalHandover(booking._id,description.trim(),photos);setType(null);setDescription('');setPhotos([]);show(type==='DAMAGE'?'Đã ghi nhận lỗi trang phục':'Đã gửi yêu cầu từ chối nhận áo','success');await onSuccess()}catch(error){show(getApiErrorMessage(error,'Không thể gửi báo cáo'),'error')}finally{setSaving(false)}};
  const respond=(agree:boolean)=>Alert.alert(agree?'Đồng ý bồi thường':'Yêu cầu xem xét','Bạn có chắc với lựa chọn này?',[{text:'Hủy',style:'cancel'},{text:'Xác nhận',style:agree?'default':'destructive',onPress:async()=>{if(!incident)return;setSaving(true);try{if(agree)await bookingApi.agreeIncident(incident._id);else await bookingApi.disagreeIncident(incident._id);show(agree?'Đã xác nhận phương án bồi thường':'Đã chuyển yêu cầu sang tranh chấp','success');setIncident({...incident,status:agree?'ACCEPTED':'DISPUTED'});await onSuccess()}catch(error){show(getApiErrorMessage(error,'Không thể gửi phản hồi'),'error')}finally{setSaving(false)}}}]);

  return <>
    {canInspect&&<View style={styles.box}><Text style={styles.title}>Kiểm tra áo trước khi nhận</Text><Text style={styles.copy}>Nếu áo có lỗi, hãy gửi ảnh trước khi xác nhận nhận để bảo vệ tiền cọc.</Text><View style={styles.actions}><AppButton title="Báo lỗi nhẹ" variant="secondary" onPress={()=>setType('DAMAGE')}/><AppButton title="Từ chối nhận" variant="danger" onPress={()=>setType('REJECT')}/></View></View>}
    {incident&&<View style={styles.incident}><View style={styles.row}><Text style={styles.title}>Yêu cầu bồi thường từ cửa hàng</Text><StatusBadge label={incident.status==='PENDING_CUSTOMER'?'Chờ phản hồi':incident.status==='ACCEPTED'?'Đã đồng ý':incident.status==='DISPUTED'?'Đang tranh chấp':'Đã xử lý'} tone={incident.status==='PENDING_CUSTOMER'?'warning':incident.status==='ACCEPTED'||incident.status==='RESOLVED'?'success':'error'}/></View><Text style={styles.copy}>{incident.description}</Text><Text style={styles.amount}>Số tiền đề nghị: {money(incident.requestedAmount)}</Text>{!!incident.evidencePhotos?.length&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>{incident.evidencePhotos.map((uri,index)=><Image key={`${uri}-${index}`} source={{uri:getMediaUrl(uri)}} style={styles.image}/>)}</ScrollView>}{incident.status==='PENDING_CUSTOMER'&&<View style={styles.actions}><AppButton title="Không đồng ý" variant="secondary" loading={saving} onPress={()=>respond(false)}/><AppButton title="Đồng ý bồi thường" loading={saving} onPress={()=>respond(true)}/></View>}</View>}
    <AppModal visible={Boolean(type)} title={type==='DAMAGE'?'Báo lỗi khi nhận áo':'Từ chối nhận áo'} onClose={()=>setType(null)}><Text style={styles.copy}>{type==='DAMAGE'?'Ghi nhận vết bẩn hoặc lỗi nhẹ để tránh bị tính vào tiền cọc khi trả áo.':'Dùng khi áo sai mẫu, hư hỏng nặng hoặc không thể sử dụng.'}</Text><TextInput value={description} onChangeText={setDescription} multiline placeholder="Mô tả chi tiết tình trạng..." placeholderTextColor={Colors.textMuted} style={styles.input}/><Pressable style={styles.upload} onPress={()=>void pick()}><Ionicons name="images-outline" size={18} color={Colors.primary}/><Text style={styles.uploadText}>Chọn ảnh bằng chứng ({photos.length}/5)</Text></Pressable>{!!photos.length&&<ScrollView horizontal contentContainerStyle={styles.images}>{photos.map((uri,index)=><Image key={`${uri}-${index}`} source={{uri:getMediaUrl(uri)}} style={styles.image}/>)}</ScrollView>}<View style={styles.modalActions}><AppButton title="Hủy" variant="secondary" onPress={()=>setType(null)}/><AppButton title="Gửi báo cáo" loading={saving} onPress={()=>void submit()}/></View></AppModal>
  </>;
}

const styles=StyleSheet.create({box:{padding:15,borderWidth:1,borderColor:'#E8CF91',borderRadius:Radius.lg,backgroundColor:Colors.warningSoft,gap:7},incident:{padding:15,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.lg,backgroundColor:Colors.surface,gap:8},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},title:{flex:1,fontFamily:FontFamily.bodyBold,fontSize:12,color:Colors.text},copy:{fontFamily:FontFamily.body,fontSize:10,lineHeight:16,color:Colors.textSecondary},amount:{fontFamily:FontFamily.bodyBold,fontSize:11,color:Colors.primary},actions:{gap:8,marginTop:6},input:{minHeight:105,textAlignVertical:'top',borderWidth:1,borderColor:Colors.border,borderRadius:Radius.md,padding:12,fontFamily:FontFamily.body,fontSize:11,color:Colors.text,marginTop:12},upload:{height:44,marginTop:10,borderWidth:1,borderStyle:'dashed',borderColor:Colors.primary,borderRadius:Radius.md,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},uploadText:{fontFamily:FontFamily.bodySemiBold,fontSize:10,color:Colors.primary},images:{gap:8,paddingVertical:8},image:{width:76,height:76,borderRadius:Radius.sm,backgroundColor:Colors.surfaceSoft},modalActions:{gap:8,marginTop:Spacing.sm}});
