import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import {
  SmartTagDecisionDto,
  SmartTagSelectionDto,
} from '../dto/smart-tag.dto';
import { SmartTagEntityType } from '../constants/smart-tag.constants';
import { SmartTagTaxonomyService } from '../services/smart-tag-taxonomy.service';
import { SmartTaggingService } from '../services/smart-tagging.service';

@Controller('provider/portfolio-items/:itemId/smart-tags')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProviderPortfolioSmartTagsController {
  constructor(
    private readonly smartTaggingService: SmartTaggingService,
    private readonly taxonomyService: SmartTagTaxonomyService,
  ) {}

  @Get('taxonomy')
  @Permissions('smart-tag:read_own')
  taxonomy() {
    return this.taxonomyService.listActiveDefinitions(
      SmartTagEntityType.Portfolio,
    );
  }

  @Get()
  @Permissions('smart-tag:read_own')
  list(@CurrentUser() user: AuthUser, @Param('itemId') itemId: string) {
    return this.smartTaggingService.getOwnedPortfolioTags(user.sub, itemId);
  }

  @Post('generate')
  @Permissions('smart-tag:generate_own')
  generate(@CurrentUser() user: AuthUser, @Param('itemId') itemId: string) {
    return this.smartTaggingService.generateForOwnedPortfolio(user.sub, itemId);
  }

  @Post('selection')
  @Permissions('smart-tag:decide_own')
  select(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Body() dto: SmartTagSelectionDto,
  ) {
    return this.smartTaggingService.selectOwnedPortfolioTags(
      user.sub,
      itemId,
      dto,
    );
  }

  @Post(':tagCode/decision')
  @Permissions('smart-tag:decide_own')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Param('tagCode') tagCode: string,
    @Body() dto: SmartTagDecisionDto,
  ) {
    return this.smartTaggingService.decideOwnedPortfolioTag(
      user.sub,
      itemId,
      tagCode,
      dto,
    );
  }
}
