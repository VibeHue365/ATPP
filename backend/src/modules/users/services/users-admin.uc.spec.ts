import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { SecurityEventType } from '../../auth/schemas/security-event.schema';
import { AccountLockType, UserRole } from '../dto/admin-users.dto';
import { UserStatus } from '../schemas/user.schema';
import { UsersService } from './users.service';

type Row = Record<string, any>;

function userDoc(overrides: Row = {}): Row {
  return {
    _id: new Types.ObjectId(),
    roles: [UserRole.Customer],
    defaultRole: UserRole.Customer,
    accountStatus: UserStatus.Active,
    auth: { email: 'user@example.com', authProviders: [] },
    profile: { fullName: 'User' },
    security: {},
    get: jest.fn(),
    ...overrides,
  };
}

function createService(target: Row | null, activeAdmins = 2) {
  const usersRepository = {
    findActiveRoleCodes: jest.fn(async (roles: string[]) => roles),
    findUserById: jest.fn().mockResolvedValue(target),
    countActiveAdmins: jest.fn().mockResolvedValue(activeAdmins),
    updateRoles: jest.fn(
      async (_id: Types.ObjectId, roles: string[], defaultRole: string) =>
        userDoc({ ...target, roles, defaultRole }),
    ),
    updateAccountStatus: jest.fn(
      async (_id: Types.ObjectId, status: UserStatus) =>
        userDoc({ ...target, accountStatus: status }),
    ),
    revokeActiveSessions: jest.fn().mockResolvedValue(undefined),
    lockUser: jest.fn(
      async (
        _id: Types.ObjectId,
        status: UserStatus,
        _by: Types.ObjectId,
        _reason: string,
        lockedUntil: Date | null,
      ) =>
        userDoc({
          ...target,
          accountStatus: status,
          security: { lockedUntil },
        }),
    ),
    unlockUser: jest.fn(async () =>
      userDoc({ ...target, accountStatus: UserStatus.Active }),
    ),
  };
  const securityLogService = {
    recordAdminAudit: jest.fn().mockResolvedValue(undefined),
    recordSecurityEvent: jest.fn().mockResolvedValue(undefined),
  };
  const service = new UsersService(
    usersRepository as never,
    {} as never,
    securityLogService as never,
    {} as never,
  );
  return { service, usersRepository, securityLogService };
}

describe('UC-63 Manage Accounts (HuyLDN)', () => {
  const actorId = new Types.ObjectId().toString();

  it('UT-63 UTCID08 rejects an unsupported role code', async () => {
    const target = userDoc();
    const { service, usersRepository } = createService(target);

    await expect(
      service.adminUpdateRoles(actorId, target._id.toString(), {
        roles: ['SUPERUSER'],
        reason: 'test',
      } as any),
    ).rejects.toThrow(new BadRequestException('Unsupported role: SUPERUSER'));
    expect(usersRepository.updateRoles).not.toHaveBeenCalled();
  });

  it('UT-63 UTCID09 requires at least one role', async () => {
    const target = userDoc();
    const { service } = createService(target);

    await expect(
      service.adminUpdateRoles(actorId, target._id.toString(), {
        roles: [],
        reason: 'test',
      } as any),
    ).rejects.toThrow(new BadRequestException('At least one role is required'));
  });

  it('UT-63 UTCID10 prevents an admin from removing their own admin role', async () => {
    const self = userDoc({
      _id: new Types.ObjectId(actorId),
      roles: [UserRole.Admin],
    });
    const { service } = createService(self, 3);

    await expect(
      service.adminUpdateRoles(actorId, actorId, {
        roles: [UserRole.Customer],
        reason: 'test',
      } as any),
    ).rejects.toThrow(
      new ForbiddenException('Cannot remove your own admin role'),
    );
  });

  it('UT-63 UTCID11 normalizes and de-duplicates roles and records an audit', async () => {
    const target = userDoc();
    const { service, usersRepository, securityLogService } =
      createService(target);

    const result = await service.adminUpdateRoles(
      actorId,
      target._id.toString(),
      {
        roles: ['provider', 'PROVIDER', 'customer'],
        reason: 'Approved shop',
      } as any,
    );

    expect(usersRepository.updateRoles).toHaveBeenCalledWith(
      target._id,
      ['PROVIDER', 'CUSTOMER'],
      'PROVIDER',
    );
    expect(result).toMatchObject({
      roles: ['PROVIDER', 'CUSTOMER'],
      defaultRole: 'PROVIDER',
    });
    expect(securityLogService.recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Approved shop' }),
    );
  });

  it('UT-63 UTCID12 does not accept the DELETED status in a status update', async () => {
    const target = userDoc();
    const { service, usersRepository } = createService(target);

    await expect(
      service.adminUpdateStatus(actorId, target._id.toString(), {
        status: UserStatus.Deleted,
        reason: 'x',
      } as any),
    ).rejects.toThrow(
      new BadRequestException('Deleted status is not supported here'),
    );
    expect(usersRepository.findUserById).not.toHaveBeenCalled();
  });

  it('UT-63 UTCID13 prevents an admin from disabling their own account', async () => {
    const { service } = createService(userDoc());

    await expect(
      service.adminUpdateStatus(actorId, actorId, {
        status: UserStatus.Suspended,
        reason: 'x',
      } as any),
    ).rejects.toThrow(
      new ForbiddenException('Cannot disable your own account'),
    );
  });

  it('UT-63 UTCID14 keeps at least one active administrator', async () => {
    const lastAdmin = userDoc({ roles: [UserRole.Admin] });
    const { service } = createService(lastAdmin, 1);

    await expect(
      service.adminUpdateStatus(actorId, lastAdmin._id.toString(), {
        status: UserStatus.Suspended,
        reason: 'x',
      } as any),
    ).rejects.toThrow(
      new BadRequestException('Cannot disable the last admin account'),
    );
  });

  it('UT-63 UTCID15 suspends an account, revokes its sessions and audits the change', async () => {
    const target = userDoc();
    const { service, usersRepository, securityLogService } =
      createService(target);

    const result = await service.adminUpdateStatus(
      actorId,
      target._id.toString(),
      { status: UserStatus.Suspended, reason: 'Spam' } as any,
    );

    expect(result.status).toBe(UserStatus.Suspended);
    expect(usersRepository.revokeActiveSessions).toHaveBeenCalledWith(
      target._id,
      'ADMIN_STATUS_CHANGED',
    );
    expect(securityLogService.recordAdminAudit).toHaveBeenCalledTimes(1);
  });

  it('UT-63 UTCID16 rejects a temporary lock that ends in the past', async () => {
    const target = userDoc();
    const { service, usersRepository } = createService(target);

    await expect(
      service.adminLockUser(actorId, target._id.toString(), {
        type: AccountLockType.Suspended,
        lockedUntil: new Date(Date.now() - 60_000).toISOString(),
        reason: 'x',
      } as any),
    ).rejects.toThrow(
      new BadRequestException('lockedUntil must be in the future'),
    );
    expect(usersRepository.lockUser).not.toHaveBeenCalled();
  });

  it('UT-63 UTCID17 bans an account permanently and records a security event', async () => {
    const target = userDoc();
    const { service, usersRepository, securityLogService } =
      createService(target);

    const result = await service.adminLockUser(actorId, target._id.toString(), {
      type: AccountLockType.Banned,
      reason: 'Fraud',
    } as any);

    expect(usersRepository.lockUser).toHaveBeenCalledWith(
      target._id,
      UserStatus.Banned,
      expect.any(Types.ObjectId),
      'Fraud',
      null,
    );
    expect(result.status).toBe(UserStatus.Banned);
    expect(usersRepository.revokeActiveSessions).toHaveBeenCalledWith(
      target._id,
      'ADMIN_LOCK',
    );
    expect(securityLogService.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: SecurityEventType.AccountLocked }),
    );
  });

  it('UT-63 UTCID18 rejects unlocking an account that is not locked', async () => {
    const target = userDoc();
    const { service, usersRepository } = createService(target);

    await expect(
      service.adminUnlockUser(actorId, target._id.toString(), {
        reason: 'x',
      } as any),
    ).rejects.toThrow(new BadRequestException('User account is not locked'));
    expect(usersRepository.unlockUser).not.toHaveBeenCalled();
  });

  it('UT-63 UTCID19 unlocks a banned account and records the unlock event', async () => {
    const target = userDoc({ accountStatus: UserStatus.Banned });
    const { service, securityLogService } = createService(target);

    const result = await service.adminUnlockUser(
      actorId,
      target._id.toString(),
      { reason: 'Appeal accepted' } as any,
    );

    expect(result.status).toBe(UserStatus.Active);
    expect(securityLogService.recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: SecurityEventType.AccountUnlocked }),
    );
  });

  it('UT-63 UTCID20 returns not found for a missing target account', async () => {
    const { service } = createService(null);

    await expect(
      service.adminLockUser(actorId, new Types.ObjectId().toString(), {
        type: AccountLockType.Banned,
        reason: 'x',
      } as any),
    ).rejects.toThrow(new NotFoundException('User not found'));
  });

  it('UT-63 UTCID21 rejects a malformed user id', async () => {
    const { service } = createService(userDoc());

    await expect(
      service.adminUnlockUser(actorId, 'user-1', { reason: 'x' } as any),
    ).rejects.toThrow(new BadRequestException('Invalid user id'));
  });
});
