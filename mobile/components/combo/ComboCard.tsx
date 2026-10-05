import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import type { ComboDeal } from '@/types/combo';
import { comboOriginalPrice, comboPublishedPrice } from '@/types/combo';
import { getMediaUrl } from '@/utils/media';

const money = (value:number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
export function ComboCard({ combo }: { combo: ComboDeal }) {
  const image = combo.image ?? combo.images?.[0] ?? combo.photographyPackageId?.images?.[0] ?? combo.productId?.images?.[0];
  return <Pressable style={s.card} onPress={() => router.push(`/combos/${combo._id}` as Href)}>
    <View style={s.imageWrap}><Image source={getMediaUrl(image)} style={s.image} contentFit="cover"/><View style={s.badge}><Text style={s.badgeText}>TIẾT KIỆM {combo.discountPercent}%</Text></View></View>
    <View style={s.body}><Text style={s.location}>{combo.providerId?.address?.city ?? 'MIỀN TRUNG'} · {combo.shootPeopleCount ?? combo.photographyPackageId?.maxPeople ?? 1} NGƯỜI</Text><Text style={s.title} numberOfLines={2}>{combo.name}</Text><Text style={s.desc} numberOfLines={2}>{combo.productId?.name} + {combo.photographyPackageId?.name}</Text>
      <View style={s.priceRow}><View><Text style={s.old}>{money(comboOriginalPrice(combo))}</Text><Text style={s.price}>{money(comboPublishedPrice(combo))}</Text></View><View style={s.detail}><Text style={s.detailText}>Xem combo</Text><Ionicons name="arrow-forward" size={14} color={Colors.white}/></View></View>
    </View>
  </Pressable>;
}
const s=StyleSheet.create({card:{backgroundColor:Colors.surface,borderRadius:Radius.lg,overflow:'hidden',borderWidth:1,borderColor:Colors.border,...Shadow},imageWrap:{height:178,backgroundColor:Colors.surfaceSoft},image:{width:'100%',height:'100%'},badge:{position:'absolute',left:12,top:12,backgroundColor:Colors.primary,borderRadius:Radius.pill,paddingHorizontal:10,paddingVertical:6},badgeText:{fontFamily:FontFamily.bodyBold,fontSize:8,color:Colors.white},body:{padding:14},location:{fontFamily:FontFamily.bodyBold,fontSize:8,color:Colors.primary},title:{fontFamily:FontFamily.display,fontSize:19,lineHeight:25,color:Colors.text,marginTop:5},desc:{fontFamily:FontFamily.body,fontSize:10,lineHeight:16,color:Colors.textMuted,marginTop:5},priceRow:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginTop:13},old:{fontFamily:FontFamily.body,fontSize:9,color:Colors.textMuted,textDecorationLine:'line-through'},price:{fontFamily:FontFamily.bodyBold,fontSize:16,color:Colors.primary,marginTop:2},detail:{height:38,paddingHorizontal:13,borderRadius:Radius.md,backgroundColor:Colors.primary,flexDirection:'row',alignItems:'center',gap:6},detailText:{fontFamily:FontFamily.bodySemiBold,fontSize:10,color:Colors.white}});
