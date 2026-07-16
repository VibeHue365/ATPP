import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
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
import {
  AdminListUsersQueryDto,
  LockUserDto,
  UnlockUserDto,
  UpdateUserRolesDto,
  UpdateUserStatusDto,
} from '../dto/admin-users.dto';
import { UsersService } from '../services/users.service';

interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('user:read')
  list(@Query() query: AdminListUsersQueryDto) {
    return this.usersService.adminListUsers(query);
  }

  @Get(':id')
  @Permissions('user:read')
  detail(@Param('id') id: string) {
    return this.usersService.adminGetUser(id);
  }

  @Patch(':id/roles')
  @Permissions('user:manage')
  updateRoles(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesDto,
    @Req() request: RequestMeta,
  ) {
    return this.usersService.adminUpdateRoles(
      user.sub,
      id,
      dto,
      this.context(request),
    );
  }

  @Patch(':id/status')
  @Permissions('user:manage')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() request: RequestMeta,
  ) {
    return this.usersService.adminUpdateStatus(
      user.sub,
      id,
      dto,
      this.context(request),
    );
  }

  @Patch(':id/lock')
  @Permissions('user:manage')
  lock(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: LockUserDto,
    @Req() request: RequestMeta,
  ) {
    return this.usersService.adminLockUser(
      user.sub,
      id,
      dto,
      this.context(request),
    );
  }

  @Patch(':id/unlock')
  @Permissions('user:manage')
  unlock(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UnlockUserDto,
    @Req() request: RequestMeta,
  ) {
    return this.usersService.adminUnlockUser(
      user.sub,
      id,
      dto,
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
