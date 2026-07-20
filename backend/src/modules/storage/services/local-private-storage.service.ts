import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, createReadStream, writeFileSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { Readable } from 'stream';
import { PrivateStoragePutResult, PrivateStorageService } from './private-storage.service';

/**
 * Local filesystem implementation of PrivateStorageService.
 * Used in development when MinIO is not available.
 * Files are stored under BASE_DIR/<bucket>/<storageKey>
 */
@Injectable()
export class LocalPrivateStorageService extends PrivateStorageService {
  private readonly baseDir: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.baseDir = this.configService.get<string>(
      'LOCAL_PRIVATE_STORAGE_DIR',
      join(process.cwd(), 'private-storage'),
    );
  }

  async uploadPrivateFile(
    bucket: string,
    storageKey: string,
    buffer: Buffer,
    _contentType: string,
  ): Promise<PrivateStoragePutResult> {
    const filePath = this.resolveFilePath(bucket, storageKey);
    const fileDir = dirname(filePath);

    // Create intermediate directories if they don't exist
    if (!existsSync(fileDir)) {
      mkdirSync(fileDir, { recursive: true });
    }

    writeFileSync(filePath, buffer);

    return {
      storageProvider: 'LOCAL',
      bucket,
      storageKey,
    };
  }

  async readPrivateFile(bucket: string, storageKey: string): Promise<Readable> {
    const filePath = this.resolveFilePath(bucket, storageKey);

    if (!existsSync(filePath)) {
      throw new NotFoundException(`Private file not found: ${bucket}/${storageKey}`);
    }

    return createReadStream(filePath);
  }

  async deletePrivateFile(bucket: string, storageKey: string): Promise<void> {
    const filePath = this.resolveFilePath(bucket, storageKey);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  async exists(bucket: string, storageKey: string): Promise<boolean> {
    const filePath = this.resolveFilePath(bucket, storageKey);
    try {
      return existsSync(filePath) && statSync(filePath).isFile();
    } catch {
      return false;
    }
  }

  private resolveFilePath(bucket: string, storageKey: string): string {
    // Sanitize to prevent directory traversal
    const safeBucket = bucket.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const safeKey = storageKey.replace(/\.\./g, '_');
    return join(this.baseDir, safeBucket, safeKey);
  }
}
