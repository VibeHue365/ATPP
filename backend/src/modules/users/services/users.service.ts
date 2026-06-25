import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { UserProfile } from '../schemas/user.schema';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserProfileMapper } from '../mappers/user-profile.mapper';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly userProfileMapper: UserProfileMapper,
  ) {}

  async getMe(
    userId: string,
    roles: string[] = [],
  ): Promise<Record<string, unknown>> {
    const userObjectId = this.toObjectId(userId);
    const user = await this.usersRepository.findUserById(userObjectId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.userProfileMapper.toMeResponse(user, roles);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    _ipAddress?: string,
    _userAgent?: string,
    roles: string[] = [],
  ): Promise<Record<string, unknown>> {
    const userObjectId = this.toObjectId(userId);
    const update: Partial<UserProfile> & {
      phone?: string | null;
      phoneNormalized?: string | null;
    } = {};

    if (dto.fullName !== undefined) update.fullName = dto.fullName;
    if (dto.phone !== undefined) {
      const phoneNormalized = this.normalizePhone(dto.phone);
      const phoneUsedByAnotherUser =
        await this.usersRepository.isPhoneUsedByAnotherUser(
          phoneNormalized,
          userObjectId,
        );

      if (phoneUsedByAnotherUser) {
        throw new BadRequestException('Phone already exists');
      }

      update.phone = dto.phone;
      update.phoneNormalized = phoneNormalized;
    }
    if (dto.gender !== undefined) update.gender = dto.gender;
    if (dto.dateOfBirth !== undefined)
      update.dateOfBirth = new Date(dto.dateOfBirth);

    const changedFields = Object.keys(update);
    if (changedFields.length === 0) {
      throw new BadRequestException('No valid profile fields to update');
    }

    await this.usersRepository.updateProfile(userObjectId, update);

    return this.getMe(userId, roles);
  }

  async updateAvatar(
    userId: string,
    file: Express.Multer.File | undefined,
    _ipAddress?: string,
    _userAgent?: string,
    roles: string[] = [],
  ): Promise<Record<string, unknown>> {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        'Only jpg, png, and webp images are allowed',
      );
    }

    const userObjectId = this.toObjectId(userId);
    const avatarUrl = `/uploads/avatars/${file.filename}`;

    await this.usersRepository.updateProfile(userObjectId, { avatarUrl });

    return this.getMe(userId, roles);
  }

  private toObjectId(userId: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    return new Types.ObjectId(userId);
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\s/g, '');
  }
}
