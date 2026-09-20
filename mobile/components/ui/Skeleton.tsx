import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';
import { Radius } from '@/constants/theme';
export function Skeleton({style}:{style?:ViewStyle}){const opacity=useRef(new Animated.Value(.35)).current;useEffect(()=>{const animation=Animated.loop(Animated.sequence([Animated.timing(opacity,{toValue:.8,duration:700,useNativeDriver:true}),Animated.timing(opacity,{toValue:.35,duration:700,useNativeDriver:true})]));animation.start();return()=>animation.stop()},[opacity]);return <Animated.View style={[s.base,style,{opacity}]}/>}
const s=StyleSheet.create({base:{height:16,width:'100%',borderRadius:Radius.sm,backgroundColor:'#DDD3D1'}});
