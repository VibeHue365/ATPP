export interface UserAddress {
  id?: string;
  label: string;
  recipientName?: string | null;
  phone?: string | null;
  addressLine: string;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  note?: string | null;
  isDefault: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
  avatar?: string;
  avatarUrl?: string;
  isEmailVerified: boolean;
  roles?: string[];
  status?: string;
  hasCompletedOnboarding?: boolean;
  preferences?: any;
  favorites?: any[];
  addresses?: UserAddress[];
  createdAt?: string;
}

export interface BackendUserProfileResponse {
  id: string;
  email: string;
  emailVerified?: boolean;
  isEmailVerified?: boolean;
  status?: string;
  roles?: string[];
  hasCompletedOnboarding?: boolean;
  preferences?: any;
  favorites?: any[];
  addresses?: UserAddress[];
  createdAt?: string;
  profile?: {
    fullName?: string;
    phone?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    dateOfBirth?: string;
    avatarUrl?: string | null;
  } | null;
}

export interface UpdateProfileDto {
  fullName?: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
}
