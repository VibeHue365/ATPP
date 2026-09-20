import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { refundApi, type CustomerRefund, type RefundEligibility } from '@/apis/refundApi';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/apiError';

const money=(value=0)=>new Intl.NumberFormat('vi-VN').format(value)+'đ';
const labels:Record<string,string>={PENDING:'Chờ duyệt',APPROVED:'Đã duyệt',PROCESSING:'Đang xử lý',COMPLETED:'Hoàn tiền thành công',REJECTED:'Đã từ chối',FAILED:'Xử lý thất bại'};
const bookingIdOf=(refund:CustomerRefund)=>typeof refund.bookingId==='string'?refund.bookingId:refund.bookingId?._id;

export function CustomerRefundPanel({bookingId}:{bookingId:string}){
  const{show}=useToast();
  const[eligibility,setEligibility]=useState<RefundEligibility|null>(null);
  const[refunds,setRefunds]=useState<CustomerRefund[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const[open,setOpen]=useState(false);
  const[reason,setReason]=useState('');
  const[submitting,setSubmitting]=useState(false);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{const[nextEligibility,mine]=await Promise.all([refundApi.eligibility(bookingId),refundApi.mine()]);setEligibility(nextEligibility);setRefunds(mine.filter(item=>bookingIdOf(item)===bookingId));}catch(cause){setError(getApiErrorMessage(cause,'Không thể tải thông tin hoàn tiền.'));}finally{setLoading(false)}},[bookingId]);
  useEffect(()=>{void load()},[load]);
  const active=useMemo(()=>refunds.some(item=>['PENDING','APPROVED','PROCESSING'].includes(item.status)),[refunds]);
  const submit=async()=>{if(!reason.trim()||!eligibility?.eligible)return;setSubmitting(true);try{await refundApi.create(bookingId,eligibility.estimatedRefundAmount,reason.trim());setReason('');setOpen(false);show('Đã gửi yêu cầu hoàn tiền','success');await load();}catch(cause){show(getApiErrorMessage(cause,'Không thể gửi yêu cầu hoàn tiền.'),'error')}finally{setSubmitting(false)}};
  return <View style={styles.card}><View style={styles.heading}><Ionicons name="cash-outline" size={21} color={Colors.primary}/><View style={{flex:1}}><Text style={styles.title}>Hoàn tiền</Text><Text style={styles.sub}>Theo dõi số tiền có thể hoàn và trạng thái xử lý.</Text></View>{loading&&<ActivityIndicator color={Colors.primary}/>}</View>
    {error?<Pressable onPress={()=>void load()} style={styles.error}><Text style={styles.errorText}>{error} Nhấn để thử lại.</Text></Pressable>:null}
    {!loading&&eligibility?<><View style={styles.grid}><Stat label="ĐÃ THANH TOÁN" value={money(eligibility.capturedAmount)}/><Stat label="ĐÃ HOÀN" value={money(eligibility.completedRefundAmount)} success/><Stat label="ĐANG GIỮ" value={money(eligibility.reservedRefundAmount)}/><Stat label="CÓ THỂ HOÀN" value={money(eligibility.maximumRefundableAmount)} accent/></View>{eligibility.reason?<Text style={styles.note}>{eligibility.reason}</Text>:null}{eligibility.eligible&&!active?<AppButton title={`Yêu cầu hoàn ${money(eligibility.estimatedRefundAmount)}`} variant="secondary" onPress={()=>setOpen(true)}/>:null}{active?<Text style={styles.pending}>Yêu cầu hoàn tiền đang được xử lý.</Text>:null}</>:null}
    {refunds.length>0?<View style={styles.history}><Text style={styles.historyTitle}>Lịch sử yêu cầu</Text>{refunds.map(item=><View key={item._id} style={styles.historyRow}><View style={{flex:1}}><Text style={styles.historyReason} numberOfLines={2}>{item.reason||'Yêu cầu hoàn tiền'}</Text><Text style={styles.historyDate}>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</Text></View><View style={{alignItems:'flex-end'}}><Text style={styles.historyAmount}>{money(item.processedAmount??item.approvedAmount??item.amount)}</Text><Text style={[styles.historyStatus,item.status==='COMPLETED'&&{color:Colors.success},['REJECTED','FAILED'].includes(item.status)&&{color:Colors.error}]}>{labels[item.status]??item.status}</Text></View></View>)}</View>:null}
    <AppModal visible={open} title="Yêu cầu hoàn tiền" onClose={()=>setOpen(false)}><Text style={styles.modalCopy}>Số tiền dự kiến: {money(eligibility?.estimatedRefundAmount)}. Bộ phận phụ trách sẽ kiểm tra trước khi hoàn tiền.</Text><TextInput value={reason} onChangeText={setReason} multiline maxLength={500} placeholder="Nhập lý do yêu cầu hoàn tiền..." placeholderTextColor={Colors.textMuted} style={styles.input}/><AppButton title="Gửi yêu cầu" loading={submitting} disabled={!reason.trim()} onPress={()=>void submit()}/></AppModal>
  </View>;
}

function Stat({label,value,accent,success}:{label:string;value:string;accent?:boolean;success?:boolean}){return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={[styles.statValue,accent&&{color:Colors.primary},success&&{color:Colors.success}]}>{value}</Text></View>}
const styles=StyleSheet.create({card:{padding:15,borderRadius:Radius.lg,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,gap:12},heading:{flexDirection:'row',alignItems:'center',gap:10},title:{fontFamily:FontFamily.display,fontSize:18,color:Colors.text},sub:{fontFamily:FontFamily.body,fontSize:9,lineHeight:14,color:Colors.textMuted,marginTop:2},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},stat:{width:'48%',padding:10,borderRadius:Radius.sm,backgroundColor:Colors.background},statLabel:{fontFamily:FontFamily.bodyBold,fontSize:7,color:Colors.textMuted},statValue:{fontFamily:FontFamily.bodyBold,fontSize:11,color:Colors.text,marginTop:5},note:{fontFamily:FontFamily.body,fontSize:9,lineHeight:14,color:Colors.textSecondary},pending:{fontFamily:FontFamily.bodySemiBold,fontSize:10,color:Colors.warning,backgroundColor:Colors.warningSoft,padding:10,borderRadius:Radius.sm},error:{backgroundColor:Colors.errorSoft,padding:10,borderRadius:Radius.sm},errorText:{fontFamily:FontFamily.body,fontSize:9,color:Colors.error},history:{gap:8,borderTopWidth:1,borderTopColor:Colors.border,paddingTop:10},historyTitle:{fontFamily:FontFamily.bodyBold,fontSize:10,color:Colors.text},historyRow:{flexDirection:'row',gap:8,paddingVertical:7,borderBottomWidth:1,borderBottomColor:Colors.border},historyReason:{fontFamily:FontFamily.bodyMedium,fontSize:9,color:Colors.text},historyDate:{fontFamily:FontFamily.body,fontSize:8,color:Colors.textMuted,marginTop:3},historyAmount:{fontFamily:FontFamily.bodyBold,fontSize:9,color:Colors.primary},historyStatus:{fontFamily:FontFamily.bodySemiBold,fontSize:8,color:Colors.warning,marginTop:3},modalCopy:{fontFamily:FontFamily.body,fontSize:11,lineHeight:17,color:Colors.textSecondary,marginBottom:Spacing.md},input:{minHeight:90,textAlignVertical:'top',borderWidth:1,borderColor:Colors.border,borderRadius:Radius.md,padding:12,fontFamily:FontFamily.body,fontSize:11,color:Colors.text,marginBottom:Spacing.md}});
