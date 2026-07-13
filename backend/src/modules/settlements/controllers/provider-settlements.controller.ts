import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { QueryProviderSettlementsDto } from '../dto/settlement.dto';
import { SettlementAccessPolicy } from '../policies/settlement-access.policy';
import { SettlementQueryService } from '../services/settlement-query.service';

@Controller('provider/settlements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PROVIDER')
export class ProviderSettlementsController {
  constructor(
    private readonly settlementQueryService: SettlementQueryService,
    private readonly settlementAccessPolicy: SettlementAccessPolicy,
  ) {}

  @Get()
  async findMine(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryProviderSettlementsDto,
  ) {
    const provider =
      await this.settlementAccessPolicy.resolveProviderForCurrentUser(user.sub);
    return this.settlementQueryService.findProviderSettlements(
      provider._id,
      query,
    );
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const provider =
      await this.settlementAccessPolicy.resolveProviderForCurrentUser(user.sub);
    const settlement = await this.settlementQueryService.findById(id);
    this.settlementAccessPolicy.assertProviderCanView(
      settlement.providerId,
      provider._id,
    );
    return settlement;
  }
}
