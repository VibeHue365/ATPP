import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  LandingBanner,
  LandingBannerSchema,
} from './schemas/landing-banner.schema';
import {
  FeaturedLocation,
  FeaturedLocationSchema,
} from './schemas/featured-location.schema';
import { LandingCmsService } from './landing-cms.service';
import { LandingCmsController } from './landing-cms.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LandingBanner.name, schema: LandingBannerSchema },
      { name: FeaturedLocation.name, schema: FeaturedLocationSchema },
    ]),
  ],
  controllers: [LandingCmsController],
  providers: [LandingCmsService],
  exports: [LandingCmsService],
})
export class LandingCmsModule {}
