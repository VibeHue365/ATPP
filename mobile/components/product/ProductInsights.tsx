import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius } from '@/constants/theme';
import type { Product } from '@/types/product';

interface ProductInsightsProps {
  product: Product;
  compact?: boolean;
  showRecommendation?: boolean;
}

export function ProductInsights({ product, compact = false, showRecommendation = true }: ProductInsightsProps) {
  const badges = (product.badges ?? []).slice(0, compact ? 2 : 4);
  const customTags = (product.customTags ?? []).slice(0, compact ? 2 : 6);
  const recommendation = showRecommendation ? product.recommendation : undefined;
  const hasTags = badges.length > 0 || customTags.length > 0;

  if (!recommendation && !hasTags) return null;

  return <View style={[styles.root, compact && styles.compactRoot]}>
    {recommendation ? <View style={[styles.recommendation, compact && styles.compactRecommendation]}>
      <Ionicons name="sparkles" size={compact ? 11 : 15} color={Colors.primary}/>
      <Text numberOfLines={compact ? 2 : 3} style={[styles.recommendationText, compact && styles.compactText]}>
        <Text style={styles.match}>{recommendation.matchPercent}% phù hợp</Text>
        {recommendation.reasons[0] ? ` · ${recommendation.reasons[0]}` : ' · Đề xuất cho bạn'}
      </Text>
    </View> : null}
    {hasTags ? <View style={styles.tags}>
      {badges.map(badge => <View key={`badge-${badge.code}`} style={[styles.badge, badge.displayConfig?.backgroundColor ? { backgroundColor: badge.displayConfig.backgroundColor } : null]}>
        <Text numberOfLines={1} style={[styles.badgeText, badge.displayConfig?.color ? { color: badge.displayConfig.color } : null]}>{badge.label}</Text>
      </View>)}
      {customTags.map(tag => <View key={`custom-${tag.normalizedLabel}`} style={styles.customTag}>
        <Text numberOfLines={1} style={styles.customTagText}>#{tag.label}</Text>
      </View>)}
    </View> : null}
  </View>;
}

const styles=StyleSheet.create({
  root:{gap:8,marginTop:10},
  compactRoot:{gap:6,marginTop:7},
  recommendation:{flexDirection:'row',alignItems:'flex-start',gap:7,padding:10,borderRadius:Radius.sm,backgroundColor:Colors.primarySoft,borderWidth:1,borderColor:'#E7C8CE'},
  compactRecommendation:{paddingHorizontal:7,paddingVertical:6,gap:4},
  recommendationText:{flex:1,fontFamily:FontFamily.body,fontSize:10,lineHeight:15,color:Colors.textSecondary},
  compactText:{fontSize:8,lineHeight:12},
  match:{fontFamily:FontFamily.bodyBold,color:Colors.primary},
  tags:{flexDirection:'row',flexWrap:'wrap',gap:5},
  badge:{maxWidth:'100%',paddingHorizontal:8,paddingVertical:4,borderRadius:Radius.pill,backgroundColor:Colors.primarySoft},
  badgeText:{fontFamily:FontFamily.bodySemiBold,fontSize:8,color:Colors.primary},
  customTag:{maxWidth:'100%',paddingHorizontal:8,paddingVertical:4,borderRadius:Radius.pill,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.surface},
  customTagText:{fontFamily:FontFamily.bodyMedium,fontSize:8,color:Colors.textSecondary},
});
