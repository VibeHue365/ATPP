import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { User } from '../schemas/user.schema';

@Injectable()
export class UserProfileMapper {
  toMeResponse(
    user: User & { _id: Types.ObjectId },
    roles: string[],
  ): Record<string, unknown> {
    return {
      id: user._id.toString(),
      email: user.auth.email,
      phone: user.auth.phone,
      emailVerified: user.auth.emailVerified,
      phoneVerified: user.auth.phoneVerified,
      status: user.accountStatus,
      roles,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      preferences: user.preferences,
      favorites: user.favorites || [],
      addresses: (user.addresses || []).map((address) => ({
        id: (address as unknown as { _id?: Types.ObjectId })._id?.toString(),
        label: address.label,
        recipientName: address.recipientName ?? null,
        phone: address.phone ?? null,
        addressLine: address.addressLine,
        ward: address.ward ?? null,
        district: address.district ?? null,
        city: address.city ?? null,
        note: address.note ?? null,
        isDefault: Boolean(address.isDefault),
      })),
      profile: {
        fullName: user.profile.fullName,
        phone: user.auth.phone,
        gender: user.profile.gender,
        dateOfBirth: user.profile.dateOfBirth,
        avatarUrl: user.profile.avatarUrl,
      },
    };
  }
}
