import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { bookingApi } from '@/apis/bookingApi';
import type { Booking } from '@/types/booking';
import { getApiErrorMessage } from '@/utils/apiError';

export function useBookings(){const[items,setItems]=useState<Booking[]>([]);const[loading,setLoading]=useState(true);const[refreshing,setRefreshing]=useState(false);const[error,setError]=useState<string|null>(null);const load=useCallback(async(silent=false)=>{silent?setRefreshing(true):setLoading(true);try{setError(null);const data=await bookingApi.list();setItems(Array.isArray(data)?data:[])}catch(cause){setError(getApiErrorMessage(cause,'Không thể tải đơn hàng và lịch'))}finally{setLoading(false);setRefreshing(false)}},[]);useFocusEffect(useCallback(()=>{void load();return undefined},[load]));return{items,loading,refreshing,error,reload:()=>load(true)}}

export function useBookingDetail(id?:string){const[item,setItem]=useState<Booking|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState<string|null>(null);const load=useCallback(async()=>{if(!id){setError('Thiếu mã đơn hàng');setLoading(false);return}setLoading(true);try{setError(null);setItem(await bookingApi.detail(id))}catch(cause){setError(getApiErrorMessage(cause,'Không thể tải chi tiết đơn hàng'))}finally{setLoading(false)}},[id]);useFocusEffect(useCallback(()=>{void load();return undefined},[load]));return{item,loading,error,reload:load}}
