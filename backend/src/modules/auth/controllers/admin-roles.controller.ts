import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UpdateRolePermissionsDto } from '../dto/admin-roles.dto';
import { RolesService } from '../services/roles.service';

interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
export class AdminRolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  @Permissions('role:read')
  listRoles() {
    return this.rolesService.listRoles();
  }

  @Get('permissions')
  @Permissions('permission:read')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Patch('roles/:code/permissions')
  @Permissions('role:manage', 'permission:manage')
  updateRolePermissions(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
    @Body() dto: UpdateRolePermissionsDto,
    @Req() request: RequestMeta,
  ) {
    return this.rolesService.updateRolePermissions(
      user.sub,
      code,
      dto.permissions,
      dto.reason,
      this.context(request),
    );
  }

  private context(request: RequestMeta): {
    ipAddress?: string;
    userAgent?: string;
  } {
    const userAgent = request.headers['user-agent'];

    return {
      ipAddress: request.ip,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }
}
