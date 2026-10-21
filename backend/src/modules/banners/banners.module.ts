import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Banner, BannerSchema } from './schemas/banner.schema';
import { BannersService } from './services/banners.service';
import { BannersController } from './controllers/banners.controller';
import { AdminBannersController } from './controllers/admin-banners.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Banner.name, schema: BannerSchema }]),
    StorageModule,
  ],
  controllers: [BannersController, AdminBannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
