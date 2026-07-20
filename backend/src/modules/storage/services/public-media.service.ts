import { Injectable, ServiceUnavailableException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class PublicMediaService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(scope: string, file: Express.Multer.File): Promise<{ key: string; url: string }> {
    if (!file?.buffer?.length) throw new ServiceUnavailableException('Image buffer is required');
    this.assertValidImage(file);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `vibehue/${this.safeSegment(scope)}`,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({ key: result.public_id, url: result.secure_url });
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  async uploadVideo(scope: string, file: Express.Multer.File): Promise<{ key: string; url: string }> {
    if (!file?.buffer?.length) throw new ServiceUnavailableException('Video buffer is required');
    this.assertValidVideo(file);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `vibehue/${this.safeSegment(scope)}`,
          resource_type: 'video',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({ key: result.public_id, url: result.secure_url });
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  async health(): Promise<{ status: string }> {
    return { status: 'UP' };
  }

  async deleteByUrl(url: string | null | undefined): Promise<void> {
    const key = this.keyFromUrl(url);
    if (!key) return;
    const isVideo = url.includes('/video/');
    await cloudinary.uploader.destroy(key, { resource_type: isVideo ? 'video' : 'image' });
  }

  async removeUnreferenced(
    referencedUrls: Iterable<string>,
    olderThan: Date,
  ): Promise<number> {
    // Cloudinary does not require local orphan cleanup
    return 0;
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

  private assertValidVideo(file: Express.Multer.File): void {
    const allowedMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException('Only mp4, webm, and mov videos are allowed');
    }
    const header = file.buffer.subarray(0, 12);
    const validMp4Like =
      (file.mimetype === 'video/mp4' || file.mimetype === 'video/quicktime') &&
      header.toString('ascii', 4, 8) === 'ftyp';
    const validWebm =
      file.mimetype === 'video/webm' &&
      header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
    if (!validMp4Like && !validWebm) {
      throw new UnsupportedMediaTypeException('Video content does not match its declared format');
    }
  }

  private keyFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const match = url.match(/\/upload\/(?:v\d+\/)?([^.]+)/);
    return match ? match[1] : null;
  }

  private safeSegment(value: string): string {
    return value.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  }
}