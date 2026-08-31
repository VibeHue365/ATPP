import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MinioPrivateStorageService } from './services/minio-private-storage.service';
import { LocalPrivateStorageService } from './services/local-private-storage.service';
import { MongoGridFSPrivateStorageService } from './services/mongo-gridfs-private-storage.service';
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
    MinioPrivateStorageService,
    LocalPrivateStorageService,
    MongoGridFSPrivateStorageService,
    {
      provide: PrivateStorageService,
      useFactory: (
        config: ConfigService,
        minio: MinioPrivateStorageService,
        local: LocalPrivateStorageService,
        gridfs: MongoGridFSPrivateStorageService,
      ) => {
        const provider = config.get<string>('PRIVATE_STORAGE_PROVIDER', 'gridfs').toLowerCase();
        if (provider === 'minio') {
          console.log('[StorageModule] Using MinIO private storage');
          return minio;
        }
        if (provider === 'local') {
          console.log('[StorageModule] Using Local filesystem private storage');
          return local;
        }
        // Default: gridfs — uses the existing MongoDB Atlas connection, works on all machines
        console.log('[StorageModule] Using MongoDB GridFS private storage (default)');
        return gridfs;
      },
      inject: [ConfigService, MinioPrivateStorageService, LocalPrivateStorageService, MongoGridFSPrivateStorageService],
    },
  ],
  exports: [PrivateStorageService, PublicMediaService],
})
export class StorageModule {}
