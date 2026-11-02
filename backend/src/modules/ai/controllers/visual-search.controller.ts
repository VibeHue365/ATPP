import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../../common/guards/optional-jwt-auth.guard';
import { RateLimitService } from '../../auth/services/rate-limit.service';
import { ProductsService } from '../../products/services/products.service';
import { AiService } from '../services/ai.service';

export const VISUAL_SEARCH_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// The AI service only returns this many matches by default (AC: top 5).
const MAX_RESULTS = 5;

export class VisualSearchRequestDto {
  @IsString()
  @IsNotEmpty()
  image_base64: string;

  @IsString()
  @IsIn(VISUAL_SEARCH_MIME_TYPES)
  mime_type: string;
}

interface RequestMeta {
  ip?: string;
}

interface VisualMatch {
  productId: string;
  score: number;
}

/**
 * UC-M09 / VIB-93: find catalog Ao Dai that look like an uploaded photo.
 * Open to guests so the feature works before sign-in; guests are rate limited by IP.
 */
@Controller('ai')
export class VisualSearchController {
  constructor(
    private readonly aiService: AiService,
    private readonly rateLimitService: RateLimitService,
    private readonly productsService: ProductsService,
  ) {}

  @Post('visual-search/match')
  @HttpCode(200) // A search, not a create (AC: HTTP 200 OK).
  @UseGuards(OptionalJwtAuthGuard)
  async visualMatch(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: VisualSearchRequestDto,
    @Req() request?: RequestMeta,
  ) {
    const caller = user?.sub ?? this.rateLimitService.ipKey(request?.ip);
    await this.rateLimitService.assertRateLimit(`ai_match_${caller}`, 20, 60);
    // The ValidationPipe covers HTTP calls; this also protects direct callers.
    if (!dto?.image_base64?.trim()) {
      throw new BadRequestException('Vui lòng chọn ảnh áo dài để tìm kiếm.');
    }

    const matches: VisualMatch[] = await this.aiService.visualMatch({
      image_base64: dto.image_base64,
      mime_type: dto.mime_type,
    });
    const items = await this.loadPublicProducts(
      Array.isArray(matches) ? matches.slice(0, MAX_RESULTS) : [],
    );
    return {
      items,
      message: items.length
        ? null
        : 'Không tìm thấy áo dài phù hợp trong ảnh.',
    };
  }

  /** Product cards in match order; products hidden since indexing drop out. */
  private async loadPublicProducts(matches: VisualMatch[]) {
    if (!matches.length) return [];
    const page = await this.productsService.getActiveProductsPage(
      { ids: matches.map((match) => match.productId) },
      1,
      matches.length,
    );
    const byId = new Map<string, any>(
      page.data.map((product: any) => [String(product._id), product]),
    );
    return matches
      .filter((match) => byId.has(match.productId))
      .map((match) => ({
        ...byId.get(match.productId),
        visualScore: match.score,
      }));
  }
}
