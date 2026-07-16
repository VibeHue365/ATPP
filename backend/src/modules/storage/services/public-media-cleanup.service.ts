import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Connection } from 'mongoose';
import { PublicMediaService } from './public-media.service';

const MEDIA_COLLECTIONS = [
  'users', 'products', 'reviews', 'booking_items', 'providers', 'portfolio_items',
];

@Injectable()
export class PublicMediaCleanupService {
  private readonly logger = new Logger(PublicMediaCleanupService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly publicMedia: PublicMediaService,
  ) {}

  @Cron('30 3 * * *')
  async removeUnreferencedUploads(): Promise<void> {
    const db = this.connection.db;
    if (!db) {
      this.logger.warn('Skipping media cleanup because MongoDB is not connected');
      return;
    }

    const urls = new Set<string>();
    for (const collection of MEDIA_COLLECTIONS) {
      const cursor = db.collection(collection).find({});
      for await (const document of cursor) this.collectUrls(document, urls);
    }
    const olderThan = new Date(Date.now() - this.orphanGraceHours() * 60 * 60 * 1000);
    const removed = await this.publicMedia.removeUnreferenced(urls, olderThan);
    if (removed) this.logger.log(`Removed ${removed} unreferenced public media object(s)`);
  }

  private orphanGraceHours(): number {
    const value = Number(process.env.PUBLIC_MEDIA_ORPHAN_GRACE_HOURS ?? 24);
    return Number.isFinite(value) && value >= 1 ? value : 24;
  }
  private collectUrls(value: unknown, urls: Set<string>): void {
    if (typeof value === 'string') {
      if (value.includes('/public-media/')) urls.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => this.collectUrls(entry, urls));
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach((entry) => this.collectUrls(entry, urls));
    }
  }
}