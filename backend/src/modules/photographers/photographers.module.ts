import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { ProvidersModule } from '../providers/providers.module';
import { SmartTaggingModule } from '../smart-tagging/smart-tagging.module';
import { PhotographersController } from './controllers/photographers.controller';
import { ProviderPhotographyPackagesController } from './controllers/provider-photography-packages.controller';
import { PhotographersService } from './services/photographers.service';
import { PhotographyPackagesService } from './services/photography-packages.service';
import { PhotographerMonthlyAvailabilityService } from './services/photographer-monthly-availability.service';
import { BookingsModule } from '../bookings/bookings.module';
import { CategoriesModule } from '../categories/categories.module';

/**
 * Owns the photography domain: public discovery, service packages and
 * photography portfolio presentation. Provider remains the partner profile
 * and verification domain.
 */
@Module({
  imports: [ProvidersModule, ProductsModule, SmartTaggingModule, BookingsModule, CategoriesModule],
  controllers: [
    PhotographersController,
    ProviderPhotographyPackagesController,
  ],
  providers: [
    PhotographersService,
    PhotographyPackagesService,
    PhotographerMonthlyAvailabilityService,
  ],
  exports: [PhotographersService, PhotographyPackagesService],
})
export class PhotographersModule {}
