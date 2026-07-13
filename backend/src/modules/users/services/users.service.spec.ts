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
});
