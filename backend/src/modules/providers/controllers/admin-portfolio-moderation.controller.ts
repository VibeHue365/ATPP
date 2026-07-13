import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ModeratePortfolioItemDto } from '../dto/portfolio-item.dto';
import { ProductModerationStatus } from '../../products/schemas/product.schema';
import { ProvidersService } from '../services/providers.service';

@Controller('admin/portfolio-items')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
export class AdminPortfolioModerationController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get('moderation')
  @Permissions('moderation:read')
  list(@Query('status') status?: ProductModerationStatus) {
    return this.providersService.listPortfolioModeration(status);
  }

  @Patch(':id/moderation')
  @Permissions('moderation:manage')
  moderate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ModeratePortfolioItemDto) {
    return this.providersService.moderatePortfolioItem(user.sub, id, dto);
  }
}
