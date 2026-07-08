import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { AdminReviewDecisionDto } from '../dto/provider-verification.dto';
import { ProviderVerificationService } from '../services/provider-verification.service';

interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('admin/providers')
@UseGuards(JwtAuthGuard)
export class AdminProvidersController {
  constructor(
    private readonly providerVerificationService: ProviderVerificationService,
  ) {}

  @Patch(':id/suspend')
  suspend(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminReviewDecisionDto,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.adminSuspendProvider(
      user,
      id,
      dto,
      this.meta(request),
    );
  }

  @Patch(':id/unsuspend')
  unsuspend(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminReviewDecisionDto,
    @Req() request: RequestMeta,
  ) {
    return this.providerVerificationService.adminUnsuspendProvider(
      user,
      id,
      dto,
      this.meta(request),
    );
  }

  private meta(request: RequestMeta) {
    return {
      ipAddress: request.ip ?? null,
      userAgent: this.userAgent(request) ?? null,
    };
  }

  private userAgent(request: RequestMeta): string | undefined {
    const value = request.headers['user-agent'];
    return Array.isArray(value) ? value[0] : value;
  }
}
