import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/ScreenState';
import { Colors, FontFamily, Radius } from '@/constants/theme';
import type { PhotographerReview } from '@/types/photographer';
import { getMediaUrl } from '@/utils/media';

export function PhotographerReviews({ reviews, rating = 0 }: { reviews: PhotographerReview[]; rating?: number }) {
  return <View style={styles.root}>
    <View style={styles.heading}><Text style={styles.title}>Khách hàng nói gì?</Text><Text style={styles.score}>★ {rating.toFixed(1)}</Text></View>
    {reviews.length === 0 ? <EmptyState title="Chưa có đánh giá" message="Studio chưa nhận được đánh giá công khai." /> : reviews.slice(0, 5).map(review => {
      const name = review.customerId?.profile?.fullName ?? review.customerId?.fullName ?? review.customerId?.email ?? 'Khách hàng';
      const avatar = review.customerId?.profile?.avatarUrl ?? review.customerId?.avatarUrl;
      return <AppCard key={review._id} style={styles.card}>
        <View style={styles.userRow}>{avatar ? <Image source={getMediaUrl(avatar)} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarFallback}><Text style={styles.initial}>{name.charAt(0).toUpperCase()}</Text></View>}<View style={styles.userInfo}><Text style={styles.name}>{name}</Text><Text style={styles.date}>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</Text></View><Text style={styles.stars}>{'★'.repeat(Math.max(0, Math.min(5, Math.round(review.rating))))}</Text></View>
        {!!review.comment && <Text style={styles.comment}>{review.comment}</Text>}
        {!!review.reply && <View style={styles.reply}><Text style={styles.replyTitle}>↩ Studio đã phản hồi</Text><Text style={styles.replyText}>{review.reply}</Text></View>}
      </AppCard>;
    })}
  </View>;
}

const styles = StyleSheet.create({root:{paddingHorizontal:16,gap:10},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{fontFamily:FontFamily.display,fontSize:20,color:Colors.text},score:{fontFamily:FontFamily.bodyBold,fontSize:12,color:'#EC9819'},card:{padding:14},userRow:{flexDirection:'row',alignItems:'center'},avatar:{width:38,height:38,borderRadius:99},avatarFallback:{width:38,height:38,borderRadius:99,backgroundColor:Colors.primarySoft,alignItems:'center',justifyContent:'center'},initial:{fontFamily:FontFamily.bodyBold,fontSize:13,color:Colors.primary},userInfo:{flex:1,marginLeft:9},name:{fontFamily:FontFamily.bodySemiBold,fontSize:11,color:Colors.text},date:{fontFamily:FontFamily.body,fontSize:8,color:Colors.textMuted,marginTop:2},stars:{fontSize:10,color:'#EC9819'},comment:{fontFamily:FontFamily.body,fontSize:11,lineHeight:18,color:Colors.textSecondary,marginTop:10},reply:{backgroundColor:Colors.background,borderRadius:Radius.sm,padding:10,marginTop:10,borderLeftWidth:3,borderLeftColor:Colors.primary},replyTitle:{fontFamily:FontFamily.bodySemiBold,fontSize:9,color:Colors.primary},replyText:{fontFamily:FontFamily.body,fontSize:10,lineHeight:16,color:Colors.textSecondary,marginTop:4}});
