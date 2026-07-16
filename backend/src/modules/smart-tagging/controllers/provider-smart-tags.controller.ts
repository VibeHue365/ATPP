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
import { SmartTaggingService } from '../services/smart-tagging.service';
import { SmartTagTaxonomyService } from '../services/smart-tag-taxonomy.service';

@Controller('provider/products/:productId/smart-tags')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProviderSmartTagsController {
  constructor(
    private readonly smartTaggingService: SmartTaggingService,
    private readonly taxonomyService: SmartTagTaxonomyService,
  ) {}

  @Get('taxonomy')
  @Permissions('smart-tag:read_own')
  taxonomy(@Param('productId') _productId: string) {
    return this.taxonomyService.listActiveDefinitions(
      SmartTagEntityType.Product,
    );
  }

  @Get()
  @Permissions('smart-tag:read_own')
  list(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.smartTaggingService.getOwnedProductTags(user.sub, productId);
  }

  @Post('generate')
  @Permissions('smart-tag:generate_own')
  generate(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ) {
    return this.smartTaggingService.generateForOwnedProduct(
      user.sub,
      productId,
    );
  }

  @Post('selection')
  @Permissions('smart-tag:decide_own')
  select(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: SmartTagSelectionDto,
  ) {
    return this.smartTaggingService.selectOwnedProductTags(
      user.sub,
      productId,
      dto,
    );
  }

  @Post(':tagCode/decision')
  @Permissions('smart-tag:decide_own')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Param('tagCode') tagCode: string,
    @Body() dto: SmartTagDecisionDto,
  ) {
    return this.smartTaggingService.decideOwnedProductTag(
      user.sub,
      productId,
      tagCode,
      dto,
    );
  }
}
