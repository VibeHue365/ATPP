import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// CLIP is warmed up when the AI service starts; three photos take about a second.
const DEFAULT_TIMEOUT_MS = 20_000;
const CLOUDINARY_HOST = 'res.cloudinary.com';

export interface ProductDraftAttribute {
  group: 'color' | 'pattern' | 'gender' | 'style';
  key: string;
  label: string;
  confidence: number;
  on_cover: boolean;
}

export interface ProductDraft {
  status: 'SUCCESS' | 'NOT_AO_DAI' | 'UNAVAILABLE';
  attributes: ProductDraftAttribute[];
  name: string;
  description: string;
  colors: string[];
}

const UNAVAILABLE: ProductDraft = {
  status: 'UNAVAILABLE',
  attributes: [],
  name: '',
  description: '',
  colors: [],
};

/**
 * UC-C10: asks the AI service (local CLIP, no external API) to suggest a product
 * name, description and colours from the provider's uploaded photos.
 */
@Injectable()
export class ProductDraftClientService {
  private readonly logger = new Logger(ProductDraftClientService.name);
  private readonly serviceUrl: string;
  private readonly cloudName: string;

  constructor(private readonly configService: ConfigService) {
    this.serviceUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://127.0.0.1:8000');
    this.cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME', '') ?? '';
  }

  async draftFromPhotos(imageUrls: string[]): Promise<ProductDraft> {
    this.assertUploadedPhotos(imageUrls);
    try {
      const response = await fetch(`${this.serviceUrl.replace(/\/$/, '')}/vision/describe-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_urls: imageUrls }),
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      });
      if (!response.ok) {
        this.logger.warn(`Product draft AI returned HTTP ${response.status}`);
        return UNAVAILABLE;
      }
      const payload = (await response.json()) as Partial<ProductDraft>;
      return {
        status: payload.status ?? 'UNAVAILABLE',
        attributes: Array.isArray(payload.attributes) ? payload.attributes : [],
        name: String(payload.name ?? '').slice(0, 200),
        description: String(payload.description ?? '').slice(0, 1000),
        colors: Array.isArray(payload.colors) ? payload.colors : [],
      };
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown error';
      this.logger.warn(`Product draft AI is unavailable: ${reason}`);
      return UNAVAILABLE;
    }
  }

  /**
   * Only photos uploaded through the product upload (Cloudinary, this account) are
   * accepted, so the AI service is never asked to download an arbitrary URL.
   */
  private assertUploadedPhotos(imageUrls: string[]): void {
    for (const value of imageUrls) {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new BadRequestException('Ảnh gợi ý phải là ảnh đã tải lên hệ thống.');
      }
      const ownCloud = !this.cloudName || url.pathname.startsWith(`/${this.cloudName}/`);
      if (url.protocol !== 'https:' || url.hostname !== CLOUDINARY_HOST || !ownCloud) {
        throw new BadRequestException('Ảnh gợi ý phải là ảnh đã tải lên hệ thống.');
      }
    }
  }

  private getTimeoutMs(): number {
    const configured = Number(
      this.configService.get<string>('PRODUCT_DRAFT_TIMEOUT_MS', String(DEFAULT_TIMEOUT_MS)),
    );
    return Number.isFinite(configured) && configured >= 1_000 && configured <= 60_000
      ? configured
      : DEFAULT_TIMEOUT_MS;
  }
}
