import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { PolicyCode } from '../constants/policy-code.enum';
import {
  ActivatePolicyDto,
  CreateSystemPolicyDto,
  DeactivatePolicyDto,
  QuerySystemPoliciesDto,
  UpdateSystemPolicyDto,
} from '../dto/system-policy.dto';
import { SystemPoliciesService } from '../services/system-policies.service';

interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('admin/system/policies')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
export class AdminSystemPoliciesController {
  constructor(private readonly systemPoliciesService: SystemPoliciesService) {}

  @Get()
  @Permissions('system:read')
  findAll(@Query() query: QuerySystemPoliciesDto) {
    return this.systemPoliciesService.findPolicies(query);
  }

  @Get('code/:code')
  @Permissions('system:read')
  findVersionsByCode(@Param('code') code: string) {
    return this.systemPoliciesService.findVersionsByCode(code);
  }

  @Get(':id')
  @Permissions('system:read')
  findOne(@Param('id') id: string) {
    return this.systemPoliciesService.findById(id);
  }

  @Post()
  @Permissions('system:manage')
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSystemPolicyDto,
    @Req() request: RequestMeta,
  ) {
    return this.systemPoliciesService.createPolicy(
      user.sub,
      dto,
      this.context(request),
    );
  }

  @Patch(':id/activate')
  @Permissions('system:manage')
  activate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ActivatePolicyDto,
    @Req() request: RequestMeta,
  ) {
    return this.systemPoliciesService.activatePolicy(
      user.sub,
      id,
      dto,
      this.context(request),
    );
  }

  @Patch(':id/deactivate')
  @Permissions('system:manage')
  deactivate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DeactivatePolicyDto,
    @Req() request: RequestMeta,
  ) {
    return this.systemPoliciesService.deactivateByAdmin(
      user.sub,
      id,
      dto,
      this.context(request),
    );
  }

  @Patch(':id')
  @Permissions('system:manage')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSystemPolicyDto,
    @Req() request: RequestMeta,
  ) {
    return this.systemPoliciesService.updatePolicy(
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
