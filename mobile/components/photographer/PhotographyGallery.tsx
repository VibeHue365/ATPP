import { Image } from 'expo-image';
import { useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily } from '@/constants/theme';
import { getMediaUrl } from '@/utils/media';

const width = Dimensions.get('window').width;
export function PhotographyGallery({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  return <View style={styles.root}>{images.length ? <ScrollView horizontal pagingEnabled onMomentumScrollEnd={onScroll} showsHorizontalScrollIndicator={false}>{images.map((uri, imageIndex) => <Image key={`${uri}-${imageIndex}`} source={getMediaUrl(uri)} style={styles.image} contentFit="cover" transition={180} />)}</ScrollView> : <View style={styles.empty}><Text style={styles.emptyText}>LUMÉ PHOTOGRAPHY</Text></View>}<View style={styles.counter}><Text style={styles.counterText}>{index + 1}/{Math.max(images.length, 1)} ảnh</Text></View></View>;
}
const styles = StyleSheet.create({root:{height:330,backgroundColor:'#A8737C'},image:{width,height:330},empty:{flex:1,alignItems:'center',justifyContent:'center'},emptyText:{fontFamily:FontFamily.display,fontSize:20,color:Colors.white,letterSpacing:2},counter:{position:'absolute',right:16,bottom:14,backgroundColor:'#00000088',borderRadius:99,paddingHorizontal:10,paddingVertical:5},counterText:{fontFamily:FontFamily.bodyMedium,fontSize:10,color:Colors.white}});
