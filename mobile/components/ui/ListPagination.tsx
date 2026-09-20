import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius } from '@/constants/theme';

export function ListPagination({page,totalPages,onChange}:{page:number;totalPages:number;onChange:(page:number)=>void}){
  if(totalPages<=1)return null;
  return <View style={styles.wrap}><Pressable disabled={page<=1} onPress={()=>onChange(page-1)} style={[styles.button,page<=1&&styles.disabled]}><Text style={styles.text}>‹ Trước</Text></Pressable><Text style={styles.page}>{page}/{totalPages}</Text><Pressable disabled={page>=totalPages} onPress={()=>onChange(page+1)} style={[styles.button,page>=totalPages&&styles.disabled]}><Text style={styles.text}>Sau ›</Text></Pressable></View>;
}
const styles=StyleSheet.create({wrap:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,marginTop:8},button:{paddingHorizontal:13,paddingVertical:9,borderRadius:Radius.pill,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.surface},disabled:{opacity:.35},text:{fontFamily:FontFamily.bodySemiBold,fontSize:10,color:Colors.primary},page:{fontFamily:FontFamily.bodySemiBold,fontSize:10,color:Colors.textSecondary}});
