import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MinioPrivateStorageService } from './services/minio-private-storage.service';
import { PrivateStorageService } from './services/private-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PrivateStorageService,
      useClass: MinioPrivateStorageService,
    },
  ],
  exports: [PrivateStorageService],
})
export class StorageModule {}
