import {
  UnsupportedMediaTypeException,
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UsersService } from '../services/users.service';

interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.usersService.getMe(user.sub, user.roles);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
    @Req() request: RequestMeta,
  ): Promise<Record<string, unknown>> {
    return this.usersService.updateProfile(
      user.sub,
      dto,
      request.ip,
      this.userAgent(request),
      user.roles,
    );
  }

  @Patch('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
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
      storage: memoryStorage(),
    }),
  )
  updateAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: RequestMeta,
  ): Promise<Record<string, unknown>> {
    return this.usersService.updateAvatar(
      user.sub,
      file,
      request.ip,
      this.userAgent(request),
      user.roles,
    );
  }

  @Patch('me/preferences')
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() preferences: any,
  ): Promise<Record<string, unknown>> {
    return this.usersService.updatePreferences(
      user.sub,
      preferences,
      user.roles,
    );
  }

  @Patch('me/favorites')
  toggleFavorite(
    @CurrentUser() user: AuthUser,
    @Body('targetType') targetType: string,
    @Body('targetId') targetId: string,
  ): Promise<Record<string, unknown>> {
    return this.usersService.toggleFavorite(
      user.sub,
      targetType,
      targetId,
      user.roles,
    );
  }

  private userAgent(request: RequestMeta): string | undefined {
    const value = request.headers['user-agent'];
    return Array.isArray(value) ? value[0] : value;
  }
}
