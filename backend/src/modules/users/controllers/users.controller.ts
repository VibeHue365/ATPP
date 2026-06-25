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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UsersService } from '../services/users.service';

interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

const avatarDestination = join(process.cwd(), 'uploads', 'avatars');

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
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          if (!existsSync(avatarDestination)) {
            mkdirSync(avatarDestination, { recursive: true });
          }
          callback(null, avatarDestination);
        },
        filename: (_request, file, callback) => {
          const safeExt = extname(file.originalname).toLowerCase() || '.jpg';
          callback(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`,
          );
        },
      }),
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

  private userAgent(request: RequestMeta): string | undefined {
    const value = request.headers['user-agent'];
    return Array.isArray(value) ? value[0] : value;
  }
}
