import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UnsupportedMediaTypeException,
  ForbiddenException,
} from '@nestjs/common';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { ReviewsService } from '../services/reviews.service';

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  bookingItemId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  photographyPackageId?: string;
}

export class ReplyReviewDto {
  @IsString()
  @IsNotEmpty()
  reply: string;
}

export class ReportReviewDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class RateCustomerDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class HandleReportDto {
  @IsString()
  @IsNotEmpty()
  action: 'DELETE' | 'DISMISS';

  @IsString()
  @IsNotEmpty()
  reason: string;
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(user.sub, dto);
  }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard)
  async reply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviewsService.replyToReview(user.sub, id, dto.reply);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  async report(@Param('id') id: string, @Body() dto: ReportReviewDto) {
    return this.reviewsService.reportReview(id, dto.reason);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@CurrentUser() user: AuthUser) {
    return this.reviewsService.getReviewStats(user.sub);
  }

  @Get('provider/:providerId')
  async getByProvider(@Param('providerId') providerId: string) {
    return this.reviewsService.getReviewsForProvider(providerId);
  }

  @Get('my-status/:productId')
  @UseGuards(JwtAuthGuard)
  async getMyReviewStatus(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ) {
    return this.reviewsService.getMyReviewStatus(user.sub, productId);
  }

  @Get('item/:itemId')
  async getByItem(@Param('itemId') itemId: string) {
    return this.reviewsService.getReviewsForItem(itemId);
  }

  @Post('customer')
  @UseGuards(JwtAuthGuard)
  async rateCust(@CurrentUser() user: AuthUser, @Body() dto: RateCustomerDto) {
    return this.reviewsService.rateCustomer(user.sub, dto);
  }

  @Get('customer/:customerId/trust')
  @UseGuards(JwtAuthGuard)
  async getTrustScore(@Param('customerId') customerId: string) {
    return this.reviewsService.getCustomerTrustScore(customerId);
  }

  private checkAdmin(user: AuthUser) {
    const roles = user.roles || [];
    if (!roles.includes('ADMIN') && !roles.includes('admin')) {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng Admin');
    }
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          callback(
            new UnsupportedMediaTypeException(
              'Only jpg, png, and webp images are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const dest = join(process.cwd(), 'uploads', 'reviews');
          if (!existsSync(dest)) {
            mkdirSync(dest, { recursive: true });
          }
          callback(null, dest);
        },
        filename: (_request, file, callback) => {
          const safeExt = extname(file.originalname).toLowerCase() || '.jpg';
          callback(
            null,
            `rev-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`,
          );
        },
      }),
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const url = `/uploads/reviews/${file.filename}`;
    return { url };
  }

  @Get('admin/reported')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('moderation:read')
  async getReportedReviews(@CurrentUser() user: AuthUser) {
    this.checkAdmin(user);
    return this.reviewsService.getReportedReviewsForAdmin();
  }

  @Post(':id/handle-report')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('moderation:manage')
  async handleReport(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: HandleReportDto,
  ) {
    this.checkAdmin(user);
    return this.reviewsService.handleReportedReview(
      id,
      dto.action,
      dto.reason,
    );
  }
}
