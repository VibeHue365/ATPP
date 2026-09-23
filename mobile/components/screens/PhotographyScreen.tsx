import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhotographyCard } from '@/components/photographer/PhotographyCard';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Radius, Shadow, Spacing } from '@/constants/theme';
import { usePhotographers, usePhotographyFilters } from '@/hooks/usePhotographers';
import type { PhotographerFilters, PhotographerSort } from '@/types/photographer';

const sortOptions: Array<{ value: PhotographerSort; label: string }> = [
  { value: 'rating_desc', label: 'Đánh giá cao' },
  { value: 'reviews_desc', label: 'Nhiều đánh giá' },
  { value: 'price_asc', label: 'Giá thấp đến cao' },
  { value: 'price_desc', label: 'Giá cao đến thấp' },
];

export default function PhotographyScreen() {
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [concept, setConcept] = useState('');
  const [sort, setSort] = useState<PhotographerSort>('rating_desc');
  const [minRating, setMinRating] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const { concepts, categories } = usePhotographyFilters();
  const filters = useMemo<PhotographerFilters>(() => ({ q: search || undefined, location: location || undefined, packageCategoryId: categoryId || undefined, concept: concept || undefined, minRating, maxPrice, sort, page, limit: 8 }), [search, location, categoryId, concept, minRating, maxPrice, sort, page]);
  const { items, loading, error, total, totalPages, reload } = usePhotographers(filters);
  const submit = () => { setPage(1); setSearch(draftSearch.trim()); };
  const reset = () => { setSearch(''); setDraftSearch(''); setLocation(''); setCategoryId(''); setConcept(''); setMinRating(undefined); setMaxPrice(undefined); setSort('rating_desc'); setPage(1); };
  const hasFilters = Boolean(search || location || categoryId || concept || minRating || maxPrice || sort !== 'rating_desc');

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <BrandHeader />
      <Text style={styles.eyebrow}>PHOTOGRAPHER & STUDIO ĐÃ XÁC MINH</Text>
      <Text style={styles.title}>Đặt lịch chụp ảnh{`\n`}tại miền Trung</Text>
      <Text style={styles.subtitle}>Tìm concept, photographer và khung giờ phù hợp với nhu cầu của bạn.</Text>
      <View style={styles.stats}><Stat value="30+" label="Gói chụp" /><Stat value="18" label="Photographer" /><Stat value="4.9/5" label="Đánh giá" /></View>
      <View style={styles.searchCard}>
        <View style={styles.searchBox}><Ionicons name="search" size={18} color={Colors.textMuted} /><TextInput value={draftSearch} onChangeText={setDraftSearch} onSubmitEditing={submit} returnKeyType="search" placeholder="Tên studio hoặc gói chụp..." placeholderTextColor={Colors.textMuted} style={styles.input} /></View>
        <View style={styles.twoColumns}><View style={styles.field}><Text style={styles.fieldLabel}>ĐỊA ĐIỂM</Text><TextInput value={location} onChangeText={value => { setLocation(value); setPage(1); }} placeholder="Huế, Đà Nẵng..." placeholderTextColor={Colors.textMuted} style={styles.fieldInput} /></View><Pressable style={styles.filterButton} onPress={() => setFilterOpen(true)}><Ionicons name="options-outline" size={18} color={Colors.primary} /><Text style={styles.filterText}>Bộ lọc{hasFilters ? ' •' : ''}</Text></Pressable></View>
        <AppButton title="Tìm gói chụp ngay" onPress={submit} />
      </View>
      {categories.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip label="Tất cả" active={!categoryId} onPress={() => { setCategoryId(''); setPage(1); }} />{categories.map(item => <Chip key={item.id} label={`${item.name} ${item.packageCount || ''}`.trim()} active={categoryId === item.id} onPress={() => { setCategoryId(categoryId === item.id ? '' : item.id); setPage(1); }} />)}</ScrollView>}
      {concepts.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.concepts}>{concepts.slice(0, 8).map(item => <Chip key={item.code} label={item.label} active={concept === item.code} small onPress={() => { setConcept(concept === item.code ? '' : item.code); setPage(1); }} />)}</ScrollView>}
      <View style={styles.offer}><View><Text style={styles.offerLabel}>ƯU ĐÃI ĐẶC BIỆT</Text><Text style={styles.offerTitle}>Khám phá các concept nổi bật</Text></View><Ionicons name="sparkles" size={24} color="#F6C8D0" /></View>
      <View style={styles.resultHead}><View><Text style={styles.resultEyebrow}>DANH SÁCH GÓI CHỤP</Text><Text style={styles.section}>Gói chụp phù hợp</Text></View><Text style={styles.total}>{total} kết quả</Text></View>
      {loading ? <LoadingState label="Đang tìm gói chụp..." /> : error ? <ErrorState message={error} onRetry={reload} /> : items.length === 0 ? <EmptyState title="Chưa có gói phù hợp" message="Hãy thử thay đổi từ khóa hoặc bộ lọc." /> : <View style={styles.list}>{items.map(item => <PhotographyCard key={item._id} photographer={item} />)}</View>}
      {!loading && totalPages > 1 && <View style={styles.pagination}><AppButton title="Trang trước" variant="secondary" fullWidth={false} disabled={page <= 1} onPress={() => setPage(value => Math.max(1, value - 1))} /><Text style={styles.page}>{page}/{totalPages}</Text><AppButton title="Trang sau" variant="secondary" fullWidth={false} disabled={page >= totalPages} onPress={() => setPage(value => value + 1)} /></View>}
    </ScrollView>
    <AppModal visible={filterOpen} title="Lọc gói chụp" onClose={() => setFilterOpen(false)}><ScrollView showsVerticalScrollIndicator={false}><FilterTitle label="Sắp xếp" /><View style={styles.modalChips}>{sortOptions.map(item => <Chip key={item.value} label={item.label} active={sort === item.value} onPress={() => { setSort(item.value); setPage(1); }} />)}</View><FilterTitle label="Mức giá" /><View style={styles.modalChips}><Chip label="Tất cả" active={!maxPrice} onPress={() => setMaxPrice(undefined)} /><Chip label="Dưới 2 triệu" active={maxPrice === 2_000_000} onPress={() => setMaxPrice(2_000_000)} /><Chip label="Dưới 5 triệu" active={maxPrice === 5_000_000} onPress={() => setMaxPrice(5_000_000)} /></View><FilterTitle label="Đánh giá" /><View style={styles.modalChips}><Chip label="Tất cả" active={!minRating} onPress={() => setMinRating(undefined)} /><Chip label="Từ 4 sao" active={minRating === 4} onPress={() => setMinRating(4)} /><Chip label="Từ 4.5 sao" active={minRating === 4.5} onPress={() => setMinRating(4.5)} /></View><View style={styles.modalActions}><AppButton title="Đặt lại" variant="secondary" onPress={reset} /><AppButton title="Xem kết quả" onPress={() => setFilterOpen(false)} /></View></ScrollView></AppModal>
  </SafeAreaView>;
}

function Stat({ value, label }: { value: string; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Chip({ label, active, onPress, small }: { label: string; active: boolean; onPress: () => void; small?: boolean }) { return <Pressable onPress={onPress} style={[styles.chip, small && styles.chipSmall, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
function FilterTitle({ label }: { label: string }) { return <Text style={styles.filterTitle}>{label}</Text>; }

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:Colors.background},content:{paddingHorizontal:Spacing.lg,paddingBottom:38,gap:14},eyebrow:{fontFamily:FontFamily.bodySemiBold,fontSize:10,color:Colors.primary,marginTop:4},title:{fontFamily:FontFamily.display,fontSize:29,lineHeight:36,color:Colors.text},subtitle:{fontFamily:FontFamily.body,fontSize:13,lineHeight:20,color:Colors.textSecondary},stats:{flexDirection:'row',gap:8},stat:{flex:1,backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.md,paddingVertical:12,alignItems:'center'},statValue:{fontFamily:FontFamily.bodyBold,fontSize:16,color:Colors.primary},statLabel:{fontFamily:FontFamily.body,fontSize:8,color:Colors.textMuted,marginTop:3},searchCard:{backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.lg,padding:13,gap:10,...Shadow},searchBox:{height:47,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.md,flexDirection:'row',alignItems:'center',paddingHorizontal:12},input:{flex:1,fontFamily:FontFamily.body,fontSize:12,color:Colors.text,paddingHorizontal:9},twoColumns:{flexDirection:'row',gap:8},field:{flex:1,backgroundColor:Colors.background,borderRadius:Radius.sm,paddingHorizontal:11,paddingVertical:7},fieldLabel:{fontFamily:FontFamily.bodySemiBold,fontSize:8,color:Colors.textMuted},fieldInput:{fontFamily:FontFamily.bodyMedium,fontSize:11,color:Colors.text,paddingVertical:3},filterButton:{width:100,borderWidth:1,borderColor:Colors.border,borderRadius:Radius.sm,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},filterText:{fontFamily:FontFamily.bodySemiBold,fontSize:11,color:Colors.primary},chips:{gap:8,paddingRight:12},concepts:{gap:7,paddingRight:12},chip:{paddingHorizontal:14,paddingVertical:9,borderRadius:Radius.pill,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.surface},chipSmall:{paddingVertical:7,paddingHorizontal:11},chipActive:{backgroundColor:Colors.primary,borderColor:Colors.primary},chipText:{fontFamily:FontFamily.bodyMedium,fontSize:10,color:Colors.textSecondary},chipTextActive:{color:Colors.white},offer:{backgroundColor:Colors.primary,borderRadius:Radius.md,padding:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},offerLabel:{fontFamily:FontFamily.bodyBold,fontSize:8,color:'#EFC5CD'},offerTitle:{fontFamily:FontFamily.display,fontSize:16,color:Colors.white,marginTop:4},resultHead:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginTop:4},resultEyebrow:{fontFamily:FontFamily.bodySemiBold,fontSize:8,color:Colors.textMuted},section:{fontFamily:FontFamily.display,fontSize:20,color:Colors.text,marginTop:3},total:{fontFamily:FontFamily.bodyMedium,fontSize:10,color:Colors.textMuted},list:{gap:14},pagination:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,marginTop:4},page:{fontFamily:FontFamily.bodySemiBold,fontSize:12,color:Colors.text},modalChips:{flexDirection:'row',flexWrap:'wrap',gap:8},filterTitle:{fontFamily:FontFamily.bodyBold,fontSize:12,color:Colors.text,marginTop:12,marginBottom:9},modalActions:{gap:9,marginTop:22,paddingBottom:8}});
