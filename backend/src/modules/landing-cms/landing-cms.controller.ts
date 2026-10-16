import { Controller, Get, Header } from '@nestjs/common';
import { LandingCmsService } from './landing-cms.service';

@Controller('landing')
export class LandingCmsController {
  constructor(private readonly landingCmsService: LandingCmsService) {}

  @Get('banners/public')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
  async getPublicBanners() {
    return this.landingCmsService.getPublicBanners();
  }

  @Get('locations/public')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
  async getPublicLocations() {
    return this.landingCmsService.getPublicLocations();
  }
}
