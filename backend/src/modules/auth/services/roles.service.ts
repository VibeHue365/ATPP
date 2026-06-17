import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Permission, PermissionStatus } from '../schemas/permission.schema';
import { Role, RoleStatus } from '../schemas/role.schema';
import { UsersRepository } from '../../users/repositories/users.repository';

const permissionSeeds = [
  ['profile:read', 'Read Profile', 'USER', 'Read personal profile'],
  ['profile:update', 'Update Profile', 'USER', 'Update personal profile'],
  ['avatar:update', 'Update Avatar', 'USER', 'Update avatar'],
  ['auth:login', 'Login', 'AUTH', 'Login to system'],
  ['auth:logout', 'Logout', 'AUTH', 'Logout from system'],
  ['user:manage', 'Manage Users', 'USER', 'Manage users'],
  [
    'provider:update_own',
    'Update Own Provider',
    'PROVIDER',
    'Update own provider profile',
  ],
  [
    'product:manage_own',
    'Manage Own Products',
    'PRODUCT',
    'Manage own products',
  ],
  [
    'booking:create',
    'Create Booking',
    'BOOKING',
    'Allow customer to create booking',
  ],
  [
    'booking:view_provider',
    'View Provider Bookings',
    'BOOKING',
    'View provider bookings',
  ],
  [
    'booking:update_provider',
    'Update Provider Bookings',
    'BOOKING',
    'Update provider bookings',
  ],
  [
    'wallet:view_provider',
    'View Provider Wallet',
    'WALLET',
    'View provider wallet',
  ],
  ['review:reply', 'Reply Review', 'REVIEW', 'Reply to reviews'],
] as const;

const customerPermissions = [
  'profile:read',
  'profile:update',
  'avatar:update',
  'auth:login',
  'auth:logout',
  'booking:create',
];

const providerPermissions = [
  'profile:read',
  'profile:update',
  'avatar:update',
  'auth:login',
  'auth:logout',
  'provider:update_own',
  'product:manage_own',
  'booking:view_provider',
  'booking:update_provider',
  'wallet:view_provider',
  'review:reply',
];

const roleSeeds = [
  ['CUSTOMER', 'Customer', 'Customer account', customerPermissions],
  ['PROVIDER', 'Provider', 'Provider account', providerPermissions],
  [
    'ADMIN',
    'Admin',
    'System administrator',
    permissionSeeds.map(([code]) => code),
  ],
] as const;

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    private readonly usersRepository: UsersRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedRolesAndPermissions();
  }

  async assignDefaultCustomerRole(userId: Types.ObjectId): Promise<void> {
    await this.usersRepository.addRole(userId, 'CUSTOMER');
  }

  async getRoleCodesAndPermissions(
    userId: Types.ObjectId,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    const user = await this.usersRepository.findUserById(userId);
    const roles = user?.roles ?? [];

    if (roles.length === 0) {
      return { roles: [], permissions: [] };
    }

    const roleDocs = await this.roleModel
      .find({ code: { $in: roles }, status: RoleStatus.Active })
      .lean();
    const permissions = new Set<string>();

    roleDocs.forEach((role) => {
      role.permissions.forEach((permission) => permissions.add(permission));
    });

    return {
      roles: roleDocs.map((role) => role.code),
      permissions: [...permissions],
    };
  }

  private async seedRolesAndPermissions(): Promise<void> {
    for (const [code, name, module, description] of permissionSeeds) {
      await this.permissionModel.findOneAndUpdate(
        { code },
        {
          $set: {
            code,
            name,
            module,
            description,
            status: PermissionStatus.Active,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
    }

    for (const [code, name, description, permissions] of roleSeeds) {
      await this.roleModel.findOneAndUpdate(
        { code },
        {
          $set: {
            code,
            name,
            description,
            permissions,
            status: RoleStatus.Active,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
    }
  }
}
