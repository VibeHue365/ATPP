import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UserStatus } from '../schemas/user.schema';
import { AccountLockType, UserRole } from '../dto/admin-users.dto';
import { UsersService } from './users.service';

describe('UsersService admin safeguards', () => {
  it('does not allow removing the last active ADMIN role', async () => {
    const actorId = new Types.ObjectId();
    const targetUserId = new Types.ObjectId();
    const usersRepository = {
      findUserById: jest.fn().mockResolvedValue({
        _id: targetUserId,
        roles: [UserRole.Admin],
        accountStatus: UserStatus.Active,
        security: {},
      }),
      countActiveAdmins: jest.fn().mockResolvedValue(1),
      findActiveRoleCodes: jest.fn().mockResolvedValue([UserRole.Customer]),
    };
    const service = new UsersService(
      usersRepository as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.adminUpdateRoles(actorId.toString(), targetUserId.toString(), {
        roles: [UserRole.Customer],
        reason: 'least privilege',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not allow an admin to lock their own account', async () => {
    const actorId = new Types.ObjectId();
    const service = new UsersService({} as never, {} as never, {} as never);

    await expect(
      service.adminLockUser(actorId.toString(), actorId.toString(), {
        type: AccountLockType.Banned,
        reason: 'self lock',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects assigning a role that is missing or inactive', async () => {
    const actorId = new Types.ObjectId();
    const targetUserId = new Types.ObjectId();
    const usersRepository = {
      findActiveRoleCodes: jest.fn().mockResolvedValue([]),
    };
    const service = new UsersService(
      usersRepository as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.adminUpdateRoles(actorId.toString(), targetUserId.toString(), {
        roles: [UserRole.Provider],
        reason: 'grant provider access',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('revokes active sessions when an admin locks a user', async () => {
    const actorId = new Types.ObjectId();
    const targetUserId = new Types.ObjectId();
    const baseUser = {
      _id: targetUserId,
      auth: {
        email: 'target@example.com',
        phone: null,
        emailVerified: true,
        phoneVerified: false,
        authProviders: [],
      },
      profile: { fullName: 'Target User', avatarUrl: null },
      roles: [UserRole.Customer],
      defaultRole: UserRole.Customer,
      accountStatus: UserStatus.Active,
      provider: null,
      security: {},
      loyalty: {},
      get: jest.fn().mockReturnValue(new Date()),
    };
    const lockedUser = {
      ...baseUser,
      accountStatus: UserStatus.Banned,
      security: {
        lockedAt: new Date(),
        lockedBy: actorId,
        lockedReason: 'policy violation',
      },
    };
    const usersRepository = {
      findUserById: jest.fn().mockResolvedValue(baseUser),
      lockUser: jest.fn().mockResolvedValue(lockedUser),
      revokeActiveSessions: jest.fn().mockResolvedValue(2),
    };
    const securityLogService = {
      recordAdminAudit: jest.fn().mockResolvedValue(undefined),
      recordSecurityEvent: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UsersService(
      usersRepository as never,
      {} as never,
      securityLogService as never,
    );

    await service.adminLockUser(actorId.toString(), targetUserId.toString(), {
      type: AccountLockType.Banned,
      reason: 'policy violation',
    });

    expect(usersRepository.revokeActiveSessions).toHaveBeenCalledWith(
      targetUserId,
      'ADMIN_LOCK',
    );
    expect(securityLogService.recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId,
        targetUserId,
        before: expect.any(Object),
        after: expect.any(Object),
      }),
    );
  });

  it('does not create an unlock audit for an active user', async () => {
    const actorId = new Types.ObjectId();
    const targetUserId = new Types.ObjectId();
    const usersRepository = {
      findUserById: jest.fn().mockResolvedValue({
        _id: targetUserId,
        accountStatus: UserStatus.Active,
      }),
    };
    const service = new UsersService(
      usersRepository as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.adminUnlockUser(actorId.toString(), targetUserId.toString(), {
        reason: 'not needed',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
