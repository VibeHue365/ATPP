import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RolesService } from './roles.service';

describe('RolesService admin safeguards', () => {
  it('does not allow removing a protected permission from ADMIN', async () => {
    const roleModel = {
      findOne: jest.fn().mockResolvedValue({
        code: 'ADMIN',
        permissions: [],
      }),
    };
    const service = new RolesService(
      {} as never,
      roleModel as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.updateRolePermissions(
        new Types.ObjectId().toString(),
        'ADMIN',
        ['user:read'],
        'remove permissions',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
