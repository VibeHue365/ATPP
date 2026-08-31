import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { PrivateStoragePutResult, PrivateStorageService } from './private-storage.service';

/**
 * MongoDB GridFS implementation of PrivateStorageService.
 *
 * Stores private files directly in the existing MongoDB Atlas instance.
 * Works across all machines that share the same MongoDB connection — no extra
 * services (MinIO, S3, etc.) needed.
 *
 * Bucket naming: GridFS bucket name = `private_<bucket>` to avoid collision
 * with public GridFS buckets.
 *
 * Metadata stored per file:
 *   - bucket  : logical bucket name
 *   - storageKey : the storage path (unique per bucket)
 */
@Injectable()
export class MongoGridFSPrivateStorageService extends PrivateStorageService implements OnModuleInit {
  // Cache of GridFSBucket instances keyed by bucket name
  private readonly buckets = new Map<string, GridFSBucket>();

  constructor(@InjectConnection() private readonly connection: Connection) {
    super();
  }

  onModuleInit() {
    // Connection is ready at this point — nothing to do, buckets are created lazily
    console.log('[MongoGridFSPrivateStorage] Using MongoDB GridFS for private file storage');
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  async uploadPrivateFile(
    bucket: string,
    storageKey: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<PrivateStoragePutResult> {
    const gfs = this.getBucket(bucket);

    // Delete any existing file with the same storageKey to keep storage clean
    await this.deleteIfExists(gfs, bucket, storageKey);

    await new Promise<void>((resolve, reject) => {
      const uploadStream = gfs.openUploadStream(storageKey, {
        metadata: { bucket, storageKey, contentType },
      });
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
      uploadStream.end(buffer);
    });

    return { storageProvider: 'GRIDFS', bucket, storageKey };
  }

  async readPrivateFile(bucket: string, storageKey: string): Promise<Readable> {
    const gfs = this.getBucket(bucket);
    const file = await this.findFile(gfs, bucket, storageKey);

    if (!file) {
      throw new NotFoundException(`Private file not found: ${bucket}/${storageKey}`);
    }

    return gfs.openDownloadStream(file._id as ObjectId);
  }

  async deletePrivateFile(bucket: string, storageKey: string): Promise<void> {
    const gfs = this.getBucket(bucket);
    await this.deleteIfExists(gfs, bucket, storageKey);
  }

  async exists(bucket: string, storageKey: string): Promise<boolean> {
    const gfs = this.getBucket(bucket);
    const file = await this.findFile(gfs, bucket, storageKey);
    return file !== null;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Returns (or lazily creates) a GridFSBucket for the given logical bucket name. */
  private getBucket(bucket: string): GridFSBucket {
    if (!this.buckets.has(bucket)) {
      const gfsBucketName = `private_${bucket.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      const db = this.connection.db;
      if (!db) {
        throw new Error('MongoDB connection is not established yet');
      }
      this.buckets.set(bucket, new GridFSBucket(db, { bucketName: gfsBucketName }));
    }
    return this.buckets.get(bucket)!;
  }

  /** Finds a GridFS file document by (bucket, storageKey) metadata. */
  private async findFile(gfs: GridFSBucket, bucket: string, storageKey: string) {
    const cursor = gfs.find({ filename: storageKey, 'metadata.bucket': bucket }, { limit: 1 });
    const files = await cursor.toArray();
    return files.length > 0 ? files[0] : null;
  }

  /** Deletes a file from GridFS if it exists (no-op if absent). */
  private async deleteIfExists(gfs: GridFSBucket, bucket: string, storageKey: string): Promise<void> {
    const existing = await this.findFile(gfs, bucket, storageKey);
    if (existing) {
      await gfs.delete(existing._id as ObjectId);
    }
  }
}
