import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type { Photographer } from '@/types/photographer';
import { getMediaUrl } from '@/utils/media';

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
const imageOf = (item: Photographer) => item.defaultPackage?.images?.[0] ?? item.coverImage ?? item.media?.coverUrl ?? item.media?.images?.[0] ?? item.portfolioItems?.[0]?.images?.[0] ?? item.portfolio?.[0];

export function PhotographyCard({ photographer }: { photographer: Photographer }) {
  const pack = photographer.defaultPackage ?? photographer.packages?.[0];
  const { isAuthenticated, isFavorite, toggleFavorite } = useAuth();
  const { show } = useToast();
  const liked = isFavorite('PROVIDER', photographer._id);
  const go = () => router.push(`/photographer/${photographer._id}?packageId=${pack?._id ?? ''}` as unknown as Href);
  const favorite = async (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!isAuthenticated) { router.push('/(auth)/login' as Href); return; }
    try {
      await toggleFavorite('PROVIDER', photographer._id);
      show(liked ? 'Đã bỏ studio khỏi yêu thích' : 'Đã lưu studio vào yêu thích', 'success');
    } catch { show('Không thể cập nhật yêu thích', 'error'); }
  };
  const image = imageOf(photographer);
  return <Pressable style={styles.card} onPress={go}>
    <View style={styles.cover}>
      {image ? <Image source={getMediaUrl(image)} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} /> : <View style={styles.placeholder}><Ionicons name="camera-outline" size={34} color={Colors.white} /><Text style={styles.placeholderTitle}>LUMÉ CONCEPT</Text></View>}
      <View style={styles.overlay} />
      <Text style={styles.category}>{pack?.pricingUnit === 'PER_DAY' ? 'NGOẠI CẢNH' : 'STUDIO'}</Text>
      <Pressable style={styles.heart} onPress={favorite}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={Colors.primary} /></Pressable>
      <Text numberOfLines={2} style={styles.coverTitle}>{pack?.name ?? photographer.quote ?? 'Gói chụp nghệ thuật'}</Text>
    </View>
    <View style={styles.info}>
      <View style={styles.brandRow}><Text numberOfLines={1} style={styles.brand}>{photographer.businessName ?? 'LUMÉ PHOTO'}</Text><Text style={styles.verified}>✓ Đã xác minh</Text></View>
      <Text numberOfLines={2} style={styles.name}>{pack?.name ?? 'Gói chụp ảnh'}</Text>
      <Text style={styles.rating}>★ {(photographer.rating?.averageRating ?? 0).toFixed(1)} <Text style={styles.location}>· {photographer.address?.city ?? 'Miền Trung'}</Text></Text>
      <View style={styles.meta}><Meta value={`${pack?.includedDurationMinutes ?? Math.round((pack?.durationHours ?? 0) * 60)} phút`} label="Thời lượng" /><Meta value={`${pack?.editedPhotosCount ?? 0} ảnh`} label="Chỉnh sửa" /><Meta value={`1–${pack?.maxPeople ?? 2}`} label="Số người" /></View>
      <View style={styles.bottom}><Text style={styles.price}>{money(pack?.price ?? 0)}<Text style={styles.per}> /gói</Text></Text><View style={styles.detail}><Text style={styles.detailText}>Xem chi tiết</Text></View></View>
    </View>
  </Pressable>;
}
function Meta({ value, label }: { value: string; label: string }) { return <View style={styles.metaItem}><Text style={styles.metaValue}>{value}</Text><Text style={styles.metaLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  card:{backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.lg,overflow:'hidden',...Shadow},
  cover:{height:175,backgroundColor:'#A66C78',justifyContent:'flex-end',padding:16},placeholder:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',gap:7},placeholderTitle:{fontFamily:FontFamily.display,color:Colors.white,fontSize:15,letterSpacing:1},overlay:{...StyleSheet.absoluteFill,backgroundColor:'#35131B30'},
  category:{position:'absolute',left:12,top:12,fontFamily:FontFamily.bodyBold,fontSize:8,color:Colors.white,backgroundColor:'#302A2ABB',paddingHorizontal:8,paddingVertical:5,borderRadius:Radius.pill},heart:{position:'absolute',right:12,top:12,width:34,height:34,borderRadius:99,backgroundColor:Colors.white,alignItems:'center',justifyContent:'center'},coverTitle:{fontFamily:FontFamily.display,fontSize:22,lineHeight:27,color:Colors.white},
  info:{padding:14},brandRow:{flexDirection:'row',alignItems:'center',gap:6},brand:{flex:1,fontFamily:FontFamily.bodyMedium,fontSize:9,color:Colors.textMuted,textTransform:'uppercase'},verified:{fontFamily:FontFamily.bodyMedium,fontSize:8,color:Colors.success},name:{fontFamily:FontFamily.display,fontSize:18,lineHeight:23,color:Colors.text,marginTop:5},rating:{fontFamily:FontFamily.bodySemiBold,fontSize:11,color:'#EC9819',marginTop:5},location:{color:Colors.textSecondary},meta:{flexDirection:'row',gap:7,marginTop:12},metaItem:{flex:1,backgroundColor:Colors.background,borderRadius:Radius.sm,paddingVertical:8,alignItems:'center'},metaValue:{fontFamily:FontFamily.bodySemiBold,fontSize:10,color:Colors.text},metaLabel:{fontFamily:FontFamily.body,fontSize:8,color:Colors.textMuted,marginTop:2},bottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:13},price:{fontFamily:FontFamily.bodyBold,fontSize:17,color:Colors.primary},per:{fontFamily:FontFamily.body,fontSize:9,color:Colors.textMuted},detail:{backgroundColor:Colors.primary,borderRadius:Radius.sm,paddingHorizontal:14,paddingVertical:9},detailText:{fontFamily:FontFamily.bodySemiBold,fontSize:10,color:Colors.white},
});
