import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MinioPrivateStorageService } from './services/minio-private-storage.service';
import { PrivateStorageService } from './services/private-storage.service';
import { PublicMediaService } from './services/public-media.service';
import { StorageHealthController } from './controllers/storage-health.controller';
import { PublicMediaCleanupService } from './services/public-media-cleanup.service';

@Module({
  imports: [ConfigModule],
  controllers: [StorageHealthController],
  providers: [
    PublicMediaService,
    PublicMediaCleanupService,
    {
      provide: PrivateStorageService,
      useClass: MinioPrivateStorageService,
    },
  ],
  exports: [PrivateStorageService, PublicMediaService],
})
export class StorageModule {}
