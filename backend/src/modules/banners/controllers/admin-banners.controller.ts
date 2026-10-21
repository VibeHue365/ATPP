import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UnsupportedMediaTypeException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { BannersService } from '../services/banners.service';
import { BannerPlacement } from '../schemas/banner.schema';
import { UpdateBannerDto } from '../dto/banner.dto';

@Controller('admin/banners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminBannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  async getAdminBanners() {
    return this.bannersService.getAllBannersForAdmin();
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // Tối đa 5MB
      fileFilter: (_request, file, callback) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          callback(
            new UnsupportedMediaTypeException(
              'Chỉ chấp nhận file ảnh định dạng jpg, png, webp',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
      storage: memoryStorage(),
    }),
  )
  async uploadBanner(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Vui lòng chọn file ảnh để tải lên');
    return this.bannersService.uploadBannerImage(file);
  }

  @Put(':placement')
  async updateBanner(
    @Param('placement') placement: string,
    @Body() dto: UpdateBannerDto,
    @CurrentUser() user: AuthUser,
  ) {
    dto.placement = placement.toUpperCase() as BannerPlacement;
    return this.bannersService.updateBanner(dto, user?.sub);
  }

  @Delete(':placement')
  async deleteBanner(@Param('placement') placement: string) {
    return this.bannersService.deleteBanner(placement.toUpperCase() as BannerPlacement);
  }
}
