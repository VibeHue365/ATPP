import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
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
}
