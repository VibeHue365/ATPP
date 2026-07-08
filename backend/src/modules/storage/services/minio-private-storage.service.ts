import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'stream';
import {
  PrivateStoragePutResult,
  PrivateStorageService,
} from './private-storage.service';

@Injectable()
export class MinioPrivateStorageService extends PrivateStorageService {
  private readonly client: Client;
  private readonly autoCreateBuckets: boolean;
  private readonly ensuredBuckets = new Set<string>();

  constructor(private readonly configService: ConfigService) {
    super();
    this.client = new Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', '127.0.0.1'),
      port: this.readNumber('MINIO_PORT', 9000),
      useSSL: this.readBoolean('MINIO_USE_SSL', false),
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', ''),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', ''),
    });
    this.autoCreateBuckets = this.readBoolean(
      'MINIO_AUTO_CREATE_BUCKETS',
      true,
    );
  }

  async uploadPrivateFile(
    bucket: string,
    storageKey: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<PrivateStoragePutResult> {
    await this.ensureBucket(bucket);
    await this.client.putObject(bucket, storageKey, buffer, buffer.length, {
      'Content-Type': contentType,
    });

    return {
      storageProvider: 'MINIO',
      bucket,
      storageKey,
    };
  }

  async readPrivateFile(
    bucket: string,
    storageKey: string,
  ): Promise<Readable> {
    await this.ensureBucket(bucket);
    return this.client.getObject(bucket, storageKey);
  }

  async deletePrivateFile(bucket: string, storageKey: string): Promise<void> {
    await this.ensureBucket(bucket);
    await this.client.removeObject(bucket, storageKey);
  }

  async exists(bucket: string, storageKey: string): Promise<boolean> {
    try {
      await this.ensureBucket(bucket);
      await this.client.statObject(bucket, storageKey);
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  private async ensureBucket(bucket: string): Promise<void> {
    if (!bucket) {
      throw new ServiceUnavailableException('MinIO bucket is not configured');
    }
    if (this.ensuredBuckets.has(bucket)) {
      return;
    }

    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      if (!this.autoCreateBuckets) {
        throw new ServiceUnavailableException(
          `MinIO bucket ${bucket} does not exist`,
        );
      }
      await this.client.makeBucket(bucket);
    }

    this.ensuredBuckets.add(bucket);
  }

  private readNumber(key: string, defaultValue: number): number {
    const value = this.configService.get<string>(key);
    if (!value) {
      return defaultValue;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  private readBoolean(key: string, defaultValue: boolean): boolean {
    const value = this.configService.get<string>(key);
    if (!value) {
      return defaultValue;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private isNotFoundError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const maybeError = error as { code?: string; statusCode?: number };
    return (
      maybeError.code === 'NoSuchKey' ||
      maybeError.code === 'NotFound' ||
      maybeError.code === 'NoSuchBucket' ||
      maybeError.statusCode === 404
    );
  }
}
