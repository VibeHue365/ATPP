import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import type { Product } from '@/types/product';
import { getMediaUrl } from '@/utils/media';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';

export function ProductCard({ product }: { product: Product }) {
  const { isAuthenticated, isFavorite, toggleFavorite } = useAuth();
  const { show } = useToast();
  const provider = typeof product.providerId === 'object' ? product.providerId : undefined;
  const liked=isFavorite('PRODUCT',product._id);
  const onFavorite=async(event:{stopPropagation:()=>void})=>{event.stopPropagation();if(!isAuthenticated){router.push('/(auth)/login' as Href);return}try{await toggleFavorite('PRODUCT',product._id);show(liked?'Đã bỏ khỏi yêu thích':'Đã thêm vào yêu thích','success')}catch{show('Không thể cập nhật yêu thích','error')}};
  return <Pressable style={s.card} onPress={() => router.push(`/product/${product._id}` as Href)}>
    <View style={s.imageWrap}>{product.images?.[0] ? <Image source={getMediaUrl(product.images[0])} style={s.image} contentFit="cover" transition={180}/> : <View style={s.placeholder}><Text style={s.placeholderText}>ÁO DÀI</Text></View>}<Pressable style={s.heart} onPress={onFavorite}><Ionicons name={liked?'heart':'heart-outline'} size={18} color={Colors.primary}/></Pressable></View>
    <View style={s.info}><View style={s.brandRow}><Text numberOfLines={1} style={s.brand}>{provider?.businessName ?? 'LUMÉ ÁO DÀI'}</Text><Text style={s.verified}>✓ Đã xác minh</Text></View><Text numberOfLines={2} style={s.name}>{product.name}</Text><Text style={s.rating}>★ {product.rating?.averageRating?.toFixed(1) ?? '4.9'} <Text style={s.location}>· {provider?.address?.city ?? 'Huế'}</Text></Text><View style={s.tags}>{product.sizes?.slice(0,3).map(size => <Text key={size} style={s.tag}>{size}</Text>)}</View><Text style={s.price}>{money(product.discountedPrice ?? product.basePrice)}<Text style={s.per}> /ngày</Text></Text></View>
  </Pressable>;
}

const s=StyleSheet.create({card:{width:'48.3%',backgroundColor:Colors.surface,borderRadius:Radius.md,overflow:'hidden',borderWidth:1,borderColor:Colors.border,...Shadow},imageWrap:{height:205},image:{width:'100%',height:'100%'},placeholder:{flex:1,backgroundColor:'#EBD3D5',alignItems:'center',justifyContent:'center'},placeholderText:{fontFamily:FontFamily.display,color:Colors.primary,fontSize:14},heart:{position:'absolute',right:8,top:8,width:32,height:32,borderRadius:99,backgroundColor:Colors.white,alignItems:'center',justifyContent:'center'},info:{padding:11},brandRow:{flexDirection:'row',gap:4,alignItems:'center'},brand:{flex:1,fontFamily:FontFamily.bodyMedium,color:Colors.textMuted,fontSize:8},verified:{fontFamily:FontFamily.bodyMedium,color:Colors.success,fontSize:8},name:{fontFamily:FontFamily.display,color:Colors.text,fontSize:14,lineHeight:19,minHeight:38,marginTop:5},rating:{fontFamily:FontFamily.bodyMedium,color:'#EF9B15',fontSize:10,marginTop:5},location:{color:Colors.textSecondary},tags:{flexDirection:'row',gap:4,marginTop:7},tag:{fontFamily:FontFamily.body,color:Colors.textSecondary,fontSize:8,backgroundColor:'#F3EFEB',paddingHorizontal:5,paddingVertical:3,borderRadius:4},price:{fontFamily:FontFamily.bodyBold,color:Colors.primary,fontSize:15,marginTop:10},per:{fontFamily:FontFamily.body,color:Colors.textMuted,fontSize:9}});
