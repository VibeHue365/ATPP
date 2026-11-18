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
          console.log('[StorageModule] Using MinIO private storage (with GridFS read fallback)');
          const isMinioNotFound = (error: unknown): boolean => {
            if (!error || typeof error !== 'object') return false;
            const e = error as { code?: string; statusCode?: number };
            return (
              e.code === 'NoSuchKey' ||
              e.code === 'NotFound' ||
              e.code === 'NoSuchBucket' ||
              e.statusCode === 404
            );
          };
          const hybridStorage: PrivateStorageService = {
            uploadPrivateFile: (bucket, storageKey, buffer, contentType) =>
              minio.uploadPrivateFile(bucket, storageKey, buffer, contentType),
            readPrivateFile: async (bucket, storageKey) => {
              try {
                return await minio.readPrivateFile(bucket, storageKey);
              } catch (error) {
                if (isMinioNotFound(error)) {
                  return gridfs.readPrivateFile(bucket, storageKey);
                }
                throw error;
              }
            },
            deletePrivateFile: async (bucket, storageKey) => {
              try {
                await minio.deletePrivateFile(bucket, storageKey);
              } catch (error) {
                if (!isMinioNotFound(error)) {
                  throw error;
                }
              }
              await gridfs.deletePrivateFile(bucket, storageKey).catch(() => undefined);
            },
            exists: async (bucket, storageKey) => {
              if (await minio.exists(bucket, storageKey)) {
                return true;
              }
              return gridfs.exists(bucket, storageKey);
            },
          };
          return hybridStorage;
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
