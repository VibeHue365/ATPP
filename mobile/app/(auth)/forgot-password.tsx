import { type Href,router } from 'expo-router';
import { useState } from 'react';
import { Pressable,Text,View } from 'react-native';
import { authApi } from '@/apis/authApi';
import { AuthFrame,authStyles as s } from '@/components/auth/AuthFrame';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { getApiErrorMessage } from '@/utils/apiError';

export default function ForgotPassword(){const[email,setEmail]=useState('');const[loading,setLoading]=useState(false);const[error,setError]=useState('');const[message,setMessage]=useState('');const send=async()=>{if(!/^\S+@\S+\.\S+$/.test(email.trim())){setError('Vui lòng nhập đúng địa chỉ email.');return}setLoading(true);setError('');try{const result=await authApi.forgotPassword(email.trim().toLowerCase());setMessage('Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.');if(result.demoResetToken)router.push({pathname:'/(auth)/reset-password',params:{token:result.demoResetToken}} as unknown as Href)}catch(e){setError(getApiErrorMessage(e,'Không thể gửi yêu cầu.'))}finally{setLoading(false)}};return <AuthFrame><View style={s.card}><Text style={s.eyebrow}>KHÔI PHỤC TÀI KHOẢN</Text><Text style={s.title}>Quên mật khẩu?</Text><Text style={s.subtitle}>Nhập email đã đăng ký. Liên kết đặt lại mật khẩu có hiệu lực trong 15 phút.</Text><AppInput label="Địa chỉ email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"/>{!!message&&<Text style={s.success}>{message}</Text>}{!!error&&<Text style={s.error}>{error}</Text>}<AppButton title="Gửi liên kết khôi phục" loading={loading} onPress={()=>void send()}/><Pressable onPress={()=>router.replace('/(auth)/login' as Href)}><Text style={[s.link,{textAlign:'center'}]}>Quay lại đăng nhập</Text></Pressable></View></AuthFrame>}
