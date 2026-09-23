import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { LoadingState } from '@/components/ui/ScreenState';
import { pendingCheckoutStorage } from '@/services/pendingCheckout';
export default function PaymentSuccess(){const[code,setCode]=useState<string|null>();useEffect(()=>{void pendingCheckoutStorage.latest().then(value=>setCode(value?.paymentCode??null))},[]);if(code===undefined)return <LoadingState label="Đang mở kết quả thanh toán..."/>;return <Redirect href={code?`/payment/result?code=${encodeURIComponent(code)}`:'/payment/result'}/>}
