import { httpClient } from '../../../services/httpClient';
import type {
  BackendUserProfileResponse,
  UserProfile,
  UpdateProfileDto,
} from '../types/users.types';

const normalizeUserProfile = (response: BackendUserProfileResponse): UserProfile => {
  const profile = response.profile;
  const avatar = profile?.avatarUrl ?? undefined;

  return {
    id: response.id,
    email: response.email,
    fullName: profile?.fullName ?? '',
    phone: profile?.phone,
    gender: profile?.gender,
    dateOfBirth: profile?.dateOfBirth,
    avatar,
    avatarUrl: avatar,
    isEmailVerified: response.isEmailVerified ?? response.emailVerified ?? false,
    roles: response.roles,
    status: response.status,
    createdAt: response.createdAt,
  };
};

export const userService = {
  async getMe(): Promise<UserProfile> {
    const response = await httpClient.get<BackendUserProfileResponse>('/users/me');
    return normalizeUserProfile(response);
  },

  async updateProfile(payload: UpdateProfileDto): Promise<UserProfile> {
    const response = await httpClient.patch<BackendUserProfileResponse>('/users/me', payload);
    return normalizeUserProfile(response);
  },

  async updateAvatar(formData: FormData): Promise<UserProfile> {
    const response = await httpClient.patch<BackendUserProfileResponse>('/users/me/avatar', formData);
    return normalizeUserProfile(response);
  },
};
