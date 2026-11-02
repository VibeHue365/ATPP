import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RateLimitService } from '../../auth/services/rate-limit.service';
import { ProductDraftRequestDto } from '../dto/product-draft.dto';
import { ProductDraftClientService } from '../services/product-draft-client.service';

/** UC-C10: AI suggestion of a product name/description from photos (provider wizard step 1). */
@Controller('provider/products/ai-draft')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProviderProductDraftController {
  constructor(
    private readonly draftClient: ProductDraftClientService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Post()
  @HttpCode(200)
  @Permissions('product:manage_own')
  async draft(@CurrentUser() user: AuthUser, @Body() dto: ProductDraftRequestDto) {
    await this.rateLimitService.assertRateLimit(`product-draft:user:${user.sub}`, 10, 60);
    return this.draftClient.draftFromPhotos(dto.imageUrls);
  }
}
