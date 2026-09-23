import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { authApi } from '@/apis/authApi';
import { appStorage, tokenStorage } from '@/utils/storage';
import { mapSessionUser, type LoginPayload, type SessionUser } from '@/types/auth';
import { authEvents } from '@/services/authEvents';
import { userApi } from '@/apis/userApi';
import type { UserFavorite } from '@/types/auth';

const USER_KEY='vh_session_user';
interface AuthValue { user:SessionUser|null; loading:boolean; isAuthenticated:boolean; login:(payload:LoginPayload)=>Promise<SessionUser>; logout:()=>Promise<void>; refreshUser:()=>Promise<void>; toggleFavorite:(type:'PRODUCT'|'PROVIDER',id:string)=>Promise<void>; isFavorite:(type:'PRODUCT'|'PROVIDER',id:string)=>boolean; }
const AuthContext=createContext<AuthValue|null>(null);
export function AuthProvider({children}:PropsWithChildren){const [user,setUser]=useState<SessionUser|null>(null);const [loading,setLoading]=useState(true);
  const saveUser=useCallback(async(value:SessionUser|null)=>{setUser(value);if(value)await appStorage.set(USER_KEY,JSON.stringify(value));else await appStorage.remove(USER_KEY)},[]);
  const refreshUser=useCallback(async()=>{const current=await authApi.me();await saveUser(mapSessionUser(current,current.roles));},[saveUser]);
  useEffect(()=>{(async()=>{try{const [token,cached]=await Promise.all([tokenStorage.getAccessToken(),appStorage.get(USER_KEY)]);if(token&&cached)setUser(JSON.parse(cached));if(token)await refreshUser();}catch{await tokenStorage.clear();await saveUser(null);}finally{setLoading(false)}})()},[refreshUser,saveUser]);
  useEffect(()=>authEvents.subscribe(()=>{void saveUser(null)}),[saveUser]);
  const login=useCallback(async(payload:LoginPayload)=>{const response=await authApi.login(payload);await tokenStorage.replaceTokens(response.accessToken,response.refreshToken);const next=mapSessionUser(response.user,response.roles);await saveUser(next);return next},[saveUser]);
  const logout=useCallback(async()=>{try{await authApi.logout()}catch{}finally{await tokenStorage.clear();await saveUser(null)}},[saveUser]);
  const toggleFavorite=useCallback(async(type:'PRODUCT'|'PROVIDER',id:string)=>{const updated=await userApi.toggleFavorite(type,id);await saveUser(mapSessionUser(updated,updated.roles))},[saveUser]);
  const isFavorite=useCallback((type:'PRODUCT'|'PROVIDER',id:string)=>(user?.favorites as UserFavorite[]|undefined)?.some(item=>item.targetType.toUpperCase()===type&&String(item.targetId)===id)??false,[user]);
  const value=useMemo(()=>({user,loading,isAuthenticated:Boolean(user),login,logout,refreshUser,toggleFavorite,isFavorite}),[user,loading,login,logout,refreshUser,toggleFavorite,isFavorite]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used inside AuthProvider');return value}
