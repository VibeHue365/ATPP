import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useAuth } from './AuthContext';
import { appStorage } from '@/utils/storage';
import type { CartItem, NewCartItem } from '@/types/cart';

interface CartValue { items:CartItem[]; count:number; ready:boolean; addItem:(item:NewCartItem)=>void; removeItem:(id:string)=>void; updateItem:(id:string,patch:Partial<CartItem>)=>void; clear:()=>void; }
const CartContext=createContext<CartValue|null>(null);
const keyFor=(id?:string)=>id?`vh_cart_${id}`:'vh_cart_guest';
const same=(a:CartItem,b:NewCartItem)=>a.itemType===b.itemType&&a.productId===b.productId&&a.photographyPackageId===b.photographyPackageId&&a.comboId===b.comboId&&a.rentalFrom===b.rentalFrom&&a.rentalTo===b.rentalTo&&a.size===b.size&&a.color===b.color&&a.shootDate===b.shootDate&&a.shootTimeSlot===b.shootTimeSlot;
export function CartProvider({children}:PropsWithChildren){const {user}=useAuth();const [items,setItems]=useState<CartItem[]>([]);const [ready,setReady]=useState(false);const key=keyFor(user?.id);
  useEffect(()=>{let active=true;(async()=>{setReady(false);try{const own=JSON.parse((await appStorage.get(key))??'[]') as CartItem[];if(user){const guest=JSON.parse((await appStorage.get(keyFor()))??'[]') as CartItem[];for(const entry of guest){const found=own.find(item=>same(item,entry));if(found)found.quantity+=entry.quantity;else own.push(entry)}if(guest.length)await appStorage.remove(keyFor())}if(active)setItems(Array.isArray(own)?own:[])}catch{if(active)setItems([])}finally{if(active)setReady(true)}})();return()=>{active=false}},[key,user]);
  useEffect(()=>{if(ready)void appStorage.set(key,JSON.stringify(items))},[items,key,ready]);
  const addItem=useCallback((input:NewCartItem)=>setItems(current=>{const found=current.find(item=>same(item,input));if(found)return current.map(item=>item.id===found.id?{...item,quantity:item.quantity+(input.quantity??1)}:item);return [...current,{...input,id:`${input.itemType}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,quantity:input.quantity??1}]}),[]);
  const removeItem=useCallback((id:string)=>setItems(current=>current.filter(item=>item.id!==id)),[]);const updateItem=useCallback((id:string,patch:Partial<CartItem>)=>setItems(current=>current.map(item=>item.id===id?{...item,...patch}:item)),[]);const clear=useCallback(()=>setItems([]),[]);
  const value=useMemo(()=>({items,count:items.reduce((sum,item)=>sum+item.quantity,0),ready,addItem,removeItem,updateItem,clear}),[items,ready,addItem,removeItem,updateItem,clear]);return <CartContext.Provider value={value}>{children}</CartContext.Provider>}
export function useCart(){const value=useContext(CartContext);if(!value)throw new Error('useCart must be used inside CartProvider');return value}
