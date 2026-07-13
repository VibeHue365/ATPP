import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { Types } from 'mongoose';
import {
  AdminAuditAction,
} from '../../auth/schemas/admin-audit-log.schema';
import { SecurityEventType } from '../../auth/schemas/security-event.schema';
import {
  SecurityLogService,
  SecurityRequestContext,
} from '../../auth/services/security-log.service';
import { UserDocument, UserProfile, UserStatus } from '../schemas/user.schema';
import {
  AccountLockType,
  AdminListUsersQueryDto,
  LockUserDto,
  UnlockUserDto,
  UserRole,
  UpdateUserRolesDto,
  UpdateUserStatusDto,
} from '../dto/admin-users.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserProfileMapper } from '../mappers/user-profile.mapper';
import { UsersRepository } from '../repositories/users.repository';

const assignableRoles: string[] = Object.values(UserRole);

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly userProfileMapper: UserProfileMapper,
    private readonly securityLogService: SecurityLogService,
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
      this.removeUploadedFile(file.path);
      throw new UnsupportedMediaTypeException(
        'Only jpg, png, and webp images are allowed',
      );
    }

    if (!this.hasValidImageSignature(file)) {
      this.removeUploadedFile(file.path);
      throw new UnsupportedMediaTypeException(
        'Avatar file content is not a supported image',
      );
    }

    const userObjectId = this.toObjectId(userId);
    const avatarUrl = `/uploads/avatars/${file.filename}`;

    await this.usersRepository.updateProfile(userObjectId, { avatarUrl });

    return this.getMe(userId, roles);
  }

  async adminListUsers(
    query: AdminListUsersQueryDto,
  ): Promise<Record<string, unknown>> {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
    const { items, total } = await this.usersRepository.listUsersForAdmin({
      keyword: query.keyword,
      role: query.role,
      status: query.status,
      page,
      limit,
    });

    return {
      items: items.map((user) => this.toAdminUserResponse(user)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async adminGetUser(userId: string): Promise<Record<string, unknown>> {
    const user = await this.usersRepository.findUserById(
      this.toObjectId(userId),
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toAdminUserResponse(user, true);
  }

  async adminUpdateRoles(
    actorId: string,
    userId: string,
    dto: UpdateUserRolesDto,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId);
    const targetUserId = this.toObjectId(userId);
    const normalizedRoles = this.normalizeRoles(dto.roles);
    const targetUser = await this.usersRepository.findUserById(targetUserId);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (
      targetUser.roles.includes('ADMIN') &&
      targetUser.accountStatus === UserStatus.Active &&
      !normalizedRoles.includes('ADMIN') &&
      (await this.usersRepository.countActiveAdmins()) <= 1
    ) {
      throw new BadRequestException('Cannot remove the last admin role');
    }

    if (
      actorObjectId.equals(targetUserId) &&
      !normalizedRoles.includes('ADMIN')
    ) {
      throw new ForbiddenException('Cannot remove your own admin role');
    }

    const updated = await this.usersRepository.updateRoles(
      targetUserId,
      normalizedRoles,
      normalizedRoles[0],
    );

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    await this.securityLogService.recordAdminAudit({
      actorId: actorObjectId,
      targetUserId,
      action: AdminAuditAction.UserRoleUpdated,
      before: this.toUserAuditState(targetUser),
      after: this.toUserAuditState(updated),
      reason: dto.reason,
      context,
    });

    return this.toAdminUserResponse(updated, true);
  }

  async adminUpdateStatus(
    actorId: string,
    userId: string,
    dto: UpdateUserStatusDto,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    if (dto.status === UserStatus.Deleted) {
      throw new BadRequestException('Deleted status is not supported here');
    }

    const actorObjectId = this.toObjectId(actorId);
    const targetUserId = this.toObjectId(userId);

    if (actorObjectId.equals(targetUserId) && dto.status !== UserStatus.Active) {
      throw new ForbiddenException('Cannot disable your own account');
    }

    const targetUser = await this.usersRepository.findUserById(targetUserId);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (
      targetUser.roles.includes('ADMIN') &&
      targetUser.accountStatus === UserStatus.Active &&
      dto.status !== UserStatus.Active &&
      (await this.usersRepository.countActiveAdmins()) <= 1
    ) {
      throw new BadRequestException('Cannot disable the last admin account');
    }

    const updated = await this.usersRepository.updateAccountStatus(
      targetUserId,
      dto.status,
      dto.reason,
    );

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    await this.securityLogService.recordAdminAudit({
      actorId: actorObjectId,
      targetUserId,
      action: AdminAuditAction.UserStatusUpdated,
      before: this.toUserAuditState(targetUser),
      after: this.toUserAuditState(updated),
      reason: dto.reason,
      context,
    });

    return this.toAdminUserResponse(updated, true);
  }

  async adminLockUser(
    actorId: string,
    userId: string,
    dto: LockUserDto,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId);
    const targetUserId = this.toObjectId(userId);

    if (actorObjectId.equals(targetUserId)) {
      throw new ForbiddenException('Cannot lock your own account');
    }

    const targetUser = await this.usersRepository.findUserById(targetUserId);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (
      targetUser.roles.includes('ADMIN') &&
      targetUser.accountStatus === UserStatus.Active &&
      (await this.usersRepository.countActiveAdmins()) <= 1
    ) {
      throw new BadRequestException('Cannot lock the last admin account');
    }

    const lockedUntil =
      dto.type === AccountLockType.Suspended
        ? new Date(dto.lockedUntil as string)
        : null;

    if (lockedUntil && lockedUntil.getTime() <= Date.now()) {
      throw new BadRequestException('lockedUntil must be in the future');
    }

    const updated = await this.usersRepository.lockUser(
      targetUserId,
      dto.type === AccountLockType.Suspended
        ? UserStatus.Suspended
        : UserStatus.Banned,
      actorObjectId,
      dto.reason,
      lockedUntil,
    );

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    await Promise.all([
      this.securityLogService.recordAdminAudit({
        actorId: actorObjectId,
        targetUserId,
        action: AdminAuditAction.UserLocked,
        before: this.toUserAuditState(targetUser),
        after: this.toUserAuditState(updated),
        reason: dto.reason,
        context,
      }),
      this.securityLogService.recordSecurityEvent({
        type: SecurityEventType.AccountLocked,
        userId: targetUserId,
        metadata: {
          status: updated.accountStatus,
          lockedUntil: updated.security?.lockedUntil ?? null,
          lockedBy: actorObjectId.toString(),
        },
        context,
      }),
    ]);

    return this.toAdminUserResponse(updated, true);
  }

  async adminUnlockUser(
    actorId: string,
    userId: string,
    dto: UnlockUserDto,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId);
    const targetUserId = this.toObjectId(userId);
    const targetUser = await this.usersRepository.findUserById(targetUserId);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.usersRepository.unlockUser(targetUserId);

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    await Promise.all([
      this.securityLogService.recordAdminAudit({
        actorId: actorObjectId,
        targetUserId,
        action: AdminAuditAction.UserUnlocked,
        before: this.toUserAuditState(targetUser),
        after: this.toUserAuditState(updated),
        reason: dto.reason,
        context,
      }),
      this.securityLogService.recordSecurityEvent({
        type: SecurityEventType.AccountUnlocked,
        userId: targetUserId,
        metadata: {
          unlockedBy: actorObjectId.toString(),
          reason: dto.reason,
        },
        context,
      }),
    ]);

    return this.toAdminUserResponse(updated, true);
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

  async updatePreferences(
    userId: string,
    preferences: any,
    roles: string[] = [],
  ): Promise<Record<string, unknown>> {
    const userObjectId = this.toObjectId(userId);
    await this.usersRepository.updatePreferences(userObjectId, preferences);
    return this.getMe(userId, roles);
  }

  async toggleFavorite(
    userId: string,
    targetType: string,
    targetId: string,
    roles: string[] = [],
  ): Promise<Record<string, unknown>> {
    const userObjectId = this.toObjectId(userId);
    if (!Types.ObjectId.isValid(targetId)) {
      throw new BadRequestException('Invalid target id');
    }
    const targetObjectId = new Types.ObjectId(targetId);
    await this.usersRepository.toggleFavorite(userObjectId, targetType, targetObjectId);
    return this.getMe(userId, roles);
  }

  private normalizeRoles(roles: string[]): string[] {
    const normalizedRoles = [...new Set(roles.map((role) => role.toUpperCase()))];

    if (normalizedRoles.length === 0) {
      throw new BadRequestException('At least one role is required');
    }

    const invalidRole = normalizedRoles.find(
      (role) => !assignableRoles.includes(role),
    );
    if (invalidRole) {
      throw new BadRequestException(`Unsupported role: ${invalidRole}`);
    }

    return normalizedRoles;
  }

  private toAdminUserResponse(
    user: UserDocument,
    includeDetail = false,
  ): Record<string, unknown> {
    const base = {
      id: user._id.toString(),
      email: user.auth.email,
      phone: user.auth.phone ?? null,
      fullName: user.profile.fullName,
      avatarUrl: user.profile.avatarUrl ?? null,
      roles: user.roles,
      defaultRole: user.defaultRole,
      status: user.accountStatus,
      emailVerified: user.auth.emailVerified,
      phoneVerified: user.auth.phoneVerified,
      provider: user.provider ?? null,
      lockedUntil: user.security?.lockedUntil ?? null,
      lockedAt: user.security?.lockedAt ?? null,
      lockedBy: user.security?.lockedBy?.toString?.() ?? null,
      lockedReason: user.security?.lockedReason ?? null,
      lastLoginAt: user.security?.lastLoginAt ?? null,
      createdAt: user.get('createdAt'),
      updatedAt: user.get('updatedAt'),
    };

    if (!includeDetail) {
      return base;
    }

    return {
      ...base,
      gender: user.profile.gender ?? null,
      dateOfBirth: user.profile.dateOfBirth ?? null,
      authProviders: user.auth.authProviders.map((provider) => ({
        provider: provider.provider,
        providerUserId: provider.providerUserId ?? null,
      })),
      membershipLevel: user.loyalty?.membershipLevel ?? null,
      pointsBalance: user.loyalty?.pointsBalance ?? 0,
    };
  }

  private toUserAuditState(user: UserDocument): Record<string, unknown> {
    return {
      id: user._id.toString(),
      roles: user.roles,
      defaultRole: user.defaultRole,
      accountStatus: user.accountStatus,
      security: {
        lockedUntil: user.security?.lockedUntil ?? null,
        lockedAt: user.security?.lockedAt ?? null,
        lockedBy: user.security?.lockedBy?.toString?.() ?? null,
        lockedReason: user.security?.lockedReason ?? null,
      },
    };
  }

  private hasValidImageSignature(file: Express.Multer.File): boolean {
    if (!file.path) {
      return false;
    }

    const header = readFileSync(file.path).subarray(0, 12);

    if (file.mimetype === 'image/jpeg') {
      return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    }

    if (file.mimetype === 'image/png') {
      return (
        header[0] === 0x89 &&
        header[1] === 0x50 &&
        header[2] === 0x4e &&
        header[3] === 0x47
      );
    }

    if (file.mimetype === 'image/webp') {
      return (
        header.toString('ascii', 0, 4) === 'RIFF' &&
        header.toString('ascii', 8, 12) === 'WEBP'
      );
    }

    return false;
  }

  private removeUploadedFile(path?: string): void {
    if (path && existsSync(path)) {
      unlinkSync(path);
    }
  }
}
