import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { photographerApi } from '@/apis/photographerApi';
import { PhotographerReviews } from '@/components/photographer/PhotographerReviews';
import { PhotographyGallery } from '@/components/photographer/PhotographyGallery';
import { AppCard } from '@/components/ui/AppCard';
import { ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors, FontFamily, Radius, Shadow } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { usePhotographerDetail } from '@/hooks/usePhotographerDetail';
import type { Photographer, PhotographyPackage, PhotographyQuote } from '@/types/photographer';
import { getApiErrorMessage } from '@/utils/apiError';
import { getMediaUrl } from '@/utils/media';

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const toMinutes = (value: string) => { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + minutes; };
const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const durationOf = (item?: PhotographyPackage | null) => Math.max(item?.includedDurationMinutes ?? Math.round((item?.durationHours ?? 1) * 60), 30);
const imageOf = (item: Photographer, pack?: PhotographyPackage | null) => pack?.images?.[0] ?? item.coverImage ?? item.media?.coverUrl ?? item.portfolioItems?.[0]?.images?.[0] ?? item.portfolio?.[0];
const fullAddress = (item: Photographer) => [item.address?.addressLine, item.address?.ward, item.address?.district, item.address?.city].filter(Boolean).join(', ');

export default function PhotographerDetailScreen() {
  const params = useLocalSearchParams<{ id: string; packageId?: string }>();
  const { photographer, reviews, loading, error, reload } = usePhotographerDetail(params.id);
  const [packageId, setPackageId] = useState(params.packageId ?? '');
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [location, setLocation] = useState('');
  const [concept, setConcept] = useState('');
  const [monthStatuses, setMonthStatuses] = useState<Record<string, string>>({});
  const [timeRanges, setTimeRanges] = useState<Array<{ start: string; end: string }>>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [quote, setQuote] = useState<PhotographyQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const { addItem, count } = useCart();
  const { show } = useToast();
  const { isAuthenticated, isFavorite, toggleFavorite } = useAuth();

  const selectedPackage = useMemo(() => photographer?.packages?.find(item => item._id === packageId) ?? photographer?.defaultPackage ?? photographer?.packages?.[0] ?? null, [photographer, packageId]);
  const includedDuration = durationOf(selectedPackage);
  const overtimeStep = Math.max(selectedPackage?.overtimeIncrementMinutes ?? 30, 30);
  const maxDuration = includedDuration + Math.max(selectedPackage?.maxOvertimeMinutes ?? 0, 0);
  const endTime = startTime ? toTime(toMinutes(startTime) + durationMinutes) : '';
  const liked = photographer ? isFavorite('PROVIDER', photographer._id) : false;
  const dates = useMemo(() => Array.from({ length: 30 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index + 1); return { value: iso(date), day: date.getDate(), month: date.getMonth() + 1, week: ['CN','T2','T3','T4','T5','T6','T7'][date.getDay()] }; }), []);

  const galleryImages = useMemo(() => {
    if (!photographer) return [];
    const values = [selectedPackage?.images ?? [], photographer.media?.images ?? [], photographer.portfolioItems?.flatMap(item => item.images) ?? [], photographer.portfolio ?? [], [photographer.coverImage ?? '', photographer.media?.coverUrl ?? '']].flat().filter(Boolean) as string[];
    return [...new Set(values)];
  }, [photographer, selectedPackage]);
  const portfolioImages = useMemo(() => photographer ? [...new Set([...(photographer.portfolioItems?.flatMap(item => item.images) ?? []), ...(photographer.portfolio ?? [])])] : [], [photographer]);

  useEffect(() => {
    if (!selectedPackage) return;
    setPackageId(selectedPackage._id);
    setDurationMinutes(durationOf(selectedPackage));
    setSelectedDate(''); setStartTime(''); setQuote(null); setQuoteError(null);
  }, [selectedPackage?._id]);
  useEffect(() => { if (photographer && !location) setLocation(fullAddress(photographer)); }, [photographer]);

  useEffect(() => {
    if (!photographer || !selectedPackage) return;
    let active = true;
    const months = [...new Set(dates.map(item => item.value.slice(0, 7)))];
    Promise.all(months.map(month => photographerApi.monthAvailability(photographer._id, month, selectedPackage._id).catch(() => null))).then(responses => {
      if (!active) return;
      const next: Record<string, string> = {};
      responses.forEach(response => response?.days?.forEach(day => { next[day.date] = day.status; }));
      setMonthStatuses(next);
    });
    return () => { active = false; };
  }, [photographer?._id, selectedPackage?._id]);

  useEffect(() => {
    if (!photographer || !selectedDate) { setTimeRanges([]); setStartTime(''); return; }
    let active = true; setScheduleLoading(true); setStartTime(''); setQuote(null);
    photographerApi.timeRanges(photographer._id, selectedDate).then(response => { if (active) setTimeRanges(response.timeRanges ?? []); }).catch(() => { if (active) setTimeRanges([]); }).finally(() => { if (active) setScheduleLoading(false); });
    return () => { active = false; };
  }, [photographer?._id, selectedDate]);

  const slots = useMemo(() => timeRanges.flatMap(range => {
    const values: Array<{ start: string; end: string }> = [];
    const step = durationMinutes >= 180 ? 60 : 30;
    for (let current = toMinutes(range.start); current + durationMinutes <= toMinutes(range.end); current += step) values.push({ start: toTime(current), end: toTime(current + durationMinutes) });
    return values;
  }), [timeRanges, durationMinutes]);

  useEffect(() => {
    if (!photographer || !selectedPackage || !selectedDate || !startTime || !location.trim()) { setQuote(null); setQuoteError(null); return; }
    let active = true;
    const timer = setTimeout(() => {
      setQuoteLoading(true); setQuoteError(null);
      const coordinates = photographer.address?.geo?.coordinates;
      photographerApi.quote(photographer._id, selectedPackage._id, [{ clientId:'mobile-main-session', startsAt:`${selectedDate}T${startTime}:00+07:00`, endsAt:`${selectedDate}T${endTime}:00+07:00`, locationAddress:location.trim(), ...(coordinates && coordinates.length >= 2 ? { locationLatitude:Number(coordinates[1]), locationLongitude:Number(coordinates[0]) } : {}) }])
        .then(result => { if (active) { setQuote(result); if (!result.valid) setQuoteError(result.errors?.[0]?.message ?? 'Khung giờ không còn khả dụng.'); } })
        .catch(cause => { if (active) { setQuote(null); setQuoteError(getApiErrorMessage(cause, 'Không thể kiểm tra lịch và báo giá')); } })
        .finally(() => { if (active) setQuoteLoading(false); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [photographer?._id, selectedPackage?._id, selectedDate, startTime, endTime, location]);

  if (loading) return <LoadingState label="Đang tải thông tin gói chụp..." />;
  if (error || !photographer) return <ErrorState message={error ?? 'Không tìm thấy photographer'} onRetry={reload} />;

  const favorite = async () => {
    if (!isAuthenticated) { router.push('/(auth)/login' as Href); return; }
    try { await toggleFavorite('PROVIDER', photographer._id); show(liked ? 'Đã bỏ khỏi yêu thích' : 'Đã thêm vào yêu thích', 'success'); } catch { show('Không thể cập nhật yêu thích', 'error'); }
  };
  const addToCart = () => {
    if (!selectedPackage || !selectedDate || !startTime || !location.trim()) { show('Vui lòng chọn đủ gói, ngày, giờ và địa điểm', 'error'); return; }
    if (!quote?.valid || !quote.totals) { show(quoteError ?? 'Báo giá chưa hợp lệ, vui lòng kiểm tra lại lịch', 'error'); return; }
    const coordinates = photographer.address?.geo?.coordinates;
    addItem({ itemType:'PHOTOGRAPHY_PACKAGE', photographyPackageId:selectedPackage._id, name:`${selectedPackage.name} — ${photographer.businessName ?? 'Studio'}`, image:imageOf(photographer, selectedPackage), basePrice:quote.totals.totalAmount, depositAmount:quote.totals.totalAmount, shootDate:selectedDate, shootTimeSlot:`${startTime}-${endTime}`, shootLocation:location.trim(), shootLocationLatitude:coordinates?.length ? Number(coordinates[1]) : null, shootLocationLongitude:coordinates?.length ? Number(coordinates[0]) : null, shootConcept:concept.trim() || null, providerAddress:fullAddress(photographer), metadata:{ providerId:photographer._id, packageName:selectedPackage.name, durationMinutes, quoteBreakdown:quote.breakdown } });
    show('Đã thêm gói chụp vào giỏ', 'success');
    router.push('/cart' as Href);
  };

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <Header liked={liked} count={count} onFavorite={favorite} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PhotographyGallery images={galleryImages.slice(0, 12)} />
      <View style={styles.pad}><Text style={styles.eyebrow}>PHOTO PACKAGE · {(photographer.address?.city ?? 'MIỀN TRUNG').toUpperCase()}</Text><Text style={styles.title}>{selectedPackage?.name ?? photographer.businessName}</Text><Text style={styles.rating}>★ {(photographer.rating?.averageRating ?? 0).toFixed(1)} <Text style={styles.muted}>· {photographer.rating?.totalReviews ?? reviews.length} đánh giá · {photographer.address?.city ?? 'Miền Trung'}</Text></Text><Text style={styles.description}>{selectedPackage?.description ?? photographer.quote ?? 'Một buổi chụp được chuẩn bị chỉn chu cùng đội ngũ chuyên nghiệp.'}</Text><View style={styles.meta}><Meta icon="time-outline" value={`${durationMinutes} phút`} label="Thời lượng" /><Meta icon="images-outline" value={`${selectedPackage?.editedPhotosCount ?? 0} ảnh`} label="Chỉnh sửa" /><Meta icon="people-outline" value={`1–${selectedPackage?.maxPeople ?? 2}`} label="Số người" /></View></View>

      {(photographer.packages?.length ?? 0) > 1 && <Section title="Chọn gói chụp"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packageRow}>{photographer.packages?.map(item => <Pressable key={item._id} onPress={() => setPackageId(item._id)} style={[styles.packageCard, selectedPackage?._id === item._id && styles.packageSelected]}><Text numberOfLines={2} style={[styles.packageName, selectedPackage?._id === item._id && styles.packageNameSelected]}>{item.name}</Text><Text style={[styles.packagePrice, selectedPackage?._id === item._id && styles.packageNameSelected]}>{money(item.price)}</Text><Text style={[styles.packageMeta, selectedPackage?._id === item._id && styles.packageMetaSelected]}>{durationOf(item)} phút · {item.editedPhotosCount} ảnh</Text></Pressable>)}</ScrollView></Section>}

      <View style={styles.providerCard}><View style={styles.providerAvatar}><Text style={styles.providerInitial}>{(photographer.businessName ?? 'L').charAt(0)}</Text></View><View style={{flex:1}}><Text style={styles.providerName}>{photographer.businessName ?? 'LUMÉ Studio'}</Text><Text style={styles.providerSub}>Photographer đã xác minh · {photographer.rating?.totalReviews ?? 0} đánh giá</Text></View><StatusBadge label="Đã xác minh" tone="success" /></View>

      <Section title="1. Ngày và thời gian chụp"><Text style={styles.helper}>Ngày mờ là ngày provider không nhận lịch.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>{dates.map(item => { const unavailable = monthStatuses[item.value] !== undefined && monthStatuses[item.value] !== 'AVAILABLE'; const active = selectedDate === item.value; return <Pressable key={item.value} disabled={unavailable} onPress={() => setSelectedDate(item.value)} style={[styles.day, active && styles.dayActive, unavailable && styles.disabled]}><Text style={[styles.dayWeek, active && styles.lightText]}>{item.week}</Text><Text style={[styles.dayNumber, active && styles.lightText]}>{item.day}</Text><Text style={[styles.dayMonth, active && styles.lightText]}>Th {item.month}</Text></Pressable>; })}</ScrollView>
        {selectedDate ? scheduleLoading ? <Text style={styles.loadingCopy}>Đang tải khung giờ...</Text> : slots.length ? <View style={styles.slotGrid}>{slots.map(slot => <Pressable key={slot.start} onPress={() => setStartTime(slot.start)} style={[styles.slot, startTime === slot.start && styles.slotActive]}><Text style={[styles.slotText, startTime === slot.start && styles.lightText]}>{slot.start}–{slot.end}</Text></Pressable>)}</View> : <View style={styles.warning}><Ionicons name="alert-circle-outline" size={18} color={Colors.warning} /><Text style={styles.warningText}>Không còn khung giờ phù hợp trong ngày này.</Text></View> : null}
      </Section>

      <Section title="2. Thời lượng & add-on"><Text style={styles.helper}>Gói gồm {includedDuration} phút. Phần tăng giờ được backend báo giá tự động.</Text><View style={styles.durationRow}><Pressable disabled={durationMinutes <= includedDuration} onPress={() => setDurationMinutes(value => Math.max(includedDuration, value - overtimeStep))} style={styles.stepButton}><Ionicons name="remove" size={20} color={Colors.primary} /></Pressable><View style={styles.durationCenter}><Text style={styles.duration}>{durationMinutes} phút</Text><Text style={styles.overtime}>{durationMinutes > includedDuration ? `Tăng thêm ${durationMinutes - includedDuration} phút` : 'Trong thời lượng gói'}</Text></View><Pressable disabled={durationMinutes >= maxDuration} onPress={() => setDurationMinutes(value => Math.min(maxDuration, value + overtimeStep))} style={[styles.stepButton, durationMinutes >= maxDuration && styles.disabled]}><Ionicons name="add" size={20} color={Colors.primary} /></Pressable></View>{maxDuration === includedDuration && <Text style={styles.noAddon}>Gói này không hỗ trợ tăng thời lượng.</Text>}</Section>

      <Section title="3. Địa điểm & yêu cầu"><Text style={styles.inputLabel}>ĐỊA ĐIỂM CHỤP</Text><TextInput value={location} onChangeText={setLocation} placeholder="Nhập địa chỉ chụp" placeholderTextColor={Colors.textMuted} style={styles.textInput} /><Text style={styles.inputLabel}>CONCEPT / GHI CHÚ</Text><TextInput value={concept} onChangeText={setConcept} placeholder="Ví dụ: Golden hour, ngoại cảnh..." placeholderTextColor={Colors.textMuted} style={styles.textInput} /></Section>

      <Section title="Tạm tính"><View style={styles.quoteTop}><Text style={styles.quotePackage}>{selectedPackage?.name}</Text><Text style={styles.basePrice}>{money(selectedPackage?.price ?? 0)}</Text></View>{quoteLoading ? <Text style={styles.loadingCopy}>Đang kiểm tra lịch và tính giá...</Text> : quote?.valid && quote.totals ? <View>{quote.breakdown.map((item, index) => <View key={`${item.type}-${index}`} style={styles.quoteRow}><Text style={styles.quoteLabel}>{item.label}</Text><Text style={styles.quoteValue}>{money(item.amount)}</Text></View>)}<View style={styles.totalRow}><Text style={styles.totalLabel}>Tạm tính</Text><Text style={styles.totalPrice}>{money(quote.totals.totalAmount)}</Text></View><View style={styles.success}><Ionicons name="checkmark-circle" size={18} color={Colors.success} /><Text style={styles.successText}>Lịch còn trống và báo giá đã được xác nhận.</Text></View></View> : quoteError ? <View style={styles.errorBox}><Ionicons name="alert-circle" size={18} color={Colors.error} /><Text style={styles.errorText}>{quoteError}</Text></View> : <Text style={styles.helper}>Chọn ngày, giờ và địa điểm để nhận báo giá chính xác.</Text>}</Section>

      <Section title="Gói này bao gồm">{[`${durationOf(selectedPackage)} phút chụp liên tục`, `${selectedPackage?.editedPhotosCount ?? 0} ảnh chỉnh sửa`, `${selectedPackage?.rawPhotosCount ?? 0} ảnh gốc chọn lọc`, `Bàn giao trong ${selectedPackage?.deliveryDays ?? 0} ngày`, ...(photographer.equipment?.slice(0, 3) ?? [])].map(value => <View key={value} style={styles.included}><Ionicons name="checkmark-circle" size={17} color={Colors.success} /><Text style={styles.includedText}>{value}</Text></View>)}</Section>

      {portfolioImages.length > 0 && <View style={styles.portfolio}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Portfolio gần đây</Text><Text style={styles.muted}>{portfolioImages.length} ảnh</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolioRow}>{portfolioImages.slice(0, 10).map((uri, index) => <View key={`${uri}-${index}`} style={styles.portfolioImageWrap}><PhotographyThumb uri={uri} /><Text style={styles.photoNumber}>Ảnh {index + 1}</Text></View>)}</ScrollView></View>}
      <Section title="Buổi chụp diễn ra như thế nào?">{['Chọn gói, ngày và khung giờ còn trống','Backend kiểm tra availability và báo giá','Thêm vào giỏ rồi xác nhận thông tin checkout','Thanh toán để giữ chỗ và nhận lịch xác nhận'].map((value, index) => <View key={value} style={styles.process}><Text style={styles.processNo}>{index + 1}</Text><Text style={styles.processText}>{value}</Text></View>)}</Section>
      <Section title="Chính sách & hỗ trợ"><Text style={styles.policyTitle}>Đổi lịch / hủy booking</Text><Text style={styles.policy}>{photographer.policies?.cancellationPolicy ?? 'Điều kiện đổi hoặc hủy phụ thuộc availability và chính sách của studio tại thời điểm đặt.'}</Text>{!!selectedPackage?.travelFeeNotes && <><Text style={styles.policyTitle}>Phụ thu di chuyển</Text><Text style={styles.policy}>{selectedPackage.travelFeeNotes}</Text></>}</Section>
      <PhotographerReviews reviews={reviews} rating={photographer.rating?.averageRating ?? 0} />
    </ScrollView>
    <View style={styles.bottom}><View><Text style={styles.bottomLabel}>Tạm tính</Text><Text style={styles.bottomPrice}>{money(quote?.totals?.totalAmount ?? selectedPackage?.price ?? 0)}</Text></View><Pressable disabled={quoteLoading || quote?.valid !== true} style={[styles.cta, (quoteLoading || quote?.valid !== true) && styles.ctaDisabled]} onPress={addToCart}><Text style={styles.ctaText}>Thêm vào giỏ</Text><Ionicons name="arrow-forward" size={17} color={Colors.white} /></Pressable></View>
  </SafeAreaView>;
}

function Header({ liked, count, onFavorite }: { liked: boolean; count:number; onFavorite: () => void }) { return <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.round}><Ionicons name="chevron-back" size={22} color={Colors.text} /></Pressable><View><Text style={styles.brand}>LUMÉ</Text><Text style={styles.tagline}>GÓI CHỤP ẢNH</Text></View><View style={styles.headerActions}><Pressable onPress={onFavorite} style={styles.round}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={Colors.primary} /></Pressable><Pressable onPress={()=>router.push('/cart' as Href)} style={styles.round}><Ionicons name="bag-outline" size={20} color={Colors.primary} />{count>0&&<View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{Math.min(count,9)}</Text></View>}</Pressable></View></View>; }
function Section({ title, children }: { title: string; children: ReactNode }) { return <AppCard style={styles.sectionCard}><Text style={styles.sectionTitle}>{title}</Text>{children}</AppCard>; }
function Meta({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) { return <View style={styles.metaItem}><Ionicons name={icon} size={17} color={Colors.primary} /><Text style={styles.metaValue}>{value}</Text><Text style={styles.metaLabel}>{label}</Text></View>; }
function PhotographyThumb({ uri }: { uri: string }) { return <Image source={getMediaUrl(uri)} style={styles.portfolioImage} contentFit="cover" transition={180} />; }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:Colors.background},content:{paddingBottom:112,gap:14},header:{height:58,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:Colors.surface,borderBottomWidth:1,borderBottomColor:Colors.border},headerActions:{flexDirection:'row',gap:6},round:{width:38,height:38,borderRadius:99,borderWidth:1,borderColor:Colors.border,alignItems:'center',justifyContent:'center'},cartBadge:{position:'absolute',right:-2,top:-3,minWidth:16,height:16,paddingHorizontal:3,borderRadius:99,backgroundColor:Colors.primary,alignItems:'center',justifyContent:'center'},cartBadgeText:{fontFamily:FontFamily.bodyBold,fontSize:8,color:Colors.white},brand:{fontFamily:FontFamily.display,fontSize:17,letterSpacing:3,color:Colors.primary,textAlign:'center'},tagline:{fontFamily:FontFamily.bodyMedium,fontSize:8,color:Colors.textMuted,textAlign:'center'},pad:{paddingHorizontal:16},eyebrow:{fontFamily:FontFamily.bodySemiBold,fontSize:9,color:Colors.primary,textTransform:'uppercase'},title:{fontFamily:FontFamily.display,fontSize:25,lineHeight:32,color:Colors.text,marginTop:6},rating:{fontFamily:FontFamily.bodySemiBold,fontSize:11,color:'#EC9819',marginTop:7},muted:{fontFamily:FontFamily.body,fontSize:10,color:Colors.textMuted},description:{fontFamily:FontFamily.body,fontSize:12,lineHeight:19,color:Colors.textSecondary,marginTop:8},
  meta:{flexDirection:'row',gap:8,marginTop:13},metaItem:{flex:1,alignItems:'center',paddingVertical:10,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.md},metaValue:{fontFamily:FontFamily.bodySemiBold,fontSize:10,color:Colors.text,marginTop:3},metaLabel:{fontFamily:FontFamily.body,fontSize:8,color:Colors.textMuted,marginTop:1},sectionCard:{marginHorizontal:16,padding:15},sectionTitle:{fontFamily:FontFamily.display,fontSize:18,color:Colors.text,marginBottom:11},helper:{fontFamily:FontFamily.body,fontSize:10,lineHeight:16,color:Colors.textMuted,marginBottom:9},
  packageRow:{gap:9,paddingRight:12},packageCard:{width:175,minHeight:96,padding:12,borderRadius:Radius.md,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.surface},packageSelected:{backgroundColor:Colors.primary,borderColor:Colors.primary},packageName:{fontFamily:FontFamily.bodySemiBold,fontSize:11,lineHeight:16,color:Colors.text},packageNameSelected:{color:Colors.white},packagePrice:{fontFamily:FontFamily.bodyBold,fontSize:13,color:Colors.primary,marginTop:7},packageMeta:{fontFamily:FontFamily.body,fontSize:8,color:Colors.textMuted,marginTop:4},packageMetaSelected:{color:'#EEC9D0'},
  providerCard:{marginHorizontal:16,padding:14,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.lg,flexDirection:'row',alignItems:'center',gap:10,...Shadow},providerAvatar:{width:42,height:42,borderRadius:99,backgroundColor:Colors.primarySoft,alignItems:'center',justifyContent:'center'},providerInitial:{fontFamily:FontFamily.display,fontSize:16,color:Colors.primary},providerName:{fontFamily:FontFamily.bodySemiBold,fontSize:12,color:Colors.text},providerSub:{fontFamily:FontFamily.body,fontSize:8,color:Colors.textMuted,marginTop:3},
  dateRow:{gap:7,paddingRight:8},day:{width:54,paddingVertical:8,borderRadius:Radius.md,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.surface,alignItems:'center'},dayActive:{backgroundColor:Colors.primary,borderColor:Colors.primary},dayWeek:{fontFamily:FontFamily.bodyMedium,fontSize:8,color:Colors.textMuted},dayNumber:{fontFamily:FontFamily.bodyBold,fontSize:16,color:Colors.text,marginVertical:2},dayMonth:{fontFamily:FontFamily.body,fontSize:8,color:Colors.textMuted},lightText:{color:Colors.white},disabled:{opacity:.32},loadingCopy:{fontFamily:FontFamily.bodyMedium,fontSize:10,color:Colors.textMuted,paddingVertical:12},slotGrid:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:12},slot:{width:'31.5%',paddingVertical:9,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.sm,alignItems:'center'},slotActive:{backgroundColor:Colors.primary,borderColor:Colors.primary},slotText:{fontFamily:FontFamily.bodyMedium,fontSize:9,color:Colors.textSecondary},warning:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:Colors.warningSoft,borderRadius:Radius.sm,padding:10,marginTop:10},warningText:{flex:1,fontFamily:FontFamily.bodyMedium,fontSize:10,color:Colors.warning},
  durationRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:Colors.background,borderRadius:Radius.md,padding:10},stepButton:{width:42,height:42,borderRadius:99,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,alignItems:'center',justifyContent:'center'},durationCenter:{alignItems:'center'},duration:{fontFamily:FontFamily.bodyBold,fontSize:15,color:Colors.text},overtime:{fontFamily:FontFamily.body,fontSize:8,color:Colors.textMuted,marginTop:3},noAddon:{fontFamily:FontFamily.body,fontSize:9,color:Colors.textMuted,textAlign:'center',marginTop:8},inputLabel:{fontFamily:FontFamily.bodySemiBold,fontSize:8,color:Colors.textMuted,marginBottom:5},textInput:{height:46,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.sm,paddingHorizontal:12,fontFamily:FontFamily.body,fontSize:11,color:Colors.text,marginBottom:11},
  quoteTop:{flexDirection:'row',justifyContent:'space-between',gap:12,paddingBottom:10,borderBottomWidth:1,borderBottomColor:Colors.border},quotePackage:{flex:1,fontFamily:FontFamily.bodySemiBold,fontSize:11,color:Colors.text},basePrice:{fontFamily:FontFamily.bodySemiBold,fontSize:11,color:Colors.text},quoteRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:8},quoteLabel:{flex:1,fontFamily:FontFamily.body,fontSize:10,color:Colors.textSecondary},quoteValue:{fontFamily:FontFamily.bodyMedium,fontSize:10,color:Colors.text},totalRow:{flexDirection:'row',justifyContent:'space-between',borderTopWidth:1,borderTopColor:Colors.border,paddingTop:11,marginTop:3},totalLabel:{fontFamily:FontFamily.bodyBold,fontSize:12,color:Colors.text},totalPrice:{fontFamily:FontFamily.display,fontSize:20,color:Colors.primary},success:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:Colors.successSoft,padding:10,borderRadius:Radius.sm,marginTop:11},successText:{flex:1,fontFamily:FontFamily.bodyMedium,fontSize:9,color:Colors.success},errorBox:{flexDirection:'row',gap:7,backgroundColor:Colors.errorSoft,padding:10,borderRadius:Radius.sm},errorText:{flex:1,fontFamily:FontFamily.bodyMedium,fontSize:10,color:Colors.error},
  included:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:7,borderBottomWidth:1,borderBottomColor:'#F3EEEB'},includedText:{fontFamily:FontFamily.bodyMedium,fontSize:10,color:Colors.textSecondary},portfolio:{paddingHorizontal:16},sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10},portfolioRow:{gap:9},portfolioImageWrap:{width:145,height:120},portfolioImage:{width:145,height:120,borderRadius:Radius.md,backgroundColor:Colors.surfaceSoft},photoNumber:{position:'absolute',bottom:7,left:7,fontFamily:FontFamily.bodySemiBold,fontSize:8,color:Colors.white,backgroundColor:'#00000088',paddingHorizontal:7,paddingVertical:4,borderRadius:Radius.pill},process:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8},processNo:{width:25,height:25,textAlign:'center',textAlignVertical:'center',borderRadius:99,backgroundColor:Colors.primarySoft,fontFamily:FontFamily.bodyBold,fontSize:10,color:Colors.primary},processText:{flex:1,fontFamily:FontFamily.bodyMedium,fontSize:10,lineHeight:15,color:Colors.textSecondary},policyTitle:{fontFamily:FontFamily.bodySemiBold,fontSize:10,color:Colors.text,marginTop:4},policy:{fontFamily:FontFamily.body,fontSize:10,lineHeight:17,color:Colors.textSecondary,marginTop:4,marginBottom:10},
  bottom:{position:'absolute',left:0,right:0,bottom:0,minHeight:76,paddingHorizontal:16,paddingVertical:11,backgroundColor:Colors.surface,borderTopWidth:1,borderTopColor:Colors.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between',...Shadow},bottomLabel:{fontFamily:FontFamily.body,fontSize:8,color:Colors.textMuted},bottomPrice:{fontFamily:FontFamily.bodyBold,fontSize:16,color:Colors.primary,marginTop:3},cta:{minWidth:184,height:50,borderRadius:Radius.md,backgroundColor:Colors.primary,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},ctaDisabled:{opacity:.45},ctaText:{fontFamily:FontFamily.bodyBold,fontSize:12,color:Colors.white},
});
