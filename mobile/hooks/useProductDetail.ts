import { useEffect, useState } from 'react';
import { productApi, type AvailabilityParams, type AvailabilityResult } from '@/apis/productApi';
import type { Product } from '@/types/product';
import type { ProductReview } from '@/types/review';
import { getApiErrorMessage } from '@/utils/apiError';

export function useProductDetail(id?:string){const [product,setProduct]=useState<Product|null>(null);const [reviews,setReviews]=useState<ProductReview[]>([]);const [related,setRelated]=useState<Product[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);
  const load=async()=>{if(!id)return;try{setLoading(true);setError(null);const [detail,reviewList,page]=await Promise.all([productApi.detail(id),productApi.reviews(id).catch(()=>[]),productApi.list({page:1,limit:6,sort:'rating_desc'}).catch(()=>null)]);setProduct(detail);setReviews(reviewList);setRelated((page?.data??[]).filter(item=>item._id!==id).slice(0,4))}catch(cause){setError(getApiErrorMessage(cause,'Không thể tải sản phẩm'))}finally{setLoading(false)}};
  useEffect(()=>{void load()},[id]);return{product,reviews,related,loading,error,reload:load}}

export function useAvailability(id:string|undefined,input:AvailabilityParams|null){const [state,setState]=useState<'idle'|'checking'|'available'|'unavailable'|'error'>('idle');const [result,setResult]=useState<AvailabilityResult|null>(null);useEffect(()=>{if(!id||!input){setState('idle');setResult(null);return}let active=true;setState('checking');const timer=setTimeout(()=>productApi.availability(id,input).then(value=>{if(active){setResult(value);setState(value.available?'available':'unavailable')}}).catch(()=>{if(active)setState('error')}),350);return()=>{active=false;clearTimeout(timer)}},[id,JSON.stringify(input)]);return{state,result}}
