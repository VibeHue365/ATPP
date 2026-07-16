import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { SmartTagEntityType } from '../constants/smart-tag.constants';
import { SmartTagDecisionDto } from '../dto/smart-tag.dto';
import { SmartTaggingService } from '../services/smart-tagging.service';

@Controller('admin/smart-tags')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
export class AdminSmartTagsController {
  constructor(private readonly smartTaggingService: SmartTaggingService) {}

  @Get(':entityType/:entityId')
  @Permissions('smart-tag:read')
  list(
    @Param('entityType') entityType: SmartTagEntityType,
    @Param('entityId') entityId: string,
  ) {
    return this.smartTaggingService.getAdminEntityTags(entityType, entityId);
  }

  @Post(':entityType/:entityId/:tagCode/decision')
  @Permissions('smart-tag:manage')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('entityType') entityType: SmartTagEntityType,
    @Param('entityId') entityId: string,
    @Param('tagCode') tagCode: string,
    @Body() dto: SmartTagDecisionDto,
  ) {
    if (!Object.values(SmartTagEntityType).includes(entityType)) {
      throw new BadRequestException('Unsupported smart tag entity type');
    }
    return this.smartTaggingService.decideAdminTag(
      user.sub,
      entityType,
      entityId,
      tagCode,
      dto,
    );
  }
}
