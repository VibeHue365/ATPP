
import { useState } from 'react';
import type { CancellationRefundRule } from '../types';

/** Called unconditionally by the dashboard so tab changes do not reset this state. */
export function useProviderProfileState() {
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [cancellationRefundRules, setCancellationRefundRules] = useState<CancellationRefundRule[]>([]);
  const [cancellationAdditionalNotes, setCancellationAdditionalNotes] = useState('');
  const [comboDiscountPercent, setComboDiscountPercent] = useState(0);
  const [baseLatitude, setBaseLatitude] = useState('');
  const [baseLongitude, setBaseLongitude] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('');
  const [useBusinessAddressForPickup, setUseBusinessAddressForPickup] = useState(true);
  const [pickupAddressLine, setPickupAddressLine] = useState('');
  const [pickupLatitude, setPickupLatitude] = useState('');
  const [pickupLongitude, setPickupLongitude] = useState('');
  const [profileSection, setProfileSection] = useState<'business' | 'location' | 'policy'>('business');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  return {
    businessName, setBusinessName, phone, setPhone, addressLine, setAddressLine, city, setCity,
    cancellationRefundRules, setCancellationRefundRules, cancellationAdditionalNotes,
    setCancellationAdditionalNotes, comboDiscountPercent, setComboDiscountPercent, baseLatitude,
    setBaseLatitude, baseLongitude, setBaseLongitude, serviceRadiusKm, setServiceRadiusKm,
    useBusinessAddressForPickup, setUseBusinessAddressForPickup, pickupAddressLine, setPickupAddressLine,
    pickupLatitude, setPickupLatitude, pickupLongitude, setPickupLongitude, profileSection,
    setProfileSection, isSavingProfile, setIsSavingProfile,
  };
}
