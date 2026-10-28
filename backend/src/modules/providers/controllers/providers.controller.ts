import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UnsupportedMediaTypeException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { ProvidersService } from '../services/providers.service';
import { ProviderOverviewService } from '../services/provider-overview.service';
import { ProviderOverviewQueryDto } from '../dto/provider-overview-query.dto';
import { CreatePortfolioItemDto, UpdatePortfolioItemDto } from '../dto/portfolio-item.dto';
import { UpdateProviderProfileDto, AddPortfolioImageDto } from '../dto/update-provider-profile.dto';
import { PublicMediaService } from '../../storage/services/public-media.service';
import {
  RecurringScheduleDto,
  BulkRecurringScheduleDto,
  SpecificDateScheduleDto,
} from '../dto/provider-schedule.dto';

@Controller('providers')
@UseGuards(JwtAuthGuard)
export class ProvidersController {
  constructor(
    private readonly providersService: ProvidersService,
    private readonly providerOverviewService: ProviderOverviewService,
    private readonly publicMedia: PublicMediaService,
  ) { }

  @Post('me/cover-image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      storage: memoryStorage(),
    }),
  )
  async uploadCoverImage(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn file ảnh để tải lên');
    const { fileTypeFromBuffer } = await import('file-type');
    const detectedType = await fileTypeFromBuffer(file.buffer);
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!detectedType || !validMimes.includes(detectedType.mime)) {
      throw new UnsupportedMediaTypeException('Chỉ chấp nhận file ảnh JPEG, PNG, WEBP hợp lệ');
    }
    const uploaded = await this.publicMedia.uploadImage('providers/cover', file);
    return { url: uploaded.url, key: uploaded.key };
  }

  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    return this.providersService.getOrCreateProvider(
      user.sub,
      user.email,
      user.email.split('@')[0],
    );
  }

  @Get('me/overview')
  async getOverview(
    @CurrentUser() user: AuthUser,
    @Query() query: ProviderOverviewQueryDto,
  ) {
    return this.providerOverviewService.getOverview(user.sub, query);
  }

  @Get('me/analytics')
  async getAnalytics(
    @CurrentUser() user: AuthUser,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.providersService.getProviderAnalytics(
      user.sub,
      period,
      from || startDate,
      to || endDate,
    );
  }

  /** GET /providers/me/wallet — Xem số dư ví thợ ảnh */
  @Get('me/wallet')
  async getWallet(@CurrentUser() user: AuthUser) {
    return this.providersService.getWallet(user.sub);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProviderProfileDto,
  ) {
    return this.providersService.updateProfile(user.sub, dto);
  }

  @Post('me/portfolio')
  async addPortfolio(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddPortfolioImageDto,
  ) {
    return this.providersService.addPortfolioImage(user.sub, dto.imageUrl);
  }

  @Delete('me/portfolio')
  async removePortfolio(
    @CurrentUser() user: AuthUser,
    @Query('imageUrl') imageUrl: string,
  ) {
    return this.providersService.removePortfolioImage(user.sub, imageUrl);
  }

  @Get('me/portfolio-items')
  async listPortfolioItems(@CurrentUser() user: AuthUser) {
    return this.providersService.listMyPortfolioItems(user.sub);
  }

  @Post('me/portfolio-items')
  async createPortfolioItem(@CurrentUser() user: AuthUser, @Body() dto: CreatePortfolioItemDto) {
    return this.providersService.createPortfolioItem(user.sub, dto);
  }

  @Patch('me/portfolio-items/:id')
  async updatePortfolioItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePortfolioItemDto) {
    return this.providersService.updatePortfolioItem(user.sub, id, dto);
  }

  @Delete('me/portfolio-items/:id')
  async deletePortfolioItem(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.providersService.removePortfolioItem(user.sub, id);
    return { message: 'Portfolio item deleted' };
  }

  @Get('me/schedules')
  async getSchedules(@CurrentUser() user: AuthUser) {
    return this.providersService.getSchedules(user.sub);
  }

  @Post('me/schedules/recurring')
  async updateRecurring(
    @CurrentUser() user: AuthUser,
    @Body() dto: RecurringScheduleDto,
  ) {
    return this.providersService.updateRecurringSchedule(
      user.sub,
      dto.dayOfWeek,
      dto.workingHours,
      dto.capability,
    );
  }

  @Post('me/schedules/recurring/bulk')
  async updateRecurringBulk(
    @CurrentUser() user: AuthUser,
    @Body() dto: BulkRecurringScheduleDto,
  ) {
    return this.providersService.updateRecurringSchedules(
      user.sub,
      dto.dayOfWeeks,
      dto.workingHours,
      dto.capability,
    );
  }
  @Post('me/schedules/specific-date')
  async updateSpecificDate(
    @CurrentUser() user: AuthUser,
    @Body() dto: SpecificDateScheduleDto,
  ) {
    return this.providersService.updateSpecificDateSchedule(
      user.sub,
      dto.date,
      dto.isOffDay,
      dto.customSlots,
      dto.capability,
      dto.reason,
    );
  }
}
