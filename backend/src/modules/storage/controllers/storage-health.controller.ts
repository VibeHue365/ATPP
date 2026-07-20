import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PublicMediaService } from '../services/public-media.service';

@Controller('health/storage')
export class StorageHealthController {
  constructor(private readonly publicMedia: PublicMediaService) {}

  @Get()
  async check() {
    try {
      const result = await this.publicMedia.health();
      return { status: 'UP', provider: 'CLOUDINARY', ...result };
    } catch {
      throw new ServiceUnavailableException({ status: 'DOWN', provider: 'CLOUDINARY' });
    }
  }
}