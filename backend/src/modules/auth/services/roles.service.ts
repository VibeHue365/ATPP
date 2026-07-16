import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdminAuditAction } from '../schemas/admin-audit-log.schema';
import { Permission, PermissionStatus } from '../schemas/permission.schema';
import { Role, RoleStatus } from '../schemas/role.schema';
import { UsersRepository } from '../../users/repositories/users.repository';
import {
  SecurityLogService,
  SecurityRequestContext,
} from './security-log.service';

const permissionSeeds = [
  ['profile:read', 'Read Profile', 'USER', 'Read personal profile'],
  ['profile:update', 'Update Profile', 'USER', 'Update personal profile'],
  ['avatar:update', 'Update Avatar', 'USER', 'Update avatar'],
  ['auth:login', 'Login', 'AUTH', 'Login to system'],
  ['auth:logout', 'Logout', 'AUTH', 'Logout from system'],
  ['user:read', 'Read Users', 'USER', 'Read user accounts'],
  ['user:manage', 'Manage Users', 'USER', 'Manage users'],
  ['role:read', 'Read Roles', 'AUTH', 'Read roles'],
  ['role:manage', 'Manage Roles', 'AUTH', 'Manage roles'],
  ['permission:read', 'Read Permissions', 'AUTH', 'Read permissions'],
  ['permission:manage', 'Manage Permissions', 'AUTH', 'Manage permissions'],
  ['category:read', 'Read Categories', 'CATEGORY', 'Read service categories'],
  [
    'category:manage',
    'Manage Categories',
    'CATEGORY',
    'Manage service categories',
  ],
  ['system:read', 'Read System Policies', 'SYSTEM', 'Read system policies'],
  [
    'system:manage',
    'Manage System Policies',
    'SYSTEM',
    'Manage system policies',
  ],
  [
    'settlement:read',
    'Read Settlements',
    'SETTLEMENT',
    'Read provider settlements',
  ],
  [
    'settlement:manage',
    'Manage Settlements',
    'SETTLEMENT',
    'Manage provider settlements',
  ],
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
  ['dashboard:read', 'Read Admin Dashboard', 'ADMIN', 'Read admin statistics'],
  [
    'provider:read',
    'Read Providers',
    'PROVIDER',
    'Read provider accounts and verifications',
  ],
  [
    'provider:manage',
    'Manage Providers',
    'PROVIDER',
    'Approve, suspend, and manage providers',
  ],
  ['refund:read', 'Read Refunds', 'REFUND', 'Read refund requests'],
  ['refund:manage', 'Manage Refunds', 'REFUND', 'Approve and process refunds'],
  ['dispute:read', 'Read Disputes', 'DISPUTE', 'Read dispute cases'],
  ['dispute:manage', 'Manage Disputes', 'DISPUTE', 'Resolve dispute cases'],
  [
    'moderation:read',
    'Read Moderation Queue',
    'MODERATION',
    'Read content moderation queue',
  ],
  [
    'moderation:manage',
    'Manage Moderation',
    'MODERATION',
    'Approve, reject, or hide moderated content',
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
  [
    'smart-tag:generate_own',
    'Generate Own Smart Tags',
    'SMART_TAG',
    'Generate smart tag suggestions for own content',
  ],
  [
    'smart-tag:read_own',
    'Read Own Smart Tags',
    'SMART_TAG',
    'Read smart tag suggestions for own content',
  ],
  [
    'smart-tag:decide_own',
    'Decide Own Smart Tags',
    'SMART_TAG',
    'Activate, reject, or remove smart tags for own content',
  ],
  ['smart-tag:read', 'Read Smart Tags', 'SMART_TAG', 'Read all smart tags'],
  [
    'smart-tag:manage',
    'Manage Smart Tags',
    'SMART_TAG',
    'Override smart tag decisions and regenerate content tags',
  ],
  [
    'smart-tag:taxonomy_manage',
    'Manage Smart Tag Taxonomy',
    'SMART_TAG',
    'Manage smart tag definitions and taxonomy revisions',
  ],
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
  'smart-tag:generate_own',
  'smart-tag:read_own',
  'smart-tag:decide_own',
];

const protectedAdminPermissions = [
  'user:read',
  'user:manage',
  'role:read',
  'role:manage',
  'permission:read',
  'permission:manage',
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
    private readonly securityLogService: SecurityLogService,
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

  async listRoles(): Promise<Record<string, unknown>> {
    const roles = await this.roleModel.find({}).sort({ code: 1 }).lean();

    return {
      items: roles.map((role) => ({
        code: role.code,
        name: role.name,
        description: role.description ?? null,
        permissions: role.permissions,
        status: role.status,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      })),
    };
  }

  async listPermissions(): Promise<Record<string, unknown>> {
    const permissions = await this.permissionModel
      .find({})
      .sort({ module: 1, code: 1 })
      .lean();

    return {
      items: permissions.map((permission) => ({
        code: permission.code,
        name: permission.name,
        module: permission.module,
        description: permission.description ?? null,
        status: permission.status,
        createdAt: permission.createdAt,
        updatedAt: permission.updatedAt,
      })),
    };
  }

  async updateRolePermissions(
    actorId: string,
    code: string,
    permissions: string[],
    reason: string,
    context?: SecurityRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorObjectId = this.toObjectId(actorId);
    const normalizedCode = code.toUpperCase();
    const uniquePermissions = [...new Set(permissions)];
    const role = await this.roleModel.findOne({ code: normalizedCode });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (normalizedCode === 'ADMIN') {
      const missingProtectedPermission = protectedAdminPermissions.find(
        (permission) => !uniquePermissions.includes(permission),
      );
      if (missingProtectedPermission) {
        throw new BadRequestException(
          `ADMIN role must keep permission: ${missingProtectedPermission}`,
        );
      }
    }

    if (uniquePermissions.length > 0) {
      const activePermissions = await this.permissionModel
        .find({
          code: { $in: uniquePermissions },
          status: PermissionStatus.Active,
        })
        .lean();
      const activePermissionCodes = new Set(
        activePermissions.map((permission) => permission.code),
      );
      const invalidPermission = uniquePermissions.find(
        (permission) => !activePermissionCodes.has(permission),
      );

      if (invalidPermission) {
        throw new BadRequestException(
          `Unsupported permission: ${invalidPermission}`,
        );
      }
    }

    const before = this.toRoleAuditState(role);
    role.permissions = uniquePermissions;
    await role.save();
    await this.securityLogService.recordAdminAudit({
      actorId: actorObjectId,
      targetRoleCode: role.code,
      action: AdminAuditAction.RolePermissionUpdated,
      before,
      after: this.toRoleAuditState(role),
      reason,
      context,
    });

    return {
      code: role.code,
      name: role.name,
      description: role.description ?? null,
      permissions: role.permissions,
      status: role.status,
      createdAt: role.get('createdAt'),
      updatedAt: role.get('updatedAt'),
    };
  }

  private toObjectId(userId: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid actor id');
    }

    return new Types.ObjectId(userId);
  }

  private toRoleAuditState(role: Role): Record<string, unknown> {
    return {
      code: role.code,
      name: role.name,
      permissions: role.permissions,
      status: role.status,
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
            status: RoleStatus.Active,
          },
          $setOnInsert: { permissions },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );

      if (code === 'ADMIN' || code === 'PROVIDER') {
        await this.roleModel.updateOne(
          { code },
          { $addToSet: { permissions: { $each: [...permissions] } } },
        );
      }
    }
  }
}
