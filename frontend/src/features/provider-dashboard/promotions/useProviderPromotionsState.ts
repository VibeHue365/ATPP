
import { useState } from 'react';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderPromotionsState() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [photoPackages, setPhotoPackages] = useState<any[]>([]);
  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cProductId, setCProductId] = useState('');
  const [cPackageId, setCPackageId] = useState('');
  const [cDiscount, setCDiscount] = useState<number | ''>(10);
  const [cPrice, setCPrice] = useState('');
  const [cValidFrom, setCValidFrom] = useState('');
  const [cValidTo, setCValidTo] = useState('');
  const [cMaxUsage, setCMaxUsage] = useState<number | ''>(10);
  const [cAoDaiQuantity, setCAoDaiQuantity] = useState<number | ''>(1);
  const [cShootPeopleCount, setCShootPeopleCount] = useState<number | ''>(1);
  const [isAoDaiModalOpen, setIsAoDaiModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [aoDaiSearch, setAoDaiSearch] = useState('');
  const [packageSearch, setPackageSearch] = useState('');
  const [editingComboId, setEditingComboId] = useState<string | null>(null);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [vCode, setVCode] = useState('');
  const [vName, setVName] = useState('');
  const [vDesc, setVDesc] = useState('');
  const [vType, setVType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [vValue, setVValue] = useState<number | ''>(10);
  const [vMaxDiscount, setVMaxDiscount] = useState<number | ''>('');
  const [vMinOrder, setVMinOrder] = useState<number | ''>(0);
  const [vUsageLimit, setVUsageLimit] = useState<number | ''>(50);
  const [vStartDate, setVStartDate] = useState('');
  const [vEndDate, setVEndDate] = useState('');
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  return {
    vouchers, setVouchers, combos, setCombos, photoPackages, setPhotoPackages, cName, setCName, cDesc,
    setCDesc, cProductId, setCProductId, cPackageId, setCPackageId, cDiscount, setCDiscount, cPrice,
    setCPrice, cValidFrom, setCValidFrom, cValidTo, setCValidTo, cMaxUsage, setCMaxUsage, cAoDaiQuantity,
    setCAoDaiQuantity, cShootPeopleCount, setCShootPeopleCount, isAoDaiModalOpen, setIsAoDaiModalOpen,
    isPackageModalOpen, setIsPackageModalOpen, aoDaiSearch, setAoDaiSearch, packageSearch,
    setPackageSearch, editingComboId, setEditingComboId, editingVoucherId, setEditingVoucherId,
    vCode, setVCode, vName, setVName, vDesc, setVDesc, vType, setVType, vValue, setVValue,
    vMaxDiscount, setVMaxDiscount, vMinOrder, setVMinOrder, vUsageLimit, setVUsageLimit,
    vStartDate, setVStartDate, vEndDate, setVEndDate, isVoucherModalOpen, setIsVoucherModalOpen,
  };
}
