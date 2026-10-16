import { Controller, Get, Header, Param } from '@nestjs/common';
import { BannersService } from '../services/banners.service';
import { BannerPlacement } from '../schemas/banner.schema';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get('placement/:placement')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
  async getByPlacement(@Param('placement') placement: string) {
    const normalized = placement.toUpperCase() as BannerPlacement;
    return this.bannersService.getBannerByPlacement(normalized);
  }

  @Get('public')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
  async getAllPublic() {
    return this.bannersService.getAllPublicBanners();
  }
}
