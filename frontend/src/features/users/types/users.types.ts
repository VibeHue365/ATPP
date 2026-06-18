export interface ChannelSettings {
  email: boolean;
  app: boolean;
}

export interface UserNotificationSettings {
  booking: ChannelSettings;
  finance: ChannelSettings;
  schedule: ChannelSettings;
  system: ChannelSettings;
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
  createdAt?: string;
  notificationSettings?: UserNotificationSettings;
}

export interface BackendUserProfileResponse {
  id: string;
  email: string;
  emailVerified?: boolean;
  isEmailVerified?: boolean;
  status?: string;
  roles?: string[];
  createdAt?: string;
  profile?: {
    fullName?: string;
    phone?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    dateOfBirth?: string;
    avatarUrl?: string | null;
  } | null;
  notificationSettings?: UserNotificationSettings;
}

export interface UpdateProfileDto {
  fullName?: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
}
