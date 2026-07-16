import { Controller, Post, Get, Delete, Body, Query, UseGuards } from '@nestjs/common';
import { DiscountCampaignService } from '../services/discount-campaign.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { CreateCampaignDto } from '../dto/create-campaign.dto';

@Controller(['campaigns', 'api/campaigns'])
export class DiscountCampaignController {
  constructor(private readonly campaignService: DiscountCampaignService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignService.createCampaign(user.sub, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async getMine(@CurrentUser() user: AuthUser) {
    return this.campaignService.getActiveCampaignForProviderUser(user.sub);
  }

  @Delete('active')
  @UseGuards(JwtAuthGuard)
  async deactivate(@CurrentUser() user: AuthUser) {
    await this.campaignService.deactivateActiveCampaign(user.sub);
    return { message: 'Khuyến mãi đã được tắt thành công.' };
  }

  @Get('banners')
  async getBanner(@Query('providerId') providerId: string) {
    const campaign = await this.campaignService.getActiveCampaign(providerId);
    if (!campaign) return null;
    return {
      occasion: campaign.occasion,
      discountPercent: campaign.discountPercent,
      endDate: campaign.endDate,
    };
  }
}
