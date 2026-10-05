import { useCallback, useEffect, useState } from 'react';
import { storeApi } from '@/apis/storeApi';
import type { Product } from '@/types/product';
import type { ProviderStore } from '@/types/store';
import { getApiErrorMessage } from '@/utils/apiError';

export function useProviderStore(id?:string){
  const[store,setStore]=useState<ProviderStore|null>(null);const[products,setProducts]=useState<Product[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{if(!id){setError('Thiếu mã cửa hàng');setLoading(false);return}setLoading(true);setError(null);try{const[storeResult,productResult]=await Promise.all([storeApi.detail(id),storeApi.products(id)]);setStore(storeResult);setProducts(Array.isArray(productResult)?productResult:[])}catch(cause){setError(getApiErrorMessage(cause,'Không thể tải thông tin gian hàng'))}finally{setLoading(false)}},[id]);
  useEffect(()=>{void load()},[load]);return{store,products,loading,error,reload:load};
}
