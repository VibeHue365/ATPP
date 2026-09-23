import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import type { CartItem } from '@/types/cart';
import { getMediaUrl } from '@/utils/media';

const money = (value = 0) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';

export default function CartScreen() {
  const { items, ready, removeItem, updateItem } = useCart();
  const { show } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => { setSelectedIds(current => items.map(item => item.id).filter(id => current.length === 0 || current.includes(id))); }, [items]);
  const selected = useMemo(() => items.filter(item => selectedIds.includes(item.id)), [items, selectedIds]);
  const rentalFee = selected.filter(item => item.itemType === 'PRODUCT').reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);
  const refundableDeposit = selected.filter(item => item.itemType === 'PRODUCT').reduce((sum, item) => sum + (item.depositAmount ?? 0) * item.quantity, 0);
  const photographyFee = selected.filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE').reduce((sum, item) => sum + (item.basePrice ?? 0) * item.quantity, 0);
  const total = rentalFee + refundableDeposit + photographyFee;
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  const proceed = () => {
    if (!selected.length) return;
    if (selected.filter(item => item.itemType === 'PHOTOGRAPHY_PACKAGE').length > 1) { show('Vui lòng thanh toán từng gói chụp riêng biệt', 'error'); return; }
    router.push({ pathname:'/checkout', params:{ ids:selected.map(item => item.id).join(',') } } as unknown as Href);
  };
  if (!ready) return <LoadingState label="Đang tải giỏ hàng..." />;
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}><Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={22} color={Colors.text} /></Pressable><View><Text style={styles.brand}>LUMÉ</Text><Text style={styles.headerTitle}>Giỏ hàng</Text></View><View style={styles.count}><Text style={styles.countText}>{items.length}</Text></View></View>
    {items.length === 0 ? <View style={styles.empty}><EmptyState title="Giỏ hàng đang trống" message="Chọn áo dài hoặc gói chụp phù hợp để bắt đầu." /><AppButton title="Khám phá dịch vụ" onPress={() => router.replace('/' as Href)} /></View> : <>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.selectAll} onPress={() => setSelectedIds(allSelected ? [] : items.map(item => item.id))}><Check active={allSelected} /><Text style={styles.selectText}>Chọn tất cả ({items.length})</Text></Pressable>
        {items.map(item => <CartRow key={item.id} item={item} selected={selectedIds.includes(item.id)} onToggle={() => setSelectedIds(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} onRemove={() => removeItem(item.id)} onQuantity={quantity => updateItem(item.id, { quantity })} />)}
        <View style={styles.summary}><Text style={styles.summaryTitle}>Tóm tắt thanh toán</Text><Summary label="Phí thuê áo dài" value={rentalFee} /><Summary label="Gói chụp ảnh" value={photographyFee} /><Summary label="Tiền cọc hoàn lại" value={refundableDeposit} accent /><View style={styles.divider} /><View style={styles.totalRow}><Text style={styles.totalLabel}>Tổng cần thanh toán</Text><Text style={styles.total}>{money(total)}</Text></View><Text style={styles.depositNote}>Tiền cọc áo dài được hoàn lại sau khi hệ thống đối soát trạng thái trả áo.</Text></View>
      </ScrollView>
      <View style={styles.bottom}><View><Text style={styles.bottomLabel}>{selected.length} mục đã chọn</Text><Text style={styles.bottomTotal}>{money(total)}</Text></View><Pressable disabled={!selected.length} onPress={proceed} style={[styles.checkout, !selected.length && styles.disabled]}><Text style={styles.checkoutText}>Tiếp tục</Text><Ionicons name="arrow-forward" size={18} color={Colors.white} /></Pressable></View>
    </>}
  </SafeAreaView>;
}

function CartRow({ item, selected, onToggle, onRemove, onQuantity }: { item:CartItem; selected:boolean; onToggle:()=>void; onRemove:()=>void; onQuantity:(value:number)=>void }) {
  const photo = item.itemType === 'PHOTOGRAPHY_PACKAGE';
  return <View style={styles.card}><Pressable onPress={onToggle}><Check active={selected} /></Pressable><Image source={getMediaUrl(item.image)} style={styles.image} contentFit="cover" /><View style={styles.itemBody}><View style={styles.itemTop}><Text style={styles.itemType}>{photo ? 'GÓI CHỤP ẢNH' : 'THUÊ ÁO DÀI'}</Text><Pressable onPress={onRemove}><Ionicons name="trash-outline" size={18} color={Colors.textMuted} /></Pressable></View><Text style={styles.itemName} numberOfLines={2}>{item.name}</Text><Text style={styles.itemMeta}>{photo ? `${item.shootDate} · ${item.shootTimeSlot}` : `${item.rentalFrom} → ${item.rentalTo}`}</Text><Text style={styles.itemMeta}>{photo ? item.shootLocation : `Size ${item.size} · ${item.color}`}</Text><View style={styles.priceLine}><Text style={styles.price}>{money(item.basePrice)}</Text>{!photo && <View style={styles.quantity}><Pressable disabled={item.quantity <= 1} onPress={() => onQuantity(Math.max(1, item.quantity - 1))}><Ionicons name="remove" size={16} color={Colors.primary} /></Pressable><Text style={styles.quantityText}>{item.quantity}</Text><Pressable onPress={() => onQuantity(item.quantity + 1)}><Ionicons name="add" size={16} color={Colors.primary} /></Pressable></View>}</View></View></View>;
}
function Check({ active }: { active:boolean }) { return <View style={[styles.check, active && styles.checkActive]}>{active && <Ionicons name="checkmark" size={14} color={Colors.white} />}</View>; }
function Summary({ label, value, accent }: { label:string; value:number; accent?:boolean }) { return <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={[styles.summaryValue, accent && styles.accent]}>{money(value)}</Text></View>; }

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:Colors.background},header:{height:64,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:Colors.surface,borderBottomWidth:1,borderBottomColor:Colors.border},back:{width:38,height:38,borderRadius:99,borderWidth:1,borderColor:Colors.border,alignItems:'center',justifyContent:'center'},brand:{fontFamily:FontFamily.display,fontSize:15,letterSpacing:3,color:Colors.primary,textAlign:'center'},headerTitle:{fontFamily:FontFamily.bodySemiBold,fontSize:11,color:Colors.text,textAlign:'center',marginTop:2},count:{width:32,height:32,borderRadius:99,backgroundColor:Colors.primarySoft,alignItems:'center',justifyContent:'center'},countText:{fontFamily:FontFamily.bodyBold,fontSize:12,color:Colors.primary},empty:{flex:1,padding:20,justifyContent:'center',gap:18},content:{padding:16,paddingBottom:125,gap:12},selectAll:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:4},selectText:{fontFamily:FontFamily.bodySemiBold,fontSize:12,color:Colors.text},check:{width:22,height:22,borderRadius:6,borderWidth:1.5,borderColor:Colors.border,alignItems:'center',justifyContent:'center',backgroundColor:Colors.surface},checkActive:{backgroundColor:Colors.primary,borderColor:Colors.primary},card:{backgroundColor:Colors.surface,borderRadius:Radius.lg,borderWidth:1,borderColor:Colors.border,padding:12,flexDirection:'row',gap:10,...Shadow},image:{width:74,height:92,borderRadius:Radius.md,backgroundColor:Colors.surfaceSoft},itemBody:{flex:1},itemTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},itemType:{fontFamily:FontFamily.bodyBold,fontSize:8,color:Colors.primary},itemName:{fontFamily:FontFamily.display,fontSize:15,lineHeight:20,color:Colors.text,marginTop:5},itemMeta:{fontFamily:FontFamily.body,fontSize:9,lineHeight:14,color:Colors.textMuted,marginTop:3},priceLine:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:8},price:{fontFamily:FontFamily.bodyBold,fontSize:13,color:Colors.primary},quantity:{height:30,minWidth:84,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.pill,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},quantityText:{fontFamily:FontFamily.bodySemiBold,fontSize:11,color:Colors.text},summary:{marginTop:4,padding:16,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.lg},summaryTitle:{fontFamily:FontFamily.display,fontSize:18,color:Colors.text,marginBottom:12},summaryRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:6},summaryLabel:{fontFamily:FontFamily.body,fontSize:11,color:Colors.textSecondary},summaryValue:{fontFamily:FontFamily.bodySemiBold,fontSize:11,color:Colors.text},accent:{color:Colors.primary},divider:{height:1,backgroundColor:Colors.border,marginVertical:9},totalRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},totalLabel:{fontFamily:FontFamily.bodyBold,fontSize:12,color:Colors.text},total:{fontFamily:FontFamily.display,fontSize:20,color:Colors.primary},depositNote:{fontFamily:FontFamily.body,fontSize:9,lineHeight:15,color:Colors.textMuted,marginTop:12,padding:10,backgroundColor:Colors.warningSoft,borderRadius:Radius.sm},bottom:{position:'absolute',left:0,right:0,bottom:0,minHeight:82,paddingHorizontal:16,paddingVertical:12,backgroundColor:Colors.surface,borderTopWidth:1,borderTopColor:Colors.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between',...Shadow},bottomLabel:{fontFamily:FontFamily.body,fontSize:9,color:Colors.textMuted},bottomTotal:{fontFamily:FontFamily.bodyBold,fontSize:17,color:Colors.primary,marginTop:3},checkout:{height:50,minWidth:170,borderRadius:Radius.md,backgroundColor:Colors.primary,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},checkoutText:{fontFamily:FontFamily.bodyBold,fontSize:13,color:Colors.white},disabled:{opacity:.45}});
