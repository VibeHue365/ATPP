import { Injectable, ServiceUnavailableException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Client } from 'minio';

@Injectable()
export class PublicMediaService {
  private readonly client: Client;
  private readonly bucket: string;
  private ensured = false;

  constructor(private readonly config: ConfigService) {
    this.client = new Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', '127.0.0.1'),
      port: this.number('MINIO_PORT', 9000),
      useSSL: this.boolean('MINIO_USE_SSL', false),
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', ''),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', ''),
    });
    this.bucket = this.config.get<string>('MINIO_PUBLIC_BUCKET', 'public-media');
  }

  async uploadImage(scope: string, file: Express.Multer.File): Promise<{ key: string; url: string }> {
    if (!file?.buffer?.length) throw new ServiceUnavailableException('Image buffer is required');
    this.assertValidImage(file);
    await this.ensureBucket();
    const extension = this.extension(file);
    const key = `${this.safeSegment(scope)}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
    await this.client.putObject(this.bucket, key, file.buffer, file.buffer.length, {
      'Content-Type': file.mimetype,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    return { key, url: this.publicUrl(key) };
  }

  async health(): Promise<{ bucket: string }> {
    await this.ensureBucket();
    return { bucket: this.bucket };
  }
  async deleteByUrl(url: string | null | undefined): Promise<void> {
    const key = this.keyFromUrl(url);
    if (!key) return;
    await this.ensureBucket();
    await this.client.removeObject(this.bucket, key);
  }

  async removeUnreferenced(
    referencedUrls: Iterable<string>,
    olderThan: Date,
  ): Promise<number> {
    await this.ensureBucket();
    const referencedKeys = new Set<string>();
    for (const url of referencedUrls) {
      const key = this.keyFromUrl(url);
      if (key) referencedKeys.add(key);
    }

    let removed = 0;
    const stream = this.client.listObjects(this.bucket, '', true);
    for await (const item of stream as AsyncIterable<{ name?: string; lastModified?: Date }>) {
      if (!item.name || referencedKeys.has(item.name)) continue;
      if (item.lastModified && item.lastModified > olderThan) continue;
      await this.client.removeObject(this.bucket, item.name);
      removed += 1;
    }
    return removed;
  }
  private assertValidImage(file: Express.Multer.File): void {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException('Only jpg, png, and webp images are allowed');
    }
    const header = file.buffer.subarray(0, 12);
    const validJpeg = file.mimetype === 'image/jpeg'
      && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const validPng = file.mimetype === 'image/png'
      && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
    const validWebp = file.mimetype === 'image/webp'
      && header.toString('ascii', 0, 4) === 'RIFF'
      && header.toString('ascii', 8, 12) === 'WEBP';
    if (!validJpeg && !validPng && !validWebp) {
      throw new UnsupportedMediaTypeException('Image content does not match its declared format');
    }
  }
  private async ensureBucket(): Promise<void> {
    if (this.ensured) return;
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) await this.client.makeBucket(this.bucket);
    await this.client.setBucketPolicy(this.bucket, JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${this.bucket}/*`],
      }],
    }));
    this.ensured = true;
  }

  private publicUrl(key: string): string {
    const configured = this.config.get<string>('MINIO_PUBLIC_BASE_URL');
    const base = configured?.replace(/\/$/, '') || `http${this.boolean('MINIO_USE_SSL', false) ? 's' : ''}://${this.config.get<string>('MINIO_ENDPOINT', '127.0.0.1')}:${this.number('MINIO_PORT', 9000)}`;
    return `${base}/${this.bucket}/${key}`;
  }

  private keyFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const marker = `/${this.bucket}/`;
    const index = url.indexOf(marker);
    return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
  }

  private extension(file: Express.Multer.File): string {
    const byMime: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
    return byMime[file.mimetype] ?? (extname(file.originalname).toLowerCase() || '.bin');
  }

  private safeSegment(value: string): string { return value.replace(/[^a-z0-9-]/gi, '-').toLowerCase(); }
  private number(key: string, fallback: number): number { const value = Number(this.config.get<string>(key, String(fallback))); return Number.isFinite(value) ? value : fallback; }
  private boolean(key: string, fallback: boolean): boolean { const value = this.config.get<string>(key); return value ? ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()) : fallback; }
}