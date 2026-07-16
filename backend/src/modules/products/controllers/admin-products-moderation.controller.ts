import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
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
  ModerateProductDto,
  QueryModerationProductsDto,
} from '../dto/product-moderation.dto';
import { ProductModerationStatus } from '../schemas/product.schema';
import { ProductsService } from '../services/products.service';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
export class AdminProductsModerationController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('moderation')
  @Permissions('moderation:read')
  findQueue(@Query() query: QueryModerationProductsDto) {
    return this.productsService.getModerationQueue(
      query.status ?? ProductModerationStatus.PendingReview,
    );
  }

  @Patch(':id/moderation')
  @Permissions('moderation:manage')
  moderate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ModerateProductDto,
  ) {
    return this.productsService.moderateProduct(user.sub, id, dto);
  }
}
